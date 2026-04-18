'use client';

interface OrderItem {
    id: string;
    itemName: string;
    quantity: number;
    lineTotal: number;
    modifiers?: { name: string }[];
}

interface BillOrder {
    id: string;
    orderNumber: string;
    total: number;
    items: OrderItem[];
}

interface Props {
    orders: BillOrder[];
    runningTotal: number;
    tableName: string;
    customerLabel?: string | null;
    exchangeRate: number | null;
    onClose: () => void;
}

export function ShowBillModal({
    orders,
    runningTotal,
    tableName,
    customerLabel,
    exchangeRate,
    onClose,
}: Props) {
    const subtotal = runningTotal;
    const service = Math.round(subtotal * 0.1 * 100) / 100;
    const totalUSD = subtotal + service;
    const discountPct = 0.33;
    const netForBs = totalUSD * (1 - discountPct);
    const totalBs = exchangeRate ? netForBs * exchangeRate : null;

    return (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 text-center">
                    <h3 className="font-black text-lg text-gray-900 dark:text-white">
                        🧾 Cuenta — {tableName}
                    </h3>
                    {customerLabel && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{customerLabel}</p>
                    )}
                </div>

                {/* Items */}
                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
                    {orders.flatMap((order) =>
                        order.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-start text-sm gap-3">
                                <span className="text-gray-700 dark:text-gray-300 leading-snug">
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        x{item.quantity}
                                    </span>{' '}
                                    {item.itemName}
                                    {item.modifiers && item.modifiers.length > 0 && (
                                        <span className="text-gray-400 text-xs block pl-4">
                                            {item.modifiers.map((m) => m.name).join(' · ')}
                                        </span>
                                    )}
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white shrink-0">
                                    ${item.lineTotal.toFixed(2)}
                                </span>
                            </div>
                        ))
                    )}
                    {orders.length === 0 && (
                        <p className="text-center text-gray-400 py-4 text-sm">Sin ítems</p>
                    )}
                </div>

                {/* Totals */}
                <div className="px-5 pb-5 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>Servicio (10%)</span>
                        <span>+${service.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black border-t border-gray-200 dark:border-gray-700 pt-2 text-gray-900 dark:text-white">
                        <span>TOTAL USD</span>
                        <span>${totalUSD.toFixed(2)}</span>
                    </div>

                    {exchangeRate && totalBs !== null && (
                        <div className="mt-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-3 space-y-1.5">
                            <div className="flex justify-between text-xs text-amber-700 dark:text-amber-400">
                                <span>Descuento divisas (−33%)</span>
                                <span>−${(totalUSD * discountPct).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-amber-600 dark:text-amber-500">
                                <span>Tasa: {exchangeRate.toLocaleString('es-VE')} Bs/USD</span>
                                <span>Base ${netForBs.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-base font-black text-amber-900 dark:text-amber-300 border-t border-amber-200 dark:border-amber-600/50 pt-1.5">
                                <span>TOTAL Bs</span>
                                <span>
                                    Bs{' '}
                                    {totalBs.toLocaleString('es-VE', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full mt-2 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
