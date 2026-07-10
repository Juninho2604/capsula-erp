'use client';

/**
 * SIN estilo Xetux (§94) — sección del modal de producto en el POS.
 *
 * Muestra los ingredientes de la receta cuya materia prima tiene `allowSin`
 * activo (vienen en `item.sinIngredients` desde getMenuForPOSAction). Al
 * marcar "SIN X" el carrito lleva un pseudo-modificador con
 * `excludedIngredientItemId` → el insumo NO se descarga de inventario y la
 * comanda imprime "SIN X". No afecta el precio.
 */

import { Ban } from 'lucide-react';

export interface SinIngredient {
    id: string;   // InventoryItem.id
    name: string; // ej. "Salsa de Ajo"
}

export function SinIngredientsSection({
    ingredients,
    selected,
    onToggle,
}: {
    ingredients: SinIngredient[];
    /** ids de InventoryItem marcados SIN. */
    selected: string[];
    onToggle: (id: string) => void;
}) {
    if (ingredients.length === 0) return null;
    return (
        <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-alt p-3">
            <div className="mb-2 flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-capsula-ink-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Quitar ingredientes (sin)
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {ingredients.map((ing) => {
                    const active = selected.includes(ing.id);
                    return (
                        <button
                            key={ing.id}
                            type="button"
                            onClick={() => onToggle(ing.id)}
                            aria-pressed={active}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                                active
                                    ? 'border-capsula-coral bg-capsula-coral text-white'
                                    : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-coral hover:text-capsula-coral'
                            }`}
                        >
                            {active ? 'SIN ' : 'Sin '}{ing.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Convierte la selección SIN en pseudo-modificadores para el carrito. */
export function buildSinCartModifiers(
    ingredients: SinIngredient[] | undefined,
    selected: string[],
): Array<{ modifierId: null; name: string; priceAdjustment: number; excludedIngredientItemId: string }> {
    return (ingredients ?? [])
        .filter((ing) => selected.includes(ing.id))
        .map((ing) => ({
            modifierId: null,
            name: `SIN ${ing.name}`,
            priceAdjustment: 0,
            excludedIngredientItemId: ing.id,
        }));
}
