'use client';

import { useState, useEffect } from 'react';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import {
    getLowStockItemsAction,
    getAllItemsForPurchaseAction,
    createPurchaseOrderAction,
    getPurchaseOrdersAction,
    getSuppliersAction,
    sendPurchaseOrderAction,
    cancelPurchaseOrderAction,
    exportPurchaseOrderTextAction,
    LowStockItem
} from '@/app/actions/purchase.actions';

type ViewMode = 'orders' | 'create' | 'auto';

interface OrderItem {
    inventoryItemId: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
}

export default function PurchaseOrderView() {
    const [viewMode, setViewMode] = useState<ViewMode>('orders');
    const [orders, setOrders] = useState<any[]>([]);
    const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
    const [allItems, setAllItems] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Estado del formulario de nueva orden
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

    // Búsqueda de items
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Cargar datos iniciales
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        const [ordersData, suppliersData] = await Promise.all([
            getPurchaseOrdersAction(),
            getSuppliersAction()
        ]);
        setOrders(ordersData);
        setSuppliers(suppliersData);
        setIsLoading(false);
    }

    async function loadLowStockItems() {
        const items = await getLowStockItemsAction();
        setLowStockItems(items);
    }

    async function loadAllItems() {
        const items = await getAllItemsForPurchaseAction();
        setAllItems(items);
    }

    // Cuando cambia a modo automático, cargar items con stock bajo
    useEffect(() => {
        if (viewMode === 'auto') {
            loadLowStockItems();
        } else if (viewMode === 'create') {
            loadAllItems();
        }
    }, [viewMode]);

    // Agregar item desde sugerencia automática
    function addFromSuggestion(item: LowStockItem) {
        if (orderItems.some(oi => oi.inventoryItemId === item.id)) return;

        setOrderItems([...orderItems, {
            inventoryItemId: item.id,
            name: item.name,
            quantity: item.suggestedQuantity,
            unit: item.baseUnit,
            unitPrice: 0
        }]);
    }

    // Agregar todos los sugeridos
    function addAllSuggestions() {
        const newItems = lowStockItems
            .filter(item => !orderItems.some(oi => oi.inventoryItemId === item.id))
            .map(item => ({
                inventoryItemId: item.id,
                name: item.name,
                quantity: item.suggestedQuantity,
                unit: item.baseUnit,
                unitPrice: 0
            }));
        setOrderItems([...orderItems, ...newItems]);
    }

    // Agregar item manual
    function addManualItem(item: any) {
        if (orderItems.some(oi => oi.inventoryItemId === item.id)) return;

        setOrderItems([...orderItems, {
            inventoryItemId: item.id,
            name: item.name,
            quantity: 1,
            unit: item.baseUnit,
            unitPrice: 0
        }]);
        setSearchQuery('');
    }

    // Actualizar cantidad de un item
    function updateItemQuantity(itemId: string, quantity: number) {
        setOrderItems(orderItems.map(item =>
            item.inventoryItemId === itemId ? { ...item, quantity } : item
        ));
    }

    // Remover item
    function removeItem(itemId: string) {
        setOrderItems(orderItems.filter(item => item.inventoryItemId !== itemId));
    }

    // Crear orden
    async function handleCreateOrder() {
        if (orderItems.length === 0) return;

        setIsSubmitting(true);
        const result = await createPurchaseOrderAction({
            supplierId: selectedSupplier || undefined,
            expectedDate: expectedDate ? new Date(expectedDate) : undefined,
            notes: notes || undefined,
            items: orderItems.map(item => ({
                inventoryItemId: item.inventoryItemId,
                quantityOrdered: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice
            }))
        });

        if (result.success) {
            alert(`✅ ${result.message}`);
            setOrderItems([]);
            setSelectedSupplier('');
            setExpectedDate('');
            setNotes('');
            setViewMode('orders');
            loadData();
        } else {
            alert(`❌ ${result.message}`);
        }
        setIsSubmitting(false);
    }

    // Enviar orden
    async function handleSendOrder(orderId: string) {
        const result = await sendPurchaseOrderAction(orderId);
        if (result.success) {
            loadData();
        }
        alert(result.message);
    }

    // Cancelar orden
    async function handleCancelOrder(orderId: string) {
        if (!confirm('¿Estás seguro de cancelar esta orden?')) return;
        const result = await cancelPurchaseOrderAction(orderId);
        if (result.success) {
            loadData();
        }
        alert(result.message);
    }

    // Exportar para WhatsApp
    async function handleExportWhatsApp(orderId: string) {
        const text = await exportPurchaseOrderTextAction(orderId);
        if (text) {
            navigator.clipboard.writeText(text);
            alert('📋 Orden copiada al portapapeles. Puedes pegarla en WhatsApp.');
        }
    }

    // Filtrar items para búsqueda
    const filteredItems = allItems.filter(item =>
        searchQuery && (
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchQuery.toLowerCase())
        )
    ).slice(0, 10);

    // Status badge
    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'DRAFT': 'bg-gray-100 text-gray-700',
            'SENT': 'bg-blue-100 text-blue-700',
            'PARTIAL': 'bg-amber-100 text-amber-700',
            'RECEIVED': 'bg-green-100 text-green-700',
            'CANCELLED': 'bg-red-100 text-red-700'
        };
        const labels: Record<string, string> = {
            'DRAFT': '📝 Borrador',
            'SENT': '📤 Enviada',
            'PARTIAL': '📦 Parcial',
            'RECEIVED': '✅ Recibida',
            'CANCELLED': '❌ Cancelada'
        };
        return (
            <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', styles[status] || styles['DRAFT'])}>
                {labels[status] || status}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Cargando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        🛒 Órdenes de Compra
                    </h1>
                    <p className="text-gray-500">
                        Gestiona las compras a proveedores
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('auto')}
                        className={cn(
                            'px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                            viewMode === 'auto'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                        )}
                    >
                        ✨ Generar Automática
                    </button>
                    <button
                        onClick={() => setViewMode('create')}
                        className={cn(
                            'px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                            viewMode === 'create'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                        )}
                    >
                        ➕ Nueva Manual
                    </button>
                    <button
                        onClick={() => { setViewMode('orders'); loadData(); }}
                        className={cn(
                            'px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                            viewMode === 'orders'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                        )}
                    >
                        📋 Ver Órdenes
                    </button>
                </div>
            </div>

            {/* Vista: Generar Automática */}
            {viewMode === 'auto' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Items con Stock Bajo */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-gray-900 dark:text-white">
                                    ⚠️ Items con Stock Bajo
                                </h2>
                                <button
                                    onClick={addAllSuggestions}
                                    className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                                >
                                    Agregar todos →
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {lowStockItems.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <span className="text-4xl">🎉</span>
                                    <p className="mt-2">¡No hay items con stock bajo!</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {lowStockItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                                    {item.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Stock: {formatNumber(item.currentStock)} / Mín: {formatNumber(item.minimumStock)} {item.baseUnit}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-4">
                                                <span className="text-sm font-mono text-amber-600">
                                                    +{formatNumber(item.suggestedQuantity)}
                                                </span>
                                                <button
                                                    onClick={() => addFromSuggestion(item)}
                                                    disabled={orderItems.some(oi => oi.inventoryItemId === item.id)}
                                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {orderItems.some(oi => oi.inventoryItemId === item.id) ? '✓' : 'Agregar'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Orden de Compra */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                📋 Nueva Orden de Compra
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Proveedor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Proveedor (opcional)
                                </label>
                                <select
                                    value={selectedSupplier}
                                    onChange={(e) => setSelectedSupplier(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="">Sin proveedor específico</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha esperada */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Fecha de entrega esperada
                                </label>
                                <input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            {/* Items de la orden */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Items a comprar ({orderItems.length})
                                </label>
                                {orderItems.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">
                                        Agrega items desde la lista de stock bajo
                                    </p>
                                ) : (
                                    <div className="border rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                                        {orderItems.map(item => (
                                            <div key={item.inventoryItemId} className="flex items-center gap-3 px-4 py-2">
                                                <span className="flex-1 text-sm truncate">{item.name}</span>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemQuantity(item.inventoryItemId, parseFloat(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 text-sm rounded border border-gray-200 text-center"
                                                    min="0"
                                                    step="0.1"
                                                />
                                                <span className="text-xs text-gray-500">{item.unit}</span>
                                                <button
                                                    onClick={() => removeItem(item.inventoryItemId)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Notas */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Notas (opcional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Instrucciones especiales..."
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            {/* Botón crear */}
                            <button
                                onClick={handleCreateOrder}
                                disabled={orderItems.length === 0 || isSubmitting}
                                className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                            >
                                {isSubmitting ? 'Creando...' : `📝 Crear Orden (${orderItems.length} items)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vista: Crear Manual */}
            {viewMode === 'create' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Búsqueda de Items */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                🔍 Buscar Items
                            </h2>
                        </div>
                        <div className="p-6">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Escriba para buscar..."
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />

                            {filteredItems.length > 0 && (
                                <div className="mt-3 border rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    Stock: {formatNumber(item.currentStock)} {item.baseUnit}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => addManualItem(item)}
                                                disabled={orderItems.some(oi => oi.inventoryItemId === item.id)}
                                                className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                                            >
                                                {orderItems.some(oi => oi.inventoryItemId === item.id) ? '✓ Agregado' : 'Agregar'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mismo formulario de orden */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                📋 Nueva Orden de Compra
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Proveedor (opcional)
                                </label>
                                <select
                                    value={selectedSupplier}
                                    onChange={(e) => setSelectedSupplier(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="">Sin proveedor específico</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Fecha de entrega esperada
                                </label>
                                <input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Items a comprar ({orderItems.length})
                                </label>
                                {orderItems.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">
                                        Busca y agrega items a la orden
                                    </p>
                                ) : (
                                    <div className="border rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                                        {orderItems.map(item => (
                                            <div key={item.inventoryItemId} className="flex items-center gap-3 px-4 py-2">
                                                <span className="flex-1 text-sm truncate">{item.name}</span>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemQuantity(item.inventoryItemId, parseFloat(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 text-sm rounded border border-gray-200 text-center"
                                                    min="0"
                                                    step="0.1"
                                                />
                                                <span className="text-xs text-gray-500">{item.unit}</span>
                                                <button
                                                    onClick={() => removeItem(item.inventoryItemId)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Notas (opcional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Instrucciones especiales..."
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <button
                                onClick={handleCreateOrder}
                                disabled={orderItems.length === 0 || isSubmitting}
                                className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                            >
                                {isSubmitting ? 'Creando...' : `📝 Crear Orden (${orderItems.length} items)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vista: Lista de Órdenes */}
            {viewMode === 'orders' && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Proveedor</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Fecha</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Items</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Estado</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            <span className="text-4xl">📭</span>
                                            <p className="mt-2">No hay órdenes de compra</p>
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map(order => (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-gray-900 dark:text-white">{order.orderNumber}</p>
                                                <p className="text-xs text-gray-500">{order.createdBy}</p>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                                {order.supplierName}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(order.orderDate).toLocaleDateString('es-VE')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-mono">{order.itemCount}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {getStatusBadge(order.status)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleExportWhatsApp(order.id)}
                                                        className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50"
                                                        title="Copiar para WhatsApp"
                                                    >
                                                        📱
                                                    </button>
                                                    {order.status === 'DRAFT' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleSendOrder(order.id)}
                                                                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                                                title="Marcar como enviada"
                                                            >
                                                                📤
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancelOrder(order.id)}
                                                                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                                                title="Cancelar"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
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
