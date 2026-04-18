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

/**
 * Valida un PIN contra: (1) capitanes activos de la sucursal,
 * (2) usuarios OWNER/ADMIN_MANAGER/OPS_MANAGER con PIN.
 * Retorna authorizedByWaiterId o indicación de usuario autorizado.
 */
async function validateTransferPin(pin: string, branchId: string): Promise<{
    success: boolean;
    authorizedByWaiterId?: string;
    authorizedByUserId?: string;
}> {
    const err = validatePinFormat(pin);
    if (err) return { success: false };

    // 1) Capitanes de la sucursal
    const captains = await prisma.waiter.findMany({
        where: { branchId, isActive: true, isCaptain: true, pin: { not: null } },
        select: { id: true, pin: true },
    });
    for (const c of captains) {
        if (!c.pin) continue;
        const [saltHex, hashHex] = c.pin.split(':');
        if (!saltHex || !hashHex) continue;
        if ((await pbkdf2Hex(pin, saltHex)) === hashHex) {
            return { success: true, authorizedByWaiterId: c.id };
        }
    }

    // 2) Usuarios admin con PIN (OWNER / ADMIN_MANAGER / OPS_MANAGER)
    const admins = await prisma.user.findMany({
        where: {
            role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] },
            pin: { not: null },
            isActive: true,
        },
        select: { id: true, pin: true },
    });
    for (const u of admins) {
        if (!u.pin) continue;
        const [saltHex, hashHex] = u.pin.split(':');
        if (!saltHex || !hashHex) continue;
        if ((await pbkdf2Hex(pin, saltHex)) === hashHex) {
            return { success: true, authorizedByUserId: u.id };
        }
    }

    return { success: false };
}

/**
 * Transfiere una mesa de un mesonero a otro.
 * Requiere PIN de: capitán activo en la sucursal O usuario OWNER/ADMIN_MANAGER/OPS_MANAGER.
 */
export async function transferTableAction(data: {
    openTabId: string;
    fromWaiterId: string;
    toWaiterId: string;
    authPin: string;
    reason?: string;
}) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const tab = await prisma.openTab.findUnique({
            where: { id: data.openTabId },
            select: { id: true, status: true, branchId: true, waiterProfileId: true },
        });
        if (!tab) return { success: false, message: 'Cuenta no encontrada' };
        if (!['OPEN', 'PARTIALLY_PAID'].includes(tab.status)) {
            return { success: false, message: 'La cuenta no está activa' };
        }
        if (data.fromWaiterId === data.toWaiterId) {
            return { success: false, message: 'El mesonero destino debe ser diferente' };
        }

        const toWaiter = await prisma.waiter.findUnique({
            where: { id: data.toWaiterId },
            select: { id: true, isActive: true, branchId: true },
        });
        if (!toWaiter || !toWaiter.isActive || toWaiter.branchId !== tab.branchId) {
            return { success: false, message: 'Mesonero destino no válido' };
        }

        const auth = await validateTransferPin(data.authPin, tab.branchId);
        if (!auth.success) {
            return { success: false, message: 'PIN de autorización incorrecto' };
        }

        await prisma.$transaction([
            prisma.openTab.update({
                where: { id: data.openTabId },
                data: { waiterProfileId: data.toWaiterId },
            }),
            prisma.tableTransfer.create({
                data: {
                    openTabId: data.openTabId,
                    fromWaiterId: data.fromWaiterId,
                    toWaiterId: data.toWaiterId,
                    reason: data.reason || null,
                    authorizedByWaiterId: auth.authorizedByWaiterId || null,
                },
            }),
        ]);

        return { success: true, message: 'Mesa transferida correctamente' };
    } catch {
        return { success: false, message: 'Error al transferir mesa' };
    }
}

/** Alias semántico de getActiveWaitersAction para uso en el POS Mesero. */
export const getActiveWaitersForBranchAction = getActiveWaitersAction;
