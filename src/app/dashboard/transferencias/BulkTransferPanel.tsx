'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import {
    getCategoriesForTransferAction,
    previewBulkTransferAction,
    executeBulkTransferAction
} from '@/app/actions/requisition.actions';
import { formatNumber, cn } from '@/lib/utils';
import { Trash2, Zap, Loader2, CheckCircle2, AlertOctagon, Info, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Area {
    id: string;
    name: string;
}

interface PreviewItem {
    id: string;
    name: string;
    currentStock: number;
    unit: string;
}

interface Props {
    areasList: Area[];
}

const inputClass =
    'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink outline-none transition-colors focus:border-capsula-navy-deep';
const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';

export default function BulkTransferPanel({ areasList }: Props) {
    const { user } = useAuthStore();
    const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [sourceAreaId, setSourceAreaId] = useState('');
    const [targetAreaId, setTargetAreaId] = useState('');
    const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
    const [excludedIds, setExcludedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    useEffect(() => {
        getCategoriesForTransferAction().then(res => {
            if (res.success && res.categories) {
                setCategories(res.categories);
            }
        });
    }, []);

    useEffect(() => {
        if (selectedCategory && sourceAreaId) {
            setIsLoading(true);
            previewBulkTransferAction(selectedCategory, sourceAreaId).then(res => {
                if (res.success && res.items) {
                    setPreviewItems(res.items);
                    setMessage({ type: 'info', text: res.message });
                } else {
                    setPreviewItems([]);
                    setMessage({ type: 'error', text: res.message });
                }
                setIsLoading(false);
            });
        } else {
            setPreviewItems([]);
            setExcludedIds([]);
            setMessage(null);
        }
    }, [selectedCategory, sourceAreaId]);

    const handleExecuteTransfer = async () => {
        if (!selectedCategory || !sourceAreaId || !targetAreaId) {
            setMessage({ type: 'error', text: 'Selecciona categoría, origen y destino' });
            return;
        }

        if (sourceAreaId === targetAreaId) {
            setMessage({ type: 'error', text: 'Origen y destino no pueden ser iguales' });
            return;
        }

        if (!confirm(`¿Confirmas transferir TODO el stock de "${selectedCategory}" al destino seleccionado?`)) {
            return;
        }

        setIsExecuting(true);
        const res = await executeBulkTransferAction(
            selectedCategory,
            sourceAreaId,
            targetAreaId,
            user?.id || '',
            excludedIds
        );

        if (res.success) {
            setMessage({ type: 'success', text: res.message });
            setPreviewItems([]);
            setSelectedCategory('');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            setMessage({ type: 'error', text: res.message });
        }
        setIsExecuting(false);
    };

    const MessageIcon =
        message?.type === 'success' ? CheckCircle2 :
        message?.type === 'error' ? AlertOctagon : Info;
    const messageStyles =
        message?.type === 'success' ? 'border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]' :
        message?.type === 'error' ? 'border-[#EFD2C8] bg-[#F7E3DB] text-[#B04A2E]' :
        'border-[#D1DCE9] bg-[#E6ECF4] text-[#2A4060]';

    const activeCount = previewItems.length - excludedIds.length;

    return (
        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">
                        Transferencias
                    </div>
                    <h3 className="flex items-center gap-2 font-heading text-[24px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                        <Zap className="h-5 w-5 text-capsula-coral" strokeWidth={1.5} /> Transferencia rápida
                    </h3>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        Mueve stock por categoría con un solo toque.
                    </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory">
                    <Rocket className="h-5 w-5 text-capsula-navy" strokeWidth={1.5} />
                </div>
            </div>

            {/* Selectores */}
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <div>
                    <label className={labelClass}>Categoría</label>
                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Seleccionar…</option>
                        {categories.map(cat => (
                            <option key={cat.name} value={cat.name}>
                                {cat.name} ({cat.count})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Desde (Origen)</label>
                    <select
                        value={sourceAreaId}
                        onChange={e => setSourceAreaId(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Seleccionar…</option>
                        {areasList.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Hacia (Destino)</label>
                    <select
                        value={targetAreaId}
                        onChange={e => setTargetAreaId(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Seleccionar…</option>
                        {areasList.filter(a => a.id !== sourceAreaId).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Preview */}
            {isLoading ? (
                <div className="py-12 text-center">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-capsula-navy" strokeWidth={1.5} />
                    <p className="text-[13px] font-medium text-capsula-ink-soft">Preparando lotes…</p>
                </div>
            ) : previewItems.length > 0 ? (
                <div className="mb-6 max-h-64 overflow-y-auto rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface">
                    <table className="w-full border-collapse text-[13px]">
                        <thead className="sticky top-0 bg-capsula-ivory">
                            <tr className="border-b border-capsula-line">
                                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Producto</th>
                                <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Stock</th>
                                <th className="w-12 px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {previewItems.filter(i => !excludedIds.includes(i.id)).map(item => (
                                <tr key={item.id} className="border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory">
                                    <td className="px-5 py-3 text-capsula-ink">{item.name}</td>
                                    <td className="px-5 py-3 text-right font-mono text-[12.5px] font-semibold text-capsula-navy">
                                        {formatNumber(item.currentStock)} <span className="text-capsula-ink-muted">{item.unit}</span>
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        <button
                                            onClick={() => setExcludedIds([...excludedIds, item.id])}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {/* Message */}
            {message && (
                <div className={cn(
                    'mb-6 flex items-center gap-3 rounded-[var(--radius)] border px-4 py-3 text-[13px] font-medium',
                    messageStyles,
                )}>
                    <MessageIcon className="h-4 w-4" strokeWidth={1.5} />
                    {message.text}
                </div>
            )}

            {/* Botón de ejecución */}
            <Button
                onClick={handleExecuteTransfer}
                disabled={isExecuting || previewItems.length === 0 || !targetAreaId}
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isExecuting}
            >
                {isExecuting ? (
                    'Procesando transferencia…'
                ) : (
                    <>
                        <Rocket className="h-4 w-4" strokeWidth={1.5} />
                        Confirmar movimiento de {activeCount} {activeCount === 1 ? 'ítem' : 'ítems'}
                    </>
                )}
            </Button>
        </div>
    );
}
