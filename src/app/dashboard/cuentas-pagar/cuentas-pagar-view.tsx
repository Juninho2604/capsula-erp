'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'react-hot-toast';
import {
  getAccountsPayableAction, createAccountPayableAction, registerPaymentAction,
  type AccountPayableData,
} from '@/app/actions/account-payable.actions';
import { cn } from '@/lib/utils';
import {
  FileText, Plus, Clock, AlertOctagon, CheckCircle2, Building2,
  AlarmClock, X, Loader2, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

const PAYMENT_METHODS = [
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'BANK_TRANSFER', label: 'Transferencia Bancaria' },
  { value: 'MOBILE_PAY', label: 'Pago Móvil' },
  { value: 'CHECK', label: 'Cheque' },
];

const STATUS_VARIANT: Record<string, 'warn' | 'info' | 'ok' | 'danger' | 'coral' | 'neutral'> = {
  PENDING:  'warn',
  PARTIAL:  'info',
  PAID:     'ok',
  OVERDUE:  'danger',
  DISPUTED: 'coral',
  VOID:     'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:  'Pendiente',
  PARTIAL:  'Parcial',
  PAID:     'Pagado',
  OVERDUE:  'Vencido',
  DISPUTED: 'Disputado',
  VOID:     'Anulado',
};

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Supplier { id: string; name: string; code: string | null }

interface Props {
  initialAccounts: AccountPayableData[];
  suppliers: Supplier[];
  currentUserRole: string;
}

