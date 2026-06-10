'use client';

/**
 * Reportes de COMPRAS — por proveedor en el período + detalle de OC vs
 * recepción (diferencias pedido/recibido). La variación de precios de
 * insumos vive en /dashboard/compras/proveedor (se enlaza).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { getComprasReportAction } from '@/app/actions/reports/compras.actions';
import type { PurchasesReport } from '@/lib/reports/purchases-reports';
import { ReportToolbar, ReportSkeleton, ReportEmptyState } from '../_components/report-shell';
import { fmtQty, fmtUsd, presetRange, type DateRange } from '../_components/format';
import { exportAoaToExcel, exportElementToPdf } from '../_components/export';

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-left';
const THn = TH + ' text-right';
const TD = 'px-3 py-2 text-sm text-capsula-ink';
const TDn = TD + ' text-right tabular-nums';

const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Borrador', SENT: 'Enviada', PARTIAL: 'Parcial', RECEIVED: 'Recibida',
};

export default function ComprasReportView({ tenantName, canExport }: { tenantName: string; canExport: boolean }) {
    const [range, setRange] = useState<DateRange>(presetRange('MES'));
    const [data, setData] = useState<PurchasesReport | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getComprasReportAction({ from: range.from, to: range.to });
            if (!res.success || !res.data) {
                toast.error(res.message ?? 'Error cargando el reporte');
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
        tenantName, reportTitle: 'Compras por proveedor', from: range.from, to: range.to,
    }), [tenantName, range]);

    const exportExcel = () => {
        if (!data) return;
        exportAoaToExcel(meta, [
            ['— POR PROVEEDOR —'],
            ['PROVEEDOR', 'ÓRDENES', 'RECIBIDAS', 'TOTAL $'],
            ...data.bySupplier.map(s => [s.supplierName, s.ordersCount, s.receivedCount, s.totalAmount]),
            [],
            ['— DETALLE OC vs RECEPCIÓN —'],
            ['OC', 'NOMBRE', 'PROVEEDOR', 'ESTADO', 'FECHA', 'TOTAL $', 'UNID. PEDIDAS', 'UNID. RECIBIDAS', 'DIFERENCIA'],
            ...data.orders.map(o => [o.orderNumber, o.orderName ?? '', o.supplierName, STATUS_LABEL[o.status] ?? o.status, o.orderDate.slice(0, 10), o.totalAmount, o.itemsOrdered, o.itemsReceived, o.unitsDiff]),
        ], 'compras');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4 p-4 sm:p-6">
            <header className="flex items-center gap-3">
                <Link href="/dashboard/reportes" className="h-9 w-9 rounded-full border border-capsula-line flex items-center justify-center text-capsula-ink-muted hover:bg-capsula-ivory-alt">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">Compras por período</h1>
                    <p className="text-xs text-capsula-ink-muted">
                        Variación de precios de insumos:{' '}
                        <Link href="/dashboard/compras/proveedor" className="underline inline-flex items-center gap-0.5">
                            histórico por proveedor <ExternalLink className="h-3 w-3" />
                        </Link>
                    </p>
                </div>
            </header>

            <ReportToolbar
                range={range} onRangeChange={setRange}
                canExport={canExport}
                onExportExcel={exportExcel}
                onExportPdf={() => exportElementToPdf(meta, 'compras-report-body')}
                busy={loading}
            />

            {loading ? <ReportSkeleton /> : !data || data.totals.ordersCount === 0 ? (
                <ReportEmptyState title="Sin órdenes de compra en el rango" hint="Las OC creadas en el módulo de Compras aparecerán aquí." />
            ) : (
                <div id="compras-report-body" className="space-y-4">
                    <div className="bg-capsula-ivory border border-capsula-line rounded-2xl overflow-x-auto">
                        <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Por proveedor</p>
                        <table className="w-full min-w-[520px]">
                            <thead className="bg-capsula-ivory-alt"><tr>
                                <th className={TH}>Proveedor</th><th className={THn}>Órdenes</th>
                                <th className={THn}>Recibidas</th><th className={THn}>Total</th>
                            </tr></thead>
                            <tbody>
                                {data.bySupplier.map(s => (
                                    <tr key={s.supplierId ?? 'none'} className="border-t border-capsula-line">
                                        <td className={TD}>{s.supplierName}</td>
                                        <td className={TDn}>{fmtQty(s.ordersCount)}</td>
                                        <td className={TDn}>{fmtQty(s.receivedCount)}</td>
                                        <td className={TDn}>{fmtUsd(s.totalAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot><tr className="border-t border-capsula-line-strong bg-capsula-ivory-alt font-semibold">
                                <td className={TD}>TOTAL</td>
                                <td className={TDn}>{fmtQty(data.totals.ordersCount)}</td>
                                <td className={TDn}></td>
                                <td className={TDn}>{fmtUsd(data.totals.totalAmount)}</td>
                            </tr></tfoot>
                        </table>
                    </div>

                    <div className="bg-capsula-ivory border border-capsula-line rounded-2xl overflow-x-auto">
                        <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Detalle OC vs recepción</p>
                        <table className="w-full min-w-[760px]">
                            <thead className="bg-capsula-ivory-alt"><tr>
                                <th className={TH}>OC</th><th className={TH}>Proveedor</th><th className={TH}>Estado</th>
                                <th className={TH}>Fecha</th><th className={THn}>Total</th>
                                <th className={THn}>Pedido</th><th className={THn}>Recibido</th><th className={THn}>Dif.</th>
                            </tr></thead>
                            <tbody>
                                {data.orders.map(o => (
                                    <tr key={o.orderNumber} className="border-t border-capsula-line">
                                        <td className={TD}>{o.orderNumber}{o.orderName ? <span className="text-[11px] text-capsula-ink-muted block">{o.orderName}</span> : null}</td>
                                        <td className={TD + ' text-xs'}>{o.supplierName}</td>
                                        <td className={TD + ' text-xs'}>{STATUS_LABEL[o.status] ?? o.status}</td>
                                        <td className={TD + ' text-xs'}>{o.orderDate.slice(0, 10)}</td>
                                        <td className={TDn}>{fmtUsd(o.totalAmount)}</td>
                                        <td className={TDn}>{fmtQty(o.itemsOrdered)}</td>
                                        <td className={TDn}>{fmtQty(o.itemsReceived)}</td>
                                        <td className={TDn}>
                                            {Math.abs(o.unitsDiff) < 0.001
                                                ? <Check className="h-4 w-4 inline text-[#2F6B4E] dark:text-[#6FB88F]" />
                                                : <span className="text-[#946A1C] dark:text-[#E8D9B8]">{fmtQty(o.unitsDiff)}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
