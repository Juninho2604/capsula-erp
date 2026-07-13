'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, X as XIcon, Check, PackageCheck, Link2, Receipt, Ban,
  Info, Loader2, AlertTriangle, Trash2,
} from 'lucide-react';
import {
  createSupplierDocumentAction, enterDocumentToInventoryAction,
  linkDocumentToPurchaseOrderAction, generatePayableFromDocumentAction,
  voidSupplierDocumentAction, getPurchaseReconciliationReportAction,
  type SupplierDocumentData,
} from '@/app/actions/supplier-document.actions';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { packUnits, packLineTotal, packUnitCost } from '@/lib/purchases/pack-line';

const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
const todayStamp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

interface ItemOpt { id: string; name: string; unit: string }
interface AreaOpt { id: string; name: string }
interface SupplierOpt { id: string; name: string }
interface POOpt { id: string; orderNumber: string; orderName: string | null }

interface Props {
  initialDocuments: SupplierDocumentData[];
  items: ItemOpt[];
  areas: AreaOpt[];
  suppliers: SupplierOpt[];
  receivedPOs: POOpt[];
  canEdit: boolean;
}

export function DocumentosView(props: Props) {
  const { initialDocuments, canEdit } = props;
  const router = useRouter();
  const [tab, setTab] = useState<'docs' | 'concil'>('docs');
  const [createOpen, setCreateOpen] = useState(false);
  const [entryFor, setEntryFor] = useState<SupplierDocumentData | null>(null);
  const [linkFor, setLinkFor] = useState<SupplierDocumentData | null>(null);
  const refresh = () => router.refresh();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Compras</p>
          <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
            <FileText className="h-6 w-6" /> Facturas y Notas de Entrega
          </h1>
        </div>
        {canEdit && tab === 'docs' && (
          <button onClick={() => setCreateOpen(true)} className="pos-btn px-4 py-2.5 inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nuevo documento
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-capsula-ivory-alt border border-capsula-line rounded-2xl w-fit">
        {([['docs', 'Documentos'], ['concil', 'Conciliación']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === id ? 'bg-capsula-navy-deep text-capsula-cream' : 'text-capsula-ink-muted hover:text-capsula-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'concil' ? (
        <ReconciliationTab />
      ) : (
        <>
          <div className="bg-capsula-ivory-alt border border-capsula-line rounded-2xl p-4 flex gap-3 text-sm text-capsula-ink-soft">
            <Info className="h-5 w-5 shrink-0 text-capsula-ink-muted mt-0.5" />
            <p>Carga la factura o nota de entrega. Después, en cualquier momento: <strong>da entrada al inventario</strong>, <strong>vincúlala a una orden de compra</strong> ya recibida, y/o <strong>genera la cuenta por pagar</strong> (si es a crédito).</p>
          </div>

          {initialDocuments.length === 0 ? (
            <div className="pos-card p-10 text-center">
              <FileText className="h-10 w-10 mx-auto text-capsula-ink-faint" />
              <p className="mt-3 text-capsula-ink-soft">Aún no hay documentos cargados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {initialDocuments.map((d) => (
                <DocRow key={d.id} doc={d} canEdit={canEdit}
                  onEntry={() => setEntryFor(d)} onLink={() => setLinkFor(d)} onChanged={refresh} />
              ))}
            </div>
          )}
        </>
      )}

      {createOpen && (
        <CreateModal {...props} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); refresh(); }} />
      )}
      {entryFor && (
        <EntryModal doc={entryFor} areas={props.areas} onClose={() => setEntryFor(null)} onSaved={() => { setEntryFor(null); refresh(); }} />
      )}
      {linkFor && (
        <LinkModal doc={linkFor} pos={props.receivedPOs} onClose={() => setLinkFor(null)} onSaved={() => { setLinkFor(null); refresh(); }} />
      )}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: 'info' | 'ok' | 'warn' | 'danger' | 'muted' }) {
  const cls = {
    info: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
    ok: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
    warn: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]',
    danger: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]',
    muted: 'bg-capsula-ivory-alt text-capsula-ink-muted',
  }[tone];
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] ${cls}`}>{label}</span>;
}

function DocRow({ doc, canEdit, onEntry, onLink, onChanged }: {
  doc: SupplierDocumentData; canEdit: boolean; onEntry: () => void; onLink: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState('');
  const voided = doc.status === 'VOID';

  async function genPayable() {
    setBusy('pay');
    const res = await generatePayableFromDocumentAction(doc.id);
    setBusy('');
    if (!res.success) alert(res.error); else onChanged();
  }
  async function voidDoc() {
    if (!confirm('¿Anular este documento?')) return;
    setBusy('void');
    const res = await voidSupplierDocumentAction(doc.id, 'Anulado desde la lista');
    setBusy('');
    if (!res.success) alert(res.error); else onChanged();
  }

  return (
    <div className={`pos-card p-4 ${voided ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge label={doc.documentType === 'FACTURA' ? 'Factura' : 'Nota entrega'} tone="info" />
            <Badge label={doc.paymentCondition === 'CREDITO' ? 'Crédito' : 'Contado'} tone={doc.paymentCondition === 'CREDITO' ? 'warn' : 'muted'} />
            <Badge label={doc.inventoryStatus === 'ENTERED' ? 'En inventario' : 'Sin entrada'} tone={doc.inventoryStatus === 'ENTERED' ? 'ok' : 'muted'} />
            {doc.linkedPurchaseOrderId && <Badge label="OC vinculada" tone="ok" />}
            {doc.accountPayableId && <Badge label="Deuda" tone="info" />}
            {voided && <Badge label="Anulado" tone="danger" />}
          </div>
          <p className="font-semibold text-capsula-ink mt-1.5">{doc.documentNumber}</p>
          <p className="text-xs text-capsula-ink-muted truncate">
            {doc.supplierName || 'Sin proveedor'} · {fmtDate(doc.documentDate)} · {doc.items.length} ítem{doc.items.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold tabular-nums text-capsula-ink">${fmt(doc.totalAmount)}</p>
        </div>
      </div>
      {canEdit && !voided && (
        <div className="border-t border-capsula-line mt-3 pt-3 flex flex-wrap gap-2">
          {doc.inventoryStatus !== 'ENTERED' && (
            <button onClick={onEntry} className="pos-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
              <PackageCheck className="h-3.5 w-3.5" /> Dar entrada
            </button>
          )}
          <button onClick={onLink} className="pos-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> {doc.linkedPurchaseOrderId ? 'Re-vincular OC' : 'Vincular OC'}
          </button>
          {!doc.accountPayableId && (
            <button onClick={genPayable} disabled={busy === 'pay'} className="pos-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-60">
              {busy === 'pay' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />} Generar deuda
            </button>
          )}
          {doc.inventoryStatus !== 'ENTERED' && (
            <button onClick={voidDoc} disabled={busy === 'void'} className="pos-btn-danger px-3 py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-60">
              <Ban className="h-3.5 w-3.5" /> Anular
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReconciliationTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getPurchaseReconciliationReportAction>>['data'] | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPurchaseReconciliationReportAction();
    setLoading(false);
    if (res.success) setData(res.data ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="pos-card p-10 flex items-center justify-center text-capsula-ink-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-capsula-ivory-alt border border-capsula-line rounded-2xl p-4 flex gap-3 text-sm text-capsula-ink-soft">
        <AlertTriangle className="h-5 w-5 shrink-0 text-capsula-ink-muted mt-0.5" />
        <p>Descalces entre documentos y compras: facturas/notas sin entrada ni OC, y órdenes de compra recibidas sin documento.</p>
      </div>
      <div className="pos-card p-4">
        <h3 className="font-semibold text-capsula-ink mb-3">Documentos sin compra ni entrada ({data?.orphanDocuments.length ?? 0})</h3>
        {!data?.orphanDocuments.length ? <p className="text-sm text-capsula-ink-faint">Todo conciliado 🎉</p> : (
          <div className="space-y-1.5">
            {data.orphanDocuments.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm border-b border-capsula-line last:border-0 py-1.5">
                <span className="text-capsula-ink">{d.documentType === 'FACTURA' ? 'Factura' : 'Nota'} {d.documentNumber} · {d.supplierName || 's/prov'}</span>
                <span className="tabular-nums text-capsula-ink-soft">${fmt(d.totalAmount)} · {fmtDate(d.documentDate)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pos-card p-4">
        <h3 className="font-semibold text-capsula-ink mb-3">Compras recibidas sin documento ({data?.orphanPurchaseOrders.length ?? 0})</h3>
        {!data?.orphanPurchaseOrders.length ? <p className="text-sm text-capsula-ink-faint">Todo conciliado 🎉</p> : (
          <div className="space-y-1.5">
            {data.orphanPurchaseOrders.map((po) => (
              <div key={po.id} className="flex items-center justify-between text-sm border-b border-capsula-line last:border-0 py-1.5">
                <span className="text-capsula-ink">{po.orderNumber}{po.orderName ? ` · ${po.orderName}` : ''} · {po.supplierName || 's/prov'}</span>
                <span className="tabular-nums text-capsula-ink-soft">${fmt(po.totalAmount)} · {fmtDate(po.receivedDate)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modales ────────────────────────────────────────────────────────────────

interface Line {
  inventoryItemId: string;
  itemName: string;
  // §108: soporte de presentación — "5 bultos x 12 paquetes por $X el bulto".
  // quantity = cantidad de bultos (o unidades sueltas si unitsPerPack queda en 1).
  quantity: string;
  unitsPerPack: string; // unidades del insumo por bulto (default 1)
  unitCost: string;     // costo POR BULTO en la moneda del documento
  unit: string;
}

// §108.1: matemática en lib puro testeado (pack-line.test.ts).
const lineUnits = (l: Line) => packUnits(l);
const lineTotal = (l: Line) => packLineTotal(l);

function CreateModal({ items, suppliers, onClose, onSaved }: Props & { onClose: () => void; onSaved: () => void }) {
  const [documentType, setType] = useState('FACTURA');
  const [documentNumber, setNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [documentDate, setDate] = useState(todayStamp());
  const [paymentCondition, setCond] = useState('CONTADO');
  // §108: moneda del documento. En Bs se convierte a USD al guardar (el
  // costeo de inventario y las CXP viven en USD) con la tasa auditada.
  const [currency, setCurrency] = useState<'USD' | 'BS'>('USD');
  const [rateStr, setRateStr] = useState('');
  const [dayRate, setDayRate] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([{ inventoryItemId: '', itemName: '', quantity: '', unitsPerPack: '', unitCost: '', unit: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getExchangeRateValue().then((r) => {
      if (r) { setDayRate(r); setRateStr((prev) => prev || String(r)); }
    }).catch(() => {});
  }, []);

  const rate = parseFloat(rateStr) || 0;
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const totalUsd = currency === 'BS' ? (rate > 0 ? total / rate : 0) : total;

  function setLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }
  function pickItem(idx: number, itemId: string) {
    const it = items.find((i) => i.id === itemId);
    setLine(idx, { inventoryItemId: itemId, itemName: it?.name ?? '', unit: it?.unit ?? '' });
  }

  async function submit() {
    setError('');
    if (currency === 'BS' && rate <= 0) { setError('Indica la tasa Bs/USD para convertir el documento'); return; }
    setSaving(true);
    const res = await createSupplierDocumentAction({
      documentType, documentNumber,
      supplierId: supplierId || undefined,
      supplierName: supplierId ? undefined : (supplierName || undefined),
      documentDate, paymentCondition,
      inputCurrency: currency,
      exchangeRate: currency === 'BS' ? rate : undefined,
      items: lines.filter((l) => l.inventoryItemId && lineUnits(l) > 0).map((l) => ({
        inventoryItemId: l.inventoryItemId, itemName: l.itemName,
        quantity: lineUnits(l), unit: l.unit,
        // costo por unidad base (el server lo convierte a USD si es Bs)
        unitCost: packUnitCost(l),
      })),
    });
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    onSaved();
  }

  const sym = currency === 'BS' ? 'Bs' : '$';

  return (
    <ModalShell title="Nuevo documento" onClose={onClose} wide>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tipo">
            <select className="pos-input w-full py-3" value={documentType} onChange={(e) => setType(e.target.value)}>
              <option value="FACTURA">Factura</option>
              <option value="NOTA_ENTREGA">Nota de entrega</option>
            </select>
          </Field>
          <Field label="N° de documento"><input className="pos-input w-full py-3" value={documentNumber} onChange={(e) => setNumber(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Proveedor (sistema)">
            <select className="pos-input w-full py-3" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); if (e.target.value) setSupplierName(''); }}>
              <option value="">— ninguno —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="o Nombre libre"><input className="pos-input w-full py-3" value={supplierName} disabled={!!supplierId} onChange={(e) => setSupplierName(e.target.value)} placeholder="Si no está en el sistema" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Fecha"><input className="pos-input w-full py-3" type="date" value={documentDate} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Condición">
            <select className="pos-input w-full py-3" value={paymentCondition} onChange={(e) => setCond(e.target.value)}>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </Field>
        </div>

        {/* §108: moneda del documento */}
        <div className="rounded-xl bg-capsula-ivory-alt border border-capsula-line p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">¿En qué moneda está la factura?</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-[220px]">
              {(['USD', 'BS'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${currency === c ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream' : 'border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:border-capsula-navy-deep/40'}`}>
                  {c === 'USD' ? 'Dólares $' : 'Bolívares Bs'}
                </button>
              ))}
            </div>
            {currency === 'BS' && (
              <label className="flex items-center gap-2 text-sm text-capsula-ink">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Tasa Bs/USD</span>
                <input type="number" step="0.01" min="0" inputMode="decimal"
                  className="pos-input w-28 py-2.5 tabular-nums" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />
              </label>
            )}
          </div>
          {currency === 'BS' && (
            <p className="text-[11px] text-capsula-ink-muted">
              Los costos se escriben en Bs y el sistema los guarda convertidos a USD a esta tasa
              {dayRate ? ` (tasa del día: Bs ${dayRate.toLocaleString('es-VE')})` : ''}. La tasa queda auditada en el documento.
            </p>
          )}
        </div>

        {/* §108: líneas con presentación bulto × unidades */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Líneas</p>
          <div className="hidden sm:grid grid-cols-[minmax(0,4fr)_minmax(80px,1fr)_minmax(90px,1fr)_minmax(110px,1.4fr)_minmax(90px,1.2fr)_28px] gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-capsula-ink-muted px-1">
            <span>Insumo</span><span>Bultos</span><span>Unid./bulto</span><span>Costo bulto {sym}</span><span className="text-right">Total línea</span><span />
          </div>
          {lines.map((l, idx) => {
            const units = lineUnits(l);
            return (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-[minmax(0,4fr)_minmax(80px,1fr)_minmax(90px,1fr)_minmax(110px,1.4fr)_minmax(90px,1.2fr)_28px] gap-2 items-center border-b border-capsula-line/60 sm:border-0 pb-2 sm:pb-0">
                <select className="pos-input w-full py-3 min-w-0 col-span-2 sm:col-span-1" value={l.inventoryItemId} onChange={(e) => pickItem(idx, e.target.value)}>
                  <option value="">— insumo —</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input className="pos-input w-full py-3 tabular-nums" type="number" step="0.01" min="0" inputMode="decimal" placeholder="Cant." title="Cantidad de bultos (o unidades sueltas)"
                  value={l.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
                <input className="pos-input w-full py-3 tabular-nums" type="number" step="0.01" min="0" inputMode="decimal" placeholder="×1" title="Unidades por bulto (deja vacío si compras por unidad)"
                  value={l.unitsPerPack} onChange={(e) => setLine(idx, { unitsPerPack: e.target.value })} />
                <input className="pos-input w-full py-3 tabular-nums" type="number" step="0.01" min="0" inputMode="decimal" placeholder={`Costo ${sym}`} title={`Costo por bulto en ${sym}`}
                  value={l.unitCost} onChange={(e) => setLine(idx, { unitCost: e.target.value })} />
                <div className="text-right text-sm tabular-nums text-capsula-ink-soft">
                  <p className="font-semibold text-capsula-ink">{sym} {fmt(lineTotal(l))}</p>
                  {units > 0 && <p className="text-[10px] text-capsula-ink-muted">{fmt(units)} {l.unit || 'unid.'}</p>}
                </div>
                <button onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls)} className="text-capsula-ink-muted hover:text-capsula-coral shrink-0 justify-self-end" aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
          <button onClick={() => setLines((ls) => [...ls, { inventoryItemId: '', itemName: '', quantity: '', unitsPerPack: '', unitCost: '', unit: '' }])} className="text-xs font-semibold text-capsula-ink-muted hover:text-capsula-ink inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Agregar línea
          </button>
          <p className="text-[11px] text-capsula-ink-muted">
            Ej: 5 bultos de harina × 12 paquetes c/u a {sym} 30 el bulto → escribe Bultos 5, Unid./bulto 12, Costo bulto 30.
            Si compras por unidad, deja «Unid./bulto» vacío.
          </p>
        </div>

        <div className="border-t border-capsula-line pt-2 space-y-0.5">
          <div className="flex justify-between font-semibold text-capsula-ink">
            <span>Total</span><span className="tabular-nums">{sym} {fmt(total)}</span>
          </div>
          {currency === 'BS' && (
            <div className="flex justify-between text-xs text-capsula-ink-muted tabular-nums">
              <span>Equivalente USD (a tasa {rate > 0 ? fmt(rate) : '—'})</span>
              <span>${fmt(totalUsd)}</span>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-capsula-coral">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={submit} saving={saving} />
    </ModalShell>
  );
}

function EntryModal({ doc, areas, onClose, onSaved }: { doc: SupplierDocumentData; areas: AreaOpt[]; onClose: () => void; onSaved: () => void }) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setError(''); setSaving(true);
    const res = await enterDocumentToInventoryAction(doc.id, areaId);
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    onSaved();
  }
  return (
    <ModalShell title="Dar entrada al inventario" onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-sm text-capsula-ink-soft">Se cargarán <strong>{doc.items.length}</strong> ítem(s) de <strong>{doc.documentNumber}</strong> al área elegida (movimiento + stock + costo promedio).</p>
        <Field label="Área destino">
          <select className="pos-input w-full" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        {error && <p className="text-sm text-capsula-coral">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={submit} saving={saving} confirmLabel="Dar entrada" />
    </ModalShell>
  );
}

function LinkModal({ doc, pos, onClose, onSaved }: { doc: SupplierDocumentData; pos: POOpt[]; onClose: () => void; onSaved: () => void }) {
  const [poId, setPoId] = useState(doc.linkedPurchaseOrderId ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setError(''); setSaving(true);
    const res = await linkDocumentToPurchaseOrderAction(doc.id, poId || null);
    setSaving(false);
    if (!res.success) { setError(res.error ?? 'Error'); return; }
    onSaved();
  }
  return (
    <ModalShell title="Vincular a orden de compra" onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-sm text-capsula-ink-soft">Vincula <strong>{doc.documentNumber}</strong> a una OC recibida (cuando la mercancía entró antes por una orden).</p>
        <Field label="Orden de compra">
          <select className="pos-input w-full" value={poId} onChange={(e) => setPoId(e.target.value)}>
            <option value="">— sin vincular —</option>
            {pos.map((p) => <option key={p.id} value={p.id}>{p.orderNumber}{p.orderName ? ` · ${p.orderName}` : ''}</option>)}
          </select>
        </Field>
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

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className={`bg-capsula-ivory border border-capsula-line w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
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

function ModalFooter({ onClose, onConfirm, saving, confirmLabel }: { onClose: () => void; onConfirm: () => void; saving: boolean; confirmLabel?: string }) {
  return (
    <div className="border-t border-capsula-line p-4 flex gap-3">
      <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
      <button onClick={onConfirm} disabled={saving} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
        <Check className="h-4 w-4" /> {saving ? 'Guardando…' : (confirmLabel ?? 'Confirmar')}
      </button>
    </div>
  );
}
