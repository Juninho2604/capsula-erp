'use server';

/**
 * §115 — Anticipos a proveedores (abonos SIN factura) y su aplicación.
 *
 * Regla de oro anti-duplicado:
 *  - Crear un anticipo = SALE efectivo (cuenta como egreso una vez).
 *  - Aplicar el anticipo a una factura = movimiento NO-efectivo: crea un
 *    AccountPayment con isCash=false (baja el saldo de la factura pero NO
 *    vuelve a contar como egreso). El efectivo ya salió al crear el anticipo.
 */

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';
import { settlePayable, applicableAdvance, advanceRemaining, round2 } from '@/lib/finance/payable-settlement';

const READ_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];
const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

export interface SupplierAdvanceData {
    id: string;
    supplierId: string;
    supplierName: string;
    amountUsd: number;
    appliedAmountUsd: number;
    remainingUsd: number;
    paymentMethod: string;
    paymentRef: string | null;
    paidAt: Date;
    status: string;
    notes: string | null;
    createdAt: Date;
}

export async function listSupplierAdvancesAction(filters?: { supplierId?: string; onlyOpen?: boolean }): Promise<{ success: boolean; data?: SupplierAdvanceData[]; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const advances = await db.supplierAdvance.findMany({
            where: {
                ...(filters?.supplierId && { supplierId: filters.supplierId }),
                ...(filters?.onlyOpen && { status: 'OPEN' }),
                status: filters?.onlyOpen ? 'OPEN' : { not: undefined },
            },
            include: { supplier: { select: { name: true } } },
            orderBy: { paidAt: 'desc' },
            take: 300,
        });
        return {
            success: true,
            data: advances.map(a => ({
                id: a.id, supplierId: a.supplierId, supplierName: a.supplier.name,
                amountUsd: a.amountUsd, appliedAmountUsd: a.appliedAmountUsd,
                remainingUsd: advanceRemaining(a.amountUsd, a.appliedAmountUsd),
                paymentMethod: a.paymentMethod, paymentRef: a.paymentRef,
                paidAt: a.paidAt, status: a.status, notes: a.notes, createdAt: a.createdAt,
            })),
        };
    } catch {
        return { success: false, error: 'Error al cargar anticipos' };
    }
}

/**
 * Crea un anticipo (efectivo que SALE ahora). Opcionalmente lo aplica de una
 * vez a una factura existente (applyToPayableId).
 */
export async function createSupplierAdvanceAction(input: {
    supplierId: string;
    amountUsd: number;
    amountBs?: number;
    exchangeRate?: number;
    paymentMethod: string;
    paymentRef?: string;
    paidAt: string;
    notes?: string;
    /** Si se pasa, aplica el anticipo a esta factura al instante. */
    applyToPayableId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos para registrar anticipos' };
    if (!input.supplierId) return { success: false, error: 'Elige el proveedor' };
    const amount = round2(input.amountUsd);
    if (!amount || amount <= 0) return { success: false, error: 'El monto debe ser mayor a 0' };
    const paidAt = new Date(input.paidAt);
    if (isNaN(paidAt.getTime())) return { success: false, error: 'Fecha inválida' };

    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, deletedAt: null }, select: { id: true, name: true } });
        if (!supplier) return { success: false, error: 'Proveedor no encontrado' };

        await db.$transaction(async (tx) => {
            const advance = await tx.supplierAdvance.create({
                data: {
                    tenantId,
                    supplierId: input.supplierId,
                    amountUsd: amount,
                    amountBs: input.amountBs ?? null,
                    exchangeRate: input.exchangeRate ?? null,
                    paymentMethod: input.paymentMethod,
                    paymentRef: input.paymentRef?.trim() || null,
                    paidAt,
                    notes: input.notes?.trim() || null,
                    createdById: session.id,
                },
            });

            // Aplicación inmediata (opcional).
            if (input.applyToPayableId) {
                const payable = await tx.accountPayable.findUnique({ where: { id: input.applyToPayableId } });
                if (payable && payable.status !== 'VOID' && payable.status !== 'PAID') {
                    const apply = applicableAdvance(amount, payable.remainingUsd);
                    if (apply > 0) {
                        await tx.accountPayment.create({
                            data: {
                                tenantId, accountPayableId: payable.id,
                                amountUsd: apply, paymentMethod: 'ANTICIPO', isCash: false,
                                supplierAdvanceId: advance.id, paidAt, createdById: session.id,
                                notes: 'Aplicación de anticipo',
                            },
                        });
                        const newPaid = round2(payable.paidAmountUsd + apply);
                        const st = settlePayable({ totalUsd: payable.totalAmountUsd, paidUsd: newPaid, retentionIvaUsd: payable.retentionIvaUsd, retentionIslrUsd: payable.retentionIslrUsd });
                        await tx.accountPayable.update({
                            where: { id: payable.id },
                            data: { paidAmountUsd: newPaid, remainingUsd: st.remainingUsd, status: st.status, ...(st.isClosed && { fullyPaidAt: new Date() }) },
                        });
                        await tx.supplierAdvance.update({
                            where: { id: advance.id },
                            data: { appliedAmountUsd: apply, status: advanceRemaining(amount, apply) <= 0.01 ? 'APPLIED' : 'OPEN' },
                        });
                    }
                }
            }
        });

        await logAudit({
            userId: session.id, userName: `${session.firstName} ${session.lastName}`,
            userRole: session.role, action: 'CREATE', entityType: 'SupplierAdvance',
            entityId: input.supplierId, description: `Anticipo a ${supplier.name}: $${amount.toFixed(2)}${input.applyToPayableId ? ' (aplicado a factura)' : ''}`,
            module: 'CONFIG',
        });
        revalidatePath('/dashboard/proveedores');
        revalidatePath('/dashboard/cuentas-pagar');
        revalidatePath('/dashboard/gastos');
        revalidatePath('/dashboard/finanzas');
        return { success: true };
    } catch (e) {
        console.error('[createSupplierAdvanceAction]', e);
        return { success: false, error: 'Error al registrar el anticipo' };
    }
}

