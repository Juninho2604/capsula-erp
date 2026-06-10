'use server';

/**
 * Reporte de platos vendidos en rango de fecha.
 *
 * Diseño:
 *   - Read-only sobre SalesOrderItem + SalesOrderItemModifier (tenant-aware).
 *   - NO depende del flujo de recetas/inventario; agrega solo lo que se vendió
 *     en el POS según los SalesOrderItem que NO fueron anulados (voidedAt=null)
 *     y que pertenecen a SalesOrder no anuladas.
 *   - Agrupa por MenuItem y produce: unidades vendidas, ingresos, precio
 *     promedio, breakdown de modifiers (cada modifier con count + ajuste $
 *     acumulado).
 *
 * Performance: una sola query con include de modifiers + menuItem.category.
 *   Para rangos grandes (> 30 días) el dataset puede pesar; mantenemos el
 *   `select` ajustado. Si en producción se vuelve lento, el siguiente paso
 *   es pre-agregar en SQL via Prisma.queryRaw.
 */

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getCaracasDayRange } from '@/lib/datetime';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';

export interface SoldItemsReportFilters {
    /** "YYYY-MM-DD" hora Caracas. */
    startDate: string;
    /** "YYYY-MM-DD" hora Caracas. */
    endDate: string;
    /** Si se pasa, filtra por SalesOrder.areaId. */
    areaId?: string;
    /** Si se pasa, filtra por SalesOrder.orderType (RESTAURANT, DELIVERY, etc.). */
    orderType?: string;
}

export interface SoldItemRow {
    menuItemId: string;
    menuItemName: string;
    categoryName: string;
    unitsSold: number;       // sum(quantity)
    revenue: number;          // sum(lineTotal) — incluye modifiers
    avgPrice: number;         // revenue / unitsSold (si > 0)
    /** Detalle de modifiers asociados a este item (agregado por nombre). */
    modifiers: SoldModifierRow[];
}

export interface SoldModifierRow {
    /** Nombre snapshot del modifier (al momento de la venta). */
    name: string;
    /** Cuántas veces se eligió este modifier en este menu item. */
    count: number;
    /** Suma de priceAdjustment * count. Útil para ver cuánto contribuyó. */
    revenueContribution: number;
}

export interface SoldItemsReport {
    rangeStart: string;       // ISO
    rangeEnd: string;
    totalOrders: number;
    totalItemsSold: number;
    totalRevenue: number;
    items: SoldItemRow[];     // ordenado por unitsSold DESC
}

export interface SoldItemsReportResult {
    success: boolean;
    message?: string;
    data?: SoldItemsReport;
}

export async function getSoldItemsReportAction(
    filters: SoldItemsReportFilters,
): Promise<SoldItemsReportResult> {
    try {
        // Gate de rol (BUG #7 del DIAGNOSTICO: antes solo exigía sesión —
        // cualquier rol podía invocarla por RPC). Mismo permiso que el
        // historial de ventas.
        const guard = await checkActionPermission(PERM.VIEW_SALES_HISTORY);
        if (!guard.ok) return { success: false, message: guard.message };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // Validar y normalizar fechas
        if (!filters.startDate || !filters.endDate) {
            return { success: false, message: 'startDate y endDate son requeridos' };
        }
        const start = getCaracasDayRange(new Date(filters.startDate + 'T12:00:00')).start;
        const end = getCaracasDayRange(new Date(filters.endDate + 'T12:00:00')).end;
        if (start > end) {
            return { success: false, message: 'startDate no puede ser posterior a endDate' };
        }

        // Filtros base: items NO anulados, dentro del rango, en órdenes NO anuladas.
        // El filtro de tenant viene del db extendido.
        const items = await db.salesOrderItem.findMany({
            where: {
                voidedAt: null,
                order: {
                    voidedAt: null,
                    createdAt: { gte: start, lte: end },
                    ...(filters.areaId ? { areaId: filters.areaId } : {}),
                    ...(filters.orderType ? { orderType: filters.orderType } : {}),
                },
            },
            select: {
                menuItemId: true,
                itemName: true,
                quantity: true,
                lineTotal: true,
                orderId: true,
                menuItem: {
                    select: {
                        name: true,
                        category: { select: { name: true } },
                    },
                },
                modifiers: {
                    select: { name: true, priceAdjustment: true },
                },
            },
        });

        // Agregar en JS — más simple y suficientemente rápido para datasets
        // del tamaño de un mes de un restaurante.
        const byMenuItem = new Map<string, SoldItemRow>();
        const orderIds = new Set<string>();

        for (const it of items) {
            orderIds.add(it.orderId);
            // Snapshot tolerante: usa itemName si menuItem fue borrado.
            const name = it.menuItem?.name ?? it.itemName ?? 'Item desconocido';
            const categoryName = it.menuItem?.category?.name ?? 'Sin categoría';

            let row = byMenuItem.get(it.menuItemId);
            if (!row) {
                row = {
                    menuItemId: it.menuItemId,
                    menuItemName: name,
                    categoryName,
                    unitsSold: 0,
                    revenue: 0,
                    avgPrice: 0,
                    modifiers: [],
                };
                byMenuItem.set(it.menuItemId, row);
            }

            const qty = it.quantity || 0;
            row.unitsSold += qty;
            row.revenue += Number(it.lineTotal) || 0;

            // Agrupar modifiers POR FILA de item — cada selección de modifier
            // representa una elección del cliente. count++ por aparición.
            for (const m of it.modifiers) {
                const existing = row.modifiers.find((x) => x.name === m.name);
                if (existing) {
                    existing.count += 1;
                    existing.revenueContribution += Number(m.priceAdjustment) || 0;
                } else {
                    row.modifiers.push({
                        name: m.name,
                        count: 1,
                        revenueContribution: Number(m.priceAdjustment) || 0,
                    });
                }
            }
        }

        // Promedios y orden
        const rows = Array.from(byMenuItem.values()).map((r) => ({
            ...r,
            avgPrice: r.unitsSold > 0 ? r.revenue / r.unitsSold : 0,
            modifiers: r.modifiers.sort((a, b) => b.count - a.count),
        }));
        rows.sort((a, b) => b.unitsSold - a.unitsSold);

        const totalItemsSold = rows.reduce((s, r) => s + r.unitsSold, 0);
        const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

        return {
            success: true,
            data: {
                rangeStart: start.toISOString(),
                rangeEnd: end.toISOString(),
                totalOrders: orderIds.size,
                totalItemsSold,
                totalRevenue,
                items: rows,
            },
        };
    } catch (err) {
        console.error('[getSoldItemsReportAction]', err);
        return {
            success: false,
            message: `Error generando reporte: ${err instanceof Error ? err.message : 'desconocido'}`,
        };
    }
}
