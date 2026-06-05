'use client';

import Link from 'next/link';
import {
    ArrowLeft, Phone, Mail, MapPin, CreditCard, Receipt, ShoppingBag, CalendarDays, TrendingUp, StickyNote,
} from 'lucide-react';
import type { CustomerDetail } from '@/app/actions/customer.actions';

function fmtMoney(n: number) {
    return `$${n.toFixed(2)}`;
}

function fmtDate(d: Date | string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-VE', {
        timeZone: 'America/Caracas', day: '2-digit', month: 'short', year: 'numeric',
    });
}

function fmtDateTime(d: Date | string): string {
    return new Date(d).toLocaleString('es-VE', {
        timeZone: 'America/Caracas', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

const ORDER_TYPE_LABEL: Record<string, string> = {
    DELIVERY: 'Delivery', PICKUP: 'Pickup', RESTAURANT: 'Mesa', PEDIDOSYA: 'PedidosYA',
};

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="pos-card p-4">
            <div className="flex items-center gap-2 text-capsula-ink-muted text-[10px] font-semibold uppercase tracking-[0.14em] mb-1">
                <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <div className="text-2xl font-semibold tabular-nums text-capsula-ink tracking-[-0.02em]">{value}</div>
        </div>
    );
}

export function CustomerDetailView({ customer: c }: { customer: CustomerDetail }) {
    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto">
            <Link href="/dashboard/clientes" className="inline-flex items-center gap-1.5 text-sm text-capsula-ink-soft hover:text-capsula-coral">
                <ArrowLeft className="h-4 w-4" /> Volver a clientes
            </Link>

            {/* Encabezado */}
            <header className="pos-card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">{c.fullName}</h1>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-capsula-ink-soft">
                            {c.idDocument && <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-capsula-ink-muted" /> {c.idDocument}</span>}
                            {c.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-capsula-ink-muted" /> {c.phone}</span>}
                            {c.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-capsula-ink-muted" /> {c.email}</span>}
                        </div>
                        {c.address && (
                            <p className="mt-1 text-sm text-capsula-ink-soft inline-flex items-start gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-capsula-ink-muted mt-0.5 shrink-0" /> {c.address}
                            </p>
                        )}
                    </div>
                    {!c.isActive && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted bg-capsula-ivory-alt border border-capsula-line px-2 py-1 rounded">
                            Inactivo
                        </span>
                    )}
                </div>
                {c.notes && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-capsula-ink-soft bg-capsula-ivory-alt rounded-lg p-3">
                        <StickyNote className="h-4 w-4 shrink-0 mt-0.5 text-capsula-ink-muted" /> {c.notes}
                    </div>
                )}
            </header>

            {/* Agregados */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat icon={ShoppingBag} label="Pedidos" value={String(c.orderCount)} />
                <Stat icon={Receipt} label="Total gastado" value={fmtMoney(c.totalSpent)} />
                <Stat icon={TrendingUp} label="Ticket promedio" value={fmtMoney(c.avgTicket)} />
                <Stat icon={CalendarDays} label="Última visita" value={fmtDate(c.lastOrderAt)} />
            </div>
            {c.firstOrderAt && (
                <p className="text-xs text-capsula-ink-muted -mt-2">
                    Cliente desde {fmtDate(c.firstOrderAt)}.
                </p>
            )}

            {/* Historial */}
            <section>
                <h2 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink mb-2">Historial de compras</h2>
                {c.orders.length === 0 ? (
                    <div className="pos-card text-center py-10 text-capsula-ink-muted">
                        Todavía no hay compras vinculadas a este cliente.
                        <p className="text-xs mt-1">Las ventas se vinculan automáticamente desde el POS Delivery de ahora en adelante.</p>
                    </div>
                ) : (
                    <div className="pos-card overflow-hidden p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted border-b border-capsula-line">
                                    <th className="text-left px-4 py-3">Orden</th>
                                    <th className="text-left px-4 py-3">Fecha</th>
                                    <th className="text-left px-4 py-3">Tipo</th>
                                    <th className="text-center px-4 py-3">Ítems</th>
                                    <th className="text-right px-4 py-3">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {c.orders.map(o => (
                                    <tr key={o.id} className="border-b border-capsula-line last:border-0 hover:bg-capsula-navy-soft/40">
                                        <td className="px-4 py-3 font-semibold text-capsula-ink">{o.orderNumber}</td>
                                        <td className="px-4 py-3 text-capsula-ink-soft tabular-nums">{fmtDateTime(o.createdAt)}</td>
                                        <td className="px-4 py-3 text-capsula-ink-soft">{ORDER_TYPE_LABEL[o.orderType ?? ''] ?? o.orderType ?? '—'}</td>
                                        <td className="px-4 py-3 text-center tabular-nums text-capsula-ink-soft">{o.itemCount}</td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-capsula-ink">{fmtMoney(o.total)}</td>
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