export function CuentasPagarView({ initialAccounts, suppliers, currentUserRole }: Props) {
  const [accounts, setAccounts] = useState<AccountPayableData[]>(initialAccounts);
  const [filter, setFilter] = useState<string>('ACTIVE'); // ACTIVE | ALL | PAID
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState<AccountPayableData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(currentUserRole);

  const [form, setForm] = useState({
    description: '', invoiceNumber: '', supplierId: '', creditorName: '',
    totalAmountUsd: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '',
  });

  const [payForm, setPayForm] = useState({
    amountUsd: '', paymentMethod: 'BANK_TRANSFER', paymentRef: '',
    paidAt: new Date().toISOString().slice(0, 10), notes: '',
  });

  const reload = () => {
    startTransition(async () => {
      const result = await getAccountsPayableAction();
      if (result.data) setAccounts(result.data);
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.totalAmountUsd) { toast.error('Completa los campos requeridos'); return; }
    if (!form.supplierId && !form.creditorName.trim()) { toast.error('Indica el proveedor o acreedor'); return; }
    startTransition(async () => {
      const result = await createAccountPayableAction({
        description: form.description,
        invoiceNumber: form.invoiceNumber || undefined,
        supplierId: form.supplierId || undefined,
        creditorName: form.creditorName || undefined,
        totalAmountUsd: parseFloat(form.totalAmountUsd),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
      });
      if (result.success) {
        toast.success('Cuenta por pagar registrada');
        setShowForm(false);
        setForm({ description: '', invoiceNumber: '', supplierId: '', creditorName: '', totalAmountUsd: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '' });
        reload();
      } else {
        toast.error(result.error ?? 'Error');
      }
    });
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    if (!payForm.amountUsd || parseFloat(payForm.amountUsd) <= 0) { toast.error('Monto inválido'); return; }
    startTransition(async () => {
      const result = await registerPaymentAction(payTarget.id, {
        amountUsd: parseFloat(payForm.amountUsd),
        paymentMethod: payForm.paymentMethod,
        paymentRef: payForm.paymentRef || undefined,
        paidAt: payForm.paidAt,
        notes: payForm.notes || undefined,
      });
      if (result.success) {
        toast.success('Pago registrado');
        setPayTarget(null);
        setPayForm({ amountUsd: '', paymentMethod: 'BANK_TRANSFER', paymentRef: '', paidAt: new Date().toISOString().slice(0, 10), notes: '' });
        reload();
      } else {
        toast.error(result.error ?? 'Error');
      }
    });
  };

  // Filtrar
  const filtered = accounts.filter(a => {
    if (filter === 'ACTIVE') return !['PAID', 'VOID'].includes(a.status);
    if (filter === 'PAID') return a.status === 'PAID';
    return true;
  });

  // KPIs
  const totalPending = accounts.filter(a => !['PAID', 'VOID'].includes(a.status)).reduce((s, a) => s + a.remainingUsd, 0);
  const overdueCount = accounts.filter(a => a.status === 'OVERDUE').length;
  const overdueAmount = accounts.filter(a => a.status === 'OVERDUE').reduce((s, a) => s + a.remainingUsd, 0);
  const totalPaid = accounts.filter(a => a.status === 'PAID').reduce((s, a) => s + a.totalAmountUsd, 0);

  // Aging Report
  const now = new Date();
  const agingBuckets: Record<string, { amount: number; count: number }> = {
    'Vigente': { amount: 0, count: 0 },
    '0-30': { amount: 0, count: 0 },
    '31-60': { amount: 0, count: 0 },
    '61-90': { amount: 0, count: 0 },
    '90+': { amount: 0, count: 0 },
  };
  for (const a of accounts.filter(a => !['PAID', 'VOID'].includes(a.status))) {
    if (!a.dueDate) { agingBuckets['Vigente'].amount += a.remainingUsd; agingBuckets['Vigente'].count++; continue; }
    const daysPast = Math.floor((now.getTime() - new Date(a.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysPast <= 0) { agingBuckets['Vigente'].amount += a.remainingUsd; agingBuckets['Vigente'].count++; }
    else if (daysPast <= 30) { agingBuckets['0-30'].amount += a.remainingUsd; agingBuckets['0-30'].count++; }
    else if (daysPast <= 60) { agingBuckets['31-60'].amount += a.remainingUsd; agingBuckets['31-60'].count++; }
    else if (daysPast <= 90) { agingBuckets['61-90'].amount += a.remainingUsd; agingBuckets['61-90'].count++; }
    else { agingBuckets['90+'].amount += a.remainingUsd; agingBuckets['90+'].count++; }
  }
  const agingData = Object.entries(agingBuckets).map(([range, data]) => ({ range, ...data }));
  const hasAging = agingData.some(b => b.amount > 0);

  // Supplier Summary
  const supplierMap = new Map<string, { name: string; total: number; count: number }>();
  for (const a of accounts.filter(a => !['PAID', 'VOID'].includes(a.status))) {
    const key = a.supplierId || a.creditorName || 'Sin asignar';
    const name = a.supplierName || a.creditorName || 'Sin asignar';
    const existing = supplierMap.get(key) || { name, total: 0, count: 0 };
    existing.total += a.remainingUsd;
    existing.count++;
    supplierMap.set(key, existing);
  }
  const supplierSummary = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total).slice(0, 8);

  // Upcoming Due Dates (next 14 days)
  const upcomingDue = accounts
    .filter(a => !['PAID', 'VOID'].includes(a.status) && a.dueDate)
    .filter(a => {
      const due = new Date(a.dueDate!);
      const daysUntil = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 14;
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-[1400px] animate-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-capsula-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Finanzas</div>
          <h1 className="inline-flex items-center gap-2 font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
            <FileText className="h-6 w-6 text-capsula-navy" strokeWidth={1.5} />
            Cuentas por pagar
          </h1>
          <p className="mt-1 text-[13px] text-capsula-ink-soft">Control de deudas y facturas pendientes.</p>
        </div>
        {canManage && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" strokeWidth={2} /> Nueva cuenta
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total pendiente" value={`$${fmt(totalPending)}`} accent="warn" Icon={Clock} />
        <KpiCard label="Vencido" value={`$${fmt(overdueAmount)}`} sub={`${overdueCount} facturas`} accent={overdueCount > 0 ? 'coral' : 'neutral'} Icon={AlertOctagon} />
        <KpiCard label="Total pagado" value={`$${fmt(totalPaid)}`} accent="ok" Icon={CheckCircle2} />
        <KpiCard label="Acreedores" value={`${new Set(accounts.filter(a=>!['PAID','VOID'].includes(a.status)).map(a=>a.supplierId||a.creditorName)).size}`} accent="navy" Icon={Building2} />
      </div>

      {/* Aging Report */}
      {hasAging && (
        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Envejecimiento de deudas</h3>
          <div className="grid grid-cols-5 gap-2">
            {agingData.map(bucket => {
              const style =
                bucket.range === 'Vigente' ? { border: 'border-[#D3E2D8]', bg: 'bg-[#E5EDE7]/50',             text: 'text-[#2F6B4E]' } :
                bucket.range === '0-30'    ? { border: 'border-capsula-navy/20', bg: 'bg-capsula-navy-soft/40', text: 'text-capsula-navy-deep' } :
                bucket.range === '31-60'   ? { border: 'border-[#E8D9B8]', bg: 'bg-[#F3EAD6]/40',             text: 'text-[#946A1C]' } :
                bucket.range === '61-90'   ? { border: 'border-[#E8D9B8]', bg: 'bg-[#F3EAD6]/60',             text: 'text-[#946A1C]' } :
                                              { border: 'border-capsula-coral/30', bg: 'bg-capsula-coral-subtle/40', text: 'text-capsula-coral' };
              return (
                <div key={bucket.range} className={cn("rounded-[var(--radius)] border p-3 text-center", style.border, style.bg)}>
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">{bucket.range === 'Vigente' ? 'Al día' : `${bucket.range} días`}</p>
                  <p className={cn("mt-1 font-mono text-[16px] font-semibold", style.text)}>${fmt(bucket.amount)}</p>
                  <p className="text-[10px] text-capsula-ink-muted">{bucket.count} cuentas</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Acreedores */}
      {supplierSummary.length > 0 && (
        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Principales acreedores</h3>
          <div className="space-y-2">
            {supplierSummary.map((s, i) => {
              const pct = totalPending > 0 ? (s.total / totalPending) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 font-mono text-[13px] font-semibold text-capsula-ink-muted">{i + 1}</span>
                  <span className="flex-1 truncate text-[13px] text-capsula-ink">{s.name}</span>
                  <span className="text-[11px] text-capsula-ink-muted">{s.count} cuentas</span>
                  <span className="w-24 text-right font-mono text-[13px] font-semibold text-capsula-ink">${fmt(s.total)}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-capsula-line">
                    <div className="h-full rounded-full bg-[#946A1C] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Próximos Vencimientos */}
      {upcomingDue.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[#E8D9B8] bg-[#F3EAD6]/40 p-6 shadow-cap-soft">
          <h3 className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#946A1C]">
            <AlarmClock className="h-3.5 w-3.5" strokeWidth={1.5} />
            Próximos vencimientos (14 días)
          </h3>
          <div className="space-y-2">
            {upcomingDue.map(a => {
              const daysUntil = Math.floor((new Date(a.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const variant: 'danger' | 'warn' | 'info' = daysUntil <= 3 ? 'danger' : daysUntil <= 7 ? 'warn' : 'info';
              return (
                <div key={a.id} className="flex items-center justify-between text-[13px]">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Badge variant={variant}>
                      {daysUntil === 0 ? 'HOY' : daysUntil === 1 ? 'MAÑANA' : `${daysUntil}d`}
                    </Badge>
                    <span className="truncate text-capsula-ink">{a.description}</span>
                    <span className="text-[11px] text-capsula-ink-muted">— {a.supplierName || a.creditorName}</span>
                  </div>
                  <span className="ml-2 font-mono font-semibold text-capsula-ink">${fmt(a.remainingUsd)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2">
        {[
          { key: 'ACTIVE', label: 'Activas' },
          { key: 'ALL', label: 'Todas' },
          { key: 'PAID', label: 'Pagadas' },
        ].map(f => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory"
                  : "border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted hover:text-capsula-ink",
              )}
            >
              {f.label}
            </button>
          );
        })}
        {isPending && (
          <span className="inline-flex items-center gap-1 self-center text-[11px] text-capsula-ink-muted">
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> Cargando…
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
            <p className="mt-3 font-medium text-capsula-ink">Sin cuentas en esta vista</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-capsula-line bg-capsula-ivory">
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Descripción / acreedor</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Estado</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Total</th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Pendiente</th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Vencimiento</th>
                  {canManage && <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isExpanded = expandedId === a.id;
                  const isOverdue = a.status === 'OVERDUE';
                  return (
                    <React.Fragment key={a.id}>
                      <tr
                        className={cn(
                          "cursor-pointer border-b border-capsula-line transition-colors hover:bg-capsula-ivory",
                          isOverdue && "bg-capsula-coral-subtle/20",
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-capsula-ink">{a.description}</div>
                          <div className="text-[11px] text-capsula-ink-muted">
                            {a.supplierName || a.creditorName}
                            {a.invoiceNumber && ` · Fact. ${a.invoiceNumber}`}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={STATUS_VARIANT[a.status] ?? 'neutral'}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-medium text-capsula-ink">${fmt(a.totalAmountUsd)}</td>
                        <td className={cn("px-5 py-3 text-right font-mono font-semibold", a.remainingUsd > 0 ? "text-[#946A1C]" : "text-capsula-ink-muted")}>
                          {a.remainingUsd > 0 ? `$${fmt(a.remainingUsd)}` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {a.dueDate ? (
                            <span className={cn("font-mono", isOverdue ? "font-semibold text-capsula-coral" : "text-capsula-ink-muted")}>
                              {new Date(a.dueDate).toLocaleDateString('es-VE')}
                            </span>
                          ) : <span className="text-capsula-ink-muted">—</span>}
                        </td>
                        {canManage && (
                          <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                            {!['PAID', 'VOID'].includes(a.status) && (
                              <button
                                onClick={() => { setPayTarget(a); setPayForm(f => ({ ...f, amountUsd: a.remainingUsd.toFixed(2) })); }}
                                className="inline-flex items-center gap-1 rounded-md border border-[#D3E2D8] bg-[#E5EDE7]/60 px-2.5 py-1 text-[11px] font-medium text-[#2F6B4E] transition-colors hover:bg-[#2F6B4E] hover:text-white"
                              >
                                <Check className="h-3 w-3" strokeWidth={2} /> Registrar pago
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                      {isExpanded && a.payments.length > 0 && (
                        <tr>
                          <td colSpan={canManage ? 6 : 5} className="border-b border-capsula-line bg-capsula-ivory px-8 py-3">
                            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Pagos realizados</p>
                            <div className="space-y-1">
                              {a.payments.map(p => (
                                <div key={p.id} className="flex items-center gap-4 text-[11px] text-capsula-ink-soft">
                                  <span className="font-mono font-semibold text-capsula-ink">${fmt(p.amountUsd)}</span>
                                  <span>{PAYMENT_METHODS.find(m => m.value === p.paymentMethod)?.label ?? p.paymentMethod}</span>
                                  {p.paymentRef && <span className="text-capsula-ink-muted">Ref: {p.paymentRef}</span>}
                                  <span className="font-mono text-capsula-ink-muted">{new Date(p.paidAt).toLocaleDateString('es-VE')}</span>
                                  <span className="text-capsula-ink-muted">{p.createdByName}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nueva Cuenta */}
      {showForm && (
        <Modal title="Nueva Cuenta por Pagar" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Descripción *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input-field w-full" placeholder="Ej: Factura vegetales 15/03/2026" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Proveedor (sistema)</label>
                <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value, creditorName: '' }))}
                  className="input-field w-full">
                  <option value="">— Seleccionar —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">O nombre del acreedor</label>
                <input value={form.creditorName} onChange={e => setForm(f => ({ ...f, creditorName: e.target.value, supplierId: '' }))}
                  className="input-field w-full" placeholder="Si no está en el sistema" disabled={!!form.supplierId} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Nº de Factura</label>
                <input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  className="input-field w-full" placeholder="Opcional" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Monto Total USD *</label>
                <input type="number" step="0.01" min="0.01" value={form.totalAmountUsd}
                  onChange={e => setForm(f => ({ ...f, totalAmountUsd: e.target.value }))}
                  className="input-field w-full" placeholder="0.00" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Fecha Factura *</label>
                <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                  className="input-field w-full" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Fecha Vencimiento</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="input-field w-full" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent">Cancelar</button>
              <button type="submit" disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {isPending ? 'Guardando...' : 'Registrar Cuenta'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Registrar Pago */}
      {payTarget && (
        <Modal title="Registrar Pago" onClose={() => setPayTarget(null)}>
          <form onSubmit={handlePay} className="space-y-4">
            <div className="rounded-xl bg-muted/30 p-4 text-sm space-y-1">
              <p className="font-semibold text-foreground">{payTarget.description}</p>
              <p className="text-muted-foreground">Pendiente: <span className="font-bold text-amber-500">${fmt(payTarget.remainingUsd)}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Monto USD *</label>
                <input type="number" step="0.01" min="0.01" value={payForm.amountUsd}
                  onChange={e => setPayForm(f => ({ ...f, amountUsd: e.target.value }))}
                  className="input-field w-full" placeholder="0.00" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Fecha *</label>
                <input type="date" value={payForm.paidAt} onChange={e => setPayForm(f => ({ ...f, paidAt: e.target.value }))}
                  className="input-field w-full" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Método *</label>
                <select value={payForm.paymentMethod} onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))} className="input-field w-full">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Referencia</label>
                <input value={payForm.paymentRef} onChange={e => setPayForm(f => ({ ...f, paymentRef: e.target.value }))}
                  className="input-field w-full" placeholder="Nº transferencia..." />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Notas</label>
              <textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                className="input-field w-full" rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setPayTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent">Cancelar</button>
              <button type="submit" disabled={isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {isPending ? 'Registrando...' : 'Confirmar Pago'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub?: string }) {
  return (
    <div className={`glass-panel rounded-2xl p-5 border ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-black text-foreground truncate">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
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
