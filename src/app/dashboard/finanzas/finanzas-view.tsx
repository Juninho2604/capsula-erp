'use client';

import { useState, useTransition } from 'react';
import {
  ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown,
  Ticket, Wallet, AlertOctagon, AlertTriangle,
  Receipt, ArrowRight,
} from 'lucide-react';
import { getFinancialSummaryAction, type FinancialSummary } from '@/app/actions/finance.actions';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ExcelJS from 'exceljs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${fmt(n)}`;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: 'Restaurante',
  DELIVERY: 'Delivery',
  TAKEOUT: 'Para llevar',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CASH_USD: 'Efectivo USD',
  CASH_BS: 'Efectivo Bs',
  CARD: 'Tarjeta',
  ZELLE: 'Zelle',
  TRANSFER: 'Transferencia',
  BANK_TRANSFER: 'Transferencia',
  MOBILE_PAY: 'Pago Móvil',
  MULTIPLE: 'Múltiple',
  CORTESIA: 'Cortesía',
};

// Minimal Navy-aligned palette (navy spectrum + accent)
const PIE_COLORS = ['#1B2A3A', '#253D5C', '#F25C3B', '#946A1C', '#2F6B4E', '#6B7584', '#B04A2E', '#3A4656'];

const CARD_BASE = 'rounded-2xl border bg-capsula-ivory-surface p-5 shadow-cap-soft';
const SECTION_TITLE = 'mb-5 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted';
const KICKER = 'text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted';

interface TrendItem { label: string; sales: number; cogs: number; expenses: number; profit: number }

interface Props {
  initialSummary: FinancialSummary | null;
  initialTrend: TrendItem[];
  currentMonth: number;
  currentYear: number;
}

