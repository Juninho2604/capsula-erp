'use server';

import { getSession } from '@/lib/auth';
import prisma from '@/server/db';
import { pbkdf2Hex } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

async function getActiveBranch() {
    return prisma.branch.findFirst({ where: { isActive: true } });
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
        return { success: true, message: 'OK', data: waiters };
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
        return { success: true, message: 'OK', data: waiters };
    } catch {
        return { success: false, message: 'Error cargando mesoneros', data: [] };
    }
}

export async function createWaiterAction(data: { firstName: string; lastName: string }) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        const branch = await getActiveBranch();
        if (!branch) return { success: false, message: 'Sin sucursal activa' };
        const waiter = await prisma.waiter.create({
            data: {
                branchId: branch.id,
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
            },
        });
        return { success: true, message: 'Mesonero creado', data: waiter };
    } catch {
        return { success: false, message: 'Error creando mesonero' };
    }
}

export async function updateWaiterAction(id: string, data: { firstName: string; lastName: string }) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        const waiter = await prisma.waiter.update({
            where: { id },
            data: { firstName: data.firstName.trim(), lastName: data.lastName.trim() },
        });
        return { success: true, message: 'Mesonero actualizado', data: waiter };
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

// ============================================================================
// MESONEROS ACTIVOS PARA SUCURSAL (pantalla de identificación PIN)
// ============================================================================

export async function getActiveWaitersForBranchAction() {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autenticado', data: [] };

        const branch = await getActiveBranch();
        if (!branch) return { success: false, message: 'Sin sucursal activa', data: [] };

        const waiters = await prisma.waiter.findMany({
            where: { branchId: branch.id, isActive: true },
            select: { id: true, firstName: true, lastName: true, pin: true, isCaptain: true },
            orderBy: { firstName: 'asc' },
        });

        return {
            success: true,
            message: 'OK',
            data: waiters.map((w) => ({
                id: w.id,
                firstName: w.firstName,
                lastName: w.lastName,
                hasPin: !!w.pin,
                isCaptain: w.isCaptain,
            })),
        };
    } catch (error) {
        console.error('[getActiveWaitersForBranch]', error);
        return { success: false, message: 'Error al obtener mesoneros', data: [] };
    }
}

// ============================================================================
// VALIDACIÓN DE PIN DE MESONERO
// ============================================================================

async function verifyWaiterPin(pin: string, stored: string): Promise<boolean> {
    try {
        if (stored.includes(':')) {
            const colonIdx = stored.indexOf(':');
            const saltHex = stored.slice(0, colonIdx);
            const storedHash = stored.slice(colonIdx + 1);
            if (!saltHex || !storedHash) return false;
            const derived = await pbkdf2Hex(pin, saltHex);
            return derived === storedHash;
        }
        return pin === stored;
    } catch {
        return false;
    }
}

export async function validateWaiterPinAction(waiterId: string, pin: string) {
    try {
        if (!pin || pin.length < 4) {
            return { success: false, message: 'PIN debe tener al menos 4 dígitos' };
        }

        const waiter = await prisma.waiter.findUnique({
            where: { id: waiterId },
            select: { id: true, firstName: true, lastName: true, pin: true, isCaptain: true, isActive: true },
        });

        if (!waiter || !waiter.isActive) {
            return { success: false, message: 'Mesonero no encontrado o inactivo' };
        }

        if (!waiter.pin) {
            return { success: false, message: 'Este mesonero no tiene PIN configurado' };
        }

        const valid = await verifyWaiterPin(pin, waiter.pin);
        if (!valid) {
            return { success: false, message: 'PIN incorrecto' };
        }

        return {
            success: true,
            message: 'PIN válido',
            data: {
                id: waiter.id,
                firstName: waiter.firstName,
                lastName: waiter.lastName,
                isCaptain: waiter.isCaptain,
            },
        };
    } catch (error) {
        console.error('[validateWaiterPin]', error);
        return { success: false, message: 'Error validando PIN' };
    }
}

// ============================================================================
// TRANSFERIR MESA (solo capitanes)
// ============================================================================

export async function transferTableAction(data: {
    openTabId: string;
    toWaiterId: string;
    reason?: string;
    authPin: string;
}) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autenticado' };

        // Validar PIN del capitán que autoriza
        if (!data.authPin || data.authPin.length < 4) {
            return { success: false, message: 'PIN de autorización requerido' };
        }

        // Buscar capitanes activos en la sucursal
        const branch = await getActiveBranch();
        if (!branch) return { success: false, message: 'Sin sucursal activa' };

        const captains = await prisma.waiter.findMany({
            where: { branchId: branch.id, isActive: true, isCaptain: true, pin: { not: null } },
            select: { id: true, firstName: true, lastName: true, pin: true },
        });

        let authorizer: string | null = null;
        for (const cap of captains) {
            if (cap.pin && await verifyWaiterPin(data.authPin, cap.pin)) {
                authorizer = `${cap.firstName} ${cap.lastName}`;
                break;
            }
        }

        // Si no matchea capitán, intentar PIN gerencial (fallback)
        if (!authorizer) {
            const managers = await prisma.user.findMany({
                where: { role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] }, isActive: true, pin: { not: null } },
                select: { id: true, firstName: true, lastName: true, pin: true },
            });
            for (const mgr of managers) {
                if (mgr.pin) {
                    if (mgr.pin.includes(':')) {
                        const colonIdx = mgr.pin.indexOf(':');
                        const saltHex = mgr.pin.slice(0, colonIdx);
                        const storedHash = mgr.pin.slice(colonIdx + 1);
                        const derived = await pbkdf2Hex(data.authPin, saltHex);
                        if (derived === storedHash) {
                            authorizer = `${mgr.firstName} ${mgr.lastName}`;
                            break;
                        }
                    } else if (data.authPin === mgr.pin) {
                        authorizer = `${mgr.firstName} ${mgr.lastName}`;
                        break;
                    }
                }
            }
        }

        if (!authorizer) {
            return { success: false, message: 'PIN de autorización inválido' };
        }

        // Verificar que el mesonero destino existe y está activo
        const toWaiter = await prisma.waiter.findUnique({
            where: { id: data.toWaiterId },
            select: { id: true, firstName: true, lastName: true, isActive: true },
        });
        if (!toWaiter || !toWaiter.isActive) {
            return { success: false, message: 'Mesonero destino no encontrado o inactivo' };
        }

        // Actualizar el tab
        await prisma.openTab.update({
            where: { id: data.openTabId },
            data: {
                waiterProfileId: data.toWaiterId,
                waiterLabel: `${toWaiter.firstName} ${toWaiter.lastName}`,
            },
        });

        revalidatePath('/dashboard/pos/mesero');

        return {
            success: true,
            message: `Mesa transferida a ${toWaiter.firstName} ${toWaiter.lastName}`,
            data: { authorizer, toWaiter: `${toWaiter.firstName} ${toWaiter.lastName}` },
        };
    } catch (error) {
        console.error('[transferTable]', error);
        return { success: false, message: 'Error al transferir mesa' };
    }
}
