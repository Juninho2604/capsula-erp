import { describe, it, expect } from 'vitest';
import { computeConsumptionFromOrders, collectReferencedRecipeIds } from './consumption';

const recipeArepa = {
    ingredients: [
        { ingredientItemId: 'harina', quantity: 0.1 },   // 100g por arepa
        { ingredientItemId: 'queso',  quantity: 0.05 },  // 50g por arepa
    ],
};
const recipeTabla = {
    ingredients: [
        { ingredientItemId: 'queso',     quantity: 0.2 },   // 200g
        { ingredientItemId: 'aceitunas', quantity: 0.03 },  // 30g
    ],
};

describe('computeConsumptionFromOrders', () => {
    it('suma consumos de varias órdenes que comparten ingrediente (queso)', () => {
        const recipes = new Map([
            ['rec-arepa', recipeArepa],
            ['rec-tabla', recipeTabla],
        ]);
        const orders = [
            { items: [
                { quantity: 3, menuItem: { recipeId: 'rec-arepa' } },  // 3 arepas
                { quantity: 1, menuItem: { recipeId: 'rec-tabla' } },  // 1 tabla
            ] },
            { items: [
                { quantity: 2, menuItem: { recipeId: 'rec-tabla' } },  // 2 tablas
            ] },
        ];

        const c = computeConsumptionFromOrders(orders, recipes);
        expect(c.get('harina')).toBeCloseTo(0.3, 3);            // 3 × 0.1
        expect(c.get('queso')).toBeCloseTo(0.15 + 0.6, 3);      // (3 × 0.05) + (3 × 0.2)
        expect(c.get('aceitunas')).toBeCloseTo(0.09, 3);        // 3 × 0.03
    });

    it('item sin receta no se cuenta (recipeId null)', () => {
        const recipes = new Map([['rec-arepa', recipeArepa]]);
        const orders = [
            { items: [
                { quantity: 5, menuItem: { recipeId: null } },          // ej. propina o item sin receta
                { quantity: 5, menuItem: null },                          // ej. item huérfano
                { quantity: 2, menuItem: { recipeId: 'rec-arepa' } },
            ] },
        ];
        const c = computeConsumptionFromOrders(orders, recipes);
        expect(c.size).toBe(2);
        expect(c.get('harina')).toBeCloseTo(0.2, 3);
        expect(c.get('queso')).toBeCloseTo(0.1, 3);
    });

    it('receta referenciada pero faltante en el map → se saltea (no rompe)', () => {
        const recipes = new Map([['rec-arepa', recipeArepa]]);  // tabla NO está
        const orders = [
            { items: [
                { quantity: 5, menuItem: { recipeId: 'rec-tabla' } },   // se saltea
                { quantity: 1, menuItem: { recipeId: 'rec-arepa' } },
            ] },
        ];
        const c = computeConsumptionFromOrders(orders, recipes);
        expect(c.size).toBe(2);
        expect(c.get('harina')).toBeCloseTo(0.1, 3);
        expect(c.get('queso')).toBeCloseTo(0.05, 3);
    });

    it('quantity ≤ 0 o no finita se ignora (defensivo)', () => {
        const recipes = new Map([['rec-arepa', recipeArepa]]);
        const orders = [
            { items: [
                { quantity: 0,        menuItem: { recipeId: 'rec-arepa' } },
                { quantity: -3,       menuItem: { recipeId: 'rec-arepa' } },
                { quantity: NaN,      menuItem: { recipeId: 'rec-arepa' } },
                { quantity: Infinity, menuItem: { recipeId: 'rec-arepa' } },
                { quantity: 2,        menuItem: { recipeId: 'rec-arepa' } },
            ] },
        ];
        const c = computeConsumptionFromOrders(orders, recipes);
        expect(c.get('harina')).toBeCloseTo(0.2, 3);
        expect(c.get('queso')).toBeCloseTo(0.1, 3);
    });

    it('lista vacía de órdenes → map vacío', () => {
        const c = computeConsumptionFromOrders([], new Map());
        expect(c.size).toBe(0);
    });

    it('modificador con receta vinculada suma su consumo × cantidad de la línea', () => {
        const recipeFalafel = { ingredients: [{ ingredientItemId: 'masa-falafel', quantity: 2 }] };
        const recipes = new Map([
            ['rec-arepa', recipeArepa],
            ['rec-falafel', recipeFalafel],
        ]);
        const orders = [
            { items: [
                {
                    quantity: 3, // 3 arepas, cada una con +falafel
                    menuItem: { recipeId: 'rec-arepa' },
                    modifiers: [
                        { modifier: { linkedMenuItem: { recipeId: 'rec-falafel' } } },
                        { modifier: { linkedMenuItem: { recipeId: null } } },  // sin receta → no suma
                        { modifier: null },                                      // huérfano → no rompe
                        null,                                                    // defensivo
                    ],
                },
            ] },
        ];
        const c = computeConsumptionFromOrders(orders, recipes);
        expect(c.get('harina')).toBeCloseTo(0.3, 3);        // receta principal
        expect(c.get('masa-falafel')).toBeCloseTo(6, 3);    // 2 × 3 líneas
    });

    it('collectReferencedRecipeIds incluye recetas de modificadores', () => {
        const ids = collectReferencedRecipeIds([
            { items: [
                {
                    quantity: 1,
                    menuItem: { recipeId: 'a' },
                    modifiers: [{ modifier: { linkedMenuItem: { recipeId: 'mod-b' } } }],
                },
            ] },
        ]);
        expect(ids.sort()).toEqual(['a', 'mod-b']);
    });

    it('ingrediente con quantity 0 en receta no se suma', () => {
        const recipes = new Map([['rec-x', {
            ingredients: [
                { ingredientItemId: 'sal', quantity: 0 },    // bug en receta — defensivo
                { ingredientItemId: 'arroz', quantity: 0.2 },
            ],
        }]]);
        const c = computeConsumptionFromOrders(
            [{ items: [{ quantity: 3, menuItem: { recipeId: 'rec-x' } }] }],
            recipes,
        );
        expect(c.has('sal')).toBe(false);
        expect(c.get('arroz')).toBeCloseTo(0.6, 3);
    });
});

describe('collectReferencedRecipeIds', () => {
    it('devuelve recipeIds únicos referenciados (para batch fetch)', () => {
        const ids = collectReferencedRecipeIds([
            { items: [
                { quantity: 1, menuItem: { recipeId: 'a' } },
                { quantity: 2, menuItem: { recipeId: 'b' } },
            ] },
            { items: [
                { quantity: 3, menuItem: { recipeId: 'a' } },   // dup
                { quantity: 4, menuItem: { recipeId: 'c' } },
            ] },
        ]);
        expect(ids.sort()).toEqual(['a', 'b', 'c']);
    });

    it('ignora items con qty 0 o sin receta', () => {
        const ids = collectReferencedRecipeIds([
            { items: [
                { quantity: 0, menuItem: { recipeId: 'a' } },
                { quantity: 1, menuItem: { recipeId: null } },
                { quantity: 1, menuItem: null },
                { quantity: 2, menuItem: { recipeId: 'b' } },
            ] },
        ]);
        expect(ids).toEqual(['b']);
    });
});
