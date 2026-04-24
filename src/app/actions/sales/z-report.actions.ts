'use server';

import prisma from '@/server/db';
import { getCaracasDayRange } from '@/lib/datetime';
import { cancelledWhere } from '@/lib/sales-where';

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
    totalTips: number;
    tipCount: number;
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
}

/**
 * Reporte Z (cierre de caja).
 * @param date  Fecha en formato "YYYY-MM-DD". Si se omite, usa hoy.
 */
export async function getDailyZReportAction(date?: string): Promise<{ success: boolean; data?: ZReportData; message?: string }> {
    try {
        const today = date ? new Date(date + 'T12:00:00') : new Date();
        const { start: startOfDay, end: endOfDay } = getCaracasDayRange(today);

        const [orders, cancelledAgg] = await Promise.all([
            prisma.salesOrder.findMany({
                where: {
                    createdAt: { gte: startOfDay, lte: endOfDay },
                    status:    { notIn: ['CANCELLED'] },
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
                        },
                    },
                },
            }),
            prisma.salesOrder.aggregate({
                where: cancelledWhere(startOfDay, endOfDay),
                _count: { id: true },
                _sum: { total: true },
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
            byType.restaurant++;
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

        const netTotal       = grossTotal - totalDiscounts;
        const totalCollected = netTotal + totalServiceFee + totalTips;

        return {
            success: true,
            data: {
                period:         today.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
                totalOrders:    tabGroups.size + nonTabOrders.length,
                ordersByType:   byType,
                grossTotal,
                totalDiscounts,
                netTotal,
                totalServiceFee,
                totalTips,
                tipCount,
                totalCollected,
                discountBreakdown: disc,
                paymentBreakdown:  pay,
                ordersByStatus: {
                    PAID:      tabGroups.size + nonTabOrders.length - openTabsPending.count,
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
