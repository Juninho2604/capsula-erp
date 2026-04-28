import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getPendingDeductionSummaryAction } from '@/app/actions/inventory.actions';

// Banner gerencial: telemetría read-only que cuenta ventas con descargo de
// inventario pendiente (las que dispararon el catch silencioso en
// registerInventoryForCartItems del POS). No hace cambios en BD.
//
// Server Component asíncrono. Se monta arriba del InventoryView. Si el count
// es 0, no renderiza nada.
export default async function PendingDeductionBanner() {
    const summary = await getPendingDeductionSummaryAction({ days: 30, limit: 5 });

    if (summary.count === 0) return null;

    return (
        <div className="rounded-xl border border-[#E8C2B7] bg-[#F7E3DB]/50 p-4 dark:border-[#5b3328] dark:bg-[#3B1F14]/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B04A2E] dark:text-[#EFD2C8]" />
                    <div>
                        <h3 className="font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">
                            {summary.count} {summary.count === 1 ? 'venta' : 'ventas'} con descargo de inventario pendiente
                        </h3>
                        <p className="mt-1 text-sm text-[#B04A2E]/85 dark:text-[#EFD2C8]/85">
                            En los últimos {summary.windowDays} días el POS registró ventas pero no pudo descontar el inventario teórico
                            (receta no encontrada, stock insuficiente, error transitorio). Revisa manualmente las notas marcadas
                            <code className="mx-1 rounded bg-[#F7E3DB] px-1.5 py-0.5 text-xs font-mono dark:bg-[#3B1F14]">
                                [DESCARGO INVENTARIO PENDIENTE]
                            </code>.
                        </p>
                    </div>
                </div>
                {summary.recent.length > 0 && (
                    <div className="shrink-0 text-right text-xs text-[#B04A2E]/80 dark:text-[#EFD2C8]/80">
                        <p className="mb-1 font-semibold uppercase tracking-[0.14em]">Recientes</p>
                        <ul className="space-y-0.5 tabular-nums">
                            {summary.recent.slice(0, 3).map(o => (
                                <li key={o.id}>
                                    <span className="font-mono">{o.orderNumber}</span>
                                    <span className="ml-2">{formatCurrency(o.total)}</span>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/dashboard/sales-history"
                            className="mt-2 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
                        >
                            Ver historial de ventas <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
