'use client';

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface HistoryPoint {
    id: string;
    unitPrice: number;
    currency: string;
    effectiveFrom: Date | string;
    effectiveTo: Date | string | null;
    notes: string | null;
    purchaseOrderId: string | null;
}

export interface SupplierItemHistory {
    supplierItemId: string;
    inventoryItemId: string;
    sku: string | null;
    name: string;
    category: string | null;
    baseUnit: string;
    currentPrice: number | null;
    isPreferred: boolean;
    leadTimeDays: number | null;
    history: HistoryPoint[];
}

interface Props {
    items: SupplierItemHistory[];
}

export default function PriceHistoryChart({ items }: Props) {
    const itemsWithHistory = useMemo(() => items.filter(i => i.history.length > 0), [items]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(itemsWithHistory[0]?.inventoryItemId ?? null);

    const selected = useMemo(
        () => items.find(i => i.inventoryItemId === selectedItemId) ?? null,
        [items, selectedItemId]
    );

    // Datos para el gráfico: orden cronológico (más viejo a la izquierda).
    const chartData = useMemo(() => {
        if (!selected) return [];
        return [...selected.history]
            .reverse()
            .map(h => ({
                ts: new Date(h.effectiveFrom).getTime(),
                date: formatDate(h.effectiveFrom),
                price: h.unitPrice,
            }));
    }, [selected]);

    const trend = useMemo(() => {
        if (!selected || selected.history.length < 2) return 'flat' as const;
        const newest = selected.history[0]?.unitPrice ?? 0;
        const previous = selected.history[1]?.unitPrice ?? 0;
        if (Math.abs(newest - previous) < 0.0001) return 'flat' as const;
        return newest > previous ? 'up' : 'down';
    }, [selected]);

    const trendDelta = useMemo(() => {
        if (!selected || selected.history.length < 2) return 0;
        const newest = selected.history[0]?.unitPrice ?? 0;
        const previous = selected.history[1]?.unitPrice ?? 0;
        if (previous === 0) return 0;
        return ((newest - previous) / previous) * 100;
    }, [selected]);

    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-12 text-center">
                <Package className="mx-auto h-10 w-10 text-capsula-ink-muted" />
                <h2 className="mt-4 font-semibold text-capsula-ink">Este proveedor no tiene productos asignados</h2>
                <p className="mt-2 text-sm text-capsula-ink-muted">
                    Crea órdenes de compra recibidas para que el sistema registre los precios automáticamente.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Lista de items */}
            <aside className="rounded-xl border border-capsula-line bg-capsula-ivory">
                <div className="border-b border-capsula-line px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                        Productos suministrados
                    </p>
                    <p className="mt-1 text-sm font-semibold text-capsula-ink tabular-nums">
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                        <span className="ml-2 font-normal text-capsula-ink-muted">
                            ({itemsWithHistory.length} con histórico)
                        </span>
                    </p>
                </div>
                <ul className="max-h-[60vh] overflow-y-auto divide-y divide-capsula-line">
                    {items.map(item => {
                        const isActive = item.inventoryItemId === selectedItemId;
                        const hasHistory = item.history.length > 0;
                        return (
                            <li key={item.supplierItemId}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedItemId(item.inventoryItemId)}
                                    disabled={!hasHistory}
                                    className={
                                        'w-full px-4 py-3 text-left transition-colors ' +
                                        (isActive
                                            ? 'bg-capsula-navy-soft'
                                            : hasHistory
                                                ? 'hover:bg-capsula-ivory-alt'
                                                : 'opacity-50 cursor-not-allowed')
                                    }
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            {item.sku && (
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                                    {item.sku}
                                                </p>
                                            )}
                                            <p className="font-semibold text-sm text-capsula-ink truncate">{item.name}</p>
                                            {item.category && (
                                                <p className="text-xs text-capsula-ink-muted truncate">{item.category}</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-semibold text-sm text-capsula-ink tabular-nums">
                                                {item.currentPrice !== null ? formatCurrency(item.currentPrice) : '—'}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-capsula-ink-muted">
                                                {item.history.length} {item.history.length === 1 ? 'punto' : 'puntos'}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </aside>

            {/* Gráfico + tabla del item seleccionado */}
            <section className="rounded-xl border border-capsula-line bg-capsula-ivory">
                {selected ? (
                    <>
                        <div className="border-b border-capsula-line px-5 py-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    {selected.sku && (
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                            {selected.sku}
                                        </p>
                                    )}
                                    <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                                        {selected.name}
                                    </h2>
                                    <p className="text-xs text-capsula-ink-muted">
                                        Unidad: <span className="font-mono">{selected.baseUnit}</span>
                                        {selected.category && <> · {selected.category}</>}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                        Precio vigente
                                    </p>
                                    <p className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink tabular-nums">
                                        {selected.currentPrice !== null ? formatCurrency(selected.currentPrice) : '—'}
                                    </p>
                                    {selected.history.length >= 2 && (
                                        <p
                                            className={
                                                'mt-0.5 inline-flex items-center gap-1 text-xs tabular-nums ' +
                                                (trend === 'up'
                                                    ? 'text-[#B04A2E] dark:text-[#EFD2C8]'
                                                    : trend === 'down'
                                                        ? 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                                        : 'text-capsula-ink-muted')
                                            }
                                        >
                                            {trend === 'up' ? (
                                                <TrendingUp className="h-3 w-3" />
                                            ) : trend === 'down' ? (
                                                <TrendingDown className="h-3 w-3" />
                                            ) : (
                                                <Minus className="h-3 w-3" />
                                            )}
                                            {trendDelta > 0 ? '+' : ''}
                                            {trendDelta.toFixed(1)}% vs anterior
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {chartData.length > 0 ? (
                            <div className="px-5 py-4">
                                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Evolución del precio unitario
                                </p>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={chartData}
                                            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid stroke="rgb(var(--capsula-line-rgb))" strokeDasharray="3 3" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 10, fill: 'rgb(var(--capsula-ink-muted-rgb))' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: 'rgb(var(--capsula-ink-muted-rgb))' }}
                                                axisLine={false}
                                                tickLine={false}
                                                width={60}
                                                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                                            />
                                            <Tooltip
                                                formatter={(value: number) => [formatCurrency(value), 'Precio']}
                                                contentStyle={{
                                                    background: 'rgb(var(--capsula-ivory-rgb))',
                                                    border: '1px solid rgb(var(--capsula-line-rgb))',
                                                    borderRadius: 12,
                                                    fontSize: 12,
                                                    color: 'rgb(var(--capsula-ink-rgb))',
                                                }}
                                                labelStyle={{
                                                    color: 'rgb(var(--capsula-ink-muted-rgb))',
                                                    fontSize: 10,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.14em',
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="price"
                                                stroke="rgb(var(--capsula-coral-rgb))"
                                                strokeWidth={2}
                                                dot={{ fill: 'rgb(var(--capsula-coral-rgb))', r: 4 }}
                                                activeDot={{ r: 6 }}
                                                isAnimationActive={false}
                                            />
                                            {chartData.length > 0 && (
                                                <ReferenceDot
                                                    x={chartData[chartData.length - 1].date}
                                                    y={chartData[chartData.length - 1].price}
                                                    r={5}
                                                    fill="rgb(var(--capsula-navy-deep-rgb))"
                                                    stroke="rgb(var(--capsula-ivory-rgb))"
                                                    strokeWidth={2}
                                                />
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                            <div className="px-5 py-8 text-center">
                                <p className="text-sm text-capsula-ink-muted">
                                    Aún no hay puntos en el histórico para este producto.
                                </p>
                                <p className="mt-1 text-xs text-capsula-ink-muted">
                                    Se crearán automáticamente al recibir órdenes de compra.
                                </p>
                            </div>
                        )}

                        {/* Tabla de puntos */}
                        {selected.history.length > 0 && (
                            <div className="border-t border-capsula-line">
                                <div className="px-5 py-3 border-b border-capsula-line">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                        Detalle ({selected.history.length})
                                    </p>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-capsula-ivory-alt">
                                            <tr>
                                                <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                                    Vigente desde
                                                </th>
                                                <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                                    Vigente hasta
                                                </th>
                                                <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                                    Precio
                                                </th>
                                                <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                                    Δ
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-capsula-line">
                                            {selected.history.map((h, idx) => {
                                                const isCurrent = h.effectiveTo === null;
                                                const next = selected.history[idx + 1];
                                                const delta = next ? h.unitPrice - next.unitPrice : 0;
                                                const deltaPct = next && next.unitPrice > 0 ? (delta / next.unitPrice) * 100 : 0;
                                                return (
                                                    <tr key={h.id} className={isCurrent ? 'bg-capsula-navy-soft/30' : ''}>
                                                        <td className="px-5 py-2 tabular-nums text-capsula-ink">
                                                            {formatDate(h.effectiveFrom)}
                                                        </td>
                                                        <td className="px-5 py-2 tabular-nums text-capsula-ink-soft">
                                                            {h.effectiveTo ? formatDate(h.effectiveTo) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-coral">
                                                                    Vigente
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-2 text-right tabular-nums font-semibold text-capsula-ink">
                                                            {formatCurrency(h.unitPrice)}
                                                        </td>
                                                        <td className="px-5 py-2 text-right tabular-nums text-xs">
                                                            {next ? (
                                                                <span
                                                                    className={
                                                                        delta > 0
                                                                            ? 'text-[#B04A2E] dark:text-[#EFD2C8]'
                                                                            : delta < 0
                                                                                ? 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                                                                : 'text-capsula-ink-muted'
                                                                    }
                                                                >
                                                                    {delta > 0 ? '+' : ''}
                                                                    {deltaPct.toFixed(1)}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-capsula-ink-muted">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-12 text-center">
                        <Package className="mx-auto h-10 w-10 text-capsula-ink-muted" />
                        <p className="mt-4 text-sm text-capsula-ink-muted">
                            Selecciona un producto en la izquierda para ver su histórico.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
