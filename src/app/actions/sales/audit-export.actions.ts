'use server';

/**
 * Detalle de ventas para auditoría de inventario.
 *
 * Devuelve, para una fecha (Caracas TZ), el desglose plano de cada
 * SalesOrderItem cobrado + cada item anulado, con SKU / categoría /
 * costo, para cruzar contra movimientos de inventario.
 */

import prisma from '@/server/db';
import { getCaracasDayRange, getCaracasDateStamp } from '@/lib/datetime';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export interface SalesAuditItem {
    orderNumber: string;
    createdAt: string;
    orderType: string;
    orderStatus: string;
    customerName: string | null;
    cashier: string;
    sku: string;
    productName: string;
    category: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    costPerUnit: number | null;
    costTotal: number | null;
    modifiers: string;
    notes: string | null;
    voided: boolean;
    voidReason: string | null;
}

export interface SalesAuditOrder {
    orderNumber: string;
    createdAt: string;
    orderType: string;
    status: string;
    customerName: string | null;
    customerPhone: string | null;
    cashier: string;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    total: number;
    voidReason: string | null;
}

export interface SalesAuditData {
    dateStamp: string;        // "YYYY-MM-DD" Caracas
    displayDate: string;      // "DD/MM/YYYY"
    items: SalesAuditItem[];
    orders: SalesAuditOrder[];
}

function fullName(u: { firstName: string | null; lastName: string | null } | null | undefined): string {
    if (!u) return '-';
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '-';
}

export async function getSalesAuditAction(date?: string): Promise<{
    success: boolean;
    message?: string;
    data?: SalesAuditData;
}> {
    const guard = await checkActionPermission(PERM.EXPORT_SALES);
    if (!guard.ok) return { success: false, message: guard.message };

    try {
        const queryDate = date ? new Date(date + 'T12:00:00') : new Date();
        const { start, end } = getCaracasDayRange(queryDate);
        const dateStamp = getCaracasDateStamp(queryDate);

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const orders = await db.salesOrder.findMany({
            where: { createdAt: { gte: start, lte: end } },
            orderBy: { createdAt: 'asc' },
            include: {
                createdBy: { select: { firstName: true, lastName: true } },
                items: {
                    include: {
                        menuItem: {
                            select: {
                                sku: true,
                                category: { select: { name: true } },
                            },
                        },
                        modifiers: { select: { name: true } },
                    },
                },
            },
        });

        const items: SalesAuditItem[] = [];
        const ordersOut: SalesAuditOrder[] = [];

        for (const o of orders) {
            const cashier = fullName(o.createdBy);
            const isOrderCancelled = o.status === 'CANCELLED';

            ordersOut.push({
                orderNumber: o.orderNumber,
                createdAt: o.createdAt.toISOString(),
                orderType: o.orderType || '-',
                status: o.status,
                customerName: o.customerName ?? null,
                customerPhone: o.customerPhone ?? null,
                cashier,
                paymentMethod: o.paymentMethod || '-',
                subtotal: o.subtotal || 0,
                discount: o.discount || 0,
                total: o.total || 0,
                voidReason: o.voidReason ?? null,
            });

            for (const it of o.items) {
                const voided = isOrderCancelled || it.voidedAt !== null;
                items.push({
                    orderNumber: o.orderNumber,
                    createdAt: o.createdAt.toISOString(),
                    orderType: o.orderType || '-',
                    orderStatus: o.status,
                    customerName: o.customerName ?? null,
                    cashier,
                    sku: it.menuItem?.sku || '-',
                    productName: it.itemName,
                    category: it.menuItem?.category?.name || '-',
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    lineTotal: it.lineTotal,
                    costPerUnit: it.costPerUnit ?? null,
                    costTotal: it.costTotal ?? null,
                    modifiers: (it.modifiers || []).map(m => m.name).join(', '),
                    notes: it.notes ?? null,
                    voided,
                    voidReason: it.voidReason ?? o.voidReason ?? null,
                });
            }
        }

        const displayDate = new Date(dateStamp + 'T12:00:00').toLocaleDateString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        return {
            success: true,
            data: { dateStamp, displayDate, items, orders: ordersOut },
        };
    } catch (error) {
        console.error('Error en getSalesAuditAction:', error);
        return { success: false, message: 'Error generando auditoría de ventas' };
    }
}
