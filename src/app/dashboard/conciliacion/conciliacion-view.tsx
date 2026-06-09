'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Scale, ChevronLeft, ChevronRight, Loader2, Info, Check, Landmark,
} from 'lucide-react';
import {
  getReconciliationViewAction, saveReconciliationAction,
  type ReconciliationDayRow,
} from '@/app/actions/treasury.actions';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Pendiente', cls: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]' },
  RECONCILED: { label: 'Conciliado', cls: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' },
  DISCREPANCY: { label: 'Diferencia', cls: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]' },
};

interface AccountOption { id: string; name: string; currency: string }

export function ConciliacionView({ accounts, canEdit }: { accounts: AccountOption[]; canEdit: boolean }) {
  const now = new Date();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month0, setMonth0] = useState(now.getUTCMonth());
  const [rows, setRows] = useState<ReconciliationDayRow[]>([]);
  const [currency, setCurrency] = useState(accounts[0]?.currency ?? 'BS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // edición local del estado de cuenta por día
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingStamp, setSavingStamp] = useState('');

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true); setError('');
    const res = await getReconciliationViewAction({ bankAccountId: accountId, year, month0 });
    setLoading(false);
    if (!res.success || !res.data) { setError(res.error ?? 'Error'); setRows([]); return; }
    setRows(res.data.rows);
    setCurrency(res.data.currency);
    setDrafts({});
  }, [accountId, year, month0]);

  useEffect(() => { load(); }, [load]);

  function shiftMonth(delta: number) {
    let m = month0 + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth0(m); setYear(y);
  }

  async function save(row: ReconciliationDayRow) {
    const raw = drafts[row.dateStamp] ?? (row.statementIn != null ? String(row.statementIn) : '');
    const statementIn = parseFloat(raw);
    if (isNaN(statementIn)) { setError('Ingresá el monto del estado de cuenta'); return; }
    setSavingStamp(row.dateStamp); setError('');
    const res = await saveReconciliationAction({ bankAccountId: accountId, dateStamp: row.dateStamp, statementIn });
    setSavingStamp('');
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    await load();
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Tesorería</p>
        <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
          <Scale className="h-6 w-6" /> Conciliación Bancaria
        </h1>
      </div>

      {accounts.length === 0 ? (
        <div className="pos-card p-10 text-center">
          <Landmark className="h-10 w-10 mx-auto text-capsula-ink-faint" />
          <p className="mt-3 text-capsula-ink-soft">Primero registrá cuentas bancarias y terminales.</p>
        </div>
      ) : (
        <>
          {/* Controles */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <select
              className="pos-input"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setCurrency(accounts.find((a) => a.id === e.target.value)?.currency ?? 'BS');
              }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className="pos-btn-secondary h-9 w-9 flex items-center justify-center" aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-capsula-ink min-w-[140px] text-center">{MESES[month0]} {year}</span>
              <button onClick={() => shiftMonth(1)} className="pos-btn-secondary h-9 w-9 flex items-center justify-center" aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-capsula-ivory-alt border border-capsula-line rounded-2xl p-4 flex gap-3 text-sm text-capsula-ink-soft">
            <Info className="h-5 w-5 shrink-0 text-capsula-ink-muted mt-0.5" />
            <p>
              Kpsula trae el <strong>esperado</strong> (ventas que entraron por los terminales) y la comisión calculada.
              Tecleá el <strong>estado de cuenta</strong> (lo que el banco dice que llegó) y guardá: el <strong>diferencial</strong>
              {' '}= (esperado − estado) − comisión. Si ≈ 0, la cuenta concilia. Montos en {currency}.
            </p>
          </div>

          {error && <div className="pos-card p-3 text-center text-capsula-coral text-sm">{error}</div>}

          {loading ? (
            <div className="pos-card p-10 flex items-center justify-center text-capsula-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="pos-card p-10 text-center">
              <Scale className="h-10 w-10 mx-auto text-capsula-ink-faint" />
              <p className="mt-3 text-capsula-ink-soft">Sin movimientos esperados este mes para esta cuenta.</p>
              <p className="text-xs text-capsula-ink-faint mt-1">Requiere terminales mapeados y ventas en el período.</p>
            </div>
          ) : (
            <div className="pos-card overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="border-b border-capsula-line text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    <th className="text-left p-3">Día</th>
                    <th className="text-left p-3">Semana</th>
                    <th className="text-right p-3">Esperado</th>
                    <th className="text-right p-3">Comisión</th>
                    <th className="text-right p-3">Estado de cuenta</th>
                    <th className="text-right p-3">Diferencial</th>
                    <th className="text-center p-3">Estado</th>
                    {canEdit && <th className="p-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.OPEN;
                    const draftVal = drafts[r.dateStamp] ?? (r.statementIn != null ? String(r.statementIn) : '');
                    return (
                      <tr key={r.dateStamp} className="border-b border-capsula-line last:border-0">
                        <td className="p-3 text-capsula-ink font-medium tabular-nums">{r.dateStamp.slice(8)}/{r.dateStamp.slice(5, 7)}</td>
                        <td className="p-3 text-capsula-ink-soft">{r.fiscalWeek}</td>
                        <td className="p-3 text-right tabular-nums text-capsula-ink-soft">{fmt(r.expectedIn)}</td>
                        <td className="p-3 text-right tabular-nums text-capsula-ink-muted">{fmt(r.commissionCalc)}</td>
                        <td className="p-3 text-right">
                          {canEdit ? (
                            <input
                              className="pos-input w-32 text-right tabular-nums"
                              type="number" step="0.01" inputMode="decimal"
                              value={draftVal}
                              placeholder="—"
                              onChange={(e) => setDrafts((d) => ({ ...d, [r.dateStamp]: e.target.value }))}
                            />
                          ) : (
                            <span className="tabular-nums text-capsula-ink-soft">{r.statementIn != null ? fmt(r.statementIn) : '—'}</span>
                          )}
                        </td>
                        <td className={`p-3 text-right tabular-nums font-semibold ${r.status === 'DISCREPANCY' ? 'text-capsula-coral' : 'text-capsula-ink'}`}>
                          {r.statementIn != null ? fmt(r.differential) : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="p-3 text-right">
                            <button
                              onClick={() => save(r)}
                              disabled={savingStamp === r.dateStamp}
                              className="pos-btn px-3 py-1.5 inline-flex items-center gap-1.5 text-xs disabled:opacity-60"
                            >
                              {savingStamp === r.dateStamp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Guardar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
