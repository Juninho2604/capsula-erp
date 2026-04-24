'use server';

import prisma from '@/server/db';
import { getCaracasDayRange } from '@/lib/datetime';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';

export interface SalesFilter {
    startDate?: Date;
    endDate?: Date;
    orderType?: string;
}

/**
 * Historial de ventas.
 * @param date  Fecha en formato "YYYY-MM-DD" (timezone Caracas). Si se omite, usa hoy.
 */
export async function getSalesHistoryAction(date?: string) {
    const guard = await checkActionPermission(PERM.EXPORT_SALES);
    if (!guard.ok) return { success: false, message: guard.message, orders: [] };

    try {
        const queryDate = date ? new Date(date + 'T12:00:00') : new Date();
        const { start: startOfDay, end: endOfDay } = getCaracasDayRange(queryDate);

        const orders = await prisma.salesOrder.findMany({
            where: { createdAt: { gte: startOfDay, lte: endOfDay } },
            orderBy: { createdAt: 'desc' },
            include: {
                authorizedBy: { select: { firstName: true, lastName: true } },
                createdBy: { select: { firstName: true, lastName: true } },
                voidedBy: { select: { firstName: true, lastName: true } },
                openTab: { select: { tabCode: true, customerLabel: true, customerPhone: true, runningSubtotal: true, runningDiscount: true, runningTotal: true, totalServiceCharge: true, paymentSplits: { select: { splitLabel: true, paymentMethod: true, paidAmount: true } } } },
                orderPayments: { select: { method: true, amountUSD: true, amountBS: true, exchangeRate: true } },
                items: {
                    include: {
                        modifiers: { select: { name: true, priceAdjustment: true } }
                    }
                }
            }
        });

        const byTab = new Map<string | null, typeof orders>();
        for (const o of orders) {
            const key = o.orderType === 'RESTAURANT' && o.openTabId ? o.openTabId : null;
            if (key === null) {
                byTab.set(`single-${o.id}`, [o]);
            } else {
                const existing = byTab.get(key) || [];
                existing.push(o);
                byTab.set(key, existing);
            }
        }

        const result: any[] = [];
        const seenTabs = new Set<string>();
        for (const o of orders) {
            if (o.orderType === 'RESTAURANT' && o.openTabId && !seenTabs.has(o.openTabId)) {
                seenTabs.add(o.openTabId);
                const group = byTab.get(o.openTabId) || [o];
                const sorted = [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const first = sorted[0];
                const last = sorted[sorted.length - 1];
                const tab = first.openTab;
                const total = tab?.runningTotal ?? sorted.reduce((s, x) => s + x.total, 0);
                const subtotal = tab?.runningSubtotal ?? sorted.reduce((s, x) => s + x.subtotal, 0);
                const discount = tab?.runningDiscount ?? sorted.reduce((s, x) => s + x.discount, 0);
                const allItems = sorted.flatMap(x => (x.items || []).map((it: any) => ({
                    ...it,
                    itemName: it.itemName,
                    lineTotal: it.lineTotal,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    modifiers: (it.modifiers || []).map((m: any) => m.name)
                })));
                const splits = tab?.paymentSplits || [];
                const servicioAmount = tab?.totalServiceCharge ?? 0;
                const serviceFeeIncluded = servicioAmount > 0;
                const totalFactura = total + servicioAmount;
                const totalCobrado = splits.reduce((s: number, sp: { paidAmount?: number }) => s + (sp.paidAmount || 0), 0) || totalFactura;
                const propina = Math.max(0, totalCobrado - totalFactura);
                const paymentBreakdown = splits.map((sp: { paymentMethod?: string | null; paidAmount?: number }) => ({
                    method: sp.paymentMethod || 'CASH',
                    amount: sp.paidAmount || 0
                }));
                if (paymentBreakdown.length === 0 && totalFactura > 0) {
                    paymentBreakdown.push({ method: first.paymentMethod || 'CASH', amount: totalCobrado });
                }
                result.push({
                    id: `tab-${o.openTabId}`,
                    _consolidated: true,
                    orderType: 'RESTAURANT',
                    serviceFeeIncluded,
                    totalFactura,
                    totalCobrado,
                    totalProductos: total,
                    servicioAmount,
                    propina,
                    paymentBreakdown,
                    _orderIds: sorted.map(x => x.id),
                    orderNumber: tab?.tabCode || first.orderNumber,
                    orderNumbers: sorted.map(x => x.orderNumber),
                    createdAt: last.createdAt,
                    customerName: tab?.customerLabel || first.customerName,
                    customerPhone: tab?.customerPhone || first.customerPhone,
                    createdBy: last.createdBy,
                    paymentMethod: first.paymentMethod,
                    subtotal,
                    discount,
                    total,
                    items: allItems,
                    orders: sorted,
                    status: sorted.some(x => x.status === 'CANCELLED') ? 'CANCELLED' : first.status,
                    voidReason: sorted.find(x => x.voidReason)?.voidReason,
                    voidedAt: sorted.find(x => x.voidedAt)?.voidedAt,
                    voidedBy: sorted.find(x => x.voidedBy)?.voidedBy,
                });
            } else if (!o.openTabId || o.orderType !== 'RESTAURANT') {
                const ordTotal = o.total || 0;
                const amountPaid = o.amountPaid || ordTotal;
                const change = o.change || 0;
                const netReceived = amountPaid - change;
                const propina = Math.max(0, netReceived - ordTotal);
                const mixedLines = o.orderPayments || [];
                const paymentBreakdown = mixedLines.length > 0
                    ? mixedLines.map(p => ({ method: p.method, amount: p.amountUSD, amountBS: p.amountBS ?? undefined, exchangeRate: p.exchangeRate ?? undefined }))
                    : [{ method: o.paymentMethod || 'CASH', amount: netReceived }];
                result.push({
                    ...o,
                    _consolidated: false,
                    totalFactura: ordTotal,
                    totalCobrado: netReceived,
                    totalProductos: ordTotal,
                    servicioAmount: 0,
                    propina,
                    paymentBreakdown,
                });
            }
        }
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return { success: true, data: result };
    } catch (error) {
        console.error('Error fetching sales:', error);
        return { success: false, message: 'Error cargando historial' };
    }
}
