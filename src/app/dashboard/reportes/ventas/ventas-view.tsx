'use client';

/**
 * Reporte de VENTAS por período — desglose por producto, categoría,
 * mesonero, zona, canal y método de pago (dual currency con tasa
 * histórica). Tabla con totales + gráfico de serie diaria + export.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { getVentasReportAction, type VentasReportData } from '@/app/actions/reports/ventas.actions';
import {
    ReportToolbar, ReportSkeleton, ReportEmptyState, FamilyTabs, type BranchOption,
} from '../_components/report-shell';
import {
    fmtUsd, fmtBs, fmtQty, fmtPct, fmtMoney, presetRange,
    type CurrencyMode, type DateRange,
} from '../_components/format';
import { exportAoaToExcel, exportElementToPdf, type Aoa } from '../_components/export';
import { BridgeCard } from '../_components/bridge-card';

type TabKey = 'producto' | 'categoria' | 'mesonero' | 'zona' | 'canal' | 'metodo';

const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'producto', label: 'Por producto' },
    { key: 'categoria', label: 'Por categoría' },
    { key: 'mesonero', label: 'Por mesonero' },
    { key: 'zona', label: 'Por área/zona' },
    { key: 'canal', label: 'Por canal' },
    { key: 'metodo', label: 'Por método de pago' },
];

interface Props {
    tenantName: string;
    branches: BranchOption[];
    canExport: boolean;
}

export default function VentasReportView({ tenantName, branches, canExport }: Props) {
    const [range, setRange] = useState<DateRange>(presetRange('HOY'));
    const [branchId, setBranchId] = useState('');
    const [currency, setCurrency] = useState<CurrencyMode>('AMBAS');
    const [tab, setTab] = useState<TabKey>('producto');
    const [data, setData] = useState<VentasReportData | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getVentasReportAction({
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
        tenantName, reportTitle: `Ventas — ${TABS.find(t => t.key === tab)?.label}`,
        from: range.from, to: range.to, branchLabel,
    }), [tenantName, tab, range, branchLabel]);

    const exportExcel = () => {
        if (!data) return;
        let body: Aoa = [];
        if (tab === 'producto') {
            body = [
                ['PRODUCTO', 'CATEGORÍA', 'UNIDADES', 'VENTA $', 'COSTO $', 'MARGEN $'],
                ...data.byProduct.map(r => [r.name, r.category, r.units, r.revenue, r.cost, r.revenue - r.cost]),
                ['TOTAL', '', data.totals.itemsUnits, data.byProduct.reduce((s, r) => s + r.revenue, 0), data.totals.cost, ''],
            ];
        } else if (tab === 'categoria') {
            body = [
                ['CATEGORÍA', 'UNIDADES', 'VENTA $', '% DEL TOTAL'],
                ...data.byCategory.map(r => [r.category, r.units, r.revenue, r.pctOfTotal.toFixed(1) + '%']),
            ];
        } else if (tab === 'mesonero') {
            body = [
                ['MESONERO', 'ÓRDENES', 'VENTA $', 'TICKET PROM. $'],
                ...data.byWaiter.map(r => [r.waiterName, r.orders, r.revenue, r.avgTicket]),
            ];
        } else if (tab === 'zona') {
            body = [['ZONA', 'ÓRDENES', 'VENTA $'], ...data.byZone.map(r => [r.label, r.orders, r.revenue])];
        } else if (tab === 'canal') {
            body = [['CANAL', 'ÓRDENES', 'VENTA $'], ...data.byChannel.map(r => [r.label, r.orders, r.revenue])];
        } else {
            body = [
                ['MÉTODO', 'COBROS', 'USD', 'BS (tasa histórica)', 'USD SIN TASA BS'],
                ...data.byMethod.map(r => [r.method, r.count, r.usd, r.bs || '', r.usdSinTasa || '']),
                ['TOTAL', data.byMethod.reduce((s, r) => s + r.count, 0),
                    data.byMethod.reduce((s, r) => s + r.usd, 0),
                    data.byMethod.reduce((s, r) => s + r.bs, 0), ''],
            ];
        }
        exportAoaToExcel(meta, body, `ventas_${tab}`);
    };

    const hasData = Boolean(data && data.totals.orders > 0);

    return (
        <div className="max-w-6xl mx-auto space-y-4 p-4 sm:p-6">
            <header className="flex items-center gap-3">
                <Link href="/dashboard/reportes" className="h-9 w-9 rounded-full border border-capsula-line flex items-center justify-center text-capsula-ink-muted hover:bg-capsula-ivory-alt">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">Ventas por período</h1>
                    <p className="text-xs text-capsula-ink-muted">Criterio facturado (órdenes no anuladas, sin propinas) · método de pago = cobrado</p>
                </div>
            </header>

            <ReportToolbar
                range={range} onRangeChange={setRange}
                branches={branches} branchId={branchId} onBranchChange={setBranchId}
                currency={currency} onCurrencyChange={setCurrency}
                canExport={canExport}
                onExportExcel={exportExcel}
                onExportPdf={() => exportElementToPdf(meta, 'ventas-report-body')}
                busy={loading}
            />

            {loading ? <ReportSkeleton /> : !hasData ? (
                <ReportEmptyState
                    title="Sin ventas en el rango seleccionado"
                    hint="Prueba con otro rango de fechas o registra ventas en el POS — este reporte se llena automáticamente."
                />
            ) : data && (
                <div id="ventas-report-body" className="space-y-4">
                    {/* KPIs del rango */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Kpi label="Facturado" value={fmtUsd(data.totals.revenue)} sub="Sin 10% servicio · incluye mesas abiertas" />
                        <Kpi label="Órdenes" value={fmtQty(data.totals.orders)} />
                        <Kpi label="Ticket promedio" value={fmtUsd(data.totals.orders > 0 ? data.totals.revenue / data.totals.orders : 0)} />
                        <Kpi label="Descuentos" value={fmtUsd(data.totals.discount)} />
                    </div>

                    {/* Puente facturado → cobrado */}
                    <BridgeCard bridge={data.bridge} />

                    {/* Serie diaria */}
                    {data.series.length > 1 && (
                        <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-4">
                            <p className="pos-kicker mb-2">Venta por día (USD)</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.series}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--capsula-line-rgb))" />
                                        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                                        <YAxis tick={{ fontSize: 10 }} width={48} />
                                        <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                                        <Bar dataKey="revenue" fill="rgb(var(--capsula-coral-rgb))" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <FamilyTabs tabs={TABS} active={tab} onChange={setTab} />

                    <div className="bg-capsula-ivory border border-capsula-line rounded-2xl overflow-x-auto">
                        {tab === 'producto' && <ProductTable data={data} />}
                        {tab === 'categoria' && <CategoryTable data={data} />}
                        {tab === 'mesonero' && <WaiterTable data={data} />}
                        {tab === 'zona' && <DimensionTable rows={data.byZone} label="Zona" />}
                        {tab === 'canal' && <DimensionTable rows={data.byChannel} label="Canal" />}
                        {tab === 'metodo' && <MethodTable data={data} currency={currency} />}
                    </div>
                </div>
            )}
        </div>
    );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-4">
            <p className="pos-kicker">{label}</p>
            <p className="mt-1 font-semibold text-xl text-capsula-ink tabular-nums">{value}</p>
            {sub && <p className="text-[11px] text-capsula-ink-muted mt-0.5">{sub}</p>}
        </div>
    );
}

