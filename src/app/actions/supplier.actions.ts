'use server';

/**
 * §115 — Gestión de proveedores (submódulo Finanzas). CRUD.
 * El create ya existía en purchase.actions (createSupplierAction) pero sin UI;
 * aquí se agrega update/list-con-detalle/deactivate para el submódulo.
 */

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';

const READ_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];
const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

export interface SupplierData {
    id: string;
    name: string;
    code: string | null;
    rif: string | null;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    isActive: boolean;
    /** Saldo pendiente total en cuentas por pagar activas. */
    pendingUsd: number;
    /** Saldo de anticipos sin aplicar (crédito a favor). */
    advanceBalanceUsd: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listSuppliersAction(): Promise<{ success: boolean; data?: SupplierData[]; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const suppliers = await db.supplier.findMany({
            where: { deletedAt: null },
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        });
        const ids = suppliers.map(s => s.id);
        const [payables, advances] = await Promise.all([
            db.accountPayable.findMany({
                where: { supplierId: { in: ids }, status: { notIn: ['PAID', 'VOID'] } },
                select: { supplierId: true, remainingUsd: true },
            }),
            db.supplierAdvance.findMany({
                where: { supplierId: { in: ids }, status: { in: ['OPEN'] } },
                select: { supplierId: true, amountUsd: true, appliedAmountUsd: true },
            }),
        ]);
        const pendingBy = new Map<string, number>();
        for (const p of payables) pendingBy.set(p.supplierId!, round2((pendingBy.get(p.supplierId!) ?? 0) + p.remainingUsd));
        const advBy = new Map<string, number>();
        for (const a of advances) advBy.set(a.supplierId, round2((advBy.get(a.supplierId) ?? 0) + Math.max(0, a.amountUsd - a.appliedAmountUsd)));

        return {
            success: true,
            data: suppliers.map(s => ({
                id: s.id, name: s.name, code: s.code, rif: s.rif,
                contactName: s.contactName, phone: s.phone, email: s.email,
                address: s.address, notes: s.notes, isActive: s.isActive,
                pendingUsd: pendingBy.get(s.id) ?? 0,
                advanceBalanceUsd: advBy.get(s.id) ?? 0,
            })),
        };
    } catch {
        return { success: false, error: 'Error al cargar proveedores' };
    }
}

export async function upsertSupplierAction(input: {
    id?: string;
    name: string;
    code?: string;
    rif?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
    if (!input.name.trim()) return { success: false, error: 'El nombre es requerido' };

    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const data = {
            name: input.name.trim(),
            code: input.code?.trim() || null,
            rif: input.rif?.trim() || null,
            contactName: input.contactName?.trim() || null,
            phone: input.phone?.trim() || null,
            email: input.email?.trim() || null,
            address: input.address?.trim() || null,
            notes: input.notes?.trim() || null,
        };
        let id = input.id;
        if (id) {
            const res = await db.supplier.updateMany({ where: { id, deletedAt: null }, data });
            if (res.count === 0) return { success: false, error: 'Proveedor no encontrado' };
        } else {
            const created = await db.supplier.create({ data: { tenantId, ...data } });
            id = created.id;
        }
        await logAudit({
            userId: session.id, userName: `${session.firstName} ${session.lastName}`,
            userRole: session.role, action: input.id ? 'UPDATE' : 'CREATE', entityType: 'Supplier',
            entityId: id!, description: `${input.id ? 'Editó' : 'Creó'} proveedor: ${data.name}`, module: 'CONFIG',
        });
        revalidatePath('/dashboard/proveedores');
        revalidatePath('/dashboard/compras/documentos');
        revalidatePath('/dashboard/cuentas-pagar');
        return { success: true, id };
    } catch (e) {
        console.error('[upsertSupplierAction]', e);
        return { success: false, error: 'Error al guardar el proveedor' };
    }
}

export async function setSupplierActiveAction(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const res = await db.supplier.updateMany({ where: { id, deletedAt: null }, data: { isActive } });
        if (res.count === 0) return { success: false, error: 'Proveedor no encontrado' };
        revalidatePath('/dashboard/proveedores');
        return { success: true };
    } catch {
        return { success: false, error: 'Error al actualizar' };
    }
}
