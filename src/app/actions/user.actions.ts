'use server';

import { prisma } from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server'; // Correct path from previous files
import { getSession, createSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { revalidatePath } from 'next/cache';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import {
    assertCanModifyOwner,
    assertNotSelfRoleChange,
    assertNotSelfDeactivate,
    assertNotLastOwnerDegrade,
    assertNotLastOwnerDeactivate,
    loadTargetRole,
} from '@/lib/permissions/owner-invariants';
import { PERM } from '@/lib/constants/permissions-registry';

// ============================================================================
// HELPERS DE HASHING DE PIN  (movidos desde pos.actions.ts)
// Usa Web Crypto API — disponible en Node 18+ y en el browser.
// Formato almacenado: "saltHex:hashHex"  (PBKDF2-SHA256, 100 000 iteraciones)
// ============================================================================

function hexToUint8Array(hex: string): Uint8Array {
    const pairs = hex.match(/.{2}/g) ?? [];
    return new Uint8Array(pairs.map((b) => parseInt(b, 16)));
}

function uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function pbkdf2Hex(pin: string, saltHex: string): Promise<string> {
    const salt = hexToUint8Array(saltHex);
    const keyMaterial = await globalThis.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pin),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const hashBuf = await globalThis.crypto.subtle.deriveBits(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: 'PBKDF2', salt: salt as any, iterations: 100_000, hash: 'SHA-256' },
        keyMaterial,
        256,
    );
    return uint8ArrayToHex(new Uint8Array(hashBuf));
}

export async function hashPin(pin: string): Promise<string> {
    const saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const saltHex = uint8ArrayToHex(saltBytes);
    const hashHex = await pbkdf2Hex(pin, saltHex);
    return `${saltHex}:${hashHex}`;
}

/**
 * Obtiene la lista de todos los usuarios
 */
export async function getUsers() {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) throw new Error(guard.message);

    const users = await db.user.findMany({
        orderBy: {
            lastName: 'asc',
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            allowedModules: true,
            grantedPerms: true,
            revokedPerms: true,
            pin: true,
        },
    });

    // Mapear: exponer si el PIN está asignado sin revelar el hash
    return users.map(({ pin, ...u }) => ({ ...u, pinSet: pin !== null }));
}

/**
 * Actualiza el rol de un usuario.
 * Invariantes:
 *  - No puedes cambiar tu propio rol.
 *  - Solo un OWNER puede modificar a otro OWNER.
 *  - No se puede degradar al último OWNER activo del sistema.
 */
export async function updateUserRole(userId: string, newRole: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) return { success: false, message: guard.message };

    const targetRole = await loadTargetRole(userId);
    if (!targetRole) return { success: false, message: 'Usuario no encontrado' };

    const actor = { actorId: guard.user.id, actorRole: guard.user.role };
    const target = { targetId: userId, targetRole };

    const selfCheck = assertNotSelfRoleChange(actor, target);
    if (!selfCheck.ok) return { success: false, message: selfCheck.message };

    const ownerCheck = assertCanModifyOwner(actor, target);
    if (!ownerCheck.ok) return { success: false, message: ownerCheck.message };

    const degradeCheck = await assertNotLastOwnerDegrade(target, newRole);
    if (!degradeCheck.ok) return { success: false, message: degradeCheck.message };

    try {
        await db.user.update({
            where: { id: userId },
            data: {
                role: newRole as any, // Cast as any or import UserRole enum if available
                tokenVersion: { increment: 1 }, // Invalida JWT vivos del target
            },
        });

        revalidatePath('/dashboard/config/roles');
        return { success: true, message: 'Rol actualizado correctamente' };
    } catch (error) {
        console.error('Error updating user role:', error);
        return { success: false, message: 'Error al actualizar el rol' };
    }
}

/**
 * Activar/Desactivar usuarios.
 * Invariantes:
 *  - No puedes desactivar tu propia cuenta.
 *  - Solo un OWNER puede modificar a otro OWNER.
 *  - No se puede desactivar al último OWNER activo del sistema.
 */
