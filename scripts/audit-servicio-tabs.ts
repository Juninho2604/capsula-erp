/**
 * audit-servicio-tabs.ts (§100) — Auditoría de cargo de servicio por mesa.
 * SOLO LECTURA: no modifica nada.
 *
 * Para cada TAB imprime: datos de la cuenta, órdenes (quién las creó),
 * subcuentas y CADA cobro (split) con su cargo de servicio real, el %
 * implícito y el esperado (10%), marcando anomalías.
 *
 * Contexto (§100): hasta este fix existían DOS formas de que el servicio
 * saliera en $0 sin dejar rastro de autor:
 *   a) Exención con PIN válido — el sistema validaba el PIN pero NO guardaba
 *      quién autorizó.
 *   b) Editar el % a 0 al cobrar — sin PIN (hueco, ya cerrado).
 * En cobros ANTERIORES al fix, un split con servicio $0 en mesa TABLE_SERVICE
 * significa una de esas dos rutas — humano con acceso al POS, no una falla
 * de cálculo (el sistema nunca pone 0 solo).
 *
 * Uso:
 *   npx tsx scripts/audit-servicio-tabs.ts --tenant-slug=shanklish --tabs=TAB-3567,TAB-3583
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
    const tabs = (args['tabs'] || '').split(',').map(t => t.trim()).filter(Boolean);
    if (!slug || tabs.length === 0) {
        console.error('Uso: --tenant-slug=shanklish --tabs=TAB-3567,TAB-3583');
        process.exit(2);
    }

    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tenant) { console.error(`Tenant "${slug}" no existe`); process.exit(2); }

    console.log(`\n═══ AUDITORÍA DE SERVICIO · ${tenant.name} · ${tabs.join(', ')} ═══`);
    console.log('(solo lectura)\n');

    for (const tabCode of tabs) {
        const tab = await prisma.openTab.findFirst({
            where: { tenantId: tenant.id, tabCode },
            include: {
                assignedWaiter: { select: { firstName: true, lastName: true } },
                openedBy: { select: { firstName: true, lastName: true, role: true } },
                orders: {
                    include: { createdBy: { select: { firstName: true, lastName: true, role: true } } },
                    orderBy: { createdAt: 'asc' },
                },
                paymentSplits: { orderBy: { createdAt: 'asc' } },
                subAccounts: { orderBy: { sortOrder: 'asc' } },
            },
        });
        if (!tab) { console.log(`✗ ${tabCode}: no encontrada\n`); continue; }

        const fmt = (n: number | null | undefined) => n == null ? '—' : `$${n.toFixed(2)}`;
        const ts = (d: Date | null | undefined) => d ? d.toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—';

        console.log(`┌─ ${tab.tabCode} · ${tab.status} · tipo=${tab.serviceType}`);
        console.log(`│ abierta:  ${ts(tab.openedAt)} por ${tab.openedBy?.firstName ?? '?'} ${tab.openedBy?.lastName ?? ''} (${tab.openedBy?.role ?? '?'})`);
        console.log(`│ cerrada:  ${ts(tab.closedAt)} · mesonero: ${tab.waiterLabel ?? (`${tab.assignedWaiter?.firstName ?? ''} ${tab.assignedWaiter?.lastName ?? ''}`.trim() || '—')}`);
        console.log(`│ subtotal=${fmt(tab.runningSubtotal)} desc=${fmt(tab.runningDiscount)} total=${fmt(tab.runningTotal)}`);
        console.log(`│ SERVICIO TOTAL COBRADO: ${fmt(tab.totalServiceCharge)}  (esperado ~10% de lo cobrado si nadie lo quitó)`);

        console.log(`│\n│ Órdenes (${tab.orders.length}):`);
        for (const o of tab.orders) {
            console.log(`│   ${o.orderNumber} · ${ts(o.createdAt)} · ${o.createdBy ? `${o.createdBy.firstName} ${o.createdBy.lastName} (${o.createdBy.role})` : '—'} · total=${fmt(o.total)}${o.notes ? ` · notas: ${o.notes.slice(0, 60)}` : ''}`);
        }

        if (tab.subAccounts.length > 0) {
            console.log(`│\n│ Subcuentas (${tab.subAccounts.length}):`);
            for (const sa of tab.subAccounts) {
                const pct = sa.subtotal > 0 ? (sa.serviceCharge / sa.subtotal) * 100 : 0;
                console.log(`│   ${sa.label || `#${sa.sortOrder + 1}`} · ${sa.status} · subtotal=${fmt(sa.subtotal)} servicio=${fmt(sa.serviceCharge)} (${pct.toFixed(1)}%) · ${sa.paymentMethod ?? '—'}`);
            }
        }

        console.log(`│\n│ COBROS / splits (${tab.paymentSplits.length}):`);
        let anomalies = 0;
        for (const sp of tab.paymentSplits) {
            const base = sp.total - sp.serviceChargeAmount;
            const pct = base > 0 ? (sp.serviceChargeAmount / base) * 100 : 0;
            const isAnomaly = tab.serviceType === 'TABLE_SERVICE' && base > 0.01 && pct < 9.5;
            if (isAnomaly) anomalies++;
            // §100.2: retenido vs factura → propina registrada en este split
            const propina = Math.max(0, (sp.paidAmount ?? sp.total) - sp.total);
            const propinaTag = propina > 0.009 ? ` · PROPINA REGISTRADA=${fmt(propina)} ⚠` : '';
            console.log(`│   ${isAnomaly ? '⚠' : '·'} ${ts(sp.createdAt)} · ${sp.splitLabel} · ${sp.paymentMethod} · base=${fmt(base)} servicio=${fmt(sp.serviceChargeAmount)} (${pct.toFixed(2)}%) · desc=${fmt(sp.discount)} · retenido=${fmt(sp.paidAmount)}${propinaTag}${sp.notes ? `\n│       notas: ${sp.notes}` : ''}`);
        }

        console.log(`│\n│ VEREDICTO:`);
        if (anomalies === 0) {
            console.log(`│   Sin anomalías de servicio en los cobros de esta mesa.`);
        } else {
            console.log(`│   ${anomalies} cobro(s) con servicio < 10% en mesa TABLE_SERVICE.`);
            console.log(`│   El sistema NUNCA pone el servicio en $0 por sí solo: requiere que`);
            console.log(`│   alguien (a) usara "Quitar servicio" con PIN de capitán/gerente, o`);
            console.log(`│   (b) editara el % a 0 al cobrar (hueco sin PIN, cerrado en §100).`);
            console.log(`│   Si las notas del split no dicen "Exención servicio autorizada por:",`);
            console.log(`│   el cobro es ANTERIOR al fix — no se puede atribuir a una persona`);
            console.log(`│   desde los datos; cruzá la hora del split con quién estaba en caja.`);
        }
        console.log(`└─────────────────────────────────────────────\n`);
    }
    await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
