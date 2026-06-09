'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Landmark, Plus, Pencil, CreditCard, X as XIcon, Check, Wallet, Smartphone,
  PowerOff, Info,
} from 'lucide-react';
import {
  createBankAccountAction, updateBankAccountAction,
  createPosTerminalAction, updatePosTerminalAction,
  type BankAccountData, type PosTerminalData,
} from '@/app/actions/bank-account.actions';

const KIND_LABEL: Record<string, string> = { BANK: 'Banco', CASH: 'Efectivo', DIGITAL: 'Digital' };
const POS_METHOD_OPTIONS = [
  '', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG', 'ZELLE',
  'CASH_USD', 'CASH_BS', 'CASH_EUR', 'MOBILE_PAY', 'TRANSFER', 'CARD',
];

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'CASH') return <Wallet className="h-4 w-4" />;
  if (kind === 'DIGITAL') return <Smartphone className="h-4 w-4" />;
  return <Landmark className="h-4 w-4" />;
}

function CurrencyBadge({ currency }: { currency: string }) {
  const cls =
    currency === 'USD'
      ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
      : 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] ${cls}`}>
      {currency}
    </span>
  );
}

export function CuentasBancariasView({
  initialAccounts,
  canEdit,
}: {
  initialAccounts: BankAccountData[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [accountModal, setAccountModal] = useState<{ open: boolean; edit?: BankAccountData }>({ open: false });
  const [terminalModal, setTerminalModal] = useState<{ open: boolean; accountId?: string; edit?: PosTerminalData }>({ open: false });

  const accounts = initialAccounts;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Tesorería</p>
          <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
            <Landmark className="h-6 w-6" /> Cuentas Bancarias
          </h1>
        </div>
        {canEdit && (
          <button onClick={() => setAccountModal({ open: true })} className="pos-btn px-4 py-2.5 inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nueva cuenta
          </button>
        )}
      </div>

      {/* Info */}
      <div className="bg-capsula-ivory-alt border border-capsula-line rounded-2xl p-4 flex gap-3 text-sm text-capsula-ink-soft">
        <Info className="h-5 w-5 shrink-0 text-capsula-ink-muted mt-0.5" />
        <p>
          Cada cuenta es el <strong>eje</strong> de la conciliación: por ella <strong>entra</strong> la venta de sus
          terminales y <strong>sale</strong> el gasto/pago. La moneda decide si aplica conversión Bs→$ y pérdida BCV.
          Los terminales (PDV) cobran una comisión que se calculará por cada cobro.
        </p>
      </div>

      {/* Lista */}
      {accounts.length === 0 ? (
        <div className="pos-card p-10 text-center">
          <Landmark className="h-10 w-10 mx-auto text-capsula-ink-faint" />
          <p className="mt-3 text-capsula-ink-soft">Aún no hay cuentas registradas.</p>
          {canEdit && (
            <button onClick={() => setAccountModal({ open: true })} className="pos-btn mt-4 px-4 py-2.5 inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Crear la primera cuenta
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((acc) => (
            <div key={acc.id} className={`pos-card p-4 space-y-3 ${!acc.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-9 w-9 rounded-full bg-capsula-navy-soft text-capsula-ink flex items-center justify-center shrink-0">
                    <KindIcon kind={acc.kind} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-capsula-ink truncate">{acc.name}</p>
                    <p className="text-xs text-capsula-ink-muted truncate">
                      {acc.bankName || KIND_LABEL[acc.kind]}{acc.rif ? ` · ${acc.rif}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CurrencyBadge currency={acc.currency} />
                  {canEdit && (
                    <button
                      onClick={() => setAccountModal({ open: true, edit: acc })}
                      className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                      aria-label="Editar cuenta"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Terminales */}
              <div className="space-y-1.5">
                {acc.terminals.length === 0 ? (
                  <p className="text-xs text-capsula-ink-faint italic">Sin terminales</p>
                ) : (
                  acc.terminals.map((t) => (
                    <div key={t.id} className={`flex items-center justify-between gap-2 rounded-xl bg-capsula-ivory-surface border border-capsula-line px-3 py-2 ${!t.isActive ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <CreditCard className="h-4 w-4 text-capsula-ink-muted shrink-0" />
                        <span className="text-sm text-capsula-ink truncate">{t.label}</span>
                        {t.posMethodKey && (
                          <span className="text-[10px] text-capsula-ink-faint font-mono truncate">{t.posMethodKey}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs tabular-nums text-capsula-ink-soft">{t.commissionPct}%</span>
                        {canEdit && (
                          <button
                            onClick={() => setTerminalModal({ open: true, accountId: acc.id, edit: t })}
                            className="h-7 w-7 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                            aria-label="Editar terminal"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {canEdit && (
                  <button
                    onClick={() => setTerminalModal({ open: true, accountId: acc.id })}
                    className="w-full mt-1 text-xs font-semibold text-capsula-ink-muted hover:text-capsula-ink inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-dashed border-capsula-line hover:border-capsula-line-strong"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar terminal
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {accountModal.open && (
        <AccountModal
          edit={accountModal.edit}
          onClose={() => setAccountModal({ open: false })}
          onSaved={() => { setAccountModal({ open: false }); router.refresh(); }}
        />
      )}
      {terminalModal.open && terminalModal.accountId && (
        <TerminalModal
          accountId={terminalModal.accountId}
          edit={terminalModal.edit}
          onClose={() => setTerminalModal({ open: false })}
          onSaved={() => { setTerminalModal({ open: false }); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Modal cuenta ──────────────────────────────────────────────────────────

function AccountModal({
  edit, onClose, onSaved,
}: {
  edit?: BankAccountData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(edit?.name ?? '');
  const [bankName, setBankName] = useState(edit?.bankName ?? '');
  const [currency, setCurrency] = useState(edit?.currency ?? 'BS');
  const [kind, setKind] = useState(edit?.kind ?? 'BANK');
  const [rif, setRif] = useState(edit?.rif ?? '');
  const [notes, setNotes] = useState(edit?.notes ?? '');
  const [isActive, setIsActive] = useState(edit?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(''); setSaving(true);
    const payload = { name, bankName, currency, kind, rif, notes };
    const res = edit
      ? await updateBankAccountAction(edit.id, { ...payload, isActive })
      : await createBankAccountAction(payload);
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    onSaved();
  }

  return (
    <ModalShell title={edit ? 'Editar cuenta' : 'Nueva cuenta'} onClose={onClose}>
      <div className="p-5 space-y-4">
        <Field label="Nombre">
          <input className="pos-input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="PROVINCIAL NOUR" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda">
            <select className="pos-input w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="BS">Bolívares (Bs)</option>
              <option value="USD">Dólares ($)</option>
            </select>
          </Field>
          <Field label="Tipo">
            <select className="pos-input w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="BANK">Banco</option>
              <option value="CASH">Efectivo</option>
              <option value="DIGITAL">Digital (Zelle)</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco (opcional)">
            <input className="pos-input w-full" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Banco Provincial" />
          </Field>
          <Field label="RIF (opcional)">
            <input className="pos-input w-full" value={rif} onChange={(e) => setRif(e.target.value)} placeholder="J-12345678-9" />
          </Field>
        </div>
        <Field label="Notas (opcional)">
          <input className="pos-input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {edit && (
          <button
            onClick={() => setIsActive((v) => !v)}
            className="inline-flex items-center gap-2 text-sm text-capsula-ink-soft hover:text-capsula-ink"
          >
            <PowerOff className="h-4 w-4" /> {isActive ? 'Cuenta activa' : 'Cuenta inactiva'}
          </button>
        )}
        {error && <p className="text-sm text-capsula-coral">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={submit} saving={saving} />
    </ModalShell>
  );
}

// ─── Modal terminal ────────────────────────────────────────────────────────

function TerminalModal({
  accountId, edit, onClose, onSaved,
}: {
  accountId: string;
  edit?: PosTerminalData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(edit?.label ?? '');
  const [terminalCode, setTerminalCode] = useState(edit?.terminalCode ?? '');
  const [posMethodKey, setPosMethodKey] = useState(edit?.posMethodKey ?? '');
  const [commissionPct, setCommissionPct] = useState(String(edit?.commissionPct ?? 0));
  const [isActive, setIsActive] = useState(edit?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(''); setSaving(true);
    const pct = parseFloat(commissionPct) || 0;
    const payload = { bankAccountId: accountId, label, terminalCode, posMethodKey, commissionPct: pct };
    const res = edit
      ? await updatePosTerminalAction(edit.id, { ...payload, isActive })
      : await createPosTerminalAction(payload);
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    onSaved();
  }

  return (
    <ModalShell title={edit ? 'Editar terminal' : 'Nuevo terminal'} onClose={onClose}>
      <div className="p-5 space-y-4">
        <Field label="Etiqueta">
          <input className="pos-input w-full" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="PDV Superferro" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Método POS">
            <select className="pos-input w-full" value={posMethodKey} onChange={(e) => setPosMethodKey(e.target.value)}>
              {POS_METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>{m || '— ninguno —'}</option>
              ))}
            </select>
          </Field>
          <Field label="Comisión %">
            <input
              className="pos-input w-full tabular-nums"
              type="number" step="0.01" min="0"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Código / afiliación (opcional)">
          <input className="pos-input w-full" value={terminalCode} onChange={(e) => setTerminalCode(e.target.value)} />
        </Field>
        {edit && (
          <button
            onClick={() => setIsActive((v) => !v)}
            className="inline-flex items-center gap-2 text-sm text-capsula-ink-soft hover:text-capsula-ink"
          >
            <PowerOff className="h-4 w-4" /> {isActive ? 'Terminal activo' : 'Terminal inactivo'}
          </button>
        )}
        {error && <p className="text-sm text-capsula-coral">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={submit} saving={saving} />
    </ModalShell>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

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
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
            aria-label="Cerrar"
          >
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
      <button
        onClick={onConfirm}
        disabled={saving}
        className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Check className="h-4 w-4" /> {saving ? 'Guardando…' : 'Confirmar'}
      </button>
    </div>
  );
}
