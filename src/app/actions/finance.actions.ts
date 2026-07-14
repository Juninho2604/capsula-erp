'use server';

import { prisma } from '@/server/db';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { getCaracasNowParts } from '@/lib/datetime';
import { revenueWhere } from '@/lib/sales-where';
import { getSalesByPaymentMethod, getSalesBridge } from '@/lib/reports/sales-reports';

export interface FinancialSummary {
  period: { month: number; year: number; label: string };
  income: {
    totalSalesUsd: number;
    ordersCount: number;
    avgTicket: number;
    byType: { type: string; total: number; count: number }[];
    byPaymentMethod: { method: string; total: number; count: number }[];
    dailySales: { day: number; total: number; orders: number }[];
  };
  expenses: {
    totalExpensesUsd: number;
    count: number;
    byCategory: { name: string; color: string | null; total: number; pct: number }[];
    topExpenses: { description: string; categoryName: string; amount: number; paidAt: string }[];
  };
  cogs: {
    totalCogsUsd: number;
  };
  purchases: {
    totalPurchasesUsd: number;
    ordersCount: number;
  };
  accountsPayable: {
    totalPendingUsd: number;
    overdueUsd: number;
    count: number;
    aging: { range: string; amount: number; count: number }[];
  };
  cashFlow: {
    inflows: number;
    outflows: number;
    net: number;
  };
  profitLoss: {
    grossProfit: number;
    grossMarginPct: number;
    operatingProfit: number;
    operatingMarginPct: number;
  };
  mom: {
    salesChange: number | null;
    expensesChange: number | null;
    profitChange: number | null;
    ordersChange: number | null;
  };
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function getFinancialSummaryAction(month?: number, year?: number): Promise<{
  success: boolean;
  data?: FinancialSummary;
  error?: string;
}> {
  const guard = await checkActionPermission(PERM.VIEW_FINANCES);
  if (!guard.ok) return { success: false, error: guard.message };

  const { year: _cy, month: _cm } = getCaracasNowParts();
  const m = month ?? (_cm + 1);
  const y = year ?? _cy;
  // Month boundaries in Caracas time (UTC-4): midnight Caracas = 04:00 UTC
  const startDate = new Date(Date.UTC(y, m - 1, 1, 4, 0, 0, 0));
  const endDate = new Date(Date.UTC(y, m, 1, 3, 59, 59, 999));

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    // 1. Ventas del período
    const salesOrders = await db.salesOrder.findMany({
      where: revenueWhere(startDate, endDate),
      select: {
        total: true,
        orderType: true,
        createdAt: true,
        paymentMethod: true,
        items: { select: { costTotal: true } },
      },
    });

    const totalSalesUsd = salesOrders.reduce((s: number, o) => s + o.total, 0);
    const totalCogsUsd = salesOrders.reduce((s: number, o) =>
      s + o.items.reduce((si: number, i) => si + (i.costTotal ?? 0), 0), 0);

    // avgTicket
    const avgTicket = salesOrders.length > 0 ? totalSalesUsd / salesOrders.length : 0;

    // Ventas por tipo (with count)
    const salesByType = new Map<string, { total: number; count: number }>();
    for (const o of salesOrders) {
      const existing = salesByType.get(o.orderType) ?? { total: 0, count: 0 };
      existing.total += o.total;
      existing.count += 1;
      salesByType.set(o.orderType, existing);
    }

    // Ventas por método de pago
    const salesByPaymentMethod = new Map<string, { total: number; count: number }>();
    for (const o of salesOrders) {
      const method = o.paymentMethod ?? 'UNKNOWN';
      const existing = salesByPaymentMethod.get(method) ?? { total: 0, count: 0 };
      existing.total += o.total;
      existing.count += 1;
      salesByPaymentMethod.set(method, existing);
    }

    // Ventas diarias
    const dailySalesMap = new Map<number, { total: number; orders: number }>();
    for (const o of salesOrders) {
      const day = new Date(o.createdAt).getDate();
      const existing = dailySalesMap.get(day) || { total: 0, orders: 0 };
      existing.total += o.total;
      existing.orders += 1;
      dailySalesMap.set(day, existing);
    }
    const dailySales = Array.from(dailySalesMap.entries())
      .map(([day, data]) => ({ day, ...data }))
      .sort((a, b) => a.day - b.day);

    // 2. Gastos del período
    const expenses = await db.expense.findMany({
      where: { status: 'CONFIRMED', periodMonth: m, periodYear: y },
      include: { category: { select: { name: true, color: true } } },
    });

    const totalExpensesUsd = expenses.reduce((s: number, e) => s + e.amountUsd, 0);

    const expByCategory = new Map<string, { name: string; color: string | null; total: number }>();
    for (const e of expenses) {
      const existing = expByCategory.get(e.categoryId);
      if (existing) existing.total += e.amountUsd;
      else expByCategory.set(e.categoryId, { name: e.category.name, color: e.category.color, total: e.amountUsd });
    }

    const byCategorySorted = Array.from(expByCategory.values())
      .sort((a, b) => b.total - a.total)
      .map(c => ({
        ...c,
        pct: totalExpensesUsd > 0 ? Math.round((c.total / totalExpensesUsd) * 1000) / 10 : 0,
      }));

    const topExpenses = [...expenses]
      .sort((a, b) => b.amountUsd - a.amountUsd)
      .slice(0, 5)
      .map(e => ({
        description: e.description,
        categoryName: e.category.name,
        amount: e.amountUsd,
        paidAt: e.paidAt.toISOString(),
      }));

    // 3. Compras del período
    const purchaseAgg = await db.purchaseOrder.aggregate({
      where: {
        status: { in: ['RECEIVED', 'PARTIAL'] },
        receivedDate: { gte: startDate, lte: endDate },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // 4. Cuentas por pagar pendientes (todo historial, no solo el mes)
    const pendingAccounts = await db.accountPayable.findMany({
      where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      select: { remainingUsd: true, dueDate: true },
    });
    const now2 = new Date();
    const totalPendingUsd = pendingAccounts.reduce((s: number, a) => s + a.remainingUsd, 0);
    const overdueUsd = pendingAccounts
      .filter(a => a.dueDate && a.dueDate < now2)
      .reduce((s: number, a) => s + a.remainingUsd, 0);

    // Aging buckets
    const agingBuckets: Record<string, { amount: number; count: number }> = {
      '0-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 },
    };
    for (const a of pendingAccounts) {
      if (!a.dueDate) continue;
      const daysPast = Math.floor((now2.getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysPast <= 0) continue;
      const bucket = daysPast <= 30 ? '0-30' : daysPast <= 60 ? '31-60' : daysPast <= 90 ? '61-90' : '90+';
      agingBuckets[bucket].amount += a.remainingUsd;
      agingBuckets[bucket].count += 1;
    }
    const aging = Object.entries(agingBuckets).map(([range, data]) => ({ range, ...data }));

    // 5. P&L
    const grossProfit = totalSalesUsd - totalCogsUsd;
    const grossMarginPct = totalSalesUsd > 0 ? (grossProfit / totalSalesUsd) * 100 : 0;
    const operatingProfit = grossProfit - totalExpensesUsd;
    const operatingMarginPct = totalSalesUsd > 0 ? (operatingProfit / totalSalesUsd) * 100 : 0;

    // 6. Cash Flow
    // §115: egresos SIN duplicar. Solo cuenta el efectivo que SALIÓ de verdad:
    //   - AccountPayment con isCash=true (pagos reales a facturas). Las
    //     aplicaciones de anticipo (isCash=false) NO cuentan aquí — su efectivo
    //     ya salió cuando se creó el anticipo.
    //   - SupplierAdvance del período (el efectivo del anticipo).
    // Las retenciones IVA/ISLR nunca son egreso (no salen al proveedor).
    const [cashPayments, advancesOut] = await Promise.all([
      db.accountPayment.aggregate({
        where: { paidAt: { gte: startDate, lte: endDate }, isCash: true },
        _sum: { amountUsd: true },
      }),
      db.supplierAdvance.aggregate({
        where: { paidAt: { gte: startDate, lte: endDate }, status: { not: 'VOID' } },
        _sum: { amountUsd: true },
      }),
    ]);
    const outflows = totalExpensesUsd + (cashPayments._sum.amountUsd ?? 0) + (advancesOut._sum.amountUsd ?? 0);
    const cashFlow = {
      inflows: totalSalesUsd,
      outflows,
      net: totalSalesUsd - outflows,
    };

    // 7. Month over Month
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1, 4, 0, 0, 0));
    const prevEnd = new Date(Date.UTC(prevYear, prevMonth, 1, 3, 59, 59, 999));

    const [prevSalesOrders, prevExpAgg] = await Promise.all([
      db.salesOrder.findMany({
        where: revenueWhere(prevStart, prevEnd),
        select: { total: true, items: { select: { costTotal: true } } },
      }),
      db.expense.aggregate({
        where: { status: 'CONFIRMED', periodMonth: prevMonth, periodYear: prevYear },
        _sum: { amountUsd: true },
      }),
    ]);

    const prevSales = prevSalesOrders.reduce((s: number, o) => s + o.total, 0);
    const prevCogs = prevSalesOrders.reduce((s: number, o) =>
      s + o.items.reduce((si: number, i) => si + (i.costTotal ?? 0), 0), 0);
    const prevExpenses = prevExpAgg._sum.amountUsd ?? 0;
    const prevOrders = prevSalesOrders.length;
    const prevProfit = prevSales - prevCogs - prevExpenses;

    const pctChange = (curr: number, prev: number): number | null =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

    const mom = {
      salesChange: pctChange(totalSalesUsd, prevSales),
      expensesChange: pctChange(totalExpensesUsd, prevExpenses),
      profitChange: pctChange(operatingProfit, prevProfit),
      ordersChange: pctChange(salesOrders.length, prevOrders),
    };

    const data: FinancialSummary = {
      period: { month: m, year: y, label: `${MONTH_NAMES[m - 1]} ${y}` },
      income: {
        totalSalesUsd,
        ordersCount: salesOrders.length,
        avgTicket: Math.round(avgTicket * 100) / 100,
        byType: Array.from(salesByType.entries()).map(([type, { total, count }]) => ({ type, total, count })),
        byPaymentMethod: Array.from(salesByPaymentMethod.entries()).map(([method, { total, count }]) => ({ method, total, count })),
        dailySales,
      },
      expenses: {
        totalExpensesUsd,
        count: expenses.length,
        byCategory: byCategorySorted,
        topExpenses,
      },
      cogs: { totalCogsUsd },
      purchases: {
        totalPurchasesUsd: purchaseAgg._sum.totalAmount ?? 0,
        ordersCount: purchaseAgg._count,
      },
      accountsPayable: {
        totalPendingUsd,
        overdueUsd,
        count: pendingAccounts.length,
        aging,
      },
      cashFlow,
      profitLoss: {
        grossProfit,
        grossMarginPct: Math.round(grossMarginPct * 10) / 10,
        operatingProfit,
        operatingMarginPct: Math.round(operatingMarginPct * 10) / 10,
      },
      mom,
    };

    return { success: true, data };
  } catch (e) {
    console.error('[getFinancialSummaryAction]', e);
    return { success: false, error: 'Error al calcular resumen financiero' };
  }
}

export async function getMonthlyTrendAction(months = 6): Promise<{
  success: boolean;
  data?: { label: string; sales: number; cogs: number; expenses: number; profit: number }[];
  error?: string;
}> {
  const guard = await checkActionPermission(PERM.VIEW_FINANCES);
  if (!guard.ok) return { success: false, error: guard.message };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const results: { label: string; sales: number; cogs: number; expenses: number; profit: number }[] = [];
    const { year: _cy, month: _cm } = getCaracasNowParts();

    for (let i = months - 1; i >= 0; i--) {
      // Walk back i months from current Caracas month; Date handles negative month rollover
      const d = new Date(Date.UTC(_cy, _cm - i, 1, 4, 0, 0, 0));
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      const startDate = new Date(Date.UTC(y, m - 1, 1, 4, 0, 0, 0));
      const endDate = new Date(Date.UTC(y, m, 1, 3, 59, 59, 999));

      const salesOrders = await db.salesOrder.findMany({
        where: revenueWhere(startDate, endDate),
        select: { total: true, items: { select: { costTotal: true } } },
      });
      const sales = salesOrders.reduce((s: number, o) => s + o.total, 0);
      const cogs = salesOrders.reduce((s: number, o) => s + o.items.reduce((si: number, i) => si + (i.costTotal ?? 0), 0), 0);

      const expAgg = await db.expense.aggregate({
        where: { status: 'CONFIRMED', periodMonth: m, periodYear: y },
        _sum: { amountUsd: true },
      });
      const expenses = expAgg._sum.amountUsd ?? 0;

      results.push({
        label: `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`,
        sales,
        cogs,
        expenses,
        profit: sales - cogs - expenses,
      });
    }

    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: 'Error al calcular tendencia' };
  }
}

