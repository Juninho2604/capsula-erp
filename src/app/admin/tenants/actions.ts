'use server';

/**
 * Acciones SUPER_ADMIN sobre tenants.
 *
 * Suspender = `User.isActive=false` para todos los users del tenant +
 *             `tokenVersion += 1` para invalidar JWTs vivos.
 * Reactivar = `User.isActive=true` para todos los users del tenant.
 *             (No revertimos tokenVersion — los users tendrán que loguearse
 *             de nuevo, que es el comportamiento esperado tras suspensión.)
 *
 * No tocamos schema (no hay `Tenant.isActive`). El efecto práctico de
 * suspender es: nadie puede loguearse a ese tenant; las sesiones existentes
 * dejan de ser válidas porque tokenVersion ya no matchea.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import { revalidatePath } from 'next/cache';

export interface AdminActionState {
    success: boolean;
    message: string;
}

async function requireSuperAdmin(): Promise<{ ok: true } | { ok: false; state: AdminActionState }> {
    const session = await getSession();
    if (!session || !isSuperAdmin(session.email)) {
        return {
            ok: false,
            state: { success: false, message: 'No autorizado.' },
        };
    }
    return { ok: true };
}

export async function suspendTenantAction(tenantId: string): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    if (!tenantId || typeof tenantId !== 'string') {
        return { success: false, message: 'tenantId inválido.' };
    }

    try {
        const res = await prisma.user.updateMany({
            where: { tenantId, isActive: true },
            data: {
                isActive: false,
                tokenVersion: { increment: 1 },
            },
        });
        revalidatePath('/admin/tenants');
        return {
            success: true,
            message: `Tenant suspendido. ${res.count} usuario(s) desactivado(s).`,
        };
    } catch (err) {
        console.error('[suspendTenantAction]', err);
        return { success: false, message: 'Error al suspender el tenant.' };
    }
}

export async function reactivateTenantAction(tenantId: string): Promise<AdminActionState> {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.state;

    if (!tenantId || typeof tenantId !== 'string') {
        return { success: false, message: 'tenantId inválido.' };
    }

    try {
        const res = await prisma.user.updateMany({
            where: { tenantId, isActive: false },
            data: { isActive: true },
        });
        revalidatePath('/admin/tenants');
        return {
            success: true,
            message: `Tenant reactivado. ${res.count} usuario(s) habilitado(s).`,
        };
    } catch (err) {
        console.error('[reactivateTenantAction]', err);
        return { success: false, message: 'Error al reactivar el tenant.' };
    }
}
