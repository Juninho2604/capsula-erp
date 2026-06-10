/**
 * verify-reports.ts — Cruces de cuadre del módulo de Reportes (Prompt 2, CALIDAD #1).
 *
 * Corre las agregaciones de src/lib/reports/ contra la BD (DATABASE_URL) para
 * un tenant y rango, y verifica que las distintas vistas CUADREN entre sí:
 *
 *   C1  Σ ventas por producto == Σ ventas por categoría            (misma base, distinto group by)
 *   C2  Σ por mesonero == Σ por zona == Σ por canal == total rango (agrupaciones a nivel orden)
 *   C3  Σ por producto == Σ SalesOrder.subtotal del rango          (ítems ↔ órdenes)
 *   C4  total facturado == Σ por producto − descuentos + cargos    (puente informativo:
 *       delivery fee / redondeo chanclaje viven en total, no en ítems)
 *   C5  Σ por método de pago == agregado independiente de
 *       SalesOrderPayment(directas) + PaymentSplit(mesas)          (valida el UNION raw)
 *   C6  Σ cierres diarios (facturado) == total del rango
 *   C7  dual-currency: ningún cobro Bs "perdido" (bs>0 o usdSinTasa>0)
 *
 * Uso:
 *   set -a && source .env && set +a
 *   npx tsx scripts/verify-reports.ts --tenant-slug=demo [--from=YYYY-MM-DD --to=YYYY-MM-DD]
 *   npx tsx scripts/verify-reports.ts --tenant-slug=demo --seed-fixtures   # solo tenants de prueba
 *
 * --seed-fixtures crea datos sintéticos (mesa+splits Bs, pago mixto, voids,
 * descuento, PKP, turno de caja, OC) para ejercitar TODOS los caminos.
 * HARD BLOCK: solo permitido en slugs de prueba (demo/verify/test*).
 */

import prisma from '@/server/db';
import { getCaracasDayRange } from '@/lib/datetime';
import {
    getSalesByProduct, getSalesByCategory, getSalesByWaiter, getSalesByZone,
    getSalesByChannel, getSalesByPaymentMethod, getSalesRangeTotals,
} from '@/lib/reports/sales-reports';
import { getDailyClosures } from '@/lib/reports/operations-reports';
import type { ReportFilters } from '@/lib/reports/types';

const TOL = 0.02; // tolerancia en USD por redondeos float

