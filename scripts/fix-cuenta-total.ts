/**
 * fix-cuenta-total.ts — Corrige el total de UNA cuenta del historial de ventas
 * para que refleje el monto realmente cobrado (ej. $107).
 *
 * ⚠️  TOCA DATOS FINANCIEROS DE PRODUCCIÓN. Por defecto corre en DRY-RUN
 *     (solo muestra qué haría). Nada se escribe sin --apply.
 *
 * Cómo identifica la cuenta:
 *   1) Mesa: OpenTab.tabCode == <tab>   (en el historial, "Tab 3743" = tabCode)
 *   2) Fallback: SalesOrder.orderNumber que contenga <tab> (pickup/delivery/directa)
 *
 * Qué reconcilia (deja la cuenta consistente para historial, arqueo y Z):
 *   • Mesa:  OpenTab.runningTotal/Subtotal = target, service/tip/discount = 0,
 *            balanceDue = 0; el único PaymentSplit no anulado → paidAmount = target;
 *            la única SalesOrder de la mesa → total/subtotal = target (+ totalBs).
 *   • Orden: SalesOrder.total/subtotal/amountPaid = target, change = 0,
 *            la única línea de pago (si hay) → amountUSD = target (+ amountBS).
 *
 * SEGURIDAD — aborta el --apply (y te dice por qué) si el caso es ambiguo:
 *   • La mesa tiene subcuentas (hay que decidir cuál lleva el monto).
 *   • Hay MÁS DE UN PaymentSplit no anulado, o MÁS DE UNA SalesOrder en la mesa.
 *   • Hay MÁS DE UNA línea de pago en la orden.
 *   En esos casos: mándame la salida del dry-run y te armo la corrección exacta.
 *
 * Uso:
 *   # 1) Ver la cuenta (no escribe nada):
 *   npx tsx scripts/fix-cuenta-total.ts --tenant-slug=shanklish --tab=3743
 *
 *   # 2) Aplicar la corrección a $107:
 *   npx tsx scripts/fix-cuenta-total.ts --tenant-slug=shanklish --tab=3743 --target=107 --apply
 */

import { PrismaClient } from '@prisma/client';

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number | null | undefined) =>
    n == null ? '—' : `$${r2(n).toFixed(2)}`;

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }

    const slug = args['tenant-slug'] || 'shanklish';
    const tabRef = args['tab'];
    const target = r2(parseFloat(args['target'] || '107'));
    const apply = args['apply'] === 'true';

    if (!tabRef) {
        console.error('Falta --tab=<tabCode|orderNumber>. Ej: --tab=3743');
        process.exit(2);
    }
    if (!(target > 0)) {
        console.error('--target debe ser un monto > 0. Ej: --target=107');
        process.exit(2);
    }

    const prisma = new PrismaClient();
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: { id: true, name: true },
        });
        if (!tenant) { console.error(`Tenant "${slug}" no existe`); process.exit(2); }

        console.log(`\n═══ CORRECCIÓN DE CUENTA · ${tenant.name} ═══`);
        console.log(`Referencia: "${tabRef}"  ·  Objetivo: ${money(target)}  ·  Modo: ${apply ? 'APLICAR (escribe)' : 'DRY-RUN (solo lectura)'}\n`);

        // ── 1) Buscar como MESA (tabCode) ───────────────────────────────────
        const tab = await prisma.openTab.findFirst({
            where: { tenantId: tenant.id, tabCode: tabRef },
            include: {
                paymentSplits: true,
                subAccounts: true,
                orders: {
                    include: {
                        salesOrder: {
                            select: {
                                id: true, orderNumber: true, status: true,
                                subtotal: true, discount: true, tax: true, total: true,
                                amountPaid: true, change: true,
                                exchangeRateValue: true, totalBs: true,
                                orderPayments: true,
                            },
                        },
                    },
                },
            },
        });

        if (tab) {
            await handleTab(prisma, tab, target, apply);
            return;
        }

        // ── 2) Fallback: ORDEN directa por orderNumber ──────────────────────
        const orders = await prisma.salesOrder.findMany({
            where: { tenantId: tenant.id, orderNumber: { contains: tabRef } },
            select: {
                id: true, orderNumber: true, orderType: true, status: true, openTabId: true,
                subtotal: true, discount: true, tax: true, total: true,
                amountPaid: true, change: true,
                exchangeRateValue: true, totalBs: true,
                orderPayments: true,
            },
        });

        if (orders.length === 0) {
            console.error(`No se encontró ninguna mesa (tabCode) ni orden (orderNumber) con "${tabRef}" en ${tenant.name}.`);
            console.error('Verificá el número exacto que muestra el historial.');
            process.exit(1);
        }
        if (orders.length > 1) {
            console.error(`Se encontraron ${orders.length} órdenes que contienen "${tabRef}":`);
            for (const o of orders) console.error(`  · ${o.orderNumber} (${o.status}) total ${money(o.total)}`);
            console.error('Usá el orderNumber COMPLETO para desambiguar.');
            process.exit(1);
        }

        await handleOrder(prisma, orders[0], target, apply);
    } finally {
        await prisma.$disconnect();
    }
}

