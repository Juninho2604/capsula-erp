/**
 * Tests del cache layer IndexedDB usando fake-indexeddb.
 * Cubre: round-trip de read/write, manejo de cache vacío, clearAll,
 * y carrito separado por id.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Importar después del auto-setup de fake-indexeddb.
import {
    readCache,
    writeCache,
    clearAllCaches,
    saveMenuCache,
    loadMenuCache,
    saveLayoutCache,
    loadLayoutCache,
    saveTabsCache,
    loadTabsCache,
    saveCart,
    loadCart,
    deleteCart,
    listCarts,
} from './index';

// Hack para resetear el module singleton entre tests (la conexión IDB
// se cachea). Recargamos el módulo db.ts vía vi.resetModules.
async function resetDb() {
    vi.resetModules();
    // Forzar re-creación de la DB en un nombre fresco no es trivial con
    // fake-indexeddb global; usamos clearAllCaches que limpia los stores.
    try { await clearAllCaches(); } catch { /* ignore */ }
}

describe('offline-cache db', () => {
    beforeEach(async () => {
        // @ts-expect-error — fake-indexeddb auto-setup expone esto.
        globalThis.window = { indexedDB: globalThis.indexedDB };
        await resetDb();
    });

    afterEach(() => {
        // @ts-expect-error
        delete globalThis.window;
    });

    it('writeCache + readCache roundtrip', async () => {
        await writeCache('menu', 'current', { items: ['hamburguesa', 'cerveza'] });
        const result = await readCache<{ items: string[] }>('menu', 'current');

        expect(result).toBeDefined();
        expect(result?.data.items).toEqual(['hamburguesa', 'cerveza']);
        expect(result?.cachedAt).toBeGreaterThan(0);
    });

    it('readCache devuelve undefined si no existe', async () => {
        const result = await readCache('menu', 'nonexistent');
        expect(result).toBeUndefined();
    });

    it('saveMenuCache + loadMenuCache', async () => {
        const menu = { categories: [{ id: '1', name: 'Comida' }] };
        await saveMenuCache(menu);
        const loaded = await loadMenuCache<typeof menu>();
        expect(loaded?.data).toEqual(menu);
    });

    it('saveLayoutCache + loadLayoutCache', async () => {
        const layout = { zones: [{ id: 'salon', tables: 10 }] };
        await saveLayoutCache(layout);
        const loaded = await loadLayoutCache<typeof layout>();
        expect(loaded?.data).toEqual(layout);
    });

    it('saveTabsCache + loadTabsCache', async () => {
        const tabs = [{ id: 'tab-1', tableLabel: 'Mesa 5', items: [] }];
        await saveTabsCache(tabs);
        const loaded = await loadTabsCache<typeof tabs>();
        expect(loaded?.data).toEqual(tabs);
    });

    it('carrito separado por id', async () => {
        await saveCart('tab-1', [{ name: 'Hamburguesa' }]);
        await saveCart('tab-2', [{ name: 'Cerveza' }]);

        const cart1 = await loadCart('tab-1');
        const cart2 = await loadCart('tab-2');

        expect(cart1?.items).toEqual([{ name: 'Hamburguesa' }]);
        expect(cart2?.items).toEqual([{ name: 'Cerveza' }]);
    });

    it('deleteCart elimina solo el carrito objetivo', async () => {
        await saveCart('tab-1', [{ name: 'X' }]);
        await saveCart('tab-2', [{ name: 'Y' }]);

        await deleteCart('tab-1');

        expect(await loadCart('tab-1')).toBeNull();
        expect(await loadCart('tab-2')).not.toBeNull();
    });

    it('listCarts devuelve todos', async () => {
        await saveCart('tab-1', [{ name: 'X' }]);
        await saveCart('tab-2', [{ name: 'Y' }]);

        const list = await listCarts();
        const ids = list.map((c) => c.id).sort();
        expect(ids).toEqual(['tab-1', 'tab-2']);
    });

    it('clearAllCaches vacía todos los stores', async () => {
        await saveMenuCache({ a: 1 });
        await saveLayoutCache({ b: 2 });
        await saveCart('tab-1', [{ x: 3 }]);

        await clearAllCaches();

        expect(await loadMenuCache()).toBeNull();
        expect(await loadLayoutCache()).toBeNull();
        expect(await loadCart('tab-1')).toBeNull();
    });

    it('cachedAt refleja el momento de escritura', async () => {
        const before = Date.now();
        await saveMenuCache({ x: 1 });
        const after = Date.now();
        const loaded = await loadMenuCache();
        expect(loaded?.cachedAt).toBeGreaterThanOrEqual(before);
        expect(loaded?.cachedAt).toBeLessThanOrEqual(after);
    });
});
