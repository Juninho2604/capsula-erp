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

    for (const order of orders) {
        for (const item of order.items) {
            if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
            const recipeId = item.menuItem?.recipeId;
            if (!recipeId) continue;
            const recipe = recipesById.get(recipeId);
            if (!recipe) continue;

            for (const ing of recipe.ingredients) {
                if (!Number.isFinite(ing.quantity) || ing.quantity <= 0) continue;
                const prev = consumption.get(ing.ingredientItemId) ?? 0;
                consumption.set(ing.ingredientItemId, prev + ing.quantity * item.quantity);
            }
        }
    }

    return consumption;
}

/** Extrae los recipeIds únicos referenciados por las órdenes (para batch fetch). */
export function collectReferencedRecipeIds(orders: OrderForConsumption[]): string[] {
    const set = new Set<string>();
    for (const order of orders) {
        for (const item of order.items) {
            const recipeId = item.menuItem?.recipeId;
            if (recipeId && item.quantity > 0) set.add(recipeId);
        }
    }
    return Array.from(set);
}
