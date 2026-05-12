/**
 * Cache offline de mesas/tabs abiertas y pickup tabs.
 *
 * A diferencia del menú/layout, los tabs cambian *mucho* durante el
 * servicio. El cache es solo un snapshot del último estado *visto* por
 * el cliente — si la cajera de la mesa 5 acaba de cobrar (y otra tablet
 * con esta misma cuenta sigue offline), la otra verá la cuenta como
 * abierta hasta que sincronice.
 *
 * Por eso siempre se muestra timestamp "actualizado hace X min" cuando
 * estamos sirviendo desde cache.
 */
import { readCache, writeCache } from './db';

const KEY = 'active';

export async function saveTabsCache<T>(tabs: T): Promise<void> {
    await writeCache('tabs', KEY, tabs);
}

export async function loadTabsCache<T>(): Promise<{ data: T; cachedAt: number } | null> {
    const record = await readCache<T>('tabs', KEY);
    if (!record) return null;
    return { data: record.data, cachedAt: record.cachedAt };
}
