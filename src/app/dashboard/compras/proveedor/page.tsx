import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, ArrowRight, Building2, Package, TrendingUp, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getSupplierListForHistoryAction } from '@/app/actions/purchase.actions';

export const dynamic = 'force-dynamic';

function formatRelativeFromNow(date: Date | null): string {
    if (!date) return 'sin movimientos';
    const diffMs = Date.now() - date.getTime();
    const absMin = Math.round(Math.abs(diffMs) / 60_000);
    if (absMin < 1) return 'ahora';
    if (absMin < 60) return `hace ${absMin} min`;
    const absHr = Math.round(absMin / 60);
    if (absHr < 24) return `hace ${absHr} h`;
    const absDay = Math.round(absHr / 24);
    if (absDay < 30) return `hace ${absDay} d`;
    return formatDate(date);
}

async function SupplierList() {
    const suppliers = await getSupplierListForHistoryAction();

    if (suppliers.length === 0) {
        return (
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-12 text-center">
                <Building2 className="mx-auto h-10 w-10 text-capsula-ink-muted" />
                <h2 className="mt-4 font-semibold text-capsula-ink">No hay proveedores activos</h2>
                <p className="mt-2 text-sm text-capsula-ink-muted">
                    Crea proveedores desde el módulo de inventario para comenzar a registrar histórico de precios.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map(s => (
                <Link
                    key={s.id}
                    href={`/dashboard/compras/proveedor/${s.id}`}
                    className="pos-tile group flex flex-col gap-3 p-5 transition-all hover:shadow-cap-soft"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-capsula-ink truncate">{s.name}</h3>
                            {s.code && (
                                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    {s.code}
                                </p>
                            )}
                            {s.contactName && (
                                <p className="mt-1 text-xs text-capsula-ink-soft truncate">{s.contactName}</p>
                            )}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-capsula-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-capsula-coral" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-capsula-line pt-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                Items
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-capsula-ink tabular-nums">
                                <Package className="h-3.5 w-3.5 text-capsula-ink-muted" />
                                {s.itemsCount}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                Último cambio
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-capsula-ink-soft tabular-nums">
                                <TrendingUp className="h-3.5 w-3.5 text-capsula-ink-muted" />
                                {formatRelativeFromNow(s.lastPriceChangeAt)}
                            </p>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}

export default function ProveedorListPage() {
    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <Link
                        href="/dashboard/compras"
                        className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink-soft transition-colors hover:bg-capsula-ivory-alt"
                        aria-label="Volver a compras"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                            Histórico de precios por proveedor
                        </h1>
                        <p className="text-capsula-ink-muted">
                            Evolución del costo unitario de cada producto a lo largo del tiempo. Selecciona un proveedor.
                        </p>
                    </div>
                </div>
            </div>

            <Suspense
                fallback={
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-capsula-ink-muted">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="text-sm">Cargando proveedores…</p>
                        </div>
                    </div>
                }
            >
                <SupplierList />
            </Suspense>
        </div>
    );
}
