/**
 * Helpers para el reporte de inventario completo (§51.C).
 *
 * Agrupa por categoría y calcula totales — función pura, testeable sin
 * Prisma. Tanto la tabla preview como el export Excel consumen el mismo
 * output.
 */

export interface InventoryReportRowLike {
    sku: string;
    name: string;
    category: string;
    baseUnit: string;
    totalStock: number;
    stockByArea: Record<string, number>;
    costPerUnit: number;
    totalValue: number;
}

export interface CategoryGroup<R extends InventoryReportRowLike = InventoryReportRowLike> {
    category: string;
    rows: R[];
    totalStock: number;       // suma de totalStock de items de esta categoría
    totalValue: number;       // suma de totalValue de items de esta categoría
    itemCount: number;
}

export interface InventoryReportGrouped<R extends InventoryReportRowLike = InventoryReportRowLike> {
    groups: CategoryGroup<R>[];
    grandTotalStock: number;
    grandTotalValue: number;
    itemCount: number;
    categoryCount: number;
}

/**
 * Agrupa las filas por categoría y calcula totales acumulados por grupo +
 * grand total general. Las filas dentro de cada grupo conservan el orden
 * recibido (typically alfabético por nombre).
 */
export function groupInventoryByCategory<R extends InventoryReportRowLike>(
    rows: R[],
): InventoryReportGrouped<R> {
    const byCategory = new Map<string, R[]>();
    for (const r of rows) {
        const cat = r.category || 'Sin categoría';
        const arr = byCategory.get(cat) ?? [];
        arr.push(r);
        byCategory.set(cat, arr);
    }

    const groups: CategoryGroup<R>[] = Array.from(byCategory.keys())
        .sort()
        .map(category => {
            const groupRows = byCategory.get(category)!;
            let totalStock = 0;
            let totalValue = 0;
            for (const r of groupRows) {
                totalStock += Number.isFinite(r.totalStock) ? r.totalStock : 0;
                totalValue += Number.isFinite(r.totalValue) ? r.totalValue : 0;
            }
            return {
                category,
                rows: groupRows,
                totalStock,
                totalValue,
                itemCount: groupRows.length,
            };
        });

    let grandTotalStock = 0;
    let grandTotalValue = 0;
    for (const g of groups) {
        grandTotalStock += g.totalStock;
        grandTotalValue += g.totalValue;
    }

    return {
        groups,
        grandTotalStock,
        grandTotalValue,
        itemCount: rows.length,
        categoryCount: groups.length,
    };
}

/** Filtra por búsqueda en SKU + nombre + categoría (case-insensitive, normalizado). */
export function filterInventoryRows<R extends InventoryReportRowLike>(
    rows: R[],
    query: string,
): R[] {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
        const text = `${r.sku} ${r.name} ${r.category}`.toLowerCase();
        return text.includes(q);
    });
}
