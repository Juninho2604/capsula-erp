'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Download, Search, TrendingDown, TrendingUp, ArrowRight,
} from 'lucide-react';
import {
    compareWeeklyCountsAction,
    type WeeklyCountSummary,
    type WeeklyCountComparisonRow,
} from '@/app/actions/inventory-count.actions';
import {
    computeComparisonMetrics,
    groupComparisonByCategory,
    filterComparisonRows,
} from '@/lib/reports/weekly-variation-helpers';

interface Props {
    counts: WeeklyCountSummary[];
}

type Warehouse = 'PRINCIPAL' | 'PRODUCTION';

export default function VariacionSemanalView({ counts }: Props) {
    // Conteos ordenados desc por fecha (vienen del backend así, pero defensivo)
    const sortedCounts = useMemo(
        () => [...counts].sort((a, b) => new Date(b.countDate).getTime() - new Date(a.countDate).getTime()),
        [counts],
    );

    // Default: actual = el más reciente, previo = el anterior
    const [currentId, setCurrentId] = useState(sortedCounts[0]?.id ?? '');
    const [previousId, setPreviousId] = useState(sortedCounts[1]?.id ?? '');
    const [warehouse, setWarehouse] = useState<Warehouse>('PRINCIPAL');
    const [rows, setRows] = useState<WeeklyCountComparisonRow[] | null>(null);
    const [meta, setMeta] = useState<{ previous: { countNumber: string; countDate: Date }; current: { countNumber: string; countDate: Date } } | null>(null);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [varianceFilter, setVarianceFilter] = useState<'ALL' | 'DECREASE' | 'INCREASE' | 'CHANGED'>('ALL');

    const generate = async () => {
        if (!previousId || !currentId) {
            toast.error('Seleccione ambos conteos');
            return;
        }
        if (previousId === currentId) {
            toast.error('Conteo previo y actual deben ser distintos');
            return;
        }
        setLoading(true);
        try {
            const res = await compareWeeklyCountsAction(previousId, currentId, warehouse);
            if (!res.success || !res.rows) {
                toast.error(res.message ?? 'Error generando comparativa');
                return;
            }
            setRows(res.rows);
            setMeta({ previous: res.previous!, current: res.current! });
            toast.success(`${res.rows.length} items comparados`);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        if (!rows) return [];
        let r = filterComparisonRows(rows, query);
        if (varianceFilter === 'DECREASE') r = r.filter(x => (x.delta ?? 0) < -0.001);
        else if (varianceFilter === 'INCREASE') r = r.filter(x => (x.delta ?? 0) > 0.001);
        else if (varianceFilter === 'CHANGED') r = r.filter(x => Math.abs(x.delta ?? 0) > 0.001 || x.previousQty === null || x.currentQty === null);
        return r;
    }, [rows, query, varianceFilter]);

    const grouped = useMemo(() => groupComparisonByCategory(filtered), [filtered]);
    const metrics = useMemo(() => (rows ? computeComparisonMetrics(rows) : null), [rows]);

    const exportToExcel = () => {
        if (!rows || !meta) return;
        const aoa: (string | number)[][] = [];
        aoa.push([`COMPARATIVA SEMANAL — ${meta.previous.countNumber} → ${meta.current.countNumber}`]);
        aoa.push([
            `Previo: ${new Date(meta.previous.countDate).toLocaleDateString('es-VE')}`,
            `Actual: ${new Date(meta.current.countDate).toLocaleDateString('es-VE')}`,
            `Almacén: ${warehouse}`,
        ]);
        aoa.push([]);

        const header = ['SKU', 'PRODUCTO', 'CATEGORÍA', 'UNIDAD', 'CANT. PREVIA', 'CANT. ACTUAL', 'DELTA', '%'];
        aoa.push(header);

        for (const g of grouped) {
            aoa.push([`## ${g.category.toUpperCase()} ## (${g.rows.length} items, neto ${g.netDelta >= 0 ? '+' : ''}${g.netDelta.toFixed(2)})`]);
            for (const r of g.rows) {
                const pct = r.previousQty && r.previousQty !== 0 && r.delta !== null
                    ? (r.delta / r.previousQty) * 100
                    : null;
                aoa.push([
                    r.sku,
                    r.name,
                    r.category ?? 'Sin categoría',
                    r.baseUnit,
                    r.previousQty ?? '—',
                    r.currentQty ?? '—',
                    r.delta ?? '—',
                    pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—',
                ]);
            }
            aoa.push([
                '', `Subtotal ${g.category}`, '', '',
                '', '', g.netDelta, '',
            ]);
            aoa.push([]);
        }

        if (metrics) {
            aoa.push(['', 'TOTAL CAÍDAS (merma)', '', '', '', '', -metrics.totalDecrease, '']);
            aoa.push(['', 'TOTAL SUBIDAS (entradas)', '', '', '', '', metrics.totalIncrease, '']);
            aoa.push(['', 'NETO', '', '', '', '', metrics.totalNetDelta, '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
            { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 8 },
            { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Variación');
        const fname = `variacion_${meta.previous.countNumber}_vs_${meta.current.countNumber}.xlsx`;
        XLSX.writeFile(wb, fname);
        toast.success('Excel descargado');
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
            <div>
                <Link href="/dashboard/reportes" className="text-sm text-capsula-coral hover:underline inline-flex items-center gap-1 mb-1">
                    <ArrowLeft className="h-3.5 w-3.5" /> Reportes
                </Link>
                <h1 className="font-semibold text-2xl sm:text-3xl tracking-[-0.02em] text-capsula-ink">
                    Variación semana vs semana
                </h1>
                <p className="text-xs text-capsula-ink-muted mt-1">
                    Compara dos conteos físicos semanales y detecta caídas (mermas) y subidas (entradas no registradas).
                </p>
            </div>

            {/* Setup selectors */}
            <div className="rounded-2xl border border-capsula-line bg-capsula-ivory p-5 space-y-4">
                {sortedCounts.length < 2 ? (
                    <div className="rounded-xl bg-[#F3EAD6] dark:bg-[#3B2F15] text-[#946A1C] dark:text-[#E8D9B8] p-4 text-sm">
                        <p className="font-semibold">Necesitas al menos 2 conteos para comparar.</p>
                        <p className="text-xs mt-1 opacity-90">
                            Realiza un{' '}
                            <Link href="/dashboard/inventario/conteo-rapido" className="underline font-semibold">Conteo Rápido</Link>
                            {' '}o un{' '}
                            <Link href="/dashboard/inventario/conteo-semanal" className="underline font-semibold">Conteo Semanal con Excel</Link>
                            . Hoy hay <strong>{sortedCounts.length}</strong>.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <CountSelector
                                label="Conteo previo (semana N-1)"
                                value={previousId}
                                onChange={setPreviousId}
                                counts={sortedCounts}
                                exclude={currentId}
                            />
                            <CountSelector
                                label="Conteo actual (semana N)"
                                value={currentId}
                                onChange={setCurrentId}
                                counts={sortedCounts}
                                exclude={previousId}
                            />
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[200px]">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1.5">Almacén</p>
                                <div className="inline-flex rounded-lg border border-capsula-line bg-capsula-ivory-surface p-0.5">
                                    <button
                                        onClick={() => setWarehouse('PRINCIPAL')}
                                        className={`px-3 py-1.5 rounded text-xs font-semibold ${warehouse === 'PRINCIPAL' ? 'bg-capsula-navy-deep text-capsula-cream' : 'text-capsula-ink-soft'}`}
                                    >
                                        Principal
                                    </button>
                                    <button
                                        onClick={() => setWarehouse('PRODUCTION')}
                                        className={`px-3 py-1.5 rounded text-xs font-semibold ${warehouse === 'PRODUCTION' ? 'bg-capsula-navy-deep text-capsula-cream' : 'text-capsula-ink-soft'}`}
                                    >
                                        Producción
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={generate}
                                disabled={loading || !previousId || !currentId || previousId === currentId}
                                className="pos-btn inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
                            >
                                {loading ? 'Generando…' : 'Generar comparativa'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Resultados */}
            {rows && meta && metrics && (
                <>
                    {/* Métricas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Metric label="Items con caída" value={metrics.itemsDecreased.toString()} tone="danger" />
                        <Metric label="Items con subida" value={metrics.itemsIncreased.toString()} tone="ok" />
                        <Metric label="Sin cambio" value={metrics.itemsUnchanged.toString()} tone="neutral" />
                        <Metric
                            label="Neto"
                            value={`${metrics.totalNetDelta >= 0 ? '+' : ''}${metrics.totalNetDelta.toFixed(2)}`}
                            tone={metrics.totalNetDelta < -0.01 ? 'danger' : 'ok'}
                        />
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-capsula-ink-muted" />
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar por SKU, nombre o categoría…"
                                className="pos-input w-full pl-9"
                            />
                        </div>
                        <div className="inline-flex rounded-lg border border-capsula-line bg-capsula-ivory-surface p-0.5 text-xs">
                            {(['ALL', 'DECREASE', 'INCREASE', 'CHANGED'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setVarianceFilter(f)}
                                    className={`px-2.5 py-1.5 rounded font-semibold ${varianceFilter === f ? 'bg-capsula-navy-deep text-capsula-cream' : 'text-capsula-ink-soft'}`}
                                >
                                    {f === 'ALL' && 'Todas'}
                                    {f === 'DECREASE' && 'Solo caídas'}
                                    {f === 'INCREASE' && 'Solo subidas'}
                                    {f === 'CHANGED' && 'Con cambios'}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={exportToExcel}
                            className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-xs"
                        >
                            <Download className="h-3.5 w-3.5" /> Exportar Excel
                        </button>
                    </div>

                    {/* Tabla agrupada */}
                    <div className="rounded-2xl border border-capsula-line overflow-hidden bg-capsula-ivory">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-capsula-ivory-alt">
                                    <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                        <th className="text-left px-3 py-2.5">SKU</th>
                                        <th className="text-left px-3 py-2.5">Producto</th>
                                        <th className="text-left px-3 py-2.5">Un.</th>
                                        <th className="text-right px-3 py-2.5">{meta.previous.countNumber}</th>
                                        <th className="text-center px-2 py-2.5"></th>
                                        <th className="text-right px-3 py-2.5">{meta.current.countNumber}</th>
                                        <th className="text-right px-3 py-2.5">Delta</th>
                                        <th className="text-right px-3 py-2.5">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {grouped.length === 0 && (
                                        <tr><td colSpan={8} className="px-3 py-6 text-center text-capsula-ink-muted text-xs">
                                            No hay resultados con los filtros actuales
                                        </td></tr>
                                    )}
                                    {grouped.map(g => <CategoryRows key={g.category} group={g} />)}
                                </tbody>
                                <tfoot className="bg-capsula-navy-deep text-capsula-cream text-xs font-semibold">
                                    <tr>
                                        <td colSpan={6} className="px-3 py-2.5 uppercase tracking-[0.14em]">
                                            Totales — Caídas: {(-metrics.totalDecrease).toFixed(2)} · Subidas: +{metrics.totalIncrease.toFixed(2)}
                                        </td>
                                        <td className="text-right px-3 py-2.5 tabular-nums">
                                            {metrics.totalNetDelta >= 0 ? '+' : ''}{metrics.totalNetDelta.toFixed(2)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function CountSelector({
    label, value, onChange, counts, exclude,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    counts: WeeklyCountSummary[];
    exclude: string;
}) {
    return (
        <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted block mb-1.5">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="pos-input w-full"
            >
                <option value="">— Seleccionar —</option>
                {counts.map(c => (
                    <option key={c.id} value={c.id} disabled={c.id === exclude}>
                        {c.countNumber} · {new Date(c.countDate).toLocaleDateString('es-VE')} · {c.principalAreaName}
                    </option>
                ))}
            </select>
        </div>
    );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'danger' | 'neutral' }) {
    const cls =
        tone === 'ok' ? 'text-[#2F6B4E] dark:text-[#6FB88F]' :
        tone === 'danger' ? 'text-[#B04A2E] dark:text-[#EFD2C8]' :
        'text-capsula-ink';
    return (
        <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{label}</p>
            <p className={`text-lg font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</p>
        </div>
    );
}

function CategoryRows({ group }: { group: ReturnType<typeof groupComparisonByCategory>[number] }) {
    return (
        <>
            <tr className="bg-capsula-ivory-surface border-y border-capsula-line">
                <td colSpan={8} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-soft">
                    {group.category}
                    <span className="text-capsula-ink-muted ml-2">
                        · {group.rows.length} items · neto{' '}
                        <span className={group.netDelta < 0 ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : 'text-[#2F6B4E] dark:text-[#6FB88F]'}>
                            {group.netDelta >= 0 ? '+' : ''}{group.netDelta.toFixed(2)}
                        </span>
                    </span>
                </td>
            </tr>
            {group.rows.map(r => {
                const delta = r.delta ?? 0;
                const pct = r.previousQty && r.previousQty !== 0 && r.delta !== null
                    ? (r.delta / r.previousQty) * 100
                    : null;
                const isDown = delta < -0.001;
                const isUp = delta > 0.001;
                return (
                    <tr key={r.inventoryItemId} className="border-b border-capsula-line/60 last:border-b-0">
                        <td className="px-3 py-2 font-mono text-xs text-capsula-ink-soft">{r.sku}</td>
                        <td className="px-3 py-2 text-capsula-ink">{r.name}</td>
                        <td className="px-3 py-2 text-xs text-capsula-ink-muted">{r.baseUnit}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-capsula-ink-soft">
                            {r.previousQty !== null ? r.previousQty.toFixed(2) : <span className="text-capsula-ink-muted">—</span>}
                        </td>
                        <td className="px-2 py-2 text-center text-capsula-ink-muted">
                            <ArrowRight className="h-3 w-3 inline" />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-capsula-ink-soft">
                            {r.currentQty !== null ? r.currentQty.toFixed(2) : <span className="text-capsula-ink-muted">—</span>}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${isDown ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : isUp ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-ink'}`}>
                            <span className="inline-flex items-center gap-1">
                                {isDown && <TrendingDown className="h-3 w-3" />}
                                {isUp && <TrendingUp className="h-3 w-3" />}
                                {r.delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
                            </span>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums text-xs ${isDown ? 'text-[#B04A2E] dark:text-[#EFD2C8]' : isUp ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-ink-muted'}`}>
                            {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
