/**
 * Listas de precios por canal (§86) — lógica PURA (sin Prisma).
 *
 * Un tenant puede tener varias PriceList. Cada una:
 *   - cubre uno o más canales (RESTAURANT/DELIVERY/WINK/PEDIDOSYA/PICKUP),
 *   - está activa o no,
 *   - tiene una priority para desempatar.
 *
 * Para un canal dado, gana la lista ACTIVA de mayor priority que lo cubre
 * (empate → updatedAt más reciente). Los items con override en esa lista usan
 * su precio; el resto cae al precio base del MenuItem.
 *
 * El caller (server) filtra activas/no borradas y parsea `channels` (JSON)
 * antes de pasar los objetos acá.
 */

export const PRICE_LIST_CHANNELS = [
    { key: 'RESTAURANT', label: 'Restaurante / Mesas' },
    { key: 'DELIVERY', label: 'Delivery' },
    { key: 'WINK', label: 'WINK' },
    { key: 'PEDIDOSYA', label: 'PedidosYa' },
    { key: 'PICKUP', label: 'Pickup' },
] as const;

export type PriceListChannel = typeof PRICE_LIST_CHANNELS[number]['key'];

const CHANNEL_KEYS = new Set(PRICE_LIST_CHANNELS.map(c => c.key));

export function isPriceListChannel(x: unknown): x is PriceListChannel {
    return typeof x === 'string' && CHANNEL_KEYS.has(x as PriceListChannel);
}

/** Parsea el campo `channels` (JSON array) a keys válidas, tolerante a basura. */
export function parseChannels(json: string | null | undefined): PriceListChannel[] {
    if (!json) return [];
    try {
        const arr = JSON.parse(json);
        if (!Array.isArray(arr)) return [];
        return arr.filter(isPriceListChannel);
    } catch {
        return [];
    }
}

export interface PriceListForResolve {
    id: string;
    channels: PriceListChannel[];
    priority: number;
    updatedAtMs: number;
    items: Array<{ menuItemId: string; price: number }>;
}

/** Elige la lista ganadora para un canal (o null si ninguna lo cubre). */
export function pickListForChannel(
    lists: PriceListForResolve[],
    channel: PriceListChannel,
): PriceListForResolve | null {
    const candidates = lists.filter(l => l.channels.includes(channel));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) =>
        b.priority - a.priority || b.updatedAtMs - a.updatedAtMs);
    return candidates[0];
}

/**
 * Mapa menuItemId → precio override de la lista ganadora del canal. Items no
 * presentes = sin override (usar precio base). Precios ≤0 o no finitos se
 * ignoran (defensivo: nunca poner un item en 0 por un dato malo).
 */
export function channelPriceMap(
    lists: PriceListForResolve[],
    channel: PriceListChannel,
): Map<string, number> {
    const list = pickListForChannel(lists, channel);
    const map = new Map<string, number>();
    if (!list) return map;
    for (const it of list.items) {
        if (Number.isFinite(it.price) && it.price > 0) {
            map.set(it.menuItemId, it.price);
        }
    }
    return map;
}
