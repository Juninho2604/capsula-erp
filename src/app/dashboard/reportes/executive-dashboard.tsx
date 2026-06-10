'use client';

/**
 * Dashboard ejecutivo del día (portada del módulo Reportes):
 * ventas Bs/USD, tickets, ticket promedio, comensales, top 5 productos,
 * ventas por hora y comparativo vs mismo día de la semana pasada.
 * Los datos vienen pre-cargados del server component (sin fetch al montar).
 */

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import type { ExecutiveDayKpis } from '@/lib/reports/management-reports';
import { fmtBs, fmtQty, fmtUsd } from './_components/format';

export default function ExecutiveDashboard({ kpis }: { kpis: ExecutiveDayKpis }) {
    const deltaPct = kpis.lastWeek.facturado > 0
        ? ((kpis.facturado - kpis.lastWeek.facturado) / kpis.lastWeek.facturado) * 100
        : null;

    const hours = Array.from({ length: 24 }, (_, h) => {
        const point = kpis.salesByHour.find(p => Number(p.bucket) === h);
        return { hour: `${h}`, revenue: point?.revenue ?? 0 };
    }).filter(p => Number(p.hour) >= 8); // jornada operativa

    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between">
                <p className="pos-kicker">Hoy · {kpis.day}</p>
                <DeltaBadge deltaPct={deltaPct} label={`vs ${kpis.lastWeek.day}`} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Kpi label="Ventas del día" value={fmtUsd(kpis.facturado)}
                    sub={kpis.cobrado.bs > 0 ? `Cobrado: ${fmtBs(kpis.cobrado.bs)} + USD` : undefined} />
                <Kpi label="Tickets" value={fmtQty(kpis.orders)}
                    sub={`Semana pasada: ${fmtQty(kpis.lastWeek.orders)}`} />
                <Kpi label="Ticket promedio" value={fmtUsd(kpis.avgTicket)}
                    sub={`Semana pasada: ${fmtUsd(kpis.lastWeek.avgTicket)}`} />
                <Kpi label="Comensales (mesas)" value={fmtQty(kpis.guests)} />
                <Kpi label="Propinas" value={fmtUsd(kpis.propinas)}
                    sub={kpis.anuladas.count > 0 ? `Anuladas: ${kpis.anuladas.count} (${fmtUsd(kpis.anuladas.total)})` : undefined} />
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
                <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-4">
                    <p className="pos-kicker mb-2">Ventas por hora (USD)</p>
                    {kpis.facturado > 0 ? (
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hours}>
                                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} width={44} />
                                    <Tooltip formatter={(v) => fmtUsd(Number(v))} labelFormatter={(l) => `${l}:00`} />
                                    <Bar dataKey="revenue" fill="rgb(var(--capsula-coral-rgb))" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-sm text-capsula-ink-muted py-10 text-center">Aún sin ventas hoy</p>
                    )}
                </div>

                <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-4">
                    <p className="pos-kicker mb-2">Top 5 productos de hoy</p>
                    {kpis.topProducts.length === 0 ? (
                        <p className="text-sm text-capsula-ink-muted py-10 text-center">Aún sin ventas hoy</p>
                    ) : (
                        <ul className="divide-y divide-capsula-line">
                            {kpis.topProducts.map((p, i) => (
                                <li key={p.menuItemId} className="flex items-center gap-3 py-2">
                                    <span className="h-6 w-6 rounded-full bg-capsula-navy-deep text-capsula-cream text-[11px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-capsula-ink truncate">{p.name}</p>
                                        <p className="text-[11px] text-capsula-ink-muted">{p.category}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-semibold text-capsula-ink tabular-nums">{fmtUsd(p.revenue)}</p>
                                        <p className="text-[11px] text-capsula-ink-muted tabular-nums">{fmtQty(p.units)} unid.</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-4">
            <p className="pos-kicker">{label}</p>
            <p className="mt-1 font-semibold text-xl text-capsula-ink tabular-nums">{value}</p>
            {sub && <p className="text-[11px] text-capsula-ink-muted mt-0.5 truncate" title={sub}>{sub}</p>}
        </div>
    );
}

function DeltaBadge({ deltaPct, label }: { deltaPct: number | null; label: string }) {
    if (deltaPct === null) {
        return <span className="text-[11px] text-capsula-ink-muted inline-flex items-center gap-1"><Minus className="h-3 w-3" /> sin referencia {label}</span>;
    }
    const up = deltaPct >= 0;
    return (
        <span className={`text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-full ${
            up ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
               : 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]'
        }`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}{deltaPct.toFixed(1)}% {label}
        </span>
    );
}
