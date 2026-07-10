'use client';

/**
 * Modal accesible desde los POS (Restaurante, Delivery, Pedidos Ya) que
 * permite a la cajera (o cualquier usuario con permiso REPRINT_COMANDA)
 * elegir una orden del día y reimprimir su comanda de cocina/barra.
 *
 * Pensado para resolver el caso: la impresora de cocina falló en el
 * momento del cobro, o la cocina extravió el papel. En vez de tener
 * que reimprimir desde Historial de Ventas (módulo no habilitado para
 * todas las cajeras), pueden hacerlo directo desde el POS donde están
 * trabajando.
 *
 * Diseño UX:
 *   - Muestra TODAS las órdenes del día (no filtra por POS donde se abrió):
 *     útil porque una misma cajera puede pasar entre delivery, pickup y
 *     mesas durante el turno.
 *   - Búsqueda libre por número de orden o nombre de cliente.
 *   - Confirmación previa antes de disparar la reimpresión + cooldown
 *     de 3 segundos por fila para evitar doble-click.
 *   - El split barra/cocina lo hace automáticamente el agent
 *     (enqueueKitchenCommand) según la categoría del menuItem.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { X as XIcon, Receipt, Printer, Search, Loader2, RefreshCw, CheckCircle2, ChefHat } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getComandasDelDiaAction,
    type ComandaOrder,
} from '@/app/actions/sales/comandas-del-dia.actions';
import { enqueueKitchenCommand } from '@/lib/print-via-agent';
import { printReceipt } from '@/lib/print-command';

interface ComandasDelDiaModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Convierte el orderType + sourceChannel + openTabId del sistema al
 * orderType que `enqueueKitchenCommand` espera ('RESTAURANT' o 'DELIVERY').
 * PEDIDOSYA se mapea a DELIVERY (mismo flow físico de envío).
 */
function deriveOrderType(o: ComandaOrder): 'RESTAURANT' | 'DELIVERY' {
    const t = (o.orderType || '').toUpperCase();
    const s = (o.sourceChannel || '').toUpperCase();
    if (t === 'DELIVERY' || t === 'PEDIDOSYA' || s === 'POS_PEDIDOSYA') return 'DELIVERY';
    return 'RESTAURANT';
}

/**
 * Label operativo para la comanda (MESA / PICKUP / DELIVERY / PEDIDOSYA).
 * El operador en cocina/barra usa este label para priorizar.
 */
function deriveOrderTypeLabel(
    o: ComandaOrder,
): 'MESA' | 'PICKUP' | 'DELIVERY' | 'PEDIDOSYA' {
    const t = (o.orderType || '').toUpperCase();
    const s = (o.sourceChannel || '').toUpperCase();
    if (t === 'PEDIDOSYA' || s === 'POS_PEDIDOSYA') return 'PEDIDOSYA';
    if (t === 'DELIVERY') return 'DELIVERY';
    if (o.openTabId) return 'MESA';
    return 'PICKUP';
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('es-VE', {
            timeZone: 'America/Caracas',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch {
        return '--:--';
    }
}

function getCustomerLabel(o: ComandaOrder): string {
    if (o.tabCustomerLabel) return o.tabCustomerLabel;
    if (o.customerName) return o.customerName;
    return 'Sin nombre';
}

function getLabelStyle(label: ReturnType<typeof deriveOrderTypeLabel>): string {
    switch (label) {
        case 'MESA':
            return 'bg-capsula-navy-soft text-capsula-ink';
        case 'PICKUP':
            return 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]';
        case 'DELIVERY':
            return 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]';
        case 'PEDIDOSYA':
            return 'bg-capsula-coral/10 text-capsula-coral';
    }
}

