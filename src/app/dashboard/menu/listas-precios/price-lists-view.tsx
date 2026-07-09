'use client';

/**
 * Gestión de listas de precios por canal (§86). Los gerentes crean listas,
 * les asignan canales, las activan/desactivan y editan el precio de cada
 * producto en la lista. El POS toma el precio de la lista activa del canal.
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
    Check, Trash2, Plus, X as XIcon, Tag, Power, Pencil, Search, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    createPriceListAction,
    updatePriceListAction,
    togglePriceListAction,
    deletePriceListAction,
    getPriceListItemsAction,
    setPriceListItemsAction,
    type PriceListDTO,
} from '@/app/actions/price-lists.actions';
import { toggleFeatureFlagAction } from '@/app/actions/feature-flags.actions';
import { PRICE_LIST_CHANNELS, type PriceListChannel } from '@/lib/pricing/price-list';

export interface MenuCategoryLite { id: string; name: string; }
export interface MenuItemLite { id: string; name: string; categoryId: string; categoryName: string; basePrice: number; }

interface Props {
    initialLists: PriceListDTO[];
    categories: MenuCategoryLite[];
    items: MenuItemLite[];
    priceListsEnabled: boolean;
    canToggleFlag: boolean;
}

const CHANNEL_LABEL = new Map(PRICE_LIST_CHANNELS.map(c => [c.key, c.label]));

export default function PriceListsView({ initialLists, categories, items, priceListsEnabled, canToggleFlag }: Props) {
    const [lists, setLists] = useState<PriceListDTO[]>(initialLists);
    const [flagOn, setFlagOn] = useState(priceListsEnabled);
    const [, startTransition] = useTransition();

    // Crear
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newChannels, setNewChannels] = useState<PriceListChannel[]>([]);
    const [saving, setSaving] = useState(false);

    // Editor de precios
    const [editor, setEditor] = useState<PriceListDTO | null>(null);

    const toast_ = (msg: string) => toast.success(msg);

    const handleToggleFlag = async () => {
        const next = !flagOn;
        setFlagOn(next);
        const res = await toggleFeatureFlagAction('priceListsEnabled', next);
        if (!res.success) { setFlagOn(!next); toast.error(res.message ?? 'Error'); }
        else toast_(next ? 'Listas de precios activadas' : 'Listas de precios desactivadas');
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        const res = await createPriceListAction({ name: newName, channels: newChannels });
        setSaving(false);
        if (res.success && res.data) {
            setLists(prev => [{
                id: res.data!.id, name: newName.trim(), description: null,
                channels: newChannels, priority: 0, isActive: true, itemCount: 0,
                updatedAt: new Date().toISOString(),
            }, ...prev]);
            setShowCreate(false); setNewName(''); setNewChannels([]);
            toast_(`Lista "${newName.trim()}" creada`);
        } else {
            toast.error(res.message ?? 'Error creando la lista');
        }
    };

    const handleToggleActive = (l: PriceListDTO) => {
        const next = !l.isActive;
        setLists(prev => prev.map(x => x.id === l.id ? { ...x, isActive: next } : x));
        startTransition(async () => {
            const res = await togglePriceListAction(l.id, next);
            if (!res.success) {
                setLists(prev => prev.map(x => x.id === l.id ? { ...x, isActive: !next } : x));
                toast.error(res.message ?? 'Error');
            }
        });
    };

    const handleDelete = async (l: PriceListDTO) => {
        if (!confirm(`¿Eliminar la lista "${l.name}"? Los canales volverán al precio base.`)) return;
        const res = await deletePriceListAction(l.id);
        if (res.success) { setLists(prev => prev.filter(x => x.id !== l.id)); toast_('Lista eliminada'); }
        else toast.error(res.message ?? 'Error');
    };

    const handleSetChannels = (l: PriceListDTO, channels: PriceListChannel[]) => {
        setLists(prev => prev.map(x => x.id === l.id ? { ...x, channels } : x));
        startTransition(async () => {
            const res = await updatePriceListAction(l.id, { channels });
            if (!res.success) toast.error(res.message ?? 'Error');
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Listas de precios</h1>
                    <p className="text-sm text-capsula-ink-muted mt-1">
                        Precios por canal. La lista activa de cada canal define el precio de sus productos en el POS; los que no estén en la lista usan su precio base.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(v => !v)}
                    className="inline-flex items-center gap-2 rounded-xl bg-capsula-navy-deep px-4 py-2 text-sm font-semibold text-capsula-cream hover:bg-capsula-navy shrink-0"
                >
                    <Plus className="h-4 w-4" /> Nueva lista
                </button>
            </div>

            {/* Estado del flag */}
            {!flagOn && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F3EAD6] px-4 py-2.5 text-sm font-semibold text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Las listas de precios están desactivadas — el POS usa el precio base. {canToggleFlag ? 'Actívalas para que apliquen.' : 'Pedile a un OWNER que las active.'}</span>
                    {canToggleFlag && (
                        <button onClick={handleToggleFlag} className="inline-flex items-center gap-1.5 rounded-lg bg-capsula-navy-deep px-3 py-1.5 text-xs font-semibold text-capsula-cream hover:bg-capsula-navy">
                            <Power className="h-3.5 w-3.5" /> Activar
                        </button>
                    )}
                </div>
            )}
            {flagOn && canToggleFlag && (
                <div className="flex items-center justify-end">
                    <button onClick={handleToggleFlag} className="inline-flex items-center gap-1.5 text-xs font-semibold text-capsula-ink-muted hover:text-capsula-coral">
                        <Power className="h-3.5 w-3.5" /> Desactivar listas de precios
                    </button>
                </div>
            )}

            {/* Formulario nueva lista */}
            {showCreate && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-5 space-y-3">
                    <h3 className="font-semibold text-capsula-ink">Crear lista de precios</h3>
                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Nombre *</label>
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Ej: Precios Delivery, Precios Temporada Alta…"
                            className="w-full rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Canales</label>
                        <ChannelChips selected={newChannels} onChange={setNewChannels} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate} disabled={!newName.trim() || saving} className="rounded-lg bg-capsula-navy-deep px-4 py-2 text-sm font-semibold text-capsula-cream hover:bg-capsula-navy disabled:opacity-50">
                            {saving ? 'Creando…' : 'Crear lista'}
                        </button>
                        <button onClick={() => setShowCreate(false)} className="rounded-lg bg-capsula-ivory-alt px-4 py-2 text-sm font-semibold text-capsula-ink">Cancelar</button>
                    </div>
                </div>
            )}

            {lists.length === 0 && !showCreate && (
                <div className="rounded-xl border border-capsula-line p-12 text-center text-capsula-ink-muted">
                    <Tag className="mx-auto mb-2 h-8 w-8 text-capsula-ink-faint" />
                    <p className="font-medium">No hay listas de precios. Crea una con el botón de arriba.</p>
                </div>
            )}

            {/* Listas */}
            <div className="space-y-3">
                {lists.map(l => (
                    <div key={l.id} className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink truncate">{l.name}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${l.isActive ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' : 'bg-capsula-ivory-alt text-capsula-ink-muted'}`}>
                                        {l.isActive ? 'Activa' : 'Inactiva'}
                                    </span>
                                </div>
                                <p className="text-xs text-capsula-ink-muted mt-0.5">{l.itemCount} producto(s) con precio propio</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setEditor(l)} className="inline-flex items-center gap-1.5 rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-xs font-semibold text-capsula-ink hover:border-capsula-navy-deep/40">
                                    <Pencil className="h-3.5 w-3.5" /> Editar precios
                                </button>
                                <button onClick={() => handleToggleActive(l)} title={l.isActive ? 'Desactivar' : 'Activar'} className={`p-1.5 rounded-lg ${l.isActive ? 'text-[#2F6B4E] dark:text-[#6FB88F] hover:bg-capsula-navy-soft' : 'text-capsula-ink-muted hover:bg-capsula-navy-soft'}`}>
                                    <Power className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDelete(l)} title="Eliminar" className="p-1.5 rounded-lg text-capsula-ink-muted hover:text-capsula-coral hover:bg-capsula-coral/10">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="mt-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5">Canales donde aplica</p>
                            <ChannelChips selected={l.channels} onChange={(chs) => handleSetChannels(l, chs)} />
                        </div>
                    </div>
                ))}
            </div>

            {editor && (
                <PriceEditorModal
                    list={editor}
                    items={items}
                    categories={categories}
                    onClose={() => setEditor(null)}
                    onSaved={(count) => {
                        setLists(prev => prev.map(x => x.id === editor.id ? { ...x, itemCount: count } : x));
                        setEditor(null);
                    }}
                />
            )}
        </div>
    );
}

