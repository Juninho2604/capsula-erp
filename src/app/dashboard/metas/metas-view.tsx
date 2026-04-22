'use client';

import { useState, useTransition } from 'react';
import { Settings, X, Save, Sun, Calendar, CalendarRange, Rocket, Timer, CheckCircle2, AlertOctagon, Flame } from 'lucide-react';
import { saveMetasAction } from '@/app/actions/metas.actions';
import type { MetasData, MetasConfig } from '@/app/actions/metas.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProgressBar({ pct, over }: { pct: number; over: boolean }) {
  const capped = Math.min(pct, 100);
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-capsula-ivory-alt">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${capped}%`,
          backgroundColor: over ? '#2F6B4E' : 'var(--capsula-navy-deep)',
        }}
      />
    </div>
  );
}

type MetaCardProps = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  target: number;
  actual: number;
  orders: number;
  pct: number;
};

function MetaCard({ label, Icon, target, actual, orders, pct }: MetaCardProps) {
  const over = pct >= 100;
  return (
    <div
      className={`rounded-2xl border bg-capsula-ivory-surface p-5 shadow-cap-soft ${
        over ? 'border-[#D3E2D8] bg-[#E5EDE7]/40' : 'border-capsula-line'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">{label}</p>
        <Icon className="h-4 w-4 text-capsula-ink-muted" />
      </div>

      <p className="font-heading text-3xl leading-tight tracking-[-0.02em] text-capsula-navy-deep">
        ${fmt(actual)}
      </p>
      <p className="mt-0.5 text-xs text-capsula-ink-soft">
        de ${fmt(target)} · {orders} orden{orders !== 1 ? 'es' : ''}
      </p>

      <ProgressBar pct={pct} over={over} />

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-sm font-medium ${
            over ? 'text-[#2F6B4E]' : pct >= 70 ? 'text-[#946A1C]' : 'text-capsula-ink-muted'
          }`}
        >
          {pct}%
        </span>
        {over && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[#2F6B4E]">
            <CheckCircle2 className="h-3 w-3" /> Meta superada
          </span>
        )}
        {!over && pct >= 70 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[#946A1C]">
            <Flame className="h-3 w-3" /> Cerca
          </span>
        )}
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

  const FIELD_LABEL = 'block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted';
  const FIELD_INPUT = 'w-full rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-2.5 font-mono text-sm font-medium text-capsula-ink focus:border-capsula-navy-deep focus:outline-none';

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        kicker="Rendimiento"
        title="Objetivos y metas"
        description="Seguimiento en tiempo real · Datos en USD"
        actions={
          canEdit ? (
            <Button
              size="sm"
              variant={editing ? 'outline' : 'default'}
              onClick={() => { setEditing(!editing); setFeedback(null); setForm({ ...config }); }}
            >
              {editing ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              {editing ? 'Cancelar' : 'Configurar metas'}
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* Proyección del día */}
        <div
          className={`flex items-center gap-5 rounded-2xl border p-5 ${
            projection.willHitDaily
              ? 'border-[#D3E2D8] bg-[#E5EDE7]/40'
              : 'border-[#E8D9B8] bg-[#F3EAD6]/40'
          }`}
        >
          {projection.willHitDaily ? (
            <Rocket className="h-10 w-10 shrink-0 text-[#2F6B4E]" />
          ) : (
            <Timer className="h-10 w-10 shrink-0 text-[#946A1C]" />
          )}
          <div>
            <p className="text-lg font-medium text-capsula-ink">
              Proyección del día:{' '}
              <span className={projection.willHitDaily ? 'text-[#2F6B4E]' : 'text-[#946A1C]'}>
                ${fmt(projection.dailyProjected)}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-capsula-ink-soft">
              {projection.willHitDaily
                ? `A este ritmo superarás la meta diaria de $${fmt(config.daily)}`
                : `Necesitas $${fmt(Math.max(0, config.daily - actual.today))} más para alcanzar la meta de hoy`}
            </p>
          </div>
        </div>

        {/* Cards de progreso */}
        <div className="grid gap-4 sm:grid-cols-3">
          <MetaCard
            label="Meta diaria"
            Icon={Sun}
            target={config.daily}
            actual={actual.today}
            orders={actual.todayOrders}
            pct={progress.daily}
          />
          <MetaCard
            label="Meta semanal"
            Icon={Calendar}
            target={config.weekly}
            actual={actual.week}
            orders={actual.weekOrders}
            pct={progress.weekly}
          />
          <MetaCard
            label="Meta mensual"
            Icon={CalendarRange}
            target={config.monthly}
            actual={actual.month}
            orders={actual.monthOrders}
            pct={progress.monthly}
          />
        </div>

        {/* Merma */}
        <div
          className={`rounded-2xl border p-5 shadow-cap-soft ${
            wasteOk ? 'border-capsula-line bg-capsula-ivory-surface' : 'border-[#EFD2C8] bg-[#F7E3DB]/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                Control de merma — este mes
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-capsula-ink-muted">Merma registrada</p>
                  <p
                    className={`font-heading text-2xl tracking-[-0.02em] ${
                      wasteOk ? 'text-capsula-navy-deep' : 'text-[#B04A2E]'
                    }`}
                  >
                    ${fmt(actual.wasteThisMonth)}
                  </p>
                </div>
                <div className="text-xl text-capsula-ink-faint">vs</div>
                <div>
                  <p className="text-xs text-capsula-ink-muted">Límite aceptable ({config.wastePercent}%)</p>
                  <p className="font-heading text-2xl tracking-[-0.02em] text-capsula-navy-deep">
                    ${fmt(actual.month * config.wastePercent / 100)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-capsula-ink-muted">% real de ventas</p>
                  <p
                    className={`font-heading text-2xl tracking-[-0.02em] ${
                      wasteOk ? 'text-[#2F6B4E]' : 'text-[#B04A2E]'
                    }`}
                  >
                    {wasteRisk.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            {wasteOk ? (
              <CheckCircle2 className="h-10 w-10 shrink-0 text-[#2F6B4E]" />
            ) : (
              <AlertOctagon className="h-10 w-10 shrink-0 animate-pulse text-[#B04A2E]" />
            )}
          </div>

          {actual.wasteThisMonth === 0 && (
            <p className="mt-3 text-xs italic text-capsula-ink-muted">
              Sin movimientos de merma registrados este mes. Los ajustes de inventario tipo WASTE / ADJUSTMENT_OUT aparecen aquí.
            </p>
          )}
        </div>

        {/* Formulario de edición */}
        {editing && (
          <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft space-y-5">
            <h2 className="font-heading text-lg tracking-[-0.02em] text-capsula-navy-deep">
              Configurar metas
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className={FIELD_LABEL}>Meta diaria (USD)</span>
                <input
                  type="number" min="0" step="50"
                  value={form.daily}
                  onChange={(e) => setForm({ ...form, daily: Number(e.target.value) })}
                  className={FIELD_INPUT}
                />
              </label>

              <label className="space-y-1.5">
                <span className={FIELD_LABEL}>Meta semanal (USD)</span>
                <input
                  type="number" min="0" step="100"
                  value={form.weekly}
                  onChange={(e) => setForm({ ...form, weekly: Number(e.target.value) })}
                  className={FIELD_INPUT}
                />
              </label>

              <label className="space-y-1.5">
                <span className={FIELD_LABEL}>Meta mensual (USD)</span>
                <input
                  type="number" min="0" step="500"
                  value={form.monthly}
                  onChange={(e) => setForm({ ...form, monthly: Number(e.target.value) })}
                  className={FIELD_INPUT}
                />
              </label>

              <label className="space-y-1.5">
                <span className={FIELD_LABEL}>% merma aceptable</span>
                <div className="relative">
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={form.wastePercent}
                    onChange={(e) => setForm({ ...form, wastePercent: Number(e.target.value) })}
                    className={FIELD_INPUT + ' pr-10'}
                  />
                  <span className="absolute right-4 top-2.5 text-sm font-medium text-capsula-ink-muted">%</span>
                </div>
                <p className="text-[11px] text-capsula-ink-muted">
                  Porcentaje de las ventas del mes que puede perderse por merma sin superar el límite.
                </p>
              </label>
            </div>

            {/* Preview */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-capsula-line bg-capsula-ivory-alt p-4 text-center sm:grid-cols-4">
              {[
                { l: 'Diaria', v: form.daily },
                { l: 'Semanal', v: form.weekly },
                { l: 'Mensual', v: form.monthly },
                { l: 'Merma máx.', v: null as number | null, pct: form.wastePercent },
              ].map((item) => (
                <div key={item.l}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">{item.l}</p>
                  <p className="font-heading text-lg tracking-[-0.02em] text-capsula-navy-deep">
                    {item.pct !== undefined ? `${item.pct}%` : `$${item.v?.toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>

            {feedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  feedback.ok
                    ? 'border-[#D3E2D8] bg-[#E5EDE7]/40 text-[#2F6B4E]'
                    : 'border-[#EFD2C8] bg-[#F7E3DB]/40 text-[#B04A2E]'
                }`}
              >
                {feedback.msg}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setEditing(false); setFeedback(null); }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isPending}
                isLoading={isPending}
                className="flex-1"
              >
                <Save className="h-4 w-4" />
                {isPending ? 'Guardando…' : 'Guardar metas'}
              </Button>
            </div>
          </div>
        )}

        {/* Hint para no-admin */}
        {!canEdit && (
          <p className="text-center text-xs italic text-capsula-ink-muted">
            Las metas las configura el gerente desde este mismo módulo.
          </p>
        )}
      </div>
    </div>
  );
}
