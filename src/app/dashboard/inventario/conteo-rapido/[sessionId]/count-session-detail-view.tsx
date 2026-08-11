'use client';

/**
 * Pantalla de conteo de una sesión (§138.3).
 *
 * Cada cantidad se guarda SOLA en el servidor (debounce corto). Eso es lo que
 * permite cerrar la tablet y retomar mañana desde otro equipo sin perder nada.
 * Una casilla por almacén, rotulada — antes eran cajas anónimas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Printer, Loader2, Check, EyeOff, AlertTriangle, ClipboardList,
    Search, History, Ban, Undo2,
} from 'lucide-react';
import {
    saveCountEntriesAction,
    getCountVariancesAction,
    sendCountToReviewAction,
    reopenCountSessionAction,
    applyCountSessionAction,
    type CountSessionDetail,
    type ReviewRow,
} from '@/app/actions/count-session.actions';
import { formatNumber } from '@/lib/utils';

interface Props {
    initial: CountSessionDetail;
}

type Draft = Record<string, string>; // `${itemId}::${areaId}` → texto de la casilla

const key = (itemId: string, areaId: string) => `${itemId}::${areaId}`;

const EVENT_LABEL: Record<string, string> = {
    CREATED: 'Conteo abierto',
    RESUMED: 'Retomado',
    REVIEW: 'Enviado a revisión',
    REOPENED: 'Reabierto para seguir contando',
    APPLIED: 'Aplicado al inventario',
    CANCELLED: 'Cancelado',
};

export default function CountSessionDetailView({ initial }: Props) {
    const router = useRouter();
    const [status, setStatus] = useState(initial.status);
    const [search, setSearch] = useState('');
    const [onlyPending, setOnlyPending] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [busy, setBusy] = useState(false);

    // Texto de cada casilla, sembrado con lo ya contado en la sesión.
    const [draft, setDraft] = useState<Draft>(() => {
        const d: Draft = {};
        for (const it of initial.items) {
            for (const [areaId, qty] of Object.entries(it.countedByArea)) {
                d[key(it.inventoryItemId, areaId)] = String(qty);
            }
        }
        return d;
    });

    // Cola de cambios pendientes de guardar.
    const dirty = useRef<Map<string, { inventoryItemId: string; areaId: string; qty: number | null }>>(new Map());
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flush = useCallback(async () => {
        if (dirty.current.size === 0) return;
        const batch = Array.from(dirty.current.values());
        dirty.current.clear();
        setSaveState('saving');
        const res = await saveCountEntriesAction({ sessionId: initial.id, entries: batch });
        if (res.success) {
            setSaveState('saved');
        } else {
            setSaveState('error');
            toast.error(res.message);
            // Se devuelven a la cola: no perdemos lo tipeado por un fallo de red.
            for (const e of batch) dirty.current.set(key(e.inventoryItemId, e.areaId), e);
        }
    }, [initial.id]);

    // Guardado automático con debounce corto.
    useEffect(() => {
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, []);

    // Red de seguridad: si cierran la pestaña con algo sin guardar, se intenta
    // mandar igual (el navegador no espera, pero suele alcanzar).
    useEffect(() => {
        const onHide = () => { if (dirty.current.size > 0) void flush(); };
        window.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onHide);
        return () => {
            window.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onHide);
        };
    }, [flush]);

    const onChange = (itemId: string, areaId: string, raw: string) => {
        const k = key(itemId, areaId);
        setDraft(prev => ({ ...prev, [k]: raw }));

        const trimmed = raw.trim();
        const parsed = trimmed === '' ? null : Number(trimmed.replace(',', '.'));
        if (parsed !== null && Number.isNaN(parsed)) return; // no guardamos basura

        dirty.current.set(k, { inventoryItemId: itemId, areaId, qty: parsed });
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { void flush(); }, 700);
    };

    // ── Filtro + agrupación por categoría (mismo orden que la hoja impresa)
    const filtered = useMemo(() => {
        let rows = initial.items;
        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter(i => `${i.sku} ${i.name} ${i.category}`.toLowerCase().includes(q));
        }
        if (onlyPending) {
            rows = rows.filter(i =>
                initial.areas.some(a => (draft[key(i.inventoryItemId, a.id)] ?? '').trim() === ''),
            );
        }
        return rows;
    }, [initial.items, initial.areas, search, onlyPending, draft]);

    const grouped = useMemo(() => {
        const map = new Map<string, typeof filtered>();
        for (const it of filtered) {
            const arr = map.get(it.category) ?? [];
            arr.push(it);
            map.set(it.category, arr);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    // Avance en vivo, contando lo que hay escrito ahora mismo.
    const progress = useMemo(() => initial.areas.map(a => {
        const counted = initial.items.filter(
            i => (draft[key(i.inventoryItemId, a.id)] ?? '').trim() !== '',
        ).length;
        const total = initial.items.length;
        return { areaId: a.id, name: a.name, counted, total, pct: total ? Math.round((counted / total) * 100) : 0 };
    }), [initial.areas, initial.items, draft]);

    // ── Revisión de diferencias
    const [review, setReview] = useState<{ flagged: ReviewRow[]; totalWithVariance: number; totalEntries: number } | null>(null);

    const loadReview = useCallback(async () => {
        setBusy(true);
        const res = await getCountVariancesAction(initial.id);
        setBusy(false);
        if (res.success && res.data) setReview(res.data);
        else toast.error(res.message);
    }, [initial.id]);

    useEffect(() => {
        if (status === 'REVIEW') void loadReview();
    }, [status, loadReview]);

    async function handleSendToReview() {
        await flush();
        setBusy(true);
        const res = await sendCountToReviewAction(initial.id);
        setBusy(false);
        if (!res.success) { toast.error(res.message); return; }
        toast.success(res.message);
        setStatus('REVIEW');
    }

    async function handleReopen() {
        setBusy(true);
        const res = await reopenCountSessionAction(initial.id);
        setBusy(false);
        if (!res.success) { toast.error(res.message); return; }
        toast.success(res.message);
        setStatus('OPEN');
        setReview(null);
    }

    async function handleApply() {
        const n = review?.totalWithVariance ?? 0;
        const ok = window.confirm(
            `Se va a ajustar el inventario de ${initial.areas.length} almacén(es).\n\n` +
            `${n} producto(s) quedarán con una cantidad distinta a la actual.\n\n` +
            'Esta acción no se puede deshacer. ¿Confirmás?',
        );
        if (!ok) return;
        setBusy(true);
        const res = await applyCountSessionAction(initial.id);
        setBusy(false);
        if (!res.success) { toast.error(res.message); return; }
        toast.success(res.message);
        router.push('/dashboard/inventario/conteo-rapido');
        router.refresh();
    }

    const areaIdsParam = initial.areas.map(a => a.id).join(',');
    const isOpen = status === 'OPEN';
    const isReview = status === 'REVIEW';
    const closed = status === 'APPLIED' || status === 'CANCELLED';

    return (
        <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-6">
            {/* Header */}
            <div>
                <Link
                    href="/dashboard/inventario/conteo-rapido"
                    className="mb-2 inline-flex items-center gap-1 text-sm text-capsula-coral hover:underline"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Conteos
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink sm:text-2xl">
                        {initial.name || initial.code}
                    </h1>
                    <span className="font-mono text-xs text-capsula-ink-muted">{initial.code}</span>
                    {initial.blindMode && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-capsula-navy-soft px-2 py-0.5 text-[10px] font-semibold text-capsula-ink">
                            <EyeOff className="h-3 w-3" /> A ciegas
                        </span>
                    )}
                </div>
                <p className="mt-1 text-xs text-capsula-ink-muted">{initial.areas.map(a => a.name).join(' · ')}</p>
            </div>

            {/* Avance por almacén */}
            <div className="grid gap-2 sm:grid-cols-3">
                {progress.map(p => (
                    <div key={p.areaId} className="rounded-xl border border-capsula-line bg-capsula-ivory p-3">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            {p.name}
                        </p>
                        <p className="mt-1 font-semibold text-lg tabular-nums text-capsula-ink">
                            {p.counted}<span className="text-sm text-capsula-ink-muted"> / {p.total}</span>
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-capsula-ivory-alt">
                            <div className="h-full rounded-full bg-capsula-navy-deep" style={{ width: `${p.pct}%` }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Barra de acciones */}
            <div className="flex flex-wrap items-center gap-2">
                <Link
                    href={`/dashboard/inventario/imprimir?layout=count&areas=${encodeURIComponent(areaIdsParam)}`}
                    target="_blank"
                    className="pos-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                >
                    <Printer className="h-3.5 w-3.5" /> Imprimir hoja
                </Link>
                <button
                    onClick={() => setShowLog(v => !v)}
                    className="pos-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                >
                    <History className="h-3.5 w-3.5" /> Historial
                </button>

                <span className="ml-auto text-[11px] text-capsula-ink-muted">
                    {saveState === 'saving' && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Guardando…</span>}
                    {saveState === 'saved' && <span className="inline-flex items-center gap-1 text-[#2F6B4E] dark:text-[#6FB88F]"><Check className="h-3 w-3" /> Guardado</span>}
                    {saveState === 'error' && <span className="inline-flex items-center gap-1 text-capsula-coral"><AlertTriangle className="h-3 w-3" /> Sin guardar</span>}
                </span>

                {isOpen && (
                    <button
                        onClick={handleSendToReview}
                        disabled={busy}
                        className="pos-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
                        Revisar diferencias
                    </button>
                )}
                {isReview && (
                    <button
                        onClick={handleReopen}
                        disabled={busy}
                        className="pos-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
                    >
                        <Undo2 className="h-3.5 w-3.5" /> Seguir contando
                    </button>
                )}
            </div>

            {/* Bitácora */}
            {showLog && (
                <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-4">
                    <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Historial del conteo
                    </h2>
                    <ul className="space-y-1.5">
                        {initial.events.map((e, i) => (
                            <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs text-capsula-ink">
                                <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                                <span className="text-capsula-ink-muted">· {e.userName}</span>
                                <span className="text-capsula-ink-muted tabular-nums">
                                    · {new Date(e.at).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {e.detail && <span className="text-capsula-ink-muted">· {e.detail}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── REVISIÓN ─────────────────────────────────────────────────── */}
            {isReview && (
                <div className="space-y-3 rounded-2xl border border-capsula-line bg-capsula-ivory p-5">
                    <h2 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                        Diferencias a revisar
                    </h2>
                    {!review ? (
                        <p className="inline-flex items-center gap-2 text-sm text-capsula-ink-muted">
                            <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-capsula-ink-soft">
                                {review.totalEntries} cantidades cargadas · {review.totalWithVariance} con diferencia
                                {review.flagged.length > 0 && ` · ${review.flagged.length} merecen una mirada`}
                            </p>

                            {review.flagged.length === 0 ? (
                                <div className="rounded-xl bg-[#E5EDE7] p-3 text-xs text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]">
                                    Ninguna diferencia grande. Podés aplicar con tranquilidad.
                                </div>
                            ) : (
                                <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-capsula-line">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-capsula-ivory-alt">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.1em] text-capsula-ink-muted">Producto</th>
                                                <th className="px-2 py-2 text-left font-semibold uppercase tracking-[0.1em] text-capsula-ink-muted">Almacén</th>
                                                <th className="px-2 py-2 text-right font-semibold uppercase tracking-[0.1em] text-capsula-ink-muted">Sistema</th>
                                                <th className="px-2 py-2 text-right font-semibold uppercase tracking-[0.1em] text-capsula-ink-muted">Contado</th>
                                                <th className="px-3 py-2 text-right font-semibold uppercase tracking-[0.1em] text-capsula-ink-muted">Dif.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-capsula-line">
                                            {review.flagged.map((r, i) => (
                                                <tr key={`${r.inventoryItemId}-${r.areaId}-${i}`}>
                                                    <td className="px-3 py-2">
                                                        <span className="font-medium text-capsula-ink">{r.name}</span>
                                                        <span className="ml-1 font-mono text-[10px] text-capsula-ink-muted">{r.sku}</span>
                                                    </td>
                                                    <td className="px-2 py-2 text-capsula-ink-muted">{r.areaName}</td>
                                                    <td className="px-2 py-2 text-right tabular-nums text-capsula-ink-muted">{formatNumber(r.system)}</td>
                                                    <td className="px-2 py-2 text-right tabular-nums text-capsula-ink">{formatNumber(r.counted)}</td>
                                                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${
                                                        r.variance < 0 ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                                    }`}>
                                                        {r.variance > 0 ? '+' : ''}{formatNumber(r.variance)} {r.baseUnit}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {initial.canApply ? (
                                <button
                                    onClick={handleApply}
                                    disabled={busy}
                                    className="pos-btn inline-flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
                                >
                                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    Aplicar y ajustar el inventario
                                </button>
                            ) : (
                                <div className="rounded-xl bg-[#F3EAD6] p-3 text-xs text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                                    El conteo quedó listo. El ajuste al inventario lo confirma gerencia o auditoría.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {closed && (
                <div className="rounded-xl bg-capsula-ivory-alt p-4 text-sm text-capsula-ink-muted">
                    <span className="inline-flex items-center gap-2">
                        {status === 'APPLIED' ? <Check className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        Este conteo está {status === 'APPLIED' ? 'aplicado' : 'cancelado'} — es solo lectura.
                    </span>
                </div>
            )}

            {/* ── CONTEO ───────────────────────────────────────────────────── */}
            {isOpen && (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[200px] flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por SKU, nombre o categoría…"
                                className="pos-input w-full pl-10"
                            />
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={onlyPending}
                                onChange={e => setOnlyPending(e.target.checked)}
                                className="h-4 w-4"
                            />
                            <span className="text-capsula-ink">Solo pendientes</span>
                        </label>
                    </div>

                    {grouped.map(([category, rows]) => (
                        <div key={category} className="overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory">
                            <div className="border-b border-capsula-line bg-capsula-ivory-surface px-4 py-2">
                                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-soft">
                                    {category}
                                </h2>
                            </div>
                            {/* Rótulo de cada casilla: sin esto no se sabe cuál almacén es cuál */}
                            <div className="flex items-center gap-2 border-b border-capsula-line bg-capsula-ivory-surface/60 px-3 py-1.5 sm:px-4">
                                <div className="min-w-0 flex-1" />
                                {initial.areas.map(a => (
                                    <span
                                        key={a.id}
                                        title={a.name}
                                        className="w-20 truncate text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-capsula-ink-muted sm:w-24"
                                    >
                                        {a.name}
                                    </span>
                                ))}
                            </div>
                            <div className="divide-y divide-capsula-line">
                                {rows.map(item => (
                                    <div key={item.inventoryItemId} className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-capsula-ink">{item.name}</p>
                                            <p className="truncate font-mono text-[10px] text-capsula-ink-muted">
                                                {item.sku} · {item.baseUnit}
                                                {!initial.blindMode && initial.areas.length > 0 && (
                                                    <> · sistema: {initial.areas.map(a => formatNumber(item.stockByArea[a.id] ?? 0)).join(' / ')}</>
                                                )}
                                            </p>
                                        </div>
                                        {initial.areas.map(a => (
                                            <input
                                                key={a.id}
                                                type="number"
                                                inputMode="decimal"
                                                step="any"
                                                placeholder="—"
                                                aria-label={`${item.name} en ${a.name}`}
                                                value={draft[key(item.inventoryItemId, a.id)] ?? ''}
                                                onChange={e => onChange(item.inventoryItemId, a.id, e.target.value)}
                                                className="w-20 rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1.5 text-right font-semibold tabular-nums text-capsula-ink focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/30 sm:w-24"
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {grouped.length === 0 && (
                        <p className="py-10 text-center text-sm text-capsula-ink-muted">
                            No hay productos que coincidan con el filtro.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
