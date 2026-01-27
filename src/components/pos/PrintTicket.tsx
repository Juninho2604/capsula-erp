'use client';

import { forwardRef } from 'react';

interface TicketItem {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    modifiers: { name: string; priceAdjustment: number }[];
    notes?: string;
}

interface TicketData {
    orderNumber: string;
    orderType: 'RESTAURANT' | 'DELIVERY';
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: TicketItem[];
    subtotal: number;
    total: number;
    paymentMethod: string;
    amountPaid: number;
    change: number;
    date: Date;
}

interface PrintTicketProps {
    data: TicketData;
}

const PrintTicket = forwardRef<HTMLDivElement, PrintTicketProps>(({ data }, ref) => {
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-VE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getPaymentMethodLabel = (method: string) => {
        switch (method) {
            case 'CASH': return 'Efectivo';
            case 'CARD': return 'Tarjeta';
            case 'TRANSFER': return 'Transferencia';
            default: return method;
        }
    };

    return (
        <div
            ref={ref}
            className="hidden print:block bg-white text-black p-4 font-mono text-sm"
            style={{ width: '80mm', maxWidth: '80mm' }}
        >
            {/* Header */}
            <div className="text-center mb-4">
                <h1 className="text-xl font-bold">SHANKLISH</h1>
                <p className="text-xs">Quesos Artesanales & Comida Libanesa</p>
                <p className="text-xs mt-1">Tu dirección aquí</p>
                <p className="text-xs">Tel: 0412-XXX-XXXX</p>
            </div>

            {/* Línea divisora */}
            <div className="border-t border-dashed border-gray-400 my-2"></div>

            {/* Info de la orden */}
            <div className="mb-3">
                <div className="flex justify-between">
                    <span className="font-bold">Orden:</span>
                    <span className="font-bold text-lg">{data.orderNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>Fecha:</span>
                    <span>{formatDate(data.date)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>Hora:</span>
                    <span>{formatTime(data.date)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>Tipo:</span>
                    <span>{data.orderType === 'RESTAURANT' ? 'Restaurante' : 'Delivery'}</span>
                </div>
            </div>

            {/* Cliente (si aplica) */}
            {(data.customerName || data.customerPhone || data.customerAddress) && (
                <>
                    <div className="border-t border-dashed border-gray-400 my-2"></div>
                    <div className="mb-3 text-xs">
                        {data.customerName && (
                            <div><span className="font-bold">Cliente:</span> {data.customerName}</div>
                        )}
                        {data.customerPhone && (
                            <div><span className="font-bold">Tel:</span> {data.customerPhone}</div>
                        )}
                        {data.customerAddress && (
                            <div><span className="font-bold">Dir:</span> {data.customerAddress}</div>
                        )}
                    </div>
                </>
            )}

            {/* Línea divisora */}
            <div className="border-t border-dashed border-gray-400 my-2"></div>

            {/* Items */}
            <div className="mb-3">
                <div className="font-bold mb-2 text-center">DETALLE DE PRODUCTOS</div>
                {data.items.map((item, idx) => (
                    <div key={idx} className="mb-2">
                        <div className="flex justify-between">
                            <span className="flex-1">
                                <span className="font-bold">{item.quantity}x</span> {item.name}
                            </span>
                            <span className="font-bold">${item.lineTotal.toFixed(2)}</span>
                        </div>
                        {item.modifiers.length > 0 && (
                            <div className="text-xs pl-4 text-gray-600">
                                {item.modifiers.map((mod, midx) => (
                                    <div key={midx}>
                                        • {mod.name}
                                        {mod.priceAdjustment > 0 && ` (+$${mod.priceAdjustment.toFixed(2)})`}
                                    </div>
                                ))}
                            </div>
                        )}
                        {item.notes && (
                            <div className="text-xs pl-4 italic text-gray-600">
                                Nota: {item.notes}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Línea divisora */}
            <div className="border-t border-dashed border-gray-400 my-2"></div>

            {/* Totales */}
            <div className="mb-3">
                <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL:</span>
                    <span>${data.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>Método de pago:</span>
                    <span>{getPaymentMethodLabel(data.paymentMethod)}</span>
                </div>
                {data.paymentMethod === 'CASH' && (
                    <>
                        <div className="flex justify-between text-xs">
                            <span>Pagó con:</span>
                            <span>${data.amountPaid.toFixed(2)}</span>
                        </div>
                        {data.change > 0 && (
                            <div className="flex justify-between font-bold">
                                <span>Cambio:</span>
                                <span>${data.change.toFixed(2)}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Línea divisora */}
            <div className="border-t border-dashed border-gray-400 my-2"></div>

            {/* Footer */}
            <div className="text-center text-xs">
                <p className="font-bold">¡Gracias por su compra!</p>
                <p>Síguenos en @shanklish</p>
                <p className="mt-2 text-[10px] text-gray-500">
                    Este documento no tiene validez fiscal
                </p>
            </div>

            {/* Espacio para corte */}
            <div className="h-8"></div>
        </div>
    );
});

PrintTicket.displayName = 'PrintTicket';

export default PrintTicket;
