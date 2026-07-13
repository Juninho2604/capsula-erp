'use server';

/**
 * §108 — Cambio de divisas (Finanzas).
 *
 * Registra operaciones de cambio de moneda: sale un monto en la moneda
 * origen (típico: USD de la caja o Zelle) y entra el equivalente en la
 * moneda destino, repartido en una o más cuentas bancarias. La tasa
 * implícita (Bs por USD) queda auditada en cada operación.
 *
 * No toca ventas ni inventario — es un registro de tesorería puro.
 */

import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';

const READ_ROLES = ['OWNER', 'ADMIN_MANAGER', 'AUDITOR'];
const WRITE_ROLES = ['OWNER', 'ADMIN_MANAGER'];

export interface ExchangeBankAccount {
  id: string;
  name: string;
  bankName: string | null;
  currency: string; // BS | USD
  kind: string; // BANK | CASH | DIGITAL
}

export interface CurrencyExchangeData {
  id: string;
  exchangeDate: Date;
  currencyOut: string;
  amountOut: number;
  currencyIn: string;
  amountIn: number;
  rate: number;
  fromAccountId: string | null;
  fromAccountName: string | null;
  notes: string | null;
  status: string;
  voidReason: string | null;
  createdByName: string;
  createdAt: Date;
  destinations: {
    id: string;
    bankAccountId: string;
    bankAccountName: string;
    amount: number;
    reference: string | null;
  }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getExchangeBankAccountsAction(): Promise<{
  success: boolean; data?: ExchangeBankAccount[]; error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const accounts = await db.bankAccount.findMany({
      where: { isActive: true },
      select: { id: true, name: true, bankName: true, currency: true, kind: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { success: true, data: accounts };
  } catch {
    return { success: false, error: 'Error al cargar cuentas' };
  }
}

export async function getCurrencyExchangesAction(): Promise<{
  success: boolean; data?: CurrencyExchangeData[]; error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!READ_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const exchanges = await db.currencyExchange.findMany({
      include: {
        fromAccount: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        destinations: { include: { bankAccount: { select: { name: true } } } },
      },
      orderBy: [{ exchangeDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return {
      success: true,
      data: exchanges.map((e) => ({
        id: e.id,
        exchangeDate: e.exchangeDate,
        currencyOut: e.currencyOut,
        amountOut: e.amountOut,
        currencyIn: e.currencyIn,
        amountIn: e.amountIn,
        rate: e.rate,
        fromAccountId: e.fromAccountId,
        fromAccountName: e.fromAccount?.name ?? null,
        notes: e.notes,
        status: e.status,
        voidReason: e.voidReason,
        createdByName: `${e.createdBy.firstName} ${e.createdBy.lastName}`,
        createdAt: e.createdAt,
        destinations: e.destinations.map((d) => ({
          id: d.id,
          bankAccountId: d.bankAccountId,
          bankAccountName: d.bankAccount.name,
          amount: d.amount,
          reference: d.reference,
        })),
      })),
    };
  } catch {
    return { success: false, error: 'Error al cargar cambios de divisas' };
  }
}

export async function createCurrencyExchangeAction(input: {
  exchangeDate: string; // YYYY-MM-DD
  currencyOut: 'USD' | 'BS';
  amountOut: number;
  fromAccountId?: string | null;
  destinations: { bankAccountId: string; amount: number; reference?: string }[];
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos para registrar cambios' };

  const currencyOut = input.currencyOut === 'BS' ? 'BS' : 'USD';
  const currencyIn = currencyOut === 'USD' ? 'BS' : 'USD';

  if (!input.amountOut || input.amountOut <= 0) return { success: false, error: 'El monto que sale debe ser mayor a 0' };
  const exchangeDate = new Date(`${input.exchangeDate}T12:00:00`);
  if (isNaN(exchangeDate.getTime())) return { success: false, error: 'Fecha inválida' };

  const destinations = (input.destinations ?? []).filter((d) => d.bankAccountId && d.amount > 0);
  if (destinations.length === 0) return { success: false, error: 'Agrega al menos una cuenta destino con monto' };

  const amountIn = round2(destinations.reduce((s, d) => s + d.amount, 0));
  if (amountIn <= 0) return { success: false, error: 'El monto que entra debe ser mayor a 0' };

  // Tasa implícita SIEMPRE en Bs por USD, sea cual sea la dirección.
  const rate = currencyOut === 'USD'
    ? round2(amountIn / input.amountOut)
    : round2(input.amountOut / amountIn);
  if (!isFinite(rate) || rate <= 0) return { success: false, error: 'Tasa implícita inválida' };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // Validar cuentas: destino en la moneda que entra; origen (si hay) en la que sale.
    const accountIds = [...destinations.map((d) => d.bankAccountId), ...(input.fromAccountId ? [input.fromAccountId] : [])];
    const accounts = await db.bankAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, name: true, currency: true },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    for (const d of destinations) {
      const acc = byId.get(d.bankAccountId);
      if (!acc) return { success: false, error: 'Cuenta destino no encontrada' };
      if (acc.currency !== currencyIn) {
        return { success: false, error: `La cuenta "${acc.name}" es en ${acc.currency}, no puede recibir ${currencyIn}` };
      }
    }
    if (input.fromAccountId) {
      const from = byId.get(input.fromAccountId);
      if (!from) return { success: false, error: 'Cuenta origen no encontrada' };
      if (from.currency !== currencyOut) {
        return { success: false, error: `La cuenta origen "${from.name}" es en ${from.currency}, no en ${currencyOut}` };
      }
    }

    const exchange = await db.currencyExchange.create({
      data: {
        tenantId,
        exchangeDate,
        currencyOut,
        amountOut: round2(input.amountOut),
        currencyIn,
        amountIn,
        rate,
        fromAccountId: input.fromAccountId || null,
        notes: input.notes?.trim() || null,
        createdById: session.id,
        destinations: {
          create: destinations.map((d) => ({
            bankAccountId: d.bankAccountId,
            amount: round2(d.amount),
            reference: d.reference?.trim() || null,
          })),
        },
      },
    });

    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'CREATE', entityType: 'CurrencyExchange',
      entityId: exchange.id,
      description: `Registró cambio de divisas: ${currencyOut === 'USD' ? '$' : 'Bs '}${round2(input.amountOut).toFixed(2)} → ${currencyIn === 'BS' ? 'Bs ' : '$'}${amountIn.toFixed(2)} (tasa ${rate})`,
      module: 'CONFIG',
      metadata: { destinations: destinations.length },
    });

    revalidatePath('/dashboard/cambio-divisas');
    revalidatePath('/dashboard/finanzas');
    return { success: true };
  } catch (e) {
    console.error('[createCurrencyExchangeAction]', e);
    return { success: false, error: 'Error al registrar el cambio' };
  }
}

export async function voidCurrencyExchangeAction(
  exchangeId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No autorizado' };
  if (!WRITE_ROLES.includes(session.role)) return { success: false, error: 'Sin permisos' };
  if (!reason?.trim()) return { success: false, error: 'Indica el motivo de anulación' };
  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const res = await db.currencyExchange.updateMany({
      where: { id: exchangeId, status: 'ACTIVE' },
      data: { status: 'VOID', voidReason: reason.trim() },
    });
    if (res.count === 0) return { success: false, error: 'Cambio no encontrado o ya anulado' };
    await logAudit({
      userId: session.id, userName: `${session.firstName} ${session.lastName}`,
      userRole: session.role, action: 'VOID', entityType: 'CurrencyExchange',
      entityId: exchangeId, description: `Anuló cambio de divisas: ${reason.trim()}`, module: 'CONFIG',
    });
    revalidatePath('/dashboard/cambio-divisas');
    return { success: true };
  } catch {
    return { success: false, error: 'Error al anular' };
  }
}
