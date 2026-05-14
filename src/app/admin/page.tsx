import Link from 'next/link';
import prisma from '@/server/db';
import { LayoutDashboard, TrendingUp, Wallet, Users, ExternalLink, Receipt } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TENANT_ROOT_DOMAIN = 'kpsula.app';

/**
 * Dashboard SUPER_ADMIN.
 *
 * KPIs globales (todos los tenants sumados), ranking de revenue 30d,
 * tendencia diaria 30d, y últimos pagos recibidos del SaaS.
 *
 * Todo server-rendered: las queries usan groupBy/aggregate y devuelven
 * dataset chico. El bar chart es SVG inline (sin libs). El revalidate
 * es por request (force-dynamic) — los volúmenes son chicos.
 */
export default async function AdminDashboardPage() {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
        tenants,
        activeUserCounts,
        agg7,
        agg30,
        agg90,
        revenueByTenant30,
        salesLast30,
        paymentsAggUsd,
        recentPayments,
    ] = await Promise.all([
        prisma.tenant.findMany({
            select: { id: true, slug: true, name: true },
        }),
        prisma.user.groupBy({
            by: ['tenantId'],
            where: { isActive: true },
            _count: { _all: true },
        }),
        prisma.salesOrder.aggregate({
            where: { createdAt: { gte: d7 } },
            _sum: { total: true },
            _count: { _all: true },
        }),
        prisma.salesOrder.aggregate({
            where: { createdAt: { gte: d30 } },
            _sum: { total: true },
            _count: { _all: true },
        }),
        prisma.salesOrder.aggregate({
            where: { createdAt: { gte: d90 } },
            _sum: { total: true },
            _count: { _all: true },
        }),
        prisma.salesOrder.groupBy({
            by: ['tenantId'],
            where: { createdAt: { gte: d30 } },
            _sum: { total: true },
            _count: { _all: true },
        }),
        prisma.salesOrder.findMany({
            where: { createdAt: { gte: d30 } },
            select: { createdAt: true, total: true },
        }),
        prisma.tenantPayment.aggregate({
            where: { currency: 'USD' },
            _sum: { amount: true },
            _count: { _all: true },
        }),
        prisma.tenantPayment.findMany({
            orderBy: { paidAt: 'desc' },
            take: 10,
            include: {
                tenant: { select: { id: true, name: true, slug: true } },
            },
        }),
    ]);

    const tenantById = new Map(tenants.map((t) => [t.id, t]));
    const activeUserSet = new Set(activeUserCounts.map((g) => g.tenantId));
    const activeTenants = tenants.filter((t) => activeUserSet.has(t.id)).length;

    const ranking = revenueByTenant30
        .map((g) => ({
            tenantId: g.tenantId,
            name: tenantById.get(g.tenantId)?.name ?? g.tenantId,
            slug: tenantById.get(g.tenantId)?.slug ?? '',
            total: g._sum.total ?? 0,
            count: g._count._all,
        }))
        .sort((a, b) => b.total - a.total);

    // Bucket de ventas por día (últimos 30 días) en timezone Caracas.
    // Usamos formato yyyy-mm-dd extraído del UTC restando 4h (Caracas = UTC-4)
    // para evitar dependencias. El timezone real de queries está definido en
    // sales-where.ts para reportes serios; acá es suficientemente bueno.
    const dailyMap = new Map<string, number>();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    for (let i = 29; i >= 0; i--) {
        const key = toDayKey(new Date(now.getTime() - i * ONE_DAY));
        dailyMap.set(key, 0);
    }
    for (const s of salesLast30) {
        const key = toDayKey(s.createdAt);
        if (dailyMap.has(key)) {
            dailyMap.set(key, (dailyMap.get(key) ?? 0) + s.total);
        }
    }
    const dailySeries = Array.from(dailyMap.entries()).map(([day, total]) => ({ day, total }));
    const dailyMax = dailySeries.reduce((m, p) => Math.max(m, p.total), 0);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">
                    <LayoutDashboard className="h-5 w-5 text-capsula-ink-muted" />
                    Dashboard
                </h1>
                <p className="mt-1 text-sm text-capsula-ink-soft">
                    Métricas globales del SaaS (todos los tenants).
                </p>
            </div>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                    label="Tenants activos"
                    value={`${activeTenants}/${tenants.length}`}
                    icon={<Users className="h-4 w-4" />}
                />
                <Kpi
                    label="Ventas 7d"
                    value={fmtUsd(agg7._sum.total ?? 0)}
                    sub={`${agg7._count._all} órdenes`}
                    icon={<Receipt className="h-4 w-4" />}
                />
                <Kpi
                    label="Ventas 30d"
                    value={fmtUsd(agg30._sum.total ?? 0)}
                    sub={`${agg30._count._all} órdenes`}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
                <Kpi
                    label="Cobrado al SaaS (USD)"
                    value={fmtUsd(paymentsAggUsd._sum.amount ?? 0)}
                    sub={`${paymentsAggUsd._count._all} pago(s) registrado(s)`}
                    icon={<Wallet className="h-4 w-4" />}
                />
            </section>

            <section className="space-y-3">
                <SectionTitle>Ventas últimos 30 días — tendencia diaria</SectionTitle>
                <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5">
                    <DailyBars data={dailySeries} max={dailyMax} />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-capsula-ink-muted sm:grid-cols-4">
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">7d</div>
                            <div className="tabular-nums text-capsula-ink">{fmtUsd(agg7._sum.total ?? 0)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">30d</div>
                            <div className="tabular-nums text-capsula-ink">{fmtUsd(agg30._sum.total ?? 0)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">90d</div>
                            <div className="tabular-nums text-capsula-ink">{fmtUsd(agg90._sum.total ?? 0)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                                Pico día (30d)
                            </div>
                            <div className="tabular-nums text-capsula-ink">{fmtUsd(dailyMax)}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <SectionTitle>Ranking por ventas (últimos 30 días)</SectionTitle>
                {ranking.length === 0 ? (
                    <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-sm text-capsula-ink-muted">
                        Sin ventas en el período.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-3xl border border-capsula-line bg-capsula-ivory-surface">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-capsula-line">
                                    <Th>#</Th>
                                    <Th>Tenant</Th>
                                    <Th className="text-right">Órdenes</Th>
                                    <Th className="text-right">Total</Th>
                                    <Th className="text-right">Promedio</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranking.map((r, i) => (
                                    <tr
                                        key={r.tenantId}
                                        className="border-b border-capsula-line last:border-b-0"
                                    >
                                        <Td className="text-capsula-ink-muted">{i + 1}</Td>
                                        <Td className="font-semibold text-capsula-ink">
                                            <Link
                                                href={`/admin/tenants/${r.tenantId}`}
                                                className="hover:text-capsula-coral"
                                            >
                                                {r.name}
                                            </Link>
                                        </Td>
                                        <Td className="text-right tabular-nums">{r.count}</Td>
                                        <Td className="text-right tabular-nums font-semibold text-capsula-ink">
                                            {fmtUsd(r.total)}
                                        </Td>
                                        <Td className="text-right tabular-nums text-capsula-ink-soft">
                                            {fmtUsd(r.count > 0 ? r.total / r.count : 0)}
                                        </Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <SectionTitle>Últimos pagos al SaaS</SectionTitle>
                {recentPayments.length === 0 ? (
                    <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-sm text-capsula-ink-muted">
                        Aún no se registraron pagos.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-3xl border border-capsula-line bg-capsula-ivory-surface">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-capsula-line">
                                    <Th>Fecha</Th>
                                    <Th>Tenant</Th>
                                    <Th className="text-right">Monto</Th>
                                    <Th>Método</Th>
                                    <Th>Nota</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentPayments.map((p) => (
                                    <tr
                                        key={p.id}
                                        className="border-b border-capsula-line last:border-b-0"
                                    >
                                        <Td className="text-capsula-ink-soft">
                                            {new Date(p.paidAt).toLocaleDateString('es-VE', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </Td>
                                        <Td>
                                            <Link
                                                href={`/admin/tenants/${p.tenant.id}`}
                                                className="inline-flex items-center gap-1 font-semibold text-capsula-ink hover:text-capsula-coral"
                                            >
                                                {p.tenant.name}
                                                <ExternalLink className="h-3 w-3 opacity-50" />
                                            </Link>
                                        </Td>
                                        <Td className="text-right tabular-nums font-semibold text-capsula-ink">
                                            {p.currency}{' '}
                                            {p.amount.toLocaleString('es-VE', {
                                                minimumFractionDigits: 2,
                                            })}
                                        </Td>
                                        <Td>{p.method}</Td>
                                        <Td className="text-capsula-ink-soft">{p.note ?? '—'}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function Kpi({
    label,
    value,
    sub,
    icon,
}: {
    label: string;
    value: string;
    sub?: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface px-4 py-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                {icon}
                {label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-capsula-ink">{value}</div>
            {sub && <div className="mt-0.5 text-xs text-capsula-ink-muted">{sub}</div>}
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
            {children}
        </h2>
    );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <th
            className={
                'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted ' +
                (className ?? '')
            }
        >
            {children}
        </th>
    );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
    return <td className={'px-4 py-3 ' + (className ?? '')}>{children}</td>;
}

/**
 * Bar chart inline SVG. 30 barras, escala automática al max del dataset.
 * Tooltips nativos via <title>. Sin libs.
 */
function DailyBars({
    data,
    max,
}: {
    data: { day: string; total: number }[];
    max: number;
}) {
    const width = 720;
    const height = 140;
    const padding = { top: 8, right: 4, bottom: 20, left: 4 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const barGap = 2;
    const barW = Math.max(2, innerW / data.length - barGap);
    const safeMax = max > 0 ? max : 1;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block w-full"
            preserveAspectRatio="none"
            aria-label="Ventas diarias últimos 30 días"
        >
            {data.map((d, i) => {
                const h = (d.total / safeMax) * innerH;
                const x = padding.left + i * (barW + barGap);
                const y = padding.top + (innerH - h);
                return (
                    <g key={d.day}>
                        <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={Math.max(1, h)}
                            rx={1.5}
                            className="fill-capsula-navy-deep"
                        >
                            <title>{`${d.day}: ${fmtUsd(d.total)}`}</title>
                        </rect>
                    </g>
                );
            })}
            {/* eje X: solo primer, medio y último día */}
            {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
                if (!data[i]) return null;
                const x = padding.left + i * (barW + barGap) + barW / 2;
                return (
                    <text
                        key={i}
                        x={x}
                        y={height - 4}
                        textAnchor="middle"
                        className="fill-capsula-ink-muted text-[9px]"
                    >
                        {data[i].day.slice(5)}
                    </text>
                );
            })}
        </svg>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
    return `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * yyyy-mm-dd en timezone Caracas (UTC-4 fijo). No usamos toLocaleDateString
 * porque depende del locale del runtime y queremos un key estable.
 */
function toDayKey(date: Date): string {
    const caracas = new Date(date.getTime() - 4 * 60 * 60 * 1000);
    return caracas.toISOString().slice(0, 10);
}
