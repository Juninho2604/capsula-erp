'use server';

import prisma from '@/server/db';
import { createSession, deleteSession } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { redirect } from 'next/navigation';

// Hash con formato válido (saltHex:hashHex) que nunca matchea ningún password
// real. Se usa cuando el email no existe para que el PBKDF2 corra igual y el
// tiempo de respuesta no revele si el usuario está registrado.
const DUMMY_HASH = '00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
const GENERIC_LOGIN_ERROR = 'Credenciales inválidas';

export async function loginAction(prevState: any, formData: FormData) {
    // Normalizar email: trim + lowercase. Los emails son case-insensitive en
    // la práctica (estándar de la industria); solo el password mantiene case.
    const rawEmail = formData.get('email') as string;
    const email = (rawEmail ?? '').trim().toLowerCase();
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { success: false, message: 'Falta email o contraseña' };
    }

    // Rate limit: 5 intentos por (IP + email) cada 5 min. Usa la combo para
    // evitar que un atacante bloquee la cuenta de un user legítimo solo
    // martillando con el email del víctima desde otra IP.
    try {
        const ip = await getClientIp();
        const rl = await consumeRateLimit({
            key: `login:${ip}:${email}`,
            max: 5,
            windowSeconds: 300,
        });
        if (!rl.allowed) {
            return {
                success: false,
                message: `Demasiados intentos. Intenta en ${rl.retryAfterSeconds}s.`,
            };
        }
    } catch (err) {
        // Si el rate-limit store falla, NO bloquear login (degradado seguro).
        // Solo loguear para detectar el problema.
        console.error('[rate-limit] consumeRateLimit failed:', err);
    }

    try {
        // Búsqueda case-insensitive: cubre tanto emails ya normalizados a
        // lowercase como usuarios viejos guardados con mixed-case en BD.
        // findFirst en lugar de findUnique porque el unique constraint de
        // Prisma no soporta mode:'insensitive' (es a nivel DB).
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, passwordHash: true, isActive: true, allowedModules: true, grantedPerms: true, revokedPerms: true, tokenVersion: true },
        });

        // Comparar SIEMPRE contra un hash (real o dummy) para evitar enumeración
        // por timing. Si el usuario no existe el PBKDF2 corre igual y el atacante
        // no puede deducir si el email está registrado por la latencia.
        const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !valid) {
            return { success: false, message: GENERIC_LOGIN_ERROR };
        }

        if (!user.isActive) {
            return { success: false, message: 'Cuenta desactivada. Contacta al admin.' };
        }

        // Crear sesión segura. tokenVersion permite invalidar JWTs vivos
        // cuando se cambia rol/permisos/password en user.actions.
        await createSession({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            allowedModules: user.allowedModules ?? null,
            grantedPerms: user.grantedPerms ?? null,
            revokedPerms: user.revokedPerms ?? null,
            tokenVersion: user.tokenVersion,
        });

        // Retornar datos reales del usuario para que el cliente sincronice el store Zustand
        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role as import('@/types').UserRole,
            },
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Error interno del servidor' };
    }
}

export async function logoutAction() {
    await deleteSession();
    redirect('/login');
}
