/**
 * Ingeniería de menú — clasificación pura (familia E del catálogo).
 *
 * Matriz popularidad × margen (metodología Kasavana-Smith):
 *  - ESTRELLA      alta popularidad + alto margen   → mantener/destacar
 *  - VACA          alta popularidad + bajo margen   → subir precio / bajar costo
 *  - ROMPECABEZAS  baja popularidad + alto margen   → promocionar
 *  - PERRO         baja popularidad + bajo margen   → replantear/eliminar
 *
 * Umbrales: popularidad ≥ 70% del promedio de unidades (factor estándar de
 * la metodología) · margen % ≥ promedio ponderado del margen del rango.
 * Función PURA — los datos vienen de getSalesByProduct (snapshot de costo
 * A0.1; ítems sin costo se clasifican aparte como SIN_COSTO, no contaminan
 * los promedios).
 */

export type MenuQuadrant = 'ESTRELLA' | 'VACA' | 'ROMPECABEZAS' | 'PERRO' | 'SIN_COSTO';

export interface MenuEngineeringInput {
    menuItemId: string;
    name: string;
    category: string;
    units: number;
    revenue: number;
    cost: number;
}

export interface MenuEngineeringRow extends MenuEngineeringInput {
    marginUsd: number;
    marginPct: number;
    quadrant: MenuQuadrant;
}

export interface MenuEngineeringResult {
    rows: MenuEngineeringRow[];
    thresholds: { popularityUnits: number; marginPct: number };
    counts: Record<MenuQuadrant, number>;
}

export function classifyMenuEngineering(items: MenuEngineeringInput[]): MenuEngineeringResult {
    const withCost = items.filter(i => i.cost > 0 && i.revenue > 0);

    // Umbral de popularidad: 70% del promedio de unidades (sobre TODOS los
    // ítems vendidos — la popularidad no depende de tener costo).
    const sold = items.filter(i => i.units > 0);
    const avgUnits = sold.length > 0 ? sold.reduce((s, i) => s + i.units, 0) / sold.length : 0;
    const popularityThreshold = avgUnits * 0.7;

    // Umbral de margen: margen % ponderado del rango (Σ margen / Σ revenue).
    const totalRevenue = withCost.reduce((s, i) => s + i.revenue, 0);
    const totalMargin = withCost.reduce((s, i) => s + (i.revenue - i.cost), 0);
    const marginThreshold = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    const counts: Record<MenuQuadrant, number> = {
        ESTRELLA: 0, VACA: 0, ROMPECABEZAS: 0, PERRO: 0, SIN_COSTO: 0,
    };

    const rows: MenuEngineeringRow[] = items.map(i => {
        const marginUsd = i.revenue - i.cost;
        const marginPct = i.revenue > 0 ? (marginUsd / i.revenue) * 100 : 0;

        let quadrant: MenuQuadrant;
        if (!(i.cost > 0) || !(i.revenue > 0)) {
            quadrant = 'SIN_COSTO';
        } else {
            const popular = i.units >= popularityThreshold;
            const profitable = marginPct >= marginThreshold;
            quadrant = popular
                ? (profitable ? 'ESTRELLA' : 'VACA')
                : (profitable ? 'ROMPECABEZAS' : 'PERRO');
        }
        counts[quadrant] += 1;
        return { ...i, marginUsd, marginPct, quadrant };
    });

    rows.sort((a, b) => b.revenue - a.revenue);

    return {
        rows,
        thresholds: { popularityUnits: popularityThreshold, marginPct: marginThreshold },
        counts,
    };
}
