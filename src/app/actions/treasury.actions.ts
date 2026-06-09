'use server';

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revenueWhere } from '@/lib/sales-where';
import { fiscalWeekLabel } from '@/lib/fiscal-week';
import { resolveTerminalForMethod, commissionBs, netBs } from '@/lib/treasury/commission';

const READ_ROLES = ['OWNER', 'ADMIN_MANAGER', 'AUDITOR'];

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
