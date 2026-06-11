'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Scale, ChevronLeft, ChevronRight, ChevronDown, Loader2, Info, Landmark,
  ArrowDownLeft, ArrowUpRight, Check, X as XIcon, ListChecks, FileText,
} from 'lucide-react';
import {
  getReconciliationMovementsAction, saveMovementReconAction, getReconciliationReportAction,
  type ReconMovementsView, type ReconMovement, type ReconReport,
} from '@/app/actions/treasury.actions';
import { getCaracasNowParts } from '@/lib/datetime';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AccountOption { id: string; name: string; currency: string }

export function ConciliacionView({ accounts, canEdit }: { accounts: AccountOption[]; canEdit: boolean }) {
  const [mode, setMode] = useState<'menu' | 'work' | 'report'>('menu');

  if (mode === 'menu') {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Tesorería</p>
          <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
            <Scale className="h-6 w-6" /> Conciliación Bancaria
          </h1>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <button onClick={() => setMode('work')} className="pos-card p-6 text-left hover:border-capsula-line-strong transition group">
            <span className="h-11 w-11 rounded-full bg-capsula-navy-soft text-capsula-ink flex items-center justify-center group-hover:bg-capsula-navy-deep group-hover:text-capsula-cream transition">
              <ListChecks className="h-5 w-5" />
            </span>
            <h2 className="font-semibold text-lg text-capsula-ink mt-3">Realizar conciliación</h2>
            <p className="text-sm text-capsula-ink-soft mt-1">Concilia movimiento por movimiento: ajusta contraparte, comisión y marca cada uno.</p>
          </button>
          <button onClick={() => setMode('report')} className="pos-card p-6 text-left hover:border-capsula-line-strong transition group">
            <span className="h-11 w-11 rounded-full bg-capsula-navy-soft text-capsula-ink flex items-center justify-center group-hover:bg-capsula-navy-deep group-hover:text-capsula-cream transition">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="font-semibold text-lg text-capsula-ink mt-3">Reporte de conciliación</h2>
            <p className="text-sm text-capsula-ink-soft mt-1">Saldo según sistema vs saldo real, movimientos sin conciliar, diferencia y última conciliación.</p>
          </button>
        </div>
      </div>
    );
  }
  const back = (
    <button onClick={() => setMode('menu')} className="text-sm text-capsula-ink-muted hover:text-capsula-ink inline-flex items-center gap-1.5">
      <ChevronLeft className="h-4 w-4" /> Volver
    </button>
  );
  return mode === 'work'
    ? <RealizarConciliacion accounts={accounts} canEdit={canEdit} back={back} />
    : <ReporteConciliacion accounts={accounts} back={back} />;
}

