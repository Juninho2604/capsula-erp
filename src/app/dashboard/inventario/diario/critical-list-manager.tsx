'use client';

import { useState, useEffect } from 'react';
import { searchItemsForCriticalListAction, toggleItemCriticalStatusAction } from '@/app/actions/inventory-daily.actions';
import { toast } from 'react-hot-toast';

interface Props {
    onClose: () => void;
    onUpdate: () => void;
}

export default function CriticalListManager({ onClose, onUpdate }: Props) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Buscar al escribir (debounce manual simple)
    useEffect(() => {
        const timer = setTimeout(() => {
            searchItems();
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    // Buscar inicial
    useEffect(() => {
        searchItems();
    }, []);

    async function searchItems() {
        setLoading(true);
        const res = await searchItemsForCriticalListAction(query);
        if (res.success) {
            setItems(res.data);
        }
        setLoading(false);
    }

    async function handleToggle(item: any) {
        // Optimistic update
        const newValue = !item.isCritical;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isCritical: newValue } : i));

        const res = await toggleItemCriticalStatusAction(item.id, newValue);
        if (!res.success) {
            // Revert
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isCritical: item.isCritical } : i));
            toast.error(res.message || 'Error actualizando item');
        } else {
            // Success silent
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold dark:text-white">Gestionar Productos Críticos</h2>
                    <button onClick={() => { onUpdate(); onClose(); }} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                </div>

                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <input
                        type="text"
                        placeholder="Buscar producto por nombre..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Marque los productos que desea que aparezcan en el Cierre Diario.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading && items.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">Cargando...</div>
                    ) : (
                        <div className="space-y-2">
                            {items.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 transition">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                                        <p className="text-xs text-gray-500">{item.sku} • {item.category || 'Sin categoría'}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={item.isCritical}
                                            onChange={() => handleToggle(item)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                                            {item.isCritical ? 'Crítico' : 'No'}
                                        </span>
                                    </label>
                                </div>
                            ))}
                            {items.length === 0 && !loading && (
                                <div className="text-center py-8 text-gray-500">No se encontraron productos</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                        onClick={() => { onUpdate(); onClose(); }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
                    >
                        Listo, volver al reporte
                    </button>
                </div>
            </div>
        </div>
    );
}
