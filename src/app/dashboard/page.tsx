import { getSession } from '@/lib/auth';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { getDashboardStatsAction } from '@/app/actions/dashboard.actions';
import { getFinancialSummaryAction } from '@/app/actions/finance.actions';
import { getEstadisticasAction } from '@/app/actions/estadisticas.actions';
import { getEnabledModulesFromDB } from '@/app/actions/system-config.actions';
import { getVisibleModules } from '@/lib/constants/modules-registry';
import { formatNumber, formatCurrency } from '@/lib/utils';
import ExecutiveSummary from '@/components/dashboard/ExecutiveSummary';
import FinancialSummaryWidget from '@/components/dashboard/FinancialSummaryWidget';
import RoleBasedSections from '@/components/dashboard/RoleBasedSections';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/server/db';
import {
    Plus,
    Package,
    Layers,
    UtensilsCrossed,
    AlertOctagon,
    BarChart2,
    Factory,
    Target,
    Gem,
    ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await getSession();

    // Redirigir al primer módulo visible del usuario (respeta allowedModules individuales)
    if (session?.role === 'CASHIER' || session?.role === 'WAITER') {
        let userAllowedModules: string[] | null = null;
        if (session.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.id },
                select: { allowedModules: true },
            });
            if (dbUser?.allowedModules) {
                try { userAllowedModules = JSON.parse(dbUser.allowedModules); } catch { /* ignore */ }
            }
        }
        const enabledIds = await getEnabledModulesFromDB();
        const visible = getVisibleModules(session.role, enabledIds, userAllowedModules);
        const first = visible[0];
        redirect(first?.href ?? '/dashboard/pos/restaurante');
    }
    // Gating granular (respeta el submódulo de usuarios): rol base +
    // allowedModules + grantedPerms + revokedPerms + isActive + tokenVersion.
    // ANTES usaba el hasPermission LEGACY por nivel de rol (VIEW_COSTS=80), que
    // ignoraba por completo lo configurado en /dashboard/usuarios → un usuario
    // con finanzas/costos desactivados igual veía los datos. checkActionPermission
    // es la misma puerta granular que ya usan las server actions.
    const [canViewFinances, canViewCosts] = await Promise.all([
        checkActionPermission(PERM.VIEW_FINANCES).then(r => r.ok),
        checkActionPermission(PERM.VIEW_COSTS).then(r => r.ok),
    ]);

    const [{ stats, salesKPIs, lowStockItems }, financeSummary, estadisticas] = await Promise.all([
        getDashboardStatsAction(),
        canViewFinances ? getFinancialSummaryAction() : Promise.resolve({ success: false } as any),
        // Datos role-based provenientes de la antigua /dashboard/estadisticas
        // (absorbida por el dashboard unificado).
        getEstadisticasAction(),
    ]);
    const finance = financeSummary?.data ?? null;
    const estadisticasData = estadisticas?.success && estadisticas.data ? estadisticas.data : null;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                        Bienvenido,{' '}
                        <span className="text-capsula-coral">{session?.firstName || 'Usuario'}</span>
                    </h1>
                    <p className="mt-1 text-sm text-capsula-ink-soft">
                        Resumen de operaciones · <span className="text-capsula-ink">Gerencia Operativa CÁPSULA</span>
                    </p>
                </div>
                <Link
                    href="/dashboard/recetas/nueva"
                    className="capsula-btn capsula-btn-primary"
                >
                    <Plus className="h-4 w-4" strokeWidth={1.75} />
                    Nueva Receta
                </Link>
            </div>

            {/* Resumen Gerencial — solo roles gerenciales/superiores (petición del
                dueño): dueño, administradores, gerentes de operaciones y auditores.
                Otros roles que llegan al inicio (jefe de área, RRHH) ya no ven los
                montos gerenciales del día. */}
            {salesKPIs && ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session?.role ?? '') && (
                <ExecutiveSummary
                    todayRevenue={salesKPIs.todayRevenue}
                    todayCollected={salesKPIs.todayCollected}
                    todayOrders={salesKPIs.todayOrders}
                    revenueChange={salesKPIs.revenueChange}
                    openTabs={salesKPIs.openTabs}
                    openTabsExposed={salesKPIs.openTabsExposed}
                    lowStockCount={stats.lowStockCount}
                    finance={finance}
                />
            )}

            {/* Stats secundarias del día (chips compactos).
                Ventas Hoy, Cuentas Abiertas y Stock Bajo NO se duplican aquí
                — ya están en ExecutiveSummary arriba. Aquí solo lo único que
                ese widget no muestra. */}
            {salesKPIs && (
                <div className="flex flex-wrap items-center gap-3">
                    {/* Órdenes hoy */}
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-capsula-ivory-alt border border-capsula-line text-sm">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Órdenes hoy</span>
                        <span className="font-semibold tabular-nums text-capsula-ink">{salesKPIs.todayOrders}</span>
                        <span className="text-capsula-ink-muted">(ayer {salesKPIs.yesterdayOrders})</span>
                    </div>
                    {/* Ticket promedio */}
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-capsula-ivory-alt border border-capsula-line text-sm">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Ticket promedio</span>
                        <span className="font-semibold tabular-nums text-capsula-ink">
                            ${salesKPIs.avgTicket.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    {/* Propinas (si hay) */}
                    {salesKPIs.propinasHoy?.count > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-capsula-ivory-alt border border-capsula-line text-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Propinas hoy</span>
                            <span className="font-semibold tabular-nums text-capsula-ink">
                                ${salesKPIs.propinasHoy.total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-capsula-ink-muted">({salesKPIs.propinasHoy.count} reg.)</span>
                        </div>
                    )}
                    {/* Anuladas (si hay) — chip danger */}
                    {salesKPIs.canceladasHoy?.count > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F7E3DB] border border-[#EFD2C8] dark:bg-[#3B1F14] dark:border-[#3B1F14] text-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B04A2E] dark:text-[#EFD2C8]">Anuladas hoy</span>
                            <span className="font-semibold tabular-nums text-[#B04A2E] dark:text-[#EFD2C8]">
                                {salesKPIs.canceladasHoy.count} órd.
                            </span>
                            <span className="text-[#B04A2E]/70 dark:text-[#EFD2C8]/70">
                                — ${salesKPIs.canceladasHoy.total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Financial Summary Widget */}
            {finance && canViewFinances && (
              <div className="capsula-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-capsula-navy-soft text-capsula-ink">
                      <BarChart2 className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-capsula-ink-muted">Resumen Financiero del Mes</h2>
                      <p className="text-xs text-capsula-ink-muted">{finance.period.label}</p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/finanzas"
                    className="text-xs font-medium text-capsula-ink transition-colors hover:text-capsula-ink"
                  >
                    Ver detalle →
                  </Link>
                </div>
                <FinancialSummaryWidget finance={finance} />
              </div>
            )}

            {/* Vistas role-based (absorbidas de /dashboard/estadisticas).
                Stock Bajo se muestra solo en su tabla detallada más abajo;
                Total Insumos / Sub-recetas / Productos son catálogo, poco
                interesantes en un dashboard operativo. Eliminados aquí. */}
            {estadisticasData && <RoleBasedSections data={estadisticasData} />}

            {/* Low Stock Alert Table */}
            <div className="capsula-card overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-ivory-alt px-8 py-5">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-capsula-coral text-capsula-cream shadow-lg shadow-capsula-coral/25">
                            <AlertOctagon className="h-6 w-6" strokeWidth={1.75} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Alertas Críticas de Stock</h2>
                            <p className="text-sm font-medium text-capsula-ink-muted">
                                Insumos por debajo del punto de reorden
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/inventario"
                        className="capsula-btn capsula-btn-secondary py-2 text-xs"
                    >
                        Ver Inventario →
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-capsula-line bg-capsula-ivory-surface">
                                <th className="px-8 py-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Insumo
                                </th>
                                <th className="px-8 py-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Categoría
                                </th>
                                <th className="px-8 py-4 text-right text-xs font-semibold uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Stock Actual
                                </th>
                                <th className="px-8 py-4 text-center text-xs font-semibold uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Estado
                                </th>
                                {canViewCosts && (
                                    <th className="px-8 py-4 text-right text-xs font-semibold uppercase tracking-[0.08em] text-capsula-ink-muted">
                                        Costo Unit.
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-capsula-line">
                            {lowStockItems.slice(0, 5).map((item) => {
                                const RowIcon = item.type === 'RAW_MATERIAL' ? Package : item.type === 'SUB_RECIPE' ? Layers : UtensilsCrossed;
                                return (
                                    <tr key={item.id} className="group transition-colors hover:bg-capsula-ivory-alt">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-capsula-ivory-alt text-capsula-ink-muted transition-transform group-hover:rotate-12">
                                                    <RowIcon className="h-6 w-6" strokeWidth={1.5} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-capsula-ink transition-colors group-hover:text-capsula-ink">
                                                        {item.name}
                                                    </p>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-capsula-ink-muted">{item.sku}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="rounded bg-capsula-ivory-alt px-2 py-1 text-xs font-medium uppercase tracking-wide text-capsula-ink-muted">
                                                {item.category || '-'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <p className="font-semibold text-lg text-capsula-ink">
                                                {formatNumber(item.currentStock)}
                                            </p>
                                            <p className="text-[10px] font-medium uppercase text-capsula-ink-muted">{item.baseUnit}</p>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                                                item.status.status === 'critical'
                                                    ? 'bg-capsula-coral-subtle text-capsula-coral'
                                                    : item.status.status === 'warning'
                                                    ? 'bg-amber-500/10 text-amber-600'
                                                    : 'bg-emerald-500/10 text-emerald-600'
                                            }`}>
                                                {item.status.status === 'critical' && (
                                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-capsula-coral" />
                                                )}
                                                {item.status.label}
                                            </span>
                                        </td>
                                        {canViewCosts && (
                                            <td className="px-8 py-5 text-right font-medium tabular-nums text-capsula-ink">
                                                {formatCurrency(item.costPerUnit || 0)}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {lowStockItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center animate-in zoom-in duration-500">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                            <Gem className="h-9 w-9" strokeWidth={1.5} />
                        </div>
                        <p className="font-semibold text-xl text-capsula-ink">
                            ¡Inventario Perfecto!
                        </p>
                        <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-capsula-ink-muted">
                            No hay insumos críticos registrados en este momento. Sigue así.
                        </p>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <QuickAction href="/dashboard/recetas/nueva" label="Crear Receta" sub="Calculadora de costos" Icon={Plus} color="coral" />
                <QuickAction href="/dashboard/inventario" label="Inventario" sub="Gestionar existencias" Icon={Package} color="navy" />
                <QuickAction href="/dashboard/produccion" label="Producción" sub="Procesar órdenes" Icon={Factory} color="emerald" />
                {salesKPIs && (
                    <QuickAction href="/dashboard/metas" label="Metas" sub="Objetivos y merma" Icon={Target} color="rose" />
                )}
                {canViewFinances && (
                    <QuickAction href="/dashboard/finanzas" label="Finanzas" sub="P&L y flujo de caja" Icon={BarChart2} color="emerald" />
                )}
            </div>
        </div>
    );
}

// ── Sub-component ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { icon: string; hover: string; arrow: string }> = {
    coral:   { icon: 'bg-capsula-coral-subtle text-capsula-coral', hover: 'hover:border-capsula-coral/40 hover:bg-capsula-coral-subtle/30', arrow: 'text-capsula-coral' },
    navy:    { icon: 'bg-capsula-navy-soft text-capsula-ink', hover: 'hover:border-capsula-navy/30 hover:bg-capsula-navy-soft/30', arrow: 'text-capsula-ink' },
    emerald: { icon: 'bg-emerald-500/10 text-emerald-600', hover: 'hover:border-emerald-500/30 hover:bg-emerald-500/5', arrow: 'text-emerald-600' },
    amber:   { icon: 'bg-amber-500/10 text-amber-600', hover: 'hover:border-amber-500/30 hover:bg-amber-500/5', arrow: 'text-amber-600' },
    rose:    { icon: 'bg-rose-500/10 text-rose-600', hover: 'hover:border-rose-500/30 hover:bg-rose-500/5', arrow: 'text-rose-600' },
};

function QuickAction({ href, label, sub, Icon, color }: { href: string; label: string; sub: string; Icon: typeof Plus; color: string }) {
    const c = COLOR_MAP[color] ?? COLOR_MAP.navy;
    return (
        <Link href={href} className={`group capsula-card p-2 ${c.hover}`}>
            <div className="flex items-center gap-5 rounded-xl p-4 transition-all">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${c.icon}`}>
                    <Icon className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <div>
                    <p className="text-base font-semibold text-capsula-ink">{label}</p>
                    <p className="text-sm text-capsula-ink-muted">{sub}</p>
                </div>
                <ChevronRight className={`ml-auto h-5 w-5 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 ${c.arrow}`} strokeWidth={1.75} />
            </div>
        </Link>
    );
}
