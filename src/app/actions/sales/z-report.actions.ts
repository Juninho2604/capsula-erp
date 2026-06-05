'use server';

/**
 * Reporte Z (cierre de caja) — multitenant (Lote 5.d — Fase 3 Paso D.b).
 * Solo lectura sobre SalesOrder (tenant-aware).
 */

import prisma from '@/server/db';
import { getCaracasDayRange } from '@/lib/datetime';
import { cancelledWhere } from '@/lib/sales-where';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { canViewPaymentMethod } from '@/lib/permissions/payment-method';
import { tenantFeatureEnabled } from '@/lib/feature-flags';

export interface ZReportData {
    period: string;
    totalOrders: number;
    ordersByType: {
        restaurant: number;
        delivery: number;
        pickup: number;
        pedidosya: number;
        wink: number;
        evento: number;
        tablePong: number;
    };

    grossTotal: number;
    totalDiscounts: number;
    netTotal: number;
    totalServiceFee: number;
    /**
     * Total de PROPINA (todo lo que excede al 10% de servicio). Con el flag
     * `unifyTipReporting` activo incluye tanto el excedente al cobrar como
     * las propinas colectivas registradas aparte. Sin el flag, solo el
     * excedente (comportamiento histórico).
     */
    totalTips: number;
    tipCount: number;
    /** True cuando el flag `unifyTipReporting` está activo (totalTips ya incluye colectivas). */
    tipsUnified?: boolean;
    totalCollected: number;
    openTabsPending: { count: number; total: number };

    discountBreakdown: {
        divisas: number;
        cortesias: number;
        other: number;
    };

    paymentBreakdown: {
        cash: number;
        zelle: number;
        card: number;
        mobile: number;
        transfer: number;
        external: number;
        other: number;
    };

    ordersByStatus: Record<string, number>;
    cancelledTotal: number;
    /** Cuando true, el desglose de pagos viene en cero y el cliente NO debe renderizarlo. */
    hidePaymentMethod?: boolean;
}

/**
 * Reporte Z (cierre de caja).
 * @param date  Fecha en formato "YYYY-MM-DD". Si se omite, usa hoy.
 */
