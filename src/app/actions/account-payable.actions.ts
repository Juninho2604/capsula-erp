'use server';

import { prisma } from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';
import { settlePayable, checkPaymentFits, round2 as r2 } from '@/lib/finance/payable-settlement';

export interface AccountPayableData {
  id: string;
  description: string;
  invoiceNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  creditorName: string | null;
  totalAmountUsd: number;
  paidAmountUsd: number;
  remainingUsd: number;
  invoiceDate: Date;
  dueDate: Date | null;
  fullyPaidAt: Date | null;
  status: string;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  retentionIvaUsd: number;
  retentionIslrUsd: number;
  createdByName: string;
  createdAt: Date;
  payments: {
    id: string;
    amountUsd: number;
    amountBs: number | null;
    exchangeRate: number | null;
    paymentMethod: string;
    paymentRef: string | null;
    paidAt: Date;
    notes: string | null;
    isCash: boolean;
    createdByName: string;
  }[];
}

export async function getAccountsPayableAction(filters?: {
  status?: string;
  supplierId?: string;
}): Promise<{ success: boolean; data?: AccountPayableData[]; error?: string }> {
  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) {
    return { success: false, error: 'Sin permisos para ver cuentas por pagar' };
  }

  try {
    const accounts = await db.accountPayable.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.supplierId && { supplierId: filters.supplierId }),
      },
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { orderNumber: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        payments: {
          include: { createdBy: { select: { firstName: true, lastName: true } } },
          orderBy: { paidAt: 'asc' },
        },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    // Mark overdue automatically
    const now = new Date();
    const data: AccountPayableData[] = accounts.map(a => {
      const isOverdue = a.status === 'PENDING' || a.status === 'PARTIAL';
      const overdue = isOverdue && a.dueDate && a.dueDate < now;
      return {
        id: a.id,
        description: a.description,
        invoiceNumber: a.invoiceNumber,
        supplierId: a.supplierId,
        supplierName: a.supplier?.name ?? null,
        creditorName: a.creditorName,
        totalAmountUsd: a.totalAmountUsd,
        paidAmountUsd: a.paidAmountUsd,
        remainingUsd: a.remainingUsd,
        invoiceDate: a.invoiceDate,
        dueDate: a.dueDate,
        fullyPaidAt: a.fullyPaidAt,
        status: overdue ? 'OVERDUE' : a.status,
        purchaseOrderId: a.purchaseOrderId,
        purchaseOrderNumber: a.purchaseOrder?.orderNumber ?? null,
        retentionIvaUsd: a.retentionIvaUsd,
        retentionIslrUsd: a.retentionIslrUsd,
        createdByName: `${a.createdBy.firstName} ${a.createdBy.lastName}`,
        createdAt: a.createdAt,
        payments: a.payments.map(p => ({
          id: p.id,
          amountUsd: p.amountUsd,
          amountBs: p.amountBs,
          exchangeRate: p.exchangeRate,
          paymentMethod: p.paymentMethod,
          paymentRef: p.paymentRef,
          paidAt: p.paidAt,
          notes: p.notes,
          isCash: p.isCash,
          createdByName: `${p.createdBy.firstName} ${p.createdBy.lastName}`,
        })),
      };
    });

    return { success: true, data };
  } catch (e) {
    return { success: false, error: 'Error al obtener cuentas por pagar' };
  }
}

