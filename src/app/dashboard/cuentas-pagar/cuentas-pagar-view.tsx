'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Hourglass, AlertOctagon, CheckCircle2, Building2, X, FileText, Clock } from 'lucide-react';
import {
  getAccountsPayableAction, createAccountPayableAction, registerPaymentAction,
  type AccountPayableData, type CreditCandidatePO,
} from '@/app/actions/account-payable.actions';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { setPayableRetentionsAction } from '@/app/actions/account-payable.actions';
import { ModalPortal } from '@/components/ui/modal-portal';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import type { BadgeProps } from '@/components/ui/Badge';
import { Badge } from '@/components/ui/Badge';

const PAYMENT_METHODS = [
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'BANK_TRANSFER', label: 'Transferencia Bancaria' },
  { value: 'MOBILE_PAY', label: 'Pago Móvil' },
  { value: 'CHECK', label: 'Cheque' },
];

// §108: métodos cuyo pago físico ocurre en bolívares — para esos se persiste
// el equivalente Bs y la tasa usada en el AccountPayment.
const BS_METHODS = new Set(['CASH_BS', 'BANK_TRANSFER', 'MOBILE_PAY', 'CHECK']);

type StatusVariant = NonNullable<BadgeProps['variant']>;
const STATUS_CONFIG: Record<string, { label: string; variant: StatusVariant }> = {
  PENDING:  { label: 'Pendiente',  variant: 'warn' },
  PARTIAL:  { label: 'Parcial',    variant: 'info' },
  PAID:     { label: 'Pagado',     variant: 'ok' },
  OVERDUE:  { label: 'Vencido',    variant: 'danger' },
  DISPUTED: { label: 'Disputado',  variant: 'coral' },
  VOID:     { label: 'Anulado',    variant: 'neutral' },
};

const FIELD_LABEL = 'mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted';
const FIELD_INPUT = 'w-full rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none';

function agingBucketStyles(range: string): { wrap: string; text: string } {
  if (range === 'Vigente') return { wrap: 'border-[#D3E2D8] bg-[#E5EDE7]/40', text: 'text-[#2F6B4E]' };
  if (range === '0-30')    return { wrap: 'border-capsula-line bg-capsula-ivory-alt/60', text: 'text-capsula-ink' };
  if (range === '31-60')   return { wrap: 'border-[#E8D9B8] bg-[#F3EAD6]/40', text: 'text-[#946A1C]' };
  if (range === '61-90')   return { wrap: 'border-[#E8D9B8] bg-[#F3EAD6]/60', text: 'text-[#946A1C]' };
  if (range === '90+')     return { wrap: 'border-[#EFD2C8] bg-[#F7E3DB]/40', text: 'text-[#B04A2E]' };
  return                          { wrap: 'border-capsula-line bg-capsula-ivory-alt/60', text: 'text-capsula-ink' };
}

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Supplier { id: string; name: string; code: string | null }

interface Props {
  initialAccounts: AccountPayableData[];
  suppliers: Supplier[];
  creditCandidates: CreditCandidatePO[];
  currentUserRole: string;
}

