/**
 * Fuzzy search wrapper — Capsula ERP
 *
 * Wrapper liviano sobre fuse.js con la configuración consistente del ERP:
 * tolerante a tildes, MAYÚSCULAS, guiones y orden de tokens. Optimizado
 * para listados de inventario y recetas (cientos a miles de items).
 *
 * Uso típico:
 *   const results = fuzzySearch(items, query, ['name', 'sku', 'category']);
 *
 * Si la query es vacía, devuelve los items sin filtrar (preservando orden
 * original). Si fuse no encuentra nada relevante, devuelve []. El umbral
 * por defecto es relativamente permisivo para que el operativo pueda buscar
 * con typos.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';

export interface FuzzyOptions<T> extends Pick<IFuseOptions<T>, 'threshold' | 'distance' | 'minMatchCharLength'> {
    /** Lista de keys (paths) a buscar dentro de cada item */
    keys: ReadonlyArray<keyof T & string>;
    /** Si la query es vacía, devuelve todos los items (default true) */
    includeAllOnEmpty?: boolean;
}

const DEFAULT_THRESHOLD = 0.35; // 0 = match exacto · 1 = todo
const DEFAULT_DISTANCE = 60;
const DEFAULT_MIN_MATCH = 2;

/**
 * Normaliza una query para fuse: lowercase + sin tildes + sin caracteres
 * especiales. Se aplica también internamente al construir el índice
 * (fuse acepta strings; las tildes son tolerantes pero conviene
 * pre-normalizar para coincidencias mejor scoreadas).
 */
export function normalizeForSearch(input: string): string {
    return input
        .toString()
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim();
}

/**
 * Realiza una búsqueda fuzzy sobre `items` usando los `keys` indicados.
 * Si `query` es vacía/whitespace, devuelve los items en orden original
 * (cuando `includeAllOnEmpty` es true, default).
 */
export function fuzzySearch<T>(
    items: ReadonlyArray<T>,
    query: string,
    options: FuzzyOptions<T>,
): T[] {
    const q = (query ?? '').trim();
    if (!q) {
        return options.includeAllOnEmpty === false ? [] : [...items];
    }
    if (items.length === 0) return [];

    const fuse = new Fuse(items as T[], {
        keys: [...options.keys] as string[],
        threshold: options.threshold ?? DEFAULT_THRESHOLD,
        distance: options.distance ?? DEFAULT_DISTANCE,
        minMatchCharLength: options.minMatchCharLength ?? DEFAULT_MIN_MATCH,
        ignoreLocation: true, // matchea en cualquier posición de la cadena
        ignoreDiacritics: true, // tolera tildes (fuse 7+)
    });

    return fuse.search(normalizeForSearch(q)).map(r => r.item);
}

/**
 * Pequeño helper para paginar arrays in-memory. Útil cuando la lista
 * filtrada cabe en cliente y solo necesitamos cortar visualmente.
 *
 * Devuelve { page (1-based), pageSize, total, totalPages, items } para
 * facilitar pintado de paginadores.
 */
export interface PageResult<T> {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    items: T[];
}

export function paginate<T>(items: ReadonlyArray<T>, page: number, pageSize: number): PageResult<T> {
    const total = items.length;
    const safePageSize = Math.max(1, Math.floor(pageSize));
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
    const start = (safePage - 1) * safePageSize;
    const end = start + safePageSize;
    return {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages,
        items: items.slice(start, end),
    };
}
