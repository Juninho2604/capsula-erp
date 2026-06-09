'use server';

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';
import { revenueWhere } from '@/lib/sales-where';
import { fiscalWeekLabel } from '@/lib/fiscal-week';
import { getCaracasDateStamp } from '@/lib/datetime';
import { resolveTerminalForMethod, commissionBs, netBs } from '@/lib/treasury/commission';
import { computeReconciliation, type ReconStatus } from '@/lib/treasury/reconciliation';

const READ_ROLES = ['OWNER', 'ADMIN_MANAGER', 'AUDITOR'];
const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER'];

export interface CommissionRow {
  bankAccountId: string;
  accountName: string;
  currency: string;
  fiscalWeek: string;
  grossBs: number;
  commissionBs: number;
  netBs: number;
  count: number;
}

export interface CommissionsReport {
  rows: CommissionRow[];
  totalGrossBs: number;
  totalCommissionBs: number;
  totalNetBs: number;
}

/**
 * Reporte de comisiones bancarias por cuenta y semana fiscal en un rango.
 * Deriva todo de las ventas ya cobradas (SalesOrderPayment) — el dueño no
 * teclea nada: solo configura el % por terminal en Cuentas Bancarias.
 */
export async function getBankCommissionsReportAction(input: {
  start: string;
  end: string;
}): Promise<{ success: boolean; data?: CommissionsReport; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) {
    return { success: false, error: 'Sin permisos para ver comisiones' };
  }

  const start = new Date(input.start);
  const end = new Date(input.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, error: 'Rango de fechas inválido' };
  }

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // Terminales activos con su cuenta (mapeo método → cuenta + %).
    const terminals = await db.posTerminal.findMany({
      where: { isActive: true, posMethodKey: { not: null } },
      include: { bankAccount: { select: { id: true, name: true, currency: true } } },
    });
    if (terminals.length === 0) {
      return { success: true, data: { rows: [], totalGrossBs: 0, totalCommissionBs: 0, totalNetBs: 0 } };
    }
    const methodKeys = terminals.map((t) => t.posMethodKey!).filter(Boolean);

    // Pagos en Bs vía esos métodos, en órdenes válidas del rango.
    // SalesOrderPayment no es tenant-scoped → filtramos por la orden.
    const payments = await db.salesOrderPayment.findMany({
      where: {
        amountBS: { gt: 0 },
        method: { in: methodKeys },
        salesOrder: { is: { tenantId, ...revenueWhere(start, end) } },
      },
      select: {
        method: true,
        amountBS: true,
        salesOrder: { select: { createdAt: true } },
      },
    });

    // Agregación por (cuenta, semana fiscal).
    const acc = new Map<string, CommissionRow>();
    for (const p of payments) {
      const terminal = resolveTerminalForMethod(p.method, terminals);
      if (!terminal) continue;
      const gross = p.amountBS ?? 0;
      const comm = commissionBs(gross, terminal.commissionPct);
      const week = fiscalWeekLabel(p.salesOrder.createdAt);
      const key = `${terminal.bankAccount.id}__${week}`;
      const row = acc.get(key) ?? {
        bankAccountId: terminal.bankAccount.id,
        accountName: terminal.bankAccount.name,
        currency: terminal.bankAccount.currency,
        fiscalWeek: week,
        grossBs: 0,
        commissionBs: 0,
        netBs: 0,
        count: 0,
      };
      row.grossBs = Math.round((row.grossBs + gross) * 100) / 100;
      row.commissionBs = Math.round((row.commissionBs + comm) * 100) / 100;
      row.netBs = Math.round((row.netBs + netBs(gross, terminal.commissionPct)) * 100) / 100;
      row.count += 1;
      acc.set(key, row);
    }

    const rows = Array.from(acc.values()).sort(
      (a, b) => a.accountName.localeCompare(b.accountName) || a.fiscalWeek.localeCompare(b.fiscalWeek)
    );
    const totalGrossBs = Math.round(rows.reduce((s, r) => s + r.grossBs, 0) * 100) / 100;
    const totalCommissionBs = Math.round(rows.reduce((s, r) => s + r.commissionBs, 0) * 100) / 100;
    const totalNetBs = Math.round(rows.reduce((s, r) => s + r.netBs, 0) * 100) / 100;

    return { success: true, data: { rows, totalGrossBs, totalCommissionBs, totalNetBs } };
  } catch {
    return { success: false, error: 'Error al calcular comisiones' };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONCILIACIÓN (Fase 2)
// ════════════════════════════════════════════════════════════════════════════

interface AccountForRecon {
  id: string;
  currency: string;
  terminals: { posMethodKey: string | null; commissionPct: number; bankAccountId: string; isActive: boolean }[];
}

/**
 * Calcula, por día Caracas, el esperado (entradas) y la comisión derivada de
 * las ventas, para una cuenta en un rango. Compartido por la vista y el guardado.
 */
async function computeDailyExpected(
  db: ReturnType<typeof withTenant>,
  tenantId: string,
  account: AccountForRecon,
  start: Date,
  end: Date
): Promise<Map<string, { expectedIn: number; commissionCalc: number }>> {
  const terminals = account.terminals.filter((t) => t.isActive && t.posMethodKey);
  const out = new Map<string, { expectedIn: number; commissionCalc: number }>();
  if (terminals.length === 0) return out;
  const methodKeys = terminals.map((t) => t.posMethodKey!) as string[];
  const isBs = account.currency !== 'USD';

  const payments = await db.salesOrderPayment.findMany({
    where: {
      method: { in: methodKeys },
      ...(isBs ? { amountBS: { gt: 0 } } : { amountUSD: { gt: 0 } }),
      salesOrder: { is: { tenantId, ...revenueWhere(start, end) } },
    },
    select: { method: true, amountUSD: true, amountBS: true, salesOrder: { select: { createdAt: true } } },
  });

  for (const p of payments) {
    const terminal = resolveTerminalForMethod(p.method, terminals);
    if (!terminal) continue;
    const amount = isBs ? (p.amountBS ?? 0) : p.amountUSD;
    if (amount <= 0) continue;
    const stamp = getCaracasDateStamp(p.salesOrder.createdAt);
    const row = out.get(stamp) ?? { expectedIn: 0, commissionCalc: 0 };
    row.expectedIn = Math.round((row.expectedIn + amount) * 100) / 100;
    row.commissionCalc = Math.round((row.commissionCalc + commissionBs(amount, terminal.commissionPct)) * 100) / 100;
    out.set(stamp, row);
  }
  return out;
}

function caracasMonthBounds(year: number, month0: number) {
  const start = new Date(Date.UTC(year, month0, 1, 4, 0, 0, 0));
  const end = new Date(Date.UTC(year, month0 + 1, 1, 3, 59, 59, 999));
  return { start, end };
}

// Día-calendario Caracas (stamp YYYY-MM-DD) → Date canónica (medianoche Caracas).
function dayStampToDate(stamp: string): Date {
  return new Date(`${stamp}T04:00:00.000Z`);
}

export interface ReconciliationDayRow {
  dateStamp: string; // YYYY-MM-DD
  fiscalWeek: string;
  expectedIn: number;
  commissionCalc: number;
  statementIn: number | null;
  commissionStmt: number | null;
  differential: number;
  status: ReconStatus;
  saved: boolean;
  notes: string | null;
}

export interface ReconciliationView {
  accountId: string;
  accountName: string;
  currency: string;
  rows: ReconciliationDayRow[];
}

export async function getReconciliationViewAction(input: {
  bankAccountId: string;
  year: number;
  month0: number; // 0-11
}): Promise<{ success: boolean; data?: ReconciliationView; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const account = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId },
      include: { terminals: true },
    });
    if (!account) return { success: false, error: 'Cuenta no encontrada' };

    const { start, end } = caracasMonthBounds(input.year, input.month0);
    const daily = await computeDailyExpected(db, tenantId, account, start, end);

    const recs = await db.bankReconciliation.findMany({
      where: { bankAccountId: account.id, date: { gte: start, lte: end } },
    });
    const recByStamp = new Map(recs.map((r) => [getCaracasDateStamp(r.date), r]));

    // Días con actividad esperada o con un registro previo.
    const stamps = new Set<string>([...Array.from(daily.keys()), ...Array.from(recByStamp.keys())]);
    const rows: ReconciliationDayRow[] = Array.from(stamps).sort().map((stamp) => {
      const d = daily.get(stamp) ?? { expectedIn: 0, commissionCalc: 0 };
      const rec = recByStamp.get(stamp);
      const statementIn = rec?.statementIn ?? null;
      const { differential, status } = computeReconciliation({
        expectedIn: d.expectedIn,
        commissionCalc: d.commissionCalc,
        statementIn,
      });
      return {
        dateStamp: stamp,
        fiscalWeek: fiscalWeekLabel(dayStampToDate(stamp)),
        expectedIn: d.expectedIn,
        commissionCalc: d.commissionCalc,
        statementIn,
        commissionStmt: rec?.commissionStmt ?? null,
        differential,
        status,
        saved: !!rec,
        notes: rec?.notes ?? null,
      };
    });

    return {
      success: true,
      data: { accountId: account.id, accountName: account.name, currency: account.currency, rows },
    };
  } catch {
    return { success: false, error: 'Error al cargar la conciliación' };
  }
}

