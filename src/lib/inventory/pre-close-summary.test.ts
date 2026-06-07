import { describe, it, expect } from 'vitest';
import { analyzePreCloseSummary } from './pre-close-summary';

function mk(over: Partial<{
    inventoryItemId: string; name: string; unit: string;
    finalCount: number | null; sales: number; variance: number | null; isCritical: boolean;
}> = {}) {
    return {
        inventoryItemId: over.inventoryItemId ?? `it-${Math.random().toString(36).slice(2, 8)}`,
        name: over.name ?? 'Item',
        unit: over.unit ?? 'KG',
        finalCount: over.finalCount ?? 0,
        sales: over.sales ?? 0,
        variance: over.variance ?? 0,
        isCritical: over.isCritical ?? false,
    };
}

describe('analyzePreCloseSummary', () => {
    it('cierre vacío (todos en 0) → severity BLOCK', () => {
        const s = analyzePreCloseSummary([
            mk({ finalCount: 0 }),
            mk({ finalCount: 0 }),
            mk({ finalCount: 0 }),
        ]);
        expect(s.allItemsAtZero).toBe(true);
        expect(s.severity).toBe('BLOCK');
    });

    it('al menos un item con count > 0 → no BLOCK', () => {
        const s = analyzePreCloseSummary([
            mk({ finalCount: 5 }),
            mk({ finalCount: 0 }),
        ]);
        expect(s.allItemsAtZero).toBe(false);
        expect(s.severity).not.toBe('BLOCK');
    });

    it('item crítico en 0 → sospechoso CRITICAL_AT_ZERO, severity WARN', () => {
        const s = analyzePreCloseSummary([
            mk({ name: 'Queso de mano', finalCount: 0, isCritical: true }),
            mk({ name: 'Tomate',         finalCount: 3 }),
        ]);
        expect(s.suspectedNotCounted).toHaveLength(1);
        expect(s.suspectedNotCounted[0].reason).toBe('CRITICAL_AT_ZERO');
        expect(s.suspectedNotCounted[0].name).toBe('Queso de mano');
        expect(s.severity).toBe('WARN');
    });

    it('item con ventas pero finalCount=0 → sospechoso SOLD_BUT_ZERO', () => {
        const s = analyzePreCloseSummary([
            mk({ name: 'Harina', finalCount: 0, sales: 4.5 }),
            mk({ name: 'Sal',     finalCount: 1 }),
        ]);
        expect(s.suspectedNotCounted).toHaveLength(1);
        expect(s.suspectedNotCounted[0].reason).toBe('SOLD_BUT_ZERO');
        expect(s.suspectedNotCounted[0].sales).toBeCloseTo(4.5, 2);
    });

    it('crítico en 0 prioriza sobre sales — no se duplica', () => {
        const s = analyzePreCloseSummary([
            mk({ name: 'Queso', finalCount: 0, sales: 2, isCritical: true }),
        ]);
        expect(s.suspectedNotCounted).toHaveLength(1);
        expect(s.suspectedNotCounted[0].reason).toBe('CRITICAL_AT_ZERO');
    });

    it('top varianzas: solo las negativas, ordenadas por más faltante primero, top 5', () => {
        const items = [
            mk({ name: 'A', variance: -10, finalCount: 1 }),
            mk({ name: 'B', variance: -2,  finalCount: 1 }),
            mk({ name: 'C', variance: 5,   finalCount: 1 }),   // positiva, no entra
            mk({ name: 'D', variance: -7,  finalCount: 1 }),
            mk({ name: 'E', variance: 0,   finalCount: 1 }),   // cero, no entra
            mk({ name: 'F', variance: -1,  finalCount: 1 }),
            mk({ name: 'G', variance: -15, finalCount: 1 }),
            mk({ name: 'H', variance: -3,  finalCount: 1 }),
        ];
        const s = analyzePreCloseSummary(items);
        expect(s.topNegativeVariances.map(v => v.name)).toEqual(['G', 'A', 'D', 'H', 'B']);
    });

    it('topVariancesLimit configurable', () => {
        const s = analyzePreCloseSummary(
            [mk({ name: 'A', variance: -5, finalCount: 1 }), mk({ name: 'B', variance: -3, finalCount: 1 })],
            { topVariancesLimit: 1 },
        );
        expect(s.topNegativeVariances).toHaveLength(1);
        expect(s.topNegativeVariances[0].name).toBe('A');
    });

    it('totalVariance suma todas (positivas y negativas)', () => {
        const s = analyzePreCloseSummary([
            mk({ variance: -10, finalCount: 1 }),
            mk({ variance: 3,   finalCount: 1 }),
            mk({ variance: -2,  finalCount: 1 }),
        ]);
        expect(s.totalVariance).toBeCloseTo(-9, 2);
    });

    it('OK cuando todo está contado y sin varianzas significativas', () => {
        const s = analyzePreCloseSummary([
            mk({ finalCount: 5, variance: 0 }),
            mk({ finalCount: 3, variance: 0.005 }),  // <0.01 ignorada
        ]);
        expect(s.severity).toBe('OK');
        expect(s.suspectedNotCounted).toHaveLength(0);
        expect(s.topNegativeVariances).toHaveLength(0);
    });

    it('defensivo con null/undefined/NaN', () => {
        const s = analyzePreCloseSummary([
            mk({ finalCount: null, variance: null, sales: NaN as unknown as number }),
        ]);
        expect(s.severity).toBe('BLOCK');  // todos en 0
        expect(s.totalVariance).toBe(0);
    });

    it('lista vacía → severity OK', () => {
        const s = analyzePreCloseSummary([]);
        expect(s.totalItems).toBe(0);
        expect(s.severity).toBe('OK');
        expect(s.allItemsAtZero).toBe(false);  // no hay items, no es "vacío"
    });
});
