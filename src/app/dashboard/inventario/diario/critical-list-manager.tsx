'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, Search, X as XIcon } from 'lucide-react';
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

    useEffect(() => {
        const timer = setTimeout(() => {
            searchItems();
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    useEffect(() => {
        searchItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isCriticalForArea: newValue } : i));

        const res = await toggleItemCriticalStatusAction(item.id, newValue, areaId);
        if (!res.success) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isCriticalForArea: item.isCriticalForArea } : i));
            toast.error(res.message || 'Error actualizando item');
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-capsula-ink/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-capsula-line bg-capsula-ivory shadow-2xl">
                <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-navy-deep p-6 text-capsula-ivory">
                    <div>
                        <h2 className="font-semibold text-xl tracking-[-0.02em]">Productos Críticos</h2>
                        <p className="mt-1 text-sm text-capsula-ivory/80">
                            Configurando para: <strong>{areaName}</strong>
                        </p>
                    </div>
                    <button
                        onClick={() => { onUpdate(); onClose(); }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-capsula-ivory/80 transition-colors hover:bg-capsula-ivory/10 hover:text-capsula-ivory"
                        aria-label="Cerrar"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="border-b border-capsula-line bg-capsula-ivory-alt p-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                        <input
                            type="text"
                            placeholder="Buscar producto por nombre o SKU..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="pos-input w-full pl-10"
                            autoFocus
                        />
                    </div>
                    <p className="mt-2 text-xs text-capsula-ink-muted">
                        Los productos marcados como críticos aparecerán en el reporte diario de <strong>{areaName}</strong>. Cada área tiene su propia lista.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading && items.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-capsula-ink-muted">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    className={`flex items-center justify-between rounded-xl border p-3 transition ${
                                        item.isCriticalForArea
                                            ? 'border-[#E8D9B8] bg-[#F3EAD6]/40 dark:border-[#5a4a22] dark:bg-[#3B2F15]/40'
                                            : 'border-capsula-line hover:bg-capsula-ivory-alt'
                                    }`}
                                >
                                    <div>
                                        <p className="text-sm font-semibold tracking-[-0.01em] text-capsula-ink">{item.name}</p>
                                        <p className="font-mono text-[10px] text-capsula-ink-muted">{item.sku} • {item.category || 'Sin categoría'} • {item.baseUnit}</p>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={item.isCriticalForArea}
                                            onChange={() => handleToggle(item)}
                                        />
                                        <div className="peer h-6 w-11 rounded-full bg-capsula-line after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-capsula-line-strong after:bg-capsula-ivory after:transition-all after:content-[''] peer-checked:bg-capsula-navy-deep peer-checked:after:translate-x-full peer-checked:after:border-capsula-ivory peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-capsula-navy-deep/30"></div>
                                        <span className="ml-3 inline-flex items-center gap-1 text-sm font-semibold text-capsula-ink">
                                            {item.isCriticalForArea ? <><Check className="h-3.5 w-3.5" /> Crítico</> : 'No'}
                                        </span>
                                    </label>
                                </div>
                            ))}
                            {items.length === 0 && !loading && (
                                <div className="py-8 text-center text-capsula-ink-muted">No se encontraron productos</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end border-t border-capsula-line bg-capsula-ivory-alt p-4">
                    <button
                        onClick={() => { onUpdate(); onClose(); }}
                        className="pos-btn px-8 py-2.5"
                    >
                        Listo, volver al reporte
                    </button>
                </div>
            </div>
        </div>
    );
}
