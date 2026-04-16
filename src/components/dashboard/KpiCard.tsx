'use client';

import { useState } from 'react';
import SparklineChart from './SparklineChart';

interface KpiBreakdown {
  previousLabel: string;
  previousValue: string;
  currentValue: string;
  changeText: string;
  businessContext: string;
  trendNote?: string;
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number | null;
  changeLabel?: string;
  sparklineData?: { value: number }[];
  colorVariant: 'amber' | 'blue' | 'purple' | 'orange' | 'neutral';
  breakdown: KpiBreakdown;
}

const colorConfig = {
  amber: {
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    text: 'text-amber-500',
    labelText: 'text-amber-500/70',
    sparkColor: '#F59E0B',
    headerBg: 'bg-amber-500/10',
  },
  blue: {
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    text: 'text-blue-400',
    labelText: 'text-blue-400/70',
    sparkColor: '#60A5FA',
    headerBg: 'bg-blue-500/10',
  },
  purple: {
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
    text: 'text-purple-400',
    labelText: 'text-purple-400/70',
    sparkColor: '#A78BFA',
    headerBg: 'bg-purple-500/10',
  },
  orange: {
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/5',
    text: 'text-orange-400',
    labelText: 'text-gray-400/70',
    sparkColor: '#FB923C',
    headerBg: 'bg-orange-500/10',
  },
  neutral: {
    border: 'border-gray-700/30',
    bg: 'bg-transparent',
    text: 'text-gray-500',
    labelText: 'text-gray-400/70',
    sparkColor: '#9CA3AF',
    headerBg: 'bg-gray-500/10',
  },
};

export default function KpiCard({
  title,
  value,
  subtitle,
  change,
  changeLabel = 'vs período anterior',
  sparklineData = [],
  colorVariant,
  breakdown,
}: KpiCardProps) {
  const [open, setOpen] = useState(false);
  const colors = colorConfig[colorVariant];

  const trendIcon =
    change === null || change === undefined ? '—' : change > 0 ? '↑' : change < 0 ? '↓' : '—';
  const trendColor =
    change === null || change === undefined
      ? 'text-gray-400'
      : change > 0
      ? 'text-emerald-400'
      : change < 0
      ? 'text-red-400'
      : 'text-gray-400';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`glass-panel rounded-2xl p-5 border ${colors.border} ${colors.bg} w-full text-left transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.99]`}
      >
        <div className="flex items-start justify-between mb-1">
          <p className={`text-[10px] font-black uppercase tracking-widest ${colors.labelText}`}>
            {title}
          </p>
          <span className="text-gray-400/40 text-[9px] font-medium leading-none mt-0.5">
            ver detalle
          </span>
        </div>

        <p className={`text-3xl font-black ${colors.text} mt-1`}>{value}</p>

        {/* Sparkline */}
        {sparklineData.length >= 2 && (
          <div className="mt-2 -mx-1">
            <SparklineChart data={sparklineData} color={colors.sparkColor} />
          </div>
        )}

        {/* Trend indicator or subtitle */}
        {change !== null && change !== undefined ? (
          <p className={`text-xs font-bold mt-2 ${trendColor}`}>
            {trendIcon} {Math.abs(change).toFixed(1)}% {changeLabel}
          </p>
        ) : subtitle ? (
          <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        ) : null}
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-5 border-b border-border ${colors.headerBg} flex-shrink-0`}>
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>
                  {title}
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted"
                >
                  ✕
                </button>
              </div>
              <p className={`text-2xl font-black mt-1 ${colors.text}`}>{value}</p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Hoy vs período anterior */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Hoy
                  </p>
                  <p className={`text-lg font-black mt-0.5 ${colors.text}`}>
                    {breakdown.currentValue}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {breakdown.previousLabel}
                  </p>
                  <p className="text-lg font-black mt-0.5 text-muted-foreground">
                    {breakdown.previousValue}
                  </p>
                </div>
              </div>

              {/* Badge cambio */}
              {change !== null && change !== undefined && (
                <div
                  className={`rounded-xl p-3 ${change >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}
                >
                  <p
                    className={`text-sm font-black ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                  >
                    {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%{' '}
                    {breakdown.changeText}
                  </p>
                </div>
              )}

              {/* Sparkline ampliado */}
              {sparklineData.length >= 2 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                    {breakdown.trendNote ?? 'Tendencia reciente'}
                  </p>
                  <SparklineChart data={sparklineData} color={colors.sparkColor} height={60} />
                </div>
              )}

              {/* Contexto de negocio */}
              <div className="rounded-xl bg-muted/20 border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                  💡 {breakdown.businessContext}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