function arg(name: string): string | undefined {
    const hit = process.argv.find(a => a.startsWith(`--${name}=`));
    return hit?.split('=')[1];
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

interface CheckResult { id: string; label: string; pass: boolean; detail: string }
const results: CheckResult[] = [];
function check(id: string, label: string, a: number, b: number, tol = TOL) {
    const diff = Math.abs(a - b);
    results.push({
        id, label, pass: diff <= tol,
        detail: `${a.toFixed(2)} vs ${b.toFixed(2)} (Δ ${diff.toFixed(4)})`,
    });
}
function info(id: string, label: string, detail: string, pass = true) {
    results.push({ id, label, pass, detail });
}

// ─── Fixtures (solo tenants de prueba) ───────────────────────────────────────

const FIXTURE_SLUGS = /^(demo|verify|test|smoketest)/;

async function seedFixtures(tenantId: string, slug: string) {
    if (!FIXTURE_SLUGS.test(slug)) {
        throw new Error(`--seed-fixtures bloqueado para el tenant '${slug}' (solo demo/verify/test*)`);
    }
    console.log('→ Sembrando fixtures de verificación…');

    const [user, area, menuItem, branch] = await Promise.all([
        prisma.user.findFirst({ where: { tenantId }, select: { id: true } }),
        prisma.area.findFirst({ where: { tenantId, isActive: true }, select: { id: true } }),
        prisma.menuItem.findFirst({ where: { tenantId, isActive: true }, select: { id: true, name: true, price: true } }),
        prisma.branch.findFirst({ where: { tenantId }, select: { id: true } }),
    ]);
    if (!user || !area || !menuItem) throw new Error('El tenant de prueba no tiene user/área/menú — corre seed-demo-tenant primero');

    const RATE = 100; // Bs por USD — fija para asserts predecibles
    const now = new Date();
    const stamp = now.getTime().toString().slice(-6);
    const mkItems = (qty: number) => ({
        create: [{
            tenantId, menuItemId: menuItem.id, itemName: menuItem.name,
            unitPrice: menuItem.price, quantity: qty, lineTotal: menuItem.price * qty,
            costPerUnit: 2, costTotal: 2 * qty, marginPerUnit: menuItem.price - 2,
            marginPercent: menuItem.price > 0 ? ((menuItem.price - 2) / menuItem.price) * 100 : 0,
        }],
    });

    // 1) Turno de caja abierto + 2 directas vinculadas (una Bs single, una MULTIPLE)
    const register = await prisma.cashRegister.create({
        data: {
            tenantId, registerName: 'Caja Verify', shiftDate: now, status: 'OPEN',
            openingCashUsd: 100, openingCashBs: 5000, openedById: user.id,
        },
    });

    const directBs = await prisma.salesOrder.create({
        data: {
            tenantId, orderNumber: `VRF-${stamp}-1`, orderType: 'RESTAURANT',
            serviceFlow: 'DIRECT_SALE', sourceChannel: 'POS_RESTAURANT',
            status: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'CASH_BS',
            subtotal: menuItem.price * 2, total: menuItem.price * 2, amountPaid: menuItem.price * 2,
            exchangeRateValue: RATE, totalBs: menuItem.price * 2 * RATE,
            areaId: area.id, branchId: branch?.id ?? null, cashRegisterId: register.id,
            createdById: user.id, items: mkItems(2),
        },
    });
    await prisma.salesOrderPayment.create({
        data: {
            salesOrderId: directBs.id, method: 'CASH_BS',
            amountUSD: directBs.total, amountBS: directBs.total * RATE, exchangeRate: RATE,
        },
    });

    const directMixed = await prisma.salesOrder.create({
        data: {
            tenantId, orderNumber: `VRF-${stamp}-2`, orderType: 'DELIVERY',
            serviceFlow: 'DIRECT_SALE', sourceChannel: 'POS_DELIVERY',
            status: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'MULTIPLE',
            subtotal: menuItem.price, total: menuItem.price, amountPaid: menuItem.price,
            exchangeRateValue: RATE, totalBs: menuItem.price * RATE,
            areaId: area.id, branchId: branch?.id ?? null, cashRegisterId: register.id,
            createdById: user.id, customerName: 'Cliente Verify', items: mkItems(1),
        },
    });
    const half = menuItem.price / 2;
    await prisma.salesOrderPayment.createMany({
        data: [
            { salesOrderId: directMixed.id, method: 'CASH_USD', amountUSD: half, exchangeRate: RATE },
            { salesOrderId: directMixed.id, method: 'PDV_SHANKLISH', amountUSD: half, amountBS: half * RATE, exchangeRate: RATE },
        ],
    });

    // 2) Mesa con split PAID en Bs (con tasa) + ítem anulado con motivo
    const tab = await prisma.openTab.create({
        data: {
            tenantId, branchId: branch!.id, tabCode: `TAB-VRF-${stamp}`,
            status: 'CLOSED', serviceType: 'TABLE_SERVICE',
            runningSubtotal: menuItem.price * 3, runningTotal: menuItem.price * 3,
            balanceDue: 0, totalServiceCharge: menuItem.price * 3 * 0.1,
            openedById: user.id, closedAt: now,
        },
    });
    const tabOrder = await prisma.salesOrder.create({
        data: {
            tenantId, orderNumber: `VRF-${stamp}-3`, orderType: 'RESTAURANT',
            serviceFlow: 'OPEN_TAB', sourceChannel: 'POS_SPORTBAR',
            status: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'CASH_BS',
            subtotal: menuItem.price * 3, total: menuItem.price * 3, amountPaid: menuItem.price * 3,
            areaId: area.id, branchId: branch?.id ?? null, openTabId: tab.id,
            createdById: user.id, items: mkItems(3),
        },
    });
    await prisma.openTabOrder.create({ data: { openTabId: tab.id, salesOrderId: tabOrder.id } });
    const tabTotal = menuItem.price * 3 * 1.1;
    await prisma.paymentSplit.create({
        data: {
            openTabId: tab.id, splitLabel: 'Pago 1 | +10% serv', splitType: 'CUSTOM',
            paymentMethod: 'CASH_BS', status: 'PAID',
            subtotal: menuItem.price * 3, serviceChargeAmount: menuItem.price * 3 * 0.1,
            total: tabTotal, paidAmount: tabTotal,
            amountBs: tabTotal * RATE, exchangeRate: RATE,
            paidAt: now, tipAmount: 1.5,
        },
    });

    // 3) Orden anulada (con motivo/anulador) + ítem anulado suelto
    await prisma.salesOrder.create({
        data: {
            tenantId, orderNumber: `VRF-${stamp}-4`, orderType: 'RESTAURANT',
            serviceFlow: 'DIRECT_SALE', sourceChannel: 'POS_RESTAURANT',
            status: 'CANCELLED', paymentStatus: 'PENDING',
            subtotal: menuItem.price, total: menuItem.price,
            voidedAt: now, voidedById: user.id, voidReason: 'Fixture: cliente se retiró',
            areaId: area.id, createdById: user.id, items: mkItems(1),
        },
    });
    await prisma.salesOrderItem.create({
        data: {
            tenantId, orderId: tabOrder.id, menuItemId: menuItem.id,
            itemName: menuItem.name, unitPrice: menuItem.price, quantity: 1,
            lineTotal: menuItem.price,
            voidedAt: now, voidReason: 'Fixture: plato devuelto', voidedByUserId: user.id,
        },
    });

    // 4) Descuento con autorizador + PKP propina colectiva
    await prisma.salesOrder.create({
        data: {
            tenantId, orderNumber: `VRF-${stamp}-5`, orderType: 'RESTAURANT',
            serviceFlow: 'DIRECT_SALE', sourceChannel: 'POS_RESTAURANT',
            status: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'CASH_USD',
            subtotal: menuItem.price * 3, discount: menuItem.price,
            total: menuItem.price * 2, amountPaid: menuItem.price * 2,
            discountType: 'DIVISAS_33', discountReason: 'Pago en divisas',
            authorizedById: user.id,
            areaId: area.id, createdById: user.id, items: mkItems(3),
        },
    });
    await prisma.salesOrder.create({
        data: {
            tenantId, orderNumber: `PKP-VRF-${stamp}`, orderType: 'PICKUP',
            serviceFlow: 'DIRECT_SALE', sourceChannel: 'POS_RESTAURANT',
            status: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'CASH_USD',
            subtotal: 0, total: 0, amountPaid: 5, customerName: 'PROPINA COLECTIVA',
            areaId: area.id, createdById: user.id,
        },
    });

    // 5) OC parcialmente recibida + movimientos de kardex
    const supplier = await prisma.supplier.findFirst({ where: { tenantId }, select: { id: true } });
    const invItem = await prisma.inventoryItem.findFirst({ where: { tenantId, isActive: true }, select: { id: true, baseUnit: true } });
    if (invItem) {
        await prisma.purchaseOrder.create({
            data: {
                tenantId, orderNumber: `OC-VRF-${stamp}`, status: 'PARTIAL',
                orderDate: now, subtotal: 80, totalAmount: 80,
                supplierId: supplier?.id ?? null, createdById: user.id,
                items: { create: [{ inventoryItemId: invItem.id, quantityOrdered: 10, quantityReceived: 6, unit: invItem.baseUnit, unitPrice: 8, totalPrice: 80 }] },
            },
        });
        await prisma.inventoryMovement.createMany({
            data: [
                { inventoryItemId: invItem.id, movementType: 'PURCHASE', quantity: 6, unit: invItem.baseUnit, unitCost: 8, totalCost: 48, areaId: area.id, createdById: user.id, reason: 'Fixture: recepción OC' },
                { inventoryItemId: invItem.id, movementType: 'SALE', quantity: 2, unit: invItem.baseUnit, areaId: area.id, createdById: user.id, salesOrderId: directBs.id, reason: 'Fixture: venta' },
            ],
        });
    }

    console.log('  Fixtures listos (turno, directas Bs/mixto, mesa+split Bs, voids, descuento, PKP, OC, kardex).');
}

// ─── Verificación ────────────────────────────────────────────────────────────

async function main() {
    const slug = arg('tenant-slug') ?? 'demo';
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tenant) {
        console.error(`Tenant '${slug}' no existe. Tenants:`,
            (await prisma.tenant.findMany({ select: { slug: true } })).map(t => t.slug).join(', '));
        process.exit(1);
    }

    if (hasFlag('seed-fixtures')) await seedFixtures(tenant.id, slug);

    const toStr = arg('to') ?? new Date().toISOString().slice(0, 10);
    const fromStr = arg('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const from = getCaracasDayRange(new Date(fromStr + 'T12:00:00')).start;
    const to = getCaracasDayRange(new Date(toStr + 'T12:00:00')).end;
    const f: ReportFilters = { tenantId: tenant.id, from, to };

    console.log(`\nVerificando cuadre — tenant '${slug}' (${tenant.name}) · ${fromStr} → ${toStr}\n`);

    const [totals, byProduct, byCategory, byWaiter, byZone, byChannel, byMethod, closures] = await Promise.all([
        getSalesRangeTotals(f), getSalesByProduct(f), getSalesByCategory(f),
        getSalesByWaiter(f), getSalesByZone(f), getSalesByChannel(f),
        getSalesByPaymentMethod(f), getDailyClosures(f),
    ]);

    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    const prodTotal = sum(byProduct.map(r => r.revenue));
    const catTotal = sum(byCategory.map(r => r.revenue));
    const waiterTotal = sum(byWaiter.map(r => r.revenue));
    const zoneTotal = sum(byZone.map(r => r.revenue));
    const channelTotal = sum(byChannel.map(r => r.revenue));
    const methodTotal = sum(byMethod.map(r => r.usd));
    const closuresFact = sum(closures.map(c => c.facturado));

    // C1 — producto vs categoría (misma base de ítems)
    check('C1', 'Σ por producto == Σ por categoría', prodTotal, catTotal);

    // C2 — agrupaciones a nivel orden, todas iguales al total del rango
    check('C2a', 'Σ por mesonero == total facturado', waiterTotal, totals.revenue);
    check('C2b', 'Σ por zona == total facturado', zoneTotal, totals.revenue);
    check('C2c', 'Σ por canal == total facturado', channelTotal, totals.revenue);

    // C3 — ítems vs subtotales de órdenes (independiente, vía Prisma aggregate)
    const subAgg = await prisma.salesOrder.aggregate({
        where: {
            tenantId: tenant.id, createdAt: { gte: from, lte: to },
            status: { not: 'CANCELLED' },
            OR: [{ customerName: null }, { customerName: { not: 'PROPINA COLECTIVA' } }],
        },
        _sum: { subtotal: true },
    });
    check('C3', 'Σ por producto == Σ SalesOrder.subtotal', prodTotal, subAgg._sum.subtotal ?? 0);

    // C4 — puente facturado = ítems − descuentos + cargos no-ítem (informativo)
    const bridge = totals.revenue - (prodTotal - totals.discount);
    info('C4', 'Puente facturado ↔ ítems',
        `facturado ${totals.revenue.toFixed(2)} = ítems ${prodTotal.toFixed(2)} − desc ${totals.discount.toFixed(2)} + cargos no-ítem ${bridge.toFixed(2)} (delivery fee / redondeo chanclaje)`);

    // C5 — método de pago vs agregados independientes
    const [directSingle, directMulti, splitsAgg] = await Promise.all([
        prisma.salesOrder.aggregate({
            where: {
                tenantId: tenant.id, createdAt: { gte: from, lte: to },
                status: { not: 'CANCELLED' },
                OR: [{ customerName: null }, { customerName: { not: 'PROPINA COLECTIVA' } }],
                serviceFlow: 'DIRECT_SALE', total: { gt: 0 },
                NOT: { paymentMethod: 'MULTIPLE' },
            },
            _sum: { total: true },
        }),
        prisma.$queryRaw<Array<{ s: number }>>`
            SELECT COALESCE(SUM(p."amountUSD"), 0)::float AS s
            FROM "SalesOrderPayment" p
            JOIN "SalesOrder" o ON o."id" = p."salesOrderId"
            WHERE o."tenantId" = ${tenant.id}
              AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
              AND o."status" <> 'CANCELLED'
              AND COALESCE(o."customerName", '') <> 'PROPINA COLECTIVA'
              AND o."serviceFlow" = 'DIRECT_SALE' AND o."paymentMethod" = 'MULTIPLE'`,
        prisma.paymentSplit.aggregate({
            where: {
                status: 'PAID', paidAt: { gte: from, lte: to },
                openTab: { tenantId: tenant.id },
            },
            _sum: { total: true },
        }),
    ]);
    const independent = (directSingle._sum.total ?? 0) + Number(directMulti[0]?.s ?? 0) + (splitsAgg._sum.total ?? 0);
    check('C5', 'Σ por método == directas + splits (independiente)', methodTotal, independent);

    // C6 — cierres diarios vs total
    check('C6', 'Σ cierres diarios (facturado) == total facturado', closuresFact, totals.revenue);

    // C7 — dual currency sin huecos silenciosos
    const bsMethods = byMethod.filter(m => ['CASH_BS', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG', 'MOBILE_PAY', 'CARD', 'TRANSFER'].includes(m.method));
    const silent = bsMethods.filter(m => m.usd > TOL && m.bs <= 0 && m.usdSinTasa <= 0);
    info('C7', 'Dual currency: cobros Bs con tasa o marcados sin tasa',
        silent.length === 0
            ? `OK — ${bsMethods.length} método(s) Bs: ${bsMethods.map(m => `${m.method} bs=${m.bs.toFixed(2)} sinTasa=${m.usdSinTasa.toFixed(2)}`).join(' · ') || 'ninguno en rango'}`
            : `FALLA en: ${silent.map(m => m.method).join(', ')}`,
        silent.length === 0);

    // ── Salida ──────────────────────────────────────────────────────────────
    console.log('┌──────┬────────────────────────────────────────────────┬────────┐');
    for (const r of results) {
        const status = r.pass ? 'PASS ✅' : 'FAIL ❌';
        console.log(`  ${r.id.padEnd(4)} ${r.label.padEnd(46)} ${status}`);
        console.log(`       ${r.detail}`);
    }
    console.log('└──────┴────────────────────────────────────────────────┴────────┘');
    console.log(`\nResumen rango: facturado ${totals.revenue.toFixed(2)} · órdenes ${totals.orders} · cobrado(métodos) ${methodTotal.toFixed(2)} · COGS snapshot ${totals.cost.toFixed(2)}`);

    const failed = results.filter(r => !r.pass);
    if (failed.length > 0) {
        console.error(`\n${failed.length} cruce(s) FALLARON.`);
        process.exit(1);
    }
    console.log('\nTodos los cruces PASARON.');
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