/** Aplica un anticipo OPEN existente a una factura (movimiento no-efectivo). */
export async function applyAdvanceToPayableAction(input: {
    advanceId: string;
    payableId: string;
    amountUsd: number;
}): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
    const amount = round2(input.amountUsd);
    if (!amount || amount <= 0) return { success: false, error: 'Monto inválido' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const [advance, payable] = await Promise.all([
            db.supplierAdvance.findUnique({ where: { id: input.advanceId } }),
            db.accountPayable.findUnique({ where: { id: input.payableId } }),
        ]);
        if (!advance || advance.status === 'VOID') return { success: false, error: 'Anticipo no válido' };
        if (!payable || payable.status === 'VOID' || payable.status === 'PAID') return { success: false, error: 'Factura no válida o ya saldada' };
        if (advance.supplierId !== payable.supplierId) return { success: false, error: 'El anticipo y la factura son de proveedores distintos' };

        const advRem = advanceRemaining(advance.amountUsd, advance.appliedAmountUsd);
        const maxApply = applicableAdvance(advRem, payable.remainingUsd);
        if (amount > maxApply + 0.01) return { success: false, error: `Máximo aplicable: $${maxApply.toFixed(2)}` };

        await db.$transaction(async (tx) => {
            await tx.accountPayment.create({
                data: {
                    tenantId, accountPayableId: payable.id, amountUsd: amount,
                    paymentMethod: 'ANTICIPO', isCash: false, supplierAdvanceId: advance.id,
                    paidAt: new Date(), createdById: session.id, notes: 'Aplicación de anticipo',
                },
            });
            const newPaid = round2(payable.paidAmountUsd + amount);
            const st = settlePayable({ totalUsd: payable.totalAmountUsd, paidUsd: newPaid, retentionIvaUsd: payable.retentionIvaUsd, retentionIslrUsd: payable.retentionIslrUsd });
            await tx.accountPayable.update({
                where: { id: payable.id },
                data: { paidAmountUsd: newPaid, remainingUsd: st.remainingUsd, status: st.status, ...(st.isClosed && { fullyPaidAt: new Date() }) },
            });
            const newApplied = round2(advance.appliedAmountUsd + amount);
            await tx.supplierAdvance.update({
                where: { id: advance.id },
                data: { appliedAmountUsd: newApplied, status: advanceRemaining(advance.amountUsd, newApplied) <= 0.01 ? 'APPLIED' : 'OPEN' },
            });
        });

        await logAudit({
            userId: session.id, userName: `${session.firstName} ${session.lastName}`,
            userRole: session.role, action: 'UPDATE', entityType: 'SupplierAdvance',
            entityId: advance.id, description: `Aplicó anticipo $${amount.toFixed(2)} a factura ${payable.invoiceNumber ?? payable.id.slice(0,8)}`, module: 'CONFIG',
        });
        revalidatePath('/dashboard/cuentas-pagar');
        revalidatePath('/dashboard/proveedores');
        return { success: true };
    } catch (e) {
        console.error('[applyAdvanceToPayableAction]', e);
        return { success: false, error: 'Error al aplicar el anticipo' };
    }
}

export async function voidSupplierAdvanceAction(advanceId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'No autorizado' };
    if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
    if (!reason?.trim()) return { success: false, error: 'Indica el motivo' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const advance = await db.supplierAdvance.findUnique({ where: { id: advanceId } });
        if (!advance) return { success: false, error: 'Anticipo no encontrado' };
        if (advance.appliedAmountUsd > 0.01) return { success: false, error: 'No se puede anular: ya tiene aplicaciones. Revierte las aplicaciones primero.' };
        const res = await db.supplierAdvance.updateMany({ where: { id: advanceId, status: 'OPEN' }, data: { status: 'VOID', voidReason: reason.trim() } });
        if (res.count === 0) return { success: false, error: 'Anticipo no anulable' };
        await logAudit({
            userId: session.id, userName: `${session.firstName} ${session.lastName}`,
            userRole: session.role, action: 'VOID', entityType: 'SupplierAdvance',
            entityId: advanceId, description: `Anuló anticipo: ${reason.trim()}`, module: 'CONFIG',
        });
        revalidatePath('/dashboard/proveedores');
        return { success: true };
    } catch {
        return { success: false, error: 'Error al anular' };
    }
}