export async function createAccountPayableAction(input: {
  description: string;
  invoiceNumber?: string;
  supplierId?: string;
  creditorName?: string;
  totalAmountUsd: number;
  invoiceDate: string;
  dueDate?: string;
  purchaseOrderId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
    return { success: false, error: 'Sin permisos para crear cuentas por pagar' };
  }

  if (!input.description.trim()) return { success: false, error: 'La descripción es requerida' };
  if (!input.totalAmountUsd || input.totalAmountUsd <= 0) return { success: false, error: 'El monto debe ser mayor a 0' };
  if (!input.supplierId && !input.creditorName?.trim()) return { success: false, error: 'Debe especificar proveedor o nombre del acreedor' };

  const invoiceDate = new Date(input.invoiceDate);
  if (isNaN(invoiceDate.getTime())) return { success: false, error: 'Fecha de factura inválida' };
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  try {
    // Guard anti-duplicado: una orden de compra no debe generar dos deudas.
    if (input.purchaseOrderId) {
      const existing = await db.accountPayable.findFirst({
        where: { purchaseOrderId: input.purchaseOrderId, status: { not: 'VOID' } },
        select: { id: true },
      });
      if (existing) {
        return { success: false, error: 'Esa orden de compra ya tiene una cuenta por pagar asociada' };
      }
    }

    const account = await db.accountPayable.create({
      data: {
        tenantId,
        description: input.description.trim(),
        invoiceNumber: input.invoiceNumber?.trim() || null,
        supplierId: input.supplierId || null,
        creditorName: input.creditorName?.trim() || null,
        totalAmountUsd: input.totalAmountUsd,
        paidAmountUsd: 0,
        remainingUsd: input.totalAmountUsd,
        invoiceDate,
        dueDate,
        status: 'PENDING',
        purchaseOrderId: input.purchaseOrderId || null,
        createdById: session.id,
      },
    });

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'CREATE', entityType: 'AccountPayable',
      entityId: account.id,
      description: `Registró cuenta por pagar: ${account.description} — $${account.totalAmountUsd.toFixed(2)}`,
      module: 'CONFIG',
    });

    revalidatePath('/dashboard/cuentas-pagar');
    revalidatePath('/dashboard/finanzas');
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Error al crear cuenta por pagar' };
  }
}

export async function registerPaymentAction(
  accountPayableId: string,
  input: {
    amountUsd: number;
    amountBs?: number;
    exchangeRate?: number;
    paymentMethod: string;
    paymentRef?: string;
    paidAt: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
    return { success: false, error: 'Sin permisos para registrar pagos' };
  }

  if (!input.amountUsd || input.amountUsd <= 0) return { success: false, error: 'El monto debe ser mayor a 0' };
  const paidAt = new Date(input.paidAt);
  if (isNaN(paidAt.getTime())) return { success: false, error: 'Fecha inválida' };

  try {
    const account = await db.accountPayable.findUnique({ where: { id: accountPayableId } });
    if (!account) return { success: false, error: 'Cuenta por pagar no encontrada' };
    if (account.status === 'PAID' || account.status === 'VOID') {
      return { success: false, error: 'Esta cuenta ya está saldada o anulada' };
    }
    // §115: el tope respeta las retenciones ya aplicadas (saldo = total −
    // pagado − retenciones). Antes topaba contra remainingUsd sin considerar
    // que ya podía haber retenciones.
    const fit = checkPaymentFits({
      totalUsd: account.totalAmountUsd,
      alreadyPaidUsd: account.paidAmountUsd,
      alreadyRetainedUsd: r2(account.retentionIvaUsd + account.retentionIslrUsd),
      newAmountUsd: input.amountUsd,
    });
    if (!fit.ok) return { success: false, error: fit.reason ?? 'Pago inválido' };

    const newPaid = r2(account.paidAmountUsd + input.amountUsd);
    const st = settlePayable({
      totalUsd: account.totalAmountUsd,
      paidUsd: newPaid,
      retentionIvaUsd: account.retentionIvaUsd,
      retentionIslrUsd: account.retentionIslrUsd,
    });

    await db.$transaction([
      db.accountPayment.create({
        data: {
          tenantId,
          accountPayableId,
          amountUsd: input.amountUsd,
          amountBs: input.amountBs ?? null,
          exchangeRate: input.exchangeRate ?? null,
          paymentMethod: input.paymentMethod,
          paymentRef: input.paymentRef?.trim() || null,
          paidAt,
          notes: input.notes?.trim() || null,
          isCash: true, // §115: pago en efectivo real → cuenta como egreso.
          createdById: session.id,
        },
      }),
      db.accountPayable.update({
        where: { id: accountPayableId },
        data: {
          paidAmountUsd: newPaid,
          remainingUsd: st.remainingUsd,
          status: st.status,
          ...(st.isClosed && { fullyPaidAt: new Date() }),
        },
      }),
    ]);

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'PAYMENT', entityType: 'AccountPayable',
      entityId: accountPayableId,
      description: `Registró pago $${input.amountUsd.toFixed(2)} a: ${account.description}`,
      module: 'CONFIG',
      metadata: { newPaid, remaining: st.remainingUsd, status: st.status },
    });

    revalidatePath('/dashboard/cuentas-pagar');
    revalidatePath('/dashboard/finanzas');
    return { success: true };
  } catch (e) {
    console.error('[registerPaymentAction]', e);
    return { success: false, error: 'Error al registrar pago' };
  }
}

