import { describe, it, expect } from 'vitest';
import { groupInventoryByCategory, filterInventoryRows } from './inventory-report-helpers';

function r(over: Partial<{
    sku: string; name: string; category: string; baseUnit: string;
    totalStock: number; stockByArea: Record<string, number>;
    costPerUnit: number; totalValue: number;
}> = {}) {
    return {
        sku: over.sku ?? 'X-001',
        name: over.name ?? 'Item',
        category: over.category ?? 'Cat',
        baseUnit: over.baseUnit ?? 'KG',
        totalStock: over.totalStock ?? 0,
        stockByArea: over.stockByArea ?? {},
        costPerUnit: over.costPerUnit ?? 0,
        totalValue: over.totalValue ?? 0,
    };
}

describe('groupInventoryByCategory', () => {
    it('agrupa por categoría y ordena alfabéticamente', () => {
        const g = groupInventoryByCategory([
            r({ category: 'Lácteos', sku: 'A' }),
            r({ category: 'Proteínas', sku: 'B' }),
            r({ category: 'Lácteos', sku: 'C' }),
        ]);
        expect(g.groups.map(x => x.category)).toEqual(['Lácteos', 'Proteínas']);
        expect(g.groups[0].rows.map(x => x.sku)).toEqual(['A', 'C']);
        expect(g.categoryCount).toBe(2);
    });

    it('suma totales por grupo y grand total', () => {
        const g = groupInventoryByCategory([
            r({ category: 'A', totalStock: 5, totalValue: 50 }),
            r({ category: 'A', totalStock: 3, totalValue: 30 }),
            r({ category: 'B', totalStock: 10, totalValue: 100 }),
        ]);
        expect(g.groups[0].totalStock).toBeCloseTo(8, 2);
        expect(g.groups[0].totalValue).toBeCloseTo(80, 2);
        expect(g.groups[1].totalStock).toBeCloseTo(10, 2);
        expect(g.grandTotalStock).toBeCloseTo(18, 2);
        expect(g.grandTotalValue).toBeCloseTo(180, 2);
        expect(g.itemCount).toBe(3);
    });

    it('items con categoría vacía caen en "Sin categoría"', () => {
        const g = groupInventoryByCategory([
            r({ category: '', sku: 'A' }),
        ]);
        expect(g.groups[0].category).toBe('Sin categoría');
    });

    it('defensivo: totalStock/totalValue no finitos cuentan como 0', () => {
        const g = groupInventoryByCategory([
            r({ totalStock: NaN, totalValue: Infinity }),
            r({ totalStock: 5, totalValue: 25 }),
        ]);
        expect(g.grandTotalStock).toBeCloseTo(5, 2);
        expect(g.grandTotalValue).toBeCloseTo(25, 2);
    });

    it('lista vacía → groups vacío, totales 0', () => {
        const g = groupInventoryByCategory([]);
        expect(g.groups).toEqual([]);
        expect(g.grandTotalStock).toBe(0);
        expect(g.itemCount).toBe(0);
    });
});

describe('filterInventoryRows', () => {
    const rows = [
        r({ sku: 'QM-001', name: 'Queso de mano', category: 'Lácteos' }),
        r({ sku: 'TM-002', name: 'Tomate', category: 'Vegetales' }),
        r({ sku: 'PC-010', name: 'Pechuga pollo', category: 'Proteínas' }),
    ];

    it('matchea por SKU', () => {
        const out = filterInventoryRows(rows, 'qm-001');
        expect(out.map(r => r.sku)).toEqual(['QM-001']);
    });

    it('matchea por nombre case-insensitive', () => {
        const out = filterInventoryRows(rows, 'tomate');
        expect(out.map(r => r.sku)).toEqual(['TM-002']);
    });

    it('matchea por categoría', () => {
        const out = filterInventoryRows(rows, 'lácteos');
        expect(out.map(r => r.sku)).toEqual(['QM-001']);
    });

    it('query vacío devuelve todo', () => {
        expect(filterInventoryRows(rows, '')).toHaveLength(3);
        expect(filterInventoryRows(rows, '   ')).toHaveLength(3);
    });

    it('sin matches → array vacío', () => {
        expect(filterInventoryRows(rows, 'xyz123')).toEqual([]);
    });
});
