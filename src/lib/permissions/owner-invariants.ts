/**
 * Invariantes de rol OWNER — Cápsula ERP
 *
 * Reglas que se aplican antes de cualquier mutación sobre un User:
 *
 *   1. Solo un OWNER puede modificar a otro OWNER.
 *      Un ADMIN_MANAGER (o cualquier otro rol con MANAGE_USERS) NO puede tocar
 *      al dueño del sistema. Esto cierra el vector de escalada lateral.
 *
 *   2. No se puede degradar al último OWNER activo.
 *      Si solo queda un OWNER y se intenta cambiarle el rol, la operación falla.
 *      Mantiene la propiedad "siempre existe ≥1 OWNER" del sistema.
 *
 *   3. No se puede desactivar al último OWNER activo.
 *      Mismo razonamiento que la regla 2 pero para isActive=false / soft-delete.
 *
 *   4. No se puede modificar el propio rol ni el propio estado activo.
 *      Evita lockout accidental ("me bajo a CASHIER y pierdo acceso") y un
 *      vector menor de auto-elevación si en el futuro se relaja MANAGE_USERS.
 *
 * Estas reglas se aplican EN ADICIÓN al guard de permiso (MANAGE_USERS).
 * Pasar el guard de permiso es necesario pero no suficiente.
 */

import { prisma } from '@/server/db';

export type InvariantResult =
    | { ok: true }
    | { ok: false; message: string };

/** Cuenta OWNERs activos no borrados. */
async function countActiveOwners(): Promise<number> {
    return prisma.user.count({
        where: { role: 'OWNER', isActive: true, deletedAt: null },
    });
}

interface ActorContext {
    /** id del usuario que ejecuta la acción */
    actorId: string;
    /** rol del usuario que ejecuta la acción */
    actorRole: string;
}

interface TargetContext {
    /** id del usuario sobre el que se opera */
    targetId: string;
    /** rol actual del usuario en BD */
    targetRole: string;
}

/**
 * Regla 1: solo OWNER puede modificar a otro OWNER.
 * Aplica a TODAS las mutaciones (rol, permisos, password, nombre, módulos, PIN, status).
 */
export function assertCanModifyOwner(
    actor: ActorContext,
    target: TargetContext,
): InvariantResult {
    if (target.targetRole === 'OWNER' && actor.actorRole !== 'OWNER') {
        return {
            ok: false,
            message: 'Solo un OWNER puede modificar a otro OWNER.',
        };
    }
    return { ok: true };
}

/**
 * Regla 4 (rol): no se puede cambiar el propio rol.
 */
export function assertNotSelfRoleChange(
    actor: ActorContext,
    target: TargetContext,
): InvariantResult {
    if (actor.actorId === target.targetId) {
        return {
            ok: false,
            message: 'No puedes cambiar tu propio rol. Pídele a otro OWNER que lo haga.',
        };
    }
    return { ok: true };
}

/**
 * Regla 4 (estado): no se puede desactivarse a uno mismo.
 */
export function assertNotSelfDeactivate(
    actor: ActorContext,
    target: TargetContext,
    nextActive: boolean,
): InvariantResult {
    if (actor.actorId === target.targetId && nextActive === false) {
        return {
            ok: false,
            message: 'No puedes desactivar tu propia cuenta.',
        };
    }
    return { ok: true };
}

/**
 * Regla 2: no se puede degradar al último OWNER activo.
 * Solo se invoca cuando target.targetRole === 'OWNER' y newRole !== 'OWNER'.
 */
export async function assertNotLastOwnerDegrade(
    target: TargetContext,
    newRole: string,
): Promise<InvariantResult> {
    if (target.targetRole !== 'OWNER' || newRole === 'OWNER') return { ok: true };

    const activeOwners = await countActiveOwners();
    if (activeOwners <= 1) {
        return {
            ok: false,
            message: 'No se puede degradar al último OWNER activo. Promueve primero a otro usuario a OWNER.',
        };
    }
    return { ok: true };
}

/**
 * Regla 3: no se puede desactivar al último OWNER activo.
 * Solo se invoca cuando target.targetRole === 'OWNER' y nextActive === false.
 */
export async function assertNotLastOwnerDeactivate(
    target: TargetContext,
    nextActive: boolean,
): Promise<InvariantResult> {
    if (target.targetRole !== 'OWNER' || nextActive !== false) return { ok: true };

    const activeOwners = await countActiveOwners();
    if (activeOwners <= 1) {
        return {
            ok: false,
            message: 'No se puede desactivar al último OWNER activo. Promueve primero a otro usuario a OWNER.',
        };
    }
    return { ok: true };
}

/**
 * Carga el target desde BD y devuelve su rol. Lanza si no existe.
 * Centralizado aquí para que cada caller no replique el findUnique.
 */
export async function loadTargetRole(targetId: string): Promise<string | null> {
    const u = await prisma.user.findUnique({
        where: { id: targetId },
        select: { role: true, deletedAt: true },
    });
    if (!u || u.deletedAt) return null;
    return u.role;
}