export function CuentasPagarView({ initialAccounts, suppliers, creditCandidates, currentUserRole }: Props) {
  const [accounts, setAccounts] = useState<AccountPayableData[]>(initialAccounts);
  const [filter, setFilter] = useState<string>('ACTIVE'); // ACTIVE | ALL | PAID
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState<AccountPayableData | null>(null);
  const [retentionTarget, setRetentionTarget] = useState<AccountPayableData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(currentUserRole);

  // §108: tasa Bs/USD del día — para mostrar conversiones al cancelar facturas.
  const [dayRate, setDayRate] = useState<number | null>(null);
  useEffect(() => {
    getExchangeRateValue().then((r) => setDayRate(r)).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    description: '', invoiceNumber: '', supplierId: '', creditorName: '',
    totalAmountUsd: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '',
    purchaseOrderId: '',
  });

  // Precarga el formulario desde una orden de compra recibida (crédito).
  const prefillFromPO = (poId: string) => {
    if (!poId) { setForm(f => ({ ...f, purchaseOrderId: '' })); return; }
    const po = creditCandidates.find(p => p.id === poId);
    if (!po) return;
    setForm(f => ({
      ...f,
      purchaseOrderId: po.id,
      description: po.orderName ? `${po.orderName} (${po.orderNumber})` : `Compra ${po.orderNumber}`,
      invoiceNumber: po.orderNumber,
      supplierId: po.supplierId ?? '',
      creditorName: po.supplierId ? '' : (po.supplierName ?? ''),
      totalAmountUsd: po.totalAmount ? String(po.totalAmount) : f.totalAmountUsd,
    }));
  };

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
        purchaseOrderId: form.purchaseOrderId || undefined,
      });
      if (result.success) {
        toast.success('Cuenta por pagar registrada');
        setShowForm(false);
        setForm({ description: '', invoiceNumber: '', supplierId: '', creditorName: '', totalAmountUsd: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '', purchaseOrderId: '' });
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
      const amountUsdNum = parseFloat(payForm.amountUsd);
      const isBsMethod = BS_METHODS.has(payForm.paymentMethod);
      const result = await registerPaymentAction(payTarget.id, {
        amountUsd: amountUsdNum,
        // §108: si el pago físico es en Bs, persistimos el equivalente y la
        // tasa del día para que quede auditado en el historial de pagos.
        amountBs: isBsMethod && dayRate ? Math.round(amountUsdNum * dayRate * 100) / 100 : undefined,
        exchangeRate: isBsMethod && dayRate ? dayRate : undefined,
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
    <div>
      <PageHeader
        kicker="Finanzas"
        title="Cuentas por pagar"
        description="Control de deudas y facturas pendientes"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Nueva cuenta
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total pendiente"
            value={`$${fmt(totalPending)}`}
            Icon={Hourglass}
            tone="warn"
          />
          <KpiCard
            label="Vencido"
            value={`$${fmt(overdueAmount)}`}
            sub={`${overdueCount} facturas`}
            Icon={AlertOctagon}
            tone={overdueCount > 0 ? 'danger' : 'neutral'}
          />
          <KpiCard
            label="Total pagado"
            value={`$${fmt(totalPaid)}`}
            Icon={CheckCircle2}
            tone="ok"
          />
          <KpiCard
            label="Acreedores"
            value={`${new Set(accounts.filter(a=>!['PAID','VOID'].includes(a.status)).map(a=>a.supplierId||a.creditorName)).size}`}
            Icon={Building2}
            tone="info"
          />
        </div>

      {/* Aging Report */}
      {hasAging && (
        <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Envejecimiento de deudas</h3>
          <div className="grid grid-cols-5 gap-2">
            {agingData.map(bucket => {
              const styles = agingBucketStyles(bucket.range);
              return (
                <div key={bucket.range} className={`rounded-xl border p-3 text-center ${styles.wrap}`}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                    {bucket.range === 'Vigente' ? 'Al día' : `${bucket.range} días`}
                  </p>
                  <p className={`mt-1 font-semibold text-lg tracking-[-0.02em] ${styles.text}`}>
                    ${fmt(bucket.amount)}
                  </p>
                  <p className="text-[11px] text-capsula-ink-muted">{bucket.count} cuentas</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Acreedores */}
      {supplierSummary.length > 0 && (
        <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
          <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Principales acreedores</h3>
          <div className="space-y-2">
            {supplierSummary.map((s, i) => {
              const pct = totalPending > 0 ? (s.total / totalPending) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 font-semibold text-base text-capsula-ink-muted">{i + 1}</span>
                  <span className="flex-1 truncate text-sm text-capsula-ink">{s.name}</span>
                  <span className="text-xs text-capsula-ink-muted">{s.count} cuentas</span>
                  <span className="w-24 text-right text-sm font-medium text-capsula-ink">${fmt(s.total)}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-capsula-ivory-alt">
                    <div
                      className="h-full rounded-full bg-capsula-navy-deep transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Próximos Vencimientos */}
      {upcomingDue.length > 0 && (
        <div className="rounded-2xl border border-[#E8D9B8] bg-[#F3EAD6]/40 p-6 shadow-cap-soft">
          <h3 className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#946A1C]">
            <Clock className="h-4 w-4" />
            Próximos vencimientos (14 días)
          </h3>
          <div className="space-y-2">
            {upcomingDue.map(a => {
              const daysUntil = Math.floor((new Date(a.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const dueVariant: StatusVariant = daysUntil <= 3 ? 'danger' : daysUntil <= 7 ? 'warn' : 'info';
              return (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Badge variant={dueVariant}>
                      {daysUntil === 0 ? 'HOY' : daysUntil === 1 ? 'MAÑANA' : `${daysUntil}d`}
                    </Badge>
                    <span className="truncate text-capsula-ink">{a.description}</span>
                    <span className="text-xs text-capsula-ink-muted">— {a.supplierName || a.creditorName}</span>
                  </div>
                  <span className="ml-2 font-medium text-capsula-ink">${fmt(a.remainingUsd)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'ACTIVE', label: 'Activas' },
          { key: 'ALL', label: 'Todas' },
          { key: 'PAID', label: 'Pagadas' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                : 'border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep'
            }`}
          >
            {f.label}
          </button>
        ))}
        {isPending && (
          <span className="animate-pulse text-xs text-capsula-ink-muted">Cargando…</span>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-capsula-line bg-capsula-ivory overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-capsula-ink-muted font-medium">Sin cuentas en esta vista</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-capsula-line bg-capsula-ivory-surface">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.14em] text-[11px] text-capsula-ink-muted">Descripción / Acreedor</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.14em] text-[11px] text-capsula-ink-muted">Estado</th>
                  <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.14em] text-[11px] text-capsula-ink-muted">Total</th>
                  <th className="px-5 py-3 text-right font-semibold uppercase tracking-[0.14em] text-[11px] text-capsula-ink-muted">Pendiente</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-[0.14em] text-[11px] text-capsula-ink-muted">Vencimiento</th>
                  {canManage && <th className="px-5 py-3 text-center font-semibold uppercase tracking-[0.14em] text-[11px] text-capsula-ink-muted">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-capsula-line">
                {filtered.map(a => {
                  const statusCfg = STATUS_CONFIG[a.status] ?? { label: a.status, variant: 'neutral' as StatusVariant };
                  const isExpanded = expandedId === a.id;
                  const isOverdue = a.status === 'OVERDUE';
                  return (
                    <>
                      <tr key={a.id}
                        className={`hover:bg-capsula-ivory-surface transition-colors cursor-pointer ${isOverdue ? 'bg-capsula-coral/5' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                        <td className="px-5 py-3">
                          <div className="font-semibold text-capsula-ink">{a.description}</div>
                          <div className="text-xs text-capsula-ink-muted">
                            {a.supplierName || a.creditorName}
                            {a.invoiceNumber && ` · Fact. ${a.invoiceNumber}`}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right text-capsula-ink font-semibold tabular-nums">${fmt(a.totalAmountUsd)}</td>
                        <td className={`px-5 py-3 text-right font-semibold tabular-nums ${a.remainingUsd > 0 ? 'text-capsula-coral' : 'text-capsula-ink-muted'}`}>
                          {a.remainingUsd > 0 ? `$${fmt(a.remainingUsd)}` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {a.dueDate ? (
                            <span className={isOverdue ? 'text-capsula-coral font-semibold' : 'text-capsula-ink-soft'}>
                              {new Date(a.dueDate).toLocaleDateString('es-VE')}
                            </span>
                          ) : <span className="text-capsula-ink-muted">—</span>}
                        </td>
                        {canManage && (
                          <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                            {!['PAID', 'VOID'].includes(a.status) && (
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => { setPayTarget(a); setPayForm(f => ({ ...f, amountUsd: a.remainingUsd.toFixed(2) })); }}
                                  className="rounded-lg bg-capsula-navy-deep text-capsula-cream text-xs font-semibold px-3 py-1.5 hover:bg-capsula-navy-deep/90 transition">
                                  Registrar pago
                                </button>
                                <button onClick={() => setRetentionTarget(a)}
                                  title="Retención IVA/ISLR — cierra el saldo sin salida de efectivo"
                                  className="rounded-lg border border-capsula-line text-xs font-semibold px-3 py-1.5 text-capsula-ink-soft hover:border-capsula-navy-deep transition">
                                  Retención
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                      {isExpanded && a.payments.length > 0 && (
                        <tr key={`${a.id}-payments`}>
                          <td colSpan={canManage ? 6 : 5} className="px-8 py-3 bg-capsula-ivory-surface">
                            <p className="text-[10px] font-semibold text-capsula-ink-muted uppercase tracking-[0.14em] mb-2">Pagos realizados</p>
                            <div className="space-y-1">
                              {a.payments.map(p => (
                                <div key={p.id} className="flex items-center gap-4 text-xs text-capsula-ink-soft">
                                  <span className="text-capsula-ink font-semibold tabular-nums">${fmt(p.amountUsd)}</span>
                                  {p.amountBs != null && p.amountBs > 0 && (
                                    <span className="tabular-nums text-[#946A1C] dark:text-[#E8D9B8]">Bs {fmt(p.amountBs)}{p.exchangeRate ? ` @${fmt(p.exchangeRate)}` : ''}</span>
                                  )}
                                  <span>{PAYMENT_METHODS.find(m => m.value === p.paymentMethod)?.label ?? p.paymentMethod}</span>
                                  {p.paymentRef && <span>Ref: {p.paymentRef}</span>}
                                  <span>{new Date(p.paidAt).toLocaleDateString('es-VE')}</span>
                                  <span>{p.createdByName}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nueva Cuenta */}
      {showForm && (
        <Modal title="Nueva cuenta por pagar" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {creditCandidates.length > 0 && (
              <div className="rounded-xl bg-capsula-ivory-alt border border-capsula-line p-3">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Desde orden de compra (crédito)</label>
                <select value={form.purchaseOrderId} onChange={e => prefillFromPO(e.target.value)}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none transition">
                  <option value="">— Cargar manual —</option>
                  {creditCandidates.map(po => (
                    <option key={po.id} value={po.id}>
                      {po.orderNumber}{po.orderName ? ` · ${po.orderName}` : ''}{po.supplierName ? ` · ${po.supplierName}` : ''} — ${po.totalAmount.toFixed(2)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-capsula-ink-muted mt-1">Genera la deuda desde una compra recibida y la deja vinculada a la orden.</p>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Descripción *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition" placeholder="Ej: Factura vegetales 15/03/2026" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Proveedor (sistema)</label>
                <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value, creditorName: '' }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none transition">
                  <option value="">— Seleccionar —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">O nombre del acreedor</label>
                <input value={form.creditorName} onChange={e => setForm(f => ({ ...f, creditorName: e.target.value, supplierId: '' }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition disabled:opacity-50" placeholder="Si no está en el sistema" disabled={!!form.supplierId} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Nº de factura</label>
                <input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition" placeholder="Opcional" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Monto total USD *</label>
                <input type="number" step="0.01" min="0.01" value={form.totalAmountUsd}
                  onChange={e => setForm(f => ({ ...f, totalAmountUsd: e.target.value }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition tabular-nums" placeholder="0.00" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Fecha factura *</label>
                <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none transition" required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Fecha vencimiento</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none transition" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2 text-sm font-semibold text-capsula-ink-soft hover:bg-capsula-ivory-surface transition">Cancelar</button>
              <button type="submit" disabled={isPending}
                className="rounded-lg bg-capsula-navy-deep px-4 py-2 text-sm font-semibold text-capsula-cream hover:bg-capsula-navy-deep/90 transition disabled:opacity-50">
                {isPending ? 'Guardando…' : 'Registrar cuenta'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Registrar Pago */}
      {payTarget && (
        <Modal title="Registrar pago" onClose={() => setPayTarget(null)}>
          <form onSubmit={handlePay} className="space-y-4">
            <div className="rounded-xl bg-capsula-ivory border border-capsula-line p-4 text-sm space-y-1">
              <p className="font-semibold text-capsula-ink">{payTarget.description}</p>
              <p className="text-capsula-ink-muted">Pendiente: <span className="font-semibold text-capsula-ink tabular-nums">${fmt(payTarget.remainingUsd)}</span>
                {dayRate != null && <span className="tabular-nums"> · Bs {fmt(payTarget.remainingUsd * dayRate)}</span>}
              </p>
              {dayRate != null ? (
                <p className="text-[11px] text-capsula-ink-muted tabular-nums">Tasa del día: 1 USD = Bs {fmt(dayRate)}</p>
              ) : (
                <p className="text-[11px] text-capsula-ink-muted">Sin tasa del día cargada — las conversiones a Bs no están disponibles.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Monto USD *</label>
                <input type="number" step="0.01" min="0.01" value={payForm.amountUsd}
                  onChange={e => setPayForm(f => ({ ...f, amountUsd: e.target.value }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition tabular-nums" placeholder="0.00" required />
                {dayRate != null && (parseFloat(payForm.amountUsd) || 0) > 0 && (
                  <p className={`mt-1 text-xs tabular-nums ${BS_METHODS.has(payForm.paymentMethod) ? 'font-semibold text-capsula-ink' : 'text-capsula-ink-muted'}`}>
                    ≈ Bs {fmt((parseFloat(payForm.amountUsd) || 0) * dayRate)} a tasa del día
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Fecha *</label>
                <input type="date" value={payForm.paidAt} onChange={e => setPayForm(f => ({ ...f, paidAt: e.target.value }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none transition" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Método *</label>
                <select value={payForm.paymentMethod} onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))} className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none transition">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Referencia</label>
                <input value={payForm.paymentRef} onChange={e => setPayForm(f => ({ ...f, paymentRef: e.target.value }))}
                  className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition" placeholder="Nº transferencia…" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Notas</label>
              <textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none transition resize-none" rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setPayTarget(null)}
                className="rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2 text-sm font-semibold text-capsula-ink-soft hover:bg-capsula-ivory-surface transition">Cancelar</button>
              <button type="submit" disabled={isPending}
                className="rounded-lg bg-capsula-navy-deep px-4 py-2 text-sm font-semibold text-capsula-cream hover:bg-capsula-navy-deep/90 transition disabled:opacity-50">
                {isPending ? 'Registrando…' : 'Confirmar pago'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* §115 — Modal: retención IVA/ISLR */}
      {retentionTarget && (
        <RetentionModal
          account={retentionTarget}
          onClose={() => setRetentionTarget(null)}
          onSaved={() => { setRetentionTarget(null); reload(); }}
        />
      )}
      </div>
    </div>
  );
}

function RetentionModal({ account, onClose, onSaved }: { account: AccountPayableData; onClose: () => void; onSaved: () => void }) {
  const [iva, setIva] = useState(account.retentionIvaUsd ? String(account.retentionIvaUsd) : '');
  const [islr, setIslr] = useState(account.retentionIslrUsd ? String(account.retentionIslrUsd) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ivaN = parseFloat(iva) || 0;
  const islrN = parseFloat(islr) || 0;
  // Saldo tras aplicar estas retenciones (paid ya incluye lo pagado; el
  // remaining actual = total - paid - retencionesActuales, así que
  // paid = total - remaining - retActuales).
  const paid = Math.max(0, account.totalAmountUsd - account.remainingUsd - account.retentionIvaUsd - account.retentionIslrUsd);
  const newRemaining = Math.max(0, Math.round((account.totalAmountUsd - paid - ivaN - islrN) * 100) / 100);
  const willClose = newRemaining <= 0.01;

  const submit = async () => {
    setError('');
    setSaving(true);
    const res = await setPayableRetentionsAction(account.id, { retentionIvaUsd: ivaN, retentionIslrUsd: islrN });
    setSaving(false);
    if (res.success) { toast.success(willClose ? 'Retención registrada — factura cerrada' : 'Retención registrada'); onSaved(); }
    else setError(res.error ?? 'Error');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
          <div className="border-b border-capsula-line p-5 flex items-center justify-between">
            <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Retención IVA / ISLR</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-capsula-ivory-alt border border-capsula-line p-3 text-sm">
              <p className="font-semibold text-capsula-ink">{account.description}</p>
              <p className="text-capsula-ink-muted tabular-nums">Total ${fmt(account.totalAmountUsd)} · pagado ${fmt(paid)} · saldo actual ${fmt(account.remainingUsd)}</p>
            </div>
            <p className="text-xs text-capsula-ink-muted">
              Lo retenido NO sale al proveedor (se entera al fisco). Cierra el saldo de la factura sin salida de efectivo — útil cuando el adelanto no cubre el total.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Retención IVA (USD)</span>
                <input type="number" step="0.01" min="0" inputMode="decimal" value={iva} onChange={e => setIva(e.target.value)} placeholder="0.00" className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink tabular-nums focus:border-capsula-navy-deep focus:outline-none" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Retención ISLR (USD)</span>
                <input type="number" step="0.01" min="0" inputMode="decimal" value={islr} onChange={e => setIslr(e.target.value)} placeholder="0.00" className="w-full bg-capsula-ivory border border-capsula-line rounded-xl px-3 py-2.5 text-sm text-capsula-ink tabular-nums focus:border-capsula-navy-deep focus:outline-none" />
              </label>
            </div>
            <div className={`rounded-xl px-3 py-2 text-sm flex justify-between font-semibold ${willClose ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' : 'bg-capsula-ivory-alt text-capsula-ink'}`}>
              <span>Saldo tras retención</span>
              <span className="tabular-nums">{willClose ? 'Cerrada ($0.00)' : `$${fmt(newRemaining)}`}</span>
            </div>
            {error && <p className="text-sm text-capsula-coral">{error}</p>}
          </div>
          <div className="border-t border-capsula-line p-4 flex gap-3">
            <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
            <button onClick={submit} disabled={saving} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar retención'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

type KpiTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
const KPI_TONE: Record<KpiTone, string> = {
  ok:      'border-[#D3E2D8] bg-[#E5EDE7]/40',
  warn:    'border-[#E8D9B8] bg-[#F3EAD6]/40',
  danger:  'border-[#EFD2C8] bg-[#F7E3DB]/40',
  info:    'border-capsula-line bg-capsula-ivory-surface',
  neutral: 'border-capsula-line bg-capsula-ivory-surface',
};

function KpiCard({
  label, value, Icon, tone, sub,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: KpiTone;
  sub?: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-cap-soft ${KPI_TONE[tone]}`}>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">{label}</p>
        <Icon className="h-4 w-4 text-capsula-ink-muted" />
      </div>
      <p className="truncate font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-capsula-ink-soft">{sub}</p>}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-capsula-navy-deep/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-deep">
        <div className="flex items-center justify-between border-b border-capsula-line px-6 py-4">
          <h2 className="font-semibold text-base tracking-[-0.01em] text-capsula-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
