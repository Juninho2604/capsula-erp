'use client';

import { useState, useEffect } from 'react';
import { getDailyInventoryAction, saveDailyInventoryCountsAction, closeDailyInventoryAction } from '@/app/actions/inventory-daily.actions';
import { toast } from 'react-hot-toast';
import CriticalListManager from './critical-list-manager';

interface Props {
    initialAreas: any[];
}

export default function DailyInventoryManager({ initialAreas }: Props) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedArea, setSelectedArea] = useState(initialAreas[0]?.id || '');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [showConfig, setShowConfig] = useState(false);

    // Cargar datos al cambiar fecha o área
    useEffect(() => {
        if (!selectedArea) return;
        loadData();
    }, [selectedDate, selectedArea]);

    async function loadData() {
        setLoading(true);
        try {
            const res = await getDailyInventoryAction(selectedDate, selectedArea);
            if (res.success && res.data) {
                setData(res.data);
                setItems(res.data.items);
                setHasChanges(false);
            } else {
                toast.error('No se pudo cargar el inventario');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    const handleInputChange = (id: string, field: 'initialCount' | 'finalCount', value: string) => {
        const numValue = parseFloat(value) || 0;
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: numValue };
            }
            return item;
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!data) return;
        setLoading(true);
        const promise = saveDailyInventoryCountsAction(data.id, items);
        try {
            const res = await promise;
            if (res.success) {
                toast.success('Guardado correctamente');
                setHasChanges(false);
                // No recargamos todo para permitir seguir editando rápido
            } else {
                toast.error('Error al guardar');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCloseDay = async () => {
        if (!data) return;
        if (!confirm('¿Seguro que desea CERRAR el inventario de este día? Una vez cerrado no podrá editar los conteos.')) return;

        setLoading(true);
        try {
            // Primero guardar cambios pendientes
            if (hasChanges) await saveDailyInventoryCountsAction(data.id, items);

            const res = await closeDailyInventoryAction(data.id);
            if (res.success) {
                toast.success('Día cerrado exitosamente');
                loadData(); // Recargar para ver estado cerrado
            } else {
                toast.error('Error al cerrar');
            }
        } finally {
            setLoading(false);
        }
    };

    const isClosed = data?.status === 'CLOSED';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[calc(100vh-12rem)]">

            {/* Modal de Configuración */}
            {showConfig && <CriticalListManager onClose={() => setShowConfig(false)} onUpdate={loadData} />}

            {/* Controles Superiores */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Área / Almacén</label>
                        <select
                            value={selectedArea}
                            onChange={e => setSelectedArea(e.target.value)}
                            className="rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-sm min-w-[200px]"
                        >
                            {initialAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowConfig(true)}
                        className="ml-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                        title="Seleccionar qué productos aparecen en el reporte"
                    >
                        ⚙️ Lista Crítica
                    </button>
                </div>

                <div className="flex gap-2 items-center">
                    {data?.status === 'DRAFT' && <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">BORRADOR</span>}
                    {data?.status === 'CLOSED' && <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">CERRADO</span>}

                    {!isClosed && (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={!hasChanges || loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50 hover:bg-blue-700 transition"
                            >
                                {loading ? '...' : (hasChanges ? 'Guardar Cambios' : 'Guardado')}
                            </button>
                            <button
                                onClick={handleCloseDay}
                                disabled={loading}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold disabled:opacity-50 hover:bg-green-700 transition"
                            >
                                ✅ Cerrar Día
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* TABLA CON SCROLL */}
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 relative">
                {loading && !items.length ? (
                    <div className="p-10 text-center text-gray-500">Cargando datos...</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0 z-10 shadow-sm font-semibold text-gray-600 dark:text-gray-300">
                            <tr>
                                <th className="px-4 py-3 min-w-[200px]">Item Crítico</th>
                                <th className="px-4 py-3 text-center w-24 bg-blue-50/50 dark:bg-blue-900/10">Inicial (AM)</th>
                                <th className="px-4 py-3 text-right hidden md:table-cell">Sistema (Teórico)</th>
                                <th className="px-4 py-3 text-center w-24 bg-green-50/50 dark:bg-green-900/10">Final (PM)</th>
                                <th className="px-4 py-3 text-right bg-gray-50 dark:bg-gray-800">Variación</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No hay items críticos configurados.
                                        <br />
                                        <button onClick={() => setShowConfig(true)} className="text-blue-600 hover:underline mt-2">
                                            Configurar Lista de Productos
                                        </button>
                                    </td>
                                </tr>
                            ) : items.map(item => {
                                const theoretical = item.theoreticalStock || 0;
                                const variance = (item.finalCount || 0) - theoretical;
                                const isNegativeVariance = variance < -0.01;

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-800 dark:text-gray-200">{item.inventoryItem.name}</div>
                                            <div className="text-xs text-gray-400">{item.inventoryItem.sku} • {item.unit}</div>
                                        </td>

                                        {/* INICIAL */}
                                        <td className="px-4 py-3 text-center bg-blue-50/30 dark:bg-blue-900/5">
                                            <input
                                                type="number"
                                                disabled={isClosed}
                                                value={item.initialCount}
                                                onChange={e => handleInputChange(item.id, 'initialCount', e.target.value)}
                                                className="w-20 text-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded py-1 px-1 focus:ring-2 focus:ring-blue-500 font-medium"
                                                onFocus={e => e.target.select()}
                                            />
                                        </td>

                                        {/* TEÓRICO (Readonly) */}
                                        <td className="px-4 py-3 text-right font-mono text-gray-500 hidden md:table-cell">
                                            {theoretical.toFixed(2)}
                                        </td>

                                        {/* FINAL */}
                                        <td className="px-4 py-3 text-center bg-green-50/30 dark:bg-green-900/5">
                                            <input
                                                type="number"
                                                disabled={isClosed}
                                                value={item.finalCount}
                                                onChange={e => handleInputChange(item.id, 'finalCount', e.target.value)}
                                                className="w-20 text-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded py-1 px-1 focus:ring-2 focus:ring-green-500 font-bold text-gray-800 dark:text-white"
                                                onFocus={e => e.target.select()}
                                            />
                                        </td>

                                        {/* VARIACIÓN */}
                                        <td className="px-4 py-3 text-right font-mono font-bold bg-gray-50 dark:bg-gray-800">
                                            <span className={isNegativeVariance ? 'text-red-500' : (variance > 0.01 ? 'text-blue-500' : 'text-gray-400')}>
                                                {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 text-center">
                Solo se muestran items marcados como críticos. Use el engranaje para modificar la lista.
            </div>
        </div>
    );
}
