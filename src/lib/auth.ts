import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Fallback degradado: si JWT_SECRET no existe o es débil, logueamos warning
// pero NO tiramos excepción (eso rompería el sitio si la env var falla en
// deploy). Producción debería SIEMPRE tener JWT_SECRET ≥ 32 chars configurado.
const FALLBACK_SECRET = 'shanklish-super-secret-key-2024';
let secretWarningEmitted = false;

function getSecretKey(): Uint8Array {
    const envSecret = process.env.JWT_SECRET;
    if (envSecret && envSecret.length >= 32) {
        return new TextEncoder().encode(envSecret);
    }
    // Path degradado — solo loguear UNA vez para no llenar logs.
    if (!secretWarningEmitted) {
        secretWarningEmitted = true;
        console.warn(
            '[auth] WARNING: JWT_SECRET missing or shorter than 32 chars. ' +
            'Falling back to hardcoded secret. Configure JWT_SECRET in Vercel ' +
            'env vars (≥32 chars) to enable production-grade signing.',
        );
    }
    return new TextEncoder().encode(FALLBACK_SECRET);
}

export interface SessionPayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    /** ID del usuario cuyo PIN fue validado como cajera activa en este terminal */
    activeCashierId?: string;
    /** Espejo de allowedModules en BD — viaja en JWT para que sidebar lo lea sin query extra */
    allowedModules?: string | null;
    /** JSON array de PERM keys adicionales concedidos al usuario */
    grantedPerms?: string | null;
    /** JSON array de PERM keys revocados del rol base del usuario */
    revokedPerms?: string | null;
    /**
     * Versión del token. Debe coincidir con User.tokenVersion en BD; al
     * cambiar rol/permisos/password se incrementa el campo en BD y los JWT
     * con versión vieja quedan inválidos. `undefined` se acepta por
     * compatibilidad con sesiones emitidas antes de PR 4.
     */
    tokenVersion?: number;
    /**
     * ID del tenant al que pertenece el usuario. Opcional para compatibilidad
     * con JWTs emitidos antes de Fase 3 — esos caen al fallback Shanklish
     * vía resolveTenantContext(). JWTs nuevos siempre lo incluyen.
     */
    tenantId?: string;
    /**
     * Slug del tenant del usuario. Viaja en el JWT para que el middleware
     * (Edge runtime, sin Prisma) pueda comparar contra el slug del host y
     * detectar cross-subdomain takeover sin hits a BD. Opcional por compat
     * con JWTs viejos — esos no son bloqueados por el middleware pero sí
     * por `resolveTenantContext()` en server-side.
     */
    tenantSlug?: string;
}

export async function encrypt(payload: SessionPayload) {
    return await new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h') // Sesiones de 24 horas
        .sign(getSecretKey());
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
    if (!input) return null;
    try {
        const { payload } = await jwtVerify(input, getSecretKey(), {
            algorithms: ['HS256'],
        });
        return payload as unknown as SessionPayload;
    } catch (error) {
        return null;
    }
}

export async function getSession() {
    const sessionCookie = (await cookies()).get('session')?.value;
    if (!sessionCookie) return null;
    return await decrypt(sessionCookie);
}

/**
 * Determina el `domain` correcto para la cookie de sesión.
 *
 * - En producción Y host bajo `kpsula.app` → `.kpsula.app` (la cookie viaja
 *   a cualquier subdominio: kpsula.app, shanklish.kpsula.app, etc.). Esto
 *   permite redirect post-login del root al subdomain sin perder sesión.
 *
 * - En dev (localhost, vercel preview, etc.) → undefined (host-only). Setear
 *   `.kpsula.app` en localhost rompe la cookie porque el browser rechaza
 *   domains que no matchean el host.
 *
 * Defensa: si por algún motivo `headers()` falla, devolvemos undefined y
 * la cookie queda host-only — comportamiento histórico que sabemos que
 * funciona. Cero downgrade a producción.
 */
async function resolveCookieDomain(): Promise<string | undefined> {
    if (process.env.NODE_ENV !== 'production') return undefined;
    try {
        const h = await headers();
        const host = (h.get('host') ?? '').split(':')[0].toLowerCase();
        if (host === 'kpsula.app' || host.endsWith('.kpsula.app')) {
            return '.kpsula.app';
        }
    } catch {
        // headers() puede fallar si createSession se llama fuera de un
        // request context. En ese caso, mejor host-only que romper.
    }
    return undefined;
}

/**
 * Flag `secure` de la cookie de sesión.
 *
 * Default: `true` en producción (comportamiento histórico, kpsula.app va
 * siempre por HTTPS). El servidor local del restaurante (ver
 * docs/LOCAL_SERVER.md) sirve a las tablets por HTTP plano dentro de la
 * LAN (http://<ip-local>), donde una cookie `secure` jamás se almacena y
 * el login queda roto. Ese despliegue setea `COOKIE_SECURE=false` en su
 * `.env` — NUNCA setear esto en el VPS público.
 */
function cookieSecureFlag(): boolean {
    if (process.env.COOKIE_SECURE === 'false') return false;
    return process.env.NODE_ENV === 'production';
}

export async function createSession(payload: SessionPayload) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día
    const session = await encrypt(payload);
    const domain = await resolveCookieDomain();

    (await cookies()).set('session', session, {
        expires,
        httpOnly: true,
        secure: cookieSecureFlag(),
        sameSite: 'lax',
        path: '/',
        ...(domain ? { domain } : {}),
    });
}

export async function deleteSession() {
    // Borramos en BOTH scopes: domain compartido (.kpsula.app) Y host-only.
    // Esto cubre sesiones creadas antes del cambio de cookie domain
    // (host-only viejas) Y sesiones nuevas (domain compartido). Sin esto,
    // un logout podría dejar la cookie vieja viva por su scope distinto.
    const domain = await resolveCookieDomain();
    const ck = await cookies();
    ck.delete('session');
    if (domain) {
        // Para borrar una cookie con domain debemos volver a setearla con
        // expiración pasada y el mismo domain. Un delete() simple no
        // alcanza si la cookie tiene domain explícito.
        ck.set('session', '', {
            expires: new Date(0),
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            domain,
        });
    }
}

/**
 * Actualiza activeCashierId en la sesión activa del terminal.
 * Llamado tras validar exitosamente el PIN de una cajera.
 */
export async function updateSessionCashier(cashierId: string) {
    const current = await getSession();
    if (!current) return;
    await createSession({ ...current, activeCashierId: cashierId });
}

// === UTILIDADES DE PERMISOS ===

// Exportar desde el archivo separado para evitar conflictos en cliente
export { hasPermission, PERMISSIONS } from './permissions';

// Exportar resolvePerms y canDo del nuevo registry granular
export { resolvePerms, canDo } from './constants/permissions-registry';

