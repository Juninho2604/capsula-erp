/**
 * Ruteo de comandas por estación física (barra vs cocina) — PURO y testeado.
 *
 * Extraído de `print-via-agent.ts` (que es 'use client' y arrastra toast +
 * server actions, intesteable en node) para poder cubrirlo con vitest.
 *
 * Reglas:
 *   - Bebidas y afines (licores, cocteles, café, jugos…) → BARRA.
 *   - Postres (cheesecake helado, Brooklyn, helados, dulces…) → salen por
 *     BARRA **y** COCINA (NOUR es el área de café y postres; la cocina también
 *     los ve). Ruteo DUAL — pedido del dueño 09/07.
 *   - Todo lo demás → COCINA.
 */

export type Station = 'bar' | 'kitchen';

/** Categorías que imprimen en la BARRA (match exacto, rápido). */
export const BAR_CATEGORIES: readonly string[] = ['Bebidas'];

/**
 * Palabras clave en el nombre de categoría que la marcan como BARRA aunque el
 * nombre exacto no esté en BAR_CATEGORIES (categorías nuevas del admin).
 */
export const BAR_KEYWORDS: readonly string[] = [
    'bebida', 'licor', 'coctel', 'cocktail', 'cerveza', 'vino', 'champana',
    'champagne', 'espumante', 'whisky', 'whiskey', 'ron', 'vodka', 'gin',
    'ginebra', 'tequila', 'aperitivo', 'destilado', 'jugo', 'refresco', 'soda',
    'agua', 'cafe', 'te', 'infusi',
];

/**
 * Palabras clave (en categoría O nombre del producto) que marcan un POSTRE de
 * ruteo DUAL (barra + cocina). Se chequean sobre categoría e ítem para cubrir
 * postres que el admin haya categorizado en otro lado. Para agregar un postre
 * nuevo al ruteo dual, sumá su palabra acá.
 */
export const DESSERT_DUAL_KEYWORDS: readonly string[] = [
    'postre', 'dessert', 'reposter', 'helado', 'cheesecake', 'brooklyn',
];

/** Normaliza: minúsculas, sin acentos. */
function normalize(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Estación primaria de una categoría (barra si es bebida, si no cocina). */
export function classifyStation(categoryName?: string | null): Station {
    if (!categoryName) return 'kitchen';
    if (BAR_CATEGORIES.includes(categoryName)) return 'bar';
    const norm = normalize(categoryName);
    for (const kw of BAR_KEYWORDS) {
        if (norm.includes(normalize(kw))) return 'bar';
    }
    return 'kitchen';
}

/** ¿Es un postre de ruteo dual (barra + cocina)? Mira categoría e ítem. */
export function isDualStationDessert(item: { name?: string; categoryName?: string | null }): boolean {
    const hay = normalize(`${item.categoryName ?? ''} ${item.name ?? ''}`);
    return DESSERT_DUAL_KEYWORDS.some(kw => hay.includes(normalize(kw)));
}

/**
 * Estaciones por las que debe salir un ítem. Postres → ['bar','kitchen'];
 * el resto → su estación primaria. Nunca vacío.
 */
export function stationsForItem(item: { name?: string; categoryName?: string | null }): Station[] {
    if (isDualStationDessert(item)) return ['bar', 'kitchen'];
    return [classifyStation(item.categoryName)];
}
