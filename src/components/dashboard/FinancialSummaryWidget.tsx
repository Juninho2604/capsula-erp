'use client';

import { useState } from 'react';
import Link from 'next/link';
import SparklineChart from './SparklineChart';

interface FinanceData {
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
  cogs: { totalCogsUsd: number };
  cashFlow: { inflows: number; outflows: number; net: number };
  profitLoss: {
    grossProfit: number;
    grossMarginPct: number;
    operatingProfit: number;
    operatingMarginPct: number;
  };
  accountsPayable: {
    totalPendingUsd: number;
    overdueUsd: number;
    count: number;
    aging: { range: string; amount: number; count: number }[];
  };
  mom: {
    salesChange: number | null;
    expensesChange: number | null;
    profitChange: number | null;
    ordersChange: number | null;
  };
}

type ModalKey = 'ventas' | 'gastos' | 'utilidad' | 'flujoNeto' | 'deudas' | null;

const fmt = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS: Record<string, string> = {
  CASH_USD: 'Efectivo USD',
  CASH_BS: 'Efectivo Bs',
  ZELLE: 'Zelle',
  PDV_SHANKLISH: 'PdV Shanklish',
  PDV_SUPERFERRO: 'PdV SuperFerro',
  MOVIL_NG: 'Pago Móvil',
  PY: 'PedidosYA',
  MIXED: 'Pago Mixto',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: 'Restaurante',
  DELIVERY: 'Delivery',
  PICKUP: 'Pickup',
};

