import { describe, it, expect } from 'vitest';
import { classifyMenuEngineering, type MenuEngineeringInput } from './menu-engineering';

const item = (over: Partial<MenuEngineeringInput>): MenuEngineeringInput => ({
    menuItemId: 'x', name: 'Item', category: 'Cat', units: 0, revenue: 0, cost: 0, ...over,
});

describe('classifyMenuEngineering', () => {
    it('clasifica los 4 cuadrantes con umbrales 70%-promedio y margen ponderado', () => {
        // avgUnits = (100+100+10+10)/4 = 55 → umbral popularidad 38.5
        // margen ponderado = (60+20+27+2) / (100+100+30+10) = 109/240 ≈ 45.4%
        const res = classifyMenuEngineering([
            item({ menuItemId: 'estrella', units: 100, revenue: 100, cost: 40 }),  // 60% margen, popular
            item({ menuItemId: 'vaca', units: 100, revenue: 100, cost: 80 }),      // 20% margen, popular
            item({ menuItemId: 'rompecabezas', units: 10, revenue: 30, cost: 3 }), // 90% margen, no popular
            item({ menuItemId: 'perro', units: 10, revenue: 10, cost: 8 }),        // 20% margen, no popular
        ]);
        const byId = new Map(res.rows.map(r => [r.menuItemId, r.quadrant]));
        expect(byId.get('estrella')).toBe('ESTRELLA');
        expect(byId.get('vaca')).toBe('VACA');
        expect(byId.get('rompecabezas')).toBe('ROMPECABEZAS');
        expect(byId.get('perro')).toBe('PERRO');
        expect(res.counts.ESTRELLA).toBe(1);
    });

    it('ítems sin costo van a SIN_COSTO y no contaminan el umbral de margen', () => {
        const res = classifyMenuEngineering([
            item({ menuItemId: 'a', units: 50, revenue: 100, cost: 50 }),  // 50% margen
            item({ menuItemId: 'sin', units: 200, revenue: 500, cost: 0 }), // sin costo
        ]);
        const byId = new Map(res.rows.map(r => [r.menuItemId, r.quadrant]));
        expect(byId.get('sin')).toBe('SIN_COSTO');
        // umbral de margen calculado SOLO con 'a' (50%), no arrastrado a 90%+
        expect(res.thresholds.marginPct).toBeCloseTo(50);
    });

    it('lista vacía no explota', () => {
        const res = classifyMenuEngineering([]);
        expect(res.rows).toEqual([]);
        expect(res.thresholds.popularityUnits).toBe(0);
    });

    it('ordena por revenue descendente', () => {
        const res = classifyMenuEngineering([
            item({ menuItemId: 'low', units: 1, revenue: 5, cost: 1 }),
            item({ menuItemId: 'high', units: 1, revenue: 50, cost: 10 }),
        ]);
        expect(res.rows[0].menuItemId).toBe('high');
    });
});
