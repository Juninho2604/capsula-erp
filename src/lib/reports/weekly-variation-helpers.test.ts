import { describe, it, expect } from 'vitest';
import {
    computeComparisonMetrics,
    groupComparisonByCategory,
    topDecreases,
    topIncreases,
    filterComparisonRows,
} from './weekly-variation-helpers';

function r(over: Partial<{
    inventoryItemId: string; sku: string; name: string; category: string | null;
    baseUnit: string; previousQty: number | null; currentQty: number | null; delta: number | null;
}> = {}) {
    return {
        inventoryItemId: over.inventoryItemId ?? `x-${Math.random().toString(36).slice(2, 7)}`,
        sku: over.sku ?? 'SKU-001',
        name: over.name ?? 'Item',
        category: over.category === undefined ? 'Cat' : over.category,
        baseUnit: over.baseUnit ?? 'KG',
        previousQty: over.previousQty ?? null,
        currentQty: over.currentQty ?? null,
        delta: over.delta ?? null,
    };
}

describe('computeComparisonMetrics', () => {
    it('cuenta caídas, subidas, sin cambio y solo-presente', () => {
        const rows = [
            r({ previousQty: 10, currentQty: 8,   delta: -2 }),     // caída
            r({ previousQty: 5,  currentQty: 5,   delta: 0 }),       // sin cambio
            r({ previousQty: 3,  currentQty: 7,   delta: 4 }),       // subida
            r({ previousQty: null, currentQty: 6, delta: null }),    // solo en current
            r({ previousQty: 12, currentQty: null, delta: null }),   // solo en previous
        ];
        const m = computeComparisonMetrics(rows);
        expect(m.totalItems).toBe(5);
        expect(m.itemsDecreased).toBe(1);
        expect(m.itemsIncreased).toBe(1);
        expect(m.itemsUnchanged).toBe(1);
        expect(m.itemsOnlyInPrevious).toBe(1);
        expect(m.itemsOnlyInCurrent).toBe(1);
        expect(m.totalDecrease).toBeCloseTo(2, 2);
        expect(m.totalIncrease).toBeCloseTo(4, 2);
        expect(m.totalNetDelta).toBeCloseTo(2, 2);
    });

    it('delta dentro de epsilon (±0.001) se trata como sin cambio', () => {
        const m = computeComparisonMetrics([
            r({ previousQty: 5, currentQty: 5.0005, delta: 0.0005 }),
        ]);
        expect(m.itemsUnchanged).toBe(1);
        expect(m.itemsDecreased).toBe(0);
        expect(m.itemsIncreased).toBe(0);
    });

    it('lista vacía → métricas en 0', () => {
        const m = computeComparisonMetrics([]);
        expect(m.totalItems).toBe(0);
        expect(m.totalDecrease).toBe(0);
    });

    it('delta no finito (NaN/Infinity) se ignora en sumatorias', () => {
        const m = computeComparisonMetrics([
            r({ previousQty: 5, currentQty: 5, delta: NaN }),
            r({ previousQty: 3, currentQty: 1, delta: -2 }),
        ]);
        expect(m.totalDecrease).toBeCloseTo(2, 2);
    });
});

describe('groupComparisonByCategory', () => {
    it('agrupa por categoría con subtotales correctos', () => {
        const g = groupComparisonByCategory([
            r({ category: 'A', delta: -3 }),
            r({ category: 'A', delta: 5 }),
            r({ category: 'B', delta: -10 }),
        ]);
        expect(g.map(x => x.category)).toEqual(['A', 'B']);
        expect(g[0].netDelta).toBeCloseTo(2, 2);
        expect(g[0].decrease).toBeCloseTo(3, 2);
        expect(g[0].increase).toBeCloseTo(5, 2);
        expect(g[1].netDelta).toBeCloseTo(-10, 2);
    });

    it('items sin categoría caen en "Sin categoría"', () => {
        const g = groupComparisonByCategory([r({ category: null, delta: -1 })]);
        expect(g[0].category).toBe('Sin categoría');
    });
});

describe('topDecreases / topIncreases', () => {
    const rows = [
        r({ name: 'A', delta: -15 }),
        r({ name: 'B', delta: -5 }),
        r({ name: 'C', delta: 3 }),
        r({ name: 'D', delta: 8 }),
        r({ name: 'E', delta: -1 }),
        r({ name: 'F', delta: -20 }),
        r({ name: 'G', delta: 0 }),
    ];

    it('topDecreases ordena más negativos primero, default 10', () => {
        const t = topDecreases(rows);
        expect(t.map(x => x.name)).toEqual(['F', 'A', 'B', 'E']);
    });

    it('topIncreases ordena más positivos primero', () => {
        const t = topIncreases(rows);
        expect(t.map(x => x.name)).toEqual(['D', 'C']);
    });

    it('respeta el argumento n', () => {
        expect(topDecreases(rows, 2).map(r => r.name)).toEqual(['F', 'A']);
    });
});

describe('filterComparisonRows', () => {
    const rows = [
        r({ sku: 'QM-001', name: 'Queso de mano', category: 'Lácteos' }),
        r({ sku: 'TM-002', name: 'Tomate',         category: 'Vegetales' }),
    ];

    it('filtra por sku/nombre/categoría case-insensitive', () => {
        expect(filterComparisonRows(rows, 'tomate').map(r => r.sku)).toEqual(['TM-002']);
        expect(filterComparisonRows(rows, 'qm-001').map(r => r.sku)).toEqual(['QM-001']);
        expect(filterComparisonRows(rows, 'LÁC').map(r => r.sku)).toEqual(['QM-001']);
    });

    it('query vacío devuelve todo', () => {
        expect(filterComparisonRows(rows, '')).toHaveLength(2);
    });
});
