'use client';

import { useState } from 'react';
import Link from 'next/link';
import SparklineChart from './SparklineChart';
import { Portal } from '@/components/ui/Portal';

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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        <button
          onClick={onClose}
          className="text-capsula-ink-muted hover:text-capsula-coral transition-colors text-base leading-none w-6 h-6 flex items-center justify-center rounded-lg hover:bg-capsula-coral/10"
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
    <div className={`rounded-xl p-3 ${isGood ? 'bg-[#E5EDE7]/60 dark:bg-[#1E3B2C]/60' : 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60'}`}>
      <p className={`text-sm font-semibold ${isGood ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-[#B04A2E] dark:text-[#EFD2C8]'}`}>
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
        <span className="text-xs font-semibold text-muted-foreground">{value}</span>
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
        valueColor="text-[#2F6B4E] dark:text-[#6FB88F]"
        onClose={onClose}
        headerBg="bg-[#E5EDE7]/60 dark:bg-[#1E3B2C]/60"
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* KPIs secundarios */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Órdenes
            </p>
            <p className="text-lg font-semibold text-foreground mt-0.5">
              {finance.income.ordersCount}
            </p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ticket Prom.
            </p>
            <p className="text-lg font-semibold text-foreground mt-0.5">
              ${fmt(finance.income.avgTicket)}
            </p>
          </div>
        </div>

        {/* MoM */}
        <MomBadge change={finance.mom.salesChange} />

        {/* Sparkline */}
        {sparkline.length >= 2 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Ventas diarias — {finance.period.label}
            </p>
            <SparklineChart data={sparkline} color="#10B981" height={56} />
          </div>
        )}

        {/* Por tipo */}
        {finance.income.byType.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                  color="bg-[#2F6B4E] dark:bg-[#6FB88F]"
                />
              ))}
          </div>
        )}

        {/* Por método de pago */}
        {finance.income.byPaymentMethod.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        valueColor="text-[#B04A2E] dark:text-[#EFD2C8]"
        onClose={onClose}
        headerBg="bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60"
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* KPI secundario */}
        <div className="rounded-xl bg-muted/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Registros
          </p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {finance.expenses.count} gastos confirmados
          </p>
        </div>

        {/* MoM — invertido: baja es bueno */}
        <MomBadge change={finance.mom.expensesChange} invertColors label="vs mes anterior" />

        {/* Por categoría */}
        {finance.expenses.byCategory.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Por categoría
            </p>
            {finance.expenses.byCategory.slice(0, 6).map(c => (
              <ProgressRow
                key={c.name}
                label={c.name}
                value={`$${fmt(c.total)} (${c.pct}%)`}
                pct={c.pct}
                color="bg-[#B04A2E] dark:bg-[#EFD2C8]"
              />
            ))}
          </div>
        )}

        {/* Top gastos individuales */}
        {finance.expenses.topExpenses.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mayores gastos individuales
            </p>
            {finance.expenses.topExpenses.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{e.description}</p>
                  <p className="text-[10px] text-muted-foreground">{e.categoryName}</p>
                </div>
                <p className="text-xs font-semibold text-[#B04A2E] dark:text-[#EFD2C8] ml-3 flex-shrink-0">
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
      color: 'text-[#2F6B4E] dark:text-[#6FB88F]',
      bg: 'bg-[#E5EDE7]/60 dark:bg-[#1E3B2C]/60',
    },
    {
      label: 'COGS (costo de ventas)',
      value: -finance.cogs.totalCogsUsd,
      color: 'text-[#B04A2E] dark:text-[#EFD2C8]',
      bg: 'bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40',
    },
    {
      label: 'Utilidad Bruta',
      value: finance.profitLoss.grossProfit,
      color: finance.profitLoss.grossProfit >= 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral',
      bg: finance.profitLoss.grossProfit >= 0 ? 'bg-[#E6ECF4]/60 dark:bg-[#1A2636]/60' : 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60',
      bold: true,
    },
    {
      label: 'Gastos Operativos',
      value: -finance.expenses.totalExpensesUsd,
      color: 'text-[#B04A2E] dark:text-[#EFD2C8]',
      bg: 'bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40',
    },
    {
      label: 'Utilidad Operativa',
      value: finance.profitLoss.operatingProfit,
      color: isProfit ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral',
      bg: isProfit ? 'bg-[#E6ECF4]/60 dark:bg-[#1A2636]/60' : 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60',
      bold: true,
    },
  ];

  return (
    <>
      <ModalHeader
        title="P&L del Mes"
        subtitle={finance.period.label}
        value={`${isProfit ? '' : '-'}$${fmt(Math.abs(finance.profitLoss.operatingProfit))}`}
        valueColor={isProfit ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral'}
        onClose={onClose}
        headerBg={isProfit ? 'bg-[#E6ECF4]/60 dark:bg-[#1A2636]/60' : 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60'}
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* Waterfall P&L */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Estado de resultados
          </p>
          {plSteps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${step.bg}`}
            >
              <p
                className={`text-xs ${step.bold ? 'font-semibold' : 'font-medium'} text-foreground`}
              >
                {step.label}
              </p>
              <p className={`text-sm font-semibold tabular-nums ${step.color}`}>
                {step.value < 0 ? '-' : ''}${fmt(Math.abs(step.value))}
              </p>
            </div>
          ))}
        </div>

        {/* Márgenes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Margen Bruto
            </p>
            <p className="text-lg font-semibold text-foreground mt-0.5">
              {finance.profitLoss.grossMarginPct.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">ventas − COGS</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Margen Operativo
            </p>
            <p
              className={`text-lg font-semibold mt-0.5 ${isProfit ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral'}`}
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
        valueColor={isPositive ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-[#B04A2E] dark:text-[#EFD2C8]'}
        onClose={onClose}
        headerBg={isPositive ? 'bg-[#E5EDE7]/60 dark:bg-[#1E3B2C]/60' : 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60'}
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* 3 cards de flujo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-[#E5EDE7]/60 dark:bg-[#1E3B2C]/60 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Entradas
              </p>
              <p className="text-xs text-muted-foreground">ventas cobradas</p>
            </div>
            <p className="text-lg font-semibold text-[#2F6B4E] dark:text-[#6FB88F]">
              +${fmt(finance.cashFlow.inflows)}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Salidas
              </p>
              <p className="text-xs text-muted-foreground">gastos + pagos a proveedores</p>
            </div>
            <p className="text-lg font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">-${fmt(finance.cashFlow.outflows)}</p>
          </div>

          <div
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${isPositive ? 'bg-[#E6ECF4]/60 dark:bg-[#1A2636]/60' : 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60'}`}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Neto
              </p>
              <p className="text-xs text-muted-foreground">entradas − salidas</p>
            </div>
            <p className={`font-semibold text-xl tracking-[-0.02em] ${isPositive ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral'}`}>
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
  '0-30': 'bg-[#F3EAD6]/60 dark:bg-[#3B2F15]/60 text-[#946A1C] dark:text-[#E8D9B8]',
  '31-60': 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60 text-[#946A1C] dark:text-[#E8D9B8]',
  '61-90': 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60 text-[#B04A2E] dark:text-[#EFD2C8]',
  '90+': 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60 text-[#B04A2E] dark:text-[#EFD2C8] dark:text-[#B04A2E] dark:text-[#EFD2C8]',
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
        valueColor={hasOverdue ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : 'text-foreground'}
        onClose={onClose}
        headerBg={hasOverdue ? 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60' : 'bg-muted/30'}
      />
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* Pendiente + Vencido */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Pendiente
            </p>
            <p className="text-lg font-semibold text-foreground mt-0.5">
              ${fmt(finance.accountsPayable.totalPendingUsd)}
            </p>
          </div>
          <div className={`rounded-xl p-3 ${hasOverdue ? 'bg-[#F7E3DB]/60 dark:bg-[#3B1F14]/60' : 'bg-muted/30'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vencido
            </p>
            <p
              className={`text-lg font-semibold mt-0.5 ${hasOverdue ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : 'text-muted-foreground'}`}
            >
              ${fmt(finance.accountsPayable.overdueUsd)}
            </p>
          </div>
        </div>

        {/* Aging report */}
        {finance.accountsPayable.aging.some(b => b.amount > 0) && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Antigüedad de deudas vencidas
            </p>
            {finance.accountsPayable.aging.map(bucket => (
              <div
                key={bucket.range}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${AGING_COLORS[bucket.range] ?? 'bg-muted/20 text-muted-foreground'}`}
              >
                <div>
                  <p className="text-xs font-semibold">{bucket.range} días</p>
                  <p className="text-[10px] opacity-70">
                    {bucket.count} cuenta{bucket.count !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
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
          className="flex items-center justify-center gap-2 rounded-xl bg-capsula-navy-soft border border-capsula-line px-4 py-2.5 text-xs font-semibold text-capsula-ink hover:bg-capsula-coral/10 hover:text-capsula-coral hover:border-capsula-coral/40 transition-colors"
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
          className={`${btnBase} bg-[#E5EDE7]/40 dark:bg-[#1E3B2C]/40 border border-[#E5EDE7] dark:border-[#1E3B2C]`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ventas (mes)
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p className="font-semibold text-xl tracking-[-0.02em] text-[#2F6B4E] dark:text-[#6FB88F] mt-0.5">
            ${fmt(finance.income.totalSalesUsd)}
          </p>
          {finance.mom.salesChange != null && (
            <p
              className={`text-[10px] font-semibold mt-0.5 ${finance.mom.salesChange >= 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-[#B04A2E] dark:text-[#EFD2C8]'}`}
            >
              {finance.mom.salesChange >= 0 ? '▲' : '▼'}{' '}
              {Math.abs(finance.mom.salesChange).toFixed(1)}%
            </p>
          )}
        </button>

        {/* Gastos */}
        <button
          onClick={() => setOpenModal('gastos')}
          className={`${btnBase} bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40 border border-[#F7E3DB] dark:border-[#3B1F14]`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Gastos (mes)
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p className="font-semibold text-xl tracking-[-0.02em] text-[#B04A2E] dark:text-[#EFD2C8] mt-0.5">
            ${fmt(finance.expenses.totalExpensesUsd)}
          </p>
          {finance.mom.expensesChange != null && (
            <p
              className={`text-[10px] font-semibold mt-0.5 ${finance.mom.expensesChange <= 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-[#B04A2E] dark:text-[#EFD2C8]'}`}
            >
              {finance.mom.expensesChange >= 0 ? '▲' : '▼'}{' '}
              {Math.abs(finance.mom.expensesChange).toFixed(1)}%
            </p>
          )}
        </button>

        {/* Utilidad */}
        <button
          onClick={() => setOpenModal('utilidad')}
          className={`${btnBase} ${finance.profitLoss.operatingProfit >= 0 ? 'bg-[#E6ECF4]/40 dark:bg-[#1A2636]/40 border border-[#E6ECF4] dark:border-[#1A2636]' : 'bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40 border border-[#F7E3DB] dark:border-[#3B1F14]'}`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Utilidad (mes)
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p
            className={`font-semibold text-xl tracking-[-0.02em] mt-0.5 ${finance.profitLoss.operatingProfit >= 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral'}`}
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
          className={`${btnBase} ${(finance.cashFlow?.net ?? 0) >= 0 ? 'bg-[#E5EDE7]/40 dark:bg-[#1E3B2C]/40 border border-[#E5EDE7] dark:border-[#1E3B2C]' : 'bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40 border border-[#F7E3DB] dark:border-[#3B1F14]'}`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Flujo (mes)
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p
            className={`font-semibold text-xl tracking-[-0.02em] mt-0.5 ${(finance.cashFlow?.net ?? 0) >= 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-[#B04A2E] dark:text-[#EFD2C8]'}`}
          >
            ${fmt(Math.abs(finance.cashFlow?.net ?? 0))}
          </p>
        </button>

        {/* Deudas */}
        <button
          onClick={() => setOpenModal('deudas')}
          className={`${btnBase} border ${finance.accountsPayable.overdueUsd > 0 ? 'bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40 border-[#F7E3DB] dark:border-[#3B1F14]' : 'bg-muted/30 border-border'}`}
        >
          <div className="flex items-start justify-between mb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Deudas
            </p>
            <span className="text-[9px] text-muted-foreground/40 leading-none mt-0.5">
              ver más
            </span>
          </div>
          <p
            className={`font-semibold text-xl tracking-[-0.02em] mt-0.5 ${finance.accountsPayable.overdueUsd > 0 ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : 'text-foreground'}`}
          >
            ${fmt(finance.accountsPayable.totalPendingUsd)}
          </p>
          {finance.accountsPayable.overdueUsd > 0 && (
            <p className="text-[10px] font-semibold text-[#B04A2E] dark:text-[#EFD2C8] mt-0.5">
              ${fmt(finance.accountsPayable.overdueUsd)} vencido
            </p>
          )}
        </button>
      </div>

      {/* Modal backdrop — Portal para escapar del stacking context del
          .capsula-card padre (que tiene transform en hover y overflow-hidden). */}
      {openModal && (
        <Portal>
        <div
          className="fixed inset-0 z-[60] bg-capsula-navy-deep/55 flex items-center justify-center p-4 backdrop-blur-sm"
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
        </Portal>
      )}
    </>
  );
}
