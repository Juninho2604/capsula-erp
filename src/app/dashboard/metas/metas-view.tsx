'use client';

import { useState, useTransition } from 'react';
import { saveMetasAction } from '@/app/actions/metas.actions';
import type { MetasData, MetasConfig } from '@/app/actions/metas.actions';

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const capped = Math.min(pct, 100);
  return (
    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden mt-3">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${capped}%` }}
      />
    </div>
  );
}

function MetaCard({
  label, icon, target, actual, orders, pct, color, borderColor,
}: {
  label: string; icon: string; target: number; actual: number;
  orders: number; pct: number; color: string; borderColor: string;
}) {
  const over = pct >= 100;
  return (
    <div className={`glass-panel rounded-2xl p-5 border ${over ? 'border-emerald-500/40 bg-emerald-500/5' : borderColor}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>

      <p className="text-3xl font-black text-foreground">${fmt(actual)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        de ${fmt(target)} · {orders} orden{orders !== 1 ? 'es' : ''}
      </p>

      <ProgressBar pct={pct} color={over ? 'bg-emerald-500' : color} />

      <div className="flex items-center justify-between mt-2">
        <span className={`text-sm font-black ${over ? 'text-emerald-400' : pct >= 70 ? 'text-[#FF6B4A]' : 'text-muted-foreground'}`}>
          {pct}%
        </span>
        {over && <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">✅ Meta superada</span>}
        {!over && pct >= 70 && <span className="text-[10px] font-black text-[#FF6B4A] uppercase tracking-widest">🔥 Cerca</span>}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function MetasView({ data }: { data: MetasData }) {
  const { config, actual, progress, projection, canEdit } = data;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MetasConfig>({ ...config });
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveMetasAction(form);
      setFeedback({ ok: result.success, msg: result.message });
      if (result.success) setEditing(false);
    });
  };

  const wasteRisk = actual.wasteThisMonth > 0 && actual.month > 0
    ? (actual.wasteThisMonth / actual.month) * 100
    : 0;
  const wasteOk = wasteRisk <= config.wastePercent;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Objetivos y Metas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Seguimiento en tiempo real · Datos en USD</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditing(!editing); setFeedback(null); setForm({ ...config }); }}
            className={`capsula-btn text-sm px-5 py-2 min-h-0 ${editing ? 'capsula-btn-secondary' : 'capsula-btn-primary'}`}
          >
            {editing ? '✕ Cancelar' : '⚙️ Configurar metas'}
          </button>
        )}
      </div>

      {/* Proyección del día */}
      <div className={`rounded-2xl p-5 border flex items-center gap-5 ${
        projection.willHitDaily
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <div className="text-4xl shrink-0">{projection.willHitDaily ? '🚀' : '⏱️'}</div>
        <div>
          <p className="font-black text-foreground text-lg">
            Proyección del día: <span className={projection.willHitDaily ? 'text-emerald-400' : 'text-amber-400'}>
              ${fmt(projection.dailyProjected)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projection.willHitDaily
              ? `✅ A este ritmo superarás la meta diaria de $${fmt(config.daily)}`
              : `Necesitas $${fmt(Math.max(0, config.daily - actual.today))} más para alcanzar la meta de hoy`}
          </p>
        </div>
      </div>

      {/* Cards de progreso */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetaCard
          label="Meta Diaria" icon="☀️"
          target={config.daily} actual={actual.today} orders={actual.todayOrders}
          pct={progress.daily} color="bg-[#FF6B4A]" borderColor="border-[#FF6B4A]/20"
        />
        <MetaCard
          label="Meta Semanal" icon="📅"
          target={config.weekly} actual={actual.week} orders={actual.weekOrders}
          pct={progress.weekly} color="bg-blue-500" borderColor="border-blue-500/20"
        />
        <MetaCard
          label="Meta Mensual" icon="🗓️"
          target={config.monthly} actual={actual.month} orders={actual.monthOrders}
          pct={progress.monthly} color="bg-[#1B2D45]" borderColor="border-[#1B2D45]/20"
        />
      </div>

      {/* Merma */}
      <div className={`glass-panel rounded-2xl p-5 border ${wasteOk ? 'border-emerald-500/20' : 'border-red-500/30 bg-red-500/5'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              Control de Merma — Este Mes
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Merma registrada</p>
                <p className={`text-2xl font-black ${wasteOk ? 'text-foreground' : 'text-red-400'}`}>
                  ${fmt(actual.wasteThisMonth)}
                </p>
              </div>
              <div className="text-muted-foreground text-xl">vs</div>
              <div>
                <p className="text-xs text-muted-foreground">Límite aceptable ({config.wastePercent}%)</p>
                <p className="text-2xl font-black text-foreground">
                  ${fmt(actual.month * config.wastePercent / 100)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">% real de ventas</p>
                <p className={`text-2xl font-black ${wasteOk ? 'text-emerald-400' : 'text-red-400'}`}>
                  {wasteRisk.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          <div className={`text-4xl ${wasteOk ? '' : 'animate-pulse'}`}>
            {wasteOk ? '✅' : '🚨'}
          </div>
        </div>

        {actual.wasteThisMonth === 0 && (
          <p className="text-xs text-muted-foreground mt-3 italic">
            Sin movimientos de merma registrados este mes. Los ajustes de inventario tipo WASTE / ADJUSTMENT_OUT aparecen aquí.
          </p>
        )}
      </div>

      {/* Formulario de edición */}
      {editing && (
        <div className="glass-panel rounded-2xl p-6 border border-primary/20 space-y-5">
          <h2 className="font-black text-foreground text-lg">⚙️ Configurar Metas</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Meta Diaria (USD)</p>
              <input
                type="number" min="0" step="50"
                value={form.daily}
                onChange={(e) => setForm({ ...form, daily: Number(e.target.value) })}
                className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground font-mono font-bold focus:outline-none focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Meta Semanal (USD)</p>
              <input
                type="number" min="0" step="100"
                value={form.weekly}
                onChange={(e) => setForm({ ...form, weekly: Number(e.target.value) })}
                className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground font-mono font-bold focus:outline-none focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Meta Mensual (USD)</p>
              <input
                type="number" min="0" step="500"
                value={form.monthly}
                onChange={(e) => setForm({ ...form, monthly: Number(e.target.value) })}
                className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground font-mono font-bold focus:outline-none focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">% Merma Aceptable</p>
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={form.wastePercent}
                  onChange={(e) => setForm({ ...form, wastePercent: Number(e.target.value) })}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-foreground font-mono font-bold focus:outline-none focus:border-primary pr-10"
                />
                <span className="absolute right-4 top-2.5 text-muted-foreground font-bold text-sm">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Porcentaje de las ventas del mes que puede perderse por merma sin superar el límite.
              </p>
            </label>
          </div>

          {/* Preview */}
          <div className="bg-secondary/30 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { l: 'Diaria', v: form.daily },
              { l: 'Semanal', v: form.weekly },
              { l: 'Mensual', v: form.monthly },
              { l: 'Merma máx.', v: null, pct: form.wastePercent },
            ].map((item) => (
              <div key={item.l}>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">{item.l}</p>
                <p className="text-lg font-black text-foreground">
                  {item.pct !== undefined ? `${item.pct}%` : `$${item.v?.toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>

          {feedback && (
            <div className={`px-4 py-3 rounded-xl text-sm font-bold ${feedback.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {feedback.ok ? '✅' : '❌'} {feedback.msg}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setEditing(false); setFeedback(null); }}
              className="flex-1 capsula-btn capsula-btn-secondary py-2.5 min-h-0"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 capsula-btn capsula-btn-primary py-2.5 min-h-0 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : '💾 Guardar metas'}
            </button>
          </div>
        </div>
      )}

      {/* Hint para no-admin */}
      {!canEdit && (
        <p className="text-xs text-muted-foreground text-center italic">
          Las metas las configura el gerente desde este mismo módulo.
        </p>
      )}
    </div>
  );
}
