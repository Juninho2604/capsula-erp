'use server';

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';

const READ_ROLES = ['OWNER', 'ADMIN_MANAGER'];
const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER'];

export interface ReceivablePaymentData {
  id: string;
  amountUsd: number;
  method: string;
  reference: string | null;
  collectedAt: Date;
  notes: string | null;
}

export interface AccountReceivableData {
  id: string;
  description: string;
  reference: string | null;
  debtorName: string;
  totalAmountUsd: number;
  collectedAmountUsd: number;
  remainingUsd: number;
  issueDate: Date;
  dueDate: Date | null;
  fullyCollectedAt: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  payments: ReceivablePaymentData[];
}

export async function getAccountsReceivableAction(filters?: {
  status?: string;
}): Promise<{ success: boolean; data?: AccountReceivableData[]; summary?: { pendingUsd: number; overdueUsd: number; collectedUsd: number; debtors: number }; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const accounts = await db.accountReceivable.findMany({
      where: { ...(filters?.status && { status: filters.status }) },
      include: { payments: { orderBy: { collectedAt: 'asc' } } },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    const now = new Date();
    const data: AccountReceivableData[] = accounts.map((a) => {
      const overdue = a.status !== 'COLLECTED' && a.status !== 'VOID' && a.dueDate && a.dueDate < now;
      return {
        id: a.id,
        description: a.description,
        reference: a.reference,
        debtorName: a.debtorName,
        totalAmountUsd: a.totalAmountUsd,
        collectedAmountUsd: a.collectedAmountUsd,
        remainingUsd: a.remainingUsd,
        issueDate: a.issueDate,
        dueDate: a.dueDate,
        fullyCollectedAt: a.fullyCollectedAt,
        status: overdue ? 'OVERDUE' : a.status,
        notes: a.notes,
        createdAt: a.createdAt,
        payments: a.payments.map((p) => ({
          id: p.id, amountUsd: p.amountUsd, method: p.method,
          reference: p.reference, collectedAt: p.collectedAt, notes: p.notes,
        })),
      };
    });

    const active = data.filter((d) => d.status !== 'VOID' && d.status !== 'COLLECTED');
    const summary = {
      pendingUsd: Math.round(active.reduce((s, d) => s + d.remainingUsd, 0) * 100) / 100,
      overdueUsd: Math.round(data.filter((d) => d.status === 'OVERDUE').reduce((s, d) => s + d.remainingUsd, 0) * 100) / 100,
      collectedUsd: Math.round(data.reduce((s, d) => s + d.collectedAmountUsd, 0) * 100) / 100,
      debtors: new Set(active.map((d) => d.debtorName)).size,
    };

    return { success: true, data, summary };
  } catch {
    return { success: false, error: 'Error al cargar cuentas por cobrar' };
  }
}

export async function createAccountReceivableAction(input: {
  description: string;
  reference?: string;
  debtorName: string;
  totalAmountUsd: number;
  issueDate: string;
  dueDate?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  if (!input.description.trim()) return { success: false, error: 'La descripción es requerida' };
  if (!input.debtorName.trim()) return { success: false, error: 'Indicá quién debe' };
  if (!input.totalAmountUsd || input.totalAmountUsd <= 0) return { success: false, error: 'El monto debe ser mayor a 0' };
  const issueDate = new Date(input.issueDate);
  if (isNaN(issueDate.getTime())) return { success: false, error: 'Fecha inválida' };
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const r = await db.accountReceivable.create({
      data: {
        tenantId,
        description: input.description.trim(),
        reference: input.reference?.trim() || null,
        debtorName: input.debtorName.trim(),
        totalAmountUsd: input.totalAmountUsd,
        collectedAmountUsd: 0,
        remainingUsd: input.totalAmountUsd,
        issueDate,
        dueDate,
        status: 'PENDING',
        notes: input.notes?.trim() || null,
        createdById: session.id,
      },
    });
    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'CREATE', entityType: 'AccountReceivable',
      entityId: r.id, description: `Registró cuenta por cobrar: ${r.debtorName} — $${r.totalAmountUsd.toFixed(2)}`,
      module: 'CONFIG',
    });
    revalidatePath('/dashboard/cuentas-cobrar');
    return { success: true };
  } catch {
    return { success: false, error: 'Error al crear la cuenta por cobrar' };
  }
}

export async function registerCollectionAction(
  accountReceivableId: string,
  input: {
    amountUsd: number;
    amountBs?: number;
    exchangeRate?: number;
    method: string;
    reference?: string;
    bankAccountId?: string;
    collectedAt: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  if (!input.amountUsd || input.amountUsd <= 0) return { success: false, error: 'El monto debe ser mayor a 0' };
  const collectedAt = new Date(input.collectedAt);
  if (isNaN(collectedAt.getTime())) return { success: false, error: 'Fecha inválida' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const r = await db.accountReceivable.findUnique({ where: { id: accountReceivableId } });
    if (!r) return { success: false, error: 'Cuenta por cobrar no encontrada' };
    if (r.status === 'COLLECTED' || r.status === 'VOID') return { success: false, error: 'Esta cuenta ya está saldada o anulada' };
    if (input.amountUsd > r.remainingUsd + 0.01) {
      return { success: false, error: `El cobro ($${input.amountUsd}) supera el saldo ($${r.remainingUsd.toFixed(2)})` };
    }

    const newCollected = Math.round((r.collectedAmountUsd + input.amountUsd) * 100) / 100;
    const newRemaining = Math.round((r.totalAmountUsd - newCollected) * 100) / 100;
    const done = newRemaining <= 0.01;

    await db.$transaction([
      db.receivablePayment.create({
        data: {
          tenantId,
          accountReceivableId,
          amountUsd: input.amountUsd,
          amountBs: input.amountBs ?? null,
          exchangeRate: input.exchangeRate ?? null,
          method: input.method,
          reference: input.reference?.trim() || null,
          bankAccountId: input.bankAccountId || null,
          collectedAt,
          notes: input.notes?.trim() || null,
          createdById: session.id,
        },
      }),
      db.accountReceivable.update({
        where: { id: accountReceivableId },
        data: {
          collectedAmountUsd: newCollected,
          remainingUsd: Math.max(0, newRemaining),
          status: done ? 'COLLECTED' : 'PARTIAL',
          ...(done && { fullyCollectedAt: new Date() }),
        },
      }),
    ]);

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'PAYMENT', entityType: 'AccountReceivable',
      entityId: accountReceivableId, description: `Registró cobro $${input.amountUsd.toFixed(2)} de: ${r.debtorName}`,
      module: 'CONFIG',
    });
    revalidatePath('/dashboard/cuentas-cobrar');
    return { success: true };
  } catch {
    return { success: false, error: 'Error al registrar el cobro' };
  }
}

export async function voidAccountReceivableAction(
  id: string, reason: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const res = await db.accountReceivable.updateMany({
      where: { id, status: { notIn: ['VOID', 'COLLECTED'] } },
      data: { status: 'VOID', notes: reason?.trim() || null },
    });
    if (res.count === 0) return { success: false, error: 'No se puede anular (inexistente o ya saldada)' };
    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'VOID', entityType: 'AccountReceivable',
      entityId: id, description: `Anuló cuenta por cobrar ${id}: ${reason}`, module: 'CONFIG',
    });
    revalidatePath('/dashboard/cuentas-cobrar');
    return { success: true };
  } catch {
    return { success: false, error: 'Error al anular' };
  }
}