export function FinanzasView({ initialSummary, initialTrend, currentMonth, currentYear }: Props) {
  const [summary, setSummary] = useState<FinancialSummary | null>(initialSummary);
  const [trend] = useState<TrendItem[]>(initialTrend);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(m); setSelectedYear(y);
    startTransition(async () => {
      const result = await getFinancialSummaryAction(m, y);
      if (result.success && result.data) setSummary(result.data);
    });
  };

  const s = summary;

  const exportPnLExcel = async () => {
    if (!s) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Estado de Resultados');

    ws.mergeCells('A1:C1');
    ws.getCell('A1').value = `Estado de Resultados — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.getRow(3).values = ['Concepto', 'Monto (USD)', '% sobre Ventas'];
    ws.getRow(3).font = { bold: true };
    ws.getColumn(1).width = 35;
    ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 18;
    ws.getColumn(2).numFmt = '#,##0.00';
    ws.getColumn(3).numFmt = '0.0"%"';

    let row = 4;
    const addRow = (label: string, amount: number, pct?: number, bold?: boolean, indent?: boolean) => {
      ws.getRow(row).values = [indent ? `   ${label}` : label, amount, pct ?? (s.income.totalSalesUsd > 0 ? (amount / s.income.totalSalesUsd) * 100 : 0)];
      if (bold) ws.getRow(row).font = { bold: true };
      row++;
    };

    addRow('(+) Ventas Totales', s.income.totalSalesUsd, 100, true);
    s.income.byType.forEach(t => addRow(`↳ ${t.type}`, t.total, undefined, false, true));
    row++;
    addRow('(−) Costo de Ventas (COGS)', s.cogs.totalCogsUsd, undefined, false);
    addRow('= Utilidad Bruta', s.profitLoss.grossProfit, s.profitLoss.grossMarginPct, true);
    row++;
    addRow('(−) Gastos Operativos', s.expenses.totalExpensesUsd, undefined, false);
    s.expenses.byCategory.forEach(c => addRow(`↳ ${c.name}`, c.total, undefined, false, true));
    row++;
    addRow('= Utilidad Operativa', s.profitLoss.operatingProfit, s.profitLoss.operatingMarginPct, true);
    row += 2;

    ws.getCell(`A${row}`).value = 'Flujo de Caja';
    ws.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;
    addRow('Ingresos (Entradas)', s.cashFlow?.inflows ?? 0);
    addRow('Egresos (Salidas)', s.cashFlow?.outflows ?? 0);
    addRow('Flujo Neto', s.cashFlow?.net ?? 0, undefined, true);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PnL_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        kicker="Finanzas"
        title="Dashboard financiero"
        description="Estado de resultados y flujo de caja"
        actions={
          s ? (
            <Button variant="outline" size="sm" onClick={exportPnLExcel}>
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* Navegador período */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleMonthChange(-1)}
            className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-2 text-capsula-ink transition-colors hover:border-capsula-navy-deep hover:bg-capsula-ivory-alt"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center font-heading text-lg tracking-[-0.01em] text-capsula-navy-deep">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          <button
            onClick={() => handleMonthChange(1)}
            className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-2 text-capsula-ink transition-colors hover:border-capsula-navy-deep hover:bg-capsula-ivory-alt"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {isPending && <span className="animate-pulse text-xs text-capsula-ink-muted">Calculando…</span>}
        </div>

        {!s ? (
          <div className="py-20 text-center text-capsula-ink-muted">
            {isPending ? 'Cargando…' : 'Sin datos para este período'}
          </div>
        ) : (
          <>
            {/* P&L Summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PnLCard
                label="Ventas totales"
                value={`$${fmt(s.income.totalSalesUsd)}`}
                sub={`${s.income.ordersCount} órdenes`}
                Icon={Wallet}
                tone="ok"
                change={s.mom?.salesChange ?? null}
              />
              <PnLCard
                label="Ticket promedio"
                value={`$${fmt(s.income.avgTicket ?? 0)}`}
                sub="Por orden"
                Icon={Ticket}
                tone="warn"
              />
              <PnLCard
                label="Gastos operativos"
                value={`$${fmt(s.expenses.totalExpensesUsd)}`}
                sub={`${s.expenses.count} gastos`}
                Icon={Receipt}
                tone="danger"
                change={s.mom?.expensesChange ?? null}
                invertChange
              />
              <PnLCard
                label="Utilidad operativa"
                value={`$${fmt(s.profitLoss.operatingProfit)}`}
                sub={`Margen: ${s.profitLoss.operatingMarginPct}%`}
                Icon={s.profitLoss.operatingProfit >= 0 ? TrendingUp : TrendingDown}
                tone={s.profitLoss.operatingProfit >= 0 ? 'info' : 'danger'}
                negative={s.profitLoss.operatingProfit < 0}
                change={s.mom?.profitChange ?? null}
              />
            </div>

            {/* Cash Flow Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className={`${CARD_BASE} border-[#D3E2D8] bg-[#E5EDE7]/40`}>
                <p className={KICKER}>Ingresos (entradas)</p>
                <p className="mt-1 font-heading text-2xl tracking-[-0.02em] text-[#2F6B4E]">
                  +${fmt(s.cashFlow?.inflows ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-capsula-ink-soft">Ventas cobradas</p>
              </div>
              <div className={`${CARD_BASE} border-[#EFD2C8] bg-[#F7E3DB]/40`}>
                <p className={KICKER}>Egresos (salidas)</p>
                <p className="mt-1 font-heading text-2xl tracking-[-0.02em] text-[#B04A2E]">
                  -${fmt(s.cashFlow?.outflows ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-capsula-ink-soft">Gastos + pagos a proveedores</p>
              </div>
              <div className={`${CARD_BASE} ${(s.cashFlow?.net ?? 0) >= 0 ? 'border-capsula-line' : 'border-[#EFD2C8] bg-[#F7E3DB]/40'}`}>
                <p className={KICKER}>Flujo neto</p>
                <p
                  className={`mt-1 font-heading text-2xl tracking-[-0.02em] ${
                    (s.cashFlow?.net ?? 0) >= 0 ? 'text-capsula-navy-deep' : 'text-[#B04A2E]'
                  }`}
                >
                  {(s.cashFlow?.net ?? 0) >= 0 ? '+' : '-'}${fmt(Math.abs(s.cashFlow?.net ?? 0))}
                </p>
                <p className="mt-0.5 text-xs text-capsula-ink-soft">Balance del período</p>
              </div>
            </div>

            {/* Estado de Resultados */}
            <div className={`${CARD_BASE} border-capsula-line p-6`}>
              <h3 className={SECTION_TITLE}>Estado de resultados</h3>
              <div className="space-y-3">
                <PnLRow label="(+) Ventas" amount={s.income.totalSalesUsd} positive />
                <div className="space-y-1 pl-4">
                  {s.income.byType.map(t => (
                    <PnLRow key={t.type} label={`↳ ${ORDER_TYPE_LABELS[t.type] ?? t.type}`} amount={t.total} indent positive />
                  ))}
                </div>
                <div className="border-t border-capsula-line pt-2">
                  <PnLRow label="(−) Costo de ventas (COGS)" amount={-s.cogs.totalCogsUsd} />
                </div>
                <div className="rounded-lg border-t border-dashed border-capsula-line bg-capsula-ivory-alt/60 px-3 py-2">
                  <PnLRow label="= Utilidad bruta" amount={s.profitLoss.grossProfit} bold positive={s.profitLoss.grossProfit >= 0} />
                  <p className="mt-0.5 text-xs text-capsula-ink-muted">Margen bruto: {s.profitLoss.grossMarginPct}%</p>
                </div>
                <div className="border-t border-capsula-line pt-2">
                  <PnLRow label="(−) Gastos operativos" amount={-s.expenses.totalExpensesUsd} />
                </div>
                <div className="space-y-1 pl-4">
                  {s.expenses.byCategory.map(c => (
                    <PnLRow key={c.name} label={`↳ ${c.name}`} amount={-c.total} indent />
                  ))}
                </div>
                <div className="rounded-lg border-t-2 border-capsula-line-strong bg-capsula-ivory-alt/60 px-3 py-2">
                  <PnLRow label="= Utilidad operativa" amount={s.profitLoss.operatingProfit} bold positive={s.profitLoss.operatingProfit >= 0} />
                  <p className="mt-0.5 text-xs text-capsula-ink-muted">Margen operativo: {s.profitLoss.operatingMarginPct}%</p>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={`${CARD_BASE} border-capsula-line p-6`}>
                <h3 className={SECTION_TITLE}>Ventas diarias del mes</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={s.income.dailySales ?? []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6B7584' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#6B7584' }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip
                        formatter={(value: number) => [`$${fmt(value)}`, undefined]}
                        contentStyle={{ background: '#FDFBF7', border: '1px solid #E7E2D7', borderRadius: '12px', fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="total" name="Ventas" stroke="#1B2A3A" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`${CARD_BASE} border-capsula-line p-6`}>
                <h3 className={SECTION_TITLE}>Gastos por categoría</h3>
                {(s.expenses.byCategory?.length ?? 0) > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="h-56 w-56 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={s.expenses.byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                            {s.expenses.byCategory.map((entry, index) => (
                              <Cell key={entry.name} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`$${fmt(value)}`, undefined]}
                            contentStyle={{ background: '#FDFBF7', border: '1px solid #E7E2D7', borderRadius: '12px', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-hidden">
                      {s.expenses.byCategory.slice(0, 6).map((cat, i) => (
                        <div key={cat.name} className="flex items-center gap-2 text-xs">
                          <div
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: cat.color || PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="flex-1 truncate text-capsula-ink">{cat.name}</span>
                          <span className="font-medium text-capsula-ink-soft">{cat.pct.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="py-12 text-center text-capsula-ink-muted">Sin gastos registrados</p>
                )}
              </div>
            </div>

            {/* Tendencia 6 meses */}
            {trend.length > 0 && (
              <div className={`${CARD_BASE} border-capsula-line p-6`}>
                <h3 className={SECTION_TITLE}>Tendencia 6 meses</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7584' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6B7584' }} axisLine={false} tickLine={false} width={55} />
                      <Tooltip
                        formatter={(value: number) => [`$${fmt(value)}`, undefined]}
                        contentStyle={{ background: '#FDFBF7', border: '1px solid #E7E2D7', borderRadius: '12px', fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#6B7584' }} />
                      <Bar dataKey="sales" name="Ventas" fill="#1B2A3A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cogs" name="COGS" fill="#946A1C" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Gastos" fill="#F25C3B" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Utilidad" fill="#253D5C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Gastos + Métodos de Pago */}
            <div className="grid gap-4 lg:grid-cols-2">
              {(s.expenses.topExpenses?.length ?? 0) > 0 && (
                <div className={`${CARD_BASE} border-capsula-line p-6`}>
                  <h3 className={SECTION_TITLE}>Top 5 gastos del período</h3>
                  <div className="space-y-3">
                    {s.expenses.topExpenses.map((exp, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="w-6 font-heading text-lg text-capsula-ink-muted">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-capsula-ink">{exp.description}</p>
                            <p className="text-xs text-capsula-ink-muted">
                              {exp.categoryName} · {new Date(exp.paidAt).toLocaleDateString('es-VE')}
                            </p>
                          </div>
                        </div>
                        <span className="ml-3 text-sm font-medium text-[#B04A2E]">${fmt(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(s.income.byPaymentMethod?.length ?? 0) > 0 && (
                <div className={`${CARD_BASE} border-capsula-line p-6`}>
                  <h3 className={SECTION_TITLE}>Ventas por método de pago</h3>
                  <div className="space-y-2.5">
                    {s.income.byPaymentMethod.map(pm => {
                      const pct = s.income.totalSalesUsd > 0 ? (pm.total / s.income.totalSalesUsd) * 100 : 0;
                      return (
                        <div key={pm.method} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-capsula-ink">
                              {PAYMENT_METHOD_LABELS[pm.method] ?? pm.method}
                            </span>
                            <span className="font-medium text-capsula-ink">
                              ${fmt(pm.total)}{' '}
                              <span className="text-xs font-normal text-capsula-ink-muted">({pm.count})</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-capsula-ivory-alt">
                            <div
                              className="h-full rounded-full bg-capsula-navy-deep transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Alertas financieras */}
            {(() => {
              type Severity = 'critical' | 'warning';
              const alerts: { text: string; href?: string; severity: Severity }[] = [];
              if (s.accountsPayable.overdueUsd > 0) {
                alerts.push({ text: `Tienes $${fmt(s.accountsPayable.overdueUsd)} en cuentas por pagar vencidas`, href: '/dashboard/cuentas-pagar', severity: 'critical' });
              }
              if (s.profitLoss.operatingProfit < 0) {
                alerts.push({ text: `El negocio operó con pérdida de $${fmt(Math.abs(s.profitLoss.operatingProfit))} este período`, severity: 'critical' });
              }
              if (s.profitLoss.grossMarginPct < 30 && s.income.totalSalesUsd > 0) {
                alerts.push({ text: `Margen bruto bajo: ${s.profitLoss.grossMarginPct}% (se recomienda >30%)`, href: '/dashboard/costos/margen', severity: 'warning' });
              }
              if (s.expenses.totalExpensesUsd > 0 && s.income.totalSalesUsd > 0 && (s.expenses.totalExpensesUsd / s.income.totalSalesUsd) > 0.40) {
                alerts.push({ text: `Gastos operativos representan ${((s.expenses.totalExpensesUsd / s.income.totalSalesUsd) * 100).toFixed(1)}% de las ventas (se recomienda <40%)`, href: '/dashboard/gastos', severity: 'warning' });
              }
              if (s.mom?.salesChange != null && s.mom.salesChange < -15) {
                alerts.push({ text: `Ventas cayeron ${Math.abs(s.mom.salesChange).toFixed(1)}% vs mes anterior`, severity: 'warning' });
              }
              if ((s.cashFlow?.net ?? 0) < 0) {
                alerts.push({ text: `Flujo de caja negativo: -$${fmt(Math.abs(s.cashFlow?.net ?? 0))}. Los egresos superan los ingresos`, severity: 'warning' });
              }
              if (alerts.length === 0) return null;
              const hasCritical = alerts.some(a => a.severity === 'critical');
              return (
                <div
                  className={`rounded-2xl border p-5 shadow-cap-soft ${
                    hasCritical ? 'border-[#EFD2C8] bg-[#F7E3DB]/40' : 'border-[#E8D9B8] bg-[#F3EAD6]/40'
                  }`}
                >
                  <h3
                    className={`mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] ${
                      hasCritical ? 'text-[#B04A2E]' : 'text-[#946A1C]'
                    }`}
                  >
                    {hasCritical ? <AlertOctagon className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {hasCritical ? 'Alertas financieras' : 'Atención'}
                  </h3>
                  <div className="space-y-2">
                    {alerts.map((alert, i) => (
                      <AlertItem key={i} text={alert.text} href={alert.href} severity={alert.severity} />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Cuentas por pagar pendientes */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className={`${CARD_BASE} border-[#E8D9B8] bg-[#F3EAD6]/40`}>
                <p className={KICKER}>Deudas pendientes</p>
                <p className="mt-1 font-heading text-3xl tracking-[-0.02em] text-capsula-navy-deep">
                  ${fmt(s.accountsPayable.totalPendingUsd)}
                </p>
                <p className="mt-1 text-xs text-capsula-ink-muted">
                  {s.accountsPayable.count} facturas activas
                </p>
              </div>
              <div
                className={`${CARD_BASE} ${
                  s.accountsPayable.overdueUsd > 0 ? 'border-[#EFD2C8] bg-[#F7E3DB]/40' : 'border-capsula-line'
                }`}
              >
                <p className={KICKER}>Vencido</p>
                <p
                  className={`mt-1 font-heading text-3xl tracking-[-0.02em] ${
                    s.accountsPayable.overdueUsd > 0 ? 'text-[#B04A2E]' : 'text-capsula-navy-deep'
                  }`}
                >
                  ${fmt(s.accountsPayable.overdueUsd)}
                </p>
                <p className="mt-1 text-xs text-capsula-ink-muted">Pendiente de pago urgente</p>
              </div>
              <div className={`${CARD_BASE} border-capsula-line`}>
                <p className={KICKER}>Compras del período</p>
                <p className="mt-1 font-heading text-3xl tracking-[-0.02em] text-capsula-navy-deep">
                  ${fmt(s.purchases.totalPurchasesUsd)}
                </p>
                <p className="mt-1 text-xs text-capsula-ink-muted">
                  {s.purchases.ordersCount} órdenes recibidas
                </p>
              </div>
            </div>

            {/* Aging Report */}
            {(s.accountsPayable.aging ?? []).some((a: { range: string; amount: number; count: number }) => a.amount > 0) && (
              <div className={`${CARD_BASE} border-capsula-line p-6`}>
                <h3 className={SECTION_TITLE + ' mb-4'}>Envejecimiento de deudas</h3>
                <div className="grid grid-cols-4 gap-3">
                  {s.accountsPayable.aging.map((bucket: { range: string; amount: number; count: number }) => {
                    const agingStyles = bucketStyles(bucket.range);
                    return (
                      <div
                        key={bucket.range}
                        className={`rounded-xl border p-4 text-center ${agingStyles.bg}`}
                      >
                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                          {bucket.range} días
                        </p>
                        <p className={`mt-1 font-heading text-lg tracking-[-0.02em] ${agingStyles.text}`}>
                          ${fmt(bucket.amount)}
                        </p>
                        <p className="text-[11px] text-capsula-ink-muted">{bucket.count} facturas</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const TONE_CLASS: Record<'ok' | 'warn' | 'danger' | 'info', string> = {
  ok:     'border-[#D3E2D8] bg-[#E5EDE7]/40',
  warn:   'border-[#E8D9B8] bg-[#F3EAD6]/40',
  danger: 'border-[#EFD2C8] bg-[#F7E3DB]/40',
  info:   'border-capsula-line',
};

function bucketStyles(range: string): { bg: string; text: string } {
  if (range === '90+')    return { bg: 'border-[#EFD2C8] bg-[#F7E3DB]/40',  text: 'text-[#B04A2E]' };
  if (range === '61-90')  return { bg: 'border-[#E8D9B8] bg-[#F3EAD6]/60',  text: 'text-[#946A1C]' };
  if (range === '31-60')  return { bg: 'border-[#E8D9B8] bg-[#F3EAD6]/40',  text: 'text-[#946A1C]' };
  return                         { bg: 'border-capsula-line bg-capsula-ivory-alt/60', text: 'text-capsula-navy-deep' };
}

function PnLCard({
  label, value, sub, Icon, tone, negative, change, invertChange,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: 'ok' | 'warn' | 'danger' | 'info';
  negative?: boolean;
  change?: number | null;
  invertChange?: boolean;
}) {
  const changeOk = change != null && (invertChange ? change <= 0 : change >= 0);
  return (
    <div className={`${CARD_BASE} ${TONE_CLASS[tone]}`}>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">{label}</p>
        <Icon className="h-4 w-4 text-capsula-ink-muted" />
      </div>
      <p
        className={`font-heading text-2xl tracking-[-0.02em] ${
          negative ? 'text-[#B04A2E]' : 'text-capsula-navy-deep'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-capsula-ink-soft">{sub}</p>}
      {change != null && (
        <span
          className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${
            changeOk ? 'text-[#2F6B4E]' : 'text-[#B04A2E]'
          }`}
        >
          {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(change).toFixed(1)}% vs mes ant.
        </span>
      )}
    </div>
  );
}

function PnLRow({
  label, amount, bold, indent, positive,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  positive?: boolean;
}) {
  const isPositive = positive !== undefined ? positive : amount >= 0;
  return (
    <div className={`flex items-center justify-between ${indent ? 'text-xs text-capsula-ink-muted' : 'text-sm text-capsula-ink'}`}>
      <span className={bold ? 'font-medium text-capsula-ink' : ''}>{label}</span>
      <span
        className={`${bold ? 'font-heading text-base tracking-[-0.01em]' : 'font-medium'} ${
          amount < 0 ? 'text-[#B04A2E]' : amount > 0 && isPositive ? 'text-[#2F6B4E]' : 'text-capsula-ink'
        }`}
      >
        {amount >= 0 ? `+$${fmt(amount)}` : `-$${fmt(Math.abs(amount))}`}
      </span>
    </div>
  );
}

function AlertItem({
  text, href, severity,
}: {
  text: string;
  href?: string;
  severity: 'critical' | 'warning';
}) {
  const Icon = severity === 'critical' ? AlertOctagon : AlertTriangle;
  const iconColor = severity === 'critical' ? 'text-[#B04A2E]' : 'text-[#946A1C]';
  return (
    <div className="flex items-start gap-2 text-sm text-capsula-ink">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      <span className="flex-1">{text}</span>
      {href && (
        <a
          href={href}
          className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-capsula-navy hover:text-capsula-navy-deep"
        >
          Ver
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
