'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X as XIcon, Check, Loader2, Building2, FileText, Banknote } from 'lucide-react';
import { ModalPortal } from '@/components/ui/modal-portal';
import { listSuppliersAction, type SupplierData } from '@/app/actions/supplier.actions';
import { getAccountsPayableAction, registerPaymentAction, type AccountPayableData } from '@/app/actions/account-payable.actions';
import { createSupplierAdvanceAction } from '@/app/actions/supplier-advance.actions';

const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStamp = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

const METHODS = [
  { v: 'CASH_USD', l: 'Efectivo USD' }, { v: 'CASH_BS', l: 'Efectivo Bs' },
  { v: 'ZELLE', l: 'Zelle' }, { v: 'BANK_TRANSFER', l: 'Transferencia' },
  { v: 'MOBILE_PAY', l: 'Pago Móvil' }, { v: 'CHECK', l: 'Cheque' },
];

/**
 * §115 — Abonar a un proveedor desde Gastos.
 *   - "A una factura": pago en efectivo real sobre una cuenta por pagar
 *     (registerPaymentAction, isCash=true).
 *   - "Anticipo (sin factura)": el proveedor factura después. Crea un
 *     SupplierAdvance (efectivo sale ahora, se aplica cuando llegue la factura).
 * Ambos cuentan como egreso UNA sola vez.
 */
export function SupplierPaymentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [mode, setMode] = useState<'INVOICE' | 'ADVANCE'>('INVOICE');
  const [payables, setPayables] = useState<AccountPayableData[]>([]);
  const [payableId, setPayableId] = useState('');
  const [loadingPayables, setLoadingPayables] = useState(false);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH_USD');
  const [paidAt, setPaidAt] = useState(todayStamp());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listSuppliersAction().then(r => setSuppliers((r.data ?? []).filter(s => s.isActive))); }, []);

  useEffect(() => {
    if (!supplierId) { setPayables([]); setPayableId(''); return; }
    setLoadingPayables(true);
    getAccountsPayableAction({ supplierId }).then(r => {
      const pend = (r.data ?? []).filter(p => !['PAID', 'VOID'].includes(p.status));
      setPayables(pend);
      // Si no hay facturas pendientes, sugiere anticipo.
      if (pend.length === 0) setMode('ADVANCE');
    }).finally(() => setLoadingPayables(false));
  }, [supplierId]);

  const selectedPayable = payables.find(p => p.id === payableId);
  const amountNum = parseFloat(amount) || 0;

  const submit = async () => {
    setError('');
    if (!supplierId) { setError('Elige el proveedor'); return; }
    if (amountNum <= 0) { setError('Indica el monto'); return; }
    if (mode === 'INVOICE') {
      if (!payableId) { setError('Elige la factura a abonar'); return; }
      if (selectedPayable && amountNum > selectedPayable.remainingUsd + 0.01) {
        setError(`El abono supera el saldo pendiente ($${fmt(selectedPayable.remainingUsd)})`); return;
      }
    }
    setSaving(true);
    let res: { success: boolean; error?: string };
    if (mode === 'INVOICE') {
      res = await registerPaymentAction(payableId, {
        amountUsd: amountNum, paymentMethod: method, paymentRef: ref || undefined,
        paidAt, notes: notes || undefined,
      });
    } else {
      res = await createSupplierAdvanceAction({
        supplierId, amountUsd: amountNum, paymentMethod: method, paymentRef: ref || undefined,
        paidAt, notes: notes || undefined,
      });
    }
    setSaving(false);
    if (res.success) { toast.success(mode === 'INVOICE' ? 'Abono registrado' : 'Anticipo registrado'); onSaved(); }
    else setError(res.error ?? 'Error');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="bg-capsula-ivory border border-capsula-line w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
          <div className="border-b border-capsula-line p-5 flex items-center justify-between sticky top-0 bg-capsula-ivory z-10">
            <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Abonar a proveedor</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center" aria-label="Cerrar"><XIcon className="h-4 w-4" /></button>
          </div>

          <div className="p-5 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Proveedor</span>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="pos-input w-full py-3">
                <option value="">— elige —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.pendingUsd > 0 ? ` · debe $${fmt(s.pendingUsd)}` : ''}</option>)}
              </select>
            </label>

            {supplierId && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMode('INVOICE')}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${mode === 'INVOICE' ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream' : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft'}`}>
                    <FileText className="h-4 w-4" /> A una factura
                  </button>
                  <button type="button" onClick={() => setMode('ADVANCE')}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${mode === 'ADVANCE' ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream' : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft'}`}>
                    <Banknote className="h-4 w-4" /> Anticipo (sin factura)
                  </button>
                </div>

                {mode === 'INVOICE' ? (
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Factura pendiente</span>
                    {loadingPayables ? (
                      <p className="text-sm text-capsula-ink-muted">Cargando facturas…</p>
                    ) : payables.length === 0 ? (
                      <p className="text-sm text-capsula-ink-muted">Este proveedor no tiene facturas pendientes. Usa <strong>Anticipo</strong>.</p>
                    ) : (
                      <select value={payableId} onChange={e => setPayableId(e.target.value)} className="pos-input w-full py-3">
                        <option value="">— elige la factura —</option>
                        {payables.map(p => <option key={p.id} value={p.id}>{p.invoiceNumber || p.description} · saldo ${fmt(p.remainingUsd)}</option>)}
                      </select>
                    )}
                    {selectedPayable && (
                      <p className="text-xs text-capsula-ink-muted tabular-nums">Saldo pendiente: ${fmt(selectedPayable.remainingUsd)} de ${fmt(selectedPayable.totalAmountUsd)}</p>
                    )}
                  </label>
                ) : (
                  <div className="rounded-xl bg-[#E6ECF4] dark:bg-[#1A2636] px-3 py-2 text-xs text-[#2A4060] dark:text-[#D1DCE9]">
                    <Building2 className="inline h-3.5 w-3.5 mr-1" />
                    El efectivo sale ahora. Cuando llegue la factura, aplicas el anticipo desde Cuentas por pagar (no se cuenta dos veces).
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Monto USD</span>
                    <input type="number" step="0.01" min="0" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="pos-input w-full py-3 tabular-nums" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Fecha</span>
                    <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="pos-input w-full py-3" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Método</span>
                    <select value={method} onChange={e => setMethod(e.target.value)} className="pos-input w-full py-3">
                      {METHODS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Referencia</span>
                    <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Nº transf." className="pos-input w-full py-3" />
                  </label>
                </div>
                {error && <p className="text-sm text-capsula-coral">{error}</p>}
              </>
            )}
          </div>

          <div className="border-t border-capsula-line p-4 flex gap-3">
            <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
            <button onClick={submit} disabled={saving || !supplierId} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {mode === 'INVOICE' ? 'Registrar abono' : 'Registrar anticipo'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
