/**
 * Auth de la API pública de delivery (`/api/v1/delivery/*`) que consume n8n.
 *
 * El bot se autentica con una API key por tenant en el header `X-API-Key`.
 * Resolvemos el tenantId matcheando la key contra el JSON `DELIVERY_API_KEYS`
 * (env), con compare en tiempo constante. El cliente NO elige su tenant: se
 * deriva de la key. Mismo patrón que `print-agent-auth.ts`.
 *
 *   DELIVERY_API_KEYS = { "<tenantId>": "<key>", ... }
 *
 * Para el piloto (Poke Pok) alcanza con env. Cuando haya muchos tenants se
 * migra a keys hasheadas en BD, rotables desde la UI (ver DELIVERY_OPS_PLAN §4).
 */

const HEADER_API_KEY = 'x-api-key';

export interface DeliveryAuthResult {
    ok: boolean;
    tenantId: string;
    /** Si !ok, motivo (no exponer al cliente; loguear). */
    error?: string;
}

export function authenticateDeliveryApi(req: Request): DeliveryAuthResult {
    const presented = (req.headers.get(HEADER_API_KEY) ?? '').trim();
    if (!presented) {
        return { ok: false, tenantId: '', error: 'Falta header X-API-Key' };
    }

    const raw = process.env.DELIVERY_API_KEYS;
    if (!raw) {
        return { ok: false, tenantId: '', error: 'DELIVERY_API_KEYS no configurado' };
    }

    let parsed: Record<string, string>;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, tenantId: '', error: 'DELIVERY_API_KEYS no es JSON válido' };
    }

    for (const [tenantId, key] of Object.entries(parsed)) {
        if (typeof key === 'string' && constantTimeEqual(presented, key)) {
            return { ok: true, tenantId };
        }
    }
    return { ok: false, tenantId: '', error: 'API key inválida' };
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
