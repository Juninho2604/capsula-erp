'use server';

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';
import { Prisma } from '@prisma/client';

// ─── Tipos de salida ─────────────────────────────────────────────────────────

export interface PosTerminalData {
  id: string;
  label: string;
  terminalCode: string | null;
  posMethodKey: string | null;
  commissionPct: number;
  bankAccountId: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BankAccountData {
  id: string;
  name: string;
  bankName: string | null;
  currency: string; // BS | USD
  kind: string; // BANK | CASH | DIGITAL
  rif: string | null;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
  terminals: PosTerminalData[];
}

const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER'];
const READ_ROLES = ['OWNER', 'ADMIN_MANAGER'];

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function getBankAccountsAction(): Promise<{
  success: boolean;
  data?: BankAccountData[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) {
    return { success: false, error: 'Sin permisos para ver cuentas bancarias' };
  }

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const accounts = await db.bankAccount.findMany({
      include: {
        terminals: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return {
      success: true,
      data: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        currency: a.currency,
        kind: a.kind,
        rif: a.rif,
        isActive: a.isActive,
        sortOrder: a.sortOrder,
        notes: a.notes,
        terminals: a.terminals.map((t) => ({
          id: t.id,
          label: t.label,
          terminalCode: t.terminalCode,
          posMethodKey: t.posMethodKey,
          commissionPct: t.commissionPct,
          bankAccountId: t.bankAccountId,
          isActive: t.isActive,
          sortOrder: t.sortOrder,
        })),
      })),
    };
  } catch {
    return { success: false, error: 'Error al cargar cuentas bancarias' };
  }
}

// ─── Cuentas bancarias ───────────────────────────────────────────────────────

export interface BankAccountInput {
  name: string;
  bankName?: string | null;
  currency: string; // BS | USD
  kind: string; // BANK | CASH | DIGITAL
  rif?: string | null;
  sortOrder?: number;
  notes?: string | null;
}

function normalizeCurrency(c: string): string {
  return c === 'USD' ? 'USD' : 'BS';
}
function normalizeKind(k: string): string {
  return ['BANK', 'CASH', 'DIGITAL'].includes(k) ? k : 'BANK';
}

export async function createBankAccountAction(
  input: BankAccountInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) {
    return { success: false, error: 'Sin permisos para crear cuentas bancarias' };
  }
  const name = input.name?.trim();
  if (!name) return { success: false, error: 'El nombre es obligatorio' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const account = await db.bankAccount.create({
      data: {
        tenantId,
        name,
        bankName: input.bankName?.trim() || null,
        currency: normalizeCurrency(input.currency),
        kind: normalizeKind(input.kind),
        rif: input.rif?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        notes: input.notes?.trim() || null,
      },
    });

    await logAudit({
      userId: session.id,
      userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role,
      action: 'CREATE',
      entityType: 'BankAccount',
      entityId: account.id,
      description: `Creó cuenta bancaria: ${account.name} (${account.currency})`,
      module: 'CONFIG',
    });

    revalidatePath('/dashboard/cuentas-bancarias');
    return { success: true, id: account.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { success: false, error: 'Ya existe una cuenta con ese nombre' };
    }
    return { success: false, error: 'Error al crear la cuenta bancaria' };
  }
}

export async function updateBankAccountAction(
  id: string,
  input: Partial<BankAccountInput> & { isActive?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) {
    return { success: false, error: 'Sin permisos para editar cuentas bancarias' };
  }

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    // Guard de tenant: updateMany filtra por tenantId (withTenant inyecta where.tenantId).
    const res = await db.bankAccount.updateMany({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.bankName !== undefined && { bankName: input.bankName?.trim() || null }),
        ...(input.currency !== undefined && { currency: normalizeCurrency(input.currency) }),
        ...(input.kind !== undefined && { kind: normalizeKind(input.kind) }),
        ...(input.rif !== undefined && { rif: input.rif?.trim() || null }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    if (res.count === 0) return { success: false, error: 'Cuenta no encontrada' };

    await logAudit({
      userId: session.id,
      userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role,
      action: 'UPDATE',
      entityType: 'BankAccount',
      entityId: id,
      description: `Editó cuenta bancaria ${id}`,
      module: 'CONFIG',
    });

    revalidatePath('/dashboard/cuentas-bancarias');
    return { success: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { success: false, error: 'Ya existe una cuenta con ese nombre' };
    }
    return { success: false, error: 'Error al actualizar la cuenta bancaria' };
  }
}

// ─── Terminales (PDV) ────────────────────────────────────────────────────────

export interface PosTerminalInput {
  bankAccountId: string;
  label: string;
  terminalCode?: string | null;
  posMethodKey?: string | null;
  commissionPct?: number;
  sortOrder?: number;
}

export async function createPosTerminalAction(
  input: PosTerminalInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) {
    return { success: false, error: 'Sin permisos para crear terminales' };
  }
  const label = input.label?.trim();
  if (!label) return { success: false, error: 'La etiqueta es obligatoria' };
  if (!input.bankAccountId) return { success: false, error: 'Debe asociar una cuenta' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    // Validar que la cuenta exista en este tenant.
    const acc = await db.bankAccount.findFirst({ where: { id: input.bankAccountId } });
    if (!acc) return { success: false, error: 'Cuenta bancaria no encontrada' };

    const terminal = await db.posTerminal.create({
      data: {
        tenantId,
        label,
        terminalCode: input.terminalCode?.trim() || null,
        posMethodKey: input.posMethodKey?.trim() || null,
        commissionPct: input.commissionPct ?? 0,
        sortOrder: input.sortOrder ?? 0,
        bankAccountId: input.bankAccountId,
      },
    });

    await logAudit({
      userId: session.id,
      userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role,
      action: 'CREATE',
      entityType: 'PosTerminal',
      entityId: terminal.id,
      description: `Creó terminal ${terminal.label} → cuenta ${acc.name}`,
      module: 'CONFIG',
    });

    revalidatePath('/dashboard/cuentas-bancarias');
    return { success: true, id: terminal.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { success: false, error: 'Ya existe un terminal con esa etiqueta' };
    }
    return { success: false, error: 'Error al crear el terminal' };
  }
}

export async function updatePosTerminalAction(
  id: string,
  input: Partial<PosTerminalInput> & { isActive?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) {
    return { success: false, error: 'Sin permisos para editar terminales' };
  }

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const res = await db.posTerminal.updateMany({
      where: { id },
      data: {
        ...(input.label !== undefined && { label: input.label.trim() }),
        ...(input.terminalCode !== undefined && { terminalCode: input.terminalCode?.trim() || null }),
        ...(input.posMethodKey !== undefined && { posMethodKey: input.posMethodKey?.trim() || null }),
        ...(input.commissionPct !== undefined && { commissionPct: input.commissionPct }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.bankAccountId !== undefined && { bankAccountId: input.bankAccountId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    if (res.count === 0) return { success: false, error: 'Terminal no encontrado' };

    await logAudit({
      userId: session.id,
      userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role,
      action: 'UPDATE',
      entityType: 'PosTerminal',
      entityId: id,
      description: `Editó terminal ${id}`,
      module: 'CONFIG',
    });

    revalidatePath('/dashboard/cuentas-bancarias');
    return { success: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { success: false, error: 'Ya existe un terminal con esa etiqueta' };
    }
    return { success: false, error: 'Error al actualizar el terminal' };
  }
}
