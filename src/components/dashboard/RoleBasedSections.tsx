/**
 * Vistas role-based para el Dashboard unificado.
 *
 * Este componente recibe los datos de getEstadisticasAction() y renderiza
 * la vista que corresponde al rol del usuario actual:
 *   - OWNER / ADMIN_MANAGER → vista completa (métodos pago, top items,
 *     descuentos, anulaciones, alertas de stock)
 *   - OPS_MANAGER / AREA_LEAD → vista operativa simplificada
 *   - CHEF / KITCHEN_CHEF → vista de cocina (pedidos pendientes, producción)
 *   - AUDITOR → vista de auditoría (descuentos, anulaciones, ajustes)
 *   - Otros (CASHIER/WAITER) → no se renderiza nada (esos roles se
 *     redirigen al POS desde la page principal).
 *
 * Origen: el contenido proviene de la antigua página /dashboard/estadisticas
 * que fue absorbida por el dashboard unificado.
 */

import {
    Wallet, Receipt, Gift, CalendarRange, ListChecks, Ban, Package,
    CalendarClock, CreditCard, Trophy, AlertTriangle, BarChart3, Flame,
    Clock, Users, ChefHat, TrendingUp, type LucideIcon,
} from 'lucide-react';
import type { EstadisticasData } from '@/app/actions/estadisticas.actions';

// ─── Helpers visuales ───────────────────────────────────────────────────────

const EMOJI_TO_ICON: Record<string, LucideIcon> = {
    '💰': Wallet, '🧾': Receipt, '🎁': Gift, '📅': CalendarRange, '📆': CalendarClock,
    '🪑': Users, '🚫': Ban, '📦': Package, '💳': CreditCard, '🏆': Trophy,
    '⚠️': AlertTriangle, '📊': BarChart3, '🔥': Flame, '⏰': Clock, '👨‍🍳': ChefHat,
    '🍽️': ChefHat, '📈': TrendingUp, '🏭': Package, '📝': ListChecks, '🚨': AlertTriangle,
    '📋': ListChecks,
};
function iconFor(s: string): LucideIcon {
    return EMOJI_TO_ICON[s] ?? BarChart3;
}

const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Efectivo $',
    CASH_USD: 'Efectivo $',
    CASH_BS: 'Efectivo Bs',
    CARD: 'Tarjeta',
    PDV: 'PDV',
    MOBILE_PAY: 'Pago Móvil',
    TRANSFER: 'Transferencia',
    ZELLE: 'Zelle',
    EUR: 'Efectivo €',
};

const PRODUCTION_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'info' | 'muted' | 'danger' }> = {
    COMPLETED:   { label: 'Completado', tone: 'ok' },
    IN_PROGRESS: { label: 'En proceso', tone: 'warn' },
    DRAFT:       { label: 'Borrador',   tone: 'muted' },
    APPROVED:    { label: 'Aprobado',   tone: 'info' },
    CANCELLED:   { label: 'Cancelado',  tone: 'danger' },
};

const DISCOUNT_LABELS: Record<string, string> = {
    DIVISAS_33:        'Divisas −33%',
    CORTESIA_100:      'Cortesía 100%',
    CORTESIA_PERCENT:  'Cortesía parcial',
    NONE:              'Sin descuento',
};

