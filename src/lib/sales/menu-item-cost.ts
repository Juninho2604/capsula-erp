/**
 * Costo de MenuItem al momento de la venta (BUG #1 del DIAGNOSTICO_REPORTES).
 *
 * `SalesOrderItem.costPerUnit/costTotal/marginPerUnit/marginPercent` existen
 * en el schema desde siempre pero nunca se escribían al vender → el COGS del
 * P&L de Finanzas (que suma `items.costTotal`) daba $0. Este helper resuelve
 * el costo vigente de cada MenuItem en batch para snapshotearlo en la venta.
 *
 * Convención de costo — la MISMA que /dashboard/costos/margen
 * (`cost.actions.ts:getDishMarginsAction`): costo de receta = Σ (cantidad del
 * ingrediente × último CostHistory vigente). Primer nivel: si un ingrediente
 * es SUB_RECIPE se usa el CostHistory del semielaborado (que producción/
 * compras mantienen), no se recalcula su receta interna. Sin receta → cae a
 * `MenuItem.cost` (campo manual) o 0.
 *
 * El cálculo es PURO sobre los datos cargados (`computeCostFromRecipeRows`)
 * para poder testearlo sin Prisma; `buildMenuItemCostMap` es el wrapper que
 * hace las 2 queries batch (sin N+1).
 */

export interface MenuItemCostSourceRow {
    menuItemId: string;
    /** Costo manual del MenuItem (fallback si no hay receta). */
    manualCost: number | null;
    /** Ingredientes de la receta vinculada (vacío si no tiene receta). */
    ingredients: Array<{ quantity: number; currentCost: number | null }>;
    hasRecipe: boolean;
}

/** Función pura: resuelve costo unitario por menuItemId desde filas cargadas. */
export function computeCostFromRecipeRows(rows: MenuItemCostSourceRow[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const row of rows) {
        if (row.hasRecipe && row.ingredients.length > 0) {
            let cost = 0;
            for (const ing of row.ingredients) {
                const qty = Number(ing.quantity);
                const unitCost = Number(ing.currentCost ?? 0);
                if (Number.isFinite(qty) && Number.isFinite(unitCost) && qty > 0 && unitCost > 0) {
                    cost += qty * unitCost;
                }
            }
            out.set(row.menuItemId, Math.round(cost * 10000) / 10000);
        } else {
            const manual = Number(row.manualCost ?? 0);
            out.set(row.menuItemId, Number.isFinite(manual) && manual > 0 ? manual : 0);
        }
    }
    return out;
}

/** Margen derivado para el snapshot del SalesOrderItem. */
export function costSnapshotFields(unitPrice: number, quantity: number, costPerUnit: number) {
    const safeCost = Number.isFinite(costPerUnit) && costPerUnit > 0 ? costPerUnit : 0;
    const marginPerUnit = Math.round((unitPrice - safeCost) * 10000) / 10000;
    return {
        costPerUnit: safeCost,
        costTotal: Math.round(safeCost * quantity * 10000) / 10000,
        marginPerUnit,
        marginPercent: unitPrice > 0 ? Math.round((marginPerUnit / unitPrice) * 10000) / 100 : 0,
    };
}

/**
 * Carga batch el costo vigente de los menuItemIds dados.
 * `db` puede ser el cliente tenant-scoped (`withTenant`) o un `tx`.
 * Best-effort: ante cualquier error devuelve Map vacío (la venta NUNCA se
 * bloquea por el snapshot de costo — se loggea y queda en 0 para auditoría).
 */
export async function buildMenuItemCostMap(
    // Acepta el cliente tenant-scoped (withTenant) o un tx de transacción —
    // mismo patrón `any` que los helpers de tx en pos.actions.ts (la firma
    // estructural exacta de Prisma extendido no es expresable sin fricción).
    db: any,
    menuItemIds: string[],
): Promise<Map<string, number>> {
    try {
        const ids = Array.from(new Set(menuItemIds.filter(Boolean)));
        if (ids.length === 0) return new Map();

        const menuItems = (await db.menuItem.findMany({
            where: { id: { in: ids } },
            select: { id: true, recipeId: true, cost: true },
        })) as Array<{ id: string; recipeId: string | null; cost: number | null }>;

        const recipeIds = Array.from(new Set(menuItems.map(m => m.recipeId).filter(Boolean))) as string[];
        const recipes = recipeIds.length
            ? ((await db.recipe.findMany({
                where: { id: { in: recipeIds }, isActive: true },
                select: {
                    id: true,
                    ingredients: {
                        select: {
                            quantity: true,
                            ingredientItem: {
                                select: {
                                    costHistory: {
                                        where: { effectiveTo: null },
                                        orderBy: { effectiveFrom: 'desc' },
                                        take: 1,
                                        select: { costPerUnit: true },
                                    },
                                },
                            },
                        },
                    },
                },
            })) as Array<{
                id: string;
                ingredients: Array<{ quantity: number; ingredientItem: { costHistory: Array<{ costPerUnit: number }> } }>;
            }>)
            : [];

        const recipeMap = new Map(recipes.map(r => [r.id, r]));
        const rows: MenuItemCostSourceRow[] = menuItems.map(m => {
            const recipe = m.recipeId ? recipeMap.get(m.recipeId) : undefined;
            return {
                menuItemId: m.id,
                manualCost: m.cost,
                hasRecipe: Boolean(recipe),
                ingredients: (recipe?.ingredients ?? []).map(ing => ({
                    quantity: ing.quantity,
                    currentCost: ing.ingredientItem.costHistory[0]?.costPerUnit ?? null,
                })),
            };
        });

        return computeCostFromRecipeRows(rows);
    } catch (err) {
        console.error('[menu-item-cost] No se pudo resolver costo (snapshot quedará en 0):', err);
        return new Map();
    }
}
