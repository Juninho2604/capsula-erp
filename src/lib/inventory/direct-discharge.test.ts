import { describe, it, expect } from 'vitest';
import {
    expandDirectDischarge,
    type DirectDischargeMap,
    type FlatIngredient,
} from './direct-discharge';

// IDs de prueba
const TABULE = 'inv-tabule';
const PEREJIL = 'inv-perejil';
const TRIGO = 'inv-trigo';
const LIMON = 'inv-limon';
const SHAWARMA_MEAT = 'inv-carne';
const SALSA = 'inv-salsa';        // sub-receta directa anidada dentro del tabule
const AJO = 'inv-ajo';

// Sub-receta tabule: rinde 2 KG, lleva 1 KG perejil + 0.5 KG trigo + 0.2 L limón.
const tabuleSub = {
    outputBaseUnit: 'KG',
    outputQuantity: 2,
    outputUnit: 'KG',
    ingredients: [
        { ingredientItemId: PEREJIL, quantity: 1, unit: 'KG' },
        { ingredientItemId: TRIGO, quantity: 0.5, unit: 'KG' },
        { ingredientItemId: LIMON, quantity: 0.2, unit: 'L' },
    ] as FlatIngredient[],
};

describe('expandDirectDischarge (§124)', () => {
    it('SEGURIDAD: map vacío → salida IDÉNTICA a la entrada', () => {
        const input: FlatIngredient[] = [
            { ingredientItemId: SHAWARMA_MEAT, quantity: 0.25, unit: 'KG' },
            { ingredientItemId: TABULE, quantity: 0.15, unit: 'KG' },
        ];
        const out = expandDirectDischarge(input, new Map());
        expect(out).toEqual(input);
    });

    it('explota una sub-receta directa proporcionalmente (tabule 0.15 de rinde 2)', () => {
        const map: DirectDischargeMap = new Map([[TABULE, tabuleSub]]);
        const input: FlatIngredient[] = [
            { ingredientItemId: SHAWARMA_MEAT, quantity: 0.25, unit: 'KG' },
            { ingredientItemId: TABULE, quantity: 0.15, unit: 'KG' },
        ];
        const out = expandDirectDischarge(input, map);
        // ratio = 0.15 / 2 = 0.075
        expect(out).toEqual([
            { ingredientItemId: SHAWARMA_MEAT, quantity: 0.25, unit: 'KG' }, // hoja, intacto
            { ingredientItemId: PEREJIL, quantity: 0.075, unit: 'KG' },
            { ingredientItemId: TRIGO, quantity: 0.0375, unit: 'KG' },
            { ingredientItemId: LIMON, quantity: 0.015, unit: 'L' },
        ]);
    });

    it('convierte outputQuantity a base cuando outputUnit ≠ baseUnit (2000 G = 2 KG)', () => {
        const map: DirectDischargeMap = new Map([[TABULE, {
            ...tabuleSub,
            outputBaseUnit: 'KG',
            outputQuantity: 2000,
            outputUnit: 'G', // 2000 G → 2 KG
        }]]);
        const out = expandDirectDischarge([{ ingredientItemId: TABULE, quantity: 0.15, unit: 'KG' }], map);
        expect(out[0]).toEqual({ ingredientItemId: PEREJIL, quantity: 0.075, unit: 'KG' });
    });

    it('sub-receta NO marcada (no está en el map) → se descuenta tal cual (producción normal)', () => {
        const input: FlatIngredient[] = [{ ingredientItemId: TABULE, quantity: 0.15, unit: 'KG' }];
        const out = expandDirectDischarge(input, new Map()); // tabule no está → intacto
        expect(out).toEqual(input);
    });

    it('mezcla insumo hoja + sub-receta directa: el hoja queda, la sub explota', () => {
        const map: DirectDischargeMap = new Map([[TABULE, tabuleSub]]);
        const out = expandDirectDischarge([
            { ingredientItemId: SHAWARMA_MEAT, quantity: 0.3, unit: 'KG' },
            { ingredientItemId: TABULE, quantity: 0.3, unit: 'KG' }, // ratio 0.15
        ], map);
        expect(out).toContainEqual({ ingredientItemId: SHAWARMA_MEAT, quantity: 0.3, unit: 'KG' });
        expect(out).toContainEqual({ ingredientItemId: PEREJIL, quantity: 0.15, unit: 'KG' });
    });

    it('anidamiento: sub-receta directa que contiene otra sub-receta directa', () => {
        // tabule (rinde 2 KG) lleva 0.2 KG de "salsa"; salsa (rinde 1 KG) lleva 0.5 KG ajo.
        const tabuleConSalsa = {
            outputBaseUnit: 'KG', outputQuantity: 2, outputUnit: 'KG',
            ingredients: [
                { ingredientItemId: PEREJIL, quantity: 1, unit: 'KG' },
                { ingredientItemId: SALSA, quantity: 0.2, unit: 'KG' },
            ] as FlatIngredient[],
        };
        const salsaSub = {
            outputBaseUnit: 'KG', outputQuantity: 1, outputUnit: 'KG',
            ingredients: [{ ingredientItemId: AJO, quantity: 0.5, unit: 'KG' }] as FlatIngredient[],
        };
        const map: DirectDischargeMap = new Map([[TABULE, tabuleConSalsa], [SALSA, salsaSub]]);
        const out = expandDirectDischarge([{ ingredientItemId: TABULE, quantity: 2, unit: 'KG' }], map);
        // ratio tabule = 2/2 = 1 → perejil 1 KG, salsa 0.2 KG
        // ratio salsa = 0.2/1 = 0.2 → ajo 0.5*0.2 = 0.1 KG
        expect(out).toContainEqual({ ingredientItemId: PEREJIL, quantity: 1, unit: 'KG' });
        expect(out).toContainEqual({ ingredientItemId: AJO, quantity: 0.1, unit: 'KG' });
        // SALSA no debe quedar como op (se explotó)
        expect(out.find(o => o.ingredientItemId === SALSA)).toBeUndefined();
    });

    it('GUARDA anti-ciclo: A→B→A no cuelga y corta emitiendo tal cual', () => {
        const A = { outputBaseUnit: 'KG', outputQuantity: 1, outputUnit: 'KG',
            ingredients: [{ ingredientItemId: 'B', quantity: 1, unit: 'KG' }] as FlatIngredient[] };
        const B = { outputBaseUnit: 'KG', outputQuantity: 1, outputUnit: 'KG',
            ingredients: [{ ingredientItemId: 'A', quantity: 1, unit: 'KG' }] as FlatIngredient[] };
        const map: DirectDischargeMap = new Map([['A', A], ['B', B]]);
        const out = expandDirectDischarge([{ ingredientItemId: 'A', quantity: 1, unit: 'KG' }], map);
        // A→B→(A ya en el stack)→ se emite A tal cual. Termina sin colgarse.
        expect(out).toEqual([{ ingredientItemId: 'A', quantity: 1, unit: 'KG' }]);
    });

    it('rendimiento inválido (outputQuantity 0) → fallback: emite el ingrediente tal cual', () => {
        const map: DirectDischargeMap = new Map([[TABULE, { ...tabuleSub, outputQuantity: 0 }]]);
        const input = [{ ingredientItemId: TABULE, quantity: 0.15, unit: 'KG' }];
        expect(expandDirectDischarge(input, map)).toEqual(input);
    });

    it('cantidad no positiva o NaN → no expande, emite tal cual', () => {
        const map: DirectDischargeMap = new Map([[TABULE, tabuleSub]]);
        expect(expandDirectDischarge([{ ingredientItemId: TABULE, quantity: 0, unit: 'KG' }], map))
            .toEqual([{ ingredientItemId: TABULE, quantity: 0, unit: 'KG' }]);
        expect(expandDirectDischarge([{ ingredientItemId: TABULE, quantity: NaN, unit: 'KG' }], map))
            .toEqual([{ ingredientItemId: TABULE, quantity: NaN, unit: 'KG' }]);
    });

    it('sub-receta directa vacía (sin ingredientes) → simplemente no descarga nada', () => {
        const map: DirectDischargeMap = new Map([[TABULE, { ...tabuleSub, ingredients: [] }]]);
        const out = expandDirectDischarge([{ ingredientItemId: TABULE, quantity: 0.15, unit: 'KG' }], map);
        expect(out).toEqual([]);
    });

    it('no muta el array ni los objetos de entrada', () => {
        const map: DirectDischargeMap = new Map([[TABULE, tabuleSub]]);
        const input: FlatIngredient[] = [{ ingredientItemId: TABULE, quantity: 0.15, unit: 'KG' }];
        const snapshot = JSON.parse(JSON.stringify(input));
        expandDirectDischarge(input, map);
        expect(input).toEqual(snapshot);
        // El sub-recipe del map tampoco se toca
        expect(tabuleSub.ingredients[0]).toEqual({ ingredientItemId: PEREJIL, quantity: 1, unit: 'KG' });
    });
});
