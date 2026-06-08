'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PackageX, Plus, Trash2 } from 'lucide-react';
import {
    upsertItemAvailabilityAction,
    deleteItemAvailabilityAction,
    type AgotadoRow,
} from '@/app/actions/delivery-config.actions';
import { DeliveryNav } from '../_components/delivery-nav';

export function AgotadosView({
    initialItems,
    branches,
}: {
    initialItems: AgotadoRow[];
    branches: { id: string; name: string }[];
}) {
    const router = useRouter();
    const [items, setItems] = useState(initialItems);
    const [newBranch, setNewBranch] = useState(branches[0]?.id ?? '');
    const [newLabel, setNewLabel] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;

    function run(fn: () => Promise<{ success: boolean; message?: string }>, after: () => void) {
        setError(null);
        startTransition(async () => {
            const res = await fn();
            if (!res.success) {
                setError(res.message ?? 'Error.');
                return;
            }
            after();
            router.refresh();
        });
    }

    function add() {
        const label = newLabel.trim();
        if (!newBranch || !label) return;
        run(
            () => upsertItemAvailabilityAction({ branchId: newBranch, itemLabel: label, available: false }),
            () => {
                setNewLabel('');
            },
        );
    }

    function toggle(it: AgotadoRow) {
        run(
            () => upsertItemAvailabilityAction({ branchId: it.branchId, itemLabel: it.itemLabel, available: !it.available }),
            () => setItems(prev => prev.map(x => (x.id === it.id ? { ...x, available: !x.available } : x))),
        );
    }

    function remove(id: string) {
        run(
            () => deleteItemAvailabilityAction(id),
            () => setItems(prev => prev.filter(x => x.id !== id)),
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-5">
            <DeliveryNav />
            <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl bg-capsula-navy-deep text-capsula-cream flex items-center justify-center">
                    <PackageX className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">Agotados</h1>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Ítems no disponibles por sede · alimentan el bot
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* Alta */}
            <div className="pos-panel p-4 flex flex-col sm:flex-row gap-2">
                <select
                    value={newBranch}
                    onChange={e => setNewBranch(e.target.value)}
                    className="pos-input sm:w-48"
                >
                    {branches.length === 0 && <option value="">Sin sedes</option>}
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>
                            {b.name}
                        </option>
                    ))}
                </select>
                <input
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && add()}
                    placeholder="Ej: Pepsi de lata"
                    className="pos-input flex-1"
                />
                <button
                    onClick={add}
                    disabled={pending || !newBranch || !newLabel.trim()}
                    className="pos-btn px-4 py-2 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" /> Agregar agotado
                </button>
            </div>

            {/* Lista */}
            {items.length === 0 ? (
                <div className="pos-panel p-10 flex flex-col items-center text-capsula-ink-faint">
                    <PackageX className="h-8 w-8 mb-2" />
                    <p className="text-sm">No hay ítems marcados. Todo disponible.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map(it => (
                        <div
                            key={it.id}
                            className="pos-card p-3 flex items-center justify-between gap-3"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-capsula-ink truncate">{it.itemLabel}</p>
                                <p className="text-xs text-capsula-ink-muted">{branchName(it.branchId)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => toggle(it)}
                                    disabled={pending}
                                    className={`text-[10px] font-semibold uppercase tracking-[0.1em] rounded-full px-3 py-1 disabled:opacity-50 ${
                                        it.available
                                            ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                            : 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]'
                                    }`}
                                    title="Tocar para cambiar disponibilidad"
                                >
                                    {it.available ? 'Disponible' : 'Agotado'}
                                </button>
                                <button
                                    onClick={() => remove(it.id)}
                                    disabled={pending}
                                    className="pos-btn-secondary py-1.5 px-2.5 inline-flex items-center disabled:opacity-50"
                                    title="Eliminar"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
