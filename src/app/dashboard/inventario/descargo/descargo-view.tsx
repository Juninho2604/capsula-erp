'use client';

/**
 * §156 — Descargo manual de consumo.
 *
 * Caso que lo motiva: "Arma tu Shawarma" se vende sin receta (el detalle va
 * en la nota del ítem), así que la venta no descuenta inventario. Acá se
 * registra el consumo agregado real del período — kibe en unidades, pollo en
 * kilos — y el Kardex queda con el rastro.
 *
 * Si se vincula un plato, muestra cuántas unidades se vendieron desde el
 * último descargo de ese plato: es lo que dice qué período se está cubriendo
 * y delata cuando el descargo se acumula sin hacerse.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
    ArrowLeft, ClipboardList, Plus, Trash2, Check, Loader2, UtensilsCrossed,
    ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import {
    manualDischargeAction,
    getDischargeContextAction,
    type DischargeContext,
} from '@/app/actions/manual-discharge.actions';
import { summarizeDischargeNotes } from '@/lib/inventory/discharge-notes';
import { formatNumber } from '@/lib/utils';

interface AreaOpt { id: string; name: string }
interface ItemOpt { id: string; name: string; baseUnit: string; type: string }
interface MenuOpt { id: string; name: string }

interface Line { key: number; itemId: string; quantity: number }

const TYPE_TAG: Record<string, string> = {
    RAW_MATERIAL: '',
    SUB_RECIPE: ' [Sub-receta]',
    FINISHED_GOOD: ' [Producto]',
};

export default function DescargoView({ areas, items, menuItems }: {
    areas: AreaOpt[];
    items: ItemOpt[];
    menuItems: MenuOpt[];
}) {
    const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
    const [menuItemId, setMenuItemId] = useState('');
    const [context, setContext] = useState<DischargeContext | null>(null);
    const [lines, setLines] = useState<Line[]>([]);
    const [newItemId, setNewItemId] = useState('');
    const [newQty, setNewQty] = useState<number>(0);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [shortfall, setShortfall] = useState<string | null>(null);
    const [nextKey, setNextKey] = useState(1);
    const [notesOpen, setNotesOpen] = useState(false);

    const itemById = (id: string) => items.find(i => i.id === id);

    // Contador de vendidos del plato vinculado desde su último descargo.
    useEffect(() => {
        if (!menuItemId) { setContext(null); return; }
        let cancelled = false;
        setNotesOpen(false);
        getDischargeContextAction(menuItemId).then(ctx => {
            if (!cancelled) setContext(ctx);
        });
        return () => { cancelled = true; };
    }, [menuItemId]);

    // §156.1 — Qué se despachó en cada unidad, agrupado por la nota del
    // mesonero. Sin esto el contador dice CUÁNTOS pero no CON QUÉ.
    const notes = useMemo(
        () => summarizeDischargeNotes(context?.soldLines ?? []),
        [context],
    );

    function addLine() {
        if (!newItemId || newQty <= 0) return;
        setLines(prev => [...prev, { key: nextKey, itemId: newItemId, quantity: newQty }]);
        setNextKey(k => k + 1);
        setNewItemId('');
        setNewQty(0);
        setShortfall(null);
    }

    async function submit(allowNegativeStock = false) {
        if (submitting || lines.length === 0 || !areaId || !reason.trim()) return;
        setSubmitting(true);
        setShortfall(null);
        try {
            const res = await manualDischargeAction({
                areaId,
                lines: lines.map(l => ({ itemId: l.itemId, quantity: l.quantity })),
                reason: reason.trim(),
                menuItemId: menuItemId || null,
                allowNegativeStock,
            });
            if (res.success) {
                toast.success(res.message);
                setLines([]);
                setReason('');
                // Refrescar el contador: el descargo recién hecho es ahora "el último".
                if (menuItemId) setContext(await getDischargeContextAction(menuItemId));
            } else if (res.message.startsWith('Stock insuficiente:')) {
                // §155 — no es un error a gritar: se ofrece registrar igual
                // viendo en cuánto queda cada insumo.
                setShortfall(res.message.replace('Stock insuficiente:\n', ''));
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error('Error al registrar el descargo');
        } finally {
            setSubmitting(false);
        }
    }

    const lastLabel = context?.lastDischargeAt
        ? new Date(context.lastDischargeAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">
                        Descargo manual de consumo
                    </h1>
                    <p className="mt-1 text-sm text-capsula-ink-muted">
                        Registra la salida de insumos que la venta no descuenta sola —
                        platos sin receta, mermas, consumo interno.
                    </p>
                </div>
                <Link
                    href="/dashboard/inventario"
                    className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                >
                    <ArrowLeft className="h-4 w-4" /> Inventario
                </Link>
            </div>

            <div className="pos-card space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className="pos-label">Almacén *</span>
                        <select
                            value={areaId}
                            onChange={e => { setAreaId(e.target.value); setShortfall(null); }}
                            className="pos-input mt-1.5 w-full"
                        >
                            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="pos-label inline-flex items-center gap-1.5">
                            <UtensilsCrossed className="h-3.5 w-3.5" /> Plato vinculado (opcional)
                        </span>
                        <div className="mt-1.5">
                            <Combobox
                                items={[
                                    { value: '', label: '— Sin vínculo —' },
                                    ...menuItems.map(m => ({ value: m.id, label: m.name })),
                                ]}
                                value={menuItemId}
                                onChange={setMenuItemId}
                                placeholder="Ej. Arma tu Shawarma"
                                searchPlaceholder="Buscar plato…"
                                emptyMessage="Sin platos"
                            />
                        </div>
                    </label>
                </div>

                {menuItemId && context && (
                    <div className="rounded-xl bg-[#E6ECF4] px-4 py-3 text-sm text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]">
                        <span className="font-semibold tabular-nums">{context.soldSince}</span>{' '}
                        {context.soldSince === 1 ? 'unidad vendida' : 'unidades vendidas'}{' '}
                        {lastLabel
                            ? <>desde el último descargo de este plato ({lastLabel}).</>
                            : <>desde siempre — este plato todavía no tiene ningún descargo.</>}
                        {' '}Este descargo debería cubrir ese consumo.
                    </div>
                )}

                {/* §156.1 — Qué llevó cada unidad, según la nota del mesonero. */}
                {menuItemId && context && (notes.groups.length > 0 || notes.withoutNote > 0) && (
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface">
                        <button
                            onClick={() => setNotesOpen(o => !o)}
                            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                        >
                            <span className="text-sm font-semibold text-capsula-ink">
                                Con qué se despachó
                                <span className="ml-2 font-normal text-capsula-ink-muted">
                                    {notes.groups.length}{' '}
                                    {notes.groups.length === 1 ? 'combinación' : 'combinaciones'}
                                </span>
                            </span>
                            {notesOpen
                                ? <ChevronDown className="h-4 w-4 shrink-0 text-capsula-ink-muted" />
                                : <ChevronRight className="h-4 w-4 shrink-0 text-capsula-ink-muted" />}
                        </button>

                        {notesOpen && (
                            <div className="border-t border-capsula-line p-3">
                                <p className="mb-2 text-xs text-capsula-ink-muted">
                                    Notas de las unidades vendidas en el período. Multiplicá cada
                                    combinación por sus unidades para saber cuánto descargar.
                                </p>
                                <ul className="max-h-72 space-y-1 overflow-y-auto">
                                    {notes.groups.map(g => (
                                        <li
                                            key={g.note}
                                            className="flex items-start justify-between gap-3 rounded-lg bg-capsula-ivory-alt px-3 py-2"
                                        >
                                            <span className="min-w-0 whitespace-pre-wrap break-words text-sm text-capsula-ink">
                                                {g.note}
                                            </span>
                                            <span className="shrink-0 text-sm font-semibold tabular-nums text-capsula-ink">
                                                {formatNumber(g.units)} u.
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {notes.withoutNote > 0 && (
                                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#F3EAD6] px-3 py-2 text-xs text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            <span className="font-semibold tabular-nums">{notes.withoutNote}</span>{' '}
                                            {notes.withoutNote === 1 ? 'unidad se vendió' : 'unidades se vendieron'}{' '}
                                            sin nota — no hay registro de qué llevaron. Estimalas aparte.
                                        </span>
                                    </div>
                                )}

                                {context.truncated && (
                                    <p className="mt-2 text-xs text-capsula-ink-muted">
                                        Se listan las últimas 500 líneas del período. Hay más ventas
                                        sin descargar: conviene descargar más seguido.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Líneas */}
                <div className="space-y-2">
                    <span className="pos-label inline-flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" /> Insumos a descargar
                    </span>
                    {lines.map(line => {
                        const item = itemById(line.itemId);
                        return (
                            <div key={line.key} className="flex items-center justify-between rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-capsula-ink">{item?.name ?? line.itemId}</p>
                                    <p className="text-xs tabular-nums text-capsula-ink-muted">
                                        {formatNumber(line.quantity)} {item?.baseUnit ?? ''}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setLines(prev => prev.filter(l => l.key !== line.key)); setShortfall(null); }}
                                    className="rounded-full p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                    aria-label="Quitar"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}

                    <div className="grid gap-2 rounded-xl border border-capsula-line bg-capsula-ivory-alt p-3 sm:grid-cols-[1fr_110px_auto]">
                        <Combobox
                            items={items
                                .filter(i => !lines.some(l => l.itemId === i.id))
                                .map(i => ({
                                    value: i.id,
                                    label: `${i.name}${TYPE_TAG[i.type] ?? ''} (${i.baseUnit})`,
                                }))}
                            value={newItemId}
                            onChange={setNewItemId}
                            placeholder="Buscar insumo…"
                            searchPlaceholder="Buscar insumo…"
                            emptyMessage="Sin insumos"
                        />
                        <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={newQty || ''}
                            onChange={e => setNewQty(parseFloat(e.target.value) || 0)}
                            placeholder={`Cant.${newItemId ? ` (${itemById(newItemId)?.baseUnit ?? ''})` : ''}`}
                            className="pos-input"
                        />
                        <button
                            onClick={addLine}
                            disabled={!newItemId || newQty <= 0}
                            className="pos-btn-secondary inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
                        >
                            <Plus className="h-4 w-4" /> Agregar
                        </button>
                    </div>
                </div>

                <label className="block">
                    <span className="pos-label">Motivo *</span>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={2}
                        placeholder="Ej. Consumo Arma tu Shawarma, semana 10–16 de agosto"
                        className="pos-input mt-1.5 w-full resize-none"
                    />
                </label>

                <button
                    onClick={() => submit(false)}
                    disabled={submitting || lines.length === 0 || !areaId || !reason.trim()}
                    className="pos-btn inline-flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Registrar descargo ({lines.length} {lines.length === 1 ? 'insumo' : 'insumos'})
                </button>

                {/* §155 — Faltante: se ofrece registrar igual dejando en negativo. */}
                {shortfall && (
                    <div className="rounded-xl border border-[#E8D9B8] bg-[#F3EAD6] p-3 dark:border-[#5b4a24] dark:bg-[#3B2F15]">
                        <p className="text-sm font-semibold text-[#946A1C] dark:text-[#E8D9B8]">
                            Stock insuficiente en el sistema
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-[#946A1C] dark:text-[#E8D9B8]">{shortfall}</pre>
                        <p className="mt-2 text-xs text-[#946A1C] dark:text-[#E8D9B8]">
                            Si el consumo fue real y sólo falta cargar la entrada, registrá
                            igual: los insumos quedan en negativo y el saldo se acomoda al
                            cargarla.
                        </p>
                        <button
                            onClick={() => submit(true)}
                            disabled={submitting}
                            className="mt-3 w-full rounded-lg border border-[#946A1C] px-3 py-2 text-sm font-semibold text-[#946A1C] transition-colors hover:bg-[#946A1C]/10 disabled:opacity-40 dark:border-[#E8D9B8] dark:text-[#E8D9B8]"
                        >
                            Registrar igual y dejar en negativo
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
