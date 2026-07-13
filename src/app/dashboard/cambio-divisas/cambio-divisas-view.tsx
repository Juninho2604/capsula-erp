'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  Plus, X as XIcon, Check, ArrowLeftRight, Ban, Landmark, DollarSign,
  Banknote, Trash2, Loader2,
} from 'lucide-react';
import {
  createCurrencyExchangeAction, voidCurrencyExchangeAction,
  type CurrencyExchangeData, type ExchangeBankAccount,
} from '@/app/actions/currency-exchange.actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number, cur: string) => cur === 'BS' ? `Bs ${fmt(n)}` : `$${fmt(n)}`;
const todayStamp = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
};

interface Props {
  initialExchanges: CurrencyExchangeData[];
  accounts: ExchangeBankAccount[];
  dayRate: number | null;
  canManage: boolean;
}

interface DestLine { bankAccountId: string; amount: string; reference: string }

export function CambioDivisasView({ initialExchanges, accounts, dayRate, canManage }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [voidTarget, setVoidTarget] = useState<CurrencyExchangeData | null>(null);

  const active = initialExchanges.filter((e) => e.status === 'ACTIVE');

  // KPIs del mes actual (Caracas)
  const monthPrefix = todayStamp().slice(0, 7);
  const monthExchanges = active.filter((e) =>
    new Date(e.exchangeDate).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }).startsWith(monthPrefix)
  );
  const monthUsdOut = monthExchanges.filter((e) => e.currencyOut === 'USD').reduce((s, e) => s + e.amountOut, 0);
  const monthBsIn = monthExchanges.filter((e) => e.currencyIn === 'BS').reduce((s, e) => s + e.amountIn, 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        kicker="Finanzas"
        title="Cambio de divisas"
        description="Registro de cambios entre monedas: salida de una moneda e ingreso a las cuentas destino"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Registrar cambio
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">$ cambiados este mes</p>
              <DollarSign className="h-4 w-4 text-capsula-ink-muted" />
            </div>
            <p className="font-semibold text-2xl tracking-[-0.02em] tabular-nums text-capsula-ink">${fmt(monthUsdOut)}</p>
          </div>
          <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Bs recibidos este mes</p>
              <Banknote className="h-4 w-4 text-capsula-ink-muted" />
            </div>
            <p className="font-semibold text-2xl tracking-[-0.02em] tabular-nums text-capsula-ink">Bs {fmt(monthBsIn)}</p>
          </div>
          <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Tasa del día</p>
              <ArrowLeftRight className="h-4 w-4 text-capsula-ink-muted" />
            </div>
            <p className="font-semibold text-2xl tracking-[-0.02em] tabular-nums text-capsula-ink">
              {dayRate ? `Bs ${fmt(dayRate)}` : '—'}
            </p>
            <p className="mt-0.5 text-xs text-capsula-ink-soft">por 1 USD</p>
          </div>
        </div>

        {/* Lista */}
        {initialExchanges.length === 0 ? (
          <div className="pos-card p-10 text-center">
            <ArrowLeftRight className="h-10 w-10 mx-auto text-capsula-ink-faint" />
            <p className="mt-3 text-capsula-ink-soft">Aún no hay cambios registrados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {initialExchanges.map((e) => {
              const voided = e.status === 'VOID';
              return (
                <div key={e.id} className={`pos-card p-4 ${voided ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold tabular-nums text-capsula-ink">
                          {money(e.amountOut, e.currencyOut)}
                        </span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-capsula-ink-muted shrink-0" />
                        <span className="font-semibold tabular-nums text-capsula-ink">
                          {money(e.amountIn, e.currencyIn)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9] tabular-nums">
                          tasa {fmt(e.rate)}
                        </span>
                        {voided && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]">
                            Anulado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-capsula-ink-muted mt-1">
                        {new Date(e.exchangeDate).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' })}
                        {e.fromAccountName ? ` · sale de: ${e.fromAccountName}` : ''}
                        {' · '}{e.createdByName}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.destinations.map((d) => (
                          <span key={d.id} className="inline-flex items-center gap-1 rounded-lg bg-capsula-ivory-alt border border-capsula-line px-2 py-1 text-xs text-capsula-ink">
                            <Landmark className="h-3 w-3 text-capsula-ink-muted" />
                            {d.bankAccountName}: <span className="font-semibold tabular-nums">{money(d.amount, e.currencyIn)}</span>
                            {d.reference && <span className="text-capsula-ink-muted">· ref {d.reference}</span>}
                          </span>
                        ))}
                      </div>
                      {e.notes && <p className="text-xs text-capsula-ink-soft mt-1">{e.notes}</p>}
                      {voided && e.voidReason && <p className="text-xs text-capsula-coral mt-1">Motivo: {e.voidReason}</p>}
                    </div>
                    {canManage && !voided && (
                      <button
                        onClick={() => setVoidTarget(e)}
                        className="pos-btn-danger px-3 py-1.5 text-xs inline-flex items-center gap-1.5 shrink-0"
                      >
                        <Ban className="h-3.5 w-3.5" /> Anular
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <CreateExchangeModal
          accounts={accounts}
          dayRate={dayRate}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); router.refresh(); }}
        />
      )}
      {voidTarget && (
        <VoidModal
          exchange={voidTarget}
          onClose={() => setVoidTarget(null)}
          onSaved={() => { setVoidTarget(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function CreateExchangeModal({ accounts, dayRate, onClose, onSaved }: {
  accounts: ExchangeBankAccount[]; dayRate: number | null; onClose: () => void; onSaved: () => void;
}) {
  const [exchangeDate, setExchangeDate] = useState(todayStamp());
  const [currencyOut, setCurrencyOut] = useState<'USD' | 'BS'>('USD');
  const [amountOut, setAmountOut] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [dests, setDests] = useState<DestLine[]>([{ bankAccountId: '', amount: '', reference: '' }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currencyIn = currencyOut === 'USD' ? 'BS' : 'USD';
  const outAccounts = useMemo(() => accounts.filter((a) => a.currency === currencyOut), [accounts, currencyOut]);
  const inAccounts = useMemo(() => accounts.filter((a) => a.currency === currencyIn), [accounts, currencyIn]);

  const amountOutNum = parseFloat(amountOut) || 0;
  const totalIn = dests.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const impliedRate = amountOutNum > 0 && totalIn > 0
    ? (currencyOut === 'USD' ? totalIn / amountOutNum : amountOutNum / totalIn)
    : 0;
  const suggestedIn = dayRate && amountOutNum > 0
    ? (currencyOut === 'USD' ? amountOutNum * dayRate : amountOutNum / dayRate)
    : 0;

  const setDest = (idx: number, patch: Partial<DestLine>) =>
    setDests((ds) => ds.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  function switchCurrency(cur: 'USD' | 'BS') {
    setCurrencyOut(cur);
    setFromAccountId('');
    setDests([{ bankAccountId: '', amount: '', reference: '' }]);
  }

  async function submit() {
    setError('');
    if (amountOutNum <= 0) { setError('Indica el monto que sale'); return; }
    const lines = dests.filter((d) => d.bankAccountId && (parseFloat(d.amount) || 0) > 0);
    if (lines.length === 0) { setError('Agrega al menos una cuenta destino con monto'); return; }
    setSaving(true);
    const res = await createCurrencyExchangeAction({
      exchangeDate,
      currencyOut,
      amountOut: amountOutNum,
      fromAccountId: fromAccountId || null,
      destinations: lines.map((d) => ({
        bankAccountId: d.bankAccountId,
        amount: parseFloat(d.amount) || 0,
        reference: d.reference || undefined,
      })),
      notes: notes || undefined,
    });
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    toast.success('Cambio registrado');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-capsula-ivory border border-capsula-line w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="border-b border-capsula-line p-5 flex items-center justify-between sticky top-0 bg-capsula-ivory z-10">
          <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Registrar cambio de divisas</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center" aria-label="Cerrar">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ¿Qué moneda sale? */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-2">¿Qué moneda entregas?</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => switchCurrency('USD')}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${currencyOut === 'USD' ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream' : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep/40'}`}>
                <DollarSign className="h-4 w-4" /> Dólares → recibo Bs
              </button>
              <button type="button" onClick={() => switchCurrency('BS')}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${currencyOut === 'BS' ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream' : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep/40'}`}>
                <Banknote className="h-4 w-4" /> Bolívares → recibo $
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Fecha</span>
              <input type="date" className="pos-input w-full py-3" value={exchangeDate} onChange={(e) => setExchangeDate(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                Monto que sale ({currencyOut === 'USD' ? '$' : 'Bs'})
              </span>
              <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
                className="pos-input w-full py-3 text-base tabular-nums" value={amountOut} onChange={(e) => setAmountOut(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Sale de (opcional)</span>
              <select className="pos-input w-full py-3" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
                <option value="">— Efectivo / sin cuenta —</option>
                {outAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>

          {/* Destinos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                Entra a ({currencyIn === 'BS' ? 'Bs' : '$'}) — cuentas destino
              </p>
              {suggestedIn > 0 && (
                <p className="text-xs text-capsula-ink-muted tabular-nums">
                  Sugerido a tasa del día: {money(Math.round(suggestedIn * 100) / 100, currencyIn)}
                </p>
              )}
            </div>
            {inAccounts.length === 0 ? (
              <p className="text-sm text-capsula-coral">
                No hay cuentas activas en {currencyIn === 'BS' ? 'bolívares' : 'dólares'}. Créalas en Cuentas Bancarias.
              </p>
            ) : dests.map((d, idx) => (
              <div key={idx} className="grid grid-cols-[minmax(0,3fr)_minmax(110px,2fr)_minmax(90px,2fr)_auto] gap-2 items-center">
                <select className="pos-input w-full py-3 min-w-0" value={d.bankAccountId} onChange={(e) => setDest(idx, { bankAccountId: e.target.value })}>
                  <option value="">— cuenta —</option>
                  {inAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder={`Monto ${currencyIn === 'BS' ? 'Bs' : '$'}`}
                  className="pos-input w-full py-3 tabular-nums" value={d.amount} onChange={(e) => setDest(idx, { amount: e.target.value })} />
                <input placeholder="Ref." className="pos-input w-full py-3" value={d.reference} onChange={(e) => setDest(idx, { reference: e.target.value })} />
                <button type="button" onClick={() => setDests((ds) => ds.length > 1 ? ds.filter((_, i) => i !== idx) : ds)}
                  className="text-capsula-ink-muted hover:text-capsula-coral p-2" aria-label="Quitar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setDests((ds) => [...ds, { bankAccountId: '', amount: '', reference: '' }])}
              className="text-xs font-semibold text-capsula-ink-muted hover:text-capsula-ink inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Agregar otra cuenta
            </button>
          </div>

          {/* Resumen */}
          <div className="rounded-xl bg-capsula-ivory-alt border border-capsula-line p-4 space-y-1 text-sm">
            <div className="flex justify-between text-capsula-ink">
              <span>Sale</span><span className="font-semibold tabular-nums">{money(amountOutNum, currencyOut)}</span>
            </div>
            <div className="flex justify-between text-capsula-ink">
              <span>Entra (suma destinos)</span><span className="font-semibold tabular-nums">{money(Math.round(totalIn * 100) / 100, currencyIn)}</span>
            </div>
            <div className="flex justify-between text-capsula-ink-muted text-xs pt-1 border-t border-capsula-line">
              <span>Tasa implícita del cambio</span>
              <span className="tabular-nums">{impliedRate > 0 ? `Bs ${fmt(impliedRate)} por $` : '—'}</span>
            </div>
            {dayRate != null && impliedRate > 0 && Math.abs(impliedRate - dayRate) / dayRate > 0.05 && (
              <p className="text-xs text-[#946A1C] dark:text-[#E8D9B8] pt-1">
                La tasa implícita difiere más de 5% de la tasa del día (Bs {fmt(dayRate)}). Verifica los montos.
              </p>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Notas</span>
            <textarea className="pos-input w-full resize-none" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: cambio con casa de cambio X para pagar proveedores" />
          </label>

          {error && <p className="text-sm text-capsula-coral">{error}</p>}
        </div>

        <div className="border-t border-capsula-line p-4 flex gap-3">
          <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
          <button onClick={submit} disabled={saving} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Registrar cambio
          </button>
        </div>
      </div>
    </div>
  );
}

function VoidModal({ exchange, onClose, onSaved }: {
  exchange: CurrencyExchangeData; onClose: () => void; onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!reason.trim()) { setError('Indica el motivo'); return; }
    setSaving(true);
    const res = await voidCurrencyExchangeAction(exchange.id, reason);
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    toast.success('Cambio anulado');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="border-b border-capsula-line p-5 flex items-center justify-between">
          <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Anular cambio</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center" aria-label="Cerrar">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-capsula-ink-soft">
            Se anulará el cambio de <strong className="tabular-nums">{money(exchange.amountOut, exchange.currencyOut)}</strong> por{' '}
            <strong className="tabular-nums">{money(exchange.amountIn, exchange.currencyIn)}</strong>. El registro queda visible como anulado.
          </p>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Motivo *</span>
            <input className="pos-input w-full py-3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: monto mal tecleado" />
          </label>
          {error && <p className="text-sm text-capsula-coral">{error}</p>}
        </div>
        <div className="border-t border-capsula-line p-4 flex gap-3">
          <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
          <button onClick={submit} disabled={saving} className="pos-btn-danger flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            <Ban className="h-4 w-4" /> {saving ? 'Anulando…' : 'Anular'}
          </button>
        </div>
      </div>
    </div>
  );
}