export async function getDailySalesAction(month: number, year: number): Promise<{
  success: boolean;
  data?: { day: number; total: number; orders: number }[];
  error?: string;
}> {
  const guard = await checkActionPermission(PERM.VIEW_FINANCES);
  if (!guard.ok) return { success: false, error: guard.message };

  const startDate = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 3, 59, 59, 999));

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const salesOrders = await db.salesOrder.findMany({
      where: revenueWhere(startDate, endDate),
      select: { total: true, createdAt: true },
    });

    const CARACAS_OFFSET_MS = -4 * 3600 * 1000;
    const dailySalesMap = new Map<number, { total: number; orders: number }>();
    for (const o of salesOrders) {
      const day = new Date(o.createdAt.getTime() + CARACAS_OFFSET_MS).getUTCDate();
      const existing = dailySalesMap.get(day) || { total: 0, orders: 0 };
      existing.total += o.total;
      existing.orders += 1;
      dailySalesMap.set(day, existing);
    }

    const data = Array.from(dailySalesMap.entries())
      .map(([day, d]) => ({ day, ...d }))
      .sort((a, b) => a.day - b.day);

    return { success: true, data };
  } catch (e) {
    console.error('[getDailySalesAction]', e);
    return { success: false, error: 'Error al calcular ventas diarias' };
  }
}

