'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus, ClipboardList, MessageCircle, BarChart3,
    DollarSign, CreditCard, Smartphone, Banknote, Zap, Shuffle,
    UtensilsCrossed, Bike, Package, Check, X as XIcon,
    Trash2, Upload, ShoppingCart,
} from 'lucide-react';
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
            alert(`${result.message}`);
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
            alert(`${result.message}`);
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
        { id: 'EFECTIVO', label: 'Efectivo' },
        { id: 'TARJETA', label: 'Tarjeta' },
        { id: 'TRANSFERENCIA', label: 'Transferencia' },
        { id: 'PAGO_MOVIL', label: 'Pago Móvil' },
        { id: 'ZELLE', label: 'Zelle' },
        { id: 'MIXTO', label: 'Mixto' }
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-4 text-capsula-ink-muted">Cargando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Cargar Ventas</h1>
                    <p className="text-capsula-ink-muted">
                        Registra las comandas de WhatsApp
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('entry')}
                        className={cn(
                            'px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                            viewMode === 'entry'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-capsula-ink shadow-lg'
                                : 'bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:bg-capsula-ivory-alt dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream dark:hover:bg-capsula-navy'
                        )}
                    >
                        <Plus className="h-4 w-4 inline-block mr-1" /> Nueva Venta
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={cn(
                            'px-4 py-2.5 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5',
                            viewMode === 'history'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-capsula-ink shadow-lg'
                                : 'bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:bg-capsula-ivory-alt dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream dark:hover:bg-capsula-navy'
                        )}
                    >
                        <ClipboardList className="h-4 w-4" /> Ventas Hoy ({todaySales.summary.totalSales})
                    </button>
                    <button
                        onClick={() => setViewMode('whatsapp')}
                        className={cn(
                            'px-4 py-2.5 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5',
                            viewMode === 'whatsapp'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-capsula-ink shadow-lg'
                                : 'bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:bg-capsula-ivory-alt dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream dark:hover:bg-capsula-navy'
                        )}
                    >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                    </button>
                    <Link
                        href="/dashboard/ventas"
                        className="px-4 py-2.5 rounded-lg text-sm font-medium bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:bg-capsula-ivory-alt dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream dark:hover:bg-capsula-navy inline-flex items-center gap-1.5"
                    >
                        <BarChart3 className="h-4 w-4" /> Reportes
                    </Link>
                </div>
            </div>

            {/* Resumen rápido */}
            <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-capsula-line bg-white p-4 dark:border-capsula-line dark:bg-capsula-ivory-alt">
                    <p className="text-sm text-capsula-ink-muted">Ventas Hoy</p>
                    <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">{todaySales.summary.totalSales}</p>
                </div>
                <div className="rounded-xl border border-capsula-line bg-white p-4 dark:border-capsula-line dark:bg-capsula-ivory-alt">
                    <p className="text-sm text-capsula-ink-muted">Ingresos Hoy</p>
                    <p className="font-semibold text-2xl tracking-[-0.02em] text-[#2F6B4E] dark:text-[#6FB88F]">{formatCurrency(todaySales.summary.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border border-capsula-line bg-white p-4 dark:border-capsula-line dark:bg-capsula-ivory-alt">
                    <p className="text-sm text-capsula-ink-muted">Restaurante</p>
                    <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">{todaySales.summary.byType?.RESTAURANT || 0}</p>
                </div>
                <div className="rounded-xl border border-capsula-line bg-white p-4 dark:border-capsula-line dark:bg-capsula-ivory-alt">
                    <p className="text-sm text-capsula-ink-muted">Delivery</p>
                    <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">{todaySales.summary.byType?.DELIVERY || 0}</p>
                </div>
            </div>

            {/* Vista: Nueva Venta */}
            {viewMode === 'entry' && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Catálogo de productos */}
                    <div className="lg:col-span-2 rounded-xl border border-capsula-line bg-white shadow-sm dark:border-capsula-line dark:bg-capsula-ivory-alt">
                        <div className="border-b border-capsula-line px-6 py-4 dark:border-capsula-line">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Menú</h2>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar producto..."
                                    className="w-full sm:w-64 rounded-lg border border-capsula-line px-4 py-2 text-sm focus:border-amber-500 focus:outline-none dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream dark:placeholder:text-capsula-ink-muted"
                                />
                            </div>

                            {/* Categorías */}
                            <div className="flex gap-2 mt-3 flex-wrap">
                                <button
                                    onClick={() => setSelectedCategory('')}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                        selectedCategory === ''
                                            ? 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]'
                                            : 'bg-capsula-ivory-alt text-capsula-ink-soft hover:bg-capsula-line/40 dark:bg-capsula-navy-soft dark:text-capsula-cream dark:hover:bg-capsula-navy'
                                    )}
                                >
                                    Todos
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                            selectedCategory === cat.id
                                                ? 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]'
                                                : 'bg-capsula-ivory-alt text-capsula-ink-soft hover:bg-capsula-line/40 dark:bg-capsula-navy-soft dark:text-capsula-cream dark:hover:bg-capsula-navy'
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[50vh] overflow-y-auto">
                            {filteredItems.length === 0 ? (
                                <p className="col-span-full text-center text-capsula-ink-muted py-8">
                                    No se encontraron productos
                                </p>
                            ) : (
                                filteredItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="flex items-center justify-between p-3 rounded-lg border border-capsula-line hover:border-[#946A1C]/40 dark:hover:border-[#E8D9B8]/40 hover:bg-[#F3EAD6]/40 dark:bg-[#3B2F15]/40 transition-all text-left"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-capsula-ink dark:text-capsula-cream truncate">{item.name}</p>
                                            <p className="text-xs text-capsula-ink-muted">{item.categoryName}</p>
                                        </div>
                                        <span className="ml-2 font-semibold text-[#946A1C] dark:text-[#E8D9B8]">
                                            {formatCurrency(item.price)}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Carrito y checkout */}
                    <div className="rounded-xl border border-capsula-line bg-white shadow-sm dark:border-capsula-line dark:bg-capsula-ivory-alt">
                        <div className="border-b border-capsula-line px-6 py-4 dark:border-capsula-line">
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Comanda ({cart.length})</h2>
                        </div>

                        <div className="p-4 space-y-4 max-h-[30vh] overflow-y-auto">
                            {cart.length === 0 ? (
                                <p className="text-center text-capsula-ink-muted py-4">
                                    Agrega productos del menú
                                </p>
                            ) : (
                                cart.map(item => (
                                    <div key={item.menuItemId} className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.menuItemName}</p>
                                            <p className="text-xs text-capsula-ink-muted">{formatCurrency(item.unitPrice)}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                                                className="w-6 h-6 rounded bg-capsula-ivory-alt text-capsula-ink-soft hover:bg-capsula-line/40 dark:bg-capsula-navy-soft dark:text-capsula-cream dark:hover:bg-capsula-navy"
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                                                className="w-6 h-6 rounded bg-capsula-ivory-alt text-capsula-ink-soft hover:bg-capsula-line/40 dark:bg-capsula-navy-soft dark:text-capsula-cream dark:hover:bg-capsula-navy"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.menuItemId)}
                                            className="text-[#B04A2E] dark:text-[#EFD2C8] hover:text-[#B04A2E] dark:text-[#EFD2C8]"
                                        >
                                            <XIcon className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-t border-capsula-line p-4 space-y-3 dark:border-capsula-line">
                            {/* Tipo de orden */}
                            <div className="grid grid-cols-3 gap-2">
                                {(['RESTAURANT', 'DELIVERY', 'TAKEOUT'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setOrderType(type)}
                                        className={cn(
                                            'py-2 rounded-lg text-xs font-medium transition-all',
                                            orderType === type
                                                ? 'bg-capsula-coral text-capsula-cream'
                                                : 'bg-capsula-ivory-alt text-capsula-ink-soft hover:bg-capsula-line/40 dark:bg-capsula-navy-soft dark:text-capsula-cream dark:hover:bg-capsula-navy'
                                        )}
                                    >
                                        {type === 'RESTAURANT' ? <><UtensilsCrossed className="h-3.5 w-3.5 inline-block mr-1" />Mesa</> : type === 'DELIVERY' ? <><Bike className="h-3.5 w-3.5 inline-block mr-1" />Delivery</> : <><Package className="h-3.5 w-3.5 inline-block mr-1" />Para llevar</>}
                                    </button>
                                ))}
                            </div>

                            {/* Cliente (para delivery) */}
                            {orderType === 'DELIVERY' && (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Nombre del cliente"
                                        className="w-full rounded-lg border border-capsula-line px-3 py-2 text-sm dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream"
                                    />
                                    <input
                                        type="text"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        placeholder="Teléfono"
                                        className="w-full rounded-lg border border-capsula-line px-3 py-2 text-sm dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream"
                                    />
                                    <input
                                        type="text"
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                        placeholder="Dirección de entrega"
                                        className="w-full rounded-lg border border-capsula-line px-3 py-2 text-sm dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream"
                                    />
                                </div>
                            )}

                            {/* Área */}
                            <select
                                value={areaId}
                                onChange={(e) => setAreaId(e.target.value)}
                                className="w-full rounded-lg border border-capsula-line px-3 py-2 text-sm dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream"
                            >
                                {areas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>

                            {/* Método de pago */}
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full rounded-lg border border-capsula-line px-3 py-2 text-sm dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream"
                            >
                                {paymentMethods.map(pm => (
                                    <option key={pm.id} value={pm.id}>{pm.label}</option>
                                ))}
                            </select>

                            {/* Descuento */}
                            <select
                                value={discountType}
                                onChange={(e) => {
                                    setDiscountType(e.target.value);
                                    const dt = discountTypes.find(d => d.id === e.target.value);
                                    if (dt) {
                                        setDiscountAmount(subtotal * (dt.percent / 100));
                                    }
                                }}
                                className="w-full rounded-lg border border-capsula-line px-3 py-2 text-sm dark:bg-capsula-navy-soft dark:border-capsula-line dark:text-capsula-cream"
                            >
                                {discountTypes.map(dt => (
                                    <option key={dt.id} value={dt.id}>{dt.label}</option>
                                ))}
                            </select>

                            {/* Totales */}
                            <div className="border-t pt-3 space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-capsula-ink-muted">Subtotal:</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-sm text-[#B04A2E] dark:text-[#EFD2C8]">
                                        <span>Descuento:</span>
                                        <span>-{formatCurrency(discountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-semibold">
                                    <span>Total:</span>
                                    <span className="text-[#2F6B4E] dark:text-[#6FB88F]">{formatCurrency(total)}</span>
                                </div>
                            </div>

                            {/* Botón registrar */}
                            <button
                                onClick={handleSubmit}
                                disabled={cart.length === 0 || isSubmitting}
                                className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-capsula-ink font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                            >
                                {isSubmitting ? 'Registrando...' : <><Check className="h-4 w-4 inline-block mr-1" />Registrar Venta</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vista: WhatsApp Parser */}
            {viewMode === 'whatsapp' && (
                <div className="rounded-xl border border-capsula-line bg-white shadow-sm dark:border-capsula-line dark:bg-capsula-ivory-alt p-6">
                    {/* Opción de cargar archivo .txt */}
                    <div className="mb-6 rounded-lg border-2 border-dashed border-[#E5EDE7] dark:border-[#1E3B2C] bg-[#E5EDE7]/40 dark:bg-[#1E3B2C]/40 p-4 dark:border-[#1E3B2C]/40 dark:bg-[#E5EDE7] dark:bg-[#1E3B2C]/10">
                        <p className="text-sm font-medium text-[#2F6B4E] dark:text-[#6FB88F] dark:text-[#2F6B4E] dark:text-[#6FB88F] mb-2">
                            <Upload className="h-4 w-4 inline-block mr-1.5" />Cargar archivo de chat exportado (.txt)
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
                            className="block w-full text-sm text-capsula-ink-soft file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#E5EDE7] file:text-[#2F6B4E] dark:text-[#6FB88F] hover:file:bg-[#E5EDE7]/70 cursor-pointer"
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
                <div className="rounded-xl border border-capsula-line bg-white shadow-sm dark:border-capsula-line dark:bg-capsula-ivory-alt">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-capsula-line bg-capsula-ivory-alt dark:border-capsula-line dark:bg-capsula-navy-soft/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-muted">Orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-muted">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-muted">Cliente</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-capsula-ink-muted">Items</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-capsula-ink-muted">Total</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-capsula-ink-muted">Hora</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-capsula-ink-muted">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {todaySales.sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-capsula-ink-muted">
                                            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                            <p className="mt-2">No hay ventas registradas hoy</p>
                                        </td>
                                    </tr>
                                ) : (
                                    todaySales.sales.map((sale: any) => (
                                        <tr key={sale.id} className={cn(
                                            'hover:bg-capsula-ivory-alt',
                                            sale.status === 'VOIDED' && 'opacity-50 bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40'
                                        )}>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-capsula-ink dark:text-capsula-cream">{sale.orderNumber}</p>
                                                <p className="text-xs text-capsula-ink-muted">{sale.createdBy}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    'px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1',
                                                    sale.orderType === 'RESTAURANT' && 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
                                                    sale.orderType === 'DELIVERY' && 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]',
                                                    sale.orderType === 'TAKEOUT' && 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]'
                                                )}>
                                                    {sale.orderType === 'RESTAURANT' ? <UtensilsCrossed className="h-3 w-3" /> : sale.orderType === 'DELIVERY' ? <Bike className="h-3 w-3" /> : <Package className="h-3 w-3" />} {sale.orderType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-capsula-ink-soft dark:text-capsula-cream">
                                                {sale.customerName || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono">
                                                {sale.itemCount}
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold text-[#2F6B4E] dark:text-[#6FB88F]">
                                                {formatCurrency(sale.total)}
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-capsula-ink-muted">
                                                {new Date(sale.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {sale.status !== 'VOIDED' && (
                                                    <button
                                                        onClick={() => handleVoidSale(sale.id)}
                                                        className="text-[#B04A2E] dark:text-[#EFD2C8] hover:text-[#B04A2E] dark:text-[#EFD2C8] text-sm"
                                                        title="Anular venta"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 inline-block mr-1" />Anular
                                                    </button>
                                                )}
                                                {sale.status === 'VOIDED' && (
                                                    <span className="text-[#B04A2E] dark:text-[#EFD2C8] text-xs">ANULADA</span>
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