const TH = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted text-left';
const THn = TH + ' text-right';
const TD = 'px-3 py-2 text-sm text-capsula-ink';
const TDn = TD + ' text-right tabular-nums';

function ProductTable({ data }: { data: VentasReportData }) {
    const total = data.byProduct.reduce((s, r) => s + r.revenue, 0);
    return (
        <table className="w-full min-w-[640px]">
            <thead className="bg-capsula-ivory-alt"><tr>
                <th className={TH}>Producto</th><th className={TH}>Categoría</th>
                <th className={THn}>Unid.</th><th className={THn}>Venta</th>
                <th className={THn}>Costo</th><th className={THn}>Margen</th>
            </tr></thead>
            <tbody>
                {data.byProduct.map(r => (
                    <tr key={r.menuItemId} className="border-t border-capsula-line">
                        <td className={TD}>{r.name}</td>
                        <td className={TD + ' text-capsula-ink-muted text-xs'}>{r.category}</td>
                        <td className={TDn}>{fmtQty(r.units)}</td>
                        <td className={TDn}>{fmtUsd(r.revenue)}</td>
                        <td className={TDn + ' text-capsula-ink-muted'}>{r.cost > 0 ? fmtUsd(r.cost) : '—'}</td>
                        <td className={TDn}>{r.cost > 0 ? fmtUsd(r.revenue - r.cost) : '—'}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr className="border-t border-capsula-line-strong bg-capsula-ivory-alt font-semibold">
                <td className={TD} colSpan={2}>TOTAL</td>
                <td className={TDn}>{fmtQty(data.totals.itemsUnits)}</td>
                <td className={TDn}>{fmtUsd(total)}</td>
                <td className={TDn}>{data.totals.cost > 0 ? fmtUsd(data.totals.cost) : '—'}</td>
                <td className={TDn}>{data.totals.cost > 0 ? fmtUsd(total - data.totals.cost) : '—'}</td>
            </tr></tfoot>
        </table>
    );
}

function CategoryTable({ data }: { data: VentasReportData }) {
    return (
        <table className="w-full min-w-[520px]">
            <thead className="bg-capsula-ivory-alt"><tr>
                <th className={TH}>Categoría</th><th className={THn}>Unid.</th>
                <th className={THn}>Venta</th><th className={THn}>% del total</th><th className={TH + ' w-1/4'}></th>
            </tr></thead>
            <tbody>
                {data.byCategory.map(r => (
                    <tr key={r.category} className="border-t border-capsula-line">
                        <td className={TD}>{r.category}</td>
                        <td className={TDn}>{fmtQty(r.units)}</td>
                        <td className={TDn}>{fmtUsd(r.revenue)}</td>
                        <td className={TDn}>{fmtPct(r.pctOfTotal)}</td>
                        <td className="px-3 py-2">
                            <div className="h-1.5 rounded-full bg-capsula-ivory-alt overflow-hidden">
                                <div className="h-full bg-capsula-navy-deep rounded-full" style={{ width: `${Math.min(100, r.pctOfTotal)}%` }} />
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function WaiterTable({ data }: { data: VentasReportData }) {
    return (
        <table className="w-full min-w-[520px]">
            <thead className="bg-capsula-ivory-alt"><tr>
                <th className={TH}>Mesonero</th><th className={THn}>Órdenes</th>
                <th className={THn}>Venta</th><th className={THn}>Ticket prom.</th>
            </tr></thead>
            <tbody>
                {data.byWaiter.map(r => (
                    <tr key={r.waiterId ?? 'none'} className="border-t border-capsula-line">
                        <td className={TD}>{r.waiterName}</td>
                        <td className={TDn}>{fmtQty(r.orders)}</td>
                        <td className={TDn}>{fmtUsd(r.revenue)}</td>
                        <td className={TDn}>{fmtUsd(r.avgTicket)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr className="border-t border-capsula-line-strong bg-capsula-ivory-alt font-semibold">
                <td className={TD}>TOTAL</td>
                <td className={TDn}>{fmtQty(data.byWaiter.reduce((s, r) => s + r.orders, 0))}</td>
                <td className={TDn}>{fmtUsd(data.byWaiter.reduce((s, r) => s + r.revenue, 0))}</td>
                <td className={TDn}></td>
            </tr></tfoot>
        </table>
    );
}

function DimensionTable({ rows, label }: { rows: VentasReportData['byZone']; label: string }) {
    return (
        <table className="w-full min-w-[440px]">
            <thead className="bg-capsula-ivory-alt"><tr>
                <th className={TH}>{label}</th><th className={THn}>Órdenes</th><th className={THn}>Venta</th>
            </tr></thead>
            <tbody>
                {rows.map(r => (
                    <tr key={r.key} className="border-t border-capsula-line">
                        <td className={TD}>{r.label}</td>
                        <td className={TDn}>{fmtQty(r.orders)}</td>
                        <td className={TDn}>{fmtUsd(r.revenue)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot><tr className="border-t border-capsula-line-strong bg-capsula-ivory-alt font-semibold">
                <td className={TD}>TOTAL</td>
                <td className={TDn}>{fmtQty(rows.reduce((s, r) => s + r.orders, 0))}</td>
                <td className={TDn}>{fmtUsd(rows.reduce((s, r) => s + r.revenue, 0))}</td>
            </tr></tfoot>
        </table>
    );
}

function MethodTable({ data, currency }: { data: VentasReportData; currency: CurrencyMode }) {
    const totUsd = data.byMethod.reduce((s, r) => s + r.usd, 0);
    const totBs = data.byMethod.reduce((s, r) => s + r.bs, 0);
    const totSinTasa = data.byMethod.reduce((s, r) => s + r.usdSinTasa, 0);
    return (
        <div>
            <table className="w-full min-w-[560px]">
                <thead className="bg-capsula-ivory-alt"><tr>
                    <th className={TH}>Método</th><th className={THn}>Cobros</th>
                    <th className={THn}>Monto</th>
                </tr></thead>
                <tbody>
                    {data.byMethod.map(r => (
                        <tr key={r.method} className="border-t border-capsula-line">
                            <td className={TD}>{r.method}</td>
                            <td className={TDn}>{fmtQty(r.count)}</td>
                            <td className={TDn}>{fmtMoney(r.usd, r.bs > 0 ? r.bs : null, currency)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot><tr className="border-t border-capsula-line-strong bg-capsula-ivory-alt font-semibold">
                    <td className={TD}>TOTAL COBRADO (con servicio, sin propinas)</td>
                    <td className={TDn}>{fmtQty(data.byMethod.reduce((s, r) => s + r.count, 0))}</td>
                    <td className={TDn}>{currency === 'BS' ? fmtBs(totBs) : currency === 'USD' ? fmtUsd(totUsd) : `${fmtUsd(totUsd)} · ${fmtBs(totBs)}`}</td>
                </tr></tfoot>
            </table>
            <p className="px-3 py-2 text-[11px] text-capsula-ink-muted border-t border-capsula-line">
                Bs sumado desde la tasa histórica persistida en cada cobro — nunca reconvertido con la tasa de hoy.
                {totSinTasa > 0.005 && (
                    <> Cobros en Bs sin tasa registrada (legado pre-2026-06-10): {fmtUsd(totSinTasa)} solo en USD.</>
                )}
            </p>
        </div>
    );
}
