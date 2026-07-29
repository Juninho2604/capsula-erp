'use client';

/**
 * Tabla de costos actuales con edición manual por ítem (§143).
 *
 * Pedido de Christian: "que en ese módulo yo pueda ir actualizando los costos
 * manualmente — actualmente solo deja por carga masiva". El lapicito abre un
 * mini-editor en la fila; guarda vía updateItemCostAction (historial de costos
 * con autor y motivo — mismo mecanismo que la carga masiva).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Pencil, Check, X as XIcon, Loader2, Search } from 'lucide-react';
import { updateItemCostAction } from '@/app/actions/cost.actions';

export interface CostRow {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    baseUnit: string;
    currentCost: number | null;
    currency: string | null;
}

interface Props {
    items: CostRow[];
    canEdit: boolean;
}

export function CurrentCostsTable({ items, canEdit }: Props) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [costStr, setCostStr] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    const filtered = useMemo(() => {
        let rows = items;
        const q = search.trim().toLowerCase();
        if (q) rows = rows.filter(i => `${i.name} ${i.sku ?? ''} ${i.category ?? ''}`.toLowerCase().includes(q));
        if (onlyMissing) rows = rows.filter(i => i.currentCost === null);
        return rows;
    }, [items, search, onlyMissing]);

    function startEdit(row: CostRow) {
        setEditingId(row.id);
        setCostStr(row.currentCost !== null ? String(row.currentCost) : '');
        setReason('');
    }

    async function save(row: CostRow) {
        const parsed = Number(costStr.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed < 0) {
            toast.error('Escribe un costo válido');
            return;
        }
        setSaving(true);
        const res = await updateItemCostAction(row.id, parsed, 'USD', reason.trim() || undefined);
        setSaving(false);
        if (!res.success) { toast.error(res.message); return; }
        toast.success(`Costo de ${row.name} actualizado`);
        setEditingId(null);
        router.refresh();
    }

    return (
        <div className="overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory">
            <div className="flex flex-wrap items-center gap-3 border-b border-capsula-line p-4">
                <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                    Costos Actuales de Materias Primas
                </h3>
                <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar insumo…"
                        className="pos-input w-full pl-10"
                    />
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-capsula-ink">
                    <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} className="h-4 w-4" />
                    Solo sin precio
                </label>
            </div>
            <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-capsula-ivory-alt">
                        <tr>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Producto</th>
                            <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted sm:table-cell">SKU</th>
                            <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted md:table-cell">Categoría</th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Unidad</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Costo (USD)</th>
                            {canEdit && <th className="w-12 px-2 py-3" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-capsula-line">
                        {filtered.map(item => {
                            const isEditing = editingId === item.id;
                            return (
                                <tr key={item.id} className="hover:bg-capsula-ivory-alt/60">
                                    <td className="px-4 py-3 font-medium text-capsula-ink">{item.name}</td>
                                    <td className="hidden px-4 py-3 font-mono text-xs text-capsula-ink-muted sm:table-cell">{item.sku || '—'}</td>
                                    <td className="hidden px-4 py-3 text-capsula-ink-muted md:table-cell">{item.category || '—'}</td>
                                    <td className="px-4 py-3 text-capsula-ink-muted">{item.baseUnit}</td>
                                    <td className="px-4 py-3 text-right">
                                        {isEditing ? (
                                            <div className="flex flex-col items-end gap-1.5">
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="0.01"
                                                    min="0"
                                                    value={costStr}
                                                    onChange={e => setCostStr(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') void save(item); if (e.key === 'Escape') setEditingId(null); }}
                                                    aria-label={`Nuevo costo de ${item.name}`}
                                                    className="w-28 rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1.5 text-right font-semibold tabular-nums text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                                />
                                                <input
                                                    value={reason}
                                                    onChange={e => setReason(e.target.value)}
                                                    placeholder="Motivo (opcional)"
                                                    className="w-44 rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1 text-xs text-capsula-ink placeholder:text-capsula-ink-faint focus:border-capsula-navy-deep focus:outline-none"
                                                />
                                            </div>
                                        ) : item.currentCost !== null ? (
                                            <span className="font-mono font-semibold tabular-nums text-capsula-ink">
                                                ${item.currentCost.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="rounded bg-[#F3EAD6] px-1.5 py-0.5 text-xs text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">Sin precio</span>
                                        )}
                                    </td>
                                    {canEdit && (
                                        <td className="px-2 py-3 text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => void save(item)}
                                                        disabled={saving}
                                                        aria-label="Guardar costo"
                                                        className="rounded-lg p-1.5 text-[#2F6B4E] hover:bg-[#E5EDE7] disabled:opacity-50 dark:text-[#6FB88F] dark:hover:bg-[#1E3B2C]"
                                                    >
                                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        disabled={saving}
                                                        aria-label="Cancelar edición"
                                                        className="rounded-lg p-1.5 text-capsula-ink-muted hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                    >
                                                        <XIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startEdit(item)}
                                                    aria-label={`Editar costo de ${item.name}`}
                                                    title="Editar costo"
                                                    className="rounded-lg p-1.5 text-capsula-ink-muted hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={canEdit ? 6 : 5} className="px-4 py-10 text-center text-capsula-ink-muted">
                                    Sin insumos que coincidan con el filtro.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
