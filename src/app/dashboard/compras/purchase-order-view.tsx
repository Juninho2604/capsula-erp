'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    ClipboardList,
    Sparkles,
    Plus,
    MessageCircle,
    Settings,
    Inbox,
    Pencil,
    Send,
    Package,
    Check,
    Ban,
    Bell,
    Loader2,
    Save,
    TrendingUp,
    X as XIcon,
    type LucideIcon,
} from 'lucide-react';
import { formatNumber, cn } from '@/lib/utils';
import {
    getLowStockItemsAction, getAllItemsForPurchaseAction, getAllItemsWithStockConfigAction,
    createPurchaseOrderAction, getPurchaseOrdersAction, getSuppliersAction, getAreasForReceivingAction,
    sendPurchaseOrderAction, cancelPurchaseOrderAction, exportPurchaseOrderTextAction,
    receivePurchaseOrderItemsAction, updateStockLevelsAction, createReorderBroadcastsAction,
    LowStockItem, StockConfigItem
} from '@/app/actions/purchase.actions';
import WhatsAppPurchaseOrderParser from '@/components/whatsapp-purchase-order-parser';

type ViewMode = 'orders' | 'create' | 'auto' | 'config' | 'receive' | 'whatsapp';

interface OrderItem {
    rowId: string; // ID único por fila (permite duplicados del mismo producto)
    inventoryItemId: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
}

