/**
 * Helpers para el reporte de variación semana vs semana (§51.B).
 *
 * Toma el resultado crudo de `compareWeeklyCountsAction` y genera:
 *   - Métricas agregadas (items con caída, subida, sin cambio, totales)
 *   - Agrupación por categoría con subtotales
 *   - Top N caídas y top N subidas
 *
 * Función pura, testeable sin Prisma — consumida por la UI Y el export
 * Excel para garantizar consistencia.
 */

export interface ComparisonRowLike {
    inventoryItemId: string;
    sku: string;
    name: string;
    category: string | null;
    baseUnit: string;
    previousQty: number | null;
    currentQty: number | null;
    delta: number | null;
}

export interface ComparisonMetrics {
    totalItems: number;
    /** Items que bajaron de cantidad (posible merma) */
    itemsDecreased: number;
    /** Items que subieron de cantidad (posible entrada no registrada o doble registro) */
    itemsIncreased: number;
    /** Items sin cambio (delta = 0) */
    itemsUnchanged: number;
    /** Items que solo estaban en el conteo previo (current null) */
    itemsOnlyInPrevious: number;
    /** Items que solo estaban en el conteo actual (previous null) */
    itemsOnlyInCurrent: number;
    /** Suma neta de deltas: positivo = ganancia, negativo = pérdida agregada */
    totalNetDelta: number;
    /** Suma de magnitudes negativas (lo que se perdió en total) */
    totalDecrease: number;
    /** Suma de magnitudes positivas (lo que entró en total) */
    totalIncrease: number;
}

export interface CategoryBucket<R extends ComparisonRowLike = ComparisonRowLike> {
    category: string;
    rows: R[];
    netDelta: number;
    decrease: number;
    increase: number;
}

const EPS = 0.001;

export function computeComparisonMetrics(rows: ComparisonRowLike[]): ComparisonMetrics {
    let itemsDecreased = 0;
    let itemsIncreased = 0;
    let itemsUnchanged = 0;
    let itemsOnlyInPrevious = 0;
    let itemsOnlyInCurrent = 0;
    let totalNetDelta = 0;
    let totalDecrease = 0;
    let totalIncrease = 0;

    for (const r of rows) {
        if (r.previousQty === null && r.currentQty !== null) {
            itemsOnlyInCurrent++;
            continue;
        }
        if (r.currentQty === null && r.previousQty !== null) {
            itemsOnlyInPrevious++;
            continue;
        }
        const delta = r.delta ?? 0;
        if (!Number.isFinite(delta)) continue;
        if (delta < -EPS) {
            itemsDecreased++;
            totalDecrease += Math.abs(delta);
        } else if (delta > EPS) {
            itemsIncreased++;
            totalIncrease += delta;
        } else {
            itemsUnchanged++;
        }
        totalNetDelta += delta;
    }

    return {
        totalItems: rows.length,
        itemsDecreased,
        itemsIncreased,
        itemsUnchanged,
        itemsOnlyInPrevious,
        itemsOnlyInCurrent,
        totalNetDelta: Math.round(totalNetDelta * 100) / 100,
        totalDecrease: Math.round(totalDecrease * 100) / 100,
        totalIncrease: Math.round(totalIncrease * 100) / 100,
    };
}

/** Agrupa filas por categoría con subtotales (netDelta/decrease/increase por grupo). */
export function groupComparisonByCategory<R extends ComparisonRowLike>(
    rows: R[],
): CategoryBucket<R>[] {
    const map = new Map<string, R[]>();
    for (const r of rows) {
        const cat = r.category || 'Sin categoría';
        const arr = map.get(cat) ?? [];
        arr.push(r);
        map.set(cat, arr);
    }
    return Array.from(map.keys()).sort().map(category => {
        const arr = map.get(category)!;
        let netDelta = 0;
        let decrease = 0;
        let increase = 0;
        for (const r of arr) {
            const d = r.delta ?? 0;
            if (!Number.isFinite(d)) continue;
            netDelta += d;
            if (d < -EPS) decrease += Math.abs(d);
            else if (d > EPS) increase += d;
        }
        return {
            category,
            rows: arr,
            netDelta: Math.round(netDelta * 100) / 100,
            decrease: Math.round(decrease * 100) / 100,
            increase: Math.round(increase * 100) / 100,
        };
    });
}

/** Top N items con caída más fuerte (más negativos primero). */
export function topDecreases<R extends ComparisonRowLike>(rows: R[], n = 10): R[] {
    return [...rows]
        .filter(r => Number.isFinite(r.delta ?? 0) && (r.delta ?? 0) < -EPS)
        .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
        .slice(0, n);
}

/** Top N items con subida más fuerte (más positivos primero). */
export function topIncreases<R extends ComparisonRowLike>(rows: R[], n = 10): R[] {
    return [...rows]
        .filter(r => Number.isFinite(r.delta ?? 0) && (r.delta ?? 0) > EPS)
        .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
        .slice(0, n);
}

/** Filtro por SKU + nombre + categoría (case-insensitive). */
export function filterComparisonRows<R extends ComparisonRowLike>(rows: R[], query: string): R[] {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => `${r.sku} ${r.name} ${r.category ?? ''}`.toLowerCase().includes(q));
}
