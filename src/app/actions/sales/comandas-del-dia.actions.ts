'use server';

/**
 * Server action para listar las órdenes del día actual (zona Caracas) y
 * permitir reimprimir su comanda de cocina/barra. Diseñado específicamente
 * para el flujo de "Reimprimir Comanda" desde el POS (modal accesible para
 * usuarios con permiso REPRINT_COMANDA, incluyendo CASHIER).
 *
 * Diferencias con `getSalesHistoryAction` (history.actions.ts):
 *   - Solo devuelve órdenes del día (no acepta fecha arbitraria)
 *   - Solo devuelve los campos necesarios para reconstruir la comanda
 *     (items, modifiers, categoría, customer, etc.) — no incluye pagos
 *     ni breakdown contable
 *   - No expande sub-cuentas: cada SalesOrder es una fila. La comanda
 *     siempre se imprime a nivel orden (no sub-cuenta) porque eso es lo
 *     que la cocina ve cuando se envía la orden originalmente
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
    scheduledDeliveryTime: string | null; // ISO
    openTabId: string | null;
    tabCode: string | null;
    tabCustomerLabel: string | null;
    paymentMethod: string | null;
    total: number;
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
                scheduledDeliveryTime: true,
                openTabId: true,
                paymentMethod: true,
                total: true,
                createdAt: true,
                openTab: {
                    select: { tabCode: true, customerLabel: true },
                },
                items: {
                    select: {
                        itemName: true,
                        quantity: true,
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

        // Aplanar la respuesta a un formato más conveniente para el cliente.
        // Convertir Dates a ISO strings para que sean serializables sin sorpresas.
        const result: ComandaOrder[] = orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            orderType: o.orderType,
            sourceChannel: o.sourceChannel,
            customerName: o.customerName,
            customerAddress: o.customerAddress,
            scheduledDeliveryTime: o.scheduledDeliveryTime
                ? o.scheduledDeliveryTime.toISOString()
                : null,
            openTabId: o.openTabId,
            tabCode: o.openTab?.tabCode ?? null,
            tabCustomerLabel: o.openTab?.customerLabel ?? null,
            paymentMethod: o.paymentMethod,
            total: o.total,
            createdAt: o.createdAt.toISOString(),
            items: o.items.map((i) => ({
                itemName: i.itemName,
                quantity: i.quantity,
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
