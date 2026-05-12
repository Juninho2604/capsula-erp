/**
 * Cache offline del layout del restaurante (zonas + mesas + estaciones).
 *
 * El layout cambia muy raramente (cuando el dueño reorganiza el local).
 * Cacheo agresivo. La fuente de verdad del estado de cada mesa
 * (ocupada/libre) NO va aquí — eso está en `tabs-cache.ts`.
 */
import { readCache, writeCache } from './db';

const KEY = 'current';

export async function saveLayoutCache<T>(layout: T): Promise<void> {
    await writeCache('layout', KEY, layout);
}

export async function loadLayoutCache<T>(): Promise<{ data: T; cachedAt: number } | null> {
    const record = await readCache<T>('layout', KEY);
    if (!record) return null;
    return { data: record.data, cachedAt: record.cachedAt };
}
