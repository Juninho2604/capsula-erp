/**
 * diagnose-duplicados-dia.ts — Radiografía de las órdenes de un día para
 * entender un correlativo duplicado (ej. "aparecen 6 y 7 anuladas pero fue
 * una sola"). SOLO LECTURA. No modifica nada.
 *
 * Muestra, en orden de creación, cada orden del día con: correlativo del día
 * (MS-06/DL-07…), orderNumber global, estado, HORA EXACTA de creación (Caracas),
 * quién la creó, total, ítems y datos de anulación. Marca ⚠ POSIBLE DUPLICADO
 * cuando dos órdenes tienen el mismo contenido+total y se crearon con pocos
 * segundos de diferencia (síntoma de doble-click), y distingue eso de dos
 * cargas humanas separadas por minutos.
 *
 * Uso:
 *   npx tsx scripts/diagnose-duplicados-dia.ts --tenant-slug=shanklish
 *   npx tsx scripts/diagnose-duplicados-dia.ts --tenant-slug=shanklish --date=2026-07-22
 */

import { PrismaClient } from '@prisma/client';

const CARACAS_OFFSET_H = -4;

function caracasParts(date: Date) {
    const s = new Date(date.getTime() + CARACAS_OFFSET_H * 3600 * 1000);
    return { year: s.getUTCFullYear(), month: s.getUTCMonth(), day: s.getUTCDate() };
}
function dayRange(date: Date) {
    const { year, month, day } = caracasParts(date);
    // 00:00 Caracas == 04:00 UTC; fin == +24h
    const start = new Date(Date.UTC(year, month, day, 4, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day, 27, 59, 59, 999));
    return { start, end };
}
function caracasClock(d: Date | null | undefined): string {
    if (!d) return '—';
    const s = new Date(d.getTime() + CARACAS_OFFSET_H * 3600 * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${s.getUTCFullYear()}-${p(s.getUTCMonth() + 1)}-${p(s.getUTCDate())} ${p(s.getUTCHours())}:${p(s.getUTCMinutes())}:${p(s.getUTCSeconds())}`;
}

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }
    const slug = args['tenant-slug'];
    if (!slug) { console.error('Uso: --tenant-slug=shanklish [--date=YYYY-MM-DD]'); process.exit(2); }

    const baseDate = args['date']
        ? new Date(Date.UTC(
            Number(args['date'].slice(0, 4)),
            Number(args['date'].slice(5, 7)) - 1,
            Number(args['date'].slice(8, 10)), 16, 0, 0, 0)) // mediodía Caracas del día pedido
        : new Date();
    const { start, end } = dayRange(baseDate);

    const prisma = new PrismaClient();
    try {
        const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
        if (!tenant) { console.error(`Tenant "${slug}" no existe`); process.exit(2); }

        const fmt = (n: number | null | undefined) => n == null ? '—' : `$${n.toFixed(2)}`;

        const orders = await prisma.salesOrder.findMany({
            where: { tenantId: tenant.id, createdAt: { gte: start, lte: end } },
            orderBy: { createdAt: 'asc' },
            include: {
                items: { select: { itemName: true, quantity: true, lineTotal: true } },
                createdBy: { select: { firstName: true, lastName: true, role: true } },
                voidedBy: { select: { firstName: true, lastName: true } },
            },
        });

        console.log(`\n═══ ÓRDENES DEL DÍA · ${tenant.name} · ${caracasClock(start).slice(0, 10)} (Caracas) ═══ (solo lectura)\n`);
        console.log(`Total de órdenes creadas ese día: ${orders.length}\n`);

        // Firma de contenido para detectar duplicados (ítems ordenados + total).
        const sig = (o: typeof orders[number]) =>
            o.items.map(i => `${i.quantity}×${i.itemName}`).sort().join(' | ') + ` @@ ${(o.total ?? 0).toFixed(2)}`;

        const bySig = new Map<string, typeof orders>();
        for (const o of orders) {
            const k = sig(o);
            if (!bySig.has(k)) bySig.set(k, [] as any);
            (bySig.get(k) as any).push(o);
        }

        for (const o of orders) {
            const daily = o.dailyLabel || (o.dailyNumber != null ? String(o.dailyNumber) : '—');
            const who = o.createdBy ? `${o.createdBy.firstName} ${o.createdBy.lastName} (${o.createdBy.role})` : '—';
            const st = o.status === 'CANCELLED' ? 'ANULADA' : o.status;
            console.log(`┌─ [${daily}]  ${o.orderNumber}  ·  ${o.orderType}  ·  ${st}`);
            console.log(`│  creada: ${caracasClock(o.createdAt)}   por: ${who}`);
            console.log(`│  total: ${fmt(o.total)}   pagado: ${fmt(o.amountPaid)}   método: ${o.paymentMethod ?? '—'}`);
            console.log(`│  ítems (${o.items.length}): ${o.items.map(i => `${i.quantity}× ${i.itemName}`).join(', ') || '—'}`);
            if (o.status === 'CANCELLED') {
                const vb = o.voidedBy ? `${o.voidedBy.firstName} ${o.voidedBy.lastName}` : '—';
                console.log(`│  anulada: ${caracasClock(o.voidedAt)}   por: ${vb}   motivo: ${o.voidReason ?? '—'}`);
            }
            if (o.notes) console.log(`│  notas: ${o.notes}`);
            console.log(`└────────────────────────────`);
        }

        // Reporte de posibles duplicados.
        console.log(`\n─── ANÁLISIS DE DUPLICADOS ───`);
        let flagged = 0;
        for (const [k, group] of bySig) {
            if (group.length < 2) continue;
            // Ordenar por creación y medir separación.
            const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            for (let i = 1; i < sorted.length; i++) {
                const gapS = Math.round((sorted[i].createdAt.getTime() - sorted[i - 1].createdAt.getTime()) / 1000);
                const labels = `${sorted[i - 1].dailyLabel || sorted[i - 1].orderNumber} ↔ ${sorted[i].dailyLabel || sorted[i].orderNumber}`;
                const verdict = gapS <= 20
                    ? `⚠ POSIBLE DOBLE-CLICK (mismo contenido, ${gapS}s de diferencia)`
                    : `mismo contenido pero ${gapS}s aparte → probablemente carga humana repetida`;
                console.log(`  ${labels}: ${verdict}`);
                console.log(`     contenido: ${k}`);
                flagged++;
            }
        }
        if (flagged === 0) console.log('  Sin pares de mismo-contenido detectados este día.');
        console.log('');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
