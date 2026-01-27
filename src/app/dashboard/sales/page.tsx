'use client';

import { useState, useEffect } from 'react';
import { getSalesHistoryAction, getDailyZReportAction, type ZReportData } from '@/app/actions/sales.actions';

export default function SalesHistoryPage() {
    const [sales, setSales] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [zReport, setZReport] = useState<ZReportData | null>(null);
    const [showZReport, setShowZReport] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const result = await getSalesHistoryAction();
        if (result.success && result.data) {
            setSales(result.data);
        }
        setIsLoading(false);
    };

    const handleGenerateZReport = async () => {
        const result = await getDailyZReportAction();
        if (result.success && result.data) {
            setZReport(result.data);
            setShowZReport(true);
        } else {
            alert('Error generando reporte');
        }
    };

    const getPaymentBadge = (method: string) => {
        switch (method) {
            case 'CASH': return <span className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs font-bold">EFECTIVO</span>;
            case 'CARD': return <span className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs font-bold">PUNTO</span>;
            case 'TRANSFER': return <span className="bg-indigo-900 text-indigo-300 px-2 py-1 rounded text-xs font-bold">TRANSFER</span>;
            case 'MOBILE_PAY': return <span className="bg-purple-900 text-purple-300 px-2 py-1 rounded text-xs font-bold">PAGO MÓVIL</span>;
            default: return <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-bold">{method}</span>;
        }
    };

    const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;

    if (isLoading) return <div className="p-8 text-center text-white">Cargando historial...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Historial de Ventas
                    </h1>
                    <p className="text-gray-400">Registro de transacciones y cierres</p>
                </div>
                <button
                    onClick={handleGenerateZReport}
                    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/20 flex items-center gap-2"
                >
                    🖨️ REPORTE "Z" (CIERRE)
                </button>
            </div>

            {/* Tabla de Ventas */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900/50 text-gray-400 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Orden #</th>
                            <th className="p-4">Hora</th>
                            <th className="p-4">Cliente</th>
                            <th className="p-4">Método</th>
                            <th className="p-4 text-right">Total</th>
                            <th className="p-4">Descuento / Auth</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 font-mono text-sm">
                        {sales.map(sale => (
                            <tr key={sale.id} className="hover:bg-gray-700/30 transition-colors">
                                <td className="p-4 font-bold text-blue-300">{sale.orderNumber}</td>
                                <td className="p-4 text-gray-400">
                                    {sale.createdAt ? new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                                <td className="p-4 font-sans text-gray-300 truncate max-w-[150px]">
                                    {sale.customerName || 'Cliente General'}
                                </td>
                                <td className="p-4">
                                    {getPaymentBadge(sale.paymentMethod)}
                                </td>
                                <td className="p-4 text-right font-bold text-white text-base">
                                    {formatMoney(sale.total)}
                                </td>
                                <td className="p-4 font-sans">
                                    {sale.discount > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {sale.discountType === 'DIVISAS_33' && (
                                                <span className="text-blue-400 text-xs">📉 Divisas (-{formatMoney(sale.discount)})</span>
                                            )}
                                            {sale.discountType === 'CORTESIA_100' && (
                                                <span className="text-purple-400 text-xs font-bold">🎁 CORTESÍA</span>
                                            )}
                                            {sale.authorizedById && (
                                                <span className="text-green-500 text-[10px] bg-green-900/30 px-1 rounded w-fit">
                                                    Auth: {sale.authorizedBy?.firstName}
                                                </span>
                                            )}
                                        </div>
                                    ) : <span className="text-gray-600">-</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Reporte Z */}
            {showZReport && zReport && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white text-black rounded-lg w-full max-w-sm p-8 font-mono shadow-2xl relative">
                        <button onClick={() => setShowZReport(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-2xl font-bold">×</button>

                        <div className="text-center mb-6 border-b-2 border-dashed border-black pb-4">
                            <h2 className="text-2xl font-black">REPORTE Z</h2>
                            <p className="text-sm">SHANKLISH CARACAS</p>
                            <p className="text-sm">{new Date().toLocaleString()}</p>
                            <p className="text-sm mt-1 font-bold">CIERRE DE CAJA DIARIO</p>
                        </div>

                        <div className="space-y-1 mb-4 border-b-2 border-dashed border-black pb-4">
                            <div className="flex justify-between">
                                <span>VENTAS BRUTAS</span>
                                <span>{formatMoney(zReport.grossTotal)}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                                <span>(-) DESCUENTOS</span>
                                <span>-{formatMoney(zReport.totalDiscounts)}</span>
                            </div>
                            {zReport.discountBreakdown.divisas > 0 && (
                                <div className="flex justify-between text-xs text-gray-500 pl-4">
                                    <span>Divisas (33%)</span>
                                    <span>-{formatMoney(zReport.discountBreakdown.divisas)}</span>
                                </div>
                            )}
                            {zReport.discountBreakdown.cortesias > 0 && (
                                <div className="flex justify-between text-xs text-gray-500 pl-4">
                                    <span>Cortesías (100%)</span>
                                    <span>-{formatMoney(zReport.discountBreakdown.cortesias)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-xl mt-2 pt-2 border-t border-gray-300">
                                <span>VENTA NETA</span>
                                <span>{formatMoney(zReport.netTotal)}</span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="font-bold underline mb-2">ARQUEO DE CAJA</h3>
                            <div className="flex justify-between">
                                <span>EFECTIVO (CAJA)</span>
                                <span className="font-bold">{formatMoney(zReport.paymentBreakdown.cash)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>PUNTO DE VENTA</span>
                                <span>{formatMoney(zReport.paymentBreakdown.card)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>PAGO MÓVIL</span>
                                <span>{formatMoney(zReport.paymentBreakdown.mobile)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>TRANSFERENCIA</span>
                                <span>{formatMoney(zReport.paymentBreakdown.transfer)}</span>
                            </div>
                        </div>

                        <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-300">
                            <p>Fin del Reporte</p>
                            <p>Pedidos Totales: {zReport.totalOrders}</p>
                        </div>

                        <button onClick={() => window.print()} className="w-full bg-black text-white py-3 rounded mt-6 font-bold hover:bg-gray-800 no-print">
                            IMPRIMIR COMPROBANTE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
