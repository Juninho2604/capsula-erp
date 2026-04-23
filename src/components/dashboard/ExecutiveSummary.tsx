'use client';

import { useState } from 'react';

interface ExecutiveSummaryProps {
  todayRevenue: number;
  todayOrders: number;
  revenueChange: number | null;
  openTabs: number;
  openTabsExposed: number;
  lowStockCount: number;
  finance?: {
    profitLoss?: { operatingProfit: number; operatingMarginPct: number | string };
    accountsPayable?: { overdueUsd: number; totalPendingUsd: number };
  } | null;
}

function buildHealthReport(
  revenueChange: number | null,
  openTabs: number,
  lowStockCount: number,
) {
  let score = 0;
  const issues: string[] = [];
  const positives: string[] = [];

  if (revenueChange !== null) {
    if (revenueChange >= 10) {
      score += 2;
      positives.push(`Ventas ${revenueChange.toFixed(1)}% por encima de ayer`);
    } else if (revenueChange >= 0) {
      score += 1;
      positives.push('Ventas en línea con ayer');
    } else if (revenueChange < -10) {
      score -= 2;
      issues.push(`Ventas ${Math.abs(revenueChange).toFixed(1)}% por debajo de ayer`);
    } else {
      score -= 1;
      issues.push('Ventas ligeramente por debajo de ayer');
    }
  }

  if (lowStockCount > 5) {
    score -= 2;
    issues.push(`${lowStockCount} insumos críticos requieren reabastecimiento urgente`);
  } else if (lowStockCount > 0) {
    score -= 1;
    issues.push(`${lowStockCount} insumo(s) por debajo del punto de reorden`);
  } else {
    positives.push('Inventario en buen estado — sin alertas críticas');
  }

  if (openTabs > 3) {
    issues.push(`${openTabs} cuentas abiertas sin cobrar en este momento`);
  } else if (openTabs === 0) {
    positives.push('Todas las cuentas cobradas');
  }

  return { score, issues, positives };
}

export default function ExecutiveSummary({
  todayRevenue,
  todayOrders,
  revenueChange,
  openTabs,
  openTabsExposed,
  lowStockCount,
  finance,
}: ExecutiveSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { score, issues, positives } = buildHealthReport(revenueChange, openTabs, lowStockCount);

  const healthLabel =
    score >= 2 ? 'Buen día operativo' : score >= 0 ? 'Día normal' : 'Requiere atención';
  const healthDot =
    score >= 2
      ? 'bg-emerald-500'
      : score >= 0
      ? 'bg-amber-500'
      : 'bg-red-500';
  const healthTextColor =
    score >= 2 ? 'text-emerald-500' : score >= 0 ? 'text-amber-500' : 'text-red-500';

  const overdueUsd = finance?.accountsPayable?.overdueUsd ?? 0;
  const operatingProfit = finance?.profitLoss?.operatingProfit;
  const operatingMarginPct = finance?.profitLoss?.operatingMarginPct;

  return (
    <div className="glass-panel rounded-2xl border border-primary/10 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl"></span>
          <div className="text-left">
            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Resumen Gerencial
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-2 w-2 rounded-full ${healthDot}`} />
              <p className={`text-xs font-bold ${healthTextColor}`}>{healthLabel}</p>
            </div>
          </div>
        </div>
        <span className="text-muted-foreground text-sm select-none">
          {collapsed ? '▼' : '▲'}
        </span>
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 space-y-3 border-t border-border">
          {/* KPI mini-grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            {/* Facturación hoy */}
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Facturación Hoy
              </p>
              <p className="text-lg font-black text-foreground mt-0.5">
                ${todayRevenue.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {todayOrders} {todayOrders === 1 ? 'orden' : 'órdenes'}
              </p>
            </div>

            {/* Stock crítico */}
            <div
              className={`rounded-xl p-3 ${lowStockCount > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Stock Crítico
              </p>
              <p
                className={`text-lg font-black mt-0.5 ${lowStockCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}
              >
                {lowStockCount}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {lowStockCount > 0 ? 'items requieren compra' : 'todo en orden'}
              </p>
            </div>

            {/* Cuentas abiertas */}
            <div
              className={`rounded-xl p-3 ${openTabs > 0 ? 'bg-orange-500/10' : 'bg-muted/20'}`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Cuentas Abiertas
              </p>
              <p
                className={`text-lg font-black mt-0.5 ${openTabs > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}
              >
                {openTabs}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {openTabs > 0 ? `$${openTabsExposed.toFixed(0)} expuestos` : 'todo cobrado'}
              </p>
            </div>

            {/* Margen mensual — solo si hay datos de finanzas */}
            {operatingProfit !== undefined && operatingMarginPct !== undefined ? (
              <div
                className={`rounded-xl p-3 ${operatingProfit >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Margen Mensual
                </p>
                <p
                  className={`text-lg font-black mt-0.5 ${operatingProfit >= 0 ? 'text-blue-500' : 'text-red-500'}`}
                >
                  {operatingMarginPct}%
                </p>
                <p className="text-[10px] text-muted-foreground">utilidad operativa</p>
              </div>
            ) : (
              <div className="rounded-xl bg-muted/20 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Margen Mensual
                </p>
                <p className="text-lg font-black mt-0.5 text-muted-foreground">—</p>
                <p className="text-[10px] text-muted-foreground">sin datos</p>
              </div>
            )}
          </div>

          {/* Alertas de deudas vencidas */}
          {overdueUsd > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <span className="text-red-500 text-xs mt-0.5 flex-shrink-0"></span>
              <p className="text-xs font-medium text-foreground">
                <strong>
                  ${overdueUsd.toLocaleString('es-VE', { minimumFractionDigits: 0 })}
                </strong>{' '}
                en deudas vencidas con proveedores — requiere acción inmediata
              </p>
            </div>
          )}

          {/* Issues */}
          {issues.length > 0 && (
            <div className="space-y-1.5">
              {issues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-xl bg-red-500/5 border border-red-500/10 px-3 py-2"
                >
                  <span className="text-red-500 text-[10px] mt-0.5 flex-shrink-0 font-black"></span>
                  <p className="text-xs font-medium text-foreground">{issue}</p>
                </div>
              ))}
            </div>
          )}

          {/* Positives */}
          {positives.length > 0 && (
            <div className="space-y-1.5">
              {positives.map((pos, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-3 py-2"
                >
                  <span className="text-emerald-500 text-[10px] mt-0.5 flex-shrink-0 font-black"></span>
                  <p className="text-xs font-medium text-foreground">{pos}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
