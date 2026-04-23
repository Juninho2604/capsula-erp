'use client';

import { useState, useTransition } from 'react';
import { Inbox, Info, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { BroadcastRecord } from '@/app/actions/notifications.actions';
import { createBroadcastAction, dismissBroadcastAction, getAllBroadcastsAdminAction } from '@/app/actions/notifications.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/Badge';

type BroadcastType = 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';

const TYPE_VARIANT: Record<BroadcastType, NonNullable<BadgeProps['variant']>> = {
  INFO: 'info',
  WARNING: 'warn',
  ALERT: 'danger',
  SUCCESS: 'ok',
};
const TYPE_LABELS: Record<BroadcastType, string> = { INFO: 'Info', WARNING: 'Aviso', ALERT: 'Alerta', SUCCESS: 'Éxito' };
const TYPE_ICON: Record<BroadcastType, React.ComponentType<{ className?: string }>> = {
  INFO: Info,
  WARNING: AlertTriangle,
  ALERT: AlertOctagon,
  SUCCESS: CheckCircle2,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AnunciosView({ initialData }: { initialData: BroadcastRecord[] }) {
  const [messages, setMessages] = useState<BroadcastRecord[]>(initialData);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<BroadcastType>('INFO');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState('');

  const reload = async () => {
    const r = await getAllBroadcastsAdminAction();
    if (r.success) setMessages(r.data ?? []);
  };

  const handlePublish = () => {
    if (!title.trim() || !body.trim()) { setFeedback('El título y el mensaje son obligatorios'); return; }
    startTransition(async () => {
      const r = await createBroadcastAction({ title, body, type });
      setFeedback(r.message);
      if (r.success) { setTitle(''); setBody(''); setType('INFO'); reload(); }
    });
  };

  const handleDismiss = (id: string) => {
    startTransition(async () => {
      await dismissBroadcastAction(id);
      reload();
    });
  };

  const active = messages.filter(m => m.isActive);
  const archived = messages.filter(m => !m.isActive);

  const feedbackIsError = feedback.startsWith('Error') || feedback.includes('obligatorio');

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        kicker="Administración"
        title="Anuncios a gerencia"
        description="Los mensajes activos aparecen en la campana del header para todos los usuarios del dashboard."
      />

      <div className="space-y-5">
        {/* Formulario nuevo comunicado */}
        <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 space-y-4 shadow-cap-soft">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Nuevo comunicado</h2>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                Título
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Cierre de caja anticipado"
                className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                Mensaje
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Escribe el comunicado aquí…"
                rows={3}
                className="w-full resize-none rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                Tipo
              </label>
              <div className="flex flex-wrap gap-2">
                {(['INFO', 'WARNING', 'ALERT', 'SUCCESS'] as const).map(t => {
                  const Icon = TYPE_ICON[t];
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active
                        ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
                        : 'border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep'
                        }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {feedback && (
            <p className={`rounded-lg px-3 py-2 text-xs ${feedbackIsError ? 'bg-[#F7E3DB]/60 text-[#B04A2E]' : 'bg-[#E5EDE7]/60 text-[#2F6B4E]'}`}>
              {feedback}
            </p>
          )}

          <Button size="sm" onClick={handlePublish} disabled={isPending} isLoading={isPending}>
            {isPending ? 'Publicando…' : 'Publicar'}
          </Button>
        </div>

        {/* Mensajes activos */}
        <div className="overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
          <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Activos ({active.length})</h2>
          </div>
          {active.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-capsula-ink-muted">
              <Inbox className="h-6 w-6 opacity-50" />
              <p className="text-sm font-medium">Sin mensajes activos</p>
            </div>
          ) : (
            <div className="divide-y divide-capsula-line">
              {active.map(m => {
                const t = m.type as BroadcastType;
                return (
                  <div key={m.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-capsula-ivory-alt/60">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={TYPE_VARIANT[t]}>{TYPE_LABELS[t]}</Badge>
                        <span className="truncate text-sm font-medium text-capsula-ink">{m.title}</span>
                      </div>
                      <p className="text-xs text-capsula-ink-soft">{m.body}</p>
                      <p className="mt-1 text-[11px] text-capsula-ink-muted">
                        {fmtDate(m.createdAt)}{m.expiresAt ? ` · Expira: ${fmtDate(m.expiresAt)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismiss(m.id)}
                      disabled={isPending}
                      className="mt-0.5 shrink-0 text-xs font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover disabled:opacity-50"
                    >
                      Archivar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historial archivado */}
        {archived.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface opacity-80 shadow-cap-soft">
            <div className="border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Historial ({archived.length})</h2>
            </div>
            <div className="divide-y divide-capsula-line">
              {archived.slice(0, 20).map(m => {
                const t = m.type as BroadcastType;
                return (
                  <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <Badge variant={TYPE_VARIANT[t]} className="opacity-60">{TYPE_LABELS[t]}</Badge>
                        <span className="truncate text-sm font-medium text-capsula-ink-muted line-through">{m.title}</span>
                      </div>
                      <p className="text-[11px] text-capsula-ink-muted">{fmtDate(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
