'use client';

/**
 * Kardex por producto (§145).
 *
 * Pedido tras el caso "masa filo: cargué 39, aparecen 42": elegir un
 * producto y ver TODOS sus movimientos con saldo corrido — qué entró, qué
 * salió, quién y cuándo — más una conciliación explícita: si la historia de
 * movimientos no explica el stock actual, el descuadre se muestra con número.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Loader2, BookOpenText, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { formatNumber, cn } from '@/lib/utils';
import { getItemKardexAction, type KardexResult } from '@/app/actions/kardex.actions';

interface Props {
    items: { id: string; name: string; sku: string }[];
    areas: { id: string; name: string }[];
}

/** Etiquetas legibles por tipo de movimiento. */
const TYPE_LABEL: Record<string, string> = {
    PURCHASE: 'Compra',
    SALE: 'Venta',
    PRODUCTION: 'Producción',
    PRODUCTION_IN: 'Producción (entrada)',
    PRODUCTION_OUT: 'Producción (consumo)',
    ADJUSTMENT_IN: 'Ajuste +',
    ADJUSTMENT_OUT: 'Ajuste −',
    TRANSFER_IN: 'Transferencia (entra)',
    TRANSFER_OUT: 'Transferencia (sale)',
    WASTE: 'Merma',
    LOAN_OUT: 'Préstamo (sale)',
    LOAN_RETURN: 'Préstamo (vuelve)',
};

const RANGE_OPTIONS = [
    { days: 7, label: '7 días' },
    { days: 30, label: '30 días' },
    { days: 90, label: '90 días' },
    { days: 365, label: '1 año' },
];

