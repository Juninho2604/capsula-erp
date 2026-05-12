/**
 * Cache offline del carrito local de cada contexto del POS.
 *
 * "Contexto" = identificador único: tabId (mesas/restaurante), pickup-XX
 * (pickup tabs), delivery-orderId. Cada uno tiene su carrito separado
 * para que el mesonero pueda manejar varias mesas en paralelo sin que
 * se mezclen ítems.
 *
 * Caso de uso clave: la mesa 25 sin WiFi — el mesero anota 5 ítems en
 * el carrito local. Cuando vuelve la señal, "Enviar a cocina" toma el
 * carrito (que NO se perdió al recargar / cerrar la app) y lo manda al
 * server. La cola de mutaciones automática es Fase 2 (no aquí).
 */
import { getOfflineDB, type CartRecord } from './db';

export async function saveCart(id: string, items: unknown[], metadata?: Record<string, unknown>): Promise<void> {
    try {
        const db = await getOfflineDB();
        const record: CartRecord = {
            id,
            items,
            metadata,
            updatedAt: Date.now(),
        };
        await db.put('cart', record);
    } catch (err) {
        console.warn(`[offline-cache] No se pudo guardar el carrito ${id}:`, err);
    }
}

export async function loadCart(id: string): Promise<CartRecord | null> {
    try {
        const db = await getOfflineDB();
        const record = await db.get('cart', id);
        return record ?? null;
    } catch {
        return null;
    }
}

export async function deleteCart(id: string): Promise<void> {
    try {
        const db = await getOfflineDB();
        await db.delete('cart', id);
    } catch (err) {
        console.warn(`[offline-cache] No se pudo borrar el carrito ${id}:`, err);
    }
}

export async function listCarts(): Promise<CartRecord[]> {
    try {
        const db = await getOfflineDB();
        return await db.getAll('cart');
    } catch {
        return [];
    }
}
