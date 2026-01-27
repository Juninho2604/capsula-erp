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


// Exportar desde el archivo separado para evitar conflictos en cliente
export { hasPermission, PERMISSIONS } from './permissions';

