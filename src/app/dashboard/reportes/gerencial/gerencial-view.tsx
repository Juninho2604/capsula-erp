'use client';

/**
 * Reportes GERENCIALES — ingeniería de menú (matriz popularidad × margen,
 * Kasavana-Smith). El P&L completo sigue en /dashboard/finanzas (enlazado).
 *
 * Nota de datos: el margen usa el snapshot de costo de cada venta (A0.1) —
 * las ventas anteriores al 2026-06-10 no tienen costo y se listan como
 * "Sin costo" (no contaminan los umbrales).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, ExternalLink, Star, Beef, Puzzle, Dog } from 'lucide-react';
import { getMenuEngineeringAction } from '@/app/actions/reports/gerencial.actions';
import type { MenuEngineeringResult, MenuQuadrant } from '@/lib/reports/menu-engineering';
import { ReportToolbar, ReportSkeleton, ReportEmptyState } from '../_components/report-shell';
import { fmtPct, fmtQty, fmtUsd, presetRange, type DateRange } from '../_components/format';
import { exportAoaToExcel, exportElementToPdf } from '../_components/export';

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-left';
const THn = TH + ' text-right';
const TD = 'px-3 py-2 text-sm text-capsula-ink';
const TDn = TD + ' text-right tabular-nums';

const QUADRANT_META: Record<MenuQuadrant, { label: string; hint: string; cls: string; Icon: typeof Star }> = {
    ESTRELLA: { label: 'Estrellas', hint: 'Popular + rentable → destacar', cls: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]', Icon: Star },
    VACA: { label: 'Vacas', hint: 'Popular, poco margen → ajustar precio/costo', cls: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]', Icon: Beef },
    ROMPECABEZAS: { label: 'Rompecabezas', hint: 'Rentable, poco vendido → promocionar', cls: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]', Icon: Puzzle },
    PERRO: { label: 'Perros', hint: 'Ni popular ni rentable → replantear', cls: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]', Icon: Dog },
    SIN_COSTO: { label: 'Sin costo', hint: 'Sin snapshot de costo aún', cls: 'bg-capsula-ivory-alt text-capsula-ink-muted', Icon: Puzzle },
};

export default function GerencialReportView({ tenantName, canExport }: { tenantName: string; canExport: boolean }) {
    const [range, setRange] = useState<DateRange>(presetRange('MES'));
    const [data, setData] = useState<MenuEngineeringResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [quadrantFilter, setQuadrantFilter] = useState<MenuQuadrant | ''>('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getMenuEngineeringAction({ from: range.from, to: range.to });
            if (!res.success || !res.data) {
                toast.error(res.message ?? 'Error cargando ingeniería de menú');
                setData(null);
                return;
            }
            setData(res.data);
        } catch {
            toast.error('Sin conexión con el servidor');
        } finally {
            setLoading(false);
        }
    }, [range.from, range.to]);

    useEffect(() => { void load(); }, [load]);

    const meta = useMemo(() => ({
        tenantName, reportTitle: 'Ingeniería de menú', from: range.from, to: range.to,
    }), [tenantName, range]);

    const rows = useMemo(
        () => (data ? data.rows.filter(r => !quadrantFilter || r.quadrant === quadrantFilter) : []),
        [data, quadrantFilter],
    );

    const exportExcel = () => {
        if (!data) return;
        exportAoaToExcel(meta, [
            ['PRODUCTO', 'CATEGORÍA', 'CUADRANTE', 'UNIDADES', 'VENTA $', 'COSTO $', 'MARGEN $', 'MARGEN %'],
            ...data.rows.map(r => [r.name, r.category, QUADRANT_META[r.quadrant].label, r.units, r.revenue, r.cost, r.marginUsd, r.marginPct.toFixed(1) + '%']),
            [],
            ['Umbral popularidad (unidades)', data.thresholds.popularityUnits.toFixed(1)],
            ['Umbral margen %', data.thresholds.marginPct.toFixed(1) + '%'],
        ], 'ingenieria_menu');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4 p-4 sm:p-6">
            <header className="flex items-center gap-3">
                <Link href="/dashboard/reportes" className="h-9 w-9 rounded-full border border-capsula-line flex items-center justify-center text-capsula-ink-muted hover:bg-capsula-ivory-alt">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">Ingeniería de menú</h1>
                    <p className="text-xs text-capsula-ink-muted">
                        Popularidad × margen ·{' '}
                        <Link href="/dashboard/finanzas" className="underline inline-flex items-center gap-0.5">P&L completo en Finanzas <ExternalLink className="h-3 w-3" /></Link>
                    </p>
                </div>
            </header>

            <ReportToolbar
                range={range} onRangeChange={setRange}
                canExport={canExport}
                onExportExcel={exportExcel}
                onExportPdf={() => exportElementToPdf(meta, 'gerencial-report-body')}
                busy={loading}
            />

            {loading ? <ReportSkeleton /> : !data || data.rows.length === 0 ? (
                <ReportEmptyState title="Sin ventas en el rango" hint="La matriz se construye con las ventas del período seleccionado." />
            ) : (
                <div id="gerencial-report-body" className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {(['ESTRELLA', 'VACA', 'ROMPECABEZAS', 'PERRO'] as MenuQuadrant[]).map(q => {
                            const m = QUADRANT_META[q];
                            const active = quadrantFilter === q;
                            return (
                                <button
                                    key={q}
                                    onClick={() => setQuadrantFilter(active ? '' : q)}
                                    className={`text-left rounded-2xl border p-4 transition ${m.cls} ${active ? 'border-capsula-navy-deep ring-1 ring-capsula-navy-deep/40' : 'border-transparent'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <m.Icon className="h-4 w-4" />
                                        <span className="font-semibold text-sm">{m.label}</span>
                                        <span className="ml-auto font-semibold text-lg tabular-nums">{data.counts[q]}</span>
                                    </div>
                                    <p className="mt-1 text-[11px] opacity-80">{m.hint}</p>
                                </button>
                            );
                        })}
                    </div>

                    {data.counts.SIN_COSTO > 0 && (
                        <p className="text-[11px] text-capsula-ink-muted">
                            {data.counts.SIN_COSTO} producto(s) sin snapshot de costo (ventas previas al fix A0.1) — excluidos de la matriz.
                        </p>
                    )}

                    <div className="bg-capsula-ivory border border-capsula-line rounded-2xl overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                            <thead className="bg-capsula-ivory-alt"><tr>
                                <th className={TH}>Producto</th><th className={TH}>Categoría</th><th className={TH}>Cuadrante</th>
                                <th className={THn}>Unid.</th><th className={THn}>Venta</th>
                                <th className={THn}>Margen</th><th className={THn}>Margen %</th>
                            </tr></thead>
                            <tbody>
                                {rows.map(r => {
                                    const m = QUADRANT_META[r.quadrant];
                                    return (
                                        <tr key={r.menuItemId} className="border-t border-capsula-line">
                                            <td className={TD}>{r.name}</td>
                                            <td className={TD + ' text-xs text-capsula-ink-muted'}>{r.category}</td>
                                            <td className={TD}>
                                                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
                                            </td>
                                            <td className={TDn}>{fmtQty(r.units)}</td>
                                            <td className={TDn}>{fmtUsd(r.revenue)}</td>
                                            <td className={TDn}>{r.quadrant === 'SIN_COSTO' ? '—' : fmtUsd(r.marginUsd)}</td>
                                            <td className={TDn}>{r.quadrant === 'SIN_COSTO' ? '—' : fmtPct(r.marginPct)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-[11px] text-capsula-ink-muted">
                        Umbrales del rango: popularidad ≥ {data.thresholds.popularityUnits.toFixed(1)} unidades (70% del promedio) ·
                        margen ≥ {data.thresholds.marginPct.toFixed(1)}% (margen ponderado del período).
                    </p>
                </div>
            )}
        </div>
    );
}
