'use client';

/**
 * SubAccountPanel — Panel de división de cuenta por subcuentas (POS Restaurante / Mesero).
 * Renderiza la lista de subcuentas, el pool de ítems sin asignar,
 * la UI de asignación y el cobro individual por subcuenta.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { DollarSign, Zap, CreditCard, Smartphone, Banknote, X as XIcon, CheckCircle2, Trash2, Pencil, Check, SplitSquareHorizontal, ArrowLeft, Plus } from 'lucide-react';
import {
    assignItemToSubAccountAction,
    autoSplitEqualAction,
    createSubAccountsAction,
    deleteSubAccountAction,
    getOpenTabWithSubAccountsAction,
    paySubAccountAction,
    renameSubAccountAction,
    unassignItemFromSubAccountAction,
    type POSPaymentMethod,
} from '@/app/actions/pos.actions';

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
}

// ─── Payment method labels ────────────────────────────────────────────────────

type PayMethodDef = {
    id: POSPaymentMethod;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
};

const PAY_METHODS: PayMethodDef[] = [
    { id: 'CASH_USD',       label: 'Cash $',       Icon: DollarSign },
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
                                        ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
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
    onPay: (subId: string, method: POSPaymentMethod, amount: number, serviceIncluded: boolean) => void;
    onUnassign: (itemId: string, subId: string) => void;
}

function SubAccountCard({ sub, isProcessing, onRename, onDelete, onPay, onUnassign }: SubAccountCardProps) {
    const [editing, setEditing] = useState(false);
    const [labelInput, setLabelInput] = useState(sub.label);
    const [showPayForm, setShowPayForm] = useState(false);
    const [payMethod, setPayMethod] = useState<POSPaymentMethod>('CASH_USD');
    const [serviceIncluded, setServiceIncluded] = useState(true);
    const [amountInput, setAmountInput] = useState('');

    const isPaid = sub.status === 'PAID';
    const totalWithService = sub.subtotal + (serviceIncluded ? sub.serviceCharge : 0);

    function handleRename() {
        if (labelInput.trim()) { onRename(sub.id, labelInput.trim()); }
        setEditing(false);
    }

    function handlePayConfirm() {
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) { toast.error('Monto inválido'); return; }
        onPay(sub.id, payMethod, amt, serviceIncluded);
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
                {!isPaid && (
                    <button
                        disabled={isProcessing}
                        onClick={() => onDelete(sub.id)}
                        className="ml-2 rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral disabled:opacity-40"
                        title="Eliminar subcuenta"
                        aria-label="Eliminar subcuenta"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}
                {isPaid && (
                    <span className="rounded-full border border-[#D3E2D8] bg-[#E5EDE7] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#2F6B4E]">
                        PAGADA ${sub.paidAmount.toFixed(2)}
                    </span>
                )}
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
                    <span className="font-heading tracking-[-0.01em] text-capsula-ink">${sub.total.toFixed(2)}</span>
                </div>
            </div>

            {/* Pay form */}
            {!isPaid && (
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
                            {/* Service fee toggle */}
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={serviceIncluded}
                                    onChange={(e) => {
                                        setServiceIncluded(e.target.checked);
                                        setAmountInput((sub.subtotal + (e.target.checked ? sub.serviceCharge : 0)).toFixed(2));
                                    }}
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
                                        onClick={() => setPayMethod(m.id)}
                                        className={`inline-flex items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                                            payMethod === m.id
                                                ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
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
                                    disabled={isProcessing}
                                    onClick={handlePayConfirm}
                                    className="pos-btn flex-[2] !min-h-0 py-2 text-xs disabled:opacity-40"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Confirmar
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

export function SubAccountPanel({ openTabId, exchangeRate, onClose, onTabUpdated }: SubAccountPanelProps) {
    const [tab, setTab] = useState<TabWithSubs | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // New subcuenta form
    const [newLabel, setNewLabel] = useState('');

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

    async function handlePay(subId: string, method: POSPaymentMethod, amount: number, serviceIncluded: boolean) {
        setIsProcessing(true);
        const res = await paySubAccountAction({
            subAccountId: subId,
            paymentMethod: method,
            amount,
            serviceFeeIncluded: serviceIncluded,
        });
        if (res.success) {
            toast.success(res.message);
            // Use the updated tab returned by the action — avoids an extra round-trip
            // and prevents triggering the loadTab → onTabUpdated cycle an extra time.
            if (res.data) {
                setTab(res.data as TabWithSubs);
                onTabUpdatedRef.current(res.data);
            } else {
                await loadTab(); // fallback if action didn't return data
            }
        } else {
            toast.error(res.message);
        }
        setIsProcessing(false);
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
                            <span className="font-heading tracking-[-0.01em] text-capsula-ink">${tab.balanceDue.toFixed(2)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