export default function KardexView({ items, areas }: Props) {
    const [itemId, setItemId] = useState('');
    const [areaId, setAreaId] = useState('');
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<KardexResult | null>(null);

    const load = useCallback(async () => {
        if (!itemId) return;
        setLoading(true);
        const res = await getItemKardexAction({ inventoryItemId: itemId, areaId: areaId || null, days });
        setLoading(false);
        if (!res.success || !res.data) {
            toast.error(res.message ?? 'Error');
            return;
        }
        setData(res.data);
    }, [itemId, areaId, days]);

    useEffect(() => { void load(); }, [load]);

    const fmtDateTime = (d: Date | string) =>
        new Date(d).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
            <div>
                <Link
                    href="/dashboard/inventario"
                    className="mb-2 inline-flex items-center gap-1 text-sm text-capsula-coral hover:underline"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Inventario
                </Link>
                <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-[-0.02em] text-capsula-ink sm:text-3xl">
                    <BookOpenText className="h-7 w-7" /> Kardex
                </h1>
                <p className="mt-1 text-sm text-capsula-ink-soft">
                    Movimiento por movimiento de un producto, con saldo corrido y conciliación
                    contra el stock actual.
                </p>
            </div>

            {/* Selección */}
            <div className="grid gap-3 rounded-2xl border border-capsula-line bg-capsula-ivory p-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Producto
                    </label>
                    <Combobox
                        items={items.map(i => ({ value: i.id, label: `${i.name} (${i.sku})` }))}
                        value={itemId}
                        onChange={setItemId}
                        placeholder="— Buscar producto —"
                        searchPlaceholder="Nombre o SKU…"
                        emptyMessage="Sin resultados."
                    />
                </div>
                <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Almacén
                    </label>
                    <select value={areaId} onChange={e => setAreaId(e.target.value)} className="pos-input w-full">
                        <option value="">Todos (global)</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
                    {RANGE_OPTIONS.map(r => (
                        <button
                            key={r.days}
                            onClick={() => setDays(r.days)}
                            className={cn(
                                'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                                days === r.days
                                    ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                    : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted hover:border-capsula-line-strong',
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-capsula-ink-muted" />}
                </div>
            </div>

            {!itemId && (
                <p className="py-10 text-center text-sm text-capsula-ink-muted">
                    Elegí un producto para ver su kardex.
                </p>
            )}

            {data && (
                <>
                    {/* Stock actual por almacén */}
                    <div className="grid gap-2 sm:grid-cols-4">
                        {data.stockByArea.map(a => (
                            <div key={a.areaId} className="rounded-xl border border-capsula-line bg-capsula-ivory p-3">
                                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{a.areaName}</p>
                                <p className="mt-1 font-semibold text-lg tabular-nums text-capsula-ink">
                                    {formatNumber(a.currentStock)} <span className="text-xs text-capsula-ink-muted">{data.item.baseUnit}</span>
                                </p>
                            </div>
                        ))}
                        <div className="rounded-xl border border-capsula-line bg-capsula-navy-soft p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Total</p>
                            <p className="mt-1 font-semibold text-lg tabular-nums text-capsula-ink">
                                {formatNumber(data.totalStock)} <span className="text-xs text-capsula-ink-muted">{data.item.baseUnit}</span>
                            </p>
                        </div>
                    </div>

                    {/* Conciliación */}
                    {data.reconciliation.hasDiscrepancy ? (
                        <div className="flex gap-3 rounded-xl bg-[#F3EAD6] p-4 text-sm text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                            <div>
                                <p className="font-semibold">
                                    Los movimientos no explican el stock {data.scopeAreaName ? `de ${data.scopeAreaName}` : 'total'}.
                                </p>
                                <p className="mt-1 opacity-90">
                                    Historia completa de movimientos: {formatNumber(data.reconciliation.sumAllDeltas)} {data.item.baseUnit} ·
                                    Stock actual: {formatNumber(data.scopeAreaName ? (data.stockByArea.find(a => a.areaName === data.scopeAreaName)?.currentStock ?? 0) : data.totalStock)} {data.item.baseUnit} ·{' '}
                                    <strong>{data.reconciliation.unexplained > 0 ? '+' : ''}{formatNumber(data.reconciliation.unexplained)} {data.item.baseUnit} sin movimiento que lo respalde</strong>.
                                    Causas típicas: carga inicial por Excel, ajustes directos de módulos viejos, o stock repartido en otro almacén.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-xl bg-[#E5EDE7] p-3 text-sm text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            La historia de movimientos ({data.reconciliation.totalMovements}) explica exactamente el stock actual.
                        </div>
                    )}

                    {data.excludedNoArea > 0 && (
                        <p className="rounded-xl bg-capsula-ivory-alt p-3 text-xs text-capsula-ink-muted">
                            ⚠ {data.excludedNoArea} movimiento(s) del rango no tienen almacén asignado y quedan fuera
                            de esta vista por-almacén. Cambiá a «Todos (global)» para verlos.
                        </p>
                    )}

                    {/* Tabla kardex */}
                    <div className="overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-capsula-ivory-alt">
                                    <tr>
                                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Fecha</th>
                                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Tipo</th>
                                        <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted md:table-cell">Detalle</th>
                                        <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted sm:table-cell">Almacén</th>
                                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Entra</th>
                                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Sale</th>
                                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Saldo</th>
                                        <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted lg:table-cell">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-capsula-line">
                                    {data.rows.map(r => (
                                        <tr key={r.id} className="hover:bg-capsula-ivory-alt/50">
                                            <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-capsula-ink-soft">{fmtDateTime(r.createdAt)}</td>
                                            <td className="px-3 py-2">
                                                <span className={cn(
                                                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                                                    r.direction === 'IN'
                                                        ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                                        : r.direction === 'OUT'
                                                            ? 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]'
                                                            : 'bg-capsula-ivory-alt text-capsula-ink-muted',
                                                )}>
                                                    {TYPE_LABEL[r.movementType] ?? r.movementType}
                                                </span>
                                            </td>
                                            <td className="hidden max-w-[280px] truncate px-3 py-2 text-xs text-capsula-ink-muted md:table-cell" title={r.reference}>
                                                {r.reference || '—'}
                                            </td>
                                            <td className="hidden px-3 py-2 text-xs text-capsula-ink-muted sm:table-cell">{r.areaName ?? '—'}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-[#2F6B4E] dark:text-[#6FB88F]">
                                                {r.qtyIn > 0 ? `+${formatNumber(r.qtyIn)}` : ''}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-[#B04A2E] dark:text-[#EFD2C8]">
                                                {r.qtyOut > 0 ? `−${formatNumber(r.qtyOut)}` : ''}
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-capsula-ink">{formatNumber(r.balanceAfter)}</td>
                                            <td className="hidden px-3 py-2 text-xs text-capsula-ink-muted lg:table-cell">{r.createdByName}</td>
                                        </tr>
                                    ))}
                                    {data.rows.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-10 text-center text-capsula-ink-muted">
                                                Sin movimientos en este rango{data.scopeAreaName ? ` para ${data.scopeAreaName}` : ''}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {data.rows.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t border-capsula-line bg-capsula-ivory-alt/60">
                                            <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.1em] text-capsula-ink-muted">
                                                Saldo al inicio del rango
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-capsula-ink">
                                                {formatNumber(data.openingBalance)}
                                            </td>
                                            <td className="hidden lg:table-cell" />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