// ════════════════════════════════════════════════════════════════════
// DAILY SUMMARY — resumen financiero para un solo día (zoom diario)
// ════════════════════════════════════════════════════════════════════

export interface DailyFinancialSummary {
  period: { date: string; label: string };           // 'YYYY-MM-DD' + 'Lun 12 May 2026'
  income: {
    totalSalesUsd: number;
    /** Pagos reales del día (con 10% servicio, sin propinas) — criterio puente §59.5. */
    cobradoUsd: number;
    /** balanceDue de mesas aún abiertas con consumo del día (facturado sin cobrar). */
    pendienteUsd: number;
    ordersCount: number;
    avgTicket: number;
    byType: { type: string; total: number; count: number }[];
    byPaymentMethod: { method: string; total: number; count: number }[];
    hourlySales: { hour: number; total: number; orders: number }[];
  };
  expenses: {
    totalExpensesUsd: number;
    count: number;
    byCategory: { name: string; color: string | null; total: number; pct: number }[];
    topExpenses: { description: string; categoryName: string; amount: number; paidAt: string }[];
  };
  cogs: { totalCogsUsd: number };
  purchases: { totalPurchasesUsd: number; ordersCount: number };
  cashFlow: { inflows: number; outflows: number; net: number };
  profitLoss: {
    grossProfit: number; grossMarginPct: number;
    operatingProfit: number; operatingMarginPct: number;
  };
  // Day-over-day vs ayer
  dod: {
    salesChange: number | null;
    expensesChange: number | null;
    profitChange: number | null;
    ordersChange: number | null;
  };
}

