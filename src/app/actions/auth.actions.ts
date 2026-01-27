'use server';

import prisma from '@/server/db';
import { createSession, deleteSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

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
            return { success: false, message: 'Credenciales inválidas (usuario no existe)' };
        }

        // Validación simple (en prod usar bcrypt)
        if (user.passwordHash !== password) {
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
        });

        // Redirección fuera del try-catch para que next/navigation funcione
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Error interno del servidor' };
    }

    redirect('/dashboard');
}

export async function logoutAction() {
    await deleteSession();
    redirect('/login');
}
