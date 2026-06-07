'use client';

/**
 * Pantalla de Conteo Rápido — §51 Flujo B
 *
 * Optimizada para tipear los conteos directo al sistema sin pasar por Excel.
 * Una persona dicta de la hoja impresa (mismo orden, mismo SKU), otra tipea.
 * Tab/Enter avanza al siguiente input. Auto-save en localStorage por si la
 * sesión se interrumpe (refresh, cierre de pestaña).
 *
 * Reusa el backend existente:
 *   - getInventoryCountTemplateAction → carga todos los SKU del área(s)
 *   - applyPhysicalCountAction → crea WeeklyCount + ajusta InventoryLocation
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
    getInventoryCountTemplateAction,
    applyPhysicalCountAction,
    type CountTemplateRow,
} from '@/app/actions/inventory-count.actions';
import { ArrowLeft, Check, Loader2, Search, Printer, X as XIcon } from 'lucide-react';

interface Props {
    areas: { id: string; name: string }[];
    defaultPrincipalId: string | null;
    defaultProductionId: string | null;
}

interface CountedItem extends CountTemplateRow {
    inventoryItemId: string;
    countedPrincipal: string;          // string para input controlado, parse al final
    countedProduction: string;
}

const LS_KEY = 'capsula-conteo-rapido-draft-v1';

export default function QuickCountView({ areas, defaultPrincipalId, defaultProductionId }: Props) {
    const [principalId, setPrincipalId] = useState(defaultPrincipalId || '');
    const [productionId, setProductionId] = useState(defaultProductionId || '');
    const [dualMode, setDualMode] = useState(false);
    const [items, setItems] = useState<CountedItem[]>([]);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [applying, setApplying] = useState(false);
    const [search, setSearch] = useState('');
    const [showOnlyMissing, setShowOnlyMissing] = useState(false);
    const [confirming, setConfirming] = useState(false);

    /** Resumen del último conteo aplicado — se muestra como pantalla de éxito */
    const [lastApplied, setLastApplied] = useState<{
        weeklyCountNumber: string;
        itemCount: number;
        areaName: string;
    } | null>(null);

    // ── Cargar plantilla (todos los SKU para el área principal — y producción si dual)
    const loadTemplate = useCallback(async () => {
        if (!principalId) {
            toast.error('Seleccione el almacén principal');
            return;
        }
        if (dualMode && !productionId) {
            toast.error('Seleccione el almacén de producción');
            return;
        }
        setLoadingTemplate(true);
        try {
            const res = await getInventoryCountTemplateAction(principalId, dualMode ? productionId : null);
            if (!res.success || !res.rows) {
                toast.error(res.message || 'Error cargando items');
                return;
            }

            // Intentar recuperar draft de localStorage
            let draftMap = new Map<string, { countedPrincipal: string; countedProduction: string }>();
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as {
                        principalId: string; productionId: string | null; dualMode: boolean;
                        entries: Record<string, { p: string; q: string }>;
                    };
                    if (parsed.principalId === principalId && parsed.dualMode === dualMode &&
                        (parsed.productionId ?? '') === (dualMode ? productionId : '')) {
                        for (const [sku, v] of Object.entries(parsed.entries)) {
                            draftMap.set(sku, { countedPrincipal: v.p, countedProduction: v.q });
                        }
                    }
                }
            } catch { /* ignore localStorage errors */ }

            const counted: CountedItem[] = res.rows.map(r => ({
                ...r,
                inventoryItemId: r.id,
                countedPrincipal: draftMap.get(r.sku)?.countedPrincipal ?? '',
                countedProduction: draftMap.get(r.sku)?.countedProduction ?? '',
            }));
            setItems(counted);
            if (draftMap.size > 0) {
                toast.success(`Borrador recuperado (${draftMap.size} items)`);
            }
        } finally {
            setLoadingTemplate(false);
        }
    }, [principalId, productionId, dualMode]);

    // ── Auto-save en localStorage cuando cambian items (debounced)
    useEffect(() => {
        if (items.length === 0) return;
        const t = setTimeout(() => {
            try {
                const entries: Record<string, { p: string; q: string }> = {};
                for (const it of items) {
                    if (it.countedPrincipal || it.countedProduction) {
                        entries[it.sku] = { p: it.countedPrincipal, q: it.countedProduction };
                    }
                }
                localStorage.setItem(LS_KEY, JSON.stringify({
                    principalId,
                    productionId: dualMode ? productionId : null,
                    dualMode,
                    entries,
                }));
            } catch { /* full storage o quota — ignore */ }
        }, 500);
        return () => clearTimeout(t);
    }, [items, principalId, productionId, dualMode]);

    const updateItem = (sku: string, field: 'countedPrincipal' | 'countedProduction', value: string) => {
        setItems(prev => prev.map(it => (it.sku === sku ? { ...it, [field]: value } : it)));
    };

    // ── Stats de progreso
    const totalItems = items.length;
    const countedItems = useMemo(
        () => items.filter(i => i.countedPrincipal.trim() !== '' || i.countedProduction.trim() !== '').length,
        [items],
    );
    const pendingItems = totalItems - countedItems;
    const progressPct = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

    // ── Filtro + agrupación
    const filtered = useMemo(() => {
        let r = items;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            r = r.filter(it => `${it.sku} ${it.productName} ${it.category}`.toLowerCase().includes(q));
        }
        if (showOnlyMissing) {
            r = r.filter(it => it.countedPrincipal.trim() === '' && it.countedProduction.trim() === '');
        }
        return r;
    }, [items, search, showOnlyMissing]);

    const grouped = useMemo(() => {
        const map = new Map<string, CountedItem[]>();
        for (const it of filtered) {
            const cat = it.category || 'Sin categoría';
            const arr = map.get(cat) ?? [];
            arr.push(it);
            map.set(cat, arr);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    // ── Aplicar conteo
    const applyCount = async () => {
        if (countedItems === 0) {
            toast.error('No hay items contados');
            return;
        }
        setApplying(true);
        try {
            const res = await applyPhysicalCountAction({
                rows: items
                    .filter(i => i.countedPrincipal.trim() !== '' || i.countedProduction.trim() !== '')
                    .map(i => ({
                        inventoryItemId: i.inventoryItemId,
                        qtyPrincipal: parseFloat(i.countedPrincipal) || 0,
                        qtyProduction: dualMode ? (parseFloat(i.countedProduction) || 0) : null,
                    })),
                principalAreaId: principalId,
                productionAreaId: dualMode ? productionId : null,
                dualWarehouse: dualMode,
                notes: `Conteo rápido (${countedItems} de ${totalItems} items contados)`,
            });
            if (res.success) {
                toast.success(`Conteo aplicado: ${res.weeklyCountNumber}`);
                localStorage.removeItem(LS_KEY);
                setConfirming(false);
                setLastApplied({
                    weeklyCountNumber: res.weeklyCountNumber ?? '—',
                    itemCount: countedItems,
                    areaName: areas.find(a => a.id === principalId)?.name ?? 'Almacén',
                });
                setItems([]);
            } else {
                toast.error(res.message);
            }
        } finally {
            setApplying(false);
        }
    };

    const clearDraft = () => {
        if (!confirm('¿Descartar el borrador actual y empezar de cero?')) return;
        localStorage.removeItem(LS_KEY);
        setItems([]);
    };

    // ── Render: pantalla de éxito post-aplicación
    if (lastApplied && items.length === 0) {
        return (
            <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
                <div className="rounded-2xl border border-capsula-line bg-capsula-ivory p-6 sm:p-8 text-center space-y-4">
                    <div className="mx-auto h-16 w-16 rounded-full bg-[#E5EDE7] dark:bg-[#1E3B2C] flex items-center justify-center">
                        <Check className="h-8 w-8 text-[#2F6B4E] dark:text-[#6FB88F]" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-2xl text-capsula-ink tracking-[-0.02em]">Conteo aplicado</h1>
                        <p className="text-sm text-capsula-ink-soft mt-1">
                            <strong>{lastApplied.itemCount}</strong> items registrados en{' '}
                            <strong>{lastApplied.areaName}</strong>
                        </p>
                        <p className="text-xs text-capsula-ink-muted mt-1 font-mono">{lastApplied.weeklyCountNumber}</p>
                    </div>

                    <div className="rounded-xl bg-[#E6ECF4] dark:bg-[#1A2636] text-[#2A4060] dark:text-[#D1DCE9] p-4 text-xs text-left space-y-1.5">
                        <p className="font-semibold uppercase tracking-wider text-[10px]">Qué pasó en el sistema</p>
                        <p>✓ El stock por área se actualizó al instante (módulo <strong>Inventario</strong>)</p>
                        <p>✓ Quedó snapshot histórico (<strong>Conteo {lastApplied.weeklyCountNumber}</strong>) para comparar con el próximo</p>
                        <p>✓ Se registraron ajustes (movimientos ADJUSTMENT_IN/OUT) por la diferencia con el stock previo</p>
                        <p>✓ El POS descuenta el stock nuevo en cada venta vía recetas vinculadas</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <Link
                            href="/dashboard/inventario"
                            className="pos-btn flex-1 inline-flex items-center justify-center gap-2 py-3"
                        >
                            Ver inventario actualizado
                        </Link>
                        <Link
                            href="/dashboard/reportes/inventario-completo"
                            className="pos-btn-secondary flex-1 inline-flex items-center justify-center gap-2 py-3"
                        >
                            Reporte completo
                        </Link>
                    </div>

                    <button
                        onClick={() => setLastApplied(null)}
                        className="text-xs text-capsula-ink-muted hover:text-capsula-coral underline"
                    >
                        Empezar otro conteo
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: si todavía no cargó la plantilla, mostrar setup
    if (items.length === 0) {
        return (
            <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
                <div>
                    <Link href="/dashboard/inventario" className="text-sm text-capsula-coral hover:underline inline-flex items-center gap-1 mb-2">
                        <ArrowLeft className="h-3.5 w-3.5" /> Inventario
                    </Link>
                    <h1 className="font-semibold text-2xl sm:text-3xl tracking-[-0.02em] text-capsula-ink">
                        Conteo rápido
                    </h1>
                    <p className="text-sm text-capsula-ink-soft mt-1">
                        Tipea las cantidades directo al sistema desde la hoja impresa.
                        Mismo orden que el Excel y la hoja de "Imprimir lista".
                        <strong className="text-capsula-ink"> Tab/Enter avanza al siguiente.</strong>
                    </p>
                </div>

                <div className="rounded-2xl border border-capsula-line bg-capsula-ivory p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted block mb-1.5">
                            Almacén principal
                        </label>
                        <select
                            value={principalId}
                            onChange={e => setPrincipalId(e.target.value)}
                            className="pos-input w-full"
                        >
                            <option value="">— Seleccionar —</option>
                            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={dualMode} onChange={e => setDualMode(e.target.checked)} className="h-4 w-4" />
                        <span className="text-sm text-capsula-ink">También contar Producción/Cocina</span>
                    </label>

                    {dualMode && (
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted block mb-1.5">
                                Almacén producción / cocina
                            </label>
                            <select
                                value={productionId}
                                onChange={e => setProductionId(e.target.value)}
                                className="pos-input w-full"
                            >
                                <option value="">— Seleccionar —</option>
                                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={loadTemplate}
                        disabled={loadingTemplate || !principalId}
                        className="pos-btn w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {loadingTemplate ? 'Cargando…' : 'Comenzar conteo'}
                    </button>
                </div>

                <div className="rounded-xl bg-[#E6ECF4] dark:bg-[#1A2636] text-[#2A4060] dark:text-[#D1DCE9] p-4 text-xs space-y-2">
                    <p className="font-semibold uppercase tracking-wider text-[10px]">Flujo recomendado</p>
                    <ol className="list-decimal list-inside space-y-1 opacity-90">
                        <li>Imprimí la hoja de conteo físico (<Link href="/dashboard/inventario/imprimir" className="underline">Inventario → Imprimir lista</Link>) — mismo orden que esta pantalla.</li>
                        <li>El personal cuenta físicamente y anota cantidades en la hoja.</li>
                        <li>Volvés acá y tipeas: una persona dicta de la hoja, otra escribe los números. Tab/Enter avanza.</li>
                        <li>Al final, <strong>Aplicar conteo</strong> registra el <code>WeeklyCount</code> y ajusta stock.</li>
                    </ol>
                </div>
            </div>
        );
    }

    // ── Render: conteo activo
    return (
        <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4">
            {/* Header con progreso */}
            <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-capsula-ivory border-b border-capsula-line px-3 sm:px-5 py-3 sm:rounded-2xl sm:border">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                        <h1 className="font-semibold text-lg sm:text-xl text-capsula-ink tracking-[-0.02em] truncate">
                            Conteo rápido — {areas.find(a => a.id === principalId)?.name}
                            {dualMode && ` + ${areas.find(a => a.id === productionId)?.name}`}
                        </h1>
                        <p className="text-[11px] text-capsula-ink-muted">
                            Contados: <strong className="text-capsula-ink tabular-nums">{countedItems}</strong> de {totalItems}
                            {' · '}Pendientes: <strong className="tabular-nums">{pendingItems}</strong>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/inventario/imprimir?layout=count"
                            target="_blank"
                            className="pos-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                        >
                            <Printer className="h-3.5 w-3.5" /> Imprimir hoja
                        </Link>
                        <button onClick={clearDraft} className="pos-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs">
                            <XIcon className="h-3.5 w-3.5" /> Descartar
                        </button>
                        <button
                            onClick={() => setConfirming(true)}
                            disabled={countedItems === 0}
                            className="pos-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
                        >
                            <Check className="h-3.5 w-3.5" /> Aplicar conteo
                        </button>
                    </div>
                </div>
                {/* Barra de progreso */}
                <div className="h-1.5 w-full bg-capsula-ivory-alt rounded-full overflow-hidden">
                    <div
                        className="h-full bg-capsula-navy-deep transition-all"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-capsula-ink-muted" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por SKU, nombre o categoría…"
                        className="pos-input w-full pl-9"
                    />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                        type="checkbox"
                        checked={showOnlyMissing}
                        onChange={e => setShowOnlyMissing(e.target.checked)}
                        className="h-4 w-4"
                    />
                    <span className="text-capsula-ink">Solo pendientes</span>
                </label>
            </div>

            {/* Lista agrupada */}
            {grouped.length === 0 && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-8 text-center text-sm text-capsula-ink-muted">
                    {showOnlyMissing
                        ? '✓ Todos los items están contados'
                        : `Sin resultados para "${search}"`}
                </div>
            )}

            {grouped.map(([category, rows]) => (
                <CategoryBlock
                    key={category}
                    category={category}
                    rows={rows}
                    dualMode={dualMode}
                    onUpdate={updateItem}
                />
            ))}

            {/* Modal de confirmación */}
            {confirming && (
                <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                        <div className="border-b border-capsula-line p-5">
                            <h3 className="font-semibold text-lg text-capsula-ink tracking-[-0.02em]">Aplicar conteo</h3>
                            <p className="text-xs text-capsula-ink-muted mt-1">
                                Vas a registrar <strong>{countedItems}</strong> items contados de un total de <strong>{totalItems}</strong>.
                                {pendingItems > 0 && (
                                    <span className="block mt-1 text-[#946A1C] dark:text-[#E8D9B8]">
                                        ⚠ <strong>{pendingItems}</strong> items pendientes se contarán como 0.
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="p-5 space-y-3 text-sm">
                            <p className="text-capsula-ink-soft">
                                Se creará un <strong>WeeklyCount</strong> y se ajustará el stock de cada SKU. Los items sin valor
                                quedan en 0 en el sistema (= "no había nada").
                            </p>
                            <p className="text-capsula-ink-soft text-xs">
                                Si querés contar solo los que quedaron pendientes en otra sesión, cancelá y usá el filtro
                                "Solo pendientes" arriba.
                            </p>
                        </div>
                        <div className="border-t border-capsula-line p-4 flex gap-3">
                            <button
                                onClick={() => setConfirming(false)}
                                disabled={applying}
                                className="pos-btn-secondary flex-1 py-3 disabled:opacity-50"
                            >
                                Volver
                            </button>
                            <button
                                onClick={applyCount}
                                disabled={applying}
                                className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                {applying ? 'Aplicando…' : 'Confirmar y aplicar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Bloque de categoría con inputs de conteo
// ============================================================================

interface BlockProps {
    category: string;
    rows: CountedItem[];
    dualMode: boolean;
    onUpdate: (sku: string, field: 'countedPrincipal' | 'countedProduction', value: string) => void;
}

function CategoryBlock({ category, rows, dualMode, onUpdate }: BlockProps) {
    const contadosEnGrupo = rows.filter(r => r.countedPrincipal.trim() !== '' || r.countedProduction.trim() !== '').length;
    return (
        <div className="rounded-2xl border border-capsula-line bg-capsula-ivory overflow-hidden">
            <div className="bg-capsula-ivory-surface px-4 py-2 border-b border-capsula-line flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-soft">
                    {category}
                </h2>
                <span className="text-[10px] font-semibold tabular-nums text-capsula-ink-muted">
                    {contadosEnGrupo}/{rows.length}
                </span>
            </div>
            <div className="divide-y divide-capsula-line">
                {rows.map(r => (
                    <ItemRow key={r.sku} item={r} dualMode={dualMode} onUpdate={onUpdate} />
                ))}
            </div>
        </div>
    );
}

interface RowProps {
    item: CountedItem;
    dualMode: boolean;
    onUpdate: (sku: string, field: 'countedPrincipal' | 'countedProduction', value: string) => void;
}

function ItemRow({ item, dualMode, onUpdate }: RowProps) {
    const inputP = useRef<HTMLInputElement>(null);
    const counted = item.countedPrincipal.trim() !== '' || item.countedProduction.trim() !== '';

    return (
        <div className={`px-3 sm:px-4 py-2.5 flex items-center gap-3 ${counted ? 'bg-capsula-ivory' : 'bg-capsula-ivory-surface/30'}`}>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-capsula-ink truncate">{item.productName}</p>
                <p className="text-[10px] font-mono text-capsula-ink-muted truncate">
                    {item.sku} · {item.baseUnit} · sistema: {item.stockPrincipal.toFixed(2)}
                    {dualMode && item.stockProduction !== null && ` / ${item.stockProduction.toFixed(2)}`}
                </p>
            </div>
            <input
                ref={inputP}
                type="number"
                inputMode="decimal"
                value={item.countedPrincipal}
                onChange={e => onUpdate(item.sku, 'countedPrincipal', e.target.value)}
                placeholder="—"
                step="any"
                className="w-20 sm:w-24 px-2 py-1.5 rounded-lg border border-capsula-line bg-capsula-ivory text-right tabular-nums font-semibold text-capsula-ink focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/30"
            />
            {dualMode && (
                <input
                    type="number"
                    inputMode="decimal"
                    value={item.countedProduction}
                    onChange={e => onUpdate(item.sku, 'countedProduction', e.target.value)}
                    placeholder="—"
                    step="any"
                    className="w-20 sm:w-24 px-2 py-1.5 rounded-lg border border-capsula-line bg-capsula-ivory text-right tabular-nums font-semibold text-capsula-ink focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/30"
                />
            )}
        </div>
    );
}
