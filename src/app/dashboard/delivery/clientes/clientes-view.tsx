'use client';

import { useMemo, useState } from 'react';
import { UserCircle2, Phone, Search } from 'lucide-react';
import type { DeliveryCustomerRow } from '@/app/actions/delivery-config.actions';
import { DeliveryNav } from '../_components/delivery-nav';

export function DeliveryClientesView({ customers }: { customers: DeliveryCustomerRow[] }) {
    const [q, setQ] = useState('');

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return customers;
        return customers.filter(
            c => c.phone.includes(needle) || (c.name ?? '').toLowerCase().includes(needle),
        );
    }, [customers, q]);

    return (
        <div className="p-4 sm:p-6 space-y-5">
            <DeliveryNav />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-capsula-navy-deep text-capsula-cream flex items-center justify-center">
                        <UserCircle2 className="h-5 w-5" />
                    </span>
                    <div>
                        <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">Clientes</h1>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                            {customers.length} clientes · historial de delivery
                        </p>
                    </div>
                </div>
                <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-capsula-ink-faint" />
                    <input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Buscar nombre o teléfono"
                        className="pos-input pl-9 h-10 w-full sm:w-64"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="pos-panel p-10 flex flex-col items-center text-capsula-ink-faint">
                    <UserCircle2 className="h-8 w-8 mb-2" />
                    <p className="text-sm">Sin clientes todavía.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(c => (
                        <div key={c.phone} className="pos-card p-4 space-y-1">
                            <p className="font-semibold text-capsula-ink truncate">
                                {c.name ?? 'Cliente'}
                            </p>
                            <p className="text-xs text-capsula-ink-muted inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {c.phone}
                            </p>
                            <div className="flex items-center justify-between pt-2 text-sm">
                                <span className="text-capsula-ink-muted">
                                    {c.orders} {c.orders === 1 ? 'pedido' : 'pedidos'}
                                </span>
                                <span className="font-semibold tabular-nums text-capsula-ink">
                                    ${c.totalUsd.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-[11px] text-capsula-ink-faint">
                                Último: {c.lastOrderAt.slice(0, 10)}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
