'use client';

import { useState, useMemo } from 'react';
import {
    Tag, Plus, Pencil, Trash2, Check, X as XIcon, Clock, CalendarDays, Percent, DollarSign, AlertTriangle, Power,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    createPromotionAction,
    updatePromotionAction,
    togglePromotionAction,
    deletePromotionAction,
    type PromotionDTO,
    type PromotionInput,
} from '@/app/actions/promotions.actions';
import { toggleFeatureFlagAction } from '@/app/actions/feature-flags.actions';

export interface MenuCategoryLite { id: string; name: string; }
export interface MenuItemLite { id: string; name: string; categoryId: string; price: number; }

interface Props {
    initialPromotions: PromotionDTO[];
    categories: MenuCategoryLite[];
    items: MenuItemLite[];
    promotionsEnabled: boolean;
    canToggleFlag: boolean;
}

const DAYS = [
    { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mié' },
    { n: 4, label: 'Jue' }, { n: 5, label: 'Vie' }, { n: 6, label: 'Sáb' }, { n: 0, label: 'Dom' },
];

function emptyDraft(): PromotionInput {
    return {
        name: '',
        description: '',
        discountType: 'PERCENT',
        discountValue: 10,
        maxDiscountPerUnit: null,
        applicableCategoryIds: [],
        applicableItemIds: [],
        daysOfWeek: [],
        startTime: '',
        endTime: '',
        startDate: null,
        endDate: null,
        priority: 0,
        isActive: true,
    };
}

function dtoToDraft(p: PromotionDTO): PromotionInput {
    return {
        name: p.name,
        description: p.description ?? '',
        discountType: p.discountType,
        discountValue: p.discountValue,
        maxDiscountPerUnit: p.maxDiscountPerUnit,
        applicableCategoryIds: p.applicableCategoryIds,
        applicableItemIds: p.applicableItemIds,
        daysOfWeek: p.daysOfWeek,
        startTime: p.startTime ?? '',
        endTime: p.endTime ?? '',
        startDate: p.startDate ? p.startDate.slice(0, 10) : null,
        endDate: p.endDate ? p.endDate.slice(0, 10) : null,
        priority: p.priority,
        isActive: p.isActive,
    };
}

function scopeLabel(p: PromotionDTO, categories: MenuCategoryLite[], items: MenuItemLite[]): string {
    if (p.applicableCategoryIds.length === 0 && p.applicableItemIds.length === 0) return 'Todo el menú';
    const parts: string[] = [];
    if (p.applicableCategoryIds.length) {
        const names = p.applicableCategoryIds.map(id => categories.find(c => c.id === id)?.name ?? '—');
        parts.push(names.join(', '));
    }
    if (p.applicableItemIds.length) {
        parts.push(`${p.applicableItemIds.length} item(s)`);
    }
    return parts.join(' + ');
}

function timeLabel(p: PromotionDTO): string {
    const days = p.daysOfWeek.length
        ? p.daysOfWeek.map(n => DAYS.find(d => d.n === n)?.label ?? '').join(' ')
        : 'Todos los días';
    const hours = p.startTime && p.endTime ? `${p.startTime}–${p.endTime}` : 'Todo el día';
    return `${days} · ${hours}`;
}

export function PromocionesView({ initialPromotions, categories, items, promotionsEnabled, canToggleFlag }: Props) {
    const [promotions, setPromotions] = useState<PromotionDTO[]>(initialPromotions);
    const [enabled, setEnabled] = useState(promotionsEnabled);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<PromotionInput>(emptyDraft());
    const [saving, setSaving] = useState(false);
    const [flagBusy, setFlagBusy] = useState(false);

    const itemsByCategory = useMemo(() => {
        const map = new Map<string, MenuItemLite[]>();
        for (const it of items) {
            const arr = map.get(it.categoryId) ?? [];
            arr.push(it);
            map.set(it.categoryId, arr);
        }
        return map;
    }, [items]);

    function openCreate() {
        setEditingId(null);
        setDraft(emptyDraft());
        setModalOpen(true);
    }
    function openEdit(p: PromotionDTO) {
        setEditingId(p.id);
        setDraft(dtoToDraft(p));
        setModalOpen(true);
    }

    async function handleToggleFlag() {
        if (!canToggleFlag) return;
        const next = !enabled;
        setEnabled(next);
        setFlagBusy(true);
        const res = await toggleFeatureFlagAction('promotionsEnabled', next);
        setFlagBusy(false);
        if (!res.success) {
            setEnabled(!next);
            toast.error(res.message ?? 'No se pudo cambiar el estado.');
        } else {
            toast.success(next ? 'Promociones activadas' : 'Promociones desactivadas');
        }
    }

    async function handleSave() {
        setSaving(true);
        const res = editingId
            ? await updatePromotionAction(editingId, draft)
            : await createPromotionAction(draft);
        setSaving(false);
        if (!res.success) {
            toast.error(res.message ?? 'Error al guardar.');
            return;
        }
        toast.success(editingId ? 'Promoción actualizada' : 'Promoción creada');
        setModalOpen(false);
        // Refrescar lista desde el servidor vía router refresh sería ideal;
        // por simplicidad optimista, reconstruimos el DTO local.
        window.location.reload();
    }

    async function handleToggle(p: PromotionDTO) {
        const next = !p.isActive;
        setPromotions(prev => prev.map(x => (x.id === p.id ? { ...x, isActive: next } : x)));
        const res = await togglePromotionAction(p.id, next);
        if (!res.success) {
            setPromotions(prev => prev.map(x => (x.id === p.id ? { ...x, isActive: !next } : x)));
            toast.error(res.message ?? 'Error.');
        }
    }

    async function handleDelete(p: PromotionDTO) {
        if (!confirm(`¿Eliminar la promoción "${p.name}"?`)) return;
        const res = await deletePromotionAction(p.id);
        if (!res.success) {
            toast.error(res.message ?? 'Error.');
            return;
        }
        setPromotions(prev => prev.filter(x => x.id !== p.id));
        toast.success('Promoción eliminada');
    }

    function toggleDay(n: number) {
        setDraft(d => ({
            ...d,
            daysOfWeek: d.daysOfWeek?.includes(n)
                ? d.daysOfWeek.filter(x => x !== n)
                : [...(d.daysOfWeek ?? []), n],
        }));
    }
    function toggleCategory(id: string) {
        setDraft(d => ({
            ...d,
            applicableCategoryIds: d.applicableCategoryIds?.includes(id)
                ? d.applicableCategoryIds.filter(x => x !== id)
                : [...(d.applicableCategoryIds ?? []), id],
        }));
    }
    function toggleItem(id: string) {
        setDraft(d => ({
            ...d,
            applicableItemIds: d.applicableItemIds?.includes(id)
                ? d.applicableItemIds.filter(x => x !== id)
                : [...(d.applicableItemIds ?? []), id],
        }));
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink flex items-center gap-2">
                        <Tag className="h-7 w-7 text-capsula-coral" /> Promociones
                    </h1>
                    <p className="text-capsula-ink-soft">Happy hour y descuentos automáticos por día y horario.</p>
                </div>
                <button onClick={openCreate} className="pos-btn inline-flex items-center gap-2 px-5 py-3">
                    <Plus className="h-4 w-4" /> Nueva promoción
                </button>
            </div>

            {/* Estado global del módulo */}
            <div className={[
                'rounded-2xl border p-4 flex items-center justify-between gap-4',
                enabled
                    ? 'bg-[#E5EDE7] border-[#cfe0d4] dark:bg-[#1E3B2C] dark:border-[#2c5440]'
                    : 'bg-[#F3EAD6] border-[#e6d5ad] dark:bg-[#3B2F15] dark:border-[#5a4a22]',
            ].join(' ')}>
                <div className="flex items-center gap-3">
                    <Power className={enabled ? 'h-5 w-5 text-[#2F6B4E] dark:text-[#6FB88F]' : 'h-5 w-5 text-[#946A1C] dark:text-[#E8D9B8]'} />
                    <div>
                        <p className="font-semibold text-capsula-ink">
                            {enabled ? 'Promociones activas en el POS' : 'Promociones desactivadas'}
                        </p>
                        <p className="text-xs text-capsula-ink-soft">
                            {enabled
                                ? 'El POS aplica las promociones vigentes automáticamente al cobrar.'
                                : 'Aunque cargues promociones, el POS no las aplicará hasta activar el módulo.'}
                        </p>
                    </div>
                </div>
                {canToggleFlag ? (
                    <button
                        onClick={handleToggleFlag}
                        disabled={flagBusy}
                        className={[
                            'min-w-[108px] py-2.5 px-4 rounded-xl border font-semibold text-sm transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-60',
                            enabled
                                ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep'
                                : 'bg-capsula-ivory-surface text-capsula-ink border-capsula-line hover:border-capsula-navy-deep/40',
                        ].join(' ')}
                    >
                        {enabled ? <><Check className="h-4 w-4" /> Activado</> : 'Activar'}
                    </button>
                ) : (
                    <span className="text-[11px] text-capsula-ink-muted">Solo el OWNER puede activar/desactivar</span>
                )}
            </div>

            {/* Lista */}
            {promotions.length === 0 ? (
                <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-10 text-center text-capsula-ink-muted">
                    No hay promociones. Crea la primera con "Nueva promoción".
                </div>
            ) : (
                <div className="space-y-3">
                    {promotions.map(p => (
                        <div key={p.id} className="bg-capsula-ivory border border-capsula-line rounded-2xl p-5 flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h3 className="font-semibold text-capsula-ink">{p.name}</h3>
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-capsula-coral/10 text-capsula-coral">
                                        {p.discountType === 'PERCENT'
                                            ? <><Percent className="h-3 w-3" /> {p.discountValue}%</>
                                            : <><DollarSign className="h-3 w-3" /> {p.discountValue.toFixed(2)}</>}
                                    </span>
                                    {!p.isActive && (
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-capsula-ivory-alt text-capsula-ink-muted">
                                            Inactiva
                                        </span>
                                    )}
                                </div>
                                {p.description && <p className="text-sm text-capsula-ink-soft mb-2">{p.description}</p>}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-capsula-ink-muted">
                                    <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {scopeLabel(p, categories, items)}</span>
                                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {timeLabel(p)}</span>
                                    {(p.startDate || p.endDate) && (
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            {p.startDate ? p.startDate.slice(0, 10) : '…'} → {p.endDate ? p.endDate.slice(0, 10) : '…'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => handleToggle(p)} title={p.isActive ? 'Desactivar' : 'Activar'}
                                    className="h-9 w-9 rounded-lg hover:bg-capsula-navy-soft text-capsula-ink-muted flex items-center justify-center">
                                    <Power className={p.isActive ? 'h-4 w-4 text-[#2F6B4E] dark:text-[#6FB88F]' : 'h-4 w-4'} />
                                </button>
                                <button onClick={() => openEdit(p)} title="Editar"
                                    className="h-9 w-9 rounded-lg hover:bg-capsula-navy-soft text-capsula-ink-muted flex items-center justify-center">
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDelete(p)} title="Eliminar"
                                    className="h-9 w-9 rounded-lg hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && (
                <PromotionModal
                    draft={draft}
                    setDraft={setDraft}
                    categories={categories}
                    itemsByCategory={itemsByCategory}
                    editing={editingId !== null}
                    saving={saving}
                    onClose={() => setModalOpen(false)}
                    onSave={handleSave}
                    onToggleDay={toggleDay}
                    onToggleCategory={toggleCategory}
                    onToggleItem={toggleItem}
                />
            )}
        </div>
    );
}

function PromotionModal({
    draft, setDraft, categories, itemsByCategory, editing, saving, onClose, onSave, onToggleDay, onToggleCategory, onToggleItem,
}: {
    draft: PromotionInput;
    setDraft: React.Dispatch<React.SetStateAction<PromotionInput>>;
    categories: MenuCategoryLite[];
    itemsByCategory: Map<string, MenuItemLite[]>;
    editing: boolean;
    saving: boolean;
    onClose: () => void;
    onSave: () => void;
    onToggleDay: (n: number) => void;
    onToggleCategory: (id: string) => void;
    onToggleItem: (id: string) => void;
}) {
    const allMenu = (draft.applicableCategoryIds?.length ?? 0) === 0 && (draft.applicableItemIds?.length ?? 0) === 0;

    return (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl my-4">
                <div className="border-b border-capsula-line p-5 flex items-center justify-between sticky top-0 bg-capsula-ivory rounded-t-3xl z-10">
                    <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                        {editing ? 'Editar promoción' : 'Nueva promoción'}
                    </h3>
                    <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Nombre + descripción */}
                    <div className="space-y-3">
                        <div>
                            <label className="pos-label mb-1 block">Nombre</label>
                            <input className="pos-input w-full" value={draft.name}
                                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                                placeholder="Ej: Happy Hour Cervezas" />
                        </div>
                        <div>
                            <label className="pos-label mb-1 block">Descripción (opcional)</label>
                            <input className="pos-input w-full" value={draft.description ?? ''}
                                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                        </div>
                    </div>

                    {/* Descuento */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="pos-label mb-1 block">Tipo de descuento</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setDraft(d => ({ ...d, discountType: 'PERCENT' }))}
                                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold inline-flex items-center justify-center gap-1 ${draft.discountType === 'PERCENT' ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep' : 'bg-capsula-ivory-surface border-capsula-line text-capsula-ink'}`}>
                                    <Percent className="h-3.5 w-3.5" /> %
                                </button>
                                <button type="button" onClick={() => setDraft(d => ({ ...d, discountType: 'FIXED' }))}
                                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold inline-flex items-center justify-center gap-1 ${draft.discountType === 'FIXED' ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep' : 'bg-capsula-ivory-surface border-capsula-line text-capsula-ink'}`}>
                                    <DollarSign className="h-3.5 w-3.5" /> Fijo
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="pos-label mb-1 block">
                                {draft.discountType === 'PERCENT' ? 'Porcentaje (%)' : 'Monto por unidad ($)'}
                            </label>
                            <input type="number" step="0.01" min="0" className="pos-input w-full tabular-nums"
                                value={draft.discountValue}
                                onChange={e => setDraft(d => ({ ...d, discountValue: parseFloat(e.target.value) || 0 }))} />
                        </div>
                    </div>
                    {draft.discountType === 'PERCENT' && (
                        <div>
                            <label className="pos-label mb-1 block">Tope de descuento por unidad ($, opcional)</label>
                            <input type="number" step="0.01" min="0" className="pos-input w-full tabular-nums"
                                value={draft.maxDiscountPerUnit ?? ''}
                                onChange={e => setDraft(d => ({ ...d, maxDiscountPerUnit: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) }))}
                                placeholder="Sin tope" />
                        </div>
                    )}

                    {/* Alcance */}
                    <div>
                        <label className="pos-label mb-1 block">Aplica a</label>
                        <p className="text-xs text-capsula-ink-muted mb-2">
                            {allMenu ? 'Sin selección = TODO el menú.' : 'Categorías y/o items seleccionados.'}
                        </p>
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                                {categories.map(c => (
                                    <button key={c.id} type="button" onClick={() => onToggleCategory(c.id)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${draft.applicableCategoryIds?.includes(c.id) ? 'bg-capsula-coral text-capsula-cream border-capsula-coral' : 'bg-capsula-ivory-surface border-capsula-line text-capsula-ink-soft'}`}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                            <details className="rounded-lg border border-capsula-line bg-capsula-ivory-surface">
                                <summary className="cursor-pointer px-3 py-2 text-sm text-capsula-ink-soft select-none">
                                    Items específicos {draft.applicableItemIds?.length ? `(${draft.applicableItemIds.length})` : ''}
                                </summary>
                                <div className="max-h-44 overflow-y-auto p-2 space-y-2">
                                    {categories.map(c => {
                                        const its = itemsByCategory.get(c.id) ?? [];
                                        if (!its.length) return null;
                                        return (
                                            <div key={c.id}>
                                                <p className="pos-kicker mb-1">{c.name}</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {its.map(it => (
                                                        <button key={it.id} type="button" onClick={() => onToggleItem(it.id)}
                                                            className={`px-2 py-0.5 rounded-full text-[11px] border ${draft.applicableItemIds?.includes(it.id) ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep' : 'bg-capsula-ivory border-capsula-line text-capsula-ink-soft'}`}>
                                                            {it.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        </div>
                    </div>

                    {/* Días */}
                    <div>
                        <label className="pos-label mb-1 block">Días (vacío = todos)</label>
                        <div className="flex flex-wrap gap-1.5">
                            {DAYS.map(d => (
                                <button key={d.n} type="button" onClick={() => onToggleDay(d.n)}
                                    className={`w-12 py-1.5 rounded-lg text-xs font-semibold border ${draft.daysOfWeek?.includes(d.n) ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep' : 'bg-capsula-ivory-surface border-capsula-line text-capsula-ink-soft'}`}>
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Horario */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="pos-label mb-1 block">Desde (HH:MM, opcional)</label>
                            <input type="time" className="pos-input w-full" value={draft.startTime ?? ''}
                                onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} />
                        </div>
                        <div>
                            <label className="pos-label mb-1 block">Hasta (HH:MM)</label>
                            <input type="time" className="pos-input w-full" value={draft.endTime ?? ''}
                                onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} />
                        </div>
                    </div>

                    {/* Rango de fechas */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="pos-label mb-1 block">Desde fecha (opcional)</label>
                            <input type="date" className="pos-input w-full" value={draft.startDate ?? ''}
                                onChange={e => setDraft(d => ({ ...d, startDate: e.target.value || null }))} />
                        </div>
                        <div>
                            <label className="pos-label mb-1 block">Hasta fecha (opcional)</label>
                            <input type="date" className="pos-input w-full" value={draft.endDate ?? ''}
                                onChange={e => setDraft(d => ({ ...d, endDate: e.target.value || null }))} />
                        </div>
                    </div>

                    {/* Prioridad + activa */}
                    <div className="grid grid-cols-2 gap-3 items-end">
                        <div>
                            <label className="pos-label mb-1 block">Prioridad (mayor gana si hay solape)</label>
                            <input type="number" step="1" className="pos-input w-full tabular-nums" value={draft.priority ?? 0}
                                onChange={e => setDraft(d => ({ ...d, priority: parseInt(e.target.value, 10) || 0 }))} />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-capsula-ink-soft cursor-pointer select-none rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5">
                            <input type="checkbox" checked={draft.isActive ?? true}
                                onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))} />
                            Activa
                        </label>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-capsula-ink-muted bg-capsula-ivory-alt rounded-lg p-3">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>Las promociones no se acumulan: si dos aplican al mismo item, gana la de mayor prioridad. El horario usa hora de Caracas y soporta cruce de medianoche (ej. 22:00–02:00).</span>
                    </div>
                </div>

                <div className="border-t border-capsula-line p-4 flex gap-3">
                    <button onClick={onClose} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
                    <button onClick={onSave} disabled={saving} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
                        <Check className="h-4 w-4" /> {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear promoción'}
                    </button>
                </div>
            </div>
        </div>
    );
}
