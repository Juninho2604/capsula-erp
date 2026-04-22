'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatNumber, cn } from '@/lib/utils';
import {
    getLowStockItemsAction, getAllItemsForPurchaseAction, getAllItemsWithStockConfigAction,
    createPurchaseOrderAction, getPurchaseOrdersAction, getSuppliersAction, getAreasForReceivingAction,
    sendPurchaseOrderAction, cancelPurchaseOrderAction, exportPurchaseOrderTextAction,
    receivePurchaseOrderItemsAction, updateStockLevelsAction, createReorderBroadcastsAction,
    LowStockItem, StockConfigItem
} from '@/app/actions/purchase.actions';
import WhatsAppPurchaseOrderParser from '@/components/whatsapp-purchase-order-parser';
import {
    ShoppingCart, ClipboardList, Sparkles, Plus, MessageCircle, Settings,
    Inbox, Search, Save, FolderOpen, Bell, AlertTriangle, Check, Loader2,
    FileText, Send, Truck, Package, Smartphone, Trash2, X, PartyPopper,
    Lightbulb, AlertOctagon, FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

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
        if (result.success) { alert(`✅ ${result.message}`); setOrderItems([]); setOrderName(''); setSelectedSupplier(''); setExpectedDate(''); setNotes(''); setViewMode('orders'); loadData(); }
        else alert(`❌ ${result.message}`);
        setIsSubmitting(false);
    }

    async function handleSendOrder(orderId: string) { const r = await sendPurchaseOrderAction(orderId); if (r.success) loadData(); alert(r.message); }
    async function handleCancelOrder(orderId: string) { if (!confirm('¿Cancelar esta orden?')) return; const r = await cancelPurchaseOrderAction(orderId); if (r.success) loadData(); alert(r.message); }
    async function handleExportWhatsApp(orderId: string) { const text = await exportPurchaseOrderTextAction(orderId); if (text) { navigator.clipboard.writeText(text); alert('Orden copiada al portapapeles'); } }

    async function handleReceiveItems() {
        if (!selectedOrderId || !selectedAreaId) return;
        const items = Object.entries(receiveQuantities).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ purchaseOrderItemId: id, quantityReceived: qty }));
        if (items.length === 0) { alert('Ingresa cantidades a recibir'); return; }
        setIsSubmitting(true);
        const r = await receivePurchaseOrderItemsAction(selectedOrderId, items, selectedAreaId);
        alert(r.success ? `✅ ${r.message}` : `❌ ${r.message}`);
        if (r.success) { setReceiveQuantities({}); setSelectedOrderId(''); loadData(); setViewMode('orders'); }
        setIsSubmitting(false);
    }

    async function handleCreateReorderAlerts() {
        setIsSubmitting(true);
        const r = await createReorderBroadcastsAction();
        if (r.created > 0) alert(`✅ ${r.created} alerta(s) de reorden enviadas a la campana 🔔`);
        else if (r.skipped > 0) alert(`ℹ️ Todas las alertas ya existen (${r.skipped} en curso). Revisa la campana 🔔`);
        else alert('ℹ️ No hay items bajo punto de reorden en este momento');
        setIsSubmitting(false);
    }

    async function handleSaveConfig() {
        const items: StockConfigItem[] = Object.entries(configEdits).map(([id, vals]) => ({ id, minimumStock: vals.min, reorderPoint: vals.reorder }));
        setIsSubmitting(true);
        const r = await updateStockLevelsAction(items);
        alert(r.success ? `✅ ${r.message}` : `❌ ${r.message}`);
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
        const v: Record<string, 'neutral' | 'info' | 'warn' | 'ok' | 'danger'> = {
            DRAFT: 'neutral', SENT: 'info', PARTIAL: 'warn', RECEIVED: 'ok', CANCELLED: 'danger',
        };
        const l: Record<string, string> = {
            DRAFT: 'Borrador', SENT: 'Enviada', PARTIAL: 'Parcial', RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
        };
        const IconMap = {
            DRAFT: FileText, SENT: Send, PARTIAL: Package, RECEIVED: Check, CANCELLED: X,
        } as const;
        const SIcon = (IconMap as any)[status] || FileText;
        return (
            <Badge variant={v[status] || 'neutral'}>
                <SIcon className="h-3 w-3" strokeWidth={1.5} /> {l[status] || status}
            </Badge>
        );
    };

    const lowStockByCategory = useMemo(() => {
        const groups: Record<string, LowStockItem[]> = {};
        lowStockItems.forEach(i => { const cat = i.category || 'Sin Categoría'; if (!groups[cat]) groups[cat] = []; groups[cat].push(i); });
        return groups;
    }, [lowStockItems]);

    if (isLoading) return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-capsula-navy" strokeWidth={1.5} />
                <p className="mt-3 text-[13px] text-capsula-ink-muted">Cargando…</p>
            </div>
        </div>
    );

    const viewTabs: { id: ViewMode; label: string; Icon: typeof ClipboardList }[] = [
        { id: 'orders',   label: 'Órdenes',      Icon: ClipboardList },
        { id: 'auto',     label: 'Auto-generar', Icon: Sparkles },
        { id: 'create',   label: 'Manual',       Icon: Plus },
        { id: 'whatsapp', label: 'WhatsApp',     Icon: MessageCircle },
        { id: 'config',   label: 'Stock mín.',   Icon: Settings },
        { id: 'receive',  label: 'Recibir',      Icon: Inbox },
    ];

    return (
        <div className="mx-auto max-w-[1400px] animate-in space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-capsula-line pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Finanzas</div>
                    <h1 className="inline-flex items-center gap-2 font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                        <ShoppingCart className="h-6 w-6 text-capsula-navy" strokeWidth={1.5} />
                        Módulo de compras
                    </h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">Gestiona órdenes de compra, stock mínimo y recepción de mercancía.</p>
                </div>
                <div className="flex flex-wrap gap-1">
                    {viewTabs.map(tab => {
                        const Icon = tab.Icon;
                        const active = viewMode === tab.id;
                        const isWhatsapp = tab.id === 'whatsapp';
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setViewMode(tab.id);
                                    if (tab.id === 'orders') loadData();
                                    if (tab.id === 'create' || tab.id === 'whatsapp') getAllItemsForPurchaseAction().then(setAllItems);
                                }}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium transition-colors',
                                    active
                                        ? isWhatsapp
                                            ? 'border-capsula-coral bg-capsula-coral text-white'
                                            : 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
                                        : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-line-strong hover:text-capsula-ink',
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ===== CONFIG: Stock Mínimo ===== */}
            {viewMode === 'config' && (
                <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                    <div className="flex flex-col gap-3 border-b border-capsula-line bg-capsula-ivory px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                                <Settings className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
                                Configurar stock mínimo y punto de reorden
                            </h2>
                            <p className="mt-1 text-[12px] text-capsula-ink-muted">Define las cantidades mínimas para detectar productos con stock bajo.</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                                <input
                                    type="text"
                                    value={configFilter}
                                    onChange={e => setConfigFilter(e.target.value)}
                                    placeholder="Filtrar…"
                                    className="rounded-full border border-capsula-line bg-capsula-ivory-surface py-1.5 pl-8 pr-3 text-[12.5px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                />
                            </div>
                            <Button variant="primary" size="sm" onClick={handleSaveConfig} disabled={isSubmitting} isLoading={isSubmitting}>
                                <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
                                {isSubmitting ? '...' : 'Guardar todo'}
                            </Button>
                        </div>
                    </div>
                    <div className="max-h-[65vh] overflow-y-auto">
                        {Object.entries(configByCategory).map(([category, items]) => (
                            <div key={category}>
                                <div className="sticky top-0 z-10 border-b border-capsula-line bg-capsula-ivory px-6 py-2">
                                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-capsula-ink-soft">
                                        <FolderOpen className="h-3 w-3 text-capsula-navy" strokeWidth={1.5} /> {category}
                                    </span>
                                </div>
                                {items.map((item: any) => (
                                    <div key={item.id} className="grid grid-cols-[1fr_100px_100px_100px] items-center gap-3 border-b border-capsula-line px-6 py-2.5 hover:bg-capsula-ivory">
                                        <div>
                                            <p className="text-[13px] font-medium text-capsula-ink">{item.name}</p>
                                            <p className="font-mono text-[11px] text-capsula-ink-muted">{item.sku} · {item.baseUnit}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="mb-0.5 text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Stock</p>
                                            <p className={cn('font-mono text-[13px] font-medium', item.currentStock <= (configEdits[item.id]?.min || 0) ? 'text-capsula-coral' : 'text-capsula-ink-soft')}>
                                                {formatNumber(item.currentStock)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="mb-0.5 text-center text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Mínimo</p>
                                            <input type="number" min="0" step="0.5" value={configEdits[item.id]?.min ?? 0}
                                                onChange={e => setConfigEdits({ ...configEdits, [item.id]: { ...configEdits[item.id], min: parseFloat(e.target.value) || 0 } })}
                                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-center font-mono text-[12.5px] text-capsula-ink outline-none focus:border-capsula-navy-deep" />
                                        </div>
                                        <div>
                                            <p className="mb-0.5 text-center text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Reorden</p>
                                            <input type="number" min="0" step="0.5" value={configEdits[item.id]?.reorder ?? 0}
                                                onChange={e => setConfigEdits({ ...configEdits, [item.id]: { ...configEdits[item.id], reorder: parseFloat(e.target.value) || 0 } })}
                                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-center font-mono text-[12.5px] text-capsula-ink outline-none focus:border-capsula-navy-deep" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {filteredConfigItems.length === 0 && <div className="p-8 text-center text-[13px] text-capsula-ink-muted">No hay items que configurar</div>}
                    </div>
                </div>
            )}

            {/* ===== AUTO: Generar Automática ===== */}
            {viewMode === 'auto' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-capsula-line bg-capsula-ivory px-6 py-4">
                            <h2 className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                                <AlertTriangle className="h-4 w-4 text-capsula-coral" strokeWidth={1.5} />
                                Ítems con stock bajo
                            </h2>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleCreateReorderAlerts} disabled={isSubmitting}>
                                    <Bell className="h-3.5 w-3.5" strokeWidth={1.5} /> Enviar alertas
                                </Button>
                                <button onClick={addAllSuggestions} className="inline-flex items-center gap-1 text-[12px] font-medium text-capsula-navy hover:text-capsula-navy-deep">
                                    Agregar todos <Plus className="h-3 w-3" strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {lowStockItems.length === 0 ? (
                                <div className="p-10 text-center">
                                    <PartyPopper className="mx-auto h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
                                    <p className="mt-3 font-medium text-capsula-ink">¡No hay items con stock bajo!</p>
                                    <p className="mt-1 text-[12px] text-capsula-ink-muted">
                                        ¿Ya configuraste los mínimos? Ve a{' '}
                                        <button onClick={() => setViewMode('config')} className="text-capsula-coral underline hover:text-capsula-coral-hover">Stock mín.</button>
                                    </p>
                                </div>
                            ) : (
                                Object.entries(lowStockByCategory).map(([cat, items]) => (
                                    <div key={cat}>
                                        <div className="sticky top-0 z-10 border-b border-capsula-coral/30 bg-capsula-coral-subtle/50 px-6 py-1.5">
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-coral">
                                                <FolderOpen className="h-3 w-3" strokeWidth={1.5} /> {cat} ({items.length})
                                            </span>
                                        </div>
                                        {items.map(item => {
                                            const alreadyIn = orderItems.some(oi => oi.inventoryItemId === item.id);
                                            return (
                                                <div key={item.id} className={cn("flex items-center justify-between border-b border-capsula-line px-6 py-2.5 hover:bg-capsula-ivory", item.isCritical && 'bg-capsula-coral-subtle/20')}>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="inline-flex items-center gap-1.5 truncate text-[13px] font-medium text-capsula-ink">
                                                            {item.isCritical && <AlertOctagon className="h-3.5 w-3.5 text-capsula-coral" strokeWidth={1.5} />}
                                                            {item.name}
                                                        </p>
                                                        <p className="text-[11px] text-capsula-ink-muted">
                                                            Stock: <span className="font-mono font-medium text-capsula-coral">{formatNumber(item.currentStock)}</span>{' '}
                                                            / Mín: <span className="font-mono">{formatNumber(item.minimumStock)}</span> {item.baseUnit}
                                                        </p>
                                                    </div>
                                                    <div className="ml-4 flex items-center gap-2">
                                                        <span className="font-mono text-[13px] text-[#946A1C]">+{formatNumber(item.suggestedQuantity)}</span>
                                                        <button
                                                            onClick={() => addFromSuggestion(item)}
                                                            disabled={alreadyIn}
                                                            className={cn(
                                                                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                                                alreadyIn
                                                                    ? "border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]"
                                                                    : "border-capsula-line bg-capsula-ivory-surface text-capsula-navy hover:border-capsula-navy-deep/40 hover:bg-capsula-navy-soft",
                                                            )}
                                                        >
                                                            {alreadyIn ? <><Check className="h-3 w-3" strokeWidth={2} /> Agregado</> : 'Agregar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                    <div className="rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle/30 p-6 shadow-cap-soft">
                        <h3 className="mb-3 inline-flex items-center gap-2 font-medium text-capsula-coral">
                            <Lightbulb className="h-4 w-4" strokeWidth={1.5} /> Cómo usar
                        </h3>
                        <ol className="list-decimal list-inside space-y-2 text-[13px] text-capsula-ink-soft">
                            <li>Exporta o copia el chat de WhatsApp con tu proveedor.</li>
                            <li>Pega el texto en el área de la izquierda.</li>
                            <li>Haz clic en &quot;Analizar orden&quot;.</li>
                            <li>Revisa y corrige los items reconocidos.</li>
                            <li>Haz clic en &quot;Cargar items a la orden&quot;.</li>
                            <li>Completa proveedor, fecha y crea la orden.</li>
                        </ol>
                        <p className="mt-4 text-[11px] text-capsula-ink-muted">
                            Formatos soportados: 2 kg Arroz, 5× Aceite, 10 unidades Harina, etc.
                        </p>
                    </div>
                </div>
            )}

            {/* ===== CREATE: Manual ===== */}
            {viewMode === 'create' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                        <div className="border-b border-capsula-line bg-capsula-ivory px-6 py-4">
                            <h2 className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                                <Search className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} /> Buscar ítems
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Escriba para buscar…"
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface py-2.5 pl-10 pr-3 text-[14px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                                />
                            </div>
                            {filteredItems.length > 0 && (
                                <div className="mt-3 overflow-hidden rounded-[var(--radius)] border border-capsula-line">
                                    {filteredItems.map(item => {
                                        const alreadyIn = orderItems.some(oi => oi.inventoryItemId === item.id);
                                        return (
                                            <div key={item.id} className="flex items-center justify-between border-b border-capsula-line px-4 py-3 last:border-b-0 hover:bg-capsula-ivory">
                                                <div>
                                                    <p className="font-medium text-capsula-ink">{item.name}</p>
                                                    <p className="text-[11px] text-capsula-ink-muted">
                                                        Stock: <span className="font-mono">{formatNumber(item.currentStock)}</span> {item.baseUnit} · {item.category || 'Sin cat.'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => addManualItem(item)}
                                                    disabled={alreadyIn}
                                                    className={cn(
                                                        "inline-flex items-center gap-1 rounded-md border px-3 py-1 text-[11px] font-medium transition-colors",
                                                        alreadyIn
                                                            ? "border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]"
                                                            : "border-capsula-line bg-capsula-ivory-surface text-capsula-navy hover:border-capsula-navy-deep/40 hover:bg-capsula-navy-soft",
                                                    )}
                                                >
                                                    {alreadyIn ? <><Check className="h-3 w-3" strokeWidth={2} /> Agregado</> : 'Agregar'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    {renderOrderForm()}
                </div>
            )}

            {/* ===== RECEIVE: Recibir Mercancía ===== */}
            {viewMode === 'receive' && (
                <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                    <div className="border-b border-capsula-line bg-capsula-ivory px-6 py-4">
                        <h2 className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                            <Inbox className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} /> Recibir mercancía desde orden de compra
                        </h2>
                        <p className="mt-1 text-[12px] text-capsula-ink-muted">Selecciona una orden activa y registra lo que va llegando de los proveedores.</p>
                    </div>
                    <div className="space-y-4 p-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Orden de compra</label>
                                <select value={selectedOrderId} onChange={e => { setSelectedOrderId(e.target.value); setReceiveQuantities({}); }}
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep">
                                    <option value="">Seleccionar orden…</option>
                                    {orders.filter(o => ['DRAFT', 'SENT', 'PARTIAL'].includes(o.status)).map(o => (
                                        <option key={o.id} value={o.id}>{o.orderNumber}{o.orderName ? ` (${o.orderName})` : ''} — {o.supplierName} ({o.itemCount} ítems) {getStatusLabel(o.status)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Área de almacenamiento</label>
                                <select value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep">
                                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {selectedOrder && (
                            <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line">
                                {Object.entries(selectedOrderItemsByCategory).map(([cat, items]) => (
                                    <div key={cat}>
                                        <div className="border-b border-capsula-line bg-capsula-ivory px-4 py-2">
                                            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-capsula-ink-soft">
                                                <FolderOpen className="h-3 w-3 text-capsula-navy" strokeWidth={1.5} /> {cat}
                                            </span>
                                        </div>
                                        {(items as any[]).map((item: any) => {
                                            const remaining = item.quantityOrdered - item.quantityReceived;
                                            const isComplete = remaining <= 0;
                                            return (
                                                <div key={item.id} className={cn("grid grid-cols-[1fr_80px_80px_80px_100px] items-center gap-2 border-b border-capsula-line px-4 py-2.5", isComplete && 'bg-[#E5EDE7]/40')}>
                                                    <div>
                                                        <p className="text-[13px] font-medium text-capsula-ink">{item.itemName}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Pedido</p>
                                                        <p className="font-mono text-[13px] text-capsula-ink">{formatNumber(item.quantityOrdered)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Recibido</p>
                                                        <p className="font-mono text-[13px] text-[#2F6B4E]">{formatNumber(item.quantityReceived)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Falta</p>
                                                        <p className={cn("font-mono text-[13px]", remaining > 0 ? 'text-capsula-coral' : 'text-[#2F6B4E]')}>{formatNumber(remaining)}</p>
                                                    </div>
                                                    <div>
                                                        {!isComplete && (
                                                            <input type="number" min="0" max={remaining} step="0.1" placeholder="0" value={receiveQuantities[item.id] || ''}
                                                                onChange={e => setReceiveQuantities({ ...receiveQuantities, [item.id]: parseFloat(e.target.value) || 0 })}
                                                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-center font-mono text-[12.5px] text-capsula-ink outline-none focus:border-capsula-navy-deep" />
                                                        )}
                                                        {isComplete && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2F6B4E]">
                                                                <Check className="h-3 w-3" strokeWidth={2} /> Completo
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                                <div className="flex justify-end border-t border-capsula-line bg-capsula-ivory p-4">
                                    <Button
                                        variant="primary"
                                        onClick={handleReceiveItems}
                                        disabled={isSubmitting || Object.values(receiveQuantities).every(v => !v)}
                                        isLoading={isSubmitting}
                                    >
                                        <Inbox className="h-4 w-4" strokeWidth={1.5} />
                                        {isSubmitting ? 'Procesando…' : 'Dar entrada a mercancía'}
                                    </Button>
                                </div>
                            </div>
                        )}
                        {!selectedOrderId && (
                            <div className="py-8 text-center">
                                <Package className="mx-auto h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
                                <p className="mt-3 text-[13px] text-capsula-ink-muted">Selecciona una orden de compra para comenzar a recibir mercancía</p>
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
        const inputCls = 'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep';
        const labelCls = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';
        return (
            <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                <div className="border-b border-capsula-line bg-capsula-ivory px-6 py-4">
                    <h2 className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                        <FileText className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} /> Nueva orden de compra
                    </h2>
                </div>
                <div className="space-y-4 p-6">
                    <div>
                        <label className={labelCls}>Nombre de orden (opcional)</label>
                        <input
                            type="text"
                            value={orderName}
                            onChange={e => setOrderName(e.target.value)}
                            placeholder="Ej: VEGETALES, COCHE, PROVEEDOR X…"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Proveedor (opcional)</label>
                        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className={inputCls}>
                            <option value="">Sin proveedor específico</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Fecha de entrega esperada</label>
                        <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Ítems a comprar ({orderItems.length})</label>
                        {orderItems.length === 0 ? (
                            <p className="text-[13px] italic text-capsula-ink-muted">Agrega ítems desde el panel izquierdo</p>
                        ) : (
                            <div className="max-h-72 overflow-y-auto rounded-[var(--radius)] border border-capsula-line">
                                {Object.entries(orderItemsByCategory).map(([cat, items]) => (
                                    <div key={cat}>
                                        <div className="border-b border-capsula-line bg-capsula-ivory px-3 py-1.5">
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-soft">
                                                <FolderOpen className="h-3 w-3 text-capsula-navy" strokeWidth={1.5} /> {cat}
                                            </span>
                                        </div>
                                        {items.map(item => (
                                            <div key={item.rowId} className="flex items-center gap-2 border-b border-capsula-line px-3 py-1.5 last:border-b-0">
                                                <span className="flex-1 truncate text-[12.5px] text-capsula-ink">{item.name}</span>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateItemQuantity(item.rowId, parseFloat(e.target.value) || 0)}
                                                    className="w-16 rounded border border-capsula-line bg-capsula-ivory-surface px-1.5 py-1 text-center font-mono text-[12px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                                    min="0" step="0.1"
                                                />
                                                <span className="w-8 text-[11px] text-capsula-ink-muted">{item.unit}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(item.rowId)}
                                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                                >
                                                    <X className="h-3 w-3" strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className={labelCls}>Notas (opcional)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Instrucciones especiales…" className={inputCls} />
                    </div>
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleCreateOrder}
                        disabled={orderItems.length === 0 || isSubmitting}
                        isLoading={isSubmitting}
                        className="w-full"
                    >
                        <FileText className="h-4 w-4" strokeWidth={1.5} />
                        {isSubmitting ? 'Creando…' : `Crear orden (${orderItems.length} ítems)`}
                    </Button>
                </div>
            </div>
        );
    }

    function renderOrdersList() {
        const thClass = 'px-6 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';
        const iconBtn = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink';
        return (
            <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                            <tr>
                                <th className={thClass}>Orden</th>
                                <th className={thClass}>Proveedor</th>
                                <th className={thClass}>Fecha</th>
                                <th className={`${thClass} text-center`}>Items</th>
                                <th className={`${thClass} text-center`}>Estado</th>
                                <th className={`${thClass} text-center`}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-capsula-line">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <Package className="mx-auto h-12 w-12 text-capsula-ink-muted/50" strokeWidth={1.25} />
                                        <p className="mt-3 text-[13px] text-capsula-ink-soft">No hay órdenes de compra</p>
                                    </td>
                                </tr>
                            ) : orders.map(order => (
                                <tr key={order.id} className="transition-colors hover:bg-capsula-ivory-alt/50">
                                    <td className="px-6 py-4">
                                        <p className="font-mono text-[13px] text-capsula-ink">{order.orderNumber}</p>
                                        {order.orderName && <p className="text-[11px] uppercase tracking-[0.08em] text-capsula-coral">{order.orderName}</p>}
                                        <p className="text-[11px] text-capsula-ink-muted">{order.createdBy}</p>
                                    </td>
                                    <td className="px-6 py-4 text-[13px] text-capsula-ink">{order.supplierName}</td>
                                    <td className="px-6 py-4 font-mono text-[12px] text-capsula-ink-muted">{new Date(order.orderDate).toLocaleDateString('es-VE')}</td>
                                    <td className="px-6 py-4 text-center font-mono text-[13px] text-capsula-ink">{order.itemCount}</td>
                                    <td className="px-6 py-4 text-center">{getStatusBadge(order.status)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handleExportWhatsApp(order.id)} className={iconBtn} title="Copiar para WhatsApp">
                                                <Smartphone className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                            {['SENT', 'PARTIAL'].includes(order.status) && (
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => { setSelectedOrderId(order.id); setReceiveQuantities({}); setViewMode('receive'); }}
                                                >
                                                    <Inbox className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                    Recibir
                                                </Button>
                                            )}
                                            {order.status === 'DRAFT' && (
                                                <>
                                                    <button onClick={() => { setSelectedOrderId(order.id); setReceiveQuantities({}); setViewMode('receive'); }} className={iconBtn} title="Recibir mercancía">
                                                        <Inbox className="h-4 w-4" strokeWidth={1.5} />
                                                    </button>
                                                    <button onClick={() => handleSendOrder(order.id)} className={iconBtn} title="Marcar como enviada">
                                                        <Send className="h-4 w-4" strokeWidth={1.5} />
                                                    </button>
                                                    <button onClick={() => handleCancelOrder(order.id)} className={iconBtn} title="Cancelar">
                                                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                                    </button>
                                                </>
                                            )}
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
