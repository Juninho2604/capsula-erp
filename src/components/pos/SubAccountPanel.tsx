'use client';

/**
 * SubAccountPanel — Panel de división de cuenta por subcuentas (POS Restaurante / Mesero).
 * Renderiza la lista de subcuentas, el pool de ítems sin asignar,
 * la UI de asignación y el cobro individual por subcuenta.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { DollarSign, Euro, Zap, CreditCard, Smartphone, Banknote, X as XIcon, CheckCircle2, Trash2, Pencil, Check, SplitSquareHorizontal, ArrowLeft, Plus, Printer, Ban, Lock } from 'lucide-react';
import {
    assignItemToSubAccountAction,
    autoSplitEqualAction,
    createSubAccountsAction,
    deleteSubAccountAction,
    getOpenTabWithSubAccountsAction,
    paySubAccountAction,
    renameSubAccountAction,
    unassignItemFromSubAccountAction,
    validateManagerPinAction,
    voidSubAccountAction,
    type POSPaymentMethod,
} from '@/app/actions/pos.actions';
import { getDivisasDiscountPercentAction } from '@/app/actions/system-config.actions';
import { printReceipt } from '@/lib/print-command';
import { useTenantBranding } from '@/lib/hooks/use-tenant-branding';

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface SubModifier {
    name: string;
    priceAdjustment: number;
}
interface SubSalesOrderItem {
    id: string;
    itemName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    modifiers: SubModifier[];
    subAccountItems: { subAccountId: string; quantity: number }[];
}
interface SubAccountItemRow {
    id: string;
    quantity: number;
    lineTotal: number;
    salesOrderItem: SubSalesOrderItem;
}
interface SubAccount {
    id: string;
    label: string;
    sortOrder: number;
    status: string; // OPEN | PAID | VOID
    subtotal: number;
    serviceCharge: number;
    total: number;
    paidAmount: number;
    paymentMethod?: string | null;
    items: SubAccountItemRow[];
}
interface TabOrder {
    id: string;
    items: SubSalesOrderItem[];
}
interface TabWithSubs {
    id: string;
    balanceDue: number;
    runningTotal: number;
    subAccounts: SubAccount[];
    orders: TabOrder[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubAccountPanelProps {
    openTabId: string;
    exchangeRate: number | null;
    onClose: () => void;
    onTabUpdated: (tab: any) => void; // Sync back to parent
    // Contexto opcional para impresión de recibos individuales por subcuenta.
    // Si se proveen, los recibos térmicos incluirán mesa/cliente/código de tab.
    tabCode?: string;
    customerLabel?: string;
    tableLabel?: string;
    cashierName?: string;
    // Si es false, oculta el flujo de cobro (botón "Cobrar" + form de pago).
    // Usado por POS Mesero: el mesero crea/asigna subcuentas pero el cobro
    // sigue siendo del cajero. Default true para no romper POS Restaurante.
    canCharge?: boolean;
}

// ─── Payment method labels ────────────────────────────────────────────────────

type PayMethodDef = {
    id: POSPaymentMethod;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
};

const PAY_METHODS: PayMethodDef[] = [
    { id: 'CASH_USD',       label: 'Cash $',       Icon: DollarSign },
    { id: 'CASH_EUR',       label: 'Cash €',       Icon: Euro },
    { id: 'ZELLE',          label: 'Zelle',        Icon: Zap },
    { id: 'PDV_SHANKLISH',  label: 'PDV Shan.',    Icon: CreditCard },
    { id: 'PDV_SUPERFERRO', label: 'PDV Super.',   Icon: CreditCard },
    { id: 'MOVIL_NG',       label: 'Móvil NG',     Icon: Smartphone },
    { id: 'CASH_BS',        label: 'Efectivo Bs',  Icon: Banknote },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function assignedQtyForItem(item: SubSalesOrderItem, subAccountId: string): number {
    return item.subAccountItems
        .filter((s) => s.subAccountId === subAccountId)
        .reduce((a, s) => a + s.quantity, 0);
}

function totalAssignedQty(item: SubSalesOrderItem): number {
    return item.subAccountItems.reduce((a, s) => a + s.quantity, 0);
}

// ─── Sub-components (top-level per Vercel React rules) ───────────────────────

interface PoolItemRowProps {
    item: SubSalesOrderItem;
    subAccounts: SubAccount[];
    isProcessing: boolean;
    onAssign: (itemId: string, subId: string, qty: number) => void;
    onUnassign: (itemId: string, subId: string) => void;
}

function PoolItemRow({ item, subAccounts, isProcessing, onAssign, onUnassign }: PoolItemRowProps) {
    const [expanded, setExpanded] = useState(false);
    const [pickedSub, setPickedSub] = useState('');
    const [qty, setQty] = useState(1);

    const poolQty = item.quantity - totalAssignedQty(item);
    const alreadyAssigned = item.subAccountItems.filter((s) => s.quantity > 0);

    return (
        <div className="space-y-1.5 rounded-xl border border-capsula-line bg-capsula-ivory-surface p-2.5">
            {/* Item header */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-capsula-ink">
                        {item.quantity}× {item.itemName}
                    </div>
                    {item.modifiers.length > 0 && (
                        <div className="truncate text-[11px] text-capsula-ink-muted">
                            {item.modifiers.map((m) => m.name).join(', ')}
                        </div>
                    )}
                </div>
                <div className="shrink-0 text-right">
                    <div className="text-xs font-medium tabular-nums text-capsula-ink">${item.lineTotal.toFixed(2)}</div>
                    {poolQty > 0 && (
                        <div className="text-[11px] text-capsula-ink-muted">Pool: {poolQty}</div>
                    )}
                </div>
            </div>

            {/* Existing assignments */}
            {alreadyAssigned.map((a) => {
                const sub = subAccounts.find((s) => s.id === a.subAccountId);
                if (!sub) return null;
                return (
                    <div
                        key={a.subAccountId}
                        className="flex items-center justify-between rounded-lg border border-capsula-navy/10 bg-capsula-navy-soft px-2 py-1 text-[11px]"
                    >
                        <span className="font-medium text-capsula-ink">
                            {a.quantity}× → {sub.label}
                        </span>
                        {sub.status === 'OPEN' && (
                            <button
                                disabled={isProcessing}
                                onClick={() => onUnassign(item.id, a.subAccountId)}
                                className="rounded-full p-0.5 text-capsula-coral transition-colors hover:bg-capsula-coral-subtle disabled:opacity-40"
                                aria-label="Quitar asignación"
                            >
                                <XIcon className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                );
            })}

            {/* Assign button */}
            {poolQty > 0 && subAccounts.filter((s) => s.status === 'OPEN').length > 0 && (
                <button
                    onClick={() => { setExpanded((p) => !p); setPickedSub(''); setQty(1); }}
                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-alt py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-soft transition-colors hover:border-capsula-navy-deep hover:text-capsula-ink"
                >
                    {expanded ? 'Cancelar' : `Asignar (${poolQty} disponible${poolQty > 1 ? 's' : ''})`}
                </button>
            )}

            {/* Assign form */}
            {expanded && (
                <div className="space-y-1.5 border-t border-capsula-line pt-1.5">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                        Mover a:
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {subAccounts.filter((s) => s.status === 'OPEN').map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setPickedSub(s.id)}
                                className={`rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                                    pickedSub === s.id
                                        ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                        : 'border-capsula-line text-capsula-ink-soft hover:border-capsula-navy-deep'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    {pickedSub && poolQty > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-capsula-ink-muted">Cantidad:</span>
                            <button
                                onClick={() => setQty((q) => Math.max(1, q - 1))}
                                className="h-6 w-6 rounded-lg border border-capsula-line bg-capsula-ivory-surface text-xs font-medium text-capsula-ink transition-colors hover:border-capsula-navy-deep"
                            >
                                −
                            </button>
                            <span className="w-6 text-center text-sm font-medium tabular-nums text-capsula-ink">{qty}</span>
                            <button
                                onClick={() => setQty((q) => Math.min(poolQty, q + 1))}
                                className="h-6 w-6 rounded-lg border border-capsula-line bg-capsula-ivory-surface text-xs font-medium text-capsula-ink transition-colors hover:border-capsula-navy-deep"
                            >
                                +
                            </button>
                        </div>
                    )}
                    {pickedSub && (
                        <button
                            disabled={isProcessing}
                            onClick={() => { onAssign(item.id, pickedSub, qty); setExpanded(false); }}
                            className="pos-btn w-full !min-h-0 py-1.5 text-[11px] disabled:opacity-40"
                        >
                            Confirmar asignación
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

interface SubAccountCardProps {
    sub: SubAccount;
    isProcessing: boolean;
    onRename: (subId: string, label: string) => void;
    onDelete: (subId: string) => void;
    onPay: (subId: string, method: POSPaymentMethod, amount: number, serviceIncluded: boolean, discountType: 'NONE' | 'DIVISAS_33') => void;
    onUnassign: (itemId: string, subId: string) => void;
    onPrint: (sub: SubAccount, includeService: boolean) => void;
    onVoid: (sub: SubAccount) => void;
    canCharge: boolean;
    /** Fracción de descuento por divisas (§87). Default 1/3. */
    divisasRate?: number;
}

// Cash USD/EUR/Zelle aplican descuento de divisas automático.
const isDivisasPayMethod = (m: POSPaymentMethod): boolean =>
    m === 'CASH' || m === 'CASH_USD' || m === 'CASH_EUR' || m === 'ZELLE';

function SubAccountCard({ sub, isProcessing, onRename, onDelete, onPay, onUnassign, onPrint, onVoid, canCharge, divisasRate = 1 / 3 }: SubAccountCardProps) {
    const [editing, setEditing] = useState(false);
    const [labelInput, setLabelInput] = useState(sub.label);
    const [showPayForm, setShowPayForm] = useState(false);
    // payMethod arranca con CASH_USD como sentinel pero NO se considera elegido
    // hasta que la cajera presione un botón (payMethodTouched=true). Hasta
    // entonces no se resalta visualmente, no se aplica el descuento divisas y
    // el botón "Confirmar" queda deshabilitado.
    const [payMethod, setPayMethod] = useState<POSPaymentMethod>('CASH_USD');
    const [payMethodTouched, setPayMethodTouched] = useState(false);
    const [serviceIncluded, setServiceIncluded] = useState(true);
    const [amountInput, setAmountInput] = useState('');

    const isPaid = sub.status === 'PAID';
    // Si el método es divisas (cash USD/EUR/Zelle) → aplica 33% descuento automático.
    // Sólo cuenta si la cajera HA ELEGIDO un método (payMethodTouched).
    const applyDivisasDiscount = payMethodTouched && isDivisasPayMethod(payMethod);
    const discountAmount = applyDivisasDiscount ? sub.subtotal * divisasRate : 0;
    const subtotalAfterDiscount = sub.subtotal - discountAmount;
    const serviceChargeAfterDiscount = serviceIncluded ? subtotalAfterDiscount * 0.1 : 0;
    const totalWithService = subtotalAfterDiscount + serviceChargeAfterDiscount;

    // Auto-rellenar el monto cuando cambia el método o el toggle de servicio,
    // pero no si el cajero ya tipeó un monto distinto manualmente.
    useEffect(() => {
        if (!showPayForm) return;
        setAmountInput(totalWithService.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payMethod, payMethodTouched, serviceIncluded, showPayForm]);

    // Resetear el flag touched cuando se cierra el formulario de pago
    // para que la próxima apertura vuelva a exigir elección activa.
    useEffect(() => {
        if (!showPayForm) setPayMethodTouched(false);
    }, [showPayForm]);

    function handleRename() {
        if (labelInput.trim()) { onRename(sub.id, labelInput.trim()); }
        setEditing(false);
    }

    function handlePayConfirm() {
        if (!payMethodTouched) { toast.error('Selecciona un método de pago'); return; }
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) { toast.error('Monto inválido'); return; }
        onPay(sub.id, payMethod, amt, serviceIncluded, applyDivisasDiscount ? 'DIVISAS_33' : 'NONE');
        setShowPayForm(false);
    }

    return (
        <div className={`overflow-hidden rounded-xl border ${
            isPaid
                ? 'border-[#D3E2D8] bg-[#E5EDE7]/40'
                : 'border-capsula-line bg-capsula-ivory-surface'
        }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-3 py-2 ${
                isPaid ? 'bg-[#E5EDE7]/80' : 'bg-capsula-ivory-alt'
            }`}>
                {editing ? (
                    <div className="flex flex-1 items-center gap-1.5">
                        <input
                            autoFocus
                            value={labelInput}
                            onChange={(e) => setLabelInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
                            className="flex-1 rounded-lg border border-capsula-navy-deep bg-capsula-ivory px-2 py-1 text-xs font-medium text-capsula-ink focus:outline-none"
                        />
                        <button
                            onClick={handleRename}
                            className="rounded-full p-0.5 text-capsula-ink transition-colors hover:bg-capsula-navy-soft"
                            aria-label="Confirmar nombre"
                        >
                            <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => setEditing(false)}
                            className="rounded-full p-0.5 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt"
                            aria-label="Cancelar edición"
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2F6B4E]">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {sub.label}
                            </span>
                        ) : (
                            <button
                                onClick={() => { setEditing(true); setLabelInput(sub.label); }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-capsula-ink transition-colors hover:text-capsula-ink"
                            >
                                <Pencil className="h-3 w-3" />
                                {sub.label}
                            </button>
                        )}
                    </div>
                )}
                <div className="ml-auto flex items-center gap-1">
                    {/* Imprimir recibo individual de esta subcuenta. Funciona
                        antes (pre-cuenta) y después (recibo de pago) del cobro. */}
                    {sub.items.length > 0 && (
                        <button
                            disabled={isProcessing}
                            onClick={() => onPrint(sub, true)}
                            className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink disabled:opacity-40"
                            title={isPaid ? 'Reimprimir recibo' : 'Imprimir pre-cuenta'}
                            aria-label="Imprimir recibo de subcuenta"
                        >
                            <Printer className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {!isPaid && (
                        <button
                            disabled={isProcessing}
                            onClick={() => onDelete(sub.id)}
                            className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral disabled:opacity-40"
                            title="Eliminar subcuenta"
                            aria-label="Eliminar subcuenta"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {isPaid && (
                        <>
                            <span className="rounded-full border border-[#D3E2D8] bg-[#E5EDE7] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#2F6B4E] dark:border-[#244935] dark:bg-[#1E3B2C] dark:text-[#6FB88F]">
                                PAGADA ${sub.paidAmount.toFixed(2)}
                            </span>
                            {/* Anular subcuenta cobrada — restaura el saldo a la mesa */}
                            <button
                                disabled={isProcessing}
                                onClick={() => onVoid(sub)}
                                className="inline-flex items-center gap-1 rounded-full border border-[#E8C2B7] bg-[#F7E3DB] px-2 py-0.5 text-[11px] font-semibold text-[#B04A2E] hover:bg-[#F4D2C2] dark:border-[#5b3328] dark:bg-[#3B1F14] dark:text-[#EFD2C8] disabled:opacity-40"
                                title="Anular subcuenta — requiere PIN"
                                aria-label="Anular subcuenta"
                            >
                                <Ban className="h-3 w-3" />
                                Anular
                            </button>
                        </>
                    )}
                    {sub.status === 'VOID' && (
                        <span className="rounded-full border border-[#E8C2B7] bg-[#F7E3DB] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#B04A2E] dark:border-[#5b3328] dark:bg-[#3B1F14] dark:text-[#EFD2C8]">
                            ANULADA
                        </span>
                    )}
                </div>
            </div>

            {/* Items */}
            <div className="space-y-1 px-3 py-2">
                {sub.items.length === 0 ? (
                    <div className="py-1 text-center text-[11px] text-capsula-ink-muted">Sin ítems asignados</div>
                ) : (
                    sub.items.map((si) => (
                        <div key={si.id} className="flex items-center justify-between text-[11px]">
                            <span className="flex-1 truncate text-capsula-ink-soft">
                                {si.quantity}× {si.salesOrderItem.itemName}
                                {si.salesOrderItem.modifiers.length > 0 && (
                                    <span className="ml-1 text-capsula-ink-muted">
                                        ({si.salesOrderItem.modifiers.map((m) => m.name).join(', ')})
                                    </span>
                                )}
                            </span>
                            <span className="ml-2 font-medium tabular-nums text-capsula-ink">${si.lineTotal.toFixed(2)}</span>
                            {!isPaid && (
                                <button
                                    disabled={isProcessing}
                                    onClick={() => onUnassign(si.salesOrderItem.id, sub.id)}
                                    className="ml-1.5 rounded-full p-0.5 text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral disabled:opacity-40"
                                    aria-label="Desasignar ítem"
                                >
                                    <XIcon className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Totals */}
            <div className="space-y-0.5 border-t border-capsula-line px-3 py-2 text-[11px] tabular-nums">
                <div className="flex justify-between text-capsula-ink-muted">
                    <span>Subtotal</span>
                    <span>${sub.subtotal.toFixed(2)}</span>
                </div>
                {sub.serviceCharge > 0 && (
                    <div className="flex justify-between text-[#946A1C]">
                        <span>+10% servicio</span>
                        <span>${sub.serviceCharge.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between border-t border-capsula-line pt-1 font-medium text-capsula-ink">
                    <span>Total</span>
                    <span className="font-semibold tracking-[-0.01em] text-capsula-ink">${sub.total.toFixed(2)}</span>
                </div>
            </div>

            {/* Pay form — solo visible si canCharge=true (cajero/manager). El
                mesero ve la subcuenta pero no puede cobrar. */}
            {!isPaid && canCharge && (
                <div className="px-3 pb-3">
                    {!showPayForm ? (
                        <button
                            disabled={isProcessing || sub.items.length === 0}
                            onClick={() => { setShowPayForm(true); setAmountInput(totalWithService.toFixed(2)); }}
                            className="pos-btn w-full !min-h-0 py-2.5 text-xs disabled:opacity-40"
                        >
                            <CreditCard className="h-3.5 w-3.5" />
                            Cobrar {sub.label}
                        </button>
                    ) : (
                        <div className="space-y-2 border-t border-capsula-line pt-2">
                            {/* Aviso 33% descuento por divisas (cash USD/EUR/Zelle) */}
                            {applyDivisasDiscount && (
                                <div className="rounded-lg bg-[#E5EDE7] dark:bg-[#1E3B2C] px-2 py-1.5 text-[11px] font-medium text-[#2F6B4E] dark:text-[#6FB88F]">
                                    <span className="font-semibold">−33% Pago en Divisas:</span>{' '}
                                    <span className="tabular-nums">−${discountAmount.toFixed(2)}</span>{' '}
                                    <span className="opacity-80">(automático por método de pago)</span>
                                </div>
                            )}
                            {/* Service fee toggle */}
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={serviceIncluded}
                                    onChange={(e) => setServiceIncluded(e.target.checked)}
                                    className="rounded border-capsula-line accent-capsula-navy-deep"
                                />
                                <span className="text-[11px] text-capsula-ink-soft">+10% servicio</span>
                                <span className="text-[11px] font-medium tabular-nums text-capsula-ink">
                                    Total: ${totalWithService.toFixed(2)}
                                </span>
                            </label>
                            {/* Method */}
                            <div className="grid grid-cols-3 gap-1">
                                {PAY_METHODS.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => { setPayMethod(m.id); setPayMethodTouched(true); }}
                                        className={`inline-flex items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                                            payMethodTouched && payMethod === m.id
                                                ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                                : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep'
                                        }`}
                                    >
                                        <m.Icon className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                            {/* Amount */}
                            <input
                                type="number" min="0" step="0.01"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm font-medium tabular-nums text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                placeholder={`$${totalWithService.toFixed(2)}`}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowPayForm(false)}
                                    className="flex-1 rounded-xl border border-capsula-line bg-capsula-ivory-surface py-2 text-xs font-medium text-capsula-ink-soft transition-colors hover:border-capsula-navy-deep"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isProcessing || !payMethodTouched}
                                    onClick={handlePayConfirm}
                                    className="pos-btn flex-[2] !min-h-0 py-2 text-xs disabled:opacity-40"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {payMethodTouched ? 'Confirmar' : 'Elige método'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function SubAccountPanel({ openTabId, exchangeRate, onClose, onTabUpdated, tabCode, customerLabel, tableLabel, cashierName, canCharge = true }: SubAccountPanelProps) {
    const [tab, setTab] = useState<TabWithSubs | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const branding = useTenantBranding();
    // Descuento por divisas configurable (§87). Del server; default 1/3.
    const [divisasPercent, setDivisasPercent] = useState<number>(100 / 3);
    const divisasRate = divisasPercent / 100;
    const divisasPctLabel = (Math.round(divisasPercent * 100) / 100).toString();
    useEffect(() => {
        getDivisasDiscountPercentAction().then(setDivisasPercent).catch(() => {});
    }, []);

    // New subcuenta form
    const [newLabel, setNewLabel] = useState('');

    // ── Anulación de subcuenta (requiere PIN de gerente) ─────────────────────
    const [voidTarget, setVoidTarget] = useState<SubAccount | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voidPin, setVoidPin] = useState('');
    const [voidPinError, setVoidPinError] = useState('');
    const [voidStep, setVoidStep] = useState<'reason' | 'pin'>('reason');
    const [voidLoading, setVoidLoading] = useState(false);

    function openVoidModal(sub: SubAccount) {
        setVoidTarget(sub);
        setVoidReason('');
        setVoidPin('');
        setVoidPinError('');
        setVoidStep('reason');
    }

    function closeVoidModal() {
        setVoidTarget(null);
        setVoidReason('');
        setVoidPin('');
        setVoidPinError('');
        setVoidStep('reason');
    }

    async function confirmVoid() {
        if (!voidTarget) return;
        setVoidLoading(true);
        const pinRes = await validateManagerPinAction(voidPin);
        if (!pinRes.success) {
            setVoidPinError(pinRes.message || 'PIN incorrecto');
            setVoidLoading(false);
            return;
        }
        const managerName = (pinRes.data as { managerName?: string })?.managerName ?? 'Gerente';
        const managerId = (pinRes.data as { managerId?: string })?.managerId ?? 'manager-pin';
        const res = await voidSubAccountAction({
            subAccountId: voidTarget.id,
            voidReason: voidReason.trim(),
            authorizedById: managerId,
            authorizedByName: managerName,
        });
        if (res.success) {
            toast.success(res.message);
            if (res.data) {
                setTab(res.data as TabWithSubs);
                onTabUpdatedRef.current(res.data);
            } else {
                await loadTab();
            }
            closeVoidModal();
        } else {
            toast.error(res.message);
            setVoidPinError(res.message);
        }
        setVoidLoading(false);
    }

    // ── Stable ref for onTabUpdated — prevents infinite loop from unstable parent fn ──
    // onTabUpdated changes identity on every parent render; putting it in a ref means
    // loadTab's useCallback deps only contains openTabId, breaking the re-render cycle.
    const onTabUpdatedRef = useRef(onTabUpdated);
    useEffect(() => { onTabUpdatedRef.current = onTabUpdated; }, [onTabUpdated]);

    // ── Helpers ───────────────────────────────────────────────────────────────

    const loadTab = useCallback(async () => {
        const res = await getOpenTabWithSubAccountsAction(openTabId);
        if (res.success && res.data) {
            setTab(res.data as TabWithSubs);
            onTabUpdatedRef.current(res.data);
        } else {
            toast.error('Error cargando subcuentas');
        }
    }, [openTabId]); // ← onTabUpdated intentionally omitted — accessed via ref

    useEffect(() => { setIsLoading(true); loadTab().finally(() => setIsLoading(false)); }, [loadTab]);

    // ── Pool items: items with remaining qty not fully assigned ───────────────

    const allItems: SubSalesOrderItem[] = tab?.orders.flatMap((o) => o.items) ?? [];

    const poolItems = allItems.filter((item) => totalAssignedQty(item) < item.quantity);

    // ── Handlers ──────────────────────────────────────────────────────────────

    async function handleAutoSplit(count: number) {
        setIsProcessing(true);
        const res = await autoSplitEqualAction({ openTabId, count });
        if (res.success) { toast.success(res.message); await loadTab(); }
        else toast.error(res.message);
        setIsProcessing(false);
    }

    async function handleCreateSub() {
        if (!newLabel.trim() && !tab) return;
        const label = newLabel.trim() || `Cuenta ${(tab?.subAccounts.length ?? 0) + 1}`;
        setIsProcessing(true);
        const res = await createSubAccountsAction({ openTabId, labels: [label] });
        if (res.success) { setNewLabel(''); toast.success('Subcuenta creada'); await loadTab(); }
        else toast.error(res.message);
        setIsProcessing(false);
    }

    async function handleRename(subId: string, label: string) {
        const res = await renameSubAccountAction(subId, label);
        if (res.success) await loadTab();
        else toast.error(res.message);
    }

    async function handleDelete(subId: string) {
        setIsProcessing(true);
        const res = await deleteSubAccountAction(subId);
        if (res.success) { toast.success(res.message); await loadTab(); }
        else toast.error(res.message);
        setIsProcessing(false);
    }

    async function handleAssign(itemId: string, subId: string, qty: number) {
        setIsProcessing(true);
        const res = await assignItemToSubAccountAction({ salesOrderItemId: itemId, subAccountId: subId, quantity: qty });
        if (res.success) { toast.success(res.message); await loadTab(); }
        else toast.error(res.message);
        setIsProcessing(false);
    }

    async function handleUnassign(itemId: string, subId: string) {
        setIsProcessing(true);
        const res = await unassignItemFromSubAccountAction({ salesOrderItemId: itemId, subAccountId: subId });
        if (res.success) { toast.success(res.message); await loadTab(); }
        else toast.error(res.message);
        setIsProcessing(false);
    }

    async function handlePay(subId: string, method: POSPaymentMethod, amount: number, serviceIncluded: boolean, discountType: 'NONE' | 'DIVISAS_33') {
        setIsProcessing(true);
        const res = await paySubAccountAction({
            subAccountId: subId,
            paymentMethod: method,
            amount,
            serviceFeeIncluded: serviceIncluded,
            discountType,
        });
        if (res.success) {
            toast.success(res.message);
            // Use the updated tab returned by the action — avoids an extra round-trip
            // and prevents triggering the loadTab → onTabUpdated cycle an extra time.
            const updatedTab = (res.data as TabWithSubs | undefined);
            if (updatedTab) {
                setTab(updatedTab);
                onTabUpdatedRef.current(updatedTab);
                // Auto-impresión del recibo individual de la subcuenta tras el cobro.
                // Pasamos paidWithDivisas explícitamente — el método ya pasó por
                // los safeguards de paySubAccountAction. Esto garantiza que el
                // recibo refleje exactamente lo cobrado, no inferido.
                const paidSub = updatedTab.subAccounts.find(s => s.id === subId);
                const paidWithDivisas = discountType === 'DIVISAS_33';
                if (paidSub) handlePrintSubAccount(paidSub, serviceIncluded, paidWithDivisas);
            } else {
                await loadTab(); // fallback if action didn't return data
            }
        } else {
            toast.error(res.message);
        }
        setIsProcessing(false);
    }

    /**
     * Imprime un recibo térmico individual para una subcuenta. Cumple
     * el requisito: "que esta genere un recibo de pago individual para
     * cada subcuenta y no una sola global". Se invoca automáticamente
     * tras un cobro exitoso, y manualmente desde el botón "Imprimir"
     * en cada subcuenta.
     *
     * @param sub             La subcuenta a imprimir.
     * @param includeService  Si incluir el 10% de servicio.
     * @param paidWithDivisas Cuando se llama tras un cobro exitoso, indica
     *                       si el método fue divisas (CASH_USD/EUR/Zelle).
     *                       Si la subcuenta ya está PAID y no se pasa,
     *                       se infiere desde sub.paymentMethod.
     */
    function handlePrintSubAccount(sub: SubAccount, includeService: boolean = true, paidWithDivisas?: boolean) {
        const items = sub.items.map(it => ({
            name: it.salesOrderItem.itemName,
            quantity: it.quantity,
            unitPrice: it.salesOrderItem.unitPrice,
            total: it.lineTotal,
            modifiers: (it.salesOrderItem.modifiers ?? [])
                .filter(m => typeof m === 'string' || !(m as { hideFromKitchen?: boolean })?.hideFromKitchen)
                .map(m => typeof m === 'string' ? m : m?.name ?? '')
                .filter(Boolean),
        }));
        // Determinar si se aplicó descuento del 33% por divisas.
        // - Tras cobro: usar el flag explícito paidWithDivisas (autoritativo).
        // - Reimpresión manual de PAGADA: inferir desde sub.paymentMethod.
        // - Pre-cuenta (sub.status='OPEN'): NO aplicar descuento (todavía no
        //   hay método de pago confirmado, mostrar precio normal).
        const inferredDivisas = sub.status === 'PAID' && (
            sub.paymentMethod === 'CASH' ||
            sub.paymentMethod === 'CASH_USD' ||
            sub.paymentMethod === 'CASH_EUR' ||
            sub.paymentMethod === 'ZELLE'
        );
        const applyDivisasDiscount = paidWithDivisas ?? inferredDivisas;
        const discountAmount = applyDivisasDiscount ? sub.subtotal * divisasRate : 0;
        const subtotalAfterDiscount = sub.subtotal - discountAmount;
        const serviceFee = includeService ? subtotalAfterDiscount * 0.1 : 0;
        const subAccountLabel = sub.label || `Subcuenta ${sub.sortOrder + 1}`;
        printReceipt({
            orderNumber: tabCode ? `${tabCode} · ${subAccountLabel}` : subAccountLabel,
            orderType: 'RESTAURANT',
            date: new Date(),
            cashierName: cashierName || 'Cajera',
            customerName: customerLabel,
            tableLabel,
            items,
            subtotal: sub.subtotal,
            discount: discountAmount > 0 ? discountAmount : undefined,
            discountReason: applyDivisasDiscount ? `Pago en Divisas (${divisasPctLabel}%)` : undefined,
            hideDiscount: applyDivisasDiscount,
            total: subtotalAfterDiscount,
            serviceFee: serviceFee > 0.001 ? serviceFee : undefined,
            isPrecuenta: sub.status !== 'PAID',
            branding,
        });
    }

    // ── Render ────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center text-sm text-capsula-ink-muted">
                Cargando subcuentas…
            </div>
        );
    }

    if (!tab) return null;

    const openSubs = tab.subAccounts.filter((s) => s.status === 'OPEN');
    const paidSubs = tab.subAccounts.filter((s) => s.status === 'PAID');

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="shrink-0 space-y-2 border-b border-capsula-line bg-capsula-ivory-alt px-3 py-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-capsula-ink">
                            <SplitSquareHorizontal className="h-4 w-4 text-capsula-ink-muted" />
                            Subcuentas
                        </span>
                        <span className="rounded-full border border-capsula-navy/10 bg-capsula-navy-soft px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-capsula-ink">
                            {tab.subAccounts.length}/25
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-surface hover:text-capsula-ink"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Volver
                    </button>
                </div>

                {/* Quick split */}
                <div className="space-y-1">
                    <div className="pos-label">División rápida</div>
                    <div className="flex gap-1">
                        {[2, 3, 4, 5, 6].map((n) => (
                            <button
                                key={n}
                                disabled={isProcessing}
                                onClick={() => handleAutoSplit(n)}
                                className="flex-1 rounded-xl border border-capsula-line bg-capsula-ivory-surface py-2 text-xs font-medium tabular-nums text-capsula-ink transition-colors hover:border-capsula-navy-deep hover:bg-capsula-navy-soft hover:text-capsula-ink disabled:opacity-40"
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* New subcuenta */}
                <div className="flex gap-1.5">
                    <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSub()}
                        placeholder={`Cuenta ${tab.subAccounts.length + 1}`}
                        className="flex-1 rounded-xl border border-capsula-line bg-capsula-ivory px-3 py-2 text-xs text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                    />
                    <button
                        disabled={isProcessing || tab.subAccounts.length >= 25}
                        onClick={handleCreateSub}
                        className="pos-btn !min-h-0 px-3 py-2 text-xs disabled:opacity-40"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Nueva
                    </button>
                </div>
            </div>

            {/* ── Content ─────────────────────────────────────────────────── */}
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {/* Open subcuentas */}
                {openSubs.length === 0 && paidSubs.length === 0 && (
                    <div className="py-6 text-center text-xs text-capsula-ink-muted">
                        Crea subcuentas o usa División rápida
                    </div>
                )}

                {tab.subAccounts.map((sub) => (
                    <SubAccountCard
                        key={sub.id}
                        sub={sub}
                        isProcessing={isProcessing}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        onPay={handlePay}
                        onUnassign={handleUnassign}
                        onPrint={handlePrintSubAccount}
                        onVoid={openVoidModal}
                        canCharge={canCharge}
                        divisasRate={divisasRate}
                    />
                ))}

                {/* Pool — items not fully assigned */}
                {poolItems.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-capsula-line" />
                            <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                Pool sin asignar ({poolItems.length})
                            </span>
                            <div className="h-px flex-1 bg-capsula-line" />
                        </div>
                        {poolItems.map((item) => (
                            <PoolItemRow
                                key={item.id}
                                item={item}
                                subAccounts={tab.subAccounts}
                                isProcessing={isProcessing}
                                onAssign={handleAssign}
                                onUnassign={handleUnassign}
                            />
                        ))}
                        <div className="text-center text-[11px] text-capsula-ink-muted">
                            Los ítems del pool se cobran con el botón principal de la mesa
                        </div>
                    </div>
                )}

                {/* Summary row */}
                {tab.subAccounts.length > 0 && (
                    <div className="space-y-0.5 rounded-xl border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-[11px] tabular-nums">
                        <div className="flex justify-between text-capsula-ink-muted">
                            <span>Subcuentas cobradas</span>
                            <span>{paidSubs.length} / {tab.subAccounts.length}</span>
                        </div>
                        <div className="flex justify-between font-medium text-capsula-ink">
                            <span>Saldo restante mesa</span>
                            <span className="font-semibold tracking-[-0.01em] text-capsula-ink">${tab.balanceDue.toFixed(2)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MODAL: Anular subcuenta ────────────────────────────────────── */}
            {voidTarget && (
                <div className="fixed inset-0 z-[70] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                        <div className="border-b border-capsula-line p-5 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                                    Anular subcuenta
                                </h3>
                                <p className="mt-0.5 text-xs text-capsula-ink-muted">
                                    {voidTarget.label} · ${voidTarget.subtotal.toFixed(2)}
                                    {voidTarget.status === 'PAID' && ' · ya cobrada'}
                                </p>
                            </div>
                            <button
                                onClick={closeVoidModal}
                                disabled={voidLoading}
                                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center disabled:opacity-40"
                                aria-label="Cerrar"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {voidStep === 'reason' ? (
                                <>
                                    {voidTarget.status === 'PAID' && (
                                        <div className="rounded-lg bg-[#F7E3DB] dark:bg-[#3B1F14] border border-[#E8C2B7] dark:border-[#5b3328] p-3 text-xs text-[#B04A2E] dark:text-[#EFD2C8]">
                                            ⚠️ Esta subcuenta ya fue cobrada. Anular restaurará el
                                            saldo a la mesa, marcará el pago como VOID en auditoría
                                            y reabrirá la cuenta si estaba cerrada.
                                        </div>
                                    )}
                                    <label className="block">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                            Motivo de anulación
                                        </span>
                                        <textarea
                                            autoFocus
                                            value={voidReason}
                                            onChange={(e) => setVoidReason(e.target.value)}
                                            placeholder="Ej. error de cobro, cliente rechaza el ítem, doble facturación…"
                                            rows={3}
                                            className="pos-input mt-1.5 w-full resize-none text-sm"
                                        />
                                    </label>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-capsula-ink-soft">
                                        Ingresa el PIN de un gerente autorizado para confirmar la anulación.
                                    </p>
                                    <label className="block">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                            <Lock className="inline-block h-3 w-3 mr-1" />
                                            PIN de gerente
                                        </span>
                                        <input
                                            autoFocus
                                            type="password"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={voidPin}
                                            onChange={(e) => { setVoidPin(e.target.value); setVoidPinError(''); }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && voidPin.length >= 4) confirmVoid();
                                            }}
                                            className="pos-input mt-1.5 w-full text-center text-2xl tabular-nums tracking-widest"
                                            placeholder="••••"
                                        />
                                    </label>
                                    {voidPinError && (
                                        <p className="text-xs text-capsula-coral font-semibold">{voidPinError}</p>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="border-t border-capsula-line p-4 flex gap-3">
                            <button
                                onClick={closeVoidModal}
                                disabled={voidLoading}
                                className="pos-btn-secondary flex-1 py-3 disabled:opacity-40"
                            >
                                Cancelar
                            </button>
                            {voidStep === 'reason' ? (
                                <button
                                    onClick={() => {
                                        if (!voidReason.trim()) {
                                            toast.error('Indica el motivo');
                                            return;
                                        }
                                        setVoidStep('pin');
                                    }}
                                    disabled={!voidReason.trim()}
                                    className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40"
                                >
                                    Continuar
                                    <Lock className="h-3.5 w-3.5" />
                                </button>
                            ) : (
                                <button
                                    onClick={confirmVoid}
                                    disabled={voidLoading || voidPin.length < 4}
                                    className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40"
                                    style={{ background: '#B04A2E' }}
                                >
                                    <Ban className="h-4 w-4" />
                                    {voidLoading ? 'Anulando…' : 'Confirmar anulación'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
