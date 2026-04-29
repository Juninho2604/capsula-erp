import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Loader2, Phone, Mail, UserCircle2 } from 'lucide-react';
import { getSupplierPriceHistoryAction } from '@/app/actions/purchase.actions';
import PriceHistoryChart from './price-history-chart';

export const dynamic = 'force-dynamic';

async function SupplierDetail({ id }: { id: string }) {
    const data = await getSupplierPriceHistoryAction(id);
    if (!data) notFound();

    const { supplier, items } = data;

    return (
        <>
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        {supplier.code && (
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                {supplier.code}
                            </p>
                        )}
                        <h2 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">{supplier.name}</h2>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-capsula-ink-soft">
                            {supplier.contactName && (
                                <span className="inline-flex items-center gap-1.5">
                                    <UserCircle2 className="h-3.5 w-3.5 text-capsula-ink-muted" />
                                    {supplier.contactName}
                                </span>
                            )}
                            {supplier.phone && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-capsula-ink-muted" />
                                    {supplier.phone}
                                </span>
                            )}
                            {supplier.email && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-capsula-ink-muted" />
                                    {supplier.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <PriceHistoryChart items={items} />
        </>
    );
}

interface PageProps {
    params: { id: string };
}

export default function ProveedorDetailPage({ params }: PageProps) {
    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-start gap-3">
                <Link
                    href="/dashboard/compras/proveedor"
                    className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink-soft transition-colors hover:bg-capsula-ivory-alt"
                    aria-label="Volver al listado de proveedores"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Histórico de precios</h1>
                    <p className="text-capsula-ink-muted">
                        Evolución del costo unitario por producto. Los puntos se registran automáticamente al recibir órdenes de compra.
                    </p>
                </div>
            </div>

            <Suspense
                fallback={
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-capsula-ink-muted">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="text-sm">Cargando histórico…</p>
                        </div>
                    </div>
                }
            >
                <SupplierDetail id={params.id} />
            </Suspense>
        </div>
    );
}