/**
 * §115 — Registra/actualiza las RETENCIONES (IVA/ISLR) de una factura.
 *
 * Retener NO saca efectivo hacia el proveedor: es plata que le retienes para
 * enterarla al fisco. Reduce el saldo de la factura y permite CERRARLA aunque
 * los pagos no cubran el total (caso: adelanto no alcanza y se retiene el
 * resto para no dejarla colgada). NO cuenta como egreso de caja.
 *
 * Los montos son ABSOLUTOS (reemplazan los actuales, no se suman) — así se
 * puede corregir. Se valida que pagos + retenciones no superen el total.
 */
export async function setPayableRetentionsAction(
  accountPayableId: string,
  input: { retentionIvaUsd?: number; retentionIslrUsd?: number }
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await resolveTenantContext();
  const db = withTenant(tenantId);
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
    return { success: false, error: 'Sin permisos para registrar retenciones' };
  }
  const iva = Math.max(0, r2(input.retentionIvaUsd ?? 0));
  const islr = Math.max(0, r2(input.retentionIslrUsd ?? 0));

  try {
    const account = await db.accountPayable.findUnique({ where: { id: accountPayableId } });
    if (!account) return { success: false, error: 'Cuenta por pagar no encontrada' };
    if (account.status === 'VOID') return { success: false, error: 'Cuenta anulada' };

    // pagos + retenciones nuevas no pueden superar el total.
    if (r2(account.paidAmountUsd + iva + islr) > account.totalAmountUsd + 0.01) {
      const maxRet = r2(Math.max(0, account.totalAmountUsd - account.paidAmountUsd));
      return { success: false, error: `Las retenciones + lo pagado superan el total. Máximo a retener: $${maxRet.toFixed(2)}` };
    }

    const st = settlePayable({
      totalUsd: account.totalAmountUsd,
      paidUsd: account.paidAmountUsd,
      retentionIvaUsd: iva,
      retentionIslrUsd: islr,
    });

    await db.accountPayable.update({
      where: { id: accountPayableId },
      data: {
        retentionIvaUsd: iva,
        retentionIslrUsd: islr,
        remainingUsd: st.remainingUsd,
        status: st.status,
        ...(st.isClosed && { fullyPaidAt: account.fullyPaidAt ?? new Date() }),
      },
    });

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'UPDATE', entityType: 'AccountPayable',
      entityId: accountPayableId,
      description: `Retenciones en ${account.invoiceNumber ?? account.description}: IVA $${iva.toFixed(2)} + ISLR $${islr.toFixed(2)}${st.isClosed ? ' (factura cerrada)' : ''}`,
      module: 'CONFIG',
    });
    revalidatePath('/dashboard/cuentas-pagar');
    revalidatePath('/dashboard/finanzas');
    return { success: true };
  } catch (e) {
    console.error('[setPayableRetentionsAction]', e);
    return { success: false, error: 'Error al registrar retenciones' };
  }
}

export interface CreditCandidatePO {
  id: string;
  orderNumber: string;
  orderName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  totalAmount: number;
}

/**
 * Órdenes de compra RECIBIDAS que aún no tienen una cuenta por pagar asociada.
 * Candidatas a "crédito": generar la deuda con un clic desde Cuentas por Pagar.
 * Read-only y aditiva — no toca el flujo de compras.
 */
export async function getCreditCandidatePurchaseOrdersAction(): Promise<{
  success: boolean; data?: CreditCandidatePO[]; error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) {
    return { success: false, error: 'Sin permisos' };
  }
  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const pos = await db.purchaseOrder.findMany({
      where: { status: 'RECEIVED', deletedAt: null, accountsPayable: { none: {} } },
      select: {
        id: true, orderNumber: true, orderName: true, totalAmount: true,
        supplierId: true, supplier: { select: { name: true } },
      },
      orderBy: { orderDate: 'desc' },
      take: 100,
    });
    return {
      success: true,
      data: pos.map((p) => ({
        id: p.id,
        orderNumber: p.orderNumber,
        orderName: p.orderName,
        supplierId: p.supplierId,
        supplierName: p.supplier?.name ?? null,
        totalAmount: p.totalAmount,
      })),
    };
  } catch {
    return { success: false, error: 'Error al cargar órdenes de compra' };
  }
}
