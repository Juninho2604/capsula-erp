'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import {
    getMenuItemsForSalesAction,
    getMenuCategoriesAction,
    createSalesEntryAction,
    getTodaySalesAction,
    getSalesAreasAction,
    voidSalesOrderAction
} from '@/app/actions/sales-entry.actions';
import WhatsAppOrderParser from '@/components/whatsapp-order-parser';
import {
    Coins, Plus, ClipboardList, MessageCircle, BarChart3, Loader2,
    UtensilsCrossed, Bike, Pizza, Search, X, ShoppingBag, Trash2,
    Upload, FileText, AlertTriangle, Check, Receipt, ArrowLeft,
    ChevronDown, CreditCard, Banknote, Zap, Smartphone, Phone, MapPin, Gift,
    Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

interface CartItem {
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
}

export default function SalesEntryView() {
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [todaySales, setTodaySales] = useState<any>({ sales: [], summary: { totalSales: 0, totalRevenue: 0, byType: {} } });
    const [isLoading, setIsLoading] = useState(true);

    // Estado del carrito
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Estado del formulario
    const [orderType, setOrderType] = useState<'RESTAURANT' | 'DELIVERY' | 'TAKEOUT'>('RESTAURANT');
    const [areaId, setAreaId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
    const [discountType, setDiscountType] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [notes, setNotes] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState<'entry' | 'history' | 'whatsapp'>('entry');

    // Cargar datos iniciales
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        const [itemsData, catsData, areasData, salesData] = await Promise.all([
            getMenuItemsForSalesAction(),
            getMenuCategoriesAction(),
            getSalesAreasAction(),
            getTodaySalesAction()
        ]);
        setMenuItems(itemsData);
        setCategories(catsData);
        setAreas(areasData);
        setTodaySales(salesData);

        if (areasData.length > 0) {
            setAreaId(areasData[0].id);
        }

        setIsLoading(false);
    }

    // Filtrar items
    const filteredItems = menuItems.filter(item => {
        if (selectedCategory && item.categoryId !== selectedCategory) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return item.name.toLowerCase().includes(query) || item.sku?.toLowerCase().includes(query);
        }
        return true;
    });

    // Agregar al carrito
    function addToCart(item: any) {
        const existing = cart.find(c => c.menuItemId === item.id);
        if (existing) {
            setCart(cart.map(c =>
                c.menuItemId === item.id
                    ? { ...c, quantity: c.quantity + 1 }
                    : c
            ));
        } else {
            setCart([...cart, {
                menuItemId: item.id,
                menuItemName: item.name,
                quantity: 1,
                unitPrice: item.price
            }]);
        }
    }

    // Actualizar cantidad
    function updateQuantity(itemId: string, quantity: number) {
        if (quantity <= 0) {
            setCart(cart.filter(c => c.menuItemId !== itemId));
        } else {
            setCart(cart.map(c =>
                c.menuItemId === itemId ? { ...c, quantity } : c
            ));
        }
    }

    // Eliminar del carrito
    function removeFromCart(itemId: string) {
        setCart(cart.filter(c => c.menuItemId !== itemId));
    }

    // Calcular totales
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const total = Math.max(0, subtotal - discountAmount);

    // Registrar venta
    async function handleSubmit() {
        if (cart.length === 0) {
            alert('Agrega items a la venta');
            return;
        }
        if (!areaId) {
            alert('Selecciona un área');
            return;
        }

        setIsSubmitting(true);
        const result = await createSalesEntryAction({
            orderType,
            areaId,
            items: cart,
            paymentMethod,
            discountType: discountType || undefined,
            discountAmount: discountAmount > 0 ? discountAmount : undefined,
            notes: notes || undefined,
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
            customerAddress: deliveryAddress || undefined
        });

        if (result.success) {
            alert(`✅ ${result.message}`);
            // Limpiar formulario
            setCart([]);
            setDiscountType('');
            setDiscountAmount(0);
            setNotes('');
            setCustomerName('');
            setCustomerPhone('');
            setDeliveryAddress('');
            // Recargar ventas del día
            const salesData = await getTodaySalesAction();
            setTodaySales(salesData);
        } else {
            alert(`❌ ${result.message}`);
        }
        setIsSubmitting(false);
    }

    // Anular venta
    async function handleVoidSale(orderId: string) {
        const reason = prompt('Motivo de la anulación:');
        if (!reason) return;

        const result = await voidSalesOrderAction(orderId, reason);
        alert(result.message);
        if (result.success) {
            const salesData = await getTodaySalesAction();
            setTodaySales(salesData);
        }
    }

    // Tipos de descuento
    const discountTypes = [
        { id: '', label: 'Sin descuento', percent: 0 },
        { id: 'DIVISAS_33', label: 'Divisas (33%)', percent: 33 },
        { id: 'EMPLEADO_50', label: 'Empleado (50%)', percent: 50 },
        { id: 'CORTESIA_100', label: 'Cortesía (100%)', percent: 100 }
    ];

    // Métodos de pago
    const paymentMethods = [
        { id: 'EFECTIVO', label: '💵 Efectivo' },
        { id: 'TARJETA', label: '💳 Tarjeta' },
        { id: 'TRANSFERENCIA', label: '📱 Transferencia' },
        { id: 'PAGO_MOVIL', label: '📲 Pago Móvil' },
        { id: 'ZELLE', label: '💲 Zelle' },
        { id: 'MIXTO', label: '🔀 Mixto' }
    ];

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-capsula-navy" strokeWidth={1.5} />
                    <p className="mt-3 text-[13px] text-capsula-ink-muted">Cargando…</p>
                </div>
            </div>
        );
    }

    const viewTabs: { id: 'entry' | 'history' | 'whatsapp'; label: string; icon: typeof Plus; count?: number }[] = [
        { id: 'entry', label: 'Nueva venta', icon: Plus },
        { id: 'history', label: `Ventas hoy`, icon: ClipboardList, count: todaySales.summary.totalSales },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ];

    return (
        <div className="mx-auto max-w-[1400px] animate-in">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 border-b border-capsula-line pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Ventas</div>
                    <h1 className="inline-flex items-center gap-2 font-heading text-[32px] leading-tight tracking-[-0.02em] text-capsula-navy-deep">
                        <Coins className="h-7 w-7 text-capsula-coral" strokeWidth={1.5} />
                        Cargar ventas
                    </h1>
                    <p className="mt-1 text-[14px] text-capsula-ink-soft">Registra las comandas de WhatsApp.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-capsula-line bg-capsula-ivory-surface p-1">
                        {viewTabs.map(tab => {
                            const Icon = tab.icon;
                            const active = viewMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id)}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-colors',
                                        active
                                            ? 'bg-capsula-navy-deep text-capsula-ivory'
                                            : 'text-capsula-ink-muted hover:text-capsula-ink',
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {tab.label}
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className={cn(
                                            'ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                                            active ? 'bg-capsula-ivory/20 text-capsula-ivory' : 'bg-capsula-coral-subtle text-capsula-coral',
                                        )}>{tab.count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/dashboard/ventas">
                            <BarChart3 className="h-4 w-4" strokeWidth={1.5} /> Reportes
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Resumen rápido */}
            <div className="mb-6 grid gap-4 sm:grid-cols-4">
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Ventas hoy</p>
                    <p className="mt-1 font-mono text-[24px] font-semibold text-capsula-ink">{todaySales.summary.totalSales}</p>
                </div>
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Ingresos hoy</p>
                    <p className="mt-1 font-mono text-[24px] font-semibold text-[#2F6B4E]">{formatCurrency(todaySales.summary.totalRevenue)}</p>
                </div>
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                        <UtensilsCrossed className="h-3 w-3" strokeWidth={1.5} /> Restaurante
                    </p>
                    <p className="mt-1 font-mono text-[24px] font-semibold text-capsula-ink">{todaySales.summary.byType?.RESTAURANT || 0}</p>
                </div>
                <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                        <Bike className="h-3 w-3" strokeWidth={1.5} /> Delivery
                    </p>
                    <p className="mt-1 font-mono text-[24px] font-semibold text-capsula-ink">{todaySales.summary.byType?.DELIVERY || 0}</p>
                </div>
            </div>

            {/* Vista: Nueva Venta */}
            {viewMode === 'entry' && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Catálogo de productos */}
                    <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft lg:col-span-2">
                        <div className="border-b border-capsula-line bg-capsula-ivory px-5 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                                    <ClipboardList className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} /> Menú
                                </h2>
                                <div className="relative w-full sm:w-64">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar producto…"
                                        className="w-full rounded-full border border-capsula-line bg-capsula-ivory-surface py-2 pl-9 pr-3 text-[13px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                                    />
                                </div>
                            </div>

                            {/* Categorías */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedCategory('')}
                                    className={cn(
                                        'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                                        selectedCategory === ''
                                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-line-strong hover:text-capsula-ink',
                                    )}
                                >
                                    Todos
                                </button>
                                {categories.map(cat => {
                                    const active = selectedCategory === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={cn(
                                                'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                                                active
                                                    ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
                                                    : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-line-strong hover:text-capsula-ink',
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid max-h-[50vh] gap-2 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredItems.length === 0 ? (
                                <p className="col-span-full py-8 text-center text-[13px] text-capsula-ink-muted">
                                    No se encontraron productos
                                </p>
                            ) : (
                                filteredItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="flex items-center justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-3 text-left transition-all hover:-translate-y-px hover:border-capsula-navy-deep/40 hover:shadow-cap-soft"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium text-capsula-ink">{item.name}</p>
                                            <p className="text-[11px] text-capsula-ink-muted">{item.categoryName}</p>
                                        </div>
                                        <span className="ml-2 font-mono text-[13px] font-semibold text-capsula-navy-deep">
                                            {formatCurrency(item.price)}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Carrito y checkout */}
                    <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                        <div className="border-b border-capsula-line bg-capsula-ivory px-5 py-4">
                            <h2 className="inline-flex items-center gap-2 font-medium text-capsula-ink">
                                <ShoppingBag className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
                                Comanda <span className="text-[11px] text-capsula-ink-muted">({cart.length})</span>
                            </h2>
                        </div>

                        <div className="max-h-[30vh] space-y-3 overflow-y-auto p-4">
                            {cart.length === 0 ? (
                                <p className="py-4 text-center text-[13px] text-capsula-ink-muted">
                                    Agrega productos del menú
                                </p>
                            ) : (
                                cart.map(item => (
                                    <div key={item.menuItemId} className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium text-capsula-ink">{item.menuItemName}</p>
                                            <p className="font-mono text-[11px] text-capsula-ink-muted">{formatCurrency(item.unitPrice)}</p>
                                        </div>
                                        <div className="flex items-center gap-1 rounded-full border border-capsula-line bg-capsula-ivory p-1">
                                            <button
                                                onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                                            >
                                                <Minus className="h-3 w-3" strokeWidth={2} />
                                            </button>
                                            <span className="inline-flex w-7 items-center justify-center font-mono text-[13px] font-semibold text-capsula-navy-deep">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-capsula-navy-deep text-capsula-ivory transition-colors hover:bg-capsula-navy"
                                            >
                                                <Plus className="h-3 w-3" strokeWidth={2} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.menuItemId)}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                        >
                                            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="space-y-3 border-t border-capsula-line p-4">
                            {/* Tipo de orden */}
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { id: 'RESTAURANT' as const, label: 'Mesa', icon: UtensilsCrossed },
                                    { id: 'DELIVERY' as const, label: 'Delivery', icon: Bike },
                                    { id: 'TAKEOUT' as const, label: 'Para llevar', icon: ShoppingBag },
                                ]).map(type => {
                                    const TIcon = type.icon;
                                    const active = orderType === type.id;
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => setOrderType(type.id)}
                                            className={cn(
                                                'inline-flex items-center justify-center gap-1 rounded-full py-2 text-[11px] font-medium transition-colors',
                                                active
                                                    ? 'bg-capsula-navy-deep text-capsula-ivory'
                                                    : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:text-capsula-ink',
                                            )}
                                        >
                                            <TIcon className="h-3 w-3" strokeWidth={1.5} /> {type.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Cliente (para delivery) */}
                            {orderType === 'DELIVERY' && (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="Nombre del cliente"
                                            className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        placeholder="Teléfono"
                                        className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                                    />
                                    <input
                                        type="text"
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                        placeholder="Dirección de entrega"
                                        className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                                    />
                                </div>
                            )}

                            <select
                                value={areaId}
                                onChange={(e) => setAreaId(e.target.value)}
                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                            >
                                {areas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>

                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                            >
                                {paymentMethods.map(pm => (
                                    <option key={pm.id} value={pm.id}>{pm.label}</option>
                                ))}
                            </select>

                            <select
                                value={discountType}
                                onChange={(e) => {
                                    setDiscountType(e.target.value);
                                    const dt = discountTypes.find(d => d.id === e.target.value);
                                    if (dt) {
                                        setDiscountAmount(subtotal * (dt.percent / 100));
                                    }
                                }}
                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                            >
                                {discountTypes.map(dt => (
                                    <option key={dt.id} value={dt.id}>{dt.label}</option>
                                ))}
                            </select>

                            {/* Totales */}
                            <div className="space-y-1 border-t border-capsula-line pt-3">
                                <div className="flex justify-between text-[12px]">
                                    <span className="text-capsula-ink-muted">Subtotal:</span>
                                    <span className="font-mono text-capsula-ink">{formatCurrency(subtotal)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-[12px] text-capsula-coral">
                                        <span>Descuento:</span>
                                        <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Total:</span>
                                    <span className="font-mono text-[22px] font-semibold text-capsula-navy-deep">{formatCurrency(total)}</span>
                                </div>
                            </div>

                            {/* Botón registrar */}
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleSubmit}
                                disabled={cart.length === 0 || isSubmitting}
                                isLoading={isSubmitting}
                                className="w-full"
                            >
                                <Check className="h-4 w-4" strokeWidth={1.5} />
                                {isSubmitting ? 'Registrando…' : 'Registrar venta'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vista: WhatsApp Parser */}
            {viewMode === 'whatsapp' && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-6">
                    {/* Opción de cargar archivo .txt */}
                    <div className="mb-6 rounded-lg border-2 border-dashed border-green-200 bg-green-50/50 p-4 dark:border-green-900/50 dark:bg-green-900/10">
                        <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                            📂 Cargar archivo de chat exportado (.txt)
                        </p>
                        <input
                            type="file"
                            accept=".txt,.text"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const text = await file.text();
                                // Strip WhatsApp metadata (timestamps/sender) from each line
                                const cleaned = text.split('\n').map(line => {
                                    // Pattern: "[DD/MM/YYYY, HH:MM:SS] Sender: message" or "DD/MM/YYYY, HH:MM - Sender: message"
                                    const stripped = line
                                        .replace(/^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?\]?\s*[-–]?\s*/i, '')
                                        .replace(/^[^:]+:\s*/, '');
                                    return stripped;
                                }).filter(l => l.trim()).join('\n');
                                // Set the text in the parser - we need a ref or state approach
                                // For simplicity, we populate a hidden textarea and trigger parse
                                const textarea = document.querySelector('#whatsapp-chat-input') as HTMLTextAreaElement;
                                if (textarea) {
                                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                                    nativeInputValueSetter?.call(textarea, cleaned);
                                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }}
                            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200 cursor-pointer"
                        />
                    </div>

                    <WhatsAppOrderParser
                        onOrderReady={(items, name, phone, address) => {
                            // Convert CartItem format from parser to sales-entry format
                            const cartItems: CartItem[] = items.map(i => ({
                                menuItemId: i.menuItemId,
                                menuItemName: i.name,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                notes: i.notes,
                            }));
                            setCart(cartItems);
                            if (name) setCustomerName(name);
                            if (phone) setCustomerPhone(phone);
                            if (address) {
                                setDeliveryAddress(address);
                                setOrderType('DELIVERY');
                            }
                            setViewMode('entry');
                        }}
                    />
                </div>
            )}

            {/* Vista: Historial del día */}
            {viewMode === 'history' && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-200 bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Cliente</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Items</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Hora</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {todaySales.sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                            <span className="text-4xl">📭</span>
                                            <p className="mt-2">No hay ventas registradas hoy</p>
                                        </td>
                                    </tr>
                                ) : (
                                    todaySales.sales.map((sale: any) => (
                                        <tr key={sale.id} className={cn(
                                            'hover:bg-gray-50',
                                            sale.status === 'VOIDED' && 'opacity-50 bg-red-50'
                                        )}>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-gray-900">{sale.orderNumber}</p>
                                                <p className="text-xs text-gray-500">{sale.createdBy}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    'px-2.5 py-1 rounded-full text-xs font-medium',
                                                    sale.orderType === 'RESTAURANT' && 'bg-blue-100 text-blue-700',
                                                    sale.orderType === 'DELIVERY' && 'bg-purple-100 text-purple-700',
                                                    sale.orderType === 'TAKEOUT' && 'bg-amber-100 text-amber-700'
                                                )}>
                                                    {sale.orderType === 'RESTAURANT' ? '🍽️' : sale.orderType === 'DELIVERY' ? '🛵' : '📦'} {sale.orderType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {sale.customerName || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono">
                                                {sale.itemCount}
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                                                {formatCurrency(sale.total)}
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-gray-500">
                                                {new Date(sale.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {sale.status !== 'VOIDED' && (
                                                    <button
                                                        onClick={() => handleVoidSale(sale.id)}
                                                        className="text-red-500 hover:text-red-700 text-sm"
                                                        title="Anular venta"
                                                    >
                                                        🗑️ Anular
                                                    </button>
                                                )}
                                                {sale.status === 'VOIDED' && (
                                                    <span className="text-red-500 text-xs">ANULADA</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
