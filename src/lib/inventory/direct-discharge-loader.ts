/**
 * §124 Fase C — Cargador del mapa de sub-recetas de "descarga directa".
 *
 * Consulta las recetas con `directDischarge = true` cuyo output está entre los
 * `seedItemIds` dados, y expande el frontier recursivamente (una sub-receta
 * directa puede contener otra), acotado por MAX_DIRECT_DEPTH.
 *
 * SEGURIDAD: si ninguna receta tiene el flag activo, `findMany` devuelve [] →
 * el mapa queda VACÍO → `expandDirectDischarge(x, mapaVacío) === x`. Por eso
 * envolver los caminos de descargo con esto es un no-op mientras nadie active
 * el flag (default false).
 *
 * server-only: usa el cliente Prisma; nunca se importa desde el cliente.
 */

import 'server-only';
import { MAX_DIRECT_DEPTH, type DirectDischargeMap } from './direct-discharge';

// Fila de receta que consumimos del findMany (el cliente se pasa como `any`
// porque conviven 3 variantes: prisma global, withTenant y tx de transacción,
// cuyos tipos generados no unifican).
interface DirectRecipeRow {
    outputItemId: string;
    outputQuantity: number;
    outputUnit: string;
    outputItem: { baseUnit: string } | null;
    ingredients: Array<{ ingredientItemId: string; quantity: number; unit: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadDirectDischargeMap(
    db: any,
    seedItemIds: Array<string | null | undefined>,
): Promise<DirectDischargeMap> {
    const map: DirectDischargeMap = new Map();
    let frontier = Array.from(new Set(seedItemIds.filter((id): id is string => Boolean(id))));
    let depth = 0;

    while (frontier.length > 0 && depth <= MAX_DIRECT_DEPTH) {
        const toLoad = frontier.filter((id) => !map.has(id));
        if (toLoad.length === 0) break;

        const recipes: DirectRecipeRow[] = await db.recipe.findMany({
            where: { outputItemId: { in: toLoad }, directDischarge: true, isActive: true },
            select: {
                outputItemId: true,
                outputQuantity: true,
                outputUnit: true,
                outputItem: { select: { baseUnit: true } },
                ingredients: { select: { ingredientItemId: true, quantity: true, unit: true } },
            },
        });

        const next: string[] = [];
        for (const r of recipes) {
            if (map.has(r.outputItemId)) continue;
            map.set(r.outputItemId, {
                outputBaseUnit: r.outputItem?.baseUnit ?? '',
                outputQuantity: Number(r.outputQuantity),
                outputUnit: r.outputUnit,
                ingredients: r.ingredients.map((i) => ({
                    ingredientItemId: i.ingredientItemId,
                    quantity: Number(i.quantity),
                    unit: i.unit,
                })),
            });
            for (const i of r.ingredients) next.push(i.ingredientItemId);
        }
        frontier = next;
        depth++;
    }

    return map;
}
