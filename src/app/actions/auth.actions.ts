'use server';

import prisma from '@/server/db';
import { createSession, deleteSession } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { redirect } from 'next/navigation';

export async function loginAction(prevState: any, formData: FormData) {
    // Normalizar email: trim + lowercase. Los emails son case-insensitive en
    // la práctica (estándar de la industria); solo el password mantiene case.
    const rawEmail = formData.get('email') as string;
    const email = (rawEmail ?? '').trim().toLowerCase();
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { success: false, message: 'Falta email o contraseña' };
    }

    try {
        // Búsqueda case-insensitive: cubre tanto emails ya normalizados a
        // lowercase como usuarios viejos guardados con mixed-case en BD.
        // findFirst en lugar de findUnique porque el unique constraint de
        // Prisma no soporta mode:'insensitive' (es a nivel DB).
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, passwordHash: true, isActive: true, allowedModules: true, grantedPerms: true, revokedPerms: true },
        });

        if (!user) {
            return { success: false, message: 'Credenciales inválidas (usuario no existe)' };
        }

        const valid = await verifyPassword(password, user.passwordHash ?? '');
        if (!valid) {
            return { success: false, message: 'Contraseña incorrecta' };
        }

        if (!user.isActive) {
            return { success: false, message: 'Cuenta desactivada. Contacta al admin.' };
        }

        // Crear sesión segura
        await createSession({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            allowedModules: user.allowedModules ?? null,
            grantedPerms: user.grantedPerms ?? null,
            revokedPerms: user.revokedPerms ?? null,
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