function ChannelChips({ selected, onChange }: { selected: PriceListChannel[]; onChange: (chs: PriceListChannel[]) => void }) {
    const toggle = (key: PriceListChannel) => {
        onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
    };
    return (
        <div className="flex flex-wrap gap-1.5">
            {PRICE_LIST_CHANNELS.map(c => {
                const on = selected.includes(c.key);
                return (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            on
                                ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted hover:border-capsula-navy-deep/40'
                        }`}
                    >
                        {on && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}{c.label}
                    </button>
                );
            })}
        </div>
    );
}

function PriceEditorModal({ list, items, categories, onClose, onSaved }: {
    list: PriceListDTO;
    items: MenuItemLite[];
    categories: MenuCategoryLite[];
    onClose: () => void;
    onSaved: (count: number) => void;
}) {
    // menuItemId → precio (string mientras se tipea). Vacío = sin override.
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState<string>('');

    // Cargar overrides existentes al abrir.
    useEffect(() => {
        let cancelled = false;
        getPriceListItemsAction(list.id).then(res => {
            if (cancelled) return;
            if (res.success && res.data) {
                const map: Record<string, string> = {};
                for (const it of res.data) map[it.menuItemId] = String(it.price);
                setPrices(map);
            }
            setLoaded(true);
        });
        return () => { cancelled = true; };
    }, [list.id]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter(i =>
            (!catFilter || i.categoryId === catFilter) &&
            (!q || i.name.toLowerCase().includes(q)),
        );
    }, [items, search, catFilter]);

    const overridesCount = Object.values(prices).filter(v => {
        const n = parseFloat(v);
        return Number.isFinite(n) && n > 0;
    }).length;

    const handleSave = async () => {
        setSaving(true);
        const payload = Object.entries(prices).map(([menuItemId, v]) => {
            const n = parseFloat(v);
            return { menuItemId, price: Number.isFinite(n) && n > 0 ? n : null };
        });
        const res = await setPriceListItemsAction(list.id, payload);
        setSaving(false);
        if (res.success) {
            toast.success(`Precios de "${list.name}" guardados`);
            onSaved(overridesCount);
        } else {
            toast.error(res.message ?? 'Error guardando');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">
                <div className="border-b border-capsula-line p-5 flex items-center justify-between shrink-0">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink truncate">Precios — {list.name}</h3>
                        <p className="text-xs text-capsula-ink-muted mt-0.5">Deja vacío un producto para que use su precio base. {overridesCount} con precio propio.</p>
                    </div>
                    <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center shrink-0">
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 border-b border-capsula-line shrink-0 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto…" className="w-full rounded-lg border border-capsula-line bg-capsula-ivory pl-9 pr-3 py-2 text-sm text-capsula-ink" />
                    </div>
                    <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-2 text-sm text-capsula-ink">
                        <option value="">Todas las categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="overflow-y-auto p-4 space-y-1">
                    {!loaded ? (
                        <p className="py-8 text-center text-sm text-capsula-ink-muted">Cargando…</p>
                    ) : filtered.length === 0 ? (
                        <p className="py-8 text-center text-sm text-capsula-ink-muted">Sin productos.</p>
                    ) : filtered.map(it => {
                        const val = prices[it.id] ?? '';
                        const hasOverride = (() => { const n = parseFloat(val); return Number.isFinite(n) && n > 0; })();
                        return (
                            <div key={it.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${hasOverride ? 'border-capsula-navy-deep/40 bg-capsula-navy-soft' : 'border-capsula-line bg-capsula-ivory-surface'}`}>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-capsula-ink truncate">{it.name}</p>
                                    <p className="text-[10px] text-capsula-ink-faint">{it.categoryName} · base ${it.basePrice.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1 shrink-0">
                                    <span className="text-sm text-capsula-ink-muted">$</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step="any"
                                        value={val}
                                        onChange={e => setPrices(prev => ({ ...prev, [it.id]: e.target.value }))}
                                        placeholder={it.basePrice.toFixed(2)}
                                        className="w-20 bg-transparent text-right text-sm font-semibold text-capsula-ink tabular-nums focus:outline-none"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="border-t border-capsula-line p-4 flex gap-3 shrink-0">
                    <button onClick={onClose} disabled={saving} className="pos-btn-secondary flex-1 py-3">Cancelar</button>
                    <button onClick={handleSave} disabled={saving || !loaded} className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60">
                        <Check className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar precios'}
                    </button>
                </div>
            </div>
        </div>
    );
}
