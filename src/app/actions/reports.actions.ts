'use server';

/**
 * Módulo Reportes — §51.C
 *
 * Actions cross-módulo para los reportes exportables a Excel. Cada función
 * pura del cálculo vive en `src/lib/reports/` para que sean testeables sin
 * Prisma. Las server actions de aquí son thin wrappers que cargan datos del
 * tenant y delegan a la función pura.
 *
 * Reportes incluidos en este lote:
 *   - Inventario completo (todos los SKU con stock por área, agrupados por
 *     categoría). Disponible siempre, no requiere conteos previos.
 *
 * Reportes futuros (siguientes PRs):
 *   - Variación semana vs semana (consume WeeklyCount — §51.A)
 *   - Movimientos por rango (consume InventoryMovement)
 *   - Ventas + costos + margen por período
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

const REPORTS_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];

// ============================================================================
// REPORTE: INVENTARIO COMPLETO
// ============================================================================

export type InventoryReportRow = {
    sku: string;
    name: string;
    category: string;
    baseUnit: string;
    /** Stock total agregando todas las áreas activas. */
    totalStock: number;
    /** Stock por área individual: areaId → currentStock. */
    stockByArea: Record<string, number>;
    /** Costo unitario actual (último CostHistory vigente). 0 si no hay costo. */
    costPerUnit: number;
    /** Valor de inventario: totalStock × costPerUnit. Calculado por conveniencia. */
    totalValue: number;
};

export type InventoryReportResult = {
    success: boolean;
    message?: string;
    rows?: InventoryReportRow[];
    areas?: Array<{ id: string; name: string }>;
    generatedAt?: Date;
};

/**
 * Genera el reporte de inventario completo: todos los SKU activos con su
 * stock por área, categoría y costo. La salida la consume tanto la UI
 * (tabla preview en /reportes/inventario-completo) como el botón de
 * exportar a Excel (cliente con XLSX).
 */
export async function getInventoryReportAction(): Promise<InventoryReportResult> {
    const session = await getSession();
    if (!session?.id || !REPORTS_ROLES.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    const [items, areas] = await Promise.all([
        db.inventoryItem.findMany({
            where: { isActive: true, deletedAt: null },
            select: {
                id: true,
                sku: true,
                name: true,
                category: true,
                baseUnit: true,
                costHistory: {
                    where: { effectiveTo: null },
                    select: { costPerUnit: true },
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                },
            },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        }),
        db.area.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    const itemIds = items.map(i => i.id);
    const areaIds = areas.map(a => a.id);

    // InventoryLocation no es tenant-aware; scope por itemIds que sí lo son.
    const locations = itemIds.length > 0 && areaIds.length > 0
        ? await prisma.inventoryLocation.findMany({
            where: {
                inventoryItemId: { in: itemIds },
                areaId: { in: areaIds },
            },
            select: { inventoryItemId: true, areaId: true, currentStock: true },
        })
        : [];

    const stockByItem = new Map<string, Map<string, number>>();
    for (const loc of locations) {
        let byArea = stockByItem.get(loc.inventoryItemId);
        if (!byArea) {
            byArea = new Map();
            stockByItem.set(loc.inventoryItemId, byArea);
        }
        byArea.set(loc.areaId, Number(loc.currentStock));
    }

    const rows: InventoryReportRow[] = items.map(it => {
        const byArea = stockByItem.get(it.id) ?? new Map<string, number>();
        const stockByArea: Record<string, number> = {};
        let totalStock = 0;
        for (const a of areas) {
            const s = byArea.get(a.id) ?? 0;
            stockByArea[a.id] = s;
            totalStock += s;
        }
        const costPerUnit = it.costHistory[0]?.costPerUnit ?? 0;
        return {
            sku: it.sku,
            name: it.name,
            category: it.category || 'Sin categoría',
            baseUnit: it.baseUnit,
            totalStock,
            stockByArea,
            costPerUnit,
            totalValue: totalStock * costPerUnit,
        };
    });

    return {
        success: true,
        rows,
        areas,
        generatedAt: new Date(),
    };
}
