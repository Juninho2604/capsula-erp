'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Search } from 'lucide-react';
import {
    groupInventoryByCategory,
    filterInventoryRows,
    type InventoryReportRowLike,
} from '@/lib/reports/inventory-report-helpers';

interface Props {
    initialRows: (InventoryReportRowLike & { sku: string; name: string })[];
    areas: { id: string; name: string }[];
    generatedAt: Date;
}

export default function InventoryReportView({ initialRows, areas, generatedAt }: Props) {
    const [query, setQuery] = useState('');
    const [exporting, setExporting] = useState(false);

    const filtered = useMemo(() => filterInventoryRows(initialRows, query), [initialRows, query]);
    const grouped = useMemo(() => groupInventoryByCategory(filtered), [filtered]);

    const exportToExcel = () => {
        setExporting(true);
        try {
            const aoa: (string | number)[][] = [];
            aoa.push([`REPORTE DE INVENTARIO COMPLETO — ${new Date(generatedAt).toLocaleString('es-VE')}`]);
            aoa.push([]);

            // Header
            const header = ['SKU', 'PRODUCTO', 'CATEGORÍA', 'UNIDAD'];
            for (const a of areas) header.push(a.name.toUpperCase());
            header.push('STOCK TOTAL', 'COSTO UNIT. (USD)', 'VALOR TOTAL (USD)');
            aoa.push(header);

            // Filas agrupadas por categoría con totales
            for (const group of grouped.groups) {
                aoa.push([`## ${group.category.toUpperCase()} ## (${group.itemCount} items)`]);
                for (const r of group.rows) {
                    const row: (string | number)[] = [
                        r.sku,
                        r.name,
                        r.category,
                        r.baseUnit,
                    ];
                    for (const a of areas) row.push(r.stockByArea[a.id] ?? 0);
                    row.push(r.totalStock, r.costPerUnit, r.totalValue);
                    aoa.push(row);
                }
                // Subtotal de categoría
                const subtotalRow: (string | number)[] = ['', `Subtotal ${group.category}`, '', ''];
                for (let i = 0; i < areas.length; i++) subtotalRow.push('');
                subtotalRow.push(group.totalStock, '', group.totalValue);
                aoa.push(subtotalRow);
                aoa.push([]);  // separador visual
            }

            // Grand total
            const grandRow: (string | number)[] = ['', 'TOTAL GENERAL', '', ''];
            for (let i = 0; i < areas.length; i++) grandRow.push('');
            grandRow.push(grouped.grandTotalStock, '', grouped.grandTotalValue);
            aoa.push(grandRow);

            const ws = XLSX.utils.aoa_to_sheet(aoa);

            // Anchos de columna razonables
            const cols: { wch: number }[] = [
                { wch: 14 },   // SKU
                { wch: 36 },   // Producto
                { wch: 20 },   // Categoría
                { wch: 8 },    // Unidad
            ];
            for (let i = 0; i < areas.length; i++) cols.push({ wch: 14 });
            cols.push({ wch: 14 }, { wch: 14 }, { wch: 16 });
            ws['!cols'] = cols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
            const today = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `inventario_completo_${today}.xlsx`);
            toast.success(`${grouped.itemCount} items exportados`);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Link href="/dashboard/reportes" className="text-sm text-capsula-coral hover:underline inline-flex items-center gap-1 mb-1">
                        <ArrowLeft className="h-3.5 w-3.5" /> Reportes
                    </Link>
                    <h1 className="font-semibold text-2xl sm:text-3xl tracking-[-0.02em] text-capsula-ink">
                        Inventario completo
                    </h1>
                    <p className="text-xs text-capsula-ink-muted mt-1">
                        Generado: {new Date(generatedAt).toLocaleString('es-VE')} ·
                        {' '}<strong>{grouped.itemCount}</strong> SKU activos en{' '}
                        <strong>{grouped.categoryCount}</strong> categorías
                    </p>
                </div>
                <button
                    onClick={exportToExcel}
                    disabled={exporting || filtered.length === 0}
                    className="pos-btn inline-flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
                >
                    <Download className="h-4 w-4" />
                    {exporting ? 'Generando…' : 'Exportar a Excel'}
                </button>
            </div>

            {/* Buscador */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-capsula-ink-muted" />
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar por SKU, nombre o categoría…"
                    className="pos-input w-full pl-9"
                />
            </div>

            {/* Resumen totales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="SKU mostrados" value={grouped.itemCount.toString()} />
                <Metric label="Categorías" value={grouped.categoryCount.toString()} />
                <Metric label="Stock total (Σ)" value={grouped.grandTotalStock.toFixed(2)} />
                <Metric
                    label="Valor total"
                    value={`$${grouped.grandTotalValue.toFixed(2)}`}
                />
            </div>

            {/* Tabla agrupada */}
            <div className="rounded-2xl border border-capsula-line overflow-hidden bg-capsula-ivory">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-capsula-ivory-alt sticky top-0">
                            <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                <th className="text-left px-3 py-2.5">SKU</th>
                                <th className="text-left px-3 py-2.5">Producto</th>
                                <th className="text-left px-3 py-2.5">Unidad</th>
                                {areas.map(a => (
                                    <th key={a.id} className="text-right px-3 py-2.5">{a.name}</th>
                                ))}
                                <th className="text-right px-3 py-2.5">Total</th>
                                <th className="text-right px-3 py-2.5">Costo</th>
                                <th className="text-right px-3 py-2.5">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.groups.length === 0 && (
                                <tr>
                                    <td colSpan={6 + areas.length} className="px-3 py-6 text-center text-capsula-ink-muted text-xs">
                                        No hay resultados para "{query}"
                                    </td>
                                </tr>
                            )}
                            {grouped.groups.map(group => (
                                <FragmentCategoryGroup key={group.category} group={group} areas={areas} />
                            ))}
                        </tbody>
                        {grouped.groups.length > 0 && (
                            <tfoot className="bg-capsula-navy-deep text-capsula-cream">
                                <tr className="text-xs font-semibold">
                                    <td colSpan={3 + areas.length} className="px-3 py-2.5 uppercase tracking-[0.14em]">Total general</td>
                                    <td className="text-right px-3 py-2.5 tabular-nums">{grouped.grandTotalStock.toFixed(2)}</td>
                                    <td></td>
                                    <td className="text-right px-3 py-2.5 tabular-nums">${grouped.grandTotalValue.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}

function FragmentCategoryGroup({
    group,
    areas,
}: {
    group: ReturnType<typeof groupInventoryByCategory>['groups'][number];
    areas: { id: string; name: string }[];
}) {
    return (
        <>
            <tr className="bg-capsula-ivory-surface border-y border-capsula-line">
                <td colSpan={3 + areas.length + 3} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-soft">
                    {group.category}  · <span className="text-capsula-ink-muted">{group.itemCount} items</span>
                </td>
            </tr>
            {group.rows.map(r => (
                <tr key={r.sku} className="border-b border-capsula-line/60 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs text-capsula-ink-soft">{r.sku}</td>
                    <td className="px-3 py-2 text-capsula-ink">{r.name}</td>
                    <td className="px-3 py-2 text-xs text-capsula-ink-muted">{r.baseUnit}</td>
                    {areas.map(a => (
                        <td key={a.id} className="px-3 py-2 text-right tabular-nums text-capsula-ink-soft">
                            {(r.stockByArea[a.id] ?? 0).toFixed(2)}
                        </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-capsula-ink">{r.totalStock.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-capsula-ink-muted">${r.costPerUnit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-capsula-ink">${r.totalValue.toFixed(2)}</td>
                </tr>
            ))}
            <tr className="bg-capsula-ivory-alt">
                <td colSpan={3 + areas.length} className="px-3 py-2 text-xs uppercase tracking-wider text-capsula-ink-muted text-right">
                    Subtotal {group.category}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-capsula-ink">{group.totalStock.toFixed(2)}</td>
                <td></td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-capsula-ink">${group.totalValue.toFixed(2)}</td>
            </tr>
        </>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{label}</p>
            <p className="text-lg font-semibold text-capsula-ink tabular-nums mt-0.5">{value}</p>
        </div>
    );
}
