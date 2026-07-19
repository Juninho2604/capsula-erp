/**
 * §124 — Expansión de sub-recetas de "descarga directa" (sin producción).
 *
 * Pedido del gerente: sub-recetas como el tabule se hacen al momento en el
 * restaurante y NADIE registra su producción. Ponerle todos los insumos del
 * tabule a cada receta de shawarma es inmantenible. Solución: la receta del
 * shawarma referencia la sub-receta "tabule", y al vender el sistema
 * **explota** esa sub-receta en sus materias primas proporcionalmente, en vez
 * de descontar stock de tabule (que nunca se produce → se iría a negativo).
 *
 * Esta es una función PURA: recibe la lista de ingredientes de una receta y un
 * mapa de las sub-recetas marcadas "descarga directa" (keyed por el
 * InventoryItem que producen), y devuelve la lista APLANADA de insumos a
 * descargar. No toca Prisma, no conoce tenant.
 *
 * ── PROPIEDAD DE SEGURIDAD (clave para integrar sin riesgo) ──────────────────
 * Si `directMap` está vacío, la salida es IDÉNTICA a la entrada (mismo
 * ingredientItemId / quantity / unit, en el mismo orden). Por eso los 4 caminos
 * de descargo pueden envolver su iteración con esta función y, mientras ninguna
 * sub-receta tenga el flag activo, el comportamiento es EXACTAMENTE el actual.
 *
 * ── Unidades ─────────────────────────────────────────────────────────────────
 * Los ingredientes de receta ya vienen normalizados a la unidad BASE del insumo
 * (§109.1). El `outputQuantity`/`outputUnit` de la sub-receta NO está
 * normalizado, así que se convierte a la base del item producido con
 * `qtyToBaseUnit`. El ratio resultante (cantidad usada ÷ rendimiento base) es
 * adimensional y escala los insumos base de la sub-receta.
 */

import { qtyToBaseUnit } from './unit-conversion';

export interface FlatIngredient {
    ingredientItemId: string;
    quantity: number;
    unit: string;
}

export interface DirectSubRecipe {
    /** baseUnit del InventoryItem que esta sub-receta produce (su output). */
    outputBaseUnit: string;
    /** outputQuantity / outputUnit tal como están guardados (sin normalizar). */
    outputQuantity: number;
    outputUnit: string;
    /** Ingredientes de la sub-receta (ya normalizados a base por §109.1). */
    ingredients: FlatIngredient[];
}

/**
 * Sub-recetas de descarga directa, keyed por el `InventoryItem` que producen
 * (ese id es el que aparece como `ingredientItemId` en la receta padre).
 */
export type DirectDischargeMap = Map<string, DirectSubRecipe>;

/** Tope de anidamiento (sub-receta directa que contiene otra). Backstop. */
export const MAX_DIRECT_DEPTH = 6;

/**
 * Expande los ingredientes que sean sub-recetas de descarga directa en sus
 * materias primas (proporcional + recursivo). Los demás se devuelven intactos.
 *
 * @param ingredients  ingredientes de la receta (quantity en unidad base).
 * @param directMap    sub-recetas con flag directo (vacío = no-op / identidad).
 */
export function expandDirectDischarge(
    ingredients: FlatIngredient[],
    directMap: DirectDischargeMap,
    _depth = 0,
    _stack: ReadonlySet<string> = new Set(),
): FlatIngredient[] {
    const out: FlatIngredient[] = [];

    for (const ing of ingredients) {
        const sub = directMap.get(ing.ingredientItemId);
        const expandable =
            sub !== undefined &&
            _depth < MAX_DIRECT_DEPTH &&
            !_stack.has(ing.ingredientItemId) &&
            Number.isFinite(ing.quantity) &&
            ing.quantity > 0;

        if (!expandable) {
            // Insumo hoja, o sub-receta producida normalmente, o guardas
            // (ciclo / profundidad / cantidad no positiva) → tal cual.
            out.push(ing);
            continue;
        }

        // Rendimiento de la sub-receta en la unidad base del item producido.
        const outBase = qtyToBaseUnit(sub!.outputQuantity, sub!.outputUnit, sub!.outputBaseUnit).quantity;
        if (!Number.isFinite(outBase) || outBase <= 0) {
            // No se puede escalar con seguridad (rendimiento 0/ inválido) →
            // fallback legacy: descuenta el stock de la sub-receta tal cual.
            out.push(ing);
            continue;
        }

        const ratio = ing.quantity / outBase;
        const nextStack = new Set(_stack);
        nextStack.add(ing.ingredientItemId);

        const scaled: FlatIngredient[] = sub!.ingredients.map((si) => ({
            ingredientItemId: si.ingredientItemId,
            quantity: si.quantity * ratio,
            unit: si.unit,
        }));

        // Recursión: una sub-receta directa puede contener otra.
        out.push(...expandDirectDischarge(scaled, directMap, _depth + 1, nextStack));
    }

    return out;
}
