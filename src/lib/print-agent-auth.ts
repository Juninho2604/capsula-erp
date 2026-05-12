/**
 * Auth para los endpoints `/api/print-agent/*`. El agent (daemon Node.js
 * en una PC del restaurante) se autentica con un API key compartido
 * `PRINT_AGENT_API_KEY` que vive en env del servidor y en el `.env`
 * local del agent.
 *
 * No usamos JWT/cookies porque el agent no tiene sesión de usuario —
 * actúa como sistema. Una sola clave por tenant es suficiente; si
 * fuera multi-tenant, sería `PRINT_AGENT_API_KEY__<tenantSlug>` y el
 * agent envía además `X-Tenant-Slug`.
 *
 * Para el primer release (single-tenant) hay una sola clave global.
 * Cuando se active multi-tenant, esto se expande.
 */

const HEADER_AUTH = 'authorization';
const HEADER_TENANT = 'x-tenant-id';
const DEFAULT_TENANT_ID = 'tnt_shanklish_caracas';

export interface PrintAgentAuthResult {
    ok: boolean;
    tenantId: string;
    /** Si !ok, error específico (no exponer al cliente). */
    error?: string;
}

export function authenticatePrintAgent(req: Request): PrintAgentAuthResult {
    const expected = process.env.PRINT_AGENT_API_KEY;
    if (!expected) {
        return {
            ok: false,
            tenantId: '',
            error: 'PRINT_AGENT_API_KEY no configurado en el servidor',
        };
    }

    const auth = req.headers.get(HEADER_AUTH) ?? '';
    const presented = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';

    if (!presented) {
        return { ok: false, tenantId: '', error: 'Falta header Authorization' };
    }

    // Comparación constant-time para evitar timing attacks.
    if (!constantTimeEqual(presented, expected)) {
        return { ok: false, tenantId: '', error: 'API key inválida' };
    }

    const tenantId = req.headers.get(HEADER_TENANT) ?? DEFAULT_TENANT_ID;
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
