'use server';

import prisma from '@/server/db';
import { getCaracasDayRange } from '@/lib/datetime';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';

export interface ArqueoSaleRow {
    orderType: 'RESTAURANT' | 'PICKUP' | 'DELIVERY' | 'PEDIDOSYA';
    description: string;
    correlativo: string;
    total: number;
    paymentBreakdown: {
        cashUsd: number;
        cashEur: number;
        cashBs: number;
        zelle: number;
        cardPdVShanklish: number;
        cardPdVSuperferro: number;
        mobileShanklish: number;
        mobileNour: number;
    };
    serviceFee: number;
}

export async function getSalesForArqueoAction(date: Date): Promise<{ success: boolean; data?: ArqueoSaleRow[]; message?: string }> {
    const guard = await checkActionPermission(PERM.EXPORT_SALES);
    if (!guard.ok) return { success: false, message: guard.message };

    try {
        const { start: startOfDay, end: endOfDay } = getCaracasDayRange(date);

        const orders = await prisma.salesOrder.findMany({
            where: {
                createdAt: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            },
            orderBy: { createdAt: 'asc' },
            include: {
                orderPayments: { select: { method: true, amountUSD: true } },
                openTab: {
                    select: {
                        tabCode: true,
                        customerLabel: true,
                        runningTotal: true,
                        totalServiceCharge: true,
                        tableOrStation: { select: { name: true } },
                        paymentSplits: { select: { paymentMethod: true, paidAmount: true, splitLabel: true } }
                    }
                }
            }
        });

        const byTab = new Map<string, typeof orders>();
        for (const o of orders) {
            if (o.orderType === 'RESTAURANT' && o.openTabId) {
                const existing = byTab.get(o.openTabId) || [];
                existing.push(o);
                byTab.set(o.openTabId, existing);
            }
        }

        const result: ArqueoSaleRow[] = [];
        const seenTabs = new Set<string>();

        for (const o of orders) {
            if (o.orderType === 'RESTAURANT' && o.openTabId && !seenTabs.has(o.openTabId)) {
                seenTabs.add(o.openTabId);
                const group = byTab.get(o.openTabId) || [o];
                const tab = group[0].openTab;
                const total = tab?.runningTotal ?? group.reduce((s, x) => s + x.total, 0);
                const tableName = tab?.tableOrStation?.name || 'MESA';
                const customerName = tab?.customerLabel || '';
                const description = `${tableName} ${customerName}`.trim() || tableName;

                const breakdown = { cashUsd: 0, cashEur: 0, cashBs: 0, zelle: 0, cardPdVShanklish: 0, cardPdVSuperferro: 0, mobileShanklish: 0, mobileNour: 0 };
                const splits = tab?.paymentSplits || [];
                const serviceFee = tab?.totalServiceCharge ?? 0;
                const totalFactura = total + serviceFee;
                const totalCobrado = splits.length > 0
                    ? splits.reduce((s: number, sp: { paidAmount?: number }) => s + (sp.paidAmount || 0), 0)
                    : totalFactura;

                if (splits.length > 0) {
                    for (const s of splits) {
                        const pm = (s.paymentMethod || '').toUpperCase();
                        const amt = s.paidAmount || 0;
                        if (pm === 'CASH' || pm === 'CASH_USD') breakdown.cashUsd += amt;
                        else if (pm === 'CASH_EUR') breakdown.cashEur += amt;
                        else if (pm === 'CASH_BS') breakdown.cashBs += amt;
                        else if (pm === 'ZELLE') breakdown.zelle += amt;
                        else if (pm === 'CARD' || pm === 'BS_POS' || pm === 'PDV_SHANKLISH') breakdown.cardPdVShanklish += amt;
                        else if (pm === 'PDV_SUPERFERRO' || pm === 'TRANSFER') breakdown.cardPdVSuperferro += amt;
                        else if (pm === 'MOBILE_PAY' || pm === 'PAGO_MOVIL' || pm === 'MOVIL_NG') breakdown.mobileShanklish += amt;
                    }
                } else {
                    const pm = (group[0].paymentMethod || '').toUpperCase();
                    if (pm === 'CASH' || pm === 'CASH_USD') breakdown.cashUsd = total;
                    else if (pm === 'CASH_EUR') breakdown.cashEur = total;
                    else if (pm === 'CASH_BS') breakdown.cashBs = total;
                    else if (pm === 'ZELLE') breakdown.zelle = total;
                    else if (pm === 'CARD' || pm === 'BS_POS' || pm === 'PDV_SHANKLISH') breakdown.cardPdVShanklish = total;
                    else if (pm === 'PDV_SUPERFERRO' || pm === 'TRANSFER') breakdown.cardPdVSuperferro = total;
                    else if (pm === 'MOBILE_PAY' || pm === 'PAGO_MOVIL' || pm === 'MOVIL_NG') breakdown.mobileShanklish = total;
                }

                result.push({
                    orderType: 'RESTAURANT',
                    description,
                    correlativo: tab?.tabCode || group[0].orderNumber || '',
                    total: totalCobrado,
                    paymentBreakdown: breakdown,
                    serviceFee
                });
            } else if (o.orderType !== 'RESTAURANT' || !o.openTabId) {
                const breakdown = { cashUsd: 0, cashEur: 0, cashBs: 0, zelle: 0, cardPdVShanklish: 0, cardPdVSuperferro: 0, mobileShanklish: 0, mobileNour: 0 };
                const addLine = (pm: string, amt: number) => {
                    const k = (pm || '').toUpperCase();
                    if (k === 'CASH' || k === 'CASH_USD') breakdown.cashUsd += amt;
                    else if (k === 'CASH_EUR') breakdown.cashEur += amt;
                    else if (k === 'CASH_BS') breakdown.cashBs += amt;
                    else if (k === 'ZELLE') breakdown.zelle += amt;
                    else if (k === 'CARD' || k === 'BS_POS' || k === 'PDV_SHANKLISH') breakdown.cardPdVShanklish += amt;
                    else if (k === 'PDV_SUPERFERRO' || k === 'TRANSFER' || k === 'BANK_TRANSFER') breakdown.cardPdVSuperferro += amt;
                    else if (k === 'MOBILE_PAY' || k === 'PAGO_MOVIL' || k === 'MOVIL_NG') breakdown.mobileShanklish += amt;
                };
                const mixedLines = (o as any).orderPayments as { method: string; amountUSD: number }[] | undefined;
                if (mixedLines && mixedLines.length > 0) {
                    for (const p of mixedLines) addLine(p.method, p.amountUSD);
                } else {
                    addLine(o.paymentMethod || '', o.total);
                }

                const ot = (o.orderType || '').toUpperCase();
                const sc = (o.sourceChannel || '').toUpperCase();
                const isPedidosYa = ot === 'PEDIDOSYA' || sc === 'POS_PEDIDOSYA';
                const isDelivery = ot === 'DELIVERY';
                const typeLabel = isPedidosYa ? 'PedidosYA' : isDelivery ? 'Delivery' : 'Pickup';
                const description = `${typeLabel}: ${o.customerName || 'Cliente'}`;

                result.push({
                    orderType: isPedidosYa ? 'PEDIDOSYA' : isDelivery ? 'DELIVERY' : 'PICKUP',
                    description,
                    correlativo: o.orderNumber || '',
                    total: o.total,
                    paymentBreakdown: breakdown,
                    serviceFee: 0
                });
            }
        }

        return { success: true, data: result };
    } catch (error) {
        console.error('Error fetching sales for arqueo:', error);
        return { success: false, message: 'Error cargando ventas para arqueo' };
    }
}
