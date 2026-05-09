import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
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

export async function createSession(payload: SessionPayload) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día
    const session = await encrypt(payload);

    (await cookies()).set('session', session, {
        expires,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}

export async function deleteSession() {
    (await cookies()).delete('session');
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

