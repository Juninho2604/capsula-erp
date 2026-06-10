'use client';

/**
 * Kardex de movimientos por rango — filtros por insumo/área/tipo, resumen
 * por tipo de movimiento, paginación server-side y export.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    getKardexReportAction, getKardexFilterOptionsAction,
} from '@/app/actions/reports/inventario.actions';
import type { KardexReport } from '@/lib/reports/inventory-reports';
import { ReportToolbar, ReportSkeleton, ReportEmptyState } from '../_components/report-shell';
import { fmtQty, fmtUsd, presetRange, type DateRange } from '../_components/format';
import { exportAoaToExcel, exportElementToPdf } from '../_components/export';

const MOVEMENT_LABELS: Record<string, string> = {
    PURCHASE: 'Compra', SALE: 'Venta', PRODUCTION_IN: 'Producción (entrada)',
    PRODUCTION_OUT: 'Producción (salida)', ADJUSTMENT_IN: 'Ajuste +', ADJUSTMENT_OUT: 'Ajuste −',
    TRANSFER: 'Transferencia', WASTE: 'Merma',
};

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-left';
const THn = TH + ' text-right';
const TD = 'px-3 py-2 text-sm text-capsula-ink';
const TDn = TD + ' text-right tabular-nums';

export default function KardexView({ tenantName, canExport }: { tenantName: string; canExport: boolean }) {
    const [range, setRange] = useState<DateRange>(presetRange('SEMANA'));
    const [itemId, setItemId] = useState('');
    const [areaId, setAreaId] = useState('');
    const [movementType, setMovementType] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<KardexReport | null>(null);
    const [options, setOptions] = useState<{ items: Array<{ id: string; sku: string; name: string }>; areas: Array<{ id: string; name: string }> }>({ items: [], areas: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getKardexFilterOptionsAction()
            .then(res => { if (res.success && res.data) setOptions(res.data); })
            .catch(() => { /* filtros vacíos — el kardex sigue funcionando */ });
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getKardexReportAction({
                from: range.from, to: range.to,
                inventoryItemId: itemId || undefined,
                areaId: areaId || undefined,
                movementType: movementType || undefined,
                page,
            });
            if (!res.success || !res.data) {
                toast.error(res.message ?? 'Error cargando kardex');
                setData(null);
                return;
            }
            setData(res.data);
        } catch {
            toast.error('Sin conexión con el servidor');
        } finally {
            setLoading(false);
        }
    }, [range.from, range.to, itemId, areaId, movementType, page]);

    useEffect(() => { void load(); }, [load]);

    const meta = useMemo(() => ({
        tenantName, reportTitle: 'Kardex de movimientos', from: range.from, to: range.to,
    }), [tenantName, range]);

    const exportExcel = () => {
        if (!data) return;
        exportAoaToExcel(meta, [
            ['FECHA', 'TIPO', 'SKU', 'INSUMO', 'CANT.', 'UNIDAD', 'COSTO UNIT. $', 'COSTO TOTAL $', 'ÁREA', 'MOTIVO', 'USUARIO'],
            ...data.rows.map(r => [
                new Date(r.createdAt).toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
                MOVEMENT_LABELS[r.movementType] ?? r.movementType,
                r.sku, r.itemName, r.quantity, r.unit,
                r.unitCost ?? '', r.totalCost ?? '', r.areaName ?? '', r.reason ?? '', r.createdBy,
            ]),
        ], 'kardex');
    };

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <div className="space-y-4">
            <header className="flex items-center gap-3">
                <Link href="/dashboard/reportes" className="h-9 w-9 rounded-full border border-capsula-line flex items-center justify-center text-capsula-ink-muted hover:bg-capsula-ivory-alt sm:hidden">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">Kardex de movimientos</h2>
                    <p className="text-xs text-capsula-ink-muted">Compras, ventas, producción, ajustes, transferencias y mermas por rango</p>
                </div>
            </header>

            <ReportToolbar
                range={range}
                onRangeChange={r => { setPage(1); setRange(r); }}
                canExport={canExport}
                onExportExcel={exportExcel}
                onExportPdf={() => exportElementToPdf(meta, 'kardex-report-body')}
                busy={loading}
            />

            <div className="flex flex-wrap gap-2">
                <select value={itemId} onChange={e => { setPage(1); setItemId(e.target.value); }} className="pos-input !py-1.5 !px-2 text-xs max-w-[16rem]">
                    <option value="">Todos los insumos</option>
                    {options.items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                </select>
                <select value={areaId} onChange={e => { setPage(1); setAreaId(e.target.value); }} className="pos-input !py-1.5 !px-2 text-xs">
                    <option value="">Todas las áreas</option>
                    {options.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={movementType} onChange={e => { setPage(1); setMovementType(e.target.value); }} className="pos-input !py-1.5 !px-2 text-xs">
                    <option value="">Todos los tipos</option>
                    {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>

            {loading ? <ReportSkeleton rows={8} /> : !data || data.total === 0 ? (
                <ReportEmptyState title="Sin movimientos en el rango" hint="Los movimientos de inventario (ventas, compras, ajustes) aparecerán aquí." />
            ) : (
                <div id="kardex-report-body" className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {data.summary.map(s => (
                            <span key={s.movementType} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-capsula-ivory-alt text-capsula-ink-soft">
                                {MOVEMENT_LABELS[s.movementType] ?? s.movementType}: {fmtQty(s.count)} mov · {fmtQty(s.quantity)} unid
                                {s.totalCost > 0 ? ` · ${fmtUsd(s.totalCost)}` : ''}
                            </span>
                        ))}
                    </div>

                    <div className="bg-capsula-ivory border border-capsula-line rounded-2xl overflow-x-auto">
                        <table className="w-full min-w-[860px]">
                            <thead className="bg-capsula-ivory-alt"><tr>
                                <th className={TH}>Fecha</th><th className={TH}>Tipo</th><th className={TH}>Insumo</th>
                                <th className={THn}>Cant.</th><th className={THn}>Costo</th>
                                <th className={TH}>Área</th><th className={TH}>Motivo</th><th className={TH}>Usuario</th>
                            </tr></thead>
                            <tbody>
                                {data.rows.map(r => (
                                    <tr key={r.id} className="border-t border-capsula-line">
                                        <td className={TD + ' text-xs whitespace-nowrap'}>
                                            {new Date(r.createdAt).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className={TD + ' text-xs'}>{MOVEMENT_LABELS[r.movementType] ?? r.movementType}</td>
                                        <td className={TD}><span className="text-[11px] text-capsula-ink-muted mr-1">{r.sku}</span>{r.itemName}</td>
                                        <td className={TDn}>{fmtQty(r.quantity)} {r.unit}</td>
                                        <td className={TDn}>{r.totalCost ? fmtUsd(r.totalCost) : '—'}</td>
                                        <td className={TD + ' text-xs'}>{r.areaName ?? '—'}</td>
                                        <td className={TD + ' text-xs max-w-[14rem] truncate'} title={r.reason ?? ''}>{r.reason ?? '—'}</td>
                                        <td className={TD + ' text-xs'}>{r.createdBy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between text-xs text-capsula-ink-muted no-print">
                        <span>{fmtQty(data.total)} movimientos · página {data.page} de {totalPages}</span>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={data.page <= 1 || loading}
                                className="h-8 w-8 rounded-lg border border-capsula-line flex items-center justify-center disabled:opacity-40 hover:bg-capsula-ivory-alt"
                            ><ChevronLeft className="h-4 w-4" /></button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={data.page >= totalPages || loading}
                                className="h-8 w-8 rounded-lg border border-capsula-line flex items-center justify-center disabled:opacity-40 hover:bg-capsula-ivory-alt"
                            ><ChevronRight className="h-4 w-4" /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