function RealizarConciliacion({ accounts, canEdit, back }: { accounts: AccountOption[]; canEdit: boolean; back: React.ReactNode }) {
  const nowCcs = getCaracasNowParts();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [year, setYear] = useState(nowCcs.year);
  const [month0, setMonth0] = useState(nowCcs.month);
  const [data, setData] = useState<ReconMovementsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState('');

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true); setError('');
    const res = await getReconciliationMovementsAction({ bankAccountId: accountId, year, month0 });
    setLoading(false);
    if (!res.success || !res.data) { setError(res.error ?? 'Error'); setData(null); return; }
    setData(res.data);
  }, [accountId, year, month0]);

  useEffect(() => { load(); }, [load]);

  function shiftMonth(d: number) {
    let m = month0 + d, y = year;
    if (m < 0) { m = 11; y -= 1; } if (m > 11) { m = 0; y += 1; }
    setMonth0(m); setYear(y);
  }

  type MovementPatch = {
    counterpartyType?: 'NATURAL' | 'JURIDICA';
    commissionRemoved?: boolean;
    commissionOverridePct?: number | null;
    reconciled?: boolean;
    statementAmount?: number | null;
    notes?: string | null;
  };
  async function patch(m: ReconMovement, p: MovementPatch) {
    const key = `${m.sourceType}:${m.sourceId}`;
    setSavingKey(key); setError('');
    const res = await saveMovementReconAction({
      bankAccountId: accountId, sourceType: m.sourceType, sourceId: m.sourceId, dateIso: m.dateIso, ...p,
    });
    setSavingKey('');
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    await load();
  }

  const currency = data?.currency ?? 'BS';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="space-y-1">
        {back}
        <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
          <Scale className="h-6 w-6" /> Realizar conciliación
        </h1>
      </div>

      {accounts.length === 0 ? (
        <div className="pos-card p-10 text-center">
          <Landmark className="h-10 w-10 mx-auto text-capsula-ink-faint" />
          <p className="mt-3 text-capsula-ink-soft">Primero registra cuentas bancarias y terminales.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <select className="pos-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className="pos-btn-secondary h-9 w-9 flex items-center justify-center" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
              <span className="font-semibold text-capsula-ink min-w-[140px] text-center">{MESES[month0]} {year}</span>
              <button onClick={() => shiftMonth(1)} className="pos-btn-secondary h-9 w-9 flex items-center justify-center" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="bg-capsula-ivory-alt border border-capsula-line rounded-2xl p-4 flex gap-3 text-sm text-capsula-ink-soft">
            <Info className="h-5 w-5 shrink-0 text-capsula-ink-muted mt-0.5" />
            <p>Concilia <strong>movimiento por movimiento</strong>. Abre un día y por cada movimiento puedes ajustar la contraparte (natural/jurídica), quitar la comisión, y marcarlo como conciliado cuando coincide con el banco. Montos en {currency}.</p>
          </div>

          {data && (
            <div className="pos-card p-3 flex items-center justify-between text-sm">
              <span className="text-capsula-ink-soft">Movimientos conciliados</span>
              <span className="font-semibold text-capsula-ink tabular-nums">{data.totalReconciled} / {data.totalMovements}</span>
            </div>
          )}

          {error && <div className="pos-card p-3 text-center text-capsula-coral text-sm">{error}</div>}

          {loading ? (
            <div className="pos-card p-10 flex items-center justify-center text-capsula-ink-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !data || data.days.length === 0 ? (
            <div className="pos-card p-10 text-center">
              <Scale className="h-10 w-10 mx-auto text-capsula-ink-faint" />
              <p className="mt-3 text-capsula-ink-soft">Sin movimientos en este mes para esta cuenta.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.days.map((day) => {
                const open = openDays.has(day.dateStamp);
                const allRec = day.countReconciled === day.countTotal;
                return (
                  <div key={day.dateStamp} className="pos-card overflow-hidden">
                    <button
                      onClick={() => setOpenDays((s) => { const n = new Set(s); n.has(day.dateStamp) ? n.delete(day.dateStamp) : n.add(day.dateStamp); return n; })}
                      className="w-full flex items-center justify-between p-4 hover:bg-capsula-ivory-surface"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 text-capsula-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                        <span className="font-semibold text-capsula-ink">{day.dateStamp.slice(8)}/{day.dateStamp.slice(5, 7)}/{day.dateStamp.slice(0, 4)}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${allRec ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' : 'bg-capsula-ivory-alt text-capsula-ink-muted'}`}>
                        {day.countReconciled}/{day.countTotal} conciliados
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-capsula-line overflow-x-auto">
                        <table className="w-full text-sm min-w-[760px]">
                          <thead>
                            <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-capsula-ink-muted border-b border-capsula-line">
                              <th className="text-left p-2 pl-4"></th>
                              <th className="text-left p-2">Movimiento</th>
                              <th className="text-left p-2">Contraparte</th>
                              <th className="text-right p-2">Bs</th>
                              <th className="text-right p-2">$</th>
                              <th className="text-right p-2">Comisión</th>
                              <th className="text-center p-2 pr-4">Conciliado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {day.movements.map((m) => {
                              const key = `${m.sourceType}:${m.sourceId}`;
                              const busy = savingKey === key;
                              return (
                                <tr key={key} className="border-b border-capsula-line last:border-0">
                                  <td className="p-2 pl-4">
                                    {m.kind === 'IN'
                                      ? <ArrowDownLeft className="h-4 w-4 text-[#2F6B4E]" />
                                      : <ArrowUpRight className="h-4 w-4 text-[#B04A2E]" />}
                                  </td>
                                  <td className="p-2">
                                    <div className="text-capsula-ink truncate max-w-[220px]">{m.channel}</div>
                                    {m.reference && <div className="text-[10px] text-capsula-ink-faint truncate">ref: {m.reference}</div>}
                                  </td>
                                  <td className="p-2">
                                    {canEdit ? (
                                      <select className="pos-input py-1 text-xs" value={m.counterpartyType} disabled={busy}
                                        onChange={(e) => patch(m, { counterpartyType: e.target.value as 'NATURAL' | 'JURIDICA' })}>
                                        <option value="NATURAL">Natural</option>
                                        <option value="JURIDICA">Jurídica</option>
                                      </select>
                                    ) : <span className="text-xs">{m.counterpartyType === 'JURIDICA' ? 'Jurídica' : 'Natural'}</span>}
                                  </td>
                                  <td className="p-2 text-right tabular-nums text-capsula-ink-soft">{fmt(m.amountBs)}</td>
                                  <td className="p-2 text-right tabular-nums text-capsula-ink-soft">{fmt(m.amountUsd)}</td>
                                  <td className="p-2 text-right">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <span className={`tabular-nums ${m.commissionRemoved ? 'line-through text-capsula-ink-faint' : 'text-capsula-ink'}`}>{fmt(m.commission)}</span>
                                      {canEdit && (
                                        <button title={m.commissionRemoved ? 'Restaurar comisión' : 'Quitar comisión'} disabled={busy}
                                          onClick={() => patch(m, { commissionRemoved: !m.commissionRemoved })}
                                          className="h-6 w-6 rounded-full hover:bg-capsula-coral/10 text-capsula-ink-muted hover:text-capsula-coral flex items-center justify-center">
                                          <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2 pr-4 text-center">
                                    <button disabled={!canEdit || busy} onClick={() => patch(m, { reconciled: !m.reconciled })}
                                      className={`h-6 w-6 rounded-md border inline-flex items-center justify-center ${m.reconciled ? 'bg-[#2F6B4E] border-[#2F6B4E] text-white' : 'border-capsula-line text-transparent hover:border-capsula-line-strong'}`}>
                                      {busy ? <Loader2 className="h-3 w-3 animate-spin text-capsula-ink-muted" /> : <Check className="h-4 w-4" />}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Reporte de conciliación ──────────────────────────────────────────────────

function ReporteConciliacion({ accounts, back }: { accounts: AccountOption[]; back: React.ReactNode }) {
  const nowCcs = getCaracasNowParts();
  const [accountId, setAccountId] = useState<string>('all');
  const [year, setYear] = useState(nowCcs.year);
  const [month0, setMonth0] = useState(nowCcs.month);
  const [data, setData] = useState<ReconReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [realBalances, setRealBalances] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const res = await getReconciliationReportAction({ bankAccountId: accountId as string, year, month0 });
    setLoading(false);
    if (!res.success || !res.data) { setError(res.error ?? 'Error'); setData(null); return; }
    setData(res.data);
  }, [accountId, year, month0]);
  useEffect(() => { load(); }, [load]);

  function shiftMonth(d: number) {
    let m = month0 + d, y = year;
    if (m < 0) { m = 11; y -= 1; } if (m > 11) { m = 0; y += 1; }
    setMonth0(m); setYear(y);
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="space-y-1">
        {back}
        <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
          <FileText className="h-6 w-6" /> Reporte de conciliación
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <select className="pos-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="all">Todas las cuentas</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="pos-btn-secondary h-9 w-9 flex items-center justify-center" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
          <span className="font-semibold text-capsula-ink min-w-[140px] text-center">{MESES[month0]} {year}</span>
          <button onClick={() => shiftMonth(1)} className="pos-btn-secondary h-9 w-9 flex items-center justify-center" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="bg-capsula-ivory-alt border border-capsula-line rounded-2xl p-4 flex gap-3 text-sm text-capsula-ink-soft">
        <Info className="h-5 w-5 shrink-0 text-capsula-ink-muted mt-0.5" />
        <p>El <strong>saldo según sistema</strong> es el neto de movimientos (ingresos − egresos − comisiones) del período. Ingresa el <strong>saldo real en banco</strong> y el reporte muestra la <strong>diferencia</strong>.</p>
      </div>

      {error && <div className="pos-card p-3 text-center text-capsula-coral text-sm">{error}</div>}

      {loading ? (
        <div className="pos-card p-10 flex items-center justify-center text-capsula-ink-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !data || data.rows.length === 0 ? (
        <div className="pos-card p-10 text-center"><FileText className="h-10 w-10 mx-auto text-capsula-ink-faint" /><p className="mt-3 text-capsula-ink-soft">Sin datos para el filtro.</p></div>
      ) : (
        <div className="pos-card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-capsula-line text-[11px] font-semibold uppercase tracking-[0.12em] text-capsula-ink-muted">
                <th className="text-left p-3">Cuenta</th>
                <th className="text-right p-3">Saldo según sistema</th>
                <th className="text-right p-3">Saldo real en banco</th>
                <th className="text-right p-3">Diferencia</th>
                <th className="text-center p-3">Sin conciliar</th>
                <th className="text-right p-3">Última conciliación</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const realRaw = realBalances[r.accountId] ?? '';
                const real = realRaw.trim() ? parseFloat(realRaw) : null;
                const diff = real != null ? Math.round((real - r.systemBalance) * 100) / 100 : null;
                return (
                  <tr key={r.accountId} className="border-b border-capsula-line last:border-0">
                    <td className="p-3 font-medium text-capsula-ink">{r.accountName} <span className="text-[10px] text-capsula-ink-faint">{r.currency}</span></td>
                    <td className="p-3 text-right tabular-nums text-capsula-ink">{fmt(r.systemBalance)}</td>
                    <td className="p-3 text-right">
                      <input className="pos-input w-32 text-right tabular-nums" type="number" step="0.01" placeholder="—"
                        value={realRaw} onChange={(e) => setRealBalances((s) => ({ ...s, [r.accountId]: e.target.value }))} />
                    </td>
                    <td className={`p-3 text-right tabular-nums font-semibold ${diff != null && Math.abs(diff) > 0.009 ? 'text-capsula-coral' : 'text-capsula-ink'}`}>
                      {diff != null ? fmt(diff) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.unreconciledCount > 0 ? 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]' : 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'}`}>
                        {r.unreconciledCount} mov.
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs text-capsula-ink-soft tabular-nums">
                      {r.lastReconciliationDate ? new Date(r.lastReconciliationDate).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'nunca'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