export async function toggleUserStatus(userId: string, isActive: boolean) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) return { success: false, message: guard.message };

    const targetRole = await loadTargetRole(userId);
    if (!targetRole) return { success: false, message: 'Usuario no encontrado' };

    const actor = { actorId: guard.user.id, actorRole: guard.user.role };
    const target = { targetId: userId, targetRole };

    const selfCheck = assertNotSelfDeactivate(actor, target, isActive);
    if (!selfCheck.ok) return { success: false, message: selfCheck.message };

    const ownerCheck = assertCanModifyOwner(actor, target);
    if (!ownerCheck.ok) return { success: false, message: ownerCheck.message };

    const lastOwnerCheck = await assertNotLastOwnerDeactivate(target, isActive);
    if (!lastOwnerCheck.ok) return { success: false, message: lastOwnerCheck.message };

    try {
        await db.user.update({
            where: { id: userId },
            data: {
                isActive,
                // Bumpea siempre. Al desactivar invalida JWT vivos; al
                // reactivar también suma 1, sin efecto sobre sesiones (no
                // había ninguna activa porque la cuenta estaba inactiva).
                tokenVersion: { increment: 1 },
            },
        });

        revalidatePath('/dashboard/config/roles');
        return { success: true, message: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente` };
    } catch (error) {
        console.error('Error toggling user status:', error);
        return { success: false, message: 'Error al cambiar estado del usuario' };
    }
}

/**
 * Cambiar contraseña del usuario actual
 */
export async function changePasswordAction(currentPassword: string, newPassword: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const session = await getSession();

    if (!session?.id) {
        return { success: false, message: 'No autorizado' };
    }

    try {
        // 1. Obtener usuario actual
        const user = await db.user.findUnique({
            where: { id: session.id },
        });

        if (!user) {
            return { success: false, message: 'Usuario no encontrado' };
        }

        // 2. Verificar contraseña actual (retrocompatible: plain-text legacy o PBKDF2)
        const valid = await verifyPassword(currentPassword, user.passwordHash ?? '');
        if (!valid) {
            return { success: false, message: 'La contraseña actual es incorrecta' };
        }

        // 3. Validar nueva contraseña (longitud mínima)
        if (newPassword.length < 6) {
            return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' };
        }

        // 4. Actualizar contraseña con hash PBKDF2-SHA256 + bumpear
        // tokenVersion para invalidar JWTs vivos. Re-emitimos la cookie con
        // la nueva versión para que el propio usuario que cambió su password
        // NO sea expulsado. Otras sesiones del mismo user (otros dispositivos)
        // sí quedan invalidadas porque conservan el tokenVersion antiguo.
        const hashed = await hashPassword(newPassword);
        const updated = await db.user.update({
            where: { id: session.id },
            data: {
                passwordHash: hashed,
                tokenVersion: { increment: 1 },
            },
            select: { tokenVersion: true },
        });

        await createSession({ ...session, tokenVersion: updated.tokenVersion });

        return { success: true, message: 'Contraseña actualizada correctamente' };

    } catch (error) {
        console.error('Error changing password:', error);
        return { success: false, message: 'Error al cambiar la contraseña' };
    }
}

/**
 * Actualizar los módulos permitidos de un usuario específico.
 * null = sin restricción extra (acceso completo según su rol)
 * [] o [ids] = solo esos módulos (además de las restricciones de rol)
 */
export async function updateUserModules(userId: string, allowedModules: string[] | null) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) return { success: false, message: guard.message };

    const targetRole = await loadTargetRole(userId);
    if (!targetRole) return { success: false, message: 'Usuario no encontrado' };

    const ownerCheck = assertCanModifyOwner(
        { actorId: guard.user.id, actorRole: guard.user.role },
        { targetId: userId, targetRole },
    );
    if (!ownerCheck.ok) return { success: false, message: ownerCheck.message };

    try {
        await db.user.update({
            where: { id: userId },
            data: {
                allowedModules: allowedModules ? JSON.stringify(allowedModules) : null,
                tokenVersion: { increment: 1 }, // Invalida JWT vivos del target
            },
        });

        revalidatePath('/dashboard/usuarios');
        return { success: true, message: 'Módulos actualizados correctamente' };
    } catch (error) {
        console.error('Error updating user modules:', error);
        return { success: false, message: 'Error al actualizar módulos' };
    }
}

/**
 * Asigna o cambia el PIN de un usuario (solo Admin/Dueño/roles con MANAGE_USERS).
 * El PIN se hashea automáticamente con PBKDF2-SHA256 antes de guardarse.
 */
export async function updateUserPin(userId: string, rawPin: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_PINS);
    if (!guard.ok) return { success: false, message: guard.message };

    if (guard.user.id === userId) {
        return { success: false, message: 'No puedes modificar tu propio PIN desde aquí' };
    }

    const targetRole = await loadTargetRole(userId);
    if (!targetRole) return { success: false, message: 'Usuario no encontrado' };

    const ownerCheck = assertCanModifyOwner(
        { actorId: guard.user.id, actorRole: guard.user.role },
        { targetId: userId, targetRole },
    );
    if (!ownerCheck.ok) return { success: false, message: ownerCheck.message };

    const trimmed = rawPin.trim();
    if (!/^\d{4,6}$/.test(trimmed)) {
        return { success: false, message: 'El PIN debe ser numérico y tener entre 4 y 6 dígitos' };
    }

    try {
        const hashed = await hashPin(trimmed);
        await db.user.update({
            where: { id: userId },
            data: { pin: hashed },
        });

        revalidatePath('/dashboard/usuarios');
        return { success: true, message: 'PIN actualizado correctamente' };
    } catch (error) {
        console.error('Error updating user PIN:', error);
        return { success: false, message: 'Error al actualizar el PIN' };
    }
}

/**
 * Actualiza los permisos granulares adicionales (granted) y revocados (revoked) de un usuario.
 * grantedPerms y revokedPerms son arrays de PERM keys; null = sin override.
 */
export async function updateUserPerms(
    userId: string,
    grantedPerms: string[] | null,
    revokedPerms: string[] | null,
) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) return { success: false, message: guard.message };

    const targetRole = await loadTargetRole(userId);
    if (!targetRole) return { success: false, message: 'Usuario no encontrado' };

    const ownerCheck = assertCanModifyOwner(
        { actorId: guard.user.id, actorRole: guard.user.role },
        { targetId: userId, targetRole },
    );
    if (!ownerCheck.ok) return { success: false, message: ownerCheck.message };

    try {
        await db.user.update({
            where: { id: userId },
            data: {
                grantedPerms: grantedPerms && grantedPerms.length > 0 ? JSON.stringify(grantedPerms) : null,
                revokedPerms: revokedPerms && revokedPerms.length > 0 ? JSON.stringify(revokedPerms) : null,
                tokenVersion: { increment: 1 }, // Invalida JWT vivos del target
            },
        });

        revalidatePath('/dashboard/usuarios');
        return { success: true, message: 'Permisos actualizados correctamente' };
    } catch (error) {
        console.error('Error updating user perms:', error);
        return { success: false, message: 'Error al actualizar permisos' };
    }
}

/**
 * Crea un nuevo usuario en el sistema.
 * Solo roles con MANAGE_USERS pueden crear usuarios.
 * La contraseña se hashea con PBKDF2-SHA256 antes de guardarse.
 */
export async function createUserAction(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
}) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) return { success: false, message: guard.message };

    const email = data.email.trim().toLowerCase();
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();

    if (!email || !data.password || !firstName || !lastName) {
        return { success: false, message: 'Todos los campos son requeridos' };
    }

    if (data.password.length < 6) {
        return { success: false, message: 'La contraseña debe tener al menos 6 caracteres' };
    }

    // Validar email básico
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, message: 'Correo electrónico inválido' };
    }

    // Solo un OWNER puede crear otro OWNER. Cierra el vector de escalada
    // donde un ADMIN_MANAGER se promueve creando un OWNER títere.
    if (data.role === 'OWNER' && guard.user.role !== 'OWNER') {
        return { success: false, message: 'Solo un OWNER puede crear otro OWNER.' };
    }

    try {
        // Pre-Fase 2.B: findFirst en lugar de findUnique para no depender del
        // unique global sobre User.email. Mismo comportamiento mientras solo
        // hay un tenant; cuando el unique pase a (tenantId, email) habrá que
        // añadir tenantId al where.
        const existing = await db.user.findFirst({ where: { email } });
        if (existing) {
            return { success: false, message: 'Ya existe un usuario con ese correo electrónico' };
        }

        const passwordHash = await hashPassword(data.password);

        const user = await db.user.create({
            data: {
                tenantId,
                email,
                passwordHash,
                firstName,
                lastName,
                role: data.role || 'CHEF',
                isActive: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                allowedModules: true,
                grantedPerms: true,
                revokedPerms: true,
                pin: true,
            },
        });

        revalidatePath('/dashboard/usuarios');

        const { pin, ...userWithoutPin } = user;
        return {
            success: true,
            message: `Usuario ${firstName} ${lastName} creado correctamente`,
            user: { ...userWithoutPin, pinSet: pin !== null },
        };
    } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, message: 'Error al crear el usuario' };
    }
}

/**
 * Actualiza nombre, apellido y/o email de un usuario.
 * Requiere MANAGE_USERS. No puede editarse a sí mismo por esta vía.
 */
export async function updateUserNameAction(
    userId: string,
    data: { firstName: string; lastName: string; email: string },
) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) return { success: false, message: guard.message };

    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email.trim().toLowerCase();

    if (!firstName || !lastName) return { success: false, message: 'Nombre y apellido son requeridos' };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, message: 'Correo electrónico inválido' };
    }

    const targetRole = await loadTargetRole(userId);
    if (!targetRole) return { success: false, message: 'Usuario no encontrado' };

    const ownerCheck = assertCanModifyOwner(
        { actorId: guard.user.id, actorRole: guard.user.role },
        { targetId: userId, targetRole },
    );
    if (!ownerCheck.ok) return { success: false, message: ownerCheck.message };

    try {
        // Pre-Fase 2.B: findFirst para no depender del unique global. Update
        // sigue siendo por id (ese unique sí se mantiene global).
        const conflict = await db.user.findFirst({ where: { email } });
        if (conflict && conflict.id !== userId) {
            return { success: false, message: 'Ese correo ya está en uso por otro usuario' };
        }
        await db.user.update({ where: { id: userId }, data: { firstName, lastName, email } });
        revalidatePath('/dashboard/usuarios');
        return { success: true, message: 'Datos actualizados correctamente' };
    } catch {
        return { success: false, message: 'Error al actualizar los datos' };
    }
}

/**
 * Permite a OWNER o ADMIN_MANAGER resetear la contraseña de otro usuario.
 * No puede resetear la propia contraseña por esta vía (usar changePasswordAction).
 */
export async function adminResetPasswordAction(userId: string, newPassword: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const guard = await checkActionPermission(PERM.MANAGE_USERS);
    if (!guard.ok) return { success: false, message: guard.message };

    if (guard.user.id === userId) {
        return { success: false, message: 'Para cambiar tu propia contraseña usa la sección de perfil' };
    }

    const targetRole = await loadTargetRole(userId);
    if (!targetRole) return { success: false, message: 'Usuario no encontrado' };

    const ownerCheck = assertCanModifyOwner(
        { actorId: guard.user.id, actorRole: guard.user.role },
        { targetId: userId, targetRole },
    );
    if (!ownerCheck.ok) return { success: false, message: ownerCheck.message };

    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'La contraseña debe tener al menos 6 caracteres' };
    }

    try {
        const passwordHash = await hashPassword(newPassword);

        await db.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                tokenVersion: { increment: 1 }, // Invalida JWT vivos del target
            },
        });

        revalidatePath('/dashboard/usuarios');
        return { success: true, message: 'Contraseña actualizada correctamente' };
    } catch (error) {
        console.error('Error resetting password:', error);
        return { success: false, message: 'Error al actualizar la contraseña' };
    }
}
