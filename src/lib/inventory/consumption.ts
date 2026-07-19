/**
 * Cálculo de consumo teórico de insumos a partir de órdenes del POS.
 *
 * Extraída como función pura desde `syncSalesFromOrdersAction` para:
 *   - Hacerla testeable sin Prisma.
 *   - Evitar el N+1 query: el caller batch-fetchea las recetas una vez y
 *     se las pasa como `Map<recipeId, RecipeForConsumption>`.
 *
 * NO conoce timezone, tenant ni anulación — el filtrado de órdenes válidas
 * (no anuladas, no soft-deleted, dentro del día Caracas) es responsabilidad
 * del caller.
 */

import { expandDirectDischarge, type DirectDischargeMap } from './direct-discharge';

export interface OrderForConsumption {
    items: Array<{
        quantity: number;
        menuItem: { recipeId: string | null } | null;
        /**
         * Modificadores de la línea. El POS descuenta (§67/§80, en este
         * orden de prioridad): (1) la receta PROPIA del modificador
         * (`ingredients` directos de inventario), (2) la receta del
         * MenuItem vinculado (`linkedMenuItem.recipeId`). El consumo
         * teórico refleja lo mismo. Opcional: los callers que no incluyan
         * modifiers en su query siguen funcionando (solo receta principal).
         */
        modifiers?: Array<{
            modifier?: {
                linkedMenuItem?: { recipeId: string | null } | null;
                ingredients?: Array<{ ingredientItemId: string; quantity: number }> | null;
            } | null;
            /**
             * SIN estilo Xetux (§94): si está seteado, la fila es una exclusión
             * ("SIN Salsa de Ajo") — ese ingrediente NO se consume de la receta
             * PRINCIPAL del item. No afecta recetas de otros modificadores.
             */
            excludedIngredientItemId?: string | null;
        } | null> | null;
    }>;
}

export interface RecipeForConsumption {
    ingredients: Array<{
        ingredientItemId: string;
        quantity: number;
    }>;
}

/**
 * Suma el consumo teórico de cada insumo a partir de las órdenes y recetas.
 *
 * @returns Map<inventoryItemId, totalQuantityConsumed>. Ítems no presentes
 *          en el map = no se consumió nada de ellos según el POS.
 */
export function computeConsumptionFromOrders(
    orders: OrderForConsumption[],
    recipesById: Map<string, RecipeForConsumption>,
    // §124: sub-recetas de descarga directa (tabule). Vacío → identidad
    // (comportamiento histórico intacto). El caller lo construye y lo pasa.
    directMap: DirectDischargeMap = new Map(),
): Map<string, number> {
    const consumption = new Map<string, number>();

    const addRecipe = (recipeId: string | null | undefined, quantity: number, excluded?: Set<string>) => {
        if (!recipeId) return;
        const recipe = recipesById.get(recipeId);
        if (!recipe) return;
        // §94: exclusiones "SIN" se aplican sobre los ingredientes DIRECTOS de
        // la receta ANTES de expandir (el toggle SIN referencia el item directo,
        // no una materia prima interna de la sub-receta).
        const kept = recipe.ingredients.filter(ing => !excluded?.has(ing.ingredientItemId));
        // §124: expandir sub-recetas de descarga directa en sus insumos.
        const flat = expandDirectDischarge(
            kept.map(ing => ({ ingredientItemId: ing.ingredientItemId, quantity: ing.quantity, unit: '' })),
            directMap,
        );
        for (const ing of flat) {
            if (!Number.isFinite(ing.quantity) || ing.quantity <= 0) continue;
            const prev = consumption.get(ing.ingredientItemId) ?? 0;
            consumption.set(ing.ingredientItemId, prev + ing.quantity * quantity);
        }
    };

    for (const order of orders) {
        for (const item of order.items) {
            if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
            // §94: exclusiones "SIN X" de esta línea (solo receta principal).
            const excluded = new Set<string>();
            for (const mod of item.modifiers ?? []) {
                if (mod?.excludedIngredientItemId) excluded.add(mod.excludedIngredientItemId);
            }
            addRecipe(item.menuItem?.recipeId, item.quantity, excluded);
            // Modificadores: cada entrada es UNA selección aplicada a cada
            // unidad de la línea (mismo criterio que el descargo del POS).
            // Receta propia (§80) tiene prioridad sobre el item vinculado.
            for (const mod of item.modifiers ?? []) {
                const direct = mod?.modifier?.ingredients;
                if (direct && direct.length > 0) {
                    for (const ing of direct) {
                        if (!Number.isFinite(ing.quantity) || ing.quantity <= 0) continue;
                        const prev = consumption.get(ing.ingredientItemId) ?? 0;
                        consumption.set(ing.ingredientItemId, prev + ing.quantity * item.quantity);
                    }
                    continue;
                }
                addRecipe(mod?.modifier?.linkedMenuItem?.recipeId, item.quantity);
            }
        }
    }

    return consumption;
}

/** Extrae los recipeIds únicos referenciados por las órdenes (para batch fetch).
 *  Incluye recetas principales Y recetas de modificadores vinculados. */
export function collectReferencedRecipeIds(orders: OrderForConsumption[]): string[] {
    const set = new Set<string>();
    for (const order of orders) {
        for (const item of order.items) {
            if (!(item.quantity > 0)) continue;
            const recipeId = item.menuItem?.recipeId;
            if (recipeId) set.add(recipeId);
            for (const mod of item.modifiers ?? []) {
                const modRecipeId = mod?.modifier?.linkedMenuItem?.recipeId;
                if (modRecipeId) set.add(modRecipeId);
            }
        }
    }
    return Array.from(set);
}
