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

export interface OrderForConsumption {
    items: Array<{
        quantity: number;
        menuItem: { recipeId: string | null } | null;
        /**
         * Modificadores de la línea con su receta vinculada (vía
         * MenuModifier.linkedMenuItem.recipeId). El POS descuenta la receta
         * del modificador × la cantidad de la línea (§67 pos.actions) — el
         * consumo teórico debe reflejar lo mismo. Opcional: los callers que
         * no incluyan modifiers en su query siguen funcionando (solo receta
         * principal).
         */
        modifiers?: Array<{
            modifier?: { linkedMenuItem?: { recipeId: string | null } | null } | null;
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
): Map<string, number> {
    const consumption = new Map<string, number>();

    const addRecipe = (recipeId: string | null | undefined, quantity: number) => {
        if (!recipeId) return;
        const recipe = recipesById.get(recipeId);
        if (!recipe) return;
        for (const ing of recipe.ingredients) {
            if (!Number.isFinite(ing.quantity) || ing.quantity <= 0) continue;
            const prev = consumption.get(ing.ingredientItemId) ?? 0;
            consumption.set(ing.ingredientItemId, prev + ing.quantity * quantity);
        }
    };

    for (const order of orders) {
        for (const item of order.items) {
            if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
            addRecipe(item.menuItem?.recipeId, item.quantity);
            // Modificadores: cada entrada es UNA selección aplicada a cada
            // unidad de la línea (mismo criterio que el descargo del POS).
            for (const mod of item.modifiers ?? []) {
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
