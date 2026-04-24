'use server';

import prisma from '@/server/db';
import { getCaracasDayRange } from '@/lib/datetime';

export interface EndOfDaySummary {
    date: string;
    byChannel: {
        restaurant: number;
        delivery: number;
        pickup: number;
        pedidosya: number;
        wink: number;
        evento: number;
        tablePong: number;
    };
    countByChannel: {
        restaurant: number;
        delivery: number;
        pickup: number;
        pedidosya: number;
        wink: number;
        evento: number;
        tablePong: number;
    };
    totalUSD: number;
    totalDiscounts: number;
    totalServiceFee: number;
    propinas: number;
    propinaCount: number;
    receivedInDivisas: number;
    receivedInBs: number;
    pctDivisas: number;
    pctBs: number;
    totalInvoices: number;
    invoicesCancelled: number;
}

/**
 * Resumen de cierre del día por canal + desglose divisas vs Bs.
 * @param date  Fecha "YYYY-MM-DD" en timezone Caracas. Si se omite, usa hoy.
 */
export async function getEndOfDaySummaryAction(date?: string): Promise<{ success: boolean; data?: EndOfDaySummary; message?: string }> {
    try {
        const today = date ? new Date(date + 'T12:00:00') : new Date();
        const { start: startOfDay, end: endOfDay } = getCaracasDayRange(today);

        const orders = await prisma.salesOrder.findMany({
            where: { createdAt: { gte: startOfDay, lte: endOfDay } },
            include: {
                orderPayments: { select: { method: true, amountUSD: true } },
                openTab: {
                    select: {
                        runningTotal: true,
                        runningSubtotal: true,
                        runningDiscount: true,
                        totalServiceCharge: true,
                        paymentSplits: {
                            where: { status: 'PAID' },
                            select: { paymentMethod: true, paidAmount: true },
                        },
                    },
                },
            },
        });

        const DIVISAS_METHODS = new Set(['CASH', 'CASH_USD', 'CASH_EUR', 'ZELLE']);

        const byChannel = { restaurant: 0, delivery: 0, pickup: 0, pedidosya: 0, wink: 0, evento: 0, tablePong: 0 };
        const countByChannel = { restaurant: 0, delivery: 0, pickup: 0, pedidosya: 0, wink: 0, evento: 0, tablePong: 0 };
        let totalUSD = 0;
        let totalDiscounts = 0;
        let totalServiceFee = 0;
        let propinas = 0;
        let propinaCount = 0;
        let receivedInDivisas = 0;
        let receivedInBs = 0;
        let totalInvoices = 0;
        let invoicesCancelled = 0;

        const tabGroups = new Map<string, typeof orders>();
        const tabOrderIds = new Set<string>();
        for (const o of orders) {
            if (o.openTabId && o.orderType === 'RESTAURANT') {
                tabOrderIds.add(o.id);
                const g = tabGroups.get(o.openTabId) ?? [];
                g.push(o);
                tabGroups.set(o.openTabId, g);
            }
        }

        const getChannel = (orderType: string, sourceChannel?: string | null): keyof typeof byChannel => {
            const t = (orderType || '').toUpperCase();
            const s = (sourceChannel || '').toUpperCase();
            if (t === 'PEDIDOSYA' || s === 'POS_PEDIDOSYA') return 'pedidosya';
            if (t === 'DELIVERY') return 'delivery';
            if (t === 'WINK' || s === 'WINK') return 'wink';
            if (t === 'EVENTO' || s === 'EVENTO') return 'evento';
            if (t === 'TABLE_PONG' || s === 'TABLE_PONG') return 'tablePong';
            if (t === 'PICKUP') return 'pickup';
            return 'restaurant';
        };

        const classifyPayment = (method: string, amount: number) => {
            if (DIVISAS_METHODS.has((method || '').toUpperCase())) {
                receivedInDivisas += amount;
            } else {
                receivedInBs += amount;
            }
        };

        for (const group of Array.from(tabGroups.values())) {
            const cancelled = group.every(o => o.status === 'CANCELLED');
            if (cancelled) { invoicesCancelled++; continue; }
            totalInvoices++;

            const tab = group[0].openTab!;
            const netProds = tab.runningTotal;
            const discount = tab.runningSubtotal - tab.runningTotal;

            const splits = (tab.paymentSplits ?? []) as { paymentMethod: string | null; paidAmount: number }[];
            const serviceFee = tab.totalServiceCharge ?? 0;
            const totalFactura = netProds + serviceFee;
            const totalCobrado = splits.length > 0
                ? splits.reduce((acc, sp) => acc + (sp.paidAmount ?? 0), 0)
                : totalFactura;

            totalDiscounts += discount;
            totalServiceFee += serviceFee;
            const tabPropina = Math.max(0, totalCobrado - totalFactura);
            propinas += tabPropina;
            if (tabPropina > 0) propinaCount++;
            totalUSD += totalCobrado;

            byChannel.restaurant += totalCobrado;
            countByChannel.restaurant++;

            if (splits.length > 0) {
                for (const s of splits) classifyPayment(s.paymentMethod ?? '', s.paidAmount ?? 0);
            } else {
                classifyPayment(group[0].paymentMethod ?? '', totalCobrado);
            }
        }

        const nonTabOrders = orders.filter(o => !tabOrderIds.has(o.id));
        for (const o of nonTabOrders) {
            if (o.status === 'CANCELLED') { invoicesCancelled++; continue; }
            totalInvoices++;

            const amountPaid = o.amountPaid || o.total;
            const netReceived = amountPaid - (o.change || 0);
            const tip = (o.change === 0 && amountPaid > o.total) ? Math.max(0, amountPaid - o.total) : 0;

            totalDiscounts += o.discount;
            propinas += tip;
            if (tip > 0) propinaCount++;
            totalUSD += netReceived;

            const ch = getChannel(o.orderType, o.sourceChannel);
            byChannel[ch] += netReceived;
            countByChannel[ch]++;

            const mixedLines = (o as any).orderPayments as { method: string; amountUSD: number }[] | undefined;
            if (mixedLines && mixedLines.length > 0) {
                for (const p of mixedLines) classifyPayment(p.method, p.amountUSD);
            } else {
                classifyPayment(o.paymentMethod ?? '', netReceived);
            }
        }

        const pctDivisas = totalUSD > 0 ? (receivedInDivisas / totalUSD) * 100 : 0;
        const pctBs = totalUSD > 0 ? (receivedInBs / totalUSD) * 100 : 0;

        return {
            success: true,
            data: {
                date: today.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
                byChannel,
                countByChannel,
                totalUSD,
                totalDiscounts,
                totalServiceFee,
                propinas,
                propinaCount,
                receivedInDivisas,
                receivedInBs,
                pctDivisas,
                pctBs,
                totalInvoices,
                invoicesCancelled,
            },
        };
    } catch (error) {
        console.error('Error generating end-of-day summary:', error);
        return { success: false, message: 'Error generando resumen de cierre' };
    }
}
