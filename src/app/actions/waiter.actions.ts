'use server';

import { getSession } from '@/lib/auth';
import prisma from '@/server/db';
import { hashPin, pbkdf2Hex } from './user.actions';

async function getActiveBranch() {
    return prisma.branch.findFirst({ where: { isActive: true } });
}

function validatePinFormat(pin: string): string | null {
    if (!/^\d{4,6}$/.test(pin)) {
        return 'El PIN debe tener entre 4 y 6 dígitos numéricos';
    }
    return null;
}

/**
 * Verifica si un PIN ya está siendo usado por otro mesonero activo en la misma sucursal.
 * Rehashea el candidato con cada salt existente para comparar.
 */
async function isPinDuplicate(
    pin: string,
    branchId: string,
    excludeWaiterId?: string,
): Promise<boolean> {
    const candidates = await prisma.waiter.findMany({
        where: {
            branchId,
            isActive: true,
            pin: { not: null },
            ...(excludeWaiterId ? { id: { not: excludeWaiterId } } : {}),
        },
        select: { id: true, pin: true },
    });
    for (const w of candidates) {
        if (!w.pin) continue;
        const [saltHex, hashHex] = w.pin.split(':');
        if (!saltHex || !hashHex) continue;
        const candidateHash = await pbkdf2Hex(pin, saltHex);
        if (candidateHash === hashHex) return true;
    }
    return false;
}

/** Strip pin hash and expose hasPin boolean */
function toPublic<T extends { pin?: string | null }>(w: T) {
    const { pin, ...rest } = w as T & { pin?: string | null };
    return { ...rest, hasPin: Boolean(pin) };
}

export async function getWaitersAction() {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado', data: [] };
        const branch = await getActiveBranch();
        if (!branch) return { success: false, message: 'Sin sucursal activa', data: [] };
        const waiters = await prisma.waiter.findMany({
            where: { branchId: branch.id },
            orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
        });
        return { success: true, message: 'OK', data: waiters.map(toPublic) };
    } catch {
        return { success: false, message: 'Error cargando mesoneros', data: [] };
    }
}

export async function getActiveWaitersAction() {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado', data: [] };
        const branch = await getActiveBranch();
        if (!branch) return { success: false, message: 'Sin sucursal activa', data: [] };
        const waiters = await prisma.waiter.findMany({
            where: { branchId: branch.id, isActive: true },
            orderBy: { firstName: 'asc' },
        });
        return { success: true, message: 'OK', data: waiters.map(toPublic) };
    } catch {
        return { success: false, message: 'Error cargando mesoneros', data: [] };
    }
}

export async function createWaiterAction(data: {
    firstName: string;
    lastName: string;
    pin?: string;
    isCaptain?: boolean;
}) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        const branch = await getActiveBranch();
        if (!branch) return { success: false, message: 'Sin sucursal activa' };

        let pinHash: string | null = null;
        if (data.pin && data.pin.trim() !== '') {
            const err = validatePinFormat(data.pin);
            if (err) return { success: false, message: err };
            if (await isPinDuplicate(data.pin, branch.id)) {
                return { success: false, message: 'Este PIN ya está en uso por otro mesonero activo' };
            }
            pinHash = await hashPin(data.pin);
        }

        const waiter = await prisma.waiter.create({
            data: {
                branchId: branch.id,
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
                pin: pinHash,
                isCaptain: Boolean(data.isCaptain),
            },
        });
        return { success: true, message: 'Mesonero creado', data: toPublic(waiter) };
    } catch {
        return { success: false, message: 'Error creando mesonero' };
    }
}

export async function updateWaiterAction(
    id: string,
    data: {
        firstName: string;
        lastName: string;
        pin?: string | null; // undefined = no tocar; null o '' = eliminar; "1234" = actualizar
        isCaptain?: boolean;
    },
) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const existing = await prisma.waiter.findUnique({ where: { id } });
        if (!existing) return { success: false, message: 'Mesonero no encontrado' };

        const updateData: {
            firstName: string;
            lastName: string;
            isCaptain?: boolean;
            pin?: string | null;
        } = {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
        };

        if (data.isCaptain !== undefined) {
            updateData.isCaptain = data.isCaptain;
        }

        if (data.pin === null || data.pin === '') {
            updateData.pin = null;
        } else if (typeof data.pin === 'string') {
            const err = validatePinFormat(data.pin);
            if (err) return { success: false, message: err };
            if (await isPinDuplicate(data.pin, existing.branchId, id)) {
                return { success: false, message: 'Este PIN ya está en uso por otro mesonero activo' };
            }
            updateData.pin = await hashPin(data.pin);
        }

        const waiter = await prisma.waiter.update({ where: { id }, data: updateData });
        return { success: true, message: 'Mesonero actualizado', data: toPublic(waiter) };
    } catch {
        return { success: false, message: 'Error actualizando mesonero' };
    }
}

export async function toggleWaiterActiveAction(id: string, isActive: boolean) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        await prisma.waiter.update({ where: { id }, data: { isActive } });
        return { success: true, message: isActive ? 'Mesonero activado' : 'Mesonero desactivado' };
    } catch {
        return { success: false, message: 'Error actualizando estado' };
    }
}

export async function deleteWaiterAction(id: string) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        await prisma.waiter.update({ where: { id }, data: { isActive: false } });
        return { success: true, message: 'Mesonero eliminado' };
    } catch {
        return { success: false, message: 'Error eliminando mesonero' };
    }
}

/**
 * Valida un PIN contra los mesoneros activos con PIN en la sucursal activa.
 * Retorna { waiterId, firstName, lastName, isCaptain } si hay match único.
 * Nunca expone el hash.
 * Como los PINs son únicos por sucursal (validado en create/update), a lo sumo hay un match.
 */
export async function validateWaiterPinAction(pin: string) {
    try {
        const err = validatePinFormat(pin);
        if (err) return { success: false, message: err };

        const branch = await getActiveBranch();
        if (!branch) return { success: false, message: 'Sin sucursal activa' };

        const candidates = await prisma.waiter.findMany({
            where: {
                branchId: branch.id,
                isActive: true,
                pin: { not: null },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                isCaptain: true,
                pin: true,
            },
        });

        const matches: Array<{
            waiterId: string;
            firstName: string;
            lastName: string;
            isCaptain: boolean;
        }> = [];

        for (const w of candidates) {
            if (!w.pin) continue;
            const [saltHex, hashHex] = w.pin.split(':');
            if (!saltHex || !hashHex) continue;
            const candidateHash = await pbkdf2Hex(pin, saltHex);
            if (candidateHash === hashHex) {
                matches.push({
                    waiterId: w.id,
                    firstName: w.firstName,
                    lastName: w.lastName,
                    isCaptain: w.isCaptain,
                });
            }
        }

        if (matches.length === 0) return { success: false, message: 'PIN incorrecto' };
        if (matches.length > 1) {
            return { success: false, message: 'Conflicto de PIN — contacta al administrador' };
        }
        return { success: true, message: 'PIN válido', data: matches[0] };
    } catch {
        return { success: false, message: 'Error validando PIN' };
    }
}
