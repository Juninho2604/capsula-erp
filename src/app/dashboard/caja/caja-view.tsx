'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  getCashRegistersAction, openCashRegisterAction, closeCashRegisterAction,
  updateRegisterOperatorsAction,
  type CashRegisterData,
} from '@/app/actions/cash-register.actions';
import { getEndOfDaySummaryAction } from '@/app/actions/sales.actions';
import { BillDenominationInput } from '@/components/pos/BillDenominationInput';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import {
  Wallet, Plus, Eye, ChevronLeft, ChevronRight, X, Loader2, Coins,
  UserPlus, RefreshCw, Lock, Unlock, TrendingUp, TrendingDown,
  AlertTriangle, Check, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

const SHIFT_TYPES = [
  { value: 'MORNING', label: 'Mañana' },
  { value: 'DAY', label: 'Día' },
  { value: 'NIGHT', label: 'Noche' },
];

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const BILL_DENOMS = [100, 50, 20, 10, 5, 1] as const;

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDenominations(json: string | null): Record<string, number> | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function DenomBreakdown({ json, label }: { json: string | null; label: string }) {
  const data = parseDenominations(json);
  if (!data) return null;
  return (
    <div className="mt-2 text-[12px]">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">{label}</p>
      {BILL_DENOMS.map(d => {
        const count = data[String(d)] ?? 0;
        if (!count) return null;
        return (
          <div key={d} className="flex justify-between text-capsula-ink-soft">
            <span className="font-mono">${d} × {count}</span>
            <span className="font-mono">${fmt(d * count)}</span>
          </div>
        );
      })}
      {data.total != null && (
        <div className="mt-1 flex justify-between border-t border-capsula-line pt-1 font-medium text-capsula-ink">
          <span>Total</span>
          <span className="font-mono font-semibold">${fmt(data.total)}</span>
        </div>
      )}
    </div>
  );
}

interface Props {
  initialRegisters: CashRegisterData[];
  currentUserRole: string;
  currentMonth: number;
  currentYear: number;
}

export function CajaView({ initialRegisters, currentUserRole, currentMonth, currentYear }: Props) {
  const [registers, setRegisters] = useState<CashRegisterData[]>(initialRegisters);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [closeTarget, setCloseTarget] = useState<CashRegisterData | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'].includes(currentUserRole);

  const [openForm, setOpenForm] = useState({ registerName: 'Caja Restaurante', shiftType: 'DAY', openingCashUsd: '', openingCashBs: '', notes: '' });
  const [closeForm, setCloseForm] = useState({ closingCashUsd: '', closingCashBs: '', notes: '' });
  const [openDenom, setOpenDenom] = useState<{ json: string; total: number } | null>(null);
  const [closeDenom, setCloseDenom] = useState<{ json: string; total: number } | null>(null);
  const [showOpenDenom, setShowOpenDenom] = useState(false);
  const [showCloseDenom, setShowCloseDenom] = useState(false);
  const [denomModal, setDenomModal] = useState<CashRegisterData | null>(null);
  const [shiftTips, setShiftTips] = useState<{ propinas: number; propinaCount: number } | null>(null);

  // Fetch propinas for the shift being closed
  useEffect(() => {
    if (!closeTarget) { setShiftTips(null); return; }
    const dateStr = new Date(closeTarget.shiftDate).toISOString().slice(0, 10);
    getEndOfDaySummaryAction(dateStr).then(res => {
      if (res.success && res.data) {
        setShiftTips({ propinas: res.data.propinas, propinaCount: res.data.propinaCount });
      }
    });
  }, [closeTarget]);

  // Gestión de operadoras por turno
  const [operatorModal, setOperatorModal] = useState<CashRegisterData | null>(null);
  const [operatorInput, setOperatorInput] = useState('');
  const [operatorMode, setOperatorMode] = useState<'add' | 'replace'>('add');

  const parseOperators = (json: string | null): string[] => {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  };

  const handleOperatorUpdate = async (mode: 'add' | 'replace') => {
    if (!operatorModal || !operatorInput.trim()) return;
    startTransition(async () => {
      const result = await updateRegisterOperatorsAction(operatorModal.id, operatorInput.trim(), mode);
      if (result.success) {
        toast.success(mode === 'add' ? 'Cajera agregada' : 'Turno actualizado');
        setOperatorInput('');
        setOperatorModal(null);
        loadPeriod(selectedMonth, selectedYear);
      } else {
        toast.error(result.error ?? 'Error');
      }
    });
  };

  const loadPeriod = (month: number, year: number) => {
    startTransition(async () => {
      const result = await getCashRegistersAction({ month, year });
      if (result.data) setRegisters(result.data);
    });
  };

  const handleMonthChange = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(m); setSelectedYear(y);
    loadPeriod(m, y);
  };

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openForm.registerName.trim()) { toast.error('Nombre de caja requerido'); return; }
    startTransition(async () => {
      const cashUsd = showOpenDenom && openDenom && openDenom.total > 0
        ? openDenom.total
        : parseFloat(openForm.openingCashUsd) || 0;
      const result = await openCashRegisterAction({
        registerName: openForm.registerName,
        shiftType: openForm.shiftType,
        openingCashUsd: cashUsd,
        openingCashBs: parseFloat(openForm.openingCashBs) || 0,
        notes: openForm.notes,
        openingDenominationsJson: showOpenDenom && openDenom?.json ? openDenom.json : undefined,
      });
      if (result.success) {
        toast.success('Caja abierta');
        setShowOpenForm(false);
        setShowOpenDenom(false);
        setOpenDenom(null);
        setOpenForm({ registerName: 'Caja Restaurante', shiftType: 'DAY', openingCashUsd: '', openingCashBs: '', notes: '' });
        loadPeriod(selectedMonth, selectedYear);
      } else {
        toast.error(result.error ?? 'Error al abrir caja');
      }
    });
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeTarget) return;
    startTransition(async () => {
      const cashUsd = showCloseDenom && closeDenom && closeDenom.total > 0
        ? closeDenom.total
        : parseFloat(closeForm.closingCashUsd) || 0;
      const result = await closeCashRegisterAction(closeTarget.id, {
        closingCashUsd: cashUsd,
        closingCashBs: parseFloat(closeForm.closingCashBs) || 0,
        notes: closeForm.notes,
        closingDenominationsJson: showCloseDenom && closeDenom?.json ? closeDenom.json : undefined,
      });
      if (result.success) {
        toast.success('Caja cerrada');
        setCloseTarget(null);
        setShowCloseDenom(false);
        setCloseDenom(null);
        setCloseForm({ closingCashUsd: '', closingCashBs: '', notes: '' });
        loadPeriod(selectedMonth, selectedYear);
      } else {
        toast.error(result.error ?? 'Error al cerrar caja');
      }
    });
  };

  const openRegisters = registers.filter(r => r.status === 'OPEN');
  const closedRegisters = registers.filter(r => r.status === 'CLOSED');

  const monthlyStats = {
    totalSales: closedRegisters.reduce((s: number, r) => s + (r.totalSalesUsd ?? 0), 0),
    totalExpenses: closedRegisters.reduce((s: number, r) => s + (r.totalExpenses ?? 0), 0),
    totalDifference: closedRegisters.reduce((s: number, r) => s + (r.difference ?? 0), 0),
    avgDifference: closedRegisters.length > 0
      ? closedRegisters.reduce((s: number, r) => s + (r.difference ?? 0), 0) / closedRegisters.length
      : 0,
    shiftsCount: closedRegisters.length,
    perfectShifts: closedRegisters.filter(r => Math.abs(r.difference ?? 0) < 1).length,
  };

  const diffTrend = [...closedRegisters]
    .sort((a, b) => new Date(a.shiftDate).getTime() - new Date(b.shiftDate).getTime())
    .map(r => ({
      date: new Date(r.shiftDate).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }),
      name: r.registerName,
      difference: r.difference ?? 0,
    }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="inline-flex items-center gap-2 font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
            <Wallet className="h-6 w-6 text-capsula-navy" strokeWidth={1.5} />
            Control de caja
          </h1>
          <p className="mt-1 text-[13px] text-capsula-ink-muted">Apertura y cierre de caja diaria</p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowOpenForm(true)}>
            <Plus className="h-4 w-4" strokeWidth={2} /> Abrir caja
          </Button>
        )}
      </div>

      {/* Cajas abiertas */}
      {openRegisters.length > 0 && (
        <div className="space-y-3">
          <h3 className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-navy">
            <Unlock className="h-3 w-3" strokeWidth={1.5} />
            Cajas abiertas
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openRegisters.map(r => (
              <div key={r.id} className="rounded-[var(--radius)] border border-capsula-navy/20 bg-capsula-navy-soft/40 p-5 shadow-cap-soft">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-capsula-navy-deep">{r.registerName}</p>
                    <p className="text-[11px] text-capsula-ink-muted">
                      {SHIFT_TYPES.find(s => s.value === r.shiftType)?.label} · {new Date(r.shiftDate).toLocaleDateString('es-VE')}
                    </p>
                  </div>
                  <Badge variant="ok">Abierta</Badge>
                </div>
                <div className="space-y-1 text-[13px]">
                  <div className="flex justify-between text-capsula-ink-muted">
                    <span>Fondo inicial</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-semibold text-capsula-ink">${fmt(r.openingCashUsd)}</span>
                      {r.openingDenominationsJson && (
                        <button
                          onClick={() => setDenomModal(r)}
                          title="Ver desglose de billetes"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-capsula-navy transition-colors hover:bg-capsula-navy-soft hover:text-capsula-navy-deep"
                        >
                          <Eye className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-capsula-ink-muted">
                    <span>Hora apertura</span>
                    <span className="font-mono text-capsula-ink">{new Date(r.openedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="mt-2 border-t border-capsula-navy/15 pt-2">
                    <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-navy">
                      <Users className="h-3 w-3" strokeWidth={1.5} /> Responsables del turno
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseOperators(r.operatorsJson).map((op, i) => (
                        <Badge key={i} variant="navy">{op}</Badge>
                      ))}
                      {parseOperators(r.operatorsJson).length === 0 && (
                        <span className="text-[11px] text-capsula-ink-muted">{r.openedByName}</span>
                      )}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <div className="mt-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setOperatorModal(r); setOperatorInput(''); setOperatorMode('add'); }}
                      >
                        <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} /> Cajera
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setOperatorModal(r); setOperatorInput(''); setOperatorMode('replace'); }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /> Cambio turno
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { setCloseTarget(r); setCloseForm({ closingCashUsd: '', closingCashBs: '', notes: '' }); }}
                      className="w-full"
                    >
                      <Lock className="h-3.5 w-3.5" strokeWidth={1.5} /> Cerrar caja
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      {closedRegisters.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Resumen del mes</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Ventas del mes</p>
              <p className="mt-1 font-mono text-[24px] font-semibold text-[#2F6B4E]">${fmt(monthlyStats.totalSales)}</p>
              <p className="mt-0.5 text-[11px] text-capsula-ink-muted">{monthlyStats.shiftsCount} turnos cerrados</p>
            </div>
            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Gastos del mes</p>
              <p className="mt-1 font-mono text-[24px] font-semibold text-capsula-coral">${fmt(monthlyStats.totalExpenses)}</p>
              <p className="mt-0.5 text-[11px] text-capsula-ink-muted">Descontados de caja</p>
            </div>
            <div className={cn(
              "rounded-[var(--radius)] border p-4 shadow-cap-soft",
              Math.abs(monthlyStats.totalDifference) < 5 ? "border-capsula-line bg-capsula-ivory-surface" :
              monthlyStats.totalDifference < 0 ? "border-capsula-coral/30 bg-capsula-coral-subtle/40" :
              "border-capsula-navy/20 bg-capsula-navy-soft/40",
            )}>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Diferencia acumulada</p>
              <p className={cn(
                "mt-1 font-mono text-[24px] font-semibold",
                Math.abs(monthlyStats.totalDifference) < 5 ? "text-[#2F6B4E]" :
                monthlyStats.totalDifference < 0 ? "text-capsula-coral" :
                "text-capsula-navy-deep",
              )}>
                {monthlyStats.totalDifference >= 0 ? '+' : ''}{fmt(monthlyStats.totalDifference)}
              </p>
              <p className="mt-0.5 text-[11px] text-capsula-ink-muted">Promedio: {fmt(monthlyStats.avgDifference)} por turno</p>
            </div>
            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Precisión de cuadre</p>
              <p className={cn(
                "mt-1 font-mono text-[24px] font-semibold",
                monthlyStats.shiftsCount > 0 && (monthlyStats.perfectShifts / monthlyStats.shiftsCount) >= 0.8 ? "text-[#2F6B4E]" :
                monthlyStats.shiftsCount > 0 && (monthlyStats.perfectShifts / monthlyStats.shiftsCount) >= 0.5 ? "text-[#946A1C]" :
                "text-capsula-coral",
              )}>
                {monthlyStats.shiftsCount > 0 ? Math.round((monthlyStats.perfectShifts / monthlyStats.shiftsCount) * 100) : 0}%
              </p>
              <p className="mt-0.5 text-[11px] text-capsula-ink-muted">{monthlyStats.perfectShifts}/{monthlyStats.shiftsCount} turnos sin diferencia</p>
            </div>
          </div>
        </div>
      )}

      {/* Navegador de período */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleMonthChange(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="min-w-[160px] text-center font-heading text-[18px] tracking-[-0.01em] text-capsula-navy-deep">
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </span>
        <button
          onClick={() => handleMonthChange(1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
        {isPending && (
          <span className="inline-flex items-center gap-1 text-[11px] text-capsula-ink-muted">
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> Cargando…
          </span>
        )}
      </div>

      {/* Historial de cierres */}
      <div className="glass-panel rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Historial de Cierres</h3>
        </div>
        {/* Difference Trend */}
        {diffTrend.length > 1 && (
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Tendencia de Diferencias</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diffTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                  <Tooltip
                    formatter={(value: number) => [`$${fmt(value)}`, 'Diferencia']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: 11 }}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Bar
                    dataKey="difference"
                    name="Diferencia"
                    fill="#3b82f6"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {closedRegisters.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl">🏧</p>
            <p className="mt-2 text-muted-foreground text-sm">Sin cierres en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Caja</th>
                  <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Fecha / Turno</th>
                  <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Ventas</th>
                  <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Gastos</th>
                  <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Esperado</th>
                  <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Contado</th>
                  <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closedRegisters.map(r => {
                  const diff = r.difference ?? 0;
                  const diffColor = Math.abs(diff) < 1 ? 'text-emerald-500' : diff > 0 ? 'text-blue-500' : 'text-red-500';
                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">{r.registerName}</div>
                        {parseOperators(r.operatorsJson).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parseOperators(r.operatorsJson).map((op, i) => (
                              <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{op}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div>{new Date(r.shiftDate).toLocaleDateString('es-VE')}</div>
                        <div className="text-xs">{SHIFT_TYPES.find(s => s.value === r.shiftType)?.label}</div>
                      </td>
                      <td className="px-5 py-3 text-right text-foreground">${fmt(r.totalSalesUsd ?? 0)}</td>
                      <td className="px-5 py-3 text-right text-red-500">${fmt(r.totalExpenses ?? 0)}</td>
                      <td className="px-5 py-3 text-right text-foreground">${fmt(r.expectedCash ?? 0)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <span>${fmt(r.closingCashUsd ?? 0)}</span>
                          {(r.openingDenominationsJson || r.closingDenominationsJson) && (
                            <button onClick={() => setDenomModal(r)} title="Ver desglose de billetes"
                              className="text-blue-400 hover:text-blue-300 text-xs">📋</button>
                          )}
                        </div>
                      </td>
                      <td className={`px-5 py-3 text-right font-bold ${diffColor}`}>
                        {diff >= 0 ? '+' : ''}{fmt(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Abrir Caja */}
      {showOpenForm && (
        <Modal title="Abrir Caja" onClose={() => setShowOpenForm(false)}>
          <form onSubmit={handleOpen} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Nombre de Caja *</label>
              <input value={openForm.registerName} onChange={e => setOpenForm(f => ({ ...f, registerName: e.target.value }))}
                className="input-field w-full" placeholder="Ej: Caja Restaurante" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Turno</label>
              <select value={openForm.shiftType} onChange={e => setOpenForm(f => ({ ...f, shiftType: e.target.value }))} className="input-field w-full">
                {SHIFT_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground">Fondo Inicial USD</label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={showOpenDenom} onChange={e => setShowOpenDenom(e.target.checked)} className="rounded accent-primary" />
                  Desglosar billetes
                </label>
              </div>
              {showOpenDenom ? (
                <BillDenominationInput
                  label="Billetes apertura"
                  onChange={(json, total) => setOpenDenom({ json, total })}
                />
              ) : (
                <input type="number" step="0.01" min="0" value={openForm.openingCashUsd}
                  onChange={e => setOpenForm(f => ({ ...f, openingCashUsd: e.target.value }))}
                  className="input-field w-full" placeholder="0.00" />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Fondo Inicial Bs</label>
              <input type="number" step="0.01" min="0" value={openForm.openingCashBs}
                onChange={e => setOpenForm(f => ({ ...f, openingCashBs: e.target.value }))}
                className="input-field w-full" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Notas</label>
              <textarea value={openForm.notes} onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))}
                className="input-field w-full" rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowOpenForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent">Cancelar</button>
              <button type="submit" disabled={isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {isPending ? 'Abriendo...' : 'Abrir Caja'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Cerrar Caja */}
      {closeTarget && (
        <Modal title={`Cerrar: ${closeTarget.registerName}`} onClose={() => setCloseTarget(null)}>
          <form onSubmit={handleClose} className="space-y-4">
            <div className="rounded-xl bg-muted/30 p-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Fondo apertura</span><span className="font-semibold text-foreground">${fmt(closeTarget.openingCashUsd)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Apertura</span><span className="text-foreground">{new Date(closeTarget.openedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span></div>
              {shiftTips && shiftTips.propinas > 0 && (
                <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                  <span className="text-amber-400/80">🪙 Propinas{shiftTips.propinaCount > 1 ? ` (${shiftTips.propinaCount})` : ''}</span>
                  <span className="font-semibold text-amber-400">+${fmt(shiftTips.propinas)}</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground">Efectivo Contado USD</label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={showCloseDenom} onChange={e => setShowCloseDenom(e.target.checked)} className="rounded accent-primary" />
                  Desglosar billetes
                </label>
              </div>
              {showCloseDenom ? (
                <BillDenominationInput
                  label="Billetes cierre"
                  onChange={(json, total) => setCloseDenom({ json, total })}
                />
              ) : (
                <input type="number" step="0.01" min="0" value={closeForm.closingCashUsd}
                  onChange={e => setCloseForm(f => ({ ...f, closingCashUsd: e.target.value }))}
                  className="input-field w-full" placeholder="0.00" required />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Efectivo Contado Bs</label>
              <input type="number" step="0.01" min="0" value={closeForm.closingCashBs}
                onChange={e => setCloseForm(f => ({ ...f, closingCashBs: e.target.value }))}
                className="input-field w-full" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Observaciones</label>
              <textarea value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))}
                className="input-field w-full" rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setCloseTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent">Cancelar</button>
              <button type="submit" disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {isPending ? 'Cerrando...' : 'Cerrar Caja'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Desglose de Billetes */}
      {denomModal && (
        <Modal title={`Billetes — ${denomModal.registerName}`} onClose={() => setDenomModal(null)}>
          <div className="space-y-4">
            <DenomBreakdown json={denomModal.openingDenominationsJson} label="Apertura" />
            {denomModal.closingDenominationsJson && (
              <DenomBreakdown json={denomModal.closingDenominationsJson} label="Cierre" />
            )}
            {!denomModal.openingDenominationsJson && !denomModal.closingDenominationsJson && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin desglose de billetes registrado</p>
            )}
          </div>
        </Modal>
      )}

      {/* Modal: Agregar cajera / Cambio de turno */}
      {operatorModal && (
        <Modal
          title={operatorMode === 'add' ? `Agregar cajera — ${operatorModal.registerName}` : `Cambio de turno — ${operatorModal.registerName}`}
          onClose={() => { setOperatorModal(null); setOperatorInput(''); }}
        >
          <div className="space-y-4">
            {operatorMode === 'replace' && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                El cambio de turno reemplaza todas las cajeras actuales por la nueva responsable.
              </p>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
                {operatorMode === 'add' ? 'Nombre de la cajera' : 'Nueva responsable del turno'}
              </p>
              <input
                type="text"
                value={operatorInput}
                onChange={e => setOperatorInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleOperatorUpdate(operatorMode); }}
                placeholder="Nombre completo..."
                autoFocus
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {operatorMode === 'add' && parseOperators(operatorModal.operatorsJson).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Actualmente en turno</p>
                <div className="flex flex-wrap gap-1.5">
                  {parseOperators(operatorModal.operatorsJson).map((op, i) => (
                    <span key={i} className="bg-emerald-500/15 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full">{op}</span>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => handleOperatorUpdate(operatorMode)}
              disabled={!operatorInput.trim() || isPending}
              className="w-full rounded-xl bg-primary text-white font-bold py-3 text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors">
              {operatorMode === 'add' ? 'Agregar' : 'Confirmar cambio de turno'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
