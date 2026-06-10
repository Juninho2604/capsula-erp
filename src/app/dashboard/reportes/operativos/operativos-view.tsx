'use client';

/**
 * Reportes OPERATIVOS — cierres Z por día, turnos de caja (X), anulaciones
 * con motivo/autorizador, descuentos/cortesías y transferencias de mesa.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getOperativosReportAction, type OperativosReportData } from '@/app/actions/reports/operativos.actions';
import {
    ReportToolbar, ReportSkeleton, ReportEmptyState, FamilyTabs, type BranchOption,
} from '../_components/report-shell';
import { fmtUsd, fmtQty, presetRange, type DateRange } from '../_components/format';
import { exportAoaToExcel, exportElementToPdf, type Aoa } from '../_components/export';

type TabKey = 'cierres' | 'turnos' | 'anulaciones' | 'descuentos' | 'transferencias';

const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'cierres', label: 'Cierres por día (Z)' },
    { key: 'turnos', label: 'Turnos de caja (X)' },
    { key: 'anulaciones', label: 'Anulaciones' },
    { key: 'descuentos', label: 'Descuentos' },
    { key: 'transferencias', label: 'Transf. de mesa' },
];

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-left';
const THn = TH + ' text-right';
const TD = 'px-3 py-2 text-sm text-capsula-ink';
const TDn = TD + ' text-right tabular-nums';

const dt = (iso: string) => new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

export default function OperativosReportView({ tenantName, branches, canExport }: {
    tenantName: string; branches: BranchOption[]; canExport: boolean;
}) {
    const [range, setRange] = useState<DateRange>(presetRange('SEMANA'));
    const [branchId, setBranchId] = useState('');
    const [tab, setTab] = useState<TabKey>('cierres');
    const [data, setData] = useState<OperativosReportData | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getOperativosReportAction({
                from: range.from, to: range.to,
                branchIds: branchId ? [branchId] : undefined,
            });
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
    }, [range.from, range.to, branchId]);

    useEffect(() => { void load(); }, [load]);

    const branchLabel = branchId ? branches.find(b => b.id === branchId)?.name : undefined;
    const meta = useMemo(() => ({
        tenantName, reportTitle: `Operativos — ${TABS.find(t => t.key === tab)?.label}`,
        from: range.from, to: range.to, branchLabel,
    }), [tenantName, tab, range, branchLabel]);

    const exportExcel = () => {
        if (!data) return;
        let body: Aoa = [];
        if (tab === 'cierres') {
            body = [
                ['DÍA', 'ÓRDENES', 'FACTURADO $', 'COBRADO $', 'SERVICIO 10% $', 'PROPINAS $', 'ANULADAS', 'ANULADO $'],
                ...data.closures.map(c => [c.day, c.orders, c.facturado, c.cobrado, c.serviceCharge, c.propinas, c.anuladasCount, c.anuladasTotal]),
            ];
        } else if (tab === 'turnos') {
            body = [
                ['CAJA', 'FECHA', 'ESTADO', 'ABRIÓ', 'CERRÓ', 'FONDO $', 'FONDO Bs', 'CIERRE $', 'VENTAS VINCULADAS $', 'ÓRDENES', 'DIF. GUARDADA $'],
                ...data.shifts.map(s => [s.registerName, s.shiftDate.slice(0, 10), s.status, s.openedBy, s.closedBy ?? '—', s.openingCashUsd, s.openingCashBs, s.closingCashUsd ?? '', s.linkedSalesUsd, s.linkedOrders, s.storedDifference ?? '']),
            ];
        } else if (tab === 'anulaciones') {
            body = [
                ['— ÓRDENES ANULADAS —'],
                ['ORDEN', 'FECHA', 'TOTAL $', 'MOTIVO', 'ANULÓ', 'CREÓ'],
                ...data.voids.orders.map(o => [o.orderNumber, dt(o.voidedAt), o.total, o.voidReason ?? '', o.voidedBy ?? '', o.createdBy]),
                [],
                ['— ÍTEMS ANULADOS EN MESA —'],
                ['ORDEN', 'FECHA', 'ÍTEM', 'CANT.', 'MONTO $', 'MOTIVO', 'AUTORIZÓ'],
                ...data.voids.items.map(i => [i.orderNumber, dt(i.voidedAt), i.itemName, i.quantity, i.lineTotal, i.voidReason ?? '', i.authorizedBy]),
            ];
        } else if (tab === 'descuentos') {
            body = [
                ['ORDEN', 'FECHA', 'TIPO', 'MOTIVO', 'DESCUENTO $', 'TOTAL $', 'AUTORIZÓ', 'CAJERA'],
                ...data.discounts.rows.map(r => [r.orderNumber, dt(r.createdAt), r.discountType, r.discountReason ?? '', r.discount, r.total, r.authorizedBy ?? '', r.createdBy]),
            ];
        } else {
            body = [
                ['FECHA', 'MESA/TAB', 'DE', 'A', 'MESA ORIGEN', 'MESA DESTINO', 'AUTORIZÓ', 'MOTIVO'],
                ...data.transfers.map(t => [dt(t.transferredAt), t.tabCode, t.fromWaiter, t.toWaiter, t.fromTable ?? '', t.toTable ?? '', t.authorizedBy, t.reason ?? '']),
            ];
        }
        exportAoaToExcel(meta, body, `operativos_${tab}`);
    };

    const isEmpty = data && data.closures.length === 0 && data.shifts.length === 0
        && data.voids.orders.length === 0 && data.voids.items.length === 0
        && data.discounts.rows.length === 0 && data.transfers.length === 0;

    return (
        <div className="max-w-6xl mx-auto space-y-4 p-4 sm:p-6">
            <header className="flex items-center gap-3">
                <Link href="/dashboard/reportes" className="h-9 w-9 rounded-full border border-capsula-line flex items-center justify-center text-capsula-ink-muted hover:bg-capsula-ivory-alt">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">Reportes operativos</h1>
                    <p className="text-xs text-capsula-ink-muted">
                        El detalle Z completo de un día sigue en{' '}
                        <Link href="/dashboard/sales" className="underline inline-flex items-center gap-0.5">Historial de ventas <ExternalLink className="h-3 w-3" /></Link>
                    </p>
                </div>
            </header>

            <ReportToolbar
                range={range} onRangeChange={setRange}
                branches={branches} branchId={branchId} onBranchChange={setBranchId}
                canExport={canExport}
                onExportExcel={exportExcel}
                onExportPdf={() => exportElementToPdf(meta, 'operativos-report-body')}
                busy={loading}
            />

            <FamilyTabs tabs={TABS} active={tab} onChange={setTab} />

            {loading ? <ReportSkeleton /> : isEmpty ? (
                <ReportEmptyState title="Sin actividad en el rango" hint="Cierres, anulaciones y transferencias aparecerán aquí a medida que el POS opere." />
            ) : data && (
                <div id="operativos-report-body" className="bg-capsula-ivory border border-capsula-line rounded-2xl overflow-x-auto">
                    {tab === 'cierres' && <ClosuresTable data={data} />}
                    {tab === 'turnos' && <ShiftsTable data={data} />}
                    {tab === 'anulaciones' && <VoidsTables data={data} />}
                    {tab === 'descuentos' && <DiscountsTable data={data} />}
                    {tab === 'transferencias' && <TransfersTable data={data} />}
                </div>
            )}
        </div>
    );
}

function ClosuresTable({ data }: { data: OperativosReportData }) {
    const t = data.closures.reduce((acc, c) => ({
        orders: acc.orders + c.orders, fact: acc.fact + c.facturado, cob: acc.cob + c.cobrado,
        serv: acc.serv + c.serviceCharge, tips: acc.tips + c.propinas,
        vc: acc.vc + c.anuladasCount, vt: acc.vt + c.anuladasTotal,
    }), { orders: 0, fact: 0, cob: 0, serv: 0, tips: 0, vc: 0, vt: 0 });
    return (
        <table className="w-full min-w-[760px]">
            <thead className="bg-capsula-ivory-alt"><tr>
                <th className={TH}>Día</th><th className={THn}>Órdenes</th><th className={THn}>Facturado</th>
                <th className={THn}>Cobrado</th><th className={THn}>Servicio 10%</th>
                <th className={THn}>Propinas</th><th className={THn}>Anuladas</th>
            </tr></thead>
            <tbody>
                {data.closures.map(c => (
                    <tr key={c.day} className="border-t border-capsula-line">
                        <td className={TD}>{c.day}</td>
                        <td className={TDn}>{fmtQty(c.orders)}</td>
                        <td className={TDn}>{fmtUsd(c.facturado)}</td>
                        <td className={TDn}>{fmtUsd(c.cobrado)}</td>
                        <td className={TDn}>{fmtUsd(c.serviceCharge)}</td>
                        <td className={TDn}>{fmtUsd(c.propinas)}</td>
                        <td className={TDn}>
                            {c.anuladasCount > 0
                                ? <span className="text-[#B04A2E] dark:text-[#EFD2C8]">{c.anuladasCount} · {fmtUsd(c.anuladasTotal)}</span>
                                : '—'}
                        </td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr className="border-t border-capsula-line-strong bg-capsula-ivory-alt font-semibold">
                <td className={TD}>TOTAL</td>
                <td className={TDn}>{fmtQty(t.orders)}</td>
                <td className={TDn}>{fmtUsd(t.fact)}</td>
                <td className={TDn}>{fmtUsd(t.cob)}</td>
                <td className={TDn}>{fmtUsd(t.serv)}</td>
                <td className={TDn}>{fmtUsd(t.tips)}</td>
                <td className={TDn}>{t.vc} · {fmtUsd(t.vt)}</td>
            </tr></tfoot>
        </table>
    );
}

function ShiftsTable({ data }: { data: OperativosReportData }) {
    return (
        <div>
            <table className="w-full min-w-[860px]">
                <thead className="bg-capsula-ivory-alt"><tr>
                    <th className={TH}>Caja / turno</th><th className={TH}>Estado</th>
                    <th className={TH}>Abrió / Cerró</th>
                    <th className={THn}>Fondo</th><th className={THn}>Cierre contado</th>
                    <th className={THn}>Ventas del turno*</th><th className={THn}>Dif. guardada</th>
                </tr></thead>
                <tbody>
                    {data.shifts.map(s => (
                        <tr key={s.id} className="border-t border-capsula-line">
                            <td className={TD}>
                                <div className="font-medium">{s.registerName}</div>
                                <div className="text-[11px] text-capsula-ink-muted">{s.shiftDate.slice(0, 10)} · {s.shiftType}</div>
                            </td>
                            <td className={TD}>
                                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                                    s.status === 'OPEN'
                                        ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                        : 'bg-capsula-ivory-alt text-capsula-ink-muted'
                                }`}>{s.status === 'OPEN' ? 'Abierta' : 'Cerrada'}</span>
                            </td>
                            <td className={TD + ' text-xs'}>{s.openedBy}{s.closedBy ? ` / ${s.closedBy}` : ''}</td>
                            <td className={TDn}>{fmtUsd(s.openingCashUsd)}{s.openingCashBs > 0 ? ` · Bs ${fmtQty(s.openingCashBs)}` : ''}</td>
                            <td className={TDn}>{s.closingCashUsd !== null ? fmtUsd(s.closingCashUsd) : '—'}</td>
                            <td className={TDn}>
                                {s.linkedOrders > 0
                                    ? <>{fmtUsd(s.linkedSalesUsd)} <span className="text-[11px] text-capsula-ink-muted">({s.linkedOrders} órd.)</span></>
                                    : <span className="text-capsula-ink-faint">sin vínculo</span>}
                            </td>
                            <td className={TDn}>{s.storedDifference !== null ? fmtUsd(s.storedDifference) : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="px-3 py-2 text-[11px] text-capsula-ink-muted border-t border-capsula-line">
                *Ventas vinculadas por turno (cashRegisterId) — disponible para ventas posteriores al 2026-06-10.
                Los turnos previos muestran solo los totales guardados al cierre.
            </p>
        </div>
    );
}

function VoidsTables({ data }: { data: OperativosReportData }) {
    return (
        <div className="divide-y divide-capsula-line">
            <div>
                <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Órdenes anuladas ({data.voids.totals.ordersCount} · {fmtUsd(data.voids.totals.ordersTotal)})
                </p>
                <table className="w-full min-w-[720px]">
                    <thead className="bg-capsula-ivory-alt"><tr>
                        <th className={TH}>Orden</th><th className={TH}>Fecha</th><th className={THn}>Total</th>
                        <th className={TH}>Motivo</th><th className={TH}>Anuló</th><th className={TH}>Creó</th>
                    </tr></thead>
                    <tbody>
                        {data.voids.orders.length === 0 && (
                            <tr><td className={TD + ' text-capsula-ink-muted'} colSpan={6}>Sin órdenes anuladas en el rango</td></tr>
                        )}
                        {data.voids.orders.map((o, i) => (
                            <tr key={i} className="border-t border-capsula-line">
                                <td className={TD}>{o.orderNumber}</td>
                                <td className={TD + ' text-xs'}>{dt(o.voidedAt)}</td>
                                <td className={TDn}>{fmtUsd(o.total)}</td>
                                <td className={TD + ' text-xs max-w-[16rem] truncate'} title={o.voidReason ?? ''}>{o.voidReason ?? '—'}</td>
                                <td className={TD + ' text-xs'}>{o.voidedBy ?? '—'}</td>
                                <td className={TD + ' text-xs'}>{o.createdBy}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div>
                <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                    Ítems anulados en mesa ({data.voids.totals.itemsCount} · {fmtUsd(data.voids.totals.itemsTotal)})
                </p>
                <table className="w-full min-w-[720px]">
                    <thead className="bg-capsula-ivory-alt"><tr>
                        <th className={TH}>Orden</th><th className={TH}>Ítem</th><th className={THn}>Cant.</th>
                        <th className={THn}>Monto</th><th className={TH}>Motivo</th><th className={TH}>Autorizó</th>
                    </tr></thead>
                    <tbody>
                        {data.voids.items.length === 0 && (
                            <tr><td className={TD + ' text-capsula-ink-muted'} colSpan={6}>Sin ítems anulados en el rango</td></tr>
                        )}
                        {data.voids.items.map((it, i) => (
                            <tr key={i} className="border-t border-capsula-line">
                                <td className={TD}>{it.orderNumber}</td>
                                <td className={TD}>{it.itemName}{it.replaced && <span className="ml-1 text-[10px] text-capsula-ink-muted">(reemplazado)</span>}</td>
                                <td className={TDn}>{it.quantity}</td>
                                <td className={TDn}>{fmtUsd(it.lineTotal)}</td>
                                <td className={TD + ' text-xs max-w-[14rem] truncate'} title={it.voidReason ?? ''}>{it.voidReason ?? '—'}</td>
                                <td className={TD + ' text-xs'}>{it.authorizedBy}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DiscountsTable({ data }: { data: OperativosReportData }) {
    return (
        <div>
            <div className="flex flex-wrap gap-2 p-3">
                {data.discounts.byType.map(t => (
                    <span key={t.discountType} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-capsula-ivory-alt text-capsula-ink-soft">
                        {t.discountType}: {t.count} · {fmtUsd(t.amount)}
                    </span>
                ))}
                {data.discounts.promos.map(p => (
                    <span key={p.promotionName} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]">
                        Promo {p.promotionName}: {fmtUsd(p.amount)}
                    </span>
                ))}
            </div>
            <table className="w-full min-w-[760px]">
                <thead className="bg-capsula-ivory-alt"><tr>
                    <th className={TH}>Orden</th><th className={TH}>Fecha</th><th className={TH}>Tipo</th>
                    <th className={THn}>Descuento</th><th className={THn}>Total</th>
                    <th className={TH}>Autorizó</th><th className={TH}>Cajera</th>
                </tr></thead>
                <tbody>
                    {data.discounts.rows.map((r, i) => (
                        <tr key={i} className="border-t border-capsula-line">
                            <td className={TD}>{r.orderNumber}</td>
                            <td className={TD + ' text-xs'}>{dt(r.createdAt)}</td>
                            <td className={TD + ' text-xs'}>{r.discountType}{r.discountReason ? ` — ${r.discountReason}` : ''}</td>
                            <td className={TDn}>{fmtUsd(r.discount)}</td>
                            <td className={TDn}>{fmtUsd(r.total)}</td>
                            <td className={TD + ' text-xs'}>{r.authorizedBy ?? '—'}</td>
                            <td className={TD + ' text-xs'}>{r.createdBy}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot><tr className="border-t border-capsula-line-strong bg-capsula-ivory-alt font-semibold">
                    <td className={TD} colSpan={3}>TOTAL ({data.discounts.totals.count})</td>
                    <td className={TDn}>{fmtUsd(data.discounts.totals.amount)}</td>
                    <td colSpan={3}></td>
                </tr></tfoot>
            </table>
        </div>
    );
}

function TransfersTable({ data }: { data: OperativosReportData }) {
    return (
        <table className="w-full min-w-[760px]">
            <thead className="bg-capsula-ivory-alt"><tr>
                <th className={TH}>Fecha</th><th className={TH}>Mesa/Tab</th>
                <th className={TH}>De → A (mesonero)</th><th className={TH}>Mesa origen → destino</th>
                <th className={TH}>Autorizó</th><th className={TH}>Motivo</th>
            </tr></thead>
            <tbody>
                {data.transfers.map((t, i) => (
                    <tr key={i} className="border-t border-capsula-line">
                        <td className={TD + ' text-xs'}>{dt(t.transferredAt)}</td>
                        <td className={TD}>{t.tabCode}</td>
                        <td className={TD + ' text-xs'}>{t.fromWaiter} → {t.toWaiter}</td>
                        <td className={TD + ' text-xs'}>{t.fromTable ?? '—'} → {t.toTable ?? '—'}</td>
                        <td className={TD + ' text-xs'}>{t.authorizedBy}</td>
                        <td className={TD + ' text-xs max-w-[12rem] truncate'} title={t.reason ?? ''}>{t.reason ?? '—'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
