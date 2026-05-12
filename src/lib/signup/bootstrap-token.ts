import { SignJWT, jwtVerify } from 'jose';

/**
 * Token de bootstrap post-signup.
 *
 * El form de /signup vive en `kpsula.app` (root domain), pero el dashboard
 * del tenant vive en `<slug>.kpsula.app`. La cookie `session` emitida en
 * el root NO viaja al subdomain por defecto. Para evitar shared-domain
 * cookies (riesgo cross-tenant) usamos un token JWT one-shot de 60s que
 * la ruta `/auth/bootstrap` del subdomain canjea por una `session` local.
 *
 * - Firmado con el mismo JWT_SECRET que el resto de la app.
 * - Kind explícito (`signup-bootstrap`) para que un session-JWT robado
 *   no pueda reusarse como token de bootstrap.
 * - Expira en 60s — suficiente para el redirect, corto para limitar replay.
 */

export interface BootstrapTokenPayload {
    kind: 'signup-bootstrap';
    userId: string;
    tenantId: string;
    tenantSlug: string;
}

const FALLBACK_SECRET = 'shanklish-super-secret-key-2024';

function getSecretKey(): Uint8Array {
    const envSecret = process.env.JWT_SECRET;
    if (envSecret && envSecret.length >= 32) {
        return new TextEncoder().encode(envSecret);
    }
    return new TextEncoder().encode(FALLBACK_SECRET);
}

export async function createBootstrapToken(payload: Omit<BootstrapTokenPayload, 'kind'>): Promise<string> {
    const full: BootstrapTokenPayload = { kind: 'signup-bootstrap', ...payload };
    return await new SignJWT(full as unknown as Record<string, unknown>)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('60s')
        .sign(getSecretKey());
}

export async function verifyBootstrapToken(token: string): Promise<BootstrapTokenPayload | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
        if ((payload as { kind?: string }).kind !== 'signup-bootstrap') return null;
        const userId = (payload as { userId?: unknown }).userId;
        const tenantId = (payload as { tenantId?: unknown }).tenantId;
        const tenantSlug = (payload as { tenantSlug?: unknown }).tenantSlug;
        if (typeof userId !== 'string' || typeof tenantId !== 'string' || typeof tenantSlug !== 'string') {
            return null;
        }
        return { kind: 'signup-bootstrap', userId, tenantId, tenantSlug };
    } catch {
        return null;
    }
}