export async function getDailyZReportAction(date?: string): Promise<{ success: boolean; data?: ZReportData; message?: string }> {
    try {
        const today = date ? new Date(date + 'T12:00:00') : new Date();
        const { start: startOfDay, end: endOfDay } = getCaracasDayRange(today);

        const { tenantId } = await resolveTenantContext();
        const session = await getSession();
        const hidePaymentMethod =
            !canViewPaymentMethod(session?.role) &&
            (await tenantFeatureEnabled(tenantId, 'hideCashierPaymentMethod'));
        const tipsUnified = await tenantFeatureEnabled(tenantId, 'unifyTipReporting');
        const db = withTenant(tenantId);
        const [orders, cancelledAgg, collectiveTipOrders] = await Promise.all([
            db.salesOrder.findMany({
                where: {
                    createdAt:    { gte: startOfDay, lte: endOfDay },
                    status:       { notIn: ['CANCELLED'] },
                    customerName: { not: 'PROPINA COLECTIVA' },
                },
                include: {
                    orderPayments: { select: { method: true, amountUSD: true } },
                    openTab: {
                        select: {
                            runningSubtotal:    true,
                            runningDiscount:    true,
                            runningTotal:       true,
                            totalServiceCharge: true,
                            paymentSplits: {
                                where:  { status: 'PAID' },
                                select: { paymentMethod: true, paidAmount: true, splitLabel: true },
                            },
                            subAccounts: {
                                select: { id: true, status: true },
                            },
                        },
                    },
                },
            }),
            db.salesOrder.aggregate({
                where: cancelledWhere(startOfDay, endOfDay),
                _count: { id: true },
                _sum: { total: true },
            }),
            // Propinas colectivas — órdenes ficticias (total=0, amountPaid=propina).
            // Se traen aparte para no inflar conteos por canal ni ventas brutas.
            db.salesOrder.findMany({
                where: {
                    createdAt:    { gte: startOfDay, lte: endOfDay },
                    status:       { notIn: ['CANCELLED'] },
                    customerName: 'PROPINA COLECTIVA',
                },
                select: { amountPaid: true, paymentMethod: true },
            }),
        ]);

        type OrderRow = typeof orders[number];
        type Split = { paymentMethod: string | null; paidAmount: number; splitLabel: string };

        const pay = { cash: 0, card: 0, transfer: 0, mobile: 0, zelle: 0, external: 0, other: 0 };
        const addPayment = (pm: string | null | undefined, amt: number) => {
            const k = (pm ?? '').toUpperCase();
            if      (k === 'CASH' || k === 'CASH_USD' || k === 'CASH_EUR')                              pay.cash     += amt;
            else if (k === 'ZELLE')                                                                      pay.zelle    += amt;
            else if (k === 'CARD' || k === 'BS_POS' || k === 'PDV_SHANKLISH' || k === 'PDV_SUPERFERRO') pay.card     += amt;
            else if (k === 'MOBILE_PAY' || k === 'PAGO_MOVIL' || k === 'MOVIL_NG')                      pay.mobile   += amt;
            else if (k === 'TRANSFER' || k === 'BANK_TRANSFER')                                          pay.transfer += amt;
            else if (k === 'PY')                                                                         pay.external += amt;
            else                                                                                         pay.other    += amt;
        };

        const disc = { divisas: 0, cortesias: 0, other: 0 };
        const addDiscount = (o: OrderRow) => {
            if (o.discount <= 0) return;
            if      (o.discountType === 'DIVISAS_33')                                                                              disc.divisas   += o.discount;
            else if (o.discountType === 'CORTESIA_100' || o.discountType === 'CORTESIA_PERCENT' || o.discountType === 'CORTESIA') disc.cortesias += o.discount;
            else                                                                                                                    disc.other     += o.discount;
        };

        const tabGroups = new Map<string, OrderRow[]>();
        const tabOrderIds = new Set<string>();
        for (const o of orders) {
            if (o.openTabId && o.orderType === 'RESTAURANT') {
                tabOrderIds.add(o.id);
                const g = tabGroups.get(o.openTabId) ?? [];
                g.push(o);
                tabGroups.set(o.openTabId, g);
            }
        }
        const nonTabOrders = orders.filter(o => !tabOrderIds.has(o.id));

        let grossTotal      = 0;
        let totalDiscounts  = 0;
        let totalServiceFee = 0;
        let totalTips       = 0;
        let tipCount        = 0;
        const byType = { restaurant: 0, delivery: 0, pickup: 0, pedidosya: 0, wink: 0, evento: 0, tablePong: 0 };
        const openTabsPending = { count: 0, total: 0 };

        for (const group of Array.from(tabGroups.values())) {
            const tab      = group[0].openTab!;
            const subtotal = tab.runningSubtotal;
            const discount = tab.runningDiscount;
            const netProds = tab.runningTotal;

            const splits: Split[] = (tab.paymentSplits ?? []) as Split[];
            const serviceFee = tab.totalServiceCharge ?? 0;
            const totalFactura = netProds + serviceFee;
            const totalCobrado = splits.reduce((acc: number, sp: Split) => acc + (sp.paidAmount ?? 0), 0);

            if (splits.length === 0) {
                openTabsPending.count++;
                openTabsPending.total += totalFactura;
                continue;
            }

            grossTotal     += subtotal;
            totalDiscounts += discount;
            for (const o of group) addDiscount(o);
            // Count each paid sub-account as a separate invoice; fall back to 1 if no sub-accounts
            const subAccounts = tab.subAccounts ?? [];
            const paidSubCount = subAccounts.filter((s: { status: string }) => s.status === 'PAID').length;
            byType.restaurant += Math.max(1, paidSubCount);
            totalServiceFee += serviceFee;

            const tabTip = Math.max(0, totalCobrado - totalFactura);
            totalTips += tabTip;
            if (tabTip > 0) tipCount++;

            for (const s of splits) addPayment(s.paymentMethod, s.paidAmount ?? 0);
        }

        for (const o of nonTabOrders) {
            grossTotal     += o.subtotal;
            totalDiscounts += o.discount;
            addDiscount(o);

            const amountPaid = o.amountPaid || o.total;
            const netReceived = amountPaid - (o.change || 0);
            const orderTip = (o.change === 0 && amountPaid > o.total)
                ? Math.max(0, amountPaid - o.total) : 0;
            totalTips += orderTip;
            if (orderTip > 0) tipCount++;

            const mixedLines = (o as any).orderPayments as { method: string; amountUSD: number }[] | undefined;
            if (mixedLines && mixedLines.length > 0) {
                for (const p of mixedLines) addPayment(p.method, p.amountUSD);
            } else {
                addPayment(o.paymentMethod, netReceived);
            }

            const ot = (o.orderType || '').toUpperCase();
            const sc = (o.sourceChannel || '').toUpperCase();
            if      (ot === 'DELIVERY')                             byType.delivery++;
            else if (ot === 'PEDIDOSYA' || sc === 'POS_PEDIDOSYA') byType.pedidosya++;
            else if (ot === 'PICKUP')                               byType.pickup++;
            else if (ot === 'WINK' || sc === 'WINK')                byType.wink++;
            else if (ot === 'EVENTO' || sc === 'EVENTO')            byType.evento++;
            else if (ot === 'TABLE_PONG' || sc === 'TABLE_PONG')    byType.tablePong++;
            else                                                     byType.restaurant++;
        }

        // ── Propinas colectivas ──────────────────────────────────────────────
        // Con el flag `unifyTipReporting` activo, las propinas colectivas
        // (registradas como órdenes ficticias aparte) suman al total de
        // PROPINA, junto al excedente al cobrar. El 10% de servicio queda
        // intacto y separado. También entran al arqueo (pay) y a totalCollected
        // para que el cierre reconcilie: ese dinero está físicamente en caja.
        const collectiveTipsTotal = collectiveTipOrders.reduce((s, o) => s + (o.amountPaid || 0), 0);
        const collectiveTipCount = collectiveTipOrders.filter(o => (o.amountPaid || 0) > 0).length;
        if (tipsUnified && collectiveTipsTotal > 0) {
            totalTips += collectiveTipsTotal;
            tipCount  += collectiveTipCount;
            for (const o of collectiveTipOrders) addPayment(o.paymentMethod, o.amountPaid || 0);
        }

        const netTotal       = grossTotal - totalDiscounts;
        const totalCollected = netTotal + totalServiceFee + totalTips;

        // Strip server-side: si el rol no debe ver el método y el flag está
        // activo, devolvemos el desglose en cero para que ni siquiera viaje
        // al cliente (no se filtra en DevTools).
        const exposedPaymentBreakdown = hidePaymentMethod
            ? { cash: 0, zelle: 0, card: 0, mobile: 0, transfer: 0, external: 0, other: 0 }
            : pay;

        return {
            success: true,
            data: {
                period:         today.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
                totalOrders:    byType.restaurant + byType.delivery + byType.pickup + byType.pedidosya + byType.wink + byType.evento + byType.tablePong,
                ordersByType:   byType,
                grossTotal,
                totalDiscounts,
                netTotal,
                totalServiceFee,
                totalTips,
                tipCount,
                tipsUnified,
                totalCollected,
                discountBreakdown: disc,
                paymentBreakdown:  exposedPaymentBreakdown,
                hidePaymentMethod,
                ordersByStatus: {
                    PAID:      byType.restaurant + byType.delivery + byType.pickup + byType.pedidosya + byType.wink + byType.evento + byType.tablePong - openTabsPending.count,
                    CANCELLED: cancelledAgg._count.id,
                    OPEN:      openTabsPending.count,
                },
                openTabsPending,
                cancelledTotal: Number(cancelledAgg._sum.total || 0),
            },
        };
    } catch (error) {
        console.error('Error generating Z report:', error);
        return { success: false, message: 'Error generando reporte Z' };
    }
}
