import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SECRET_KEY = process.env.JWT_SECRET || 'shanklish-super-secret-key-2024';
const key = new TextEncoder().encode(SECRET_KEY);

interface SessionPayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    // Permisos adicionales si los implementamos
}

export async function encrypt(payload: SessionPayload) {
    return await new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h') // Sesiones de 24 horas
        .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(input, key, {
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

// === UTILIDADES DE PERMISOS ===

export function hasPermission(userRole: string | undefined, requiredRoleLevel: number) {
    const roleLevels: Record<string, number> = {
        'OWNER': 100,
        'AUDITOR': 90,
        'ADMIN_MANAGER': 80,
        'OPS_MANAGER': 70,
        'HR_MANAGER': 60,
        'CHEF': 50,
        'AREA_LEAD': 40,
        'STAFF': 10
    };

    const userLevel = roleLevels[userRole || 'STAFF'] || 0;
    return userLevel >= requiredRoleLevel;
}

export const PERMISSIONS = {
    CONFIGURE_ROLES: 70, // Solo Gerentes Ops (70) hacia arriba pueden configurar roles
    APPROVE_TRANSFERS: 40, // Jefes de Área pueden aprobar (REVISAR LÓGICA DE NEGOCIO)
    VIEW_COSTS: 80, // Solo Gerentes Admin hacia arriba ven costos detallados
};
