'use server';

import prisma from '@/server/db';
import { createSession, deleteSession } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { redirect } from 'next/navigation';
import { logAudit } from '@/lib/audit-log';

export async function loginAction(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { success: false, message: 'Falta email o contraseña' };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return { success: false, message: 'Credenciales inválidas' };
        }

        const valid = await verifyPassword(password, user.passwordHash ?? '');
        if (!valid) {
            await logAudit({
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
                userRole: user.role,
                action: 'LOGIN',
                entityType: 'User',
                entityId: user.id,
                description: `Intento de login fallido para ${email}`,
                module: 'AUTH',
            });
            return { success: false, message: 'Credenciales inválidas' };
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
            grantedPerms: user.grantedPerms ?? null,
            revokedPerms: user.revokedPerms ?? null,
        });

        await logAudit({
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userRole: user.role,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            description: `Login exitoso: ${email}`,
            module: 'AUTH',
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
