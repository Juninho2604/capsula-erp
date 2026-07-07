/**
 * Autenticación de la API /api/v1/wa/* (consumida por n8n).
 *
 * Mismo esquema que /api/v1/delivery/*: header `x-api-key` matcheado contra
 * un JSON en env `{ "<tenantId>": "<key>" }` con comparación en tiempo
 * constante — el tenant se DERIVA de la key, el cliente nunca lo elige.
 *
 * Env: `WA_API_KEYS` (propio del módulo). Si no está definida, cae a
 * `DELIVERY_API_KEYS` para que el mismo workflow de n8n use una sola key
 * por tenant sin duplicar secretos.
 */

export interface WaAuthResult {
    ok: boolean;
    tenantId: string;
    /** Si !ok, motivo interno (loguear; nunca exponer al cliente). */
    error?: string;
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export function authenticateWaApi(req: Request): WaAuthResult {
    const presented = (req.headers.get('x-api-key') ?? '').trim();
    if (!presented) return { ok: false, tenantId: '', error: 'Header x-api-key ausente' };

    const raw = process.env.WA_API_KEYS ?? process.env.DELIVERY_API_KEYS;
    if (!raw) return { ok: false, tenantId: '', error: 'WA_API_KEYS/DELIVERY_API_KEYS no configuradas' };

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, tenantId: '', error: 'WA_API_KEYS con JSON inválido' };
    }

    for (const [tenantId, key] of Object.entries(parsed)) {
        if (typeof key === 'string' && constantTimeEqual(presented, key)) {
            return { ok: true, tenantId };
        }
    }
    return { ok: false, tenantId: '', error: 'API key inválida' };
}
