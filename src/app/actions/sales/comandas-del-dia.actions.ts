'use server';

/**
 * Server action para listar las órdenes del día actual (zona Caracas) y
 * permitir reimprimir tanto su comanda de cocina/barra como el recibo
 * de pago del cliente. Diseñado específicamente para el flujo de
 * "Reimpresión" desde el POS (modal accesible para usuarios con permiso
 * REPRINT_COMANDA, incluyendo CASHIER).
 *
 * Diferencias con `getSalesHistoryAction` (history.actions.ts):
 *   - Solo devuelve órdenes del día (no acepta fecha arbitraria)
 *   - No expande sub-cuentas: cada SalesOrder es una fila. La comanda
 *     y el recibo se reimprimen a nivel orden (no sub-cuenta) porque
 *     eso es lo que la cocina y el cliente reciben cuando se envía
 *     o cobra la orden originalmente
 *   - Usa permiso REPRINT_COMANDA en vez de EXPORT_SALES, así CASHIER
 *     puede ejecutarlo sin tener acceso al Historial de Ventas completo
 *
 * Filtros aplicados (read-only, sin efectos secundarios):
 *   - Día actual en zona Caracas (UTC-4)
 *   - Excluye órdenes CANCELLED (anuladas)
 *   - Excluye propinas colectivas (PROPINA COLECTIVA — no son ventas
 *     reales y no tienen items que reimprimir)
 *   - Filtrado por tenant del usuario (withTenant)
 */

import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getCaracasDayRange } from '@/lib/datetime';

export interface ComandaItem {
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes: string | null;
    categoryName: string | null;
    modifiers: { name: string }[];
}

export interface ComandaOrder {
    id: string;
    orderNumber: string;
    orderType: string;
    sourceChannel: string | null;
    customerName: string | null;
    customerAddress: string | null;
    customerPhone: string | null;
    scheduledDeliveryTime: string | null; // ISO
    openTabId: string | null;
    tabCode: string | null;
    tabCustomerLabel: string | null;
    paymentMethod: string | null;
    /** Subtotal post-discount sin servicio. Equivale a runningTotal para tabs. */
    subtotal: number;
    discount: number;
    discountReason: string | null;
    discountType: string | null;
    /** Service charge 10% acumulado a nivel tab. 0 si la orden no es mesa o no tuvo servicio. */
    serviceCharge: number;
    amountPaid: number;
    change: number;
    total: number;
    exchangeRateValue: number | null;
    totalBs: number | null;
    cashierName: string;
    createdAt: string; // ISO
    items: ComandaItem[];
}

export interface ComandasResult {
    success: boolean;
    message?: string;
    orders: ComandaOrder[];
}

export async function getComandasDelDiaAction(): Promise<ComandasResult> {
    const guard = await checkActionPermission(PERM.REPRINT_COMANDA);
    if (!guard.ok) return { success: false, message: guard.message, orders: [] };

    try {
        const { start, end } = getCaracasDayRange();
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const orders = await db.salesOrder.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                status: { not: 'CANCELLED' },
                customerName: { not: 'PROPINA COLECTIVA' },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                orderNumber: true,
                orderType: true,
                sourceChannel: true,
                customerName: true,
                customerAddress: true,
                customerPhone: true,
                scheduledDeliveryTime: true,
                openTabId: true,
                paymentMethod: true,
                subtotal: true,
                discount: true,
                discountReason: true,
                discountType: true,
                amountPaid: true,
                change: true,
                total: true,
                exchangeRateValue: true,
                totalBs: true,
                createdAt: true,
                createdBy: {
                    select: { firstName: true, lastName: true },
                },
                openTab: {
                    select: {
                        tabCode: true,
                        customerLabel: true,
                        totalServiceCharge: true,
                    },
                },
                items: {
                    select: {
                        itemName: true,
                        quantity: true,
                        unitPrice: true,
                        lineTotal: true,
                        notes: true,
                        menuItem: {
                            select: {
                                category: { select: { name: true } },
                            },
                        },
                        modifiers: { select: { name: true } },
                    },
                },
            },
        });

        // Aplanar la respuesta. Convertir Dates a ISO strings para serialización.
        const result: ComandaOrder[] = orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            orderType: o.orderType,
            sourceChannel: o.sourceChannel,
            customerName: o.customerName,
            customerAddress: o.customerAddress,
            customerPhone: o.customerPhone,
            scheduledDeliveryTime: o.scheduledDeliveryTime
                ? o.scheduledDeliveryTime.toISOString()
                : null,
            openTabId: o.openTabId,
            tabCode: o.openTab?.tabCode ?? null,
            tabCustomerLabel: o.openTab?.customerLabel ?? null,
            paymentMethod: o.paymentMethod,
            subtotal: o.subtotal,
            discount: o.discount,
            discountReason: o.discountReason,
            discountType: o.discountType,
            // Service charge solo aplica a mesas con tab y service > 0.
            // Para no-tab orders (pickup, delivery, pedidosya) queda en 0.
            serviceCharge: o.openTab?.totalServiceCharge ?? 0,
            amountPaid: o.amountPaid,
            change: o.change,
            total: o.total,
            exchangeRateValue: o.exchangeRateValue,
            totalBs: o.totalBs,
            cashierName: `${o.createdBy?.firstName ?? 'Cajera'} ${o.createdBy?.lastName ?? ''}`.trim(),
            createdAt: o.createdAt.toISOString(),
            items: o.items.map((i) => ({
                itemName: i.itemName,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                lineTotal: i.lineTotal,
                notes: i.notes ?? null,
                categoryName: i.menuItem?.category?.name ?? null,
                modifiers: i.modifiers.map((m) => ({ name: m.name })),
            })),
        }));

        return { success: true, orders: result };
    } catch (err) {
        console.error('[getComandasDelDiaAction]', err);
        return {
            success: false,
            message: 'Error obteniendo órdenes del día',
            orders: [],
        };
    }
}