function fmt(n: number) {
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Sub-componentes UI ─────────────────────────────────────────────────────

function StatCard({
    label, value, sub, icon, color = 'navy',
}: {
    label: string;
    value: string;
    sub?: string;
    icon: string;
    color?: 'navy' | 'coral' | 'ok' | 'warn' | 'danger' | 'info';
}) {
    const Icon = iconFor(icon);
    const tone = {
        navy:   { box: 'bg-capsula-navy-soft text-capsula-ink', value: 'text-capsula-ink' },
        coral:  { box: 'bg-capsula-coral-subtle text-capsula-coral', value: 'text-capsula-coral' },
        ok:     { box: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]', value: 'text-[#2F6B4E] dark:text-[#6FB88F]' },
        warn:   { box: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]', value: 'text-[#946A1C] dark:text-[#E8D9B8]' },
        danger: { box: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]', value: 'text-[#B04A2E] dark:text-[#EFD2C8]' },
        info:   { box: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]', value: 'text-[#2A4060] dark:text-[#D1DCE9]' },
    }[color];

    return (
        <div className="capsula-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">{label}</span>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tone.box}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
            </div>
            <div>
                <div className={`font-semibold text-2xl tracking-[-0.02em] tabular-nums ${tone.value}`}>{value}</div>
                {sub && <div className="text-xs text-capsula-ink-muted mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
    const Icon = iconFor(icon);
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-capsula-navy-soft text-capsula-ink flex items-center justify-center">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
                <h2 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">{title}</h2>
                {sub && <p className="mt-0.5 text-xs text-capsula-ink-muted">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Vistas por rol ─────────────────────────────────────────────────────────

function AdminView({ d }: { d: EstadisticasData }) {
    return (
        <>
            {/* Métodos de Pago + Top Productos */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="capsula-card p-6">
                    <SectionTitle icon="💳" title="Métodos de Pago" sub="Distribución de hoy" />
                    {d.paymentBreakdown.length === 0 ? (
                        <p className="text-sm text-capsula-ink-muted text-center py-6">Sin ventas registradas hoy</p>
                    ) : (
                        <div className="space-y-3">
                            {d.paymentBreakdown
                                .slice()
                                .sort((a, b) => b.total - a.total)
                                .map((p) => {
                                    const totalAll = d.paymentBreakdown.reduce((s, r) => s + r.total, 0);
                                    const pctVal = totalAll > 0 ? (p.total / totalAll) * 100 : 0;
                                    return (
                                        <div key={p.method}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-semibold text-capsula-ink">
                                                    {PAYMENT_LABELS[p.method] || p.method}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-medium text-capsula-ink-muted">{p.count} orden{p.count !== 1 ? 'es' : ''}</span>
                                                    <span className="text-sm font-semibold text-capsula-ink tabular-nums">${fmt(p.total)}</span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-capsula-ivory-alt rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-capsula-navy-deep rounded-full transition-all duration-700"
                                                    style={{ width: `${pctVal}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                <div className="capsula-card p-6">
                    <SectionTitle icon="🏆" title="Top Productos Hoy" sub="Por unidades vendidas" />
                    {d.topItems.length === 0 ? (
                        <p className="text-sm text-capsula-ink-muted text-center py-6">Sin ventas registradas hoy</p>
                    ) : (
                        <div className="space-y-3">
                            {d.topItems.map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                                        i === 0 ? 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]' :
                                        i === 1 ? 'bg-capsula-ivory-alt text-capsula-ink-muted' :
                                        i === 2 ? 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]' :
                                        'bg-capsula-ivory-alt text-capsula-ink-muted'
                                    }`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-capsula-ink truncate uppercase tracking-wide">{item.name}</div>
                                        <div className="text-[10px] font-medium text-capsula-ink-muted">{item.quantity} unidades</div>
                                    </div>
                                    <div className="text-sm font-semibold text-capsula-ink tabular-nums">${fmt(item.revenue)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Descuentos + Anulaciones */}
            {(d.discountBreakdown.length > 0 || d.voidedOrders.length > 0) && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {d.discountBreakdown.length > 0 && (
                        <div className="capsula-card p-6">
                            <SectionTitle icon="🎁" title="Descuentos Aplicados" sub="Solo hoy — requieren revisión" />
                            <div className="space-y-2">
                                {d.discountBreakdown.map((disc, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-[#F3EAD6]/40 dark:bg-[#3B2F15]/40 rounded-xl border border-[#F3EAD6] dark:border-[#3B2F15]">
                                        <div>
                                            <div className="text-xs font-semibold text-capsula-ink">{DISCOUNT_LABELS[disc.type] || disc.type}</div>
                                            {disc.authorizedBy && (
                                                <div className="text-[10px] text-capsula-ink-muted">Autorizado: {disc.authorizedBy}</div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-[#946A1C] dark:text-[#E8D9B8] tabular-nums">−${fmt(disc.total)}</div>
                                            <div className="text-[10px] text-capsula-ink-muted">{disc.count} aplicacion{disc.count !== 1 ? 'es' : ''}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {d.voidedOrders.length > 0 && (
                        <div className="capsula-card p-6">
                            <SectionTitle icon="🚫" title="Órdenes Anuladas" sub="Hoy — log de auditoría" />
                            <div className="space-y-2">
                                {d.voidedOrders.map((v, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40 rounded-xl border border-[#F7E3DB] dark:border-[#3B1F14]">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">#{v.orderNumber}</div>
                                            <div className="text-[10px] text-capsula-ink-muted truncate max-w-[180px]">{v.reason}</div>
                                            <div className="text-[9px] text-capsula-ink-muted/70">Por: {v.voidedBy} · {v.time}</div>
                                        </div>
                                        <div className="text-sm font-semibold text-[#B04A2E] dark:text-[#EFD2C8] tabular-nums">−${fmt(v.total)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

function OpsView({ d }: { d: EstadisticasData }) {
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <div className="capsula-card p-6">
                <SectionTitle icon="💳" title="Métodos de Pago" sub="Hoy" />
                {d.paymentBreakdown.length === 0 ? (
                    <p className="text-sm text-capsula-ink-muted text-center py-6">Sin ventas hoy</p>
                ) : (
                    <div className="space-y-2">
                        {d.paymentBreakdown.slice().sort((a, b) => b.total - a.total).map((p) => (
                            <div key={p.method} className="flex justify-between items-center p-3 bg-capsula-ivory-alt rounded-xl">
                                <span className="text-xs font-semibold text-capsula-ink">{PAYMENT_LABELS[p.method] || p.method}</span>
                                <span className="text-sm font-semibold text-capsula-ink tabular-nums">${fmt(p.total)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="capsula-card p-6">
                <SectionTitle icon="🏆" title="Top Productos" sub="Hoy" />
                {d.topItems.length === 0 ? (
                    <p className="text-sm text-capsula-ink-muted text-center py-6">Sin ventas hoy</p>
                ) : (
                    <div className="space-y-2">
                        {d.topItems.slice(0, 5).map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-capsula-ivory-alt rounded-xl">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-capsula-ink uppercase truncate">{item.name}</div>
                                    <div className="text-[10px] text-capsula-ink-muted">{item.quantity} uds</div>
                                </div>
                                <div className="text-sm font-semibold text-capsula-ink tabular-nums">${fmt(item.revenue)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ChefView({ d }: { d: EstadisticasData }) {
    return (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="En cocina ahora" value={String(d.kitchenPending.length)} sub="órdenes pendientes" icon="🔥" color={d.kitchenPending.length > 0 ? 'warn' : 'ok'} />
                <StatCard label="Producciones hoy" value={String(d.productionToday.length)} sub="órdenes creadas" icon="🏭" color="info" />
                <StatCard label="Stock bajo" value={String(d.lowStockAlerts.length)} sub="ingredientes bajo mínimo" icon="⚠️" color={d.lowStockAlerts.length > 0 ? 'danger' : 'ok'} />
                <StatCard label="Top producto" value={d.topItems[0]?.name?.substring(0, 12) || '—'} sub={d.topItems[0] ? `${d.topItems[0].quantity} uds` : 'Sin datos'} icon="🏆" color="navy" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="capsula-card p-6">
                    <SectionTitle icon="🔥" title="Pedidos en Cocina" sub="Enviados y esperando preparación" />
                    {d.kitchenPending.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="font-semibold text-[#2F6B4E] dark:text-[#6FB88F]">Cocina al día</p>
                            <p className="text-sm text-capsula-ink-muted mt-1">No hay pedidos pendientes</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {d.kitchenPending.map((o, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-[#F3EAD6]/40 dark:bg-[#3B2F15]/40 rounded-xl border border-[#F3EAD6] dark:border-[#3B2F15]">
                                    <div>
                                        <div className="text-xs font-semibold text-[#946A1C] dark:text-[#E8D9B8]">#{o.orderNumber}</div>
                                        <div className="text-[10px] text-capsula-ink font-medium">{o.tableName}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-semibold text-capsula-ink">{o.itemCount} item{o.itemCount !== 1 ? 's' : ''}</div>
                                        <div className="text-[10px] text-capsula-ink-muted">Enviado: {o.sentAt}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="capsula-card p-6">
                    <SectionTitle icon="🏭" title="Producción de Hoy" sub="Órdenes de producción del día" />
                    {d.productionToday.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="font-semibold text-capsula-ink">Sin producciones hoy</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {d.productionToday.map((p, i) => {
                                const status = PRODUCTION_STATUS[p.status] ?? { label: p.status, tone: 'muted' as const };
                                const toneClass = {
                                    ok:     'text-[#2F6B4E] dark:text-[#6FB88F]',
                                    warn:   'text-[#946A1C] dark:text-[#E8D9B8]',
                                    info:   'text-[#2A4060] dark:text-[#D1DCE9]',
                                    danger: 'text-[#B04A2E] dark:text-[#EFD2C8]',
                                    muted:  'text-capsula-ink-muted',
                                }[status.tone];
                                return (
                                    <div key={i} className="flex justify-between items-center p-3 bg-capsula-ivory-alt rounded-xl">
                                        <div>
                                            <div className="text-xs font-semibold text-capsula-ink uppercase">{p.recipe}</div>
                                            <div className="text-[10px] text-capsula-ink-muted">{p.quantity} {p.unit}</div>
                                        </div>
                                        <span className={`text-[10px] font-semibold ${toneClass}`}>
                                            {status.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function AuditorView({ d }: { d: EstadisticasData }) {
    return (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Ventas hoy" value={`$${fmt(d.today.revenue)}`} sub={`${d.today.orders} órdenes`} icon="💰" color="navy" />
                <StatCard label="Descuentos hoy" value={`$${fmt(d.today.discounts)}`} sub={`${d.discountBreakdown.reduce((s, r) => s + r.count, 0)} aplicados`} icon="🎁" color="warn" />
                <StatCard label="Anulaciones hoy" value={String(d.today.voided)} sub={d.today.voided > 0 ? 'Revisar abajo' : 'Sin novedad'} icon="🚫" color={d.today.voided > 0 ? 'danger' : 'ok'} />
                <StatCard label="Ajustes del mes" value={String(d.inventoryVariances.length)} sub="movimientos tipo AJUSTE" icon="📝" color="info" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="capsula-card p-6">
                    <SectionTitle icon="🎁" title="Descuentos Aplicados" sub="Solo hoy — todas las sesiones" />
                    {d.discountBreakdown.length === 0 ? (
                        <p className="text-sm text-capsula-ink-muted text-center py-6">Sin descuentos hoy</p>
                    ) : (
                        <div className="space-y-2">
                            {d.discountBreakdown.map((disc, i) => (
                                <div key={i} className="p-3 bg-[#F3EAD6]/40 dark:bg-[#3B2F15]/40 rounded-xl border border-[#F3EAD6] dark:border-[#3B2F15]">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-semibold text-capsula-ink">{DISCOUNT_LABELS[disc.type] || disc.type}</span>
                                        <span className="text-sm font-semibold text-[#946A1C] dark:text-[#E8D9B8] tabular-nums">−${fmt(disc.total)}</span>
                                    </div>
                                    <div className="text-[10px] text-capsula-ink-muted mt-1">
                                        {disc.count} veces · {disc.authorizedBy ? `Auth: ${disc.authorizedBy}` : 'Sin gerente'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="capsula-card p-6">
                    <SectionTitle icon="🚫" title="Órdenes Anuladas" sub="Log completo de hoy" />
                    {d.voidedOrders.length === 0 ? (
                        <p className="text-sm text-capsula-ink-muted text-center py-6">Sin anulaciones hoy</p>
                    ) : (
                        <div className="space-y-2">
                            {d.voidedOrders.map((v, i) => (
                                <div key={i} className="p-3 bg-[#F7E3DB]/40 dark:bg-[#3B1F14]/40 rounded-xl border border-[#F7E3DB] dark:border-[#3B1F14]">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">#{v.orderNumber}</span>
                                        <span className="text-sm font-semibold text-[#B04A2E] dark:text-[#EFD2C8] tabular-nums">−${fmt(v.total)}</span>
                                    </div>
                                    <div className="text-[10px] text-capsula-ink-muted mt-1">{v.reason}</div>
                                    <div className="text-[10px] text-capsula-ink-muted/70 mt-0.5">Por: {v.voidedBy} · {v.time}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {d.inventoryVariances.length > 0 && (
                <div className="capsula-card p-6">
                    <SectionTitle icon="📝" title="Ajustes de Inventario" sub="Movimientos tipo AJUSTE del mes" />
                    <div className="space-y-2">
                        {d.inventoryVariances.map((v, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-capsula-ivory-alt rounded-xl">
                                <div>
                                    <div className="text-xs font-semibold text-capsula-ink uppercase">{v.name}</div>
                                    <div className="text-[10px] text-capsula-ink-muted">{v.date}</div>
                                </div>
                                <span className={`text-sm font-semibold tabular-nums ${
                                    v.variance >= 0
                                        ? 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                        : 'text-[#B04A2E] dark:text-[#EFD2C8]'
                                }`}>
                                    {v.variance >= 0 ? '+' : ''}{v.variance.toFixed(2)} {v.unit}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function RoleBasedSections({ data }: { data: EstadisticasData }) {
    const role = data.role;
    if (['OWNER', 'ADMIN_MANAGER'].includes(role)) {
        return <AdminView d={data} />;
    }
    if (['OPS_MANAGER', 'AREA_LEAD'].includes(role)) {
        return <OpsView d={data} />;
    }
    if (['CHEF', 'KITCHEN_CHEF'].includes(role)) {
        return <ChefView d={data} />;
    }
    if (role === 'AUDITOR') {
        return <AuditorView d={data} />;
    }
    return null;
}
