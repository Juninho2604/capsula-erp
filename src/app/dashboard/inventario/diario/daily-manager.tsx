'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    getDailyInventoryAction,
    saveDailyInventoryCountsAction,
    closeDailyInventoryAction,
    syncSalesFromOrdersAction,
    getInventorySummaryByRangeAction,
    getWeeklyInventorySummaryAction,
    reopenDailyInventoryAction,
} from '@/app/actions/inventory-daily.actions';
import { toast } from 'react-hot-toast';
import {
    Search,
    X as XIcon,
    Check,
    Pencil,
    BarChart3,
    Download,
    Settings,
    Inbox,
    CreditCard,
    Save,
    CheckCircle2,
    Unlock,
    Loader2,
    Package,
    AlertTriangle,
    Zap,
} from 'lucide-react';
import CriticalListManager from './critical-list-manager';
import SalesEntryModal from './sales-entry-modal';

interface Props {
    initialAreas: any[];
}

export default function DailyInventoryManager({ initialAreas }: Props) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedArea, setSelectedArea] = useState(initialAreas[0]?.id || '');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [showSalesModal, setShowSalesModal] = useState(false);
    const [syncingSales, setSyncingSales] = useState(false);
    const [autoSuggestions, setAutoSuggestions] = useState<Record<string, { autoEntries: number; autoSales: number }>>({});

    // Reporte por rango
    const [showRangeReport, setShowRangeReport] = useState(false);
    const [rangeStart, setRangeStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return d.toISOString().split('T')[0];
    });
    const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().split('T')[0]);
    const [rangeSummary, setRangeSummary] = useState<any[]>([]);
    const [loadingRange, setLoadingRange] = useState(false);

    useEffect(() => {
        if (!selectedArea) return;
        loadData();
    }, [selectedDate, selectedArea]);

    async function loadData() {
        setLoading(true);
        try {
            const res = await getDailyInventoryAction(selectedDate, selectedArea);
            if (res.success && res.data) {
                setData(res.data);
                setItems(res.data.items);
                setAutoSuggestions((res as any).autoSuggestions || {});
                setHasChanges(false);
            } else {
                toast.error('No se pudo cargar el inventario');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    async function loadRangeReport() {
        setLoadingRange(true);
        try {
            const res = await getInventorySummaryByRangeAction(selectedArea, rangeStart, rangeEnd);
            if (res.success) setRangeSummary(res.data || []);
        } finally {
            setLoadingRange(false);
        }
    }

    const handleInputChange = (itemId: string, field: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, [field]: numValue } : item
        ));
        setHasChanges(true);
    };

    const applyAutoSuggestion = (itemId: string, inventoryItemId: string, field: 'entries' | 'sales') => {
        const suggestion = autoSuggestions[inventoryItemId];
        if (!suggestion) return;
        const value = field === 'entries' ? suggestion.autoEntries : suggestion.autoSales;
        if (value === 0) { toast('No hay sugerencia automática para este campo', { icon: 'ℹ️' }); return; }
        setItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
        ));
        setHasChanges(true);
        toast.success(`Aplicado: ${value} (auto)`);
    };

    const handleSave = async () => {
        if (!data) return;
        setLoading(true);
        try {
            const res = await saveDailyInventoryCountsAction(data.id, items);
            if (res.success) {
                toast.success('Guardado correctamente');
                setHasChanges(false);
                loadData();
            } else {
                toast.error('Error al guardar');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCloseDay = async () => {
        if (!data) return;
        if (!confirm('¿Seguro que desea FINALIZAR el inventario de este día? Una vez cerrado no podrá editar los conteos.')) return;
        setLoading(true);
        try {
            if (hasChanges) await saveDailyInventoryCountsAction(data.id, items);
            const res = await closeDailyInventoryAction(data.id);
            if (res.success) {
                toast.success('Día finalizado exitosamente');
                loadData();
            } else {
                toast.error('Error al finalizar');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReopen = async () => {
        if (!data) return;
        if (!confirm('¿Reabrir este inventario? Solo owners y auditores pueden hacerlo.')) return;
        setLoading(true);
        try {
            const res = await reopenDailyInventoryAction(data.id);
            if (res.success) {
                toast.success('Inventario reabierto');
                loadData();
            } else {
                toast.error(res.message || 'No autorizado');
            }
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (!items.length) { toast.error('No hay datos para exportar'); return; }

        const wb = XLSX.utils.book_new();

        // ── Metadata rows ──
        const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-VE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const statusLabel = data?.status === 'CLOSED' ? 'CERRADO' : 'BORRADOR';

        const metaRows = [
            ['SHANKLISH CARACAS — INVENTARIO DIARIO'],
            [`Área: ${selectedAreaName}`, '', '', `Fecha: ${dateLabel}`, '', '', `Estado: ${statusLabel}`],
            [],
        ];

        // ── Header columns ──
        const headers = [
            'PRODUCTO', 'SKU', 'UNIDAD',
            'APERTURA', 'ENTRADAS (+)', 'VENTAS/CONSUMO (−)', 'MERMA (−)',
            'TEÓRICO', 'CIERRE REAL', 'VARIACIÓN'
        ];

        // ── Data rows ──
        const dataRows = items.map(item => {
            const theoretical = item.theoreticalStock || 0;
            const variance = item.variance || 0;
            return [
                item.inventoryItem.name,
                item.inventoryItem.sku,
                item.unit,
                item.initialCount || 0,
                item.entries || 0,
                item.sales || 0,
                item.waste || 0,
                parseFloat(theoretical.toFixed(4)),
                item.finalCount || 0,
                parseFloat(variance.toFixed(4)),
            ];
        });

        // ── Totals row ──
        const totalsRow = [
            `TOTALES (${items.length} items)`, '', '',
            items.reduce((s, i) => s + (i.initialCount || 0), 0),
            items.reduce((s, i) => s + (i.entries || 0), 0),
            items.reduce((s, i) => s + (i.sales || 0), 0),
            items.reduce((s, i) => s + (i.waste || 0), 0),
            items.reduce((s, i) => s + (i.theoreticalStock || 0), 0),
            items.reduce((s, i) => s + (i.finalCount || 0), 0),
            items.reduce((s, i) => s + (i.variance || 0), 0),
        ];

        // ── Ventas column (raw, for user to fill in) ──
        const salesHelperRows = [
            [],
            ['--- COLUMNA DE AYUDA: VENTAS PARA COMPLETAR ---'],
            ['Producto', 'SKU', 'Unidad', 'Ventas del día (completar aquí)'],
            ...items.map(item => [item.inventoryItem.name, item.inventoryItem.sku, item.unit, '']),
        ];

        // ── Build worksheet ──
        const allRows = [
            ...metaRows,
            headers,
            ...dataRows,
            [],
            totalsRow,
            ...salesHelperRows,
        ];

        const ws = XLSX.utils.aoa_to_sheet(allRows);

        // Column widths
        ws['!cols'] = [
            { wch: 32 }, // Producto
            { wch: 14 }, // SKU
            { wch: 8 },  // Unidad
            { wch: 12 }, // Apertura
            { wch: 14 }, // Entradas
            { wch: 20 }, // Ventas
            { wch: 12 }, // Merma
            { wch: 12 }, // Teórico
            { wch: 12 }, // Cierre
            { wch: 12 }, // Variación
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Inventario Diario');

        // ── File name ──
        const fileName = `inventario_${selectedAreaName.replace(/\s+/g, '_').toLowerCase()}_${selectedDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`Descargado: ${fileName}`);
    };

    const isClosed = data?.status === 'CLOSED';
    const selectedAreaName = initialAreas.find((a: any) => a.id === selectedArea)?.name || '';
    const isProduction = selectedAreaName.toLowerCase().includes('producci');

    return (
        <div className="flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory shadow-xl">

            {/* Panel Reporte por Rango */}
            {showRangeReport && (
                <div className="mx-4 mt-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-800 p-4">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
                        <h3 className="font-semibold text-base tracking-[-0.01em] text-capsula-navy">Reporte por Rango de Fechas</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                type="date"
                                value={rangeStart}
                                onChange={e => setRangeStart(e.target.value)}
                                className="rounded-lg border border-blue-300 bg-capsula-ivory text-sm px-3 py-1.5 font-bold text-capsula-ink"
                            />
                            <span className="text-blue-600 font-bold">→</span>
                            <input
                                type="date"
                                value={rangeEnd}
                                onChange={e => setRangeEnd(e.target.value)}
                                className="rounded-lg border border-blue-300 bg-capsula-ivory text-sm px-3 py-1.5 font-bold text-capsula-ink"
                            />
                            <button
                                onClick={loadRangeReport}
                                disabled={loadingRange}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loadingRange
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Search className="h-3.5 w-3.5" />}
                                Consultar
                            </button>
                            <button
                                onClick={() => setShowRangeReport(false)}
                                className="rounded-full p-1 text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/40"
                                aria-label="Cerrar reporte por rango"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                                    <th className="py-2 pr-4">Fecha</th>
                                    <th className="py-2 pr-4">Estado</th>
                                    <th className="py-2 pr-4 text-right">Var. Total</th>
                                    <th className="py-2 pr-4 text-right">Merma Total</th>
                                    <th className="py-2 pr-4 text-right">Items con Faltante</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rangeSummary.length === 0 ? (
                                    <tr><td colSpan={5} className="py-4 text-center text-capsula-ink-muted">Consulta un rango para ver el reporte</td></tr>
                                ) : (
                                    rangeSummary.map((d: any) => (
                                        <tr key={d.date} className="border-t border-blue-200 dark:border-blue-800 hover:bg-blue-100/30">
                                            <td className="py-2 font-bold">{new Date(d.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', weekday: 'short' })}</td>
                                            <td className="py-2">
                                                <span className={cn(
                                                    'inline-flex items-center gap-1 font-semibold',
                                                    d.status === 'CLOSED'
                                                        ? 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                                        : 'text-[#946A1C] dark:text-[#E8D9B8]',
                                                )}>
                                                    {d.status === 'CLOSED'
                                                        ? <Check className="h-3.5 w-3.5" />
                                                        : <Pencil className="h-3.5 w-3.5" />}
                                                    {d.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}
                                                </span>
                                            </td>
                                            <td className={cn("py-2 text-right font-mono font-bold tabular-nums", d.totalVariance < -0.01 ? 'text-red-600 dark:text-red-400' : d.totalVariance > 0.01 ? 'text-blue-600 dark:text-blue-400' : 'text-capsula-ink-muted')}>
                                                {d.totalVariance >= 0 ? '+' : ''}{d.totalVariance?.toFixed(2) || '0'}
                                            </td>
                                            <td className="py-2 text-right font-mono tabular-nums text-orange-600 dark:text-orange-400">
                                                {d.totalWaste > 0 ? d.totalWaste.toFixed(2) : '-'}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                {d.negativeCount > 0 ? <span className="font-black text-red-600 dark:text-red-400">{d.negativeCount}</span> : <span className="text-capsula-ink-muted">-</span>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                {rangeSummary.length > 1 && (
                                    <tr className="border-t-2 border-blue-400 font-black text-blue-900 dark:text-blue-100 bg-blue-100/40 dark:bg-blue-900/30">
                                        <td className="py-2 pr-4">TOTALES ({rangeSummary.length} días)</td>
                                        <td className="py-2 pr-4"></td>
                                        <td className={cn("py-2 pr-4 text-right font-mono", rangeSummary.reduce((s, d) => s + (d.totalVariance || 0), 0) < 0 ? 'text-red-700' : 'text-blue-700')}>
                                            {(() => { const t = rangeSummary.reduce((s, d) => s + (d.totalVariance || 0), 0); return (t >= 0 ? '+' : '') + t.toFixed(2); })()}
                                        </td>
                                        <td className="py-2 pr-4 text-right font-mono text-orange-700">
                                            {rangeSummary.reduce((s, d) => s + (d.totalWaste || 0), 0).toFixed(2)}
                                        </td>
                                        <td className="py-2 pr-4 text-right text-red-700">
                                            {rangeSummary.reduce((s, d) => s + (d.negativeCount || 0), 0)}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modales */}
            {showConfig && (
                <CriticalListManager
                    areaId={selectedArea}
                    areaName={selectedAreaName}
                    onClose={() => setShowConfig(false)}
                    onUpdate={loadData}
                />
            )}
            {showSalesModal && data && (
                <SalesEntryModal
                    dailyId={data.id}
                    onClose={() => setShowSalesModal(false)}
                    onUpdate={loadData}
                />
            )}

            {/* Controles Superiores */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-capsula-line bg-capsula-ivory-alt p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col">
                        <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-capsula-ink-muted">Fecha de Auditoría</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-sm font-bold text-capsula-ink shadow-sm"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-capsula-ink-muted">Área / Ubicación</label>
                        <select
                            value={selectedArea}
                            onChange={e => setSelectedArea(e.target.value)}
                            className="min-w-[200px] appearance-none rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-sm font-bold text-capsula-ink shadow-sm"
                        >
                            {initialAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-wrap gap-2 self-end pb-0.5">
                        <button
                            onClick={() => {
                                setShowRangeReport(!showRangeReport);
                                if (!showRangeReport && rangeSummary.length === 0) loadRangeReport();
                            }}
                            className={cn(
                                "rounded-xl border px-4 py-2 text-sm font-bold shadow-sm transition-all",
                                showRangeReport
                                    ? 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                    : 'border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-surface'
                            )}
                        >
                            <BarChart3 className="mr-1 inline h-4 w-4" /> Reporte por Rango
                        </button>
                        <button
                            onClick={exportToExcel}
                            disabled={!items.length}
                            className="flex items-center gap-1.5 rounded-xl border border-[#D3E2D8] bg-[#E5EDE7]/60 px-4 py-2 text-sm font-bold text-[#2F6B4E] shadow-sm transition-all hover:bg-[#E5EDE7] disabled:opacity-40 dark:border-[#3a5b48] dark:bg-[#1E3B2C]/40 dark:text-[#6FB88F] dark:hover:bg-[#1E3B2C]/70"
                            title="Descargar inventario del día como Excel"
                        >
                            <Download className="h-4 w-4" /> Exportar Excel
                        </button>
                        <button
                            onClick={() => setShowConfig(true)}
                            className="flex items-center gap-1.5 rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-2 text-sm font-bold text-capsula-ink-soft shadow-sm transition-all hover:bg-capsula-ivory-surface"
                        >
                            <Settings className="h-4 w-4" /> Configurar Items
                        </button>
                        {!isClosed && data && !isProduction && (
                            <>
                                <button
                                    onClick={async () => {
                                        setSyncingSales(true);
                                        const res = await syncSalesFromOrdersAction(data.id);
                                        if (res.success) {
                                            toast.success(res.message);
                                            loadData();
                                        } else toast.error(res.message);
                                        setSyncingSales(false);
                                    }}
                                    disabled={syncingSales || loading}
                                    className="px-4 py-2 text-sm font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-xl hover:bg-emerald-200 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {syncingSales
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Inbox className="h-4 w-4" />}
                                    Importar desde POS
                                </button>
                                <button
                                    onClick={() => setShowSalesModal(true)}
                                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700"
                                >
                                    <CreditCard className="h-4 w-4" /> Cargar Ventas Manual
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 items-center flex-wrap">
                    {data?.status === 'DRAFT' && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-black tracking-widest px-3 py-1.5 rounded-lg border border-amber-200 uppercase">
                            Estado: Borrador
                        </span>
                    )}
                    {data?.status === 'CLOSED' && (
                        <span className="bg-red-500 text-white text-[10px] font-black tracking-tighter px-3 py-1 rounded-full border border-red-600 uppercase">
                            Inventario Finalizado
                        </span>
                    )}

                    {!isClosed && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={loading || !hasChanges}
                                className={cn(
                                    "rounded-xl px-6 py-2.5 font-bold shadow-lg transition",
                                    hasChanges
                                        ? "bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700"
                                        : "cursor-not-allowed bg-capsula-line text-capsula-ink-muted"
                                )}
                            >
                                {loading
                                    ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</span>
                                    : <span className="inline-flex items-center gap-1.5"><Save className="h-4 w-4" /> Guardar</span>}
                            </button>
                            <button
                                onClick={handleCloseDay}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-green-500/20 transition hover:bg-green-700 disabled:opacity-50"
                            >
                                <CheckCircle2 className="h-4 w-4" /> Finalizar Día
                            </button>
                        </div>
                    )}
                    {isClosed && (
                        <button
                            onClick={handleReopen}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700 transition-all hover:bg-orange-200 disabled:opacity-50"
                        >
                            <Unlock className="h-4 w-4" /> Reabrir
                        </button>
                    )}
                </div>
            </div>

            {/* Leyenda de colores de columnas */}
            {!loading && items.length > 0 && (
                <div className="flex flex-wrap gap-4 border-b border-capsula-line bg-capsula-ivory-alt px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-capsula-ink-muted">
                    <span className="inline-flex items-center gap-1.5 text-blue-600"><span className="h-2 w-2 rounded-full bg-blue-600" /> Apertura</span>
                    <span className="inline-flex items-center gap-1.5 text-indigo-600"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Entradas (+)</span>
                    <span className="inline-flex items-center gap-1.5 text-rose-600"><span className="h-2 w-2 rounded-full bg-rose-600" /> Ventas/Consumo (−)</span>
                    <span className="inline-flex items-center gap-1.5 text-orange-500"><span className="h-2 w-2 rounded-full bg-orange-500" /> Merma (−)</span>
                    <span className="inline-flex items-center gap-1.5 text-capsula-ink-muted"><span className="h-2 w-2 rounded-sm border border-capsula-line-strong" /> Teórico = Apertura + Entradas − Ventas − Merma</span>
                    <span className="inline-flex items-center gap-1.5 text-green-600"><span className="h-2 w-2 rounded-full bg-green-600" /> Cierre real</span>
                    {Object.values(autoSuggestions).some(s => s.autoEntries > 0 || s.autoSales > 0) && (
                        <span className="inline-flex items-center gap-1.5 text-cyan-600"><Zap className="h-3 w-3" /> Sugerencia automática (click para aplicar)</span>
                    )}
                </div>
            )}

            {/* TABLA */}
            <div className="relative flex-1 overflow-auto bg-capsula-ivory">
                {loading && !items.length ? (
                    <div className="flex flex-col items-center gap-3 p-10 text-center text-capsula-ink-muted">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        Cargando planilla de inventario...
                    </div>
                ) : (
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-blue-600 dark:bg-gray-900 sticky top-0 z-10 shadow-md">
                            <tr className="text-white text-[10px] h-12 uppercase tracking-widest font-black">
                                <th className="min-w-[220px] border-r border-blue-500/30 px-6 py-2">
                                    <span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Producto Crítico</span>
                                </th>
                                <th className="min-w-[90px] border-r border-blue-500/30 bg-blue-700/50 px-3 py-2 text-center">Apertura</th>
                                <th className="min-w-[100px] border-r border-blue-500/30 bg-indigo-700/50 px-3 py-2 text-center" title="Editable. Hay sugerencia automática indicada con icono Zap.">
                                    {isProduction ? 'Producción (+)' : 'Entradas (+)'}
                                </th>
                                <th className="min-w-[100px] border-r border-blue-500/30 bg-rose-700/40 px-3 py-2 text-center" title="Editable. Hay sugerencia automática indicada con icono Zap.">
                                    {isProduction ? 'Transf. Salida (−)' : 'Ventas (−)'}
                                </th>
                                <th className="px-3 py-2 text-center border-r border-blue-500/30 bg-orange-700/40 min-w-[90px]" title="Merma / desperdicio">
                                    Merma (−)
                                </th>
                                <th className="px-3 py-2 text-center border-r border-blue-500/30 bg-gray-800/20 min-w-[80px]">Teórico</th>
                                <th className="px-3 py-2 text-center border-r border-blue-500/30 bg-green-700/50 min-w-[90px]">Cierre</th>
                                <th className="px-6 py-2 text-right bg-blue-800 font-extrabold underline decoration-blue-300 min-w-[100px]">Variación</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-capsula-line">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="bg-capsula-ivory-alt px-4 py-12 text-center text-capsula-ink-muted">
                                        No hay productos críticos asignados a este reporte.<br />
                                        <button onClick={() => setShowConfig(true)} className="mt-2 text-sm text-capsula-coral underline">
                                            Configurar lista de items críticos →
                                        </button>
                                    </td>
                                </tr>
                            ) : items.map(item => {
                                const theoretical = item.theoreticalStock || 0;
                                const variance = item.variance || 0;
                                const isNegativeVariance = variance < -0.01;
                                const suggestion = autoSuggestions[item.inventoryItemId];
                                const hasEntryHint = suggestion && suggestion.autoEntries > 0;
                                const hasSalesHint = suggestion && suggestion.autoSales > 0;

                                return (
                                    <tr key={item.id} className="group transition-all hover:bg-capsula-ivory-surface">
                                        {/* PRODUCTO */}
                                        <td className="border-r border-capsula-line px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black uppercase tracking-tight text-capsula-ink transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-400">
                                                    {item.inventoryItem.name}
                                                </span>
                                                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-capsula-ink-muted">
                                                    {item.inventoryItem.sku} • {item.unit}
                                                </span>
                                            </div>
                                        </td>

                                        {/* APERTURA */}
                                        <td className="border-r border-capsula-line px-3 py-3 text-center">
                                            <input
                                                type="number"
                                                disabled={isClosed}
                                                value={item.initialCount || 0}
                                                onChange={e => handleInputChange(item.id, 'initialCount', e.target.value)}
                                                className="w-20 rounded-lg border border-capsula-line bg-capsula-ivory-alt py-1.5 text-center text-sm font-bold tabular-nums text-capsula-ink focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                                onFocus={e => e.target.select()}
                                                step="0.01"
                                            />
                                        </td>

                                        {/* ENTRADAS */}
                                        <td className="border-r border-capsula-line px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="number"
                                                    disabled={isClosed}
                                                    value={item.entries || 0}
                                                    onChange={e => handleInputChange(item.id, 'entries', e.target.value)}
                                                    className="w-20 rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-center text-sm font-bold tabular-nums text-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                                                    onFocus={e => e.target.select()}
                                                    step="0.01"
                                                />
                                                {hasEntryHint && !isClosed && (
                                                    <button
                                                        onClick={() => applyAutoSuggestion(item.id, item.inventoryItemId, 'entries')}
                                                        title={`Aplicar sugerencia automática: ${suggestion.autoEntries}`}
                                                        className="rounded-full p-1 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-800 dark:hover:bg-cyan-900/30"
                                                        aria-label="Aplicar sugerencia automática"
                                                    >
                                                        <Zap className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        {/* VENTAS */}
                                        <td className="border-r border-capsula-line px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="number"
                                                    disabled={isClosed}
                                                    value={item.sales || 0}
                                                    onChange={e => handleInputChange(item.id, 'sales', e.target.value)}
                                                    className="w-20 rounded-lg border border-rose-200 bg-rose-50 py-1.5 text-center text-sm font-bold tabular-nums text-rose-700 focus:ring-2 focus:ring-rose-500 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                                                    onFocus={e => e.target.select()}
                                                    step="0.01"
                                                />
                                                {hasSalesHint && !isClosed && (
                                                    <button
                                                        onClick={() => applyAutoSuggestion(item.id, item.inventoryItemId, 'sales')}
                                                        title={`Aplicar sugerencia automática: ${suggestion.autoSales}`}
                                                        className="rounded-full p-1 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-800 dark:hover:bg-cyan-900/30"
                                                        aria-label="Aplicar sugerencia automática"
                                                    >
                                                        <Zap className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        {/* MERMA */}
                                        <td className="border-r border-capsula-line px-3 py-3 text-center">
                                            <input
                                                type="number"
                                                disabled={isClosed}
                                                value={item.waste || 0}
                                                onChange={e => handleInputChange(item.id, 'waste', e.target.value)}
                                                className="w-20 rounded-lg border border-orange-200 bg-orange-50 py-1.5 text-center text-sm font-bold tabular-nums text-orange-700 focus:ring-2 focus:ring-orange-500 disabled:opacity-60 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
                                                onFocus={e => e.target.select()}
                                                step="0.01"
                                            />
                                        </td>

                                        {/* TEÓRICO */}
                                        <td className="border-r border-capsula-line bg-capsula-ivory-alt px-3 py-3 text-center font-mono text-capsula-ink-muted">
                                            <span className="text-sm font-bold tabular-nums">{theoretical.toFixed(2)}</span>
                                        </td>

                                        {/* FINAL */}
                                        <td className="border-r border-capsula-line px-3 py-3 text-center">
                                            <input
                                                type="number"
                                                disabled={isClosed}
                                                value={item.finalCount || 0}
                                                onChange={e => handleInputChange(item.id, 'finalCount', e.target.value)}
                                                className="w-20 rounded-lg border-2 border-green-200 bg-capsula-ivory py-1.5 text-center text-sm font-black tabular-nums text-capsula-ink focus:ring-2 focus:ring-green-500 disabled:opacity-60 dark:border-green-900"
                                                onFocus={e => e.target.select()}
                                                step="0.01"
                                            />
                                        </td>

                                        {/* VARIACIÓN */}
                                        <td className="border-l border-capsula-line px-6 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={cn(
                                                    "text-lg font-black tracking-tighter tabular-nums",
                                                    isNegativeVariance ? "text-red-600 dark:text-red-400" : (variance > 0.01 ? "text-blue-600 dark:text-blue-400" : "text-capsula-ink-muted")
                                                )}>
                                                    {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter text-capsula-ink-muted">
                                                    {isNegativeVariance
                                                        ? <><AlertTriangle className="h-3 w-3" /> Faltante</>
                                                        : variance > 0.01
                                                            ? 'Sobrante'
                                                            : <><Check className="h-3 w-3" /> OK</>}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {items.length > 0 && (
                            <tfoot className="sticky bottom-0 bg-capsula-navy-deep text-capsula-ivory">
                                <tr className="text-xs font-black uppercase tracking-widest">
                                    <td className="px-6 py-2 text-capsula-ivory/80">TOTALES ({items.length} items)</td>
                                    <td className="px-3 py-2 text-center font-mono tabular-nums text-blue-300">
                                        {items.reduce((s, i) => s + (i.initialCount || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono tabular-nums text-indigo-300">
                                        +{items.reduce((s, i) => s + (i.entries || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono tabular-nums text-rose-300">
                                        −{items.reduce((s, i) => s + (i.sales || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono tabular-nums text-orange-300">
                                        −{items.reduce((s, i) => s + (i.waste || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono tabular-nums text-capsula-ivory/80">
                                        {items.reduce((s, i) => s + (i.theoreticalStock || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono tabular-nums text-green-300">
                                        {items.reduce((s, i) => s + (i.finalCount || 0), 0).toFixed(2)}
                                    </td>
                                    <td className={cn(
                                        "px-6 py-2 text-right font-mono text-lg tabular-nums",
                                        items.reduce((s, i) => s + (i.variance || 0), 0) < -0.01 ? 'text-red-400' : 'text-blue-300'
                                    )}>
                                        {(() => { const t = items.reduce((s, i) => s + (i.variance || 0), 0); return (t >= 0 ? '+' : '') + t.toFixed(2); })()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                )}
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-capsula-line bg-[#E6ECF4] px-6 py-3 text-[10px] font-bold text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]">
                <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> LISTA CRÍTICA DE: <strong>{selectedAreaName.toUpperCase()}</strong> (Cada área tiene su propia lista)</span>
                <span className="flex gap-4">
                    <span>APERTURA + ENTRADAS − VENTAS − MERMA = TEÓRICO</span>
                    <span>CIERRE − TEÓRICO = VARIACIÓN</span>
                </span>
            </div>
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
