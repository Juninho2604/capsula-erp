'use client';

import { useState, useEffect } from 'react';
import { searchItemsForCriticalListAction, toggleItemCriticalStatusAction } from '@/app/actions/inventory-daily.actions';
import { toast } from 'react-hot-toast';

interface Props {
    areaId: string;
    areaName: string;
    onClose: () => void;
    onUpdate: () => void;
}

export default function CriticalListManager({ areaId, areaName, onClose, onUpdate }: Props) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Buscar al escribir (debounce)
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
        const res = await searchItemsForCriticalListAction(query, areaId);
        if (res.success) {
            setItems(res.data);
        }
        setLoading(false);
    }

    async function handleToggle(item: any) {
        const newValue = !item.isCriticalForArea;
        // Optimistic update
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isCriticalForArea: newValue } : i));

        const res = await toggleItemCriticalStatusAction(item.id, newValue, areaId);
        if (!res.success) {
            // Revert
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isCriticalForArea: item.isCriticalForArea } : i));
            toast.error(res.message || 'Error actualizando item');
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-capsula-ivory-surface rounded-[var(--radius)] shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-capsula-line">
                <div className="p-6 border-b border-capsula-line bg-capsula-navy-deep text-capsula-ivory-surface rounded-t-[var(--radius)] flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">⚙️ Productos Críticos</h2>
                        <p className="text-capsula-ivory-surface/80 text-sm mt-1">Configurando para: <strong>{areaName}</strong></p>
                    </div>
                    <button onClick={() => { onUpdate(); onClose(); }} className="text-capsula-ivory-surface hover:text-capsula-ivory-alt text-2xl">×</button>
                </div>

                <div className="p-4 border-b border-capsula-line bg-capsula-ivory-alt/50">
                    <input
                        type="text"
                        placeholder="Buscar producto por nombre o SKU..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full rounded-xl border border-capsula-line bg-capsula-ivory-surface px-4 py-2.5 focus:ring-2 focus:ring-capsula-navy-deep text-capsula-ink font-medium"
                        autoFocus
                    />
                    <p className="text-xs text-capsula-ink-soft mt-2">
                        Los productos marcados como críticos aparecerán en el reporte diario de <strong>{areaName}</strong>. Cada área tiene su propia lista.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading && items.length === 0 ? (
                        <div className="text-center py-8 text-capsula-ink-soft">Cargando...</div>
                    ) : (
                        <div className="space-y-2">
                            {items.map(item => (
                                <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${item.isCriticalForArea ? 'border-[#946A1C]/30 bg-[#F3EAD6]/40' : 'border-capsula-line hover:bg-capsula-ivory-alt/40'}`}>
                                    <div>
                                        <p className="font-bold text-capsula-navy-deep text-sm">{item.name}</p>
                                        <p className="text-[10px] text-capsula-ink-soft font-mono">{item.sku} • {item.category || 'Sin categoría'} • {item.baseUnit}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={item.isCriticalForArea}
                                            onChange={() => handleToggle(item)}
                                        />
                                        <div className="w-11 h-6 bg-capsula-line peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-capsula-navy-deep rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-capsula-ivory-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-capsula-ivory-surface after:border-capsula-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#946A1C]"></div>
                                        <span className="ml-3 text-sm font-bold text-capsula-ink">
                                            {item.isCriticalForArea ? '✔ Crítico' : 'No'}
                                        </span>
                                    </label>
                                </div>
                            ))}
                            {items.length === 0 && !loading && (
                                <div className="text-center py-8 text-capsula-ink-soft">No se encontraron productos</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-capsula-line bg-capsula-ivory-alt/50 flex justify-end rounded-b-2xl">
                    <button
                        onClick={() => { onUpdate(); onClose(); }}
                        className="px-8 py-2.5 bg-capsula-navy-deep text-capsula-ivory-surface rounded-[var(--radius)] font-medium hover:bg-capsula-navy-ink transition shadow-cap-soft"
                    >
                        Listo, volver al reporte
                    </button>
                </div>
            </div>
        </div>
    );
}