function genRowId() {
    return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function PurchaseOrderView() {
    const [viewMode, setViewMode] = useState<ViewMode>('orders');
    const [orders, setOrders] = useState<any[]>([]);
    const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
    const [allItems, setAllItems] = useState<any[]>([]);
    const [configItems, setConfigItems] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [orderName, setOrderName] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Receive state
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [selectedAreaId, setSelectedAreaId] = useState('');
    const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});

    // Config state
    const [configEdits, setConfigEdits] = useState<Record<string, { min: number; reorder: number }>>({});
    const [configFilter, setConfigFilter] = useState('');

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setIsLoading(true);
        const [ordersData, suppliersData, areasData] = await Promise.all([
            getPurchaseOrdersAction(), getSuppliersAction(), getAreasForReceivingAction()
        ]);
        setOrders(ordersData);
        setSuppliers(suppliersData);
        setAreas(areasData);
        if (areasData.length > 0) setSelectedAreaId(areasData[0].id);
        setIsLoading(false);
    }

    useEffect(() => {
        if (viewMode === 'auto') getLowStockItemsAction().then(setLowStockItems);
        else if (viewMode === 'create') getAllItemsForPurchaseAction().then(setAllItems);
        else if (viewMode === 'config') {
            getAllItemsWithStockConfigAction().then(items => {
                setConfigItems(items);
                const edits: Record<string, { min: number; reorder: number }> = {};
                items.forEach((i: any) => { edits[i.id] = { min: i.minimumStock, reorder: i.reorderPoint }; });
                setConfigEdits(edits);
            });
        }
    }, [viewMode]);

    function addFromSuggestion(item: LowStockItem) {
        if (orderItems.some(oi => oi.inventoryItemId === item.id)) return;
        setOrderItems([...orderItems, { rowId: genRowId(), inventoryItemId: item.id, name: item.name, category: item.category || 'Sin Categoría', quantity: item.suggestedQuantity, unit: item.baseUnit, unitPrice: 0 }]);
    }

    function addAllSuggestions() {
        const newItems = lowStockItems.filter(item => !orderItems.some(oi => oi.inventoryItemId === item.id))
            .map(item => ({ rowId: genRowId(), inventoryItemId: item.id, name: item.name, category: item.category || 'Sin Categoría', quantity: item.suggestedQuantity, unit: item.baseUnit, unitPrice: 0 }));
        setOrderItems([...orderItems, ...newItems]);
    }

    function addManualItem(item: any) {
        if (orderItems.some(oi => oi.inventoryItemId === item.id)) return;
        setOrderItems([...orderItems, { rowId: genRowId(), inventoryItemId: item.id, name: item.name, category: item.category || 'Sin Categoría', quantity: 1, unit: item.baseUnit, unitPrice: 0 }]);
        setSearchQuery('');
    }

    function handleWhatsAppOrderReady(items: { inventoryItemId: string; name: string; category: string; quantity: number; unit: string }[], supplierName?: string, extractedNotes?: string) {
        const newOrderItems: OrderItem[] = items.map(i => ({
            rowId: genRowId(),
            inventoryItemId: i.inventoryItemId,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: 0,
        }));
        setOrderItems(newOrderItems);
        let finalNotes = extractedNotes || '';
        if (supplierName) {
            const matched = suppliers.find(s => s.name.toLowerCase().includes(supplierName.toLowerCase()) || supplierName.toLowerCase().includes(s.name.toLowerCase()));
            setSelectedSupplier(matched?.id || '');
            if (!matched) finalNotes = (finalNotes ? `Proveedor: ${supplierName}\n` : `Proveedor: ${supplierName}`) + finalNotes;
        }
        setNotes(finalNotes);
        setViewMode('create');
    }

    function updateItemQuantity(rowId: string, quantity: number) {
        setOrderItems(prev => prev.map(item => item.rowId === rowId ? { ...item, quantity } : item));
    }

    function removeItem(rowId: string) {
        setOrderItems(prev => prev.filter(item => item.rowId !== rowId));
    }

    async function handleCreateOrder() {
        if (orderItems.length === 0) return;
        setIsSubmitting(true);
        const result = await createPurchaseOrderAction({
            orderName: orderName?.trim() || undefined,
            supplierId: selectedSupplier || undefined, expectedDate: expectedDate ? new Date(expectedDate) : undefined,
            notes: notes || undefined, items: orderItems.map(item => ({ inventoryItemId: item.inventoryItemId, quantityOrdered: item.quantity, unit: item.unit, unitPrice: item.unitPrice }))
        });
        if (result.success) {
            toast.success(result.message);
            setOrderItems([]); setOrderName(''); setSelectedSupplier(''); setExpectedDate(''); setNotes('');
            setViewMode('orders'); loadData();
        } else {
            toast.error(result.message);
        }
        setIsSubmitting(false);
    }

    async function handleSendOrder(orderId: string) {
        const r = await sendPurchaseOrderAction(orderId);
        if (r.success) { loadData(); toast.success(r.message); } else { toast.error(r.message); }
    }
    async function handleCancelOrder(orderId: string) {
        if (!confirm('¿Cancelar esta orden?')) return;
        const r = await cancelPurchaseOrderAction(orderId);
        if (r.success) { loadData(); toast.success(r.message); } else { toast.error(r.message); }
    }
    async function handleExportWhatsApp(orderId: string) {
        const text = await exportPurchaseOrderTextAction(orderId);
        if (text) {
            navigator.clipboard.writeText(text);
            toast.success('Orden copiada al portapapeles');
        }
    }

    async function handleReceiveItems() {
        if (!selectedOrderId || !selectedAreaId) return;
        const items = Object.entries(receiveQuantities).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ purchaseOrderItemId: id, quantityReceived: qty }));
        if (items.length === 0) { toast.error('Ingresa cantidades a recibir'); return; }
        setIsSubmitting(true);
        const r = await receivePurchaseOrderItemsAction(selectedOrderId, items, selectedAreaId);
        if (r.success) {
            toast.success(r.message);
            setReceiveQuantities({}); setSelectedOrderId(''); loadData(); setViewMode('orders');
        } else {
            toast.error(r.message);
        }
        setIsSubmitting(false);
    }

    async function handleCreateReorderAlerts() {
        setIsSubmitting(true);
        const r = await createReorderBroadcastsAction();
        if (r.created > 0) toast.success(`${r.created} alerta(s) de reorden enviadas a la campana`);
        else if (r.skipped > 0) toast(`Todas las alertas ya existen (${r.skipped} en curso). Revisa la campana`);
        else toast('No hay items bajo punto de reorden en este momento');
        setIsSubmitting(false);
    }

    async function handleSaveConfig() {
        const items: StockConfigItem[] = Object.entries(configEdits).map(([id, vals]) => ({ id, minimumStock: vals.min, reorderPoint: vals.reorder }));
        setIsSubmitting(true);
        const r = await updateStockLevelsAction(items);
        if (r.success) toast.success(r.message); else toast.error(r.message);
        setIsSubmitting(false);
    }

    const filteredItems = allItems.filter(item => searchQuery && (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku.toLowerCase().includes(searchQuery.toLowerCase()))).slice(0, 10);

    // Group order items by category
    const orderItemsByCategory = useMemo(() => {
        const groups: Record<string, OrderItem[]> = {};
        orderItems.forEach(item => { const cat = item.category || 'Sin Categoría'; if (!groups[cat]) groups[cat] = []; groups[cat].push(item); });
        return groups;
    }, [orderItems]);

    const selectedOrder = orders.find(o => o.id === selectedOrderId);

    // Group selected order items by category
    const selectedOrderItemsByCategory = useMemo(() => {
        if (!selectedOrder) return {};
        const groups: Record<string, any[]> = {};
        selectedOrder.items.forEach((item: any) => { const cat = item.category || 'Sin Categoría'; if (!groups[cat]) groups[cat] = []; groups[cat].push(item); });
        return groups;
    }, [selectedOrder]);

    const filteredConfigItems = configItems.filter(i => !configFilter || i.name.toLowerCase().includes(configFilter.toLowerCase()) || i.category.toLowerCase().includes(configFilter.toLowerCase()));

    const configByCategory = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filteredConfigItems.forEach(i => { if (!groups[i.category]) groups[i.category] = []; groups[i.category].push(i); });
        return groups;
    }, [filteredConfigItems]);

    const getStatusBadge = (status: string) => {
        const meta: Record<string, { tone: string; Icon: LucideIcon; label: string }> = {
            DRAFT: { tone: 'bg-capsula-ivory-alt text-capsula-ink-soft', Icon: Pencil, label: 'Borrador' },
            SENT: { tone: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]', Icon: Send, label: 'Enviada' },
            PARTIAL: { tone: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]', Icon: Package, label: 'Parcial' },
            RECEIVED: { tone: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]', Icon: Check, label: 'Recibida' },
            CANCELLED: { tone: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]', Icon: Ban, label: 'Cancelada' },
        };
        const m = meta[status] || meta.DRAFT;
        const Icon = m.Icon;
        return (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', m.tone)}>
                <Icon className="h-3 w-3" /> {m.label}
            </span>
        );
    };

    const lowStockByCategory = useMemo(() => {
        const groups: Record<string, LowStockItem[]> = {};
        lowStockItems.forEach(i => { const cat = i.category || 'Sin Categoría'; if (!groups[cat]) groups[cat] = []; groups[cat].push(i); });
        return groups;
    }, [lowStockItems]);

    if (isLoading) return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-capsula-ink-muted">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Cargando…</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Módulo de compras</h1>
                    <p className="text-capsula-ink-muted">Gestiona órdenes de compra, stock mínimo y recepción de mercancía</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/dashboard/compras/proveedor"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-xs font-medium text-capsula-ink-soft transition-all hover:bg-capsula-ivory-alt"
                    >
                        <TrendingUp className="h-3.5 w-3.5" /> Histórico de precios
                    </Link>
                    {(['orders', 'auto', 'create', 'whatsapp', 'config', 'receive'] as ViewMode[]).map(mode => {
                        const meta: Record<ViewMode, { Icon: LucideIcon; label: string }> = {
                            orders: { Icon: ClipboardList, label: 'Órdenes' },
                            auto: { Icon: Sparkles, label: 'Auto-Generar' },
                            create: { Icon: Plus, label: 'Manual' },
                            whatsapp: { Icon: MessageCircle, label: 'WhatsApp' },
                            config: { Icon: Settings, label: 'Stock Mín.' },
                            receive: { Icon: Inbox, label: 'Recibir' },
                        };
                        const Icon = meta[mode].Icon;
                        return (
                            <button
                                key={mode}
                                onClick={() => {
                                    setViewMode(mode);
                                    if (mode === 'orders') loadData();
                                    if (mode === 'create' || mode === 'whatsapp') getAllItemsForPurchaseAction().then(setAllItems);
                                }}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
                                    viewMode === mode
                                        ? (mode === 'whatsapp'
                                            ? 'bg-[#2F6B4E] text-capsula-ivory shadow-cap-soft dark:bg-[#1E3B2C]'
                                            : 'bg-capsula-navy-deep text-capsula-ivory shadow-cap-soft')
                                        : 'border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt'
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" /> {meta[mode].label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ===== CONFIG: Stock Mínimo ===== */}
            {viewMode === 'config' && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-capsula-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Configurar Stock Mínimo y Punto de Reorden</h2>
                            <p className="mt-1 text-sm text-capsula-ink-muted">Define las cantidades mínimas para que el sistema detecte productos con stock bajo</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={configFilter}
                                onChange={e => setConfigFilter(e.target.value)}
                                placeholder="Filtrar…"
                                className="pos-input px-3 py-2 text-sm"
                            />
                            <button
                                onClick={handleSaveConfig}
                                disabled={isSubmitting}
                                className="pos-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
                            >
                                {isSubmitting
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                                    : <><Save className="h-4 w-4" /> Guardar Todo</>}
                            </button>
                        </div>
                    </div>
                    <div className="max-h-[65vh] overflow-y-auto">
                        {Object.entries(configByCategory).map(([category, items]) => (
                            <div key={category}>
                                <div className="sticky top-0 border-b border-capsula-line bg-capsula-ivory-alt px-6 py-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{category}</span>
                                </div>
                                {items.map((item: any) => (
                                    <div key={item.id} className="grid grid-cols-[1fr_100px_100px_100px] items-center gap-3 border-b border-capsula-line px-6 py-2.5 hover:bg-capsula-ivory-surface">
                                        <div>
                                            <p className="text-sm font-medium text-capsula-ink">{item.name}</p>
                                            <p className="font-mono text-xs text-capsula-ink-muted">{item.sku} · {item.baseUnit}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Stock</p>
                                            <p className={cn(
                                                'font-mono text-sm font-medium tabular-nums',
                                                item.currentStock <= (configEdits[item.id]?.min || 0)
                                                    ? 'text-capsula-coral'
                                                    : 'text-capsula-ink-soft'
                                            )}>
                                                {formatNumber(item.currentStock)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Mínimo</p>
                                            <input
                                                type="number" min="0" step="0.5"
                                                value={configEdits[item.id]?.min ?? 0}
                                                onChange={e => setConfigEdits({ ...configEdits, [item.id]: { ...configEdits[item.id], min: parseFloat(e.target.value) || 0 } })}
                                                className="pos-input w-full px-2 py-1 text-center text-sm tabular-nums"
                                            />
                                        </div>
                                        <div>
                                            <p className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Reorden</p>
                                            <input
                                                type="number" min="0" step="0.5"
                                                value={configEdits[item.id]?.reorder ?? 0}
                                                onChange={e => setConfigEdits({ ...configEdits, [item.id]: { ...configEdits[item.id], reorder: parseFloat(e.target.value) || 0 } })}
                                                className="pos-input w-full px-2 py-1 text-center text-sm tabular-nums"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {filteredConfigItems.length === 0 && (
                            <div className="p-8 text-center text-capsula-ink-muted">No hay items que configurar</div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== AUTO: Generar Automática ===== */}
            {viewMode === 'auto' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-capsula-line px-6 py-4">
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Items con Stock Bajo</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCreateReorderAlerts}
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8D9B8] bg-[#F3EAD6]/40 px-3 py-1.5 text-xs font-medium text-[#946A1C] transition-colors hover:bg-[#F3EAD6] dark:border-[#5a4a22] dark:bg-[#3B2F15]/40 dark:text-[#E8D9B8] dark:hover:bg-[#3B2F15] disabled:opacity-50"
                                >
                                    <Bell className="h-3.5 w-3.5" /> Enviar alertas
                                </button>
                                <button
                                    onClick={addAllSuggestions}
                                    className="text-sm font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
                                >
                                    Agregar todos →
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {lowStockItems.length === 0 ? (
                                <div className="p-8 text-center text-capsula-ink-muted">
                                    <Check className="mx-auto h-10 w-10 text-[#2F6B4E] dark:text-[#6FB88F]" />
                                    <p className="mt-2 text-capsula-ink">¡No hay items con stock bajo!</p>
                                    <p className="mt-1 text-sm">
                                        ¿Ya configuraste los mínimos? Ve a{' '}
                                        <button onClick={() => setViewMode('config')} className="text-capsula-coral underline hover:text-capsula-coral-hover">Stock Mín.</button>
                                    </p>
                                </div>
                            ) : (
                                Object.entries(lowStockByCategory).map(([cat, items]) => (
                                    <div key={cat}>
                                        <div className="sticky top-0 border-b border-[#E8C2B7] bg-[#F7E3DB]/50 px-6 py-1.5 dark:border-[#5b3328] dark:bg-[#3B1F14]/50">
                                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B04A2E] dark:text-[#EFD2C8]">{cat} ({items.length})</span>
                                        </div>
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className={cn(
                                                    "flex items-center justify-between border-b border-capsula-line px-6 py-2.5 hover:bg-capsula-ivory-surface",
                                                    item.isCritical && 'bg-[#F7E3DB]/30 dark:bg-[#3B1F14]/30'
                                                )}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-capsula-ink">{item.name}</p>
                                                    <p className="text-xs text-capsula-ink-muted">
                                                        Stock: <span className="font-medium text-capsula-coral tabular-nums">{formatNumber(item.currentStock)}</span> / Mín: <span className="tabular-nums">{formatNumber(item.minimumStock)}</span> {item.baseUnit}
                                                    </p>
                                                </div>
                                                <div className="ml-4 flex items-center gap-2">
                                                    <span className="font-mono text-sm tabular-nums text-capsula-ink-soft">+{formatNumber(item.suggestedQuantity)}</span>
                                                    <button
                                                        onClick={() => addFromSuggestion(item)}
                                                        disabled={orderItems.some(oi => oi.inventoryItemId === item.id)}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-capsula-navy-soft px-2.5 py-1 text-xs font-medium text-capsula-ink transition-colors hover:bg-capsula-navy-deep hover:text-capsula-ivory disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {orderItems.some(oi => oi.inventoryItemId === item.id)
                                                            ? <Check className="h-3.5 w-3.5" />
                                                            : 'Agregar'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    {renderOrderForm()}
                </div>
            )}

            {/* ===== WHATSAPP: Cargar orden desde chat ===== */}
            {viewMode === 'whatsapp' && (
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <WhatsAppPurchaseOrderParser onOrderReady={handleWhatsAppOrderReady} />
                    </div>
                    <div className="rounded-xl border border-[#E8D9B8] bg-[#F3EAD6]/40 p-6 dark:border-[#5a4a22] dark:bg-[#3B2F15]/40">
                        <h3 className="mb-2 font-semibold tracking-[-0.01em] text-[#946A1C] dark:text-[#E8D9B8]">Cómo usar</h3>
                        <ol className="list-inside list-decimal space-y-2 text-sm text-[#946A1C]/90 dark:text-[#E8D9B8]/90">
                            <li>Exporta o copia el chat de WhatsApp con tu proveedor</li>
                            <li>Pega el texto en el área de la izquierda</li>
                            <li>Haz clic en &quot;Analizar Orden&quot;</li>
                            <li>Revisa y corrige los items reconocidos</li>
                            <li>Haz clic en &quot;Cargar items a la orden&quot;</li>
                            <li>Completa proveedor, fecha y crea la orden</li>
                        </ol>
                        <p className="mt-4 text-xs text-[#946A1C]/80 dark:text-[#E8D9B8]/80">
                            Formatos soportados: 2 kg Arroz, 5x Aceite, 10 unidades Harina, etc.
                        </p>
                    </div>
                </div>
            )}

            {/* ===== CREATE: Manual ===== */}
            {viewMode === 'create' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                        <div className="border-b border-capsula-line px-6 py-4">
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Buscar Items</h2>
                        </div>
                        <div className="p-6">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Escriba para buscar…"
                                className="pos-input w-full"
                            />
                            {filteredItems.length > 0 && (
                                <div className="mt-3 divide-y divide-capsula-line rounded-lg border border-capsula-line">
                                    {filteredItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-capsula-ivory-surface">
                                            <div>
                                                <p className="font-medium text-capsula-ink">{item.name}</p>
                                                <p className="text-xs text-capsula-ink-muted tabular-nums">
                                                    Stock: {formatNumber(item.currentStock)} {item.baseUnit} · {item.category || 'Sin cat.'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => addManualItem(item)}
                                                disabled={orderItems.some(oi => oi.inventoryItemId === item.id)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-capsula-navy-soft px-3 py-1 text-xs font-medium text-capsula-ink transition-colors hover:bg-capsula-navy-deep hover:text-capsula-ivory disabled:opacity-50"
                                            >
                                                {orderItems.some(oi => oi.inventoryItemId === item.id)
                                                    ? <Check className="h-3.5 w-3.5" />
                                                    : 'Agregar'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {renderOrderForm()}
                </div>
            )}

            {/* ===== RECEIVE: Recibir Mercancía ===== */}
            {viewMode === 'receive' && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                    <div className="border-b border-capsula-line px-6 py-4">
                        <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Recibir Mercancía desde Orden de Compra</h2>
                        <p className="mt-1 text-sm text-capsula-ink-muted">Selecciona una orden activa y registra lo que va llegando de los proveedores</p>
                    </div>
                    <div className="space-y-4 p-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="pos-label">Orden de Compra</label>
                                <select
                                    value={selectedOrderId}
                                    onChange={e => { setSelectedOrderId(e.target.value); setReceiveQuantities({}); }}
                                    className="pos-input mt-1 w-full"
                                >
                                    <option value="">Seleccionar orden…</option>
                                    {orders.filter(o => ['DRAFT', 'SENT', 'PARTIAL'].includes(o.status)).map(o => (
                                        <option key={o.id} value={o.id}>{o.orderNumber}{o.orderName ? ` (${o.orderName})` : ''} - {o.supplierName} ({o.itemCount} items) {getStatusLabel(o.status)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="pos-label">Área de Almacenamiento</label>
                                <select
                                    value={selectedAreaId}
                                    onChange={e => setSelectedAreaId(e.target.value)}
                                    className="pos-input mt-1 w-full"
                                >
                                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {selectedOrder && (
                            <div className="overflow-hidden rounded-lg border border-capsula-line">
                                {Object.entries(selectedOrderItemsByCategory).map(([cat, items]) => (
                                    <div key={cat}>
                                        <div className="border-b border-capsula-line bg-capsula-ivory-alt px-4 py-2">
                                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{cat}</span>
                                        </div>
                                        {(items as any[]).map((item: any) => {
                                            const remaining = item.quantityOrdered - item.quantityReceived;
                                            const isComplete = remaining <= 0;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        "grid grid-cols-[1fr_80px_80px_80px_100px] items-center gap-2 border-b border-capsula-line px-4 py-2.5",
                                                        isComplete && 'bg-[#E5EDE7]/40 dark:bg-[#1E3B2C]/40'
                                                    )}
                                                >
                                                    <div><p className="text-sm font-medium text-capsula-ink">{item.itemName}</p></div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Pedido</p>
                                                        <p className="font-mono text-sm tabular-nums text-capsula-ink">{formatNumber(item.quantityOrdered)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Recibido</p>
                                                        <p className="font-mono text-sm tabular-nums text-[#2F6B4E] dark:text-[#6FB88F]">{formatNumber(item.quantityReceived)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Falta</p>
                                                        <p className={cn(
                                                            "font-mono text-sm tabular-nums",
                                                            remaining > 0 ? 'text-capsula-coral' : 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                                        )}>
                                                            {formatNumber(remaining)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        {!isComplete && (
                                                            <input
                                                                type="number" min="0" max={remaining} step="0.1" placeholder="0"
                                                                value={receiveQuantities[item.id] || ''}
                                                                onChange={e => setReceiveQuantities({ ...receiveQuantities, [item.id]: parseFloat(e.target.value) || 0 })}
                                                                className="pos-input w-full px-2 py-1 text-center text-sm tabular-nums"
                                                            />
                                                        )}
                                                        {isComplete && <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2F6B4E] dark:text-[#6FB88F]"><Check className="h-3 w-3" /> Completo</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                                <div className="flex justify-end bg-capsula-ivory-alt p-4">
                                    <button
                                        onClick={handleReceiveItems}
                                        disabled={isSubmitting || Object.values(receiveQuantities).every(v => !v)}
                                        className="pos-btn inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50"
                                    >
                                        {isSubmitting
                                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</>
                                            : <><Inbox className="h-4 w-4" /> Dar Entrada a Mercancía</>}
                                    </button>
                                </div>
                            </div>
                        )}
                        {!selectedOrderId && (
                            <div className="py-8 text-center text-capsula-ink-muted">
                                <Inbox className="mx-auto h-10 w-10 text-capsula-ink-faint" />
                                <p className="mt-2">Selecciona una orden de compra para comenzar a recibir mercancía</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== ORDERS: Lista de Órdenes ===== */}
            {viewMode === 'orders' && renderOrdersList()}
        </div>
    );

    function getStatusLabel(status: string) { return { DRAFT: 'Borrador', SENT: 'Enviada', PARTIAL: 'Parcial', RECEIVED: 'Recibida', CANCELLED: 'Cancelada' }[status] || status; }

    function renderOrderForm() {
        return (
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                <div className="border-b border-capsula-line px-6 py-4">
                    <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Nueva Orden de Compra</h2>
                </div>
                <div className="space-y-4 p-6">
                    <div>
                        <label className="pos-label">Nombre de orden (opcional)</label>
                        <input
                            type="text"
                            value={orderName}
                            onChange={e => setOrderName(e.target.value)}
                            placeholder="Ej: VEGETALES, COCHE, PROVEEDOR X…"
                            className="pos-input mt-1 w-full"
                        />
                    </div>
                    <div>
                        <label className="pos-label">Proveedor (opcional)</label>
                        <select
                            value={selectedSupplier}
                            onChange={e => setSelectedSupplier(e.target.value)}
                            className="pos-input mt-1 w-full"
                        >
                            <option value="">Sin proveedor específico</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="pos-label">Fecha de entrega esperada</label>
                        <input
                            type="date"
                            value={expectedDate}
                            onChange={e => setExpectedDate(e.target.value)}
                            className="pos-input mt-1 w-full"
                        />
                    </div>
                    <div>
                        <label className="pos-label mb-2">Items a comprar ({orderItems.length})</label>
                        {orderItems.length === 0
                            ? <p className="text-sm italic text-capsula-ink-muted">Agrega items desde el panel izquierdo</p>
                            : (
                                <div className="max-h-72 overflow-y-auto rounded-lg border border-capsula-line">
                                    {Object.entries(orderItemsByCategory).map(([cat, items]) => (
                                        <div key={cat}>
                                            <div className="border-b border-capsula-line bg-capsula-ivory-alt px-3 py-1">
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{cat}</span>
                                            </div>
                                            {items.map(item => (
                                                <div key={item.rowId} className="flex items-center gap-2 border-b border-capsula-line px-3 py-1.5">
                                                    <span className="flex-1 truncate text-sm text-capsula-ink">{item.name}</span>
                                                    <input
                                                        type="number" min="0" step="0.1"
                                                        value={item.quantity}
                                                        onChange={e => updateItemQuantity(item.rowId, parseFloat(e.target.value) || 0)}
                                                        className="pos-input w-16 px-1.5 py-1 text-center text-sm tabular-nums"
                                                    />
                                                    <span className="w-8 text-xs text-capsula-ink-muted">{item.unit}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.rowId)}
                                                        className="flex-shrink-0 rounded p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                        aria-label={`Quitar ${item.name}`}
                                                    >
                                                        <XIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>
                    <div>
                        <label className="pos-label">Notas (opcional)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Instrucciones especiales…"
                            className="pos-input mt-1 w-full"
                        />
                    </div>
                    <button
                        onClick={handleCreateOrder}
                        disabled={orderItems.length === 0 || isSubmitting}
                        className="pos-btn w-full py-3 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? 'Creando…' : `Crear Orden (${orderItems.length} items)`}
                    </button>
                </div>
            </div>
        );
    }

    function renderOrdersList() {
        return (
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                            <tr>
                                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Orden</th>
                                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Proveedor</th>
                                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Fecha</th>
                                <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Items</th>
                                <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Estado</th>
                                <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-capsula-line">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-capsula-ink-muted">
                                        <ClipboardList className="mx-auto h-10 w-10 text-capsula-ink-faint" />
                                        <p className="mt-2">No hay órdenes de compra</p>
                                    </td>
                                </tr>
                            ) : orders.map(order => (
                                <tr key={order.id} className="hover:bg-capsula-ivory-surface">
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-capsula-ink">{order.orderNumber}</p>
                                        {order.orderName && <p className="text-xs font-semibold text-capsula-coral">{order.orderName}</p>}
                                        <p className="text-xs text-capsula-ink-muted">{order.createdBy}</p>
                                    </td>
                                    <td className="px-6 py-4 text-capsula-ink-soft">{order.supplierName}</td>
                                    <td className="px-6 py-4 text-sm text-capsula-ink-muted tabular-nums">{new Date(order.orderDate).toLocaleDateString('es-VE')}</td>
                                    <td className="px-6 py-4 text-center"><span className="font-mono tabular-nums text-capsula-ink">{order.itemCount}</span></td>
                                    <td className="px-6 py-4 text-center">{getStatusBadge(order.status)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleExportWhatsApp(order.id)}
                                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-[#E5EDE7] hover:text-[#2F6B4E] dark:hover:bg-[#1E3B2C] dark:hover:text-[#6FB88F]"
                                                title="Copiar para WhatsApp"
                                                aria-label="Copiar para WhatsApp"
                                            >
                                                <MessageCircle className="h-4 w-4" />
                                            </button>
                                            {['SENT', 'PARTIAL'].includes(order.status) && (
                                                <button
                                                    onClick={() => { setSelectedOrderId(order.id); setReceiveQuantities({}); setViewMode('receive'); }}
                                                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#2F6B4E] px-3 py-1.5 text-sm font-medium text-capsula-ivory shadow-sm transition-colors hover:bg-[#1f4a37] dark:bg-[#1E3B2C] dark:hover:bg-[#264a39]"
                                                    title="Recibir mercancía"
                                                >
                                                    <Inbox className="h-4 w-4" /> Recibir
                                                </button>
                                            )}
                                            {order.status === 'DRAFT' && (<>
                                                <button
                                                    onClick={() => { setSelectedOrderId(order.id); setReceiveQuantities({}); setViewMode('receive'); }}
                                                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-[#E5EDE7] hover:text-[#2F6B4E] dark:hover:bg-[#1E3B2C] dark:hover:text-[#6FB88F]"
                                                    title="Recibir mercancía"
                                                    aria-label="Recibir mercancía"
                                                >
                                                    <Inbox className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleSendOrder(order.id)}
                                                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                                    title="Marcar como enviada"
                                                    aria-label="Marcar como enviada"
                                                >
                                                    <Send className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleCancelOrder(order.id)}
                                                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                    title="Cancelar"
                                                    aria-label="Cancelar"
                                                >
                                                    <Ban className="h-4 w-4" />
                                                </button>
                                            </>)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
