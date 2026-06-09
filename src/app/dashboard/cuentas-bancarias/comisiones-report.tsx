'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Percent, Loader2, Info } from 'lucide-react';
import { getCaracasNowParts } from '@/lib/datetime';
import {
  getBankCommissionsReportAction, type CommissionsReport,
} from '@/app/actions/treasury.actions';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Rango del mes en zona Caracas (medianoche Caracas = 04:00 UTC).
function caracasMonthRange(year: number, month0: number) {
  const start = new Date(Date.UTC(year, month0, 1, 4, 0, 0, 0));
  const end = new Date(Date.UTC(year, month0 + 1, 1, 3, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ComisionesReport() {
  // Mes por defecto en calendario Caracas (UTC cambia de día a las 8pm locales).
  const nowCcs = getCaracasNowParts();
  const [year, setYear] = useState(nowCcs.year);
  const [month0, setMonth0] = useState(nowCcs.month);
  const [data, setData] = useState<CommissionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { start, end } = caracasMonthRange(year, month0);
    const res = await getBankCommissionsReportAction({ start, end });
    setLoading(false);
    if (!res.success) { setError(res.error ?? 'Error'); setData(null); return; }
    setData(res.data ?? null);
  }, [year, month0]);

  useEffect(() => { load(); }, [load]);

  function shiftMonth(delta: number) {
    let m = month0 + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth0(m); setYear(y);
  }

  return (
    <div className="space-y-4">
      {/* Selector de mes */}
      <div className="flex items-center justify-between">
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
          Comisión = monto en Bs de cada cobro por terminal × su % configurado. Se calcula automático
          desde las ventas; no hay que teclear nada. Agrupado por cuenta y semana fiscal (S1–S5).
        </p>
      </div>

      {loading ? (
        <div className="pos-card p-10 flex items-center justify-center text-capsula-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="pos-card p-6 text-center text-capsula-coral">{error}</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="pos-card p-10 text-center">
          <Percent className="h-10 w-10 mx-auto text-capsula-ink-faint" />
          <p className="mt-3 text-capsula-ink-soft">Sin comisiones en este período.</p>
          <p className="text-xs text-capsula-ink-faint mt-1">
            Requiere terminales con % &gt; 0 y ventas en Bs cobradas por esos terminales.
          </p>
        </div>
      ) : (
        <div className="pos-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-capsula-line text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                <th className="text-left p-3">Cuenta</th>
                <th className="text-left p-3">Semana</th>
                <th className="text-right p-3">Bruto Bs</th>
                <th className="text-right p-3">Comisión Bs</th>
                <th className="text-right p-3">Neto Bs</th>
                <th className="text-right p-3"># Cobros</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={`${r.bankAccountId}-${r.fiscalWeek}`} className="border-b border-capsula-line last:border-0">
                  <td className="p-3 text-capsula-ink font-medium">{r.accountName}</td>
                  <td className="p-3 text-capsula-ink-soft">{r.fiscalWeek}</td>
                  <td className="p-3 text-right tabular-nums text-capsula-ink-soft">{fmt(r.grossBs)}</td>
                  <td className="p-3 text-right tabular-nums text-capsula-ink font-semibold">{fmt(r.commissionBs)}</td>
                  <td className="p-3 text-right tabular-nums text-capsula-ink-soft">{fmt(r.netBs)}</td>
                  <td className="p-3 text-right tabular-nums text-capsula-ink-muted">{r.count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-capsula-line-strong font-semibold text-capsula-ink">
                <td className="p-3" colSpan={2}>TOTAL</td>
                <td className="p-3 text-right tabular-nums">{fmt(data.totalGrossBs)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(data.totalCommissionBs)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(data.totalNetBs)}</td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