export default function ComandasDelDiaModal({ isOpen, onClose }: ComandasDelDiaModalProps) {
    const [orders, setOrders] = useState<ComandaOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    // Track por orderId qué órdenes están en cooldown post-reimpresión de comanda
    const [reprintingIds, setReprintingIds] = useState<Set<string>>(new Set());
    // Track por orderId qué órdenes ya fueron reimpresas como comanda (feedback visual)
    const [reprintedIds, setReprintedIds] = useState<Set<string>>(new Set());
    // Mismo concepto pero para recibos (tracking separado para que la UI muestre
    // ambas acciones de forma independiente)
    const [reprintingReceiptIds, setReprintingReceiptIds] = useState<Set<string>>(new Set());
    const [reprintedReceiptIds, setReprintedReceiptIds] = useState<Set<string>>(new Set());

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const res = await getComandasDelDiaAction();
            if (res.success) {
                setOrders(res.orders);
            } else {
                setErrorMsg(res.message ?? 'Error obteniendo órdenes');
                setOrders([]);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(`Error de red: ${msg}`);
            setOrders([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Cargar al abrir
    useEffect(() => {
        if (isOpen) {
            fetchOrders();
            // Reset estados visuales al abrir
            setReprintedIds(new Set());
            setReprintingIds(new Set());
            setReprintedReceiptIds(new Set());
            setReprintingReceiptIds(new Set());
            setSearch('');
        }
    }, [isOpen, fetchOrders]);

    const handleReprint = useCallback(async (order: ComandaOrder) => {
        // Cooldown: si ya está procesándose, ignorar.
        if (reprintingIds.has(order.id)) return;

        const confirmed = window.confirm(
            `¿Reimprimir comanda ${order.orderNumber}?\n\n` +
                `Cliente: ${getCustomerLabel(order)}\n` +
                `Items: ${order.items.length}\n` +
                `Total: $${order.total.toFixed(2)}\n\n` +
                `Cada click puede generar varios papeles (cocina, barra, modo espejo).\n` +
                `Solo úsalo si la comanda original no llegó.`,
        );
        if (!confirmed) return;

        setReprintingIds((prev) => new Set(prev).add(order.id));

        try {
            await enqueueKitchenCommand({
                type: 'KITCHEN',
                orderNumber: order.orderNumber,
                orderType: deriveOrderType(order),
                orderTypeLabel: deriveOrderTypeLabel(order),
                tabCode: order.tabCode ?? undefined,
                customerName: order.customerName ?? undefined,
                customerAddress: order.customerAddress ?? undefined,
                scheduledDeliveryTime: order.scheduledDeliveryTime,
                items: order.items.map((i) => ({
                    name: i.itemName,
                    quantity: i.quantity,
                    // §93: la comanda omite el padre del sub-grupo anidado (ej.
                    // ración "Pincho Mixto") — solo la selección definitiva. El
                    // recibo (abajo) sí lo muestra: lleva el precio.
                    modifiers: i.modifiers.filter((m) => !m.hideFromKitchen).map((m) => m.name),
                    notes: i.notes ?? undefined,
                    categoryName: i.categoryName ?? undefined,
                })),
                createdAt: order.createdAt,
            });
            toast.success(`Comanda ${order.orderNumber} reimprimiendo…`);
            setReprintedIds((prev) => new Set(prev).add(order.id));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Error reimprimiendo: ${msg}`);
        }

        // Cooldown 3s: el botón queda deshabilitado para evitar doble-click
        // accidental. Después se puede volver a reimprimir si hace falta.
        setTimeout(() => {
            setReprintingIds((prev) => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
            });
        }, 3000);
    }, [reprintingIds]);

    /**
     * Reimprime el recibo de pago del cliente. Replica la lógica de
     * reconstrucción de `handleReprint` de `/dashboard/sales` (page.tsx)
     * para mantener consistencia visual y de cálculo entre ambas vías.
     *
     * Para mesas (orderType=RESTAURANT con openTabId) imprime el recibo
     * a nivel orden (no se desglosa por sub-cuenta). Esta es una decisión
     * consciente: el 95% de los casos no usa sub-cuentas y el handler
     * queda simple. Si en el futuro hace falta, se agrega.
     */
    const handleReprintRecibo = useCallback(async (order: ComandaOrder) => {
        if (reprintingReceiptIds.has(order.id)) return;

        const confirmed = window.confirm(
            `¿Reimprimir recibo ${order.orderNumber}?\n\n` +
                `Cliente: ${getCustomerLabel(order)}\n` +
                `Total: $${order.total.toFixed(2)}\n\n` +
                `Solo úsalo si el cliente no recibió el ticket original.`,
        );
        if (!confirmed) return;

        setReprintingReceiptIds((prev) => new Set(prev).add(order.id));

        try {
            // Reconstrucción del payload (misma lógica que /dashboard/sales:handleReprint)
            const itemsSubtotal = order.items.reduce((s, i) => s + (i.lineTotal || 0), 0);
            const orderTypeForReceipt: 'RESTAURANT' | 'DELIVERY' =
                deriveOrderType(order) === 'DELIVERY' ? 'DELIVERY' : 'RESTAURANT';
            // Delivery fee: si es delivery y el subtotal de la orden es mayor
            // a la suma de items, ese exceso es el fee de envío.
            const deliveryFee =
                orderTypeForReceipt === 'DELIVERY' && order.subtotal != null
                    ? Math.max(0, order.subtotal - itemsSubtotal)
                    : undefined;
            // Service fee: si la orden tiene service charge a nivel tab
            // (mesa con 10%), lo pasamos al recibo.
            const serviceFee = order.serviceCharge > 0 ? order.serviceCharge : 0;
            const saleDiscount = order.discount ?? 0;
            const discountReason = saleDiscount > 0
                ? (order.discountReason || 'Descuento aplicado')
                : undefined;
            const isDivisasDiscount = order.discountType === 'DIVISAS_33';

            printReceipt({
                orderNumber: order.orderNumber,
                orderType: orderTypeForReceipt,
                date: order.createdAt,
                cashierName: order.cashierName || 'Cajera',
                customerName: order.customerName ?? undefined,
                customerPhone: order.customerPhone ?? undefined,
                customerAddress: order.customerAddress ?? undefined,
                subtotal:
                    orderTypeForReceipt === 'DELIVERY' && deliveryFee
                        ? itemsSubtotal
                        : (order.subtotal ?? itemsSubtotal),
                discount: saleDiscount,
                discountReason,
                hideDiscount: isDivisasDiscount,
                deliveryFee,
                total: order.total,
                serviceFee,
                items: order.items.map((i) => ({
                    name: i.itemName,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice ?? (i.lineTotal / (i.quantity || 1)),
                    total: i.lineTotal,
                    modifiers: i.modifiers.map((m) => m.name),
                })),
            });
            toast.success(`Recibo ${order.orderNumber} reimprimiendo…`);
            setReprintedReceiptIds((prev) => new Set(prev).add(order.id));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Error reimprimiendo recibo: ${msg}`);
        }

        // Cooldown 3s, mismo patrón que comanda
        setTimeout(() => {
            setReprintingReceiptIds((prev) => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
            });
        }, 3000);
    }, [reprintingReceiptIds]);

    const filteredOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter((o) => {
            return (
                o.orderNumber.toLowerCase().includes(q) ||
                (o.customerName ?? '').toLowerCase().includes(q) ||
                (o.tabCustomerLabel ?? '').toLowerCase().includes(q) ||
                (o.tabCode ?? '').toLowerCase().includes(q)
            );
        });
    }, [orders, search]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[70] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-capsula-ivory border border-capsula-line w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="border-b border-capsula-line p-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Printer className="h-5 w-5 text-capsula-coral" />
                        <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                            Reimprimir del día
                        </h3>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            ({filteredOrders.length}{search ? ` de ${orders.length}` : ''})
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchOrders}
                            disabled={isLoading}
                            title="Refrescar lista"
                            className="h-8 w-8 rounded-full hover:bg-capsula-navy-soft text-capsula-ink-muted hover:text-capsula-ink flex items-center justify-center disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            title="Cerrar"
                            className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center transition-colors"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="border-b border-capsula-line p-3 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-capsula-ink-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por número, cliente o mesa..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:outline-none focus:border-capsula-navy-deep transition-colors"
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3">
                    {isLoading && orders.length === 0 ? (
                        <div className="flex items-center justify-center py-16 text-capsula-ink-muted">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span className="text-sm">Cargando órdenes del día...</span>
                        </div>
                    ) : errorMsg ? (
                        <div className="bg-[#F7E3DB] dark:bg-[#3B1F14] text-[#B04A2E] dark:text-[#EFD2C8] p-4 rounded-xl text-sm">
                            {errorMsg}
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-16 text-capsula-ink-muted text-sm">
                            {search
                                ? `No hay órdenes que coincidan con "${search}".`
                                : 'No hay órdenes del día todavía.'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredOrders.map((order) => {
                                const label = deriveOrderTypeLabel(order);
                                const isReprinting = reprintingIds.has(order.id);
                                const wasReprinted = reprintedIds.has(order.id);
                                const isReprintingReceipt = reprintingReceiptIds.has(order.id);
                                const wasReprintedReceipt = reprintedReceiptIds.has(order.id);
                                return (
                                    <div
                                        key={order.id}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-capsula-line bg-capsula-ivory-surface hover:bg-capsula-ivory-alt transition-colors"
                                    >
                                        {/* Identificador + hora */}
                                        <div className="flex flex-col items-start min-w-[110px]">
                                            <span className="text-sm font-semibold text-capsula-ink tabular-nums">
                                                {order.orderNumber}
                                            </span>
                                            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                                                {formatTime(order.createdAt)}
                                            </span>
                                        </div>

                                        {/* Tipo + cliente */}
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] ${getLabelStyle(label)}`}
                                                >
                                                    {label}
                                                </span>
                                                <span className="text-[10px] text-capsula-ink-muted">
                                                    {order.items.length} item{order.items.length === 1 ? '' : 's'}
                                                </span>
                                            </div>
                                            <span className="text-sm text-capsula-ink truncate">
                                                {getCustomerLabel(order)}
                                            </span>
                                        </div>

                                        {/* Total */}
                                        <div className="text-sm font-semibold text-capsula-ink tabular-nums min-w-[60px] text-right">
                                            ${order.total.toFixed(2)}
                                        </div>

                                        {/* Botones de acción — comanda y recibo */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {/* Botón reimprimir COMANDA (cocina/barra) */}
                                            <button
                                                onClick={() => handleReprint(order)}
                                                disabled={isReprinting}
                                                title={isReprinting ? 'Reimprimiendo comanda…' : 'Reimprimir comanda de cocina/barra'}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                                    wasReprinted && !isReprinting
                                                        ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                                        : 'bg-capsula-navy-deep text-capsula-cream hover:bg-capsula-navy-deep/90'
                                                }`}
                                            >
                                                {isReprinting ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : wasReprinted ? (
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ChefHat className="h-3.5 w-3.5" />
                                                )}
                                                {isReprinting ? '...' : wasReprinted ? 'Lista' : 'Comanda'}
                                            </button>
                                            {/* Botón reimprimir RECIBO (cliente) */}
                                            <button
                                                onClick={() => handleReprintRecibo(order)}
                                                disabled={isReprintingReceipt}
                                                title={isReprintingReceipt ? 'Reimprimiendo recibo…' : 'Reimprimir recibo del cliente'}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                                    wasReprintedReceipt && !isReprintingReceipt
                                                        ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                                        : 'bg-capsula-coral text-white hover:bg-capsula-coral/90'
                                                }`}
                                            >
                                                {isReprintingReceipt ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : wasReprintedReceipt ? (
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Receipt className="h-3.5 w-3.5" />
                                                )}
                                                {isReprintingReceipt ? '...' : wasReprintedReceipt ? 'Listo' : 'Recibo'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-capsula-line p-4 shrink-0 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-capsula-ink-muted">
                        Día actual (Caracas). Botones reimprimen comanda (cocina) o recibo (cliente). Excluye anuladas.
                    </span>
                    <button
                        onClick={onClose}
                        className="pos-btn-secondary py-2 px-4 text-sm"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
