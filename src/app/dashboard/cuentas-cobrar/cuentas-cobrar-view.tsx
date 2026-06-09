'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HandCoins, Plus, X as XIcon, Check, ChevronDown, Info, AlertTriangle,
} from 'lucide-react';
import {
  createAccountReceivableAction, registerCollectionAction,
  type AccountReceivableData,
} from '@/app/actions/account-receivable.actions';

const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]' },
  PARTIAL: { label: 'Parcial', cls: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]' },
  COLLECTED: { label: 'Cobrado', cls: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' },
  OVERDUE: { label: 'Vencido', cls: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]' },
  VOID: { label: 'Anulado', cls: 'bg-capsula-ivory-alt text-capsula-ink-muted' },
};

const COLLECT_METHODS = ['CASH_USD', 'CASH_BS', 'ZELLE', 'PAGO_MOVIL', 'TRANSFER', 'PDV', 'OTHER'];

interface BankAccountOption { id: string; name: string }

export function CuentasCobrarView({
  initialItems, summary, bankAccounts, canEdit,
}: {
  initialItems: AccountReceivableData[];
  summary: { pendingUsd: number; overdueUsd: number; collectedUsd: number; debtors: number };
  bankAccounts: BankAccountOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'active' | 'all' | 'collected'>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [collectFor, setCollectFor] = useState<AccountReceivableData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = initialItems.filter((i) => {
    if (filter === 'active') return i.status !== 'COLLECTED' && i.status !== 'VOID';
    if (filter === 'collected') return i.status === 'COLLECTED';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Tesorería</p>
          <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
            <HandCoins className="h-6 w-6" /> Cuentas por Cobrar
          </h1>
        </div>
        {canEdit && (
          <button onClick={() => setCreateOpen(true)} className="pos-btn px-4 py-2.5 inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nueva
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Por cobrar" value={`$${fmt(summary.pendingUsd)}`} />
        <Kpi label="Vencido" value={`$${fmt(summary.overdueUsd)}`} danger={summary.overdueUsd > 0} />
        <Kpi label="Cobrado" value={`$${fmt(summary.collectedUsd)}`} />
        <Kpi label="Deudores" value={String(summary.debtors)} />
      </div>

      <div className="bg-capsula-ivory-alt border border-capsula-line rounded-2xl p-4 flex gap-3 text-sm text-capsula-ink-soft">
        <Info className="h-5 w-5 shrink-0 text-capsula-ink-muted mt-0.5" />
        <p>Lo que terceros le deben al negocio (el <strong>"crédito nos deben"</strong> del Excel). Registrá la deuda y andá cargando los cobros parciales; el cobro se puede vincular a la cuenta que lo recibió.</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 p-1 bg-capsula-ivory-alt border border-capsula-line rounded-2xl w-fit">
        {([['active', 'Activas'], ['all', 'Todas'], ['collected', 'Cobradas']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold ${filter === id ? 'bg-capsula-navy-deep text-capsula-cream' : 'text-capsula-ink-muted hover:text-capsula-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="pos-card p-10 text-center">
          <HandCoins className="h-10 w-10 mx-auto text-capsula-ink-faint" />
          <p className="mt-3 text-capsula-ink-soft">No hay cuentas por cobrar en esta vista.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const st = STATUS_STYLE[it.status] ?? STATUS_STYLE.PENDING;
            const open = expanded === it.id;
            return (
              <div key={it.id} className="pos-card overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] ${st.cls}`}>{st.label}</span>
                      <span className="font-semibold text-capsula-ink truncate">{it.debtorName}</span>
                    </div>
                    <p className="text-xs text-capsula-ink-muted truncate mt-0.5">
                      {it.description}{it.reference ? ` · ${it.reference}` : ''} · vence {fmtDate(it.dueDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums text-capsula-ink">${fmt(it.remainingUsd)}</p>
                    <p className="text-[11px] text-capsula-ink-muted tabular-nums">de ${fmt(it.totalAmountUsd)}</p>
                  </div>
                </div>
                <div className="border-t border-capsula-line px-4 py-2 flex items-center justify-between">
                  <button onClick={() => setExpanded(open ? null : it.id)} className="text-xs text-capsula-ink-muted hover:text-capsula-ink inline-flex items-center gap-1">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    {it.payments.length} cobro{it.payments.length === 1 ? '' : 's'}
                  </button>
                  {canEdit && it.status !== 'COLLECTED' && it.status !== 'VOID' && (
                    <button onClick={() => setCollectFor(it)} className="pos-btn px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> Registrar cobro
                    </button>
                  )}
                </div>
                {open && it.payments.length > 0 && (
                  <div className="border-t border-capsula-line bg-capsula-ivory-surface px-4 py-2 space-y-1">
                    {it.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs text-capsula-ink-soft">
                        <span>{fmtDate(p.collectedAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                        <span className="tabular-nums">${fmt(p.amountUsd)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateModal onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); router.refresh(); }} />
      )}
      {collectFor && (
        <CollectModal item={collectFor} bankAccounts={bankAccounts} onClose={() => setCollectFor(null)} onSaved={() => { setCollectFor(null); router.refresh(); }} />
      )}
    </div>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="pos-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${danger ? 'text-capsula-coral' : 'text-capsula-ink'}`}>{value}</p>
    </div>
  );
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState('');
  const [debtorName, setDebtorName] = useState('');
  const [reference, setReference] = useState('');
  const [totalAmountUsd, setTotal] = useState('');
  const [issueDate, setIssueDate] = useState(todayStamp());
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(''); setSaving(true);
    const res = await createAccountReceivableAction({
      description, debtorName, reference,
      totalAmountUsd: parseFloat(totalAmountUsd) || 0,
      issueDate, dueDate: dueDate || undefined,
    });
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    onSaved();
  }

  return (
    <ModalShell title="Nueva cuenta por cobrar" onClose={onClose}>
      <div className="p-5 space-y-4">
        <Field label="¿Quién debe?"><input className="pos-input w-full" value={debtorName} onChange={(e) => setDebtorName(e.target.value)} placeholder="Nombre del deudor" /></Field>
        <Field label="Descripción"><input className="pos-input w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Concepto de la deuda" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto $"><input className="pos-input w-full tabular-nums" type="number" step="0.01" min="0" value={totalAmountUsd} onChange={(e) => setTotal(e.target.value)} /></Field>
          <Field label="Referencia (opcional)"><input className="pos-input w-full" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha"><input className="pos-input w-full" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
          <Field label="Vence (opcional)"><input className="pos-input w-full" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        </div>
        {error && <p className="text-sm text-capsula-coral">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={submit} saving={saving} />
    </ModalShell>
  );
}

function CollectModal({ item, bankAccounts, onClose, onSaved }: { item: AccountReceivableData; bankAccounts: BankAccountOption[]; onClose: () => void; onSaved: () => void }) {
  const [amountUsd, setAmount] = useState(String(item.remainingUsd));
  const [method, setMethod] = useState('CASH_USD');
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [collectedAt, setCollectedAt] = useState(todayStamp());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(''); setSaving(true);
    const res = await registerCollectionAction(item.id, {
      amountUsd: parseFloat(amountUsd) || 0,
      method, bankAccountId: bankAccountId || undefined,
      reference, collectedAt,
    });
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    onSaved();
  }

  return (
    <ModalShell title="Registrar cobro" onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="rounded-2xl bg-capsula-ivory-alt border border-capsula-line p-3 text-sm">
          <p className="text-capsula-ink font-semibold">{item.debtorName}</p>
          <p className="text-capsula-ink-muted text-xs">Saldo pendiente: ${fmt(item.remainingUsd)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto $"><input className="pos-input w-full tabular-nums" type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Forma de cobro">
            <select className="pos-input w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              {COLLECT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Cuenta que recibió (opcional)">
          <select className="pos-input w-full" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">— ninguna —</option>
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha"><input className="pos-input w-full" type="date" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} /></Field>
          <Field label="Referencia (opcional)"><input className="pos-input w-full" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        </div>
        {parseFloat(amountUsd) > item.remainingUsd + 0.01 && (
          <p className="text-sm text-capsula-coral inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> El monto supera el saldo pendiente.</p>
        )}
        {error && <p className="text-sm text-capsula-coral">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={submit} saving={saving} />
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-capsula-line p-5 flex items-center justify-between sticky top-0 bg-capsula-ivory">
          <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center" aria-label="Cerrar">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onConfirm, saving }: { onClose: () => void; onConfirm: () => void; saving: boolean }) {
  return (
    <div className="border-t border-capsula-line p-4 flex gap-3">
      <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
      <button onClick={onConfirm} disabled={saving} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
        <Check className="h-4 w-4" /> {saving ? 'Guardando…' : 'Confirmar'}
      </button>
    </div>
  );
}