const SPANISH_DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

/**
 * Resumen financiero para un solo día (zoom diario al dashboard).
 *
 * @param dateStr Fecha en formato YYYY-MM-DD (Caracas time). Si se omite, usa hoy.
 *
 * Devuelve la misma estructura que el resumen mensual pero:
 *  - period es un día específico, no un mes.
 *  - dailySales se reemplaza por hourlySales (24 buckets por hora del día Caracas).
 *  - mom (mes vs mes anterior) → dod (día vs día anterior).
 *  - Gastos: filtra por createdAt en el día (no por periodMonth/periodYear, ya
 *    que esos son agregados mensuales).
 */
export async function getDailyFinancialSummaryAction(dateStr?: string): Promise<{
  success: boolean;
  data?: DailyFinancialSummary;
  error?: string;
}> {
  const guard = await checkActionPermission(PERM.VIEW_FINANCES);
  if (!guard.ok) return { success: false, error: guard.message };

  try {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    // Default: hoy en Caracas
    const todayParts = getCaracasNowParts();
    const targetDateStr = dateStr ?? `${todayParts.year}-${String(todayParts.month + 1).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`;

    const [yStr, mStr, dStr] = targetDateStr.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!y || !m || !d) {
      return { success: false, error: 'Fecha inválida' };
    }

    // Día Caracas: midnight Caracas = 04:00 UTC
    const startDate = new Date(Date.UTC(y, m - 1, d, 4, 0, 0, 0));
    const endDate = new Date(Date.UTC(y, m - 1, d + 1, 3, 59, 59, 999));

    // ── Ventas del día ─────────────────────────────────────────────────────
    const salesOrders = await db.salesOrder.findMany({
      where: revenueWhere(startDate, endDate),
      select: {
        total: true,
        orderType: true,
        createdAt: true,
        paymentMethod: true,
        items: { select: { costTotal: true } },
      },
    });

    const totalSalesUsd = salesOrders.reduce((s, o) => s + o.total, 0);
    const totalCogsUsd = salesOrders.reduce(
      (s, o) => s + o.items.reduce((si, i) => si + (i.costTotal ?? 0), 0),
      0
    );
    const avgTicket = salesOrders.length > 0 ? totalSalesUsd / salesOrders.length : 0;

    const salesByType = new Map<string, { total: number; count: number }>();
    const salesByPaymentMethod = new Map<string, { total: number; count: number }>();
    const hourlyMap = new Map<number, { total: number; orders: number }>();

    const CARACAS_OFFSET_MS = -4 * 3600 * 1000;
    for (const o of salesOrders) {
      const t = salesByType.get(o.orderType) ?? { total: 0, count: 0 };
      t.total += o.total; t.count += 1;
      salesByType.set(o.orderType, t);

      const pm = o.paymentMethod ?? 'UNKNOWN';
      const p = salesByPaymentMethod.get(pm) ?? { total: 0, count: 0 };
      p.total += o.total; p.count += 1;
      salesByPaymentMethod.set(pm, p);

      const hour = new Date(o.createdAt.getTime() + CARACAS_OFFSET_MS).getUTCHours();
      const h = hourlyMap.get(hour) ?? { total: 0, orders: 0 };
      h.total += o.total; h.orders += 1;
      hourlyMap.set(hour, h);
    }

    const hourlySales = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      total: hourlyMap.get(hour)?.total ?? 0,
      orders: hourlyMap.get(hour)?.orders ?? 0,
    }));

    // ── Cobrado y pendiente del día (criterio del puente de cuadre — §59.5) ─
    const fDay = { tenantId, from: startDate, to: endDate };
    const cobradoUsd = (await getSalesByPaymentMethod(fDay)).reduce((s, mRow) => s + mRow.usd, 0);
    const bridgeDay = await getSalesBridge(fDay, totalSalesUsd, cobradoUsd);

    // ── Gastos del día (filtra por paidAt) ──────────────────────────────────
    const expenses = await db.expense.findMany({
      where: {
        status: 'CONFIRMED',
        paidAt: { gte: startDate, lte: endDate },
      },
      include: { category: { select: { name: true, color: true } } },
    });
    const totalExpensesUsd = expenses.reduce((s, e) => s + e.amountUsd, 0);

    const expByCategory = new Map<string, { name: string; color: string | null; total: number }>();
    for (const e of expenses) {
      const ex = expByCategory.get(e.categoryId);
      if (ex) ex.total += e.amountUsd;
      else expByCategory.set(e.categoryId, { name: e.category.name, color: e.category.color, total: e.amountUsd });
    }
    const byCategory = Array.from(expByCategory.values())
      .sort((a, b) => b.total - a.total)
      .map(c => ({
        ...c,
        pct: totalExpensesUsd > 0 ? Math.round((c.total / totalExpensesUsd) * 1000) / 10 : 0,
      }));
    const topExpenses = [...expenses]
      .sort((a, b) => b.amountUsd - a.amountUsd)
      .slice(0, 5)
      .map(e => ({
        description: e.description,
        categoryName: e.category.name,
        amount: e.amountUsd,
        paidAt: e.paidAt.toISOString(),
      }));

    // ── Compras del día ─────────────────────────────────────────────────────
    const purchaseAgg = await db.purchaseOrder.aggregate({
      where: {
        status: { in: ['RECEIVED', 'PARTIAL'] },
        receivedDate: { gte: startDate, lte: endDate },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // ── P&L y cash flow ─────────────────────────────────────────────────────
    const grossProfit = totalSalesUsd - totalCogsUsd;
    const grossMarginPct = totalSalesUsd > 0 ? (grossProfit / totalSalesUsd) * 100 : 0;
    const operatingProfit = grossProfit - totalExpensesUsd;
    const operatingMarginPct = totalSalesUsd > 0 ? (operatingProfit / totalSalesUsd) * 100 : 0;

    const accountPayments = await db.accountPayment.aggregate({
      where: { paidAt: { gte: startDate, lte: endDate } },
      _sum: { amountUsd: true },
    });
    const outflows = totalExpensesUsd + (accountPayments._sum.amountUsd ?? 0);
    const cashFlow = {
      inflows: totalSalesUsd,
      outflows,
      net: totalSalesUsd - outflows,
    };

    // ── Día anterior para DOD ───────────────────────────────────────────────
    const prevStart = new Date(Date.UTC(y, m - 1, d - 1, 4, 0, 0, 0));
    const prevEnd = new Date(Date.UTC(y, m - 1, d, 3, 59, 59, 999));
    const [prevSalesOrders, prevExpAgg] = await Promise.all([
      db.salesOrder.findMany({
        where: revenueWhere(prevStart, prevEnd),
        select: { total: true, items: { select: { costTotal: true } } },
      }),
      db.expense.aggregate({
        where: { status: 'CONFIRMED', paidAt: { gte: prevStart, lte: prevEnd } },
        _sum: { amountUsd: true },
      }),
    ]);
    const prevSales = prevSalesOrders.reduce((s, o) => s + o.total, 0);
    const prevCogs = prevSalesOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + (i.costTotal ?? 0), 0), 0);
    const prevExpenses = prevExpAgg._sum.amountUsd ?? 0;
    const prevProfit = prevSales - prevCogs - prevExpenses;
    const pctChange = (curr: number, prev: number): number | null =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

    const dod = {
      salesChange: pctChange(totalSalesUsd, prevSales),
      expensesChange: pctChange(totalExpensesUsd, prevExpenses),
      profitChange: pctChange(operatingProfit, prevProfit),
      ordersChange: pctChange(salesOrders.length, prevSalesOrders.length),
    };

    // ── Label legible ───────────────────────────────────────────────────────
    const dayDate = new Date(Date.UTC(y, m - 1, d, 12));
    const weekday = SPANISH_DAY_NAMES[dayDate.getUTCDay()];
    const label = `${weekday} ${d} ${MONTH_NAMES[m - 1]} ${y}`;

    const data: DailyFinancialSummary = {
      period: { date: targetDateStr, label },
      income: {
        totalSalesUsd,
        cobradoUsd,
        pendienteUsd: bridgeDay.pendiente,
        ordersCount: salesOrders.length,
        avgTicket: Math.round(avgTicket * 100) / 100,
        byType: Array.from(salesByType.entries()).map(([type, v]) => ({ type, ...v })),
        byPaymentMethod: Array.from(salesByPaymentMethod.entries()).map(([method, v]) => ({ method, ...v })),
        hourlySales,
      },
      expenses: { totalExpensesUsd, count: expenses.length, byCategory, topExpenses },
      cogs: { totalCogsUsd },
      purchases: {
        totalPurchasesUsd: purchaseAgg._sum.totalAmount ?? 0,
        ordersCount: purchaseAgg._count,
      },
      cashFlow,
      profitLoss: {
        grossProfit,
        grossMarginPct: Math.round(grossMarginPct * 10) / 10,
        operatingProfit,
        operatingMarginPct: Math.round(operatingMarginPct * 10) / 10,
      },
      dod,
    };

    return { success: true, data };
  } catch (e) {
    console.error('[getDailyFinancialSummaryAction]', e);
    return { success: false, error: 'Error al calcular resumen diario' };
  }
}
