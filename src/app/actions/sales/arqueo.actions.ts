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

const emptyBreakdown = () => ({
    cashUsd: 0, cashEur: 0, cashBs: 0, zelle: 0,
    cardPdVShanklish: 0, cardPdVSuperferro: 0, mobileShanklish: 0, mobileNour: 0,
});

function addToBreakdown(
    breakdown: ReturnType<typeof emptyBreakdown>,
    pm: string | null | undefined,
    amt: number,
) {
    const k = (pm || '').toUpperCase();
    if      (k === 'CASH' || k === 'CASH_USD')                                    breakdown.cashUsd          += amt;
    else if (k === 'CASH_EUR')                                                     breakdown.cashEur          += amt;
    else if (k === 'CASH_BS')                                                      breakdown.cashBs           += amt;
    else if (k === 'ZELLE')                                                        breakdown.zelle            += amt;
    else if (k === 'CARD' || k === 'BS_POS' || k === 'PDV_SHANKLISH')             breakdown.cardPdVShanklish += amt;
    else if (k === 'PDV_SUPERFERRO' || k === 'TRANSFER' || k === 'BANK_TRANSFER') breakdown.cardPdVSuperferro += amt;
    else if (k === 'MOBILE_PAY' || k === 'PAGO_MOVIL' || k === 'MOVIL_NG')        breakdown.mobileShanklish  += amt;
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
                        paymentSplits: {
                            select: {
                                id: true,
                                subAccountId: true,
                                paymentMethod: true,
                                paidAmount: true,
                                serviceChargeAmount: true,
                                splitLabel: true,
                            },
                        },
                        subAccounts: {
                            select: {
                                id: true,
                                label: true,
                                subtotal: true,
                                serviceCharge: true,
                                total: true,
                                status: true,
                                paidAmount: true,
                                paymentMethod: true,
                                sortOrder: true,
                            },
                            orderBy: { sortOrder: 'asc' },
                        },
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
                const tableName = tab?.tableOrStation?.name || 'MESA';
                const customerName = tab?.customerLabel || '';
                const tabCorrelativo = tab?.tabCode || group[0].orderNumber || '';
                const allSplits = tab?.paymentSplits ?? [];
                const subAccounts = tab?.subAccounts ?? [];

                if (subAccounts.length > 0) {
                    // ── Expand: one ArqueoSaleRow per sub-account ─────────────────
                    for (const sub of subAccounts) {
                        if (sub.status !== 'PAID') continue; // skip unpaid
                        const subSplits = allSplits.filter(sp => sp.subAccountId === sub.id);
                        const breakdown = emptyBreakdown();
                        if (subSplits.length > 0) {
                            for (const s of subSplits) addToBreakdown(breakdown, s.paymentMethod, s.paidAmount || 0);
                        } else if (sub.paymentMethod) {
                            addToBreakdown(breakdown, sub.paymentMethod, sub.paidAmount || sub.total);
                        }
                        result.push({
                            orderType: 'RESTAURANT',
                            description: `${tableName} ${customerName} — ${sub.label}`.trim(),
                            correlativo: `${tabCorrelativo}/${sub.label}`,
                            total: sub.paidAmount || sub.total,
                            paymentBreakdown: breakdown,
                            serviceFee: sub.serviceCharge,
                        });
                    }

                    // Pool splits (not linked to any sub-account)
                    const poolSplits = allSplits.filter(sp => !sp.subAccountId);
                    if (poolSplits.length > 0) {
                        const poolTotal = poolSplits.reduce((s, sp) => s + (sp.paidAmount || 0), 0);
                        const poolSvc   = poolSplits.reduce((s, sp) => s + (sp.serviceChargeAmount || 0), 0);
                        const breakdown = emptyBreakdown();
                        for (const s of poolSplits) addToBreakdown(breakdown, s.paymentMethod, s.paidAmount || 0);
                        result.push({
                            orderType: 'RESTAURANT',
                            description: `${tableName} ${customerName} — Otros`.trim(),
                            correlativo: `${tabCorrelativo}/Otros`,
                            total: poolTotal,
                            paymentBreakdown: breakdown,
                            serviceFee: poolSvc,
                        });
                    }
                } else {
                    // ── No sub-accounts: one consolidated row per tab ─────────────
                    const total = tab?.runningTotal ?? group.reduce((s, x) => s + x.total, 0);
                    const serviceFee = tab?.totalServiceCharge ?? 0;
                    const totalFactura = total + serviceFee;
                    const totalCobrado = allSplits.length > 0
                        ? allSplits.reduce((s, sp) => s + (sp.paidAmount || 0), 0)
                        : totalFactura;

                    const breakdown = emptyBreakdown();
                    if (allSplits.length > 0) {
                        for (const s of allSplits) addToBreakdown(breakdown, s.paymentMethod, s.paidAmount || 0);
                    } else {
                        addToBreakdown(breakdown, group[0].paymentMethod, total);
                    }

                    result.push({
                        orderType: 'RESTAURANT',
                        description: `${tableName} ${customerName}`.trim() || tableName,
                        correlativo: tabCorrelativo,
                        total: totalCobrado,
                        paymentBreakdown: breakdown,
                        serviceFee,
                    });
                }
            } else if (o.orderType !== 'RESTAURANT' || !o.openTabId) {
                const breakdown = emptyBreakdown();
                const mixedLines = (o as any).orderPayments as { method: string; amountUSD: number }[] | undefined;
                if (mixedLines && mixedLines.length > 0) {
                    for (const p of mixedLines) addToBreakdown(breakdown, p.method, p.amountUSD);
                } else {
                    addToBreakdown(breakdown, o.paymentMethod, o.total);
                }

                const ot = (o.orderType || '').toUpperCase();
                const sc = (o.sourceChannel || '').toUpperCase();
                const isPedidosYa = ot === 'PEDIDOSYA' || sc === 'POS_PEDIDOSYA';
                const isDelivery = ot === 'DELIVERY';
                const typeLabel = isPedidosYa ? 'PedidosYA' : isDelivery ? 'Delivery' : 'Pickup';

                result.push({
                    orderType: isPedidosYa ? 'PEDIDOSYA' : isDelivery ? 'DELIVERY' : 'PICKUP',
                    description: `${typeLabel}: ${o.customerName || 'Cliente'}`,
                    correlativo: o.orderNumber || '',
                    total: o.total,
                    paymentBreakdown: breakdown,
                    serviceFee: 0,
                });
            }
        }

        return { success: true, data: result };
    } catch (error) {
        console.error('Error fetching sales for arqueo:', error);
        return { success: false, message: 'Error cargando ventas para arqueo' };
    }
}