// ── MESA ────────────────────────────────────────────────────────────────────
async function handleTab(prisma: PrismaClient, tab: any, target: number, apply: boolean) {
    const orders = (tab.orders ?? []).map((l: any) => l.salesOrder).filter(Boolean);
    const activeSplits = (tab.paymentSplits ?? []).filter((s: any) => s.status !== 'VOID');
    const totalFacturaActual = r2((tab.runningTotal ?? 0) + (tab.totalServiceCharge ?? 0));
    const totalCobradoActual = activeSplits.length
        ? r2(activeSplits.reduce((s: number, sp: any) => s + (sp.paidAmount ?? 0), 0))
        : totalFacturaActual;

    console.log('── ESTADO ACTUAL (MESA) ─────────────────────────────────────');
    console.log(`tabCode:            ${tab.tabCode}   (status ${tab.status})`);
    console.log(`Cliente:            ${tab.customerLabel ?? '—'}`);
    console.log(`runningSubtotal:    ${money(tab.runningSubtotal)}`);
    console.log(`runningDiscount:    ${money(tab.runningDiscount)}`);
    console.log(`totalServiceCharge: ${money(tab.totalServiceCharge)}`);
    console.log(`totalTip:           ${money(tab.totalTip)}`);
    console.log(`runningTotal:       ${money(tab.runningTotal)}`);
    console.log(`balanceDue:         ${money(tab.balanceDue)}`);
    console.log(`→ totalFactura:     ${money(totalFacturaActual)}`);
    console.log(`→ totalCobrado:     ${money(totalCobradoActual)}   (lo que muestra el historial)`);
    console.log(`\nÓrdenes de la mesa (${orders.length}):`);
    for (const o of orders) console.log(`  · ${o.orderNumber} (${o.status})  total ${money(o.total)}  pagado ${money(o.amountPaid)}  rate ${o.exchangeRateValue ?? '—'}  Bs ${o.totalBs ?? '—'}`);
    console.log(`\nSplits de pago (${tab.paymentSplits?.length ?? 0}, activos ${activeSplits.length}):`);
    for (const sp of (tab.paymentSplits ?? [])) console.log(`  · [${sp.status}] ${sp.paymentMethod ?? '—'}  paidAmount ${money(sp.paidAmount)}  total ${money(sp.total)}  ${sp.subAccountId ? '(subcuenta)' : ''}`);
    console.log(`Subcuentas: ${tab.subAccounts?.length ?? 0}`);
    console.log('─────────────────────────────────────────────────────────────\n');

    // Guardas de ambigüedad.
    const blockers: string[] = [];
    if ((tab.subAccounts?.length ?? 0) > 0) blockers.push('La mesa tiene subcuentas — hay que decidir cuál lleva el monto.');
    if (activeSplits.length > 1) blockers.push(`Hay ${activeSplits.length} splits de pago activos — repartir $${target} entre ellos es ambiguo.`);
    if (orders.length > 1) blockers.push(`La mesa tiene ${orders.length} órdenes (tandas) — no está claro cómo distribuir el total.`);

    if (target === totalCobradoActual && target === totalFacturaActual) {
        console.log(`✔ La cuenta ya está en ${money(target)} tanto en factura como en cobrado. Nada que corregir.`);
        return;
    }

    if (blockers.length) {
        console.log('⛔ CASO AMBIGUO — no aplico automáticamente:');
        for (const b of blockers) console.log(`   • ${b}`);
        console.log('\n   Mandá esta salida y armo la corrección exacta a mano.');
        return;
    }

    const order = orders[0]; // a lo sumo una (guarda arriba)
    const split = activeSplits[0]; // a lo sumo uno

    console.log('── PLAN DE CORRECCIÓN ───────────────────────────────────────');
    console.log(`OpenTab.runningSubtotal:    ${money(tab.runningSubtotal)} → ${money(target)}`);
    console.log(`OpenTab.runningDiscount:    ${money(tab.runningDiscount)} → ${money(0)}`);
    console.log(`OpenTab.totalServiceCharge: ${money(tab.totalServiceCharge)} → ${money(0)}`);
    console.log(`OpenTab.totalTip / tipAmount/tipPercent → 0`);
    console.log(`OpenTab.runningTotal:       ${money(tab.runningTotal)} → ${money(target)}`);
    console.log(`OpenTab.balanceDue:         ${money(tab.balanceDue)} → ${money(0)}`);
    if (order) {
        const bs = order.exchangeRateValue ? r2(target * order.exchangeRateValue) : order.totalBs;
        console.log(`SalesOrder ${order.orderNumber}: total/subtotal ${money(order.total)} → ${money(target)}, amountPaid → ${money(target)}, change → 0${order.exchangeRateValue ? `, totalBs → ${bs}` : ''}`);
    }
    if (split) {
        console.log(`PaymentSplit [${split.status}] ${split.paymentMethod ?? '—'}: paidAmount/total ${money(split.paidAmount)} → ${money(target)}`);
    } else {
        console.log(`(Sin split activo → el historial usará totalFactura=${money(target)} como cobrado.)`);
    }
    console.log('─────────────────────────────────────────────────────────────\n');

    if (!apply) { console.log('DRY-RUN: no se escribió nada. Repetí con --apply para aplicar.'); return; }

    await prisma.$transaction(async (tx) => {
        await tx.openTab.update({
            where: { id: tab.id },
            data: {
                runningSubtotal: target, runningDiscount: 0, runningTax: 0,
                totalServiceCharge: 0, totalTip: 0, tipAmount: 0, tipPercent: 0,
                runningTotal: target, balanceDue: 0,
            },
        });
        if (order) {
            await tx.salesOrder.update({
                where: { id: order.id },
                data: {
                    subtotal: target, discount: 0, total: target,
                    amountPaid: target, change: 0,
                    ...(order.exchangeRateValue ? { totalBs: r2(target * order.exchangeRateValue) } : {}),
                },
            });
        }
        if (split) {
            await tx.paymentSplit.update({
                where: { id: split.id },
                data: {
                    subtotal: target, discount: 0, tax: 0,
                    serviceChargeAmount: 0, tipAmount: 0,
                    total: target, paidAmount: target,
                    ...(split.exchangeRate ? { amountBs: r2(target * split.exchangeRate) } : {}),
                },
            });
        }
    });

    console.log(`✅ Cuenta ${tab.tabCode} corregida a ${money(target)}.`);
}

