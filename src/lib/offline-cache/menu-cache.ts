/**
 * Cache offline del menú (categorías + ítems + modificadores + precios).
 *
 * El menú es el dataset más estable durante un servicio (cambia 0-1 veces
 * al día), así que lo cacheamos agresivamente. Cada vez que se carga online
 * actualizamos el cache. Si se pierde la red, leemos del cache hasta que
 * vuelva.
 *
 * Tipos `unknown` aquí porque el shape del menú vive en el módulo de menú
 * (pos.actions.ts) y no queremos acoplar. El consumer asegura el shape.
 */
import { readCache, writeCache } from './db';

const KEY = 'current';

export async function saveMenuCache<T>(menu: T): Promise<void> {
    await writeCache('menu', KEY, menu);
}

export async function loadMenuCache<T>(): Promise<{ data: T; cachedAt: number } | null> {
    const record = await readCache<T>('menu', KEY);
    if (!record) return null;
    return { data: record.data, cachedAt: record.cachedAt };
}
