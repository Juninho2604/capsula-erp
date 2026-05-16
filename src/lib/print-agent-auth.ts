/**
 * Auth para los endpoints `/api/print-agent/*`. El agent (daemon Node.js
 * en una PC del restaurante) se autentica con un API key.
 *
 * ── Modos de configuración ────────────────────────────────────────────────
 *
 * 1. Multi-tenant (recomendado para SaaS): `PRINT_AGENT_TENANT_KEYS` con un
 *    JSON `{ "<tenantId>": "<key>", ... }`. El server resuelve `tenantId`
 *    matcheando la key presentada contra los valores del JSON. El header
 *    `X-Tenant-Id` se IGNORA — no se acepta input del cliente para
 *    decidir a qué tenant pertenece el agent. Cada restaurante tiene su
 *    propia key.
 *
 * 2. Single-tenant legacy: `PRINT_AGENT_API_KEY` (string plana) + opcional
 *    `PRINT_AGENT_DEFAULT_TENANT_ID`. Si la key matchea, el tenant es el
 *    `PRINT_AGENT_DEFAULT_TENANT_ID` (o el fallback histórico Shanklish).
 *    Solo válido cuando hay UN tenant en producción.
 *
 * Si las dos vars están seteadas, gana la multi-tenant.
 */

const HEADER_AUTH = 'authorization';
const LEGACY_DEFAULT_TENANT_ID = 'tnt_shanklish_caracas';

export interface PrintAgentAuthResult {
    ok: boolean;
    tenantId: string;
    /** Si !ok, error específico (no exponer al cliente). */
    error?: string;
}

export function authenticatePrintAgent(req: Request): PrintAgentAuthResult {
    const auth = req.headers.get(HEADER_AUTH) ?? '';
    const presented = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';

    if (!presented) {
        return { ok: false, tenantId: '', error: 'Falta header Authorization' };
    }

    // Modo multi-tenant: lookup por valor en JSON.
    const tenantKeysRaw = process.env.PRINT_AGENT_TENANT_KEYS;
    if (tenantKeysRaw) {
        let parsed: Record<string, string>;
        try {
            parsed = JSON.parse(tenantKeysRaw);
        } catch {
            return { ok: false, tenantId: '', error: 'PRINT_AGENT_TENANT_KEYS no es JSON válido' };
        }
        for (const [tenantId, key] of Object.entries(parsed)) {
            if (typeof key === 'string' && constantTimeEqual(presented, key)) {
                return { ok: true, tenantId };
            }
        }
        return { ok: false, tenantId: '', error: 'API key inválida' };
    }

    // Modo single-tenant legacy.
    const expected = process.env.PRINT_AGENT_API_KEY;
    if (!expected) {
        return {
            ok: false,
            tenantId: '',
            error: 'Print-agent no configurado: setear PRINT_AGENT_TENANT_KEYS o PRINT_AGENT_API_KEY',
        };
    }
    if (!constantTimeEqual(presented, expected)) {
        return { ok: false, tenantId: '', error: 'API key inválida' };
    }
    const tenantId = process.env.PRINT_AGENT_DEFAULT_TENANT_ID || LEGACY_DEFAULT_TENANT_ID;
    return { ok: true, tenantId };
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