// ── ORDEN DIRECTA (pickup / delivery / venta directa) ────────────────────────
async function handleOrder(prisma: PrismaClient, order: any, target: number, apply: boolean) {
    const lines = order.orderPayments ?? [];
    console.log('── ESTADO ACTUAL (ORDEN) ────────────────────────────────────');
    console.log(`orderNumber:  ${order.orderNumber}  (${order.orderType}, ${order.status})`);
    console.log(`subtotal:     ${money(order.subtotal)}`);
    console.log(`discount:     ${money(order.discount)}`);
    console.log(`total:        ${money(order.total)}`);
    console.log(`amountPaid:   ${money(order.amountPaid)}`);
    console.log(`change:       ${money(order.change)}`);
    console.log(`rate:         ${order.exchangeRateValue ?? '—'}   totalBs: ${order.totalBs ?? '—'}`);
    console.log(`Líneas de pago (${lines.length}):`);
    for (const p of lines) console.log(`  · ${p.method}  ${money(p.amountUSD)}  ${p.amountBS != null ? `(Bs ${p.amountBS} @ ${p.exchangeRate})` : ''}`);
    console.log('─────────────────────────────────────────────────────────────\n');

    if (order.openTabId) {
        console.log('⚠️  Esta orden pertenece a una mesa (openTabId). Corregila por la mesa:');
        console.log('    ...--tab=<tabCode de la mesa>   (no por el orderNumber).');
        return;
    }
    if (r2(order.total) === target && r2(order.amountPaid) === target) {
        console.log(`✔ La orden ya está en ${money(target)}. Nada que corregir.`);
        return;
    }
    if (lines.length > 1) {
        console.log(`⛔ La orden tiene ${lines.length} líneas de pago (cobro mixto) — repartir $${target} es ambiguo.`);
        console.log('   Mandá esta salida y armo la corrección exacta a mano.');
        return;
    }

    const line = lines[0];
    console.log('── PLAN DE CORRECCIÓN ───────────────────────────────────────');
    console.log(`total/subtotal:  ${money(order.total)} → ${money(target)}`);
    console.log(`amountPaid:      ${money(order.amountPaid)} → ${money(target)}   change → 0`);
    if (order.exchangeRateValue) console.log(`totalBs:         ${order.totalBs ?? '—'} → ${r2(target * order.exchangeRateValue)}`);
    if (line) console.log(`Línea de pago ${line.method}: ${money(line.amountUSD)} → ${money(target)}${line.exchangeRate ? `  (Bs → ${r2(target * line.exchangeRate)})` : ''}`);
    console.log('─────────────────────────────────────────────────────────────\n');

    if (!apply) { console.log('DRY-RUN: no se escribió nada. Repetí con --apply para aplicar.'); return; }

    await prisma.$transaction(async (tx) => {
        await tx.salesOrder.update({
            where: { id: order.id },
            data: {
                subtotal: target, discount: 0, total: target,
                amountPaid: target, change: 0,
                ...(order.exchangeRateValue ? { totalBs: r2(target * order.exchangeRateValue) } : {}),
            },
        });
        if (line) {
            await tx.salesOrderPayment.update({
                where: { id: line.id },
                data: {
                    amountUSD: target,
                    ...(line.exchangeRate ? { amountBS: r2(target * line.exchangeRate) } : {}),
                },
            });
        }
    });

    console.log(`✅ Orden ${order.orderNumber} corregida a ${money(target)}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
