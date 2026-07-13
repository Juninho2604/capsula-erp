/**
 * audit-orden.ts (§105) — Radiografía de una orden: qué imprimió vs qué
 * registró el sistema. SOLO LECTURA.
 *
 * Uso:
 *   npx tsx scripts/audit-orden.ts --tenant-slug=shanklish --orders=REST-9310,DEL-0042,TAB-3601
 * (acepta orderNumbers de venta directa y tabCodes de mesa)
 */

import { PrismaClient } from '@prisma/client';

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }
    const slug = args['tenant-slug'];
    const refs = (args['orders'] || '').split(',').map(t => t.trim()).filter(Boolean);
    if (!slug || refs.length === 0) {
        console.error('Uso: --tenant-slug=shanklish --orders=REST-9310,TAB-3601');
        process.exit(2);
    }
    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tenant) { console.error('Tenant no existe'); process.exit(2); }
    const fmt = (n: number | null | undefined) => n == null ? '—' : `$${n.toFixed(2)}`;
    const ts = (d: Date | null | undefined) => d ? d.toISOString().replace('T', ' ').slice(0, 16) + 'Z' : '—';

    console.log(`\n═══ AUDITORÍA DE ÓRDENES · ${tenant.name} ═══ (solo lectura)\n`);
    for (const ref of refs) {
        if (ref.toUpperCase().startsWith('TAB-')) {
            console.log(`→ ${ref} es una mesa: usar scripts/audit-servicio-tabs.ts --tabs=${ref}\n`);
            continue;
        }
        const o = await prisma.salesOrder.findFirst({
            where: { tenantId: tenant.id, orderNumber: ref },
            include: {
                items: { include: { modifiers: { select: { name: true, priceAdjustment: true, hideFromKitchen: true, excludedIngredientItemId: true } } } },
                orderPayments: true,
                createdBy: { select: { firstName: true, lastName: true, role: true } },
            },
        });
        if (!o) { console.log(`✗ ${ref}: no encontrada\n`); continue; }
        console.log(`┌─ ${o.orderNumber} · ${o.orderType} · ${o.status} · ${ts(o.createdAt)} · ${o.createdBy ? `${o.createdBy.firstName} (${o.createdBy.role})` : '—'}`);
        console.log(`│ REGISTRADO: subtotal=${fmt(o.subtotal)} desc=${fmt(o.discount)} TOTAL=${fmt(o.total)} pagado=${fmt(o.amountPaid)} vuelto=${fmt(o.change)}`);
        console.log(`│ método=${o.paymentMethod} · dtoTipo=${o.discountType ?? '—'} · razón=${o.discountReason ?? '—'}`);
        if (o.totalBs != null) console.log(`│ Bs: total=${o.totalBs.toLocaleString('es-VE')} @ ${o.exchangeRateValue ?? '—'}`);
        const propinaImplicita = Math.max(0, (o.amountPaid ?? 0) - (o.change ?? 0) - (o.total ?? 0));
        if (propinaImplicita > 0.009) console.log(`│ ⚠ PROPINA IMPLÍCITA (pagado − vuelto − total) = ${fmt(propinaImplicita)} — si el recibo mostró un total redondeado hacia arriba, esta es la diferencia (redondeo→propina, flag exactCashSaleTip)`);
        console.log(`│ Ítems (${o.items.length}) — suma líneas = ${fmt(o.items.reduce((s, i) => s + i.lineTotal, 0))}:`);
        for (const i of o.items) {
            console.log(`│   ${i.quantity}× ${i.itemName} · unit=${fmt(i.unitPrice)} línea=${fmt(i.lineTotal)}${i.voidedAt ? ' [ANULADO]' : ''}`);
        }
        if (o.orderPayments.length > 0) {
            console.log(`│ Líneas de pago (${o.orderPayments.length}):`);
            for (const p of o.orderPayments) {
                console.log(`│   ${p.method} · USD=${fmt(p.amountUSD)}${p.amountBS ? ` · Bs=${p.amountBS.toLocaleString('es-VE')} @${p.exchangeRate ?? '—'}` : ''}`);
            }
            const suma = o.orderPayments.reduce((s, p) => s + (p.amountUSD ?? 0), 0);
            if (Math.abs(suma - (o.total ?? 0)) > 0.01) console.log(`│ ⚠ Σ líneas de pago (${fmt(suma)}) ≠ total (${fmt(o.total)})`);
        }
        console.log(`└────────────────────────────\n`);
    }
    await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
