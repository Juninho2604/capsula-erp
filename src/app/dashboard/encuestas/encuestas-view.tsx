'use client';

import { useState, useTransition } from 'react';
import { Star, RefreshCw, Calendar, MessageSquare, UserCircle2, Tag } from 'lucide-react';
import { getSatisfactionSurveysAction, type SatisfactionReport } from '@/app/actions/satisfaction.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { SATISFACTION_META, isSatisfactionRating, type SatisfactionRating } from '@/lib/sales/satisfaction';

const CARD = 'rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft';
const KICKER = 'text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted';

function RatingBadge({ rating }: { rating: string }) {
  if (!isSatisfactionRating(rating)) {
    return <span className="rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-xs text-capsula-ink-muted">{rating}</span>;
  }
  const m = SATISFACTION_META[rating as SatisfactionRating];
  const tone = m.tone === 'ok'
    ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
    : m.tone === 'warn'
      ? 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]'
      : 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <span>{m.emoji}</span> {m.label}
    </span>
  );
}

export function EncuestasView({ initialData, initialDate }: { initialData: SatisfactionReport | null; initialDate: string }) {
  const [data, setData] = useState<SatisfactionReport | null>(initialData);
  const [date, setDate] = useState(initialDate);
  const [isPending, startTransition] = useTransition();

  const load = (d: string) => {
    setDate(d);
    startTransition(async () => {
      const res = await getSatisfactionSurveysAction(d);
      setData(res.data ?? null);
    });
  };

  const s = data?.summary;
  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        kicker="Calidad"
        title="Satisfacción del cliente"
        description="Encuestas registradas en el POS al cerrar cada mesa"
        actions={
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2">
            <Calendar className="h-3.5 w-3.5 text-capsula-ink-muted" />
            <input
              type="date"
              value={date}
              onChange={(e) => load(e.target.value)}
              className="bg-transparent text-sm tabular-nums text-capsula-ink focus:outline-none cursor-pointer"
            />
          </div>
        }
      />

      <div className="space-y-6">
        {/* Resumen */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={CARD}>
            <p className={KICKER}>Respuestas</p>
            <p className="mt-1 font-semibold text-2xl tracking-[-0.02em] tabular-nums text-capsula-ink">{s?.total ?? 0}</p>
            <p className="mt-0.5 text-xs text-capsula-ink-soft">{displayDate}</p>
          </div>
          <div className={CARD}>
            <p className={KICKER}>Promedio</p>
            <p className="mt-1 font-semibold text-2xl tracking-[-0.02em] tabular-nums text-capsula-ink">
              {(s?.avgScore ?? 0).toFixed(2)}<span className="text-sm text-capsula-ink-muted"> / 4</span>
            </p>
          </div>
          <div className={`${CARD} border-[#D3E2D8] bg-[#E5EDE7]/40`}>
            <p className={KICKER}>% Positivas</p>
            <p className="mt-1 font-semibold text-2xl tracking-[-0.02em] tabular-nums text-[#2F6B4E] dark:text-[#6FB88F]">
              {(s?.positivePct ?? 0).toFixed(1)}%
            </p>
            <p className="mt-0.5 text-xs text-capsula-ink-soft">Excelente + Buena</p>
          </div>
          <div className={CARD}>
            <p className={KICKER}>Distribución</p>
            <div className="mt-2 space-y-1">
              {(['EXCELENTE', 'BUENA', 'REGULAR', 'MALA'] as const).map(r => {
                const count = s?.counts[r] ?? 0;
                const pct = (s?.total ?? 0) > 0 ? (count / (s!.total)) * 100 : 0;
                return (
                  <div key={r} className="flex items-center gap-2 text-xs">
                    <span className="w-4">{SATISFACTION_META[r].emoji}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-capsula-ivory-alt">
                      <div className="h-full rounded-full bg-capsula-navy-deep" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-5 text-right tabular-nums text-capsula-ink-muted">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Por mesonero */}
        {(data?.byWaiter?.length ?? 0) > 0 && (
          <div className={CARD}>
            <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Por mesonero</h3>
            <div className="space-y-2">
              {data!.byWaiter.map(w => (
                <div key={w.waiterName} className="flex items-center gap-3 text-sm">
                  <UserCircle2 className="h-4 w-4 shrink-0 text-capsula-ink-muted" />
                  <span className="flex-1 truncate text-capsula-ink">{w.waiterName}</span>
                  <span className="text-xs text-capsula-ink-muted tabular-nums">{w.total} resp.</span>
                  <span className="w-16 text-right text-xs tabular-nums text-capsula-ink-soft">{w.avgScore.toFixed(2)}/4</span>
                  <span className="w-14 text-right text-xs font-semibold tabular-nums text-[#2F6B4E] dark:text-[#6FB88F]">{w.positivePct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detalle */}
        <div className={CARD + ' p-0 overflow-hidden'}>
          <div className="flex items-center justify-between border-b border-capsula-line px-5 py-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Detalle de respuestas</h3>
            {isPending && <RefreshCw className="h-4 w-4 animate-spin text-capsula-ink-muted" />}
          </div>
          {(data?.rows?.length ?? 0) === 0 ? (
            <div className="p-10 text-center">
              <Star className="mx-auto h-10 w-10 text-capsula-ink-faint" />
              <p className="mt-2 text-sm text-capsula-ink-muted">Sin encuestas registradas este día.</p>
            </div>
          ) : (
            <div className="divide-y divide-capsula-line">
              {data!.rows.map(row => (
                <div key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <RatingBadge rating={row.rating} />
                  {row.tableName && (
                    <span className="inline-flex items-center gap-1 text-xs text-capsula-ink-soft">
                      <Tag className="h-3 w-3 text-capsula-ink-muted" /> {row.tableName}
                    </span>
                  )}
                  {row.waiterName && <span className="text-xs text-capsula-ink-muted">{row.waiterName}</span>}
                  {row.comment && (
                    <span className="inline-flex items-center gap-1.5 flex-1 min-w-[180px] text-capsula-ink">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-capsula-ink-muted" />
                      <span className="italic">{row.comment}</span>
                    </span>
                  )}
                  <span className="ml-auto text-xs tabular-nums text-capsula-ink-muted">
                    {new Date(row.createdAt).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