export async function saveReconciliationAction(input: {
  bankAccountId: string;
  dateStamp: string; // YYYY-MM-DD
  statementIn: number;
  commissionStmt?: number | null;
  notes?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateStamp)) return { success: false, error: 'Fecha inválida' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const account = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId },
      include: { terminals: true },
    });
    if (!account) return { success: false, error: 'Cuenta no encontrada' };

    const date = dayStampToDate(input.dateStamp);
    // Recalcular y CONGELAR el esperado de ese día.
    const dayStart = new Date(`${input.dateStamp}T04:00:00.000Z`);
    const dayEnd = new Date(`${input.dateStamp}T03:59:59.999Z`);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const daily = await computeDailyExpected(db, tenantId, account, dayStart, dayEnd);
    const d = daily.get(input.dateStamp) ?? { expectedIn: 0, commissionCalc: 0 };

    const { differential, status } = computeReconciliation({
      expectedIn: d.expectedIn,
      commissionCalc: d.commissionCalc,
      statementIn: input.statementIn,
    });
    const fiscalWeek = fiscalWeekLabel(date);

    await db.bankReconciliation.upsert({
      where: { tenantId_bankAccountId_date: { tenantId, bankAccountId: account.id, date } },
      update: {
        fiscalWeek,
        expectedIn: d.expectedIn,
        commissionCalc: d.commissionCalc,
        statementIn: input.statementIn,
        commissionStmt: input.commissionStmt ?? null,
        differential,
        status,
        notes: input.notes?.trim() || null,
        reconciledById: session.id,
      },
      create: {
        tenantId,
        bankAccountId: account.id,
        date,
        fiscalWeek,
        expectedIn: d.expectedIn,
        commissionCalc: d.commissionCalc,
        statementIn: input.statementIn,
        commissionStmt: input.commissionStmt ?? null,
        differential,
        status,
        notes: input.notes?.trim() || null,
        reconciledById: session.id,
      },
    });

    await logAudit({
      userId: session.id,
      userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role,
      action: 'UPDATE',
      entityType: 'BankReconciliation',
      entityId: `${account.name}/${input.dateStamp}`,
      description: `Concilió ${account.name} ${input.dateStamp}: ${status} (dif ${differential})`,
      module: 'CONFIG',
    });

    revalidatePath('/dashboard/conciliacion');
    return { success: true };
  } catch {
    return { success: false, error: 'Error al guardar la conciliación' };
  }
}
