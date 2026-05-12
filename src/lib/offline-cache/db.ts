/**
 * IndexedDB schema y conexión para el cache offline de KPSULA POS.
 *
 * Object stores (keyed por string id):
 *   - menu       → snapshot del menú completo (id='current').
 *   - layout     → snapshot del layout de mesas/zonas (id='current').
 *   - tabs       → snapshot de mesas/tabs abiertas (id='active').
 *   - config     → flags y settings POS (id por key, ej 'exchange-rate').
 *   - cart       → carrito offline persistente por contexto (id por tabId o pickup-id).
 *
 * Cada registro tiene `cachedAt: number` (epoch ms) para mostrar
 * antigüedad en banners y decidir cuándo invalidar.
 *
 * La versión de la DB sube si cambiamos los object stores. NUNCA romper
 * compat: la migración tiene que crear stores nuevos si faltan, no borrar
 * los existentes (los meseros pueden tener datos cacheados de versiones
 * anteriores).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'kpsula-offline';
const DB_VERSION = 1;

export interface CachedRecord<T = unknown> {
    id: string;
    data: T;
    cachedAt: number;
}

export interface CartRecord {
    id: string; // tabId | `pickup-${pickupTabId}` | `delivery-${orderId}`
    items: unknown[];
    metadata?: Record<string, unknown>;
    updatedAt: number;
}

interface KpsulaOfflineSchema extends DBSchema {
    menu: {
        key: string;
        value: CachedRecord;
    };
    layout: {
        key: string;
        value: CachedRecord;
    };
    tabs: {
        key: string;
        value: CachedRecord;
    };
    config: {
        key: string;
        value: CachedRecord;
    };
    cart: {
        key: string;
        value: CartRecord;
    };
}

let dbPromise: Promise<IDBPDatabase<KpsulaOfflineSchema>> | null = null;

/**
 * Conexión singleton al IndexedDB. La primera llamada crea/migra la DB,
 * las siguientes reusan la conexión. En SSR (no hay window/indexedDB)
 * lanza un error explícito — el cache solo se usa en cliente.
 */
export function getOfflineDB(): Promise<IDBPDatabase<KpsulaOfflineSchema>> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return Promise.reject(new Error('IndexedDB no disponible (SSR o navegador no soportado)'));
    }
    if (dbPromise) return dbPromise;

    dbPromise = openDB<KpsulaOfflineSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('menu')) db.createObjectStore('menu', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('layout')) db.createObjectStore('layout', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('tabs')) db.createObjectStore('tabs', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('cart')) db.createObjectStore('cart', { keyPath: 'id' });
        },
        blocked() {
            console.warn('[offline-cache] Una pestaña vieja bloquea el upgrade — cerrarla.');
        },
        blocking() {
            // Otra pestaña quiere upgrade — cerramos la conexión vieja.
            dbPromise = null;
        },
        terminated() {
            dbPromise = null;
        },
    });

    return dbPromise;
}

/**
 * Lectura tipada de cualquier object store con CachedRecord. Devuelve
 * undefined si nunca se cacheó.
 */
export async function readCache<T>(
    store: 'menu' | 'layout' | 'tabs' | 'config',
    id: string
): Promise<CachedRecord<T> | undefined> {
    try {
        const db = await getOfflineDB();
        return (await db.get(store, id)) as CachedRecord<T> | undefined;
    } catch {
        return undefined;
    }
}

/**
 * Escritura tipada en cualquier object store con CachedRecord. Marca
 * `cachedAt: Date.now()` automáticamente.
 */
export async function writeCache<T>(
    store: 'menu' | 'layout' | 'tabs' | 'config',
    id: string,
    data: T
): Promise<void> {
    try {
        const db = await getOfflineDB();
        await db.put(store, { id, data, cachedAt: Date.now() } as CachedRecord<T>);
    } catch (err) {
        console.warn(`[offline-cache] No se pudo escribir en ${store}/${id}:`, err);
    }
}

/**
 * Borra TODOS los caches. Usar al cerrar sesión para no dejar datos
 * cacheados de un usuario que otro mesero pudiera ver.
 */
export async function clearAllCaches(): Promise<void> {
    try {
        const db = await getOfflineDB();
        await Promise.all([
            db.clear('menu'),
            db.clear('layout'),
            db.clear('tabs'),
            db.clear('config'),
            db.clear('cart'),
        ]);
    } catch (err) {
        console.warn('[offline-cache] No se pudo limpiar:', err);
    }
}
