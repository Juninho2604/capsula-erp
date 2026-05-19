'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Calendar,
    Download,
    Search,
    ChevronDown,
    ChevronRight,
    Utensils,
    ShoppingBag,
    Loader2,
} from 'lucide-react';
import {
    getSoldItemsReportAction,
    type SoldItemRow,
    type SoldItemsReport,
} from '@/app/actions/sales/sold-items-report.actions';
import { getAreasAction } from '@/app/actions/areas.actions';
import { cn } from '@/lib/utils';

function todayISO(offsetDays = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

export default function SoldItemsReportPage() {
    const [startDate, setStartDate] = useState(todayISO(-6));
    const [endDate, setEndDate] = useState(todayISO(0));
    const [areaId, setAreaId] = useState('');
    const [orderType, setOrderType] = useState('');
    const [search, setSearch] = useState('');
    const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
    const [data, setData] = useState<SoldItemsReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Cargar áreas para el filtro
    useEffect(() => {
        (async () => {
            const res = await getAreasAction();
            if (res.success && res.data) setAreas(res.data);
        })();
    }, []);

    const loadReport = async () => {
        setLoading(true);
        setErrorMsg(null);
        const res = await getSoldItemsReportAction({
            startDate,
            endDate,
            areaId: areaId || undefined,
            orderType: orderType || undefined,
        });
        if (res.success && res.data) {
            setData(res.data);
        } else {
            setErrorMsg(res.message ?? 'Error desconocido');
            setData(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredItems = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        if (!q) return data.items;
        return data.items.filter(
            (r) =>
                r.menuItemName.toLowerCase().includes(q) ||
                r.categoryName.toLowerCase().includes(q),
        );
    }, [data, search]);

    const toggleExpanded = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const exportToCsv = () => {
        if (!data) return;
        const lines: string[] = [];
        lines.push('PRODUCTO,CATEGORÍA,UNIDADES,INGRESOS,PRECIO_PROM');
        for (const r of filteredItems) {
            lines.push(
                [
                    `"${r.menuItemName.replace(/"/g, '""')}"`,
                    `"${r.categoryName.replace(/"/g, '""')}"`,
                    r.unitsSold,
                    r.revenue.toFixed(2),
                    r.avgPrice.toFixed(2),
                ].join(','),
            );
        }
        // Sub-tabla de modifiers
        lines.push('');
        lines.push('PRODUCTO,MODIFICADOR,VECES_ELEGIDO,CONTRIBUCIÓN_$');
        for (const r of filteredItems) {
            for (const m of r.modifiers) {
                lines.push(
                    [
                        `"${r.menuItemName.replace(/"/g, '""')}"`,
                        `"${m.name.replace(/"/g, '""')}"`,
                        m.count,
                        m.revenueContribution.toFixed(2),
                    ].join(','),
                );
            }
        }
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platos_vendidos_${startDate}_a_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                        Platos vendidos
                    </h1>
                    <p className="text-sm text-capsula-ink-muted mt-1">
                        Reporte de unidades vendidas en el POS por rango de fecha,
                        con detalle de modificadores. Excluye órdenes anuladas e
                        items individualmente anulados.
                    </p>
                </div>
                <button
                    onClick={exportToCsv}
                    disabled={!data || loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep/40 text-sm font-semibold text-capsula-ink disabled:opacity-40"
                >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Filtros */}
            <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-4 flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                        Desde
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        max={endDate}
                        className="rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm font-semibold text-capsula-ink"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                        Hasta
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm font-semibold text-capsula-ink"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                        Área
                    </label>
                    <select
                        value={areaId}
                        onChange={(e) => setAreaId(e.target.value)}
                        className="rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm font-semibold text-capsula-ink"
                    >
                        <option value="">Todas</option>
                        {areas.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                        Tipo
                    </label>
                    <select
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value)}
                        className="rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm font-semibold text-capsula-ink"
                    >
                        <option value="">Todos</option>
                        <option value="RESTAURANT">Restaurante</option>
                        <option value="DELIVERY">Delivery</option>
                        <option value="PEDIDOSYA">PedidosYa</option>
                    </select>
                </div>
                <div className="flex flex-col flex-1 min-w-[200px]">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                        Buscar producto
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-capsula-ink-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nombre o categoría..."
                            className="w-full rounded-lg border border-capsula-line bg-capsula-ivory pl-9 pr-3 py-2 text-sm text-capsula-ink"
                        />
                    </div>
                </div>
                <button
                    onClick={loadReport}
                    disabled={loading}
                    className="pos-btn px-5 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando…
                        </>
                    ) : (
                        <>
                            <Calendar className="h-4 w-4" />
                            Generar reporte
                        </>
                    )}
                </button>
            </div>

            {errorMsg && (
                <div className="rounded-2xl border border-capsula-line bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] px-4 py-3 text-sm">
                    {errorMsg}
                </div>
            )}

            {/* KPIs */}
            {data && !loading && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <KpiCard
                        label="Órdenes"
                        value={data.totalOrders.toLocaleString()}
                        icon={<ShoppingBag className="h-4 w-4" />}
                    />
                    <KpiCard
                        label="Unidades vendidas"
                        value={data.totalItemsSold.toLocaleString()}
                        icon={<Utensils className="h-4 w-4" />}
                    />
                    <KpiCard
                        label="Ingresos"
                        value={`$${data.totalRevenue.toFixed(2)}`}
                        emphasized
                    />
                </div>
            )}

            {/* Tabla */}
            {data && !loading && (
                <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface overflow-hidden">
                    {filteredItems.length === 0 ? (
                        <div className="py-12 text-center text-capsula-ink-muted text-sm">
                            No hay ventas en el rango seleccionado.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-capsula-navy-deep text-capsula-cream text-[11px] uppercase tracking-[0.14em]">
                                <tr>
                                    <th className="px-4 py-3 text-left w-8"></th>
                                    <th className="px-4 py-3 text-left">Producto</th>
                                    <th className="px-4 py-3 text-left">Categoría</th>
                                    <th className="px-4 py-3 text-right">Unidades</th>
                                    <th className="px-4 py-3 text-right">Ingresos</th>
                                    <th className="px-4 py-3 text-right">Precio prom.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-capsula-line">
                                {filteredItems.map((row) => (
                                    <ItemRow
                                        key={row.menuItemId}
                                        row={row}
                                        isOpen={expanded.has(row.menuItemId)}
                                        onToggle={() => toggleExpanded(row.menuItemId)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

function KpiCard({
    label,
    value,
    icon,
    emphasized,
}: {
    label: string;
    value: string;
    icon?: React.ReactNode;
    emphasized?: boolean;
}) {
    return (
        <div
            className={cn(
                'rounded-2xl border p-4',
                emphasized
                    ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                    : 'border-capsula-line bg-capsula-ivory-surface',
            )}
        >
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                {icon}
                {label}
            </div>
            <div
                className={cn(
                    'font-semibold tabular-nums tracking-[-0.02em]',
                    emphasized ? 'text-3xl text-capsula-ink' : 'text-2xl text-capsula-ink',
                )}
            >
                {value}
            </div>
        </div>
    );
}

function ItemRow({
    row,
    isOpen,
    onToggle,
}: {
    row: SoldItemRow;
    isOpen: boolean;
    onToggle: () => void;
}) {
    const hasMods = row.modifiers.length > 0;
    return (
        <>
            <tr
                onClick={hasMods ? onToggle : undefined}
                className={cn(
                    'transition-colors',
                    hasMods ? 'cursor-pointer hover:bg-capsula-ivory-alt' : '',
                )}
            >
                <td className="px-4 py-3">
                    {hasMods && (
                        isOpen ? (
                            <ChevronDown className="h-4 w-4 text-capsula-ink-muted" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-capsula-ink-muted" />
                        )
                    )}
                </td>
                <td className="px-4 py-3 font-semibold text-capsula-ink">
                    {row.menuItemName}
                </td>
                <td className="px-4 py-3 text-capsula-ink-muted">
                    {row.categoryName}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-capsula-ink">
                    {row.unitsSold.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-capsula-ink">
                    ${row.revenue.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-capsula-ink-muted">
                    ${row.avgPrice.toFixed(2)}
                </td>
            </tr>
            {isOpen && hasMods && (
                <tr className="bg-capsula-ivory-alt">
                    <td></td>
                    <td colSpan={5} className="px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-2">
                            Modificadores elegidos ({row.modifiers.length})
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {row.modifiers.map((m) => (
                                <div
                                    key={m.name}
                                    className="rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-xs"
                                >
                                    <div className="font-semibold text-capsula-ink truncate">
                                        {m.name}
                                    </div>
                                    <div className="flex justify-between mt-0.5 text-capsula-ink-muted tabular-nums">
                                        <span>{m.count}×</span>
                                        {m.revenueContribution !== 0 && (
                                            <span className="text-capsula-coral">
                                                {m.revenueContribution > 0 ? '+' : ''}$
                                                {m.revenueContribution.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