// ─── Modal header ────────────────────────────────────────────────────────────
function ModalHeader({
  title,
  subtitle,
  value,
  valueColor,
  onClose,
  headerBg,
}: {
  title: string;
  subtitle?: string;
  value: string;
  valueColor: string;
  onClose: () => void;
  headerBg: string;
}) {
  return (
    <div className={`p-5 border-b border-border flex-shrink-0 ${headerBg}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted"
        >
          ✕
        </button>
      </div>
      <p className={`font-semibold text-2xl tracking-[-0.02em] mt-1 ${valueColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── MoM badge ───────────────────────────────────────────────────────────────
function MomBadge({
  change,
  label = 'vs mes anterior',
  invertColors = false,
}: {
  change: number | null;
  label?: string;
  invertColors?: boolean;
}) {
  if (change === null) return null;
  const isPositive = change >= 0;
  const isGood = invertColors ? !isPositive : isPositive;
  return (
    <div className={`rounded-xl p-3 ${isGood ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
      <p className={`text-sm font-black ${isGood ? 'text-emerald-500' : 'text-red-500'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% {label}
      </p>
    </div>
  );
}

// ─── Progress bar row ─────────────────────────────────────────────────────────
function ProgressRow({
  label,
  value,
  pct,
  color = 'bg-[#FF6B4A]',
}: {
  label: string;
  value: string;
  pct: number;
  color?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{label}</span>
        <span className="text-xs font-black text-muted-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── MODAL: Ventas ────────────────────────────────────────────────────────────
function VentasModal({
  finance,
  onClose,
}: {
  finance: FinanceData;
  onClose: () => void;
}) {
  const sparkline = finance.income.dailySales.map(d => ({ value: d.total }));
  const maxMethod = Math.max(...finance.income.byPaymentMethod.map(m => m.total), 1);
  const maxType = Math.max(...finance.income.byType.map(t => t.total), 1);

  return (
    <>
      <ModalHeader
        title="Ventas del Mes"
        subtitle={finance.period.label}
        value={`$${fmt(finance.income.totalSalesUsd)}`}
        valueColor="text-emerald-500"
        onClose={onClose}
        headerBg="bg-emerald-500/10"
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* KPIs secundarios */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Órdenes
            </p>
            <p className="text-lg font-black text-foreground mt-0.5">
              {finance.income.ordersCount}
            </p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Ticket Prom.
            </p>
            <p className="text-lg font-black text-foreground mt-0.5">
              ${fmt(finance.income.avgTicket)}
            </p>
          </div>
        </div>

        {/* MoM */}
        <MomBadge change={finance.mom.salesChange} />

        {/* Sparkline */}
        {sparkline.length >= 2 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
              Ventas diarias — {finance.period.label}
            </p>
            <SparklineChart data={sparkline} color="#10B981" height={56} />
          </div>
        )}

        {/* Por tipo */}
        {finance.income.byType.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Por canal
            </p>
            {finance.income.byType
              .sort((a, b) => b.total - a.total)
              .map(t => (
                <ProgressRow
                  key={t.type}
                  label={ORDER_TYPE_LABELS[t.type] ?? t.type}
                  value={`$${fmt(t.total)} (${t.count})`}
                  pct={(t.total / maxType) * 100}
                  color="bg-emerald-500"
                />
              ))}
          </div>
        )}

        {/* Por método de pago */}
        {finance.income.byPaymentMethod.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Por método de pago
            </p>
            {finance.income.byPaymentMethod
              .sort((a, b) => b.total - a.total)
              .map(m => (
                <ProgressRow
                  key={m.method}
                  label={METHOD_LABELS[m.method] ?? m.method}
                  value={`$${fmt(m.total)}`}
                  pct={(m.total / maxMethod) * 100}
                />
              ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── MODAL: Gastos ────────────────────────────────────────────────────────────
function GastosModal({
  finance,
  onClose,
}: {
  finance: FinanceData;
  onClose: () => void;
}) {
  return (
    <>
      <ModalHeader
        title="Gastos del Mes"
        subtitle={finance.period.label}
        value={`$${fmt(finance.expenses.totalExpensesUsd)}`}
        valueColor="text-red-500"
        onClose={onClose}
        headerBg="bg-red-500/10"
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* KPI secundario */}
        <div className="rounded-xl bg-muted/30 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Registros
          </p>
          <p className="text-lg font-black text-foreground mt-0.5">
            {finance.expenses.count} gastos confirmados
          </p>
        </div>

        {/* MoM — invertido: baja es bueno */}
        <MomBadge change={finance.mom.expensesChange} invertColors label="vs mes anterior" />

        {/* Por categoría */}
        {finance.expenses.byCategory.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Por categoría
            </p>
            {finance.expenses.byCategory.slice(0, 6).map(c => (
              <ProgressRow
                key={c.name}
                label={c.name}
                value={`$${fmt(c.total)} (${c.pct}%)`}
                pct={c.pct}
                color="bg-red-500"
              />
            ))}
          </div>
        )}

        {/* Top gastos individuales */}
        {finance.expenses.topExpenses.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Mayores gastos individuales
            </p>
            {finance.expenses.topExpenses.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{e.description}</p>
                  <p className="text-[10px] text-muted-foreground">{e.categoryName}</p>
                </div>
                <p className="text-xs font-black text-red-500 ml-3 flex-shrink-0">
                  ${fmt(e.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── MODAL: Utilidad ──────────────────────────────────────────────────────────
function UtilidadModal({
  finance,
  onClose,
}: {
  finance: FinanceData;
  onClose: () => void;
}) {
  const isProfit = finance.profitLoss.operatingProfit >= 0;

  const plSteps = [
    {
      label: 'Ventas',
      value: finance.income.totalSalesUsd,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'COGS (costo de ventas)',
      value: -finance.cogs.totalCogsUsd,
      color: 'text-red-400',
      bg: 'bg-red-500/5',
    },
    {
      label: 'Utilidad Bruta',
      value: finance.profitLoss.grossProfit,
      color: finance.profitLoss.grossProfit >= 0 ? 'text-blue-400' : 'text-red-500',
      bg: finance.profitLoss.grossProfit >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10',
      bold: true,
    },
    {
      label: 'Gastos Operativos',
      value: -finance.expenses.totalExpensesUsd,
      color: 'text-red-400',
      bg: 'bg-red-500/5',
    },
    {
      label: 'Utilidad Operativa',
      value: finance.profitLoss.operatingProfit,
      color: isProfit ? 'text-blue-500' : 'text-red-500',
      bg: isProfit ? 'bg-blue-500/15' : 'bg-red-500/15',
      bold: true,
    },
  ];

  return (
    <>
      <ModalHeader
        title="P&L del Mes"
        subtitle={finance.period.label}
        value={`${isProfit ? '' : '-'}$${fmt(Math.abs(finance.profitLoss.operatingProfit))}`}
        valueColor={isProfit ? 'text-blue-500' : 'text-red-500'}
        onClose={onClose}
        headerBg={isProfit ? 'bg-blue-500/10' : 'bg-red-500/10'}
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* Waterfall P&L */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Estado de resultados
          </p>
          {plSteps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${step.bg}`}
            >
              <p
                className={`text-xs ${step.bold ? 'font-black' : 'font-medium'} text-foreground`}
              >
                {step.label}
              </p>
              <p className={`text-sm font-black tabular-nums ${step.color}`}>
                {step.value < 0 ? '-' : ''}${fmt(Math.abs(step.value))}
              </p>
            </div>
          ))}
        </div>

        {/* Márgenes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Margen Bruto
            </p>
            <p className="text-lg font-black text-foreground mt-0.5">
              {finance.profitLoss.grossMarginPct.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">ventas − COGS</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Margen Operativo
            </p>
            <p
              className={`text-lg font-black mt-0.5 ${isProfit ? 'text-blue-500' : 'text-red-500'}`}
            >
              {finance.profitLoss.operatingMarginPct.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">ut. bruta − gastos</p>
          </div>
        </div>

        {/* MoM */}
        <MomBadge change={finance.mom.profitChange} label="en utilidad vs mes anterior" />

        {/* Contexto */}
        <div className="rounded-xl bg-muted/20 border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            💡{' '}
            {isProfit
              ? `El negocio generó $${fmt(finance.profitLoss.operatingProfit)} de utilidad operativa en ${finance.period.label}. Un margen operativo saludable para restaurantes está entre 10–20%.`
              : `El negocio operó con pérdida de $${fmt(Math.abs(finance.profitLoss.operatingProfit))} en ${finance.period.label}. Revisa si los gastos operativos superan lo presupuestado.`}
          </p>
        </div>
      </div>
    </>
  );
}

// ─── MODAL: Flujo Neto ────────────────────────────────────────────────────────
function FlujoNetoModal({
  finance,
  onClose,
}: {
  finance: FinanceData;
  onClose: () => void;
}) {
  const isPositive = finance.cashFlow.net >= 0;

  return (
    <>
      <ModalHeader
        title="Flujo de Caja"
        subtitle={finance.period.label}
        value={`${isPositive ? '' : '-'}$${fmt(Math.abs(finance.cashFlow.net))}`}
        valueColor={isPositive ? 'text-emerald-500' : 'text-red-500'}
        onClose={onClose}
        headerBg={isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* 3 cards de flujo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Entradas
              </p>
              <p className="text-xs text-muted-foreground">ventas cobradas</p>
            </div>
            <p className="text-lg font-black text-emerald-500">
              +${fmt(finance.cashFlow.inflows)}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-red-500/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Salidas
              </p>
              <p className="text-xs text-muted-foreground">gastos + pagos a proveedores</p>
            </div>
            <p className="text-lg font-black text-red-500">-${fmt(finance.cashFlow.outflows)}</p>
          </div>

          <div
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${isPositive ? 'bg-blue-500/10' : 'bg-red-500/10'}`}
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Neto
              </p>
              <p className="text-xs text-muted-foreground">entradas − salidas</p>
            </div>
            <p className={`font-semibold text-xl tracking-[-0.02em] ${isPositive ? 'text-blue-500' : 'text-red-500'}`}>
              {isPositive ? '' : '-'}${fmt(Math.abs(finance.cashFlow.net))}
            </p>
          </div>
        </div>

        {/* Contexto */}
        <div className="rounded-xl bg-muted/20 border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            💡{' '}
            {isPositive
              ? `Flujo de caja positivo en ${finance.period.label}. El negocio recibió más dinero del que gastó, lo que indica buena liquidez operativa.`
              : `Flujo de caja negativo en ${finance.period.label}. Los egresos superan los ingresos cobrados. Revisa el calendario de pagos a proveedores.`}
          </p>
        </div>
      </div>
    </>
  );
}

// ─── MODAL: Deudas ────────────────────────────────────────────────────────────
const AGING_COLORS: Record<string, string> = {
  '0-30': 'bg-amber-500/10 text-amber-500',
  '31-60': 'bg-orange-500/10 text-orange-500',
  '61-90': 'bg-red-500/10 text-red-500',
  '90+': 'bg-red-700/15 text-red-700 dark:text-red-400',
};

function DeudasModal({
  finance,
  onClose,
}: {
  finance: FinanceData;
  onClose: () => void;
}) {
  const hasOverdue = finance.accountsPayable.overdueUsd > 0;

  return (
    <>
      <ModalHeader
        title="Cuentas por Pagar"
        subtitle={`${finance.accountsPayable.count} cuenta(s) activa(s)`}
        value={`$${fmt(finance.accountsPayable.totalPendingUsd)}`}
        valueColor={hasOverdue ? 'text-red-500' : 'text-foreground'}
        onClose={onClose}
        headerBg={hasOverdue ? 'bg-red-500/10' : 'bg-muted/30'}
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* Pendiente + Vencido */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Total Pendiente
            </p>
            <p className="text-lg font-black text-foreground mt-0.5">
              ${fmt(finance.accountsPayable.totalPendingUsd)}
            </p>
          </div>
          <div className={`rounded-xl p-3 ${hasOverdue ? 'bg-red-500/10' : 'bg-muted/30'}`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Vencido
            </p>
            <p
              className={`text-lg font-black mt-0.5 ${hasOverdue ? 'text-red-500' : 'text-muted-foreground'}`}
            >
              ${fmt(finance.accountsPayable.overdueUsd)}
            </p>
          </div>
        </div>

        {/* Aging report */}
        {finance.accountsPayable.aging.some(b => b.amount > 0) && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Antigüedad de deudas vencidas
            </p>
            {finance.accountsPayable.aging.map(bucket => (
              <div
                key={bucket.range}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${AGING_COLORS[bucket.range] ?? 'bg-muted/20 text-muted-foreground'}`}
              >
                <div>
                  <p className="text-xs font-black">{bucket.range} días</p>
                  <p className="text-[10px] opacity-70">
                    {bucket.count} cuenta{bucket.count !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-sm font-black tabular-nums">
                  {bucket.amount > 0 ? `$${fmt(bucket.amount)}` : '—'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Contexto */}
        <div className="rounded-xl bg-muted/20 border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            💡{' '}
            {hasOverdue
              ? `Hay $${fmt(finance.accountsPayable.overdueUsd)} en deudas vencidas. Prioriza los pagos de mayor antigüedad para mantener la relación con proveedores.`
              : finance.accountsPayable.totalPendingUsd > 0
              ? `Todas las deudas están dentro del plazo de pago. Mantente al día para conservar condiciones favorables con proveedores.`
              : 'No hay cuentas pendientes por pagar en este momento.'}
          </p>
        </div>

        {/* Link a módulo */}
        <Link
          href="/dashboard/cuentas-pagar"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-xs font-black text-primary hover:bg-primary/15 transition-colors"
          onClick={onClose}
        >
          Ver detalle completo →
        </Link>
      </div>
    </>
  );
}

// ─── Widget principal ─────────────────────────────────────────────────────────
export default function FinancialSummaryWidget({ finance }: { finance: FinanceData }) {
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  const btnBase =
    'text-left cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all duration-200 active:scale-[0.99] rounded-xl p-3 w-full';

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Ventas */}
        <button
          onClick={() => setOpenModal('ventas')}
          className={`${btnBase} bg-emerald-500/5 border border-emerald-500/20`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Ventas
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p className="font-semibold text-xl tracking-[-0.02em] text-emerald-500 mt-0.5">
            ${fmt(finance.income.totalSalesUsd)}
          </p>
          {finance.mom.salesChange != null && (
            <p
              className={`text-[10px] font-bold mt-0.5 ${finance.mom.salesChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {finance.mom.salesChange >= 0 ? '▲' : '▼'}{' '}
              {Math.abs(finance.mom.salesChange).toFixed(1)}%
            </p>
          )}
        </button>

        {/* Gastos */}
        <button
          onClick={() => setOpenModal('gastos')}
          className={`${btnBase} bg-red-500/5 border border-red-500/20`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Gastos
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p className="font-semibold text-xl tracking-[-0.02em] text-red-500 mt-0.5">
            ${fmt(finance.expenses.totalExpensesUsd)}
          </p>
          {finance.mom.expensesChange != null && (
            <p
              className={`text-[10px] font-bold mt-0.5 ${finance.mom.expensesChange <= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {finance.mom.expensesChange >= 0 ? '▲' : '▼'}{' '}
              {Math.abs(finance.mom.expensesChange).toFixed(1)}%
            </p>
          )}
        </button>

        {/* Utilidad */}
        <button
          onClick={() => setOpenModal('utilidad')}
          className={`${btnBase} ${finance.profitLoss.operatingProfit >= 0 ? 'bg-blue-500/5 border border-blue-500/20' : 'bg-red-500/5 border border-red-500/20'}`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Utilidad
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p
            className={`font-semibold text-xl tracking-[-0.02em] mt-0.5 ${finance.profitLoss.operatingProfit >= 0 ? 'text-blue-500' : 'text-red-500'}`}
          >
            ${fmt(Math.abs(finance.profitLoss.operatingProfit))}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Margen: {finance.profitLoss.operatingMarginPct.toFixed(1)}%
          </p>
        </button>

        {/* Flujo Neto */}
        <button
          onClick={() => setOpenModal('flujoNeto')}
          className={`${btnBase} ${(finance.cashFlow?.net ?? 0) >= 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'}`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Flujo Neto
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p
            className={`font-semibold text-xl tracking-[-0.02em] mt-0.5 ${(finance.cashFlow?.net ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
          >
            ${fmt(Math.abs(finance.cashFlow?.net ?? 0))}
          </p>
        </button>

        {/* Deudas */}
        <button
          onClick={() => setOpenModal('deudas')}
          className={`${btnBase} border ${finance.accountsPayable.overdueUsd > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-muted/30 border-border'}`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Deudas
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p
            className={`font-semibold text-xl tracking-[-0.02em] mt-0.5 ${finance.accountsPayable.overdueUsd > 0 ? 'text-red-500' : 'text-foreground'}`}
          >
            ${fmt(finance.accountsPayable.totalPendingUsd)}
          </p>
          {finance.accountsPayable.overdueUsd > 0 && (
            <p className="text-[10px] font-bold text-red-400 mt-0.5">
              ${fmt(finance.accountsPayable.overdueUsd)} vencido
            </p>
          )}
        </button>
      </div>

      {/* Modal backdrop */}
      {openModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {openModal === 'ventas' && (
              <VentasModal finance={finance} onClose={() => setOpenModal(null)} />
            )}
            {openModal === 'gastos' && (
              <GastosModal finance={finance} onClose={() => setOpenModal(null)} />
            )}
            {openModal === 'utilidad' && (
              <UtilidadModal finance={finance} onClose={() => setOpenModal(null)} />
            )}
            {openModal === 'flujoNeto' && (
              <FlujoNetoModal finance={finance} onClose={() => setOpenModal(null)} />
            )}
            {openModal === 'deudas' && (
              <DeudasModal finance={finance} onClose={() => setOpenModal(null)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
