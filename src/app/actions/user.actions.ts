'use server';

import { prisma } from '@/lib/prisma';
import { getSession, hasPermission, PERMISSIONS } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Obtiene la lista de todos los usuarios
 */
export async function getUsers() {
    const session = await getSession();

    // Validar sesión
    if (!session) {
        throw new Error('No autorizado');
    }

    // Validar permisos (Solo Gerentes o superior pueden ver lista de usuarios para config)
    // Usamos CONFIGURE_ROLES como referencia, o al menos un nivel básico de gestión
    if (!hasPermission(session.role, PERMISSIONS.CONFIGURE_ROLES)) {
        throw new Error('No tienes permisos para ver la lista de usuarios');
    }

    const users = await prisma.user.findMany({
        orderBy: {
            lastName: 'asc',
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true, // Útil para la gestión
            lastLogin: false, // No existe en schema, cuidado
        },
    });

    return users;
}

/**
 * Actualiza el rol de un usuario
 */
export async function updateUserRole(userId: string, newRole: string) {
    const session = await getSession();

    if (!session) {
        return { success: false, message: 'No autenticado' };
    }

    if (!hasPermission(session.role, PERMISSIONS.CONFIGURE_ROLES)) {
        return { success: false, message: 'No tienes permisos para cambiar roles' };
    }

    // Evitar que se cambie su propio rol para no quedarse fuera inadvertidamente,
    // o al menos advertir (aquí lo permitimos pero el frontend podría validarlo)

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { role: newRole },
        });

        revalidatePath('/dashboard/config/roles');
        return { success: true, message: 'Rol actualizado correctamente' };
    } catch (error) {
        console.error('Error updating user role:', error);
        return { success: false, message: 'Error al actualizar el rol' };
    }
}

/**
 * Activar/Desactivar usuarios (Bonus)
 */
export async function toggleUserStatus(userId: string, isActive: boolean) {
    const session = await getSession();

    if (!session) {
        return { success: false, message: 'No autenticado' };
    }

    if (!hasPermission(session.role, PERMISSIONS.CONFIGURE_ROLES)) {
        return { success: false, message: 'No tienes permisos para gestionar usuarios' };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { isActive },
        });

        revalidatePath('/dashboard/config/roles');
        return { success: true, message: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente` };
    } catch (error) {
        console.error('Error toggling user status:', error);
        return { success: false, message: 'Error al cambiar estado del usuario' };
    }
}
