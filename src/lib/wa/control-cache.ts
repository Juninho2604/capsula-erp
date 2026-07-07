/**
 * Cache in-memory (5s) del estado BOT/HUMAN por tenant+waId para el endpoint
 * /api/v1/wa/conversations/:waId/control (n8n lo consulta por cada mensaje).
 * Takeover/release lo invalidan para que el cambio de control sea inmediato.
 * Nota: cache por proceso (pm2 single instance en el VPS).
 */

const CACHE_TTL_MS = 5_000;

export interface ControlPayload {
    status: string;
    conversationId: string | null;
}

type CacheEntry = { payload: ControlPayload; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export function getControlCache(tenantId: string, waId: string): ControlPayload | null {
    const hit = cache.get(`${tenantId}:${waId}`);
    if (hit && hit.expiresAt > Date.now()) return hit.payload;
    return null;
}

export function setControlCache(tenantId: string, waId: string, payload: ControlPayload): void {
    cache.set(`${tenantId}:${waId}`, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateControlCache(tenantId: string, waId: string): void {
    cache.delete(`${tenantId}:${waId}`);
}
