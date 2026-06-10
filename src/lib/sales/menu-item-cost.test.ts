import { describe, it, expect } from 'vitest';
import { computeCostFromRecipeRows, costSnapshotFields } from './menu-item-cost';

describe('computeCostFromRecipeRows', () => {
    it('suma cantidad × costo vigente por ingrediente (convención de margen)', () => {
        const map = computeCostFromRecipeRows([{
            menuItemId: 'm1',
            manualCost: null,
            hasRecipe: true,
            ingredients: [
                { quantity: 0.2, currentCost: 10 },   // 2.00
                { quantity: 0.05, currentCost: 40 },  // 2.00
            ],
        }]);
        expect(map.get('m1')).toBe(4);
    });

    it('ingredientes sin costo vigente aportan 0 (no NaN)', () => {
        const map = computeCostFromRecipeRows([{
            menuItemId: 'm1',
            manualCost: null,
            hasRecipe: true,
            ingredients: [
                { quantity: 1, currentCost: null },
                { quantity: 2, currentCost: 3 },
            ],
        }]);
        expect(map.get('m1')).toBe(6);
    });

    it('sin receta cae al costo manual del MenuItem', () => {
        const map = computeCostFromRecipeRows([{
            menuItemId: 'm1', manualCost: 2.5, hasRecipe: false, ingredients: [],
        }]);
        expect(map.get('m1')).toBe(2.5);
    });

    it('sin receta ni costo manual → 0', () => {
        const map = computeCostFromRecipeRows([{
            menuItemId: 'm1', manualCost: null, hasRecipe: false, ingredients: [],
        }]);
        expect(map.get('m1')).toBe(0);
    });

    it('datos corruptos (NaN/negativos) no rompen el cálculo', () => {
        const map = computeCostFromRecipeRows([{
            menuItemId: 'm1',
            manualCost: Number.NaN,
            hasRecipe: true,
            ingredients: [
                { quantity: Number.NaN, currentCost: 5 },
                { quantity: -2, currentCost: 5 },
                { quantity: 1, currentCost: Number.POSITIVE_INFINITY },
                { quantity: 1, currentCost: 4 },
            ],
        }]);
        expect(map.get('m1')).toBe(4);
    });
});

describe('costSnapshotFields', () => {
    it('calcula costTotal y margen del snapshot', () => {
        const f = costSnapshotFields(10, 3, 4);
        expect(f).toEqual({ costPerUnit: 4, costTotal: 12, marginPerUnit: 6, marginPercent: 60 });
    });

    it('precio 0 (cortesía) → margen 0%, sin división por cero', () => {
        const f = costSnapshotFields(0, 2, 3);
        expect(f.costTotal).toBe(6);
        expect(f.marginPercent).toBe(0);
    });

    it('costo inválido se normaliza a 0', () => {
        const f = costSnapshotFields(10, 1, Number.NaN);
        expect(f.costPerUnit).toBe(0);
        expect(f.marginPerUnit).toBe(10);
        expect(f.marginPercent).toBe(100);
    });
});
