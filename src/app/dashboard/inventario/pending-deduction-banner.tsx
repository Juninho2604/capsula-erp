import Link from 'next/link';
import { AlertTriangle, ArrowRight, Loader2, Ban } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
    getOutboxSummaryAction,
    getPendingDeductionSummaryAction,
} from '@/app/actions/inventory.actions';

// Banner gerencial: telemetría read-only sobre descargos de inventario
// pendientes. Tras Fase 2.A, los fallos se registran estructuradamente en
// la tabla `InventoryDeductionRetry`. Este banner muestra ese estado +
// (por compat) flags legados en `SalesOrder.notes` que existieron antes.
//
// Server Component. Si no hay nada que mostrar, no renderiza.
//
// Cero writes a BD.
export default async function PendingDeductionBanner() {
    const [outbox, legacy] = await Promise.all([
        getOutboxSummaryAction({ recentLimit: 3 }),
        getPendingDeductionSummaryAction({ days: 30, limit: 0 }), // count agregado, no necesitamos detalle
    ]);

    if (outbox.actionable === 0 && legacy.count === 0) return null;

    // El outbox es la fuente de verdad para Fase 2 en adelante. Lo legado
    // (flags en notes) puede tener overlap con el outbox para fallos
    // recientes; lo mostramos como "histórico" si excede al outbox.
    const legacyOnly = Math.max(0, legacy.count - outbox.actionable);

    return (
        <div className="rounded-xl border border-[#E8C2B7] bg-[#F7E3DB]/50 p-4 dark:border-[#5b3328] dark:bg-[#3B1F14]/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B04A2E] dark:text-[#EFD2C8]" />
                    <div>
                        <h3 className="font-semibold text-[#B04A2E] dark:text-[#EFD2C8]">
                            {outbox.actionable > 0 ? (
                                <>{outbox.actionable} {outbox.actionable === 1 ? 'venta' : 'ventas'} con descargo de inventario pendiente</>
                            ) : (
                                <>Sin descargos pendientes activos</>
                            )}
                        </h3>
                        <p className="mt-1 text-sm text-[#B04A2E]/85 dark:text-[#EFD2C8]/85">
                            {outbox.actionable > 0 && (
                                <>
                                    {outbox.pending > 0 && (
                                        <span className="inline-flex items-center gap-1 mr-3">
                                            <Loader2 className="h-3.5 w-3.5" /> <strong>{outbox.pending}</strong> en cola para reintento
                                        </span>
                                    )}
                                    {outbox.inProgress > 0 && (
                                        <span className="inline-flex items-center gap-1 mr-3">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> <strong>{outbox.inProgress}</strong> en proceso
                                        </span>
                                    )}
                                    {outbox.failed > 0 && (
                                        <span className="inline-flex items-center gap-1 mr-3">
                                            <Ban className="h-3.5 w-3.5" /> <strong>{outbox.failed}</strong> agotaron reintentos (revisar manualmente)
                                        </span>
                                    )}
                                </>
                            )}
                            {legacyOnly > 0 && (
                                <span className="block mt-1 text-xs italic">
                                    + {legacyOnly} venta(s) con flag histórico en notas (anterior al outbox).
                                </span>
                            )}
                        </p>
                        {outbox.recent.length > 0 && (
                            <ul className="mt-2 space-y-0.5 text-xs tabular-nums">
                                {outbox.recent.map(r => (
                                    <li key={r.id}>
                                        {r.orderNumber ? (
                                            <span className="font-mono">{r.orderNumber}</span>
                                        ) : (
                                            <span className="font-mono italic opacity-70">(orden eliminada)</span>
                                        )}
                                        {r.orderTotal !== null && (
                                            <span className="ml-2">{formatCurrency(r.orderTotal)}</span>
                                        )}
                                        <span className="ml-2 opacity-70">
                                            · {r.status === 'PENDING' ? `próximo intento ${formatRelativeFromNow(r.nextRetryAt)}` :
                                               r.status === 'IN_PROGRESS' ? 'en proceso' :
                                               r.status === 'FAILED' ? `${r.attempts}/${r.maxAttempts} intentos agotados` :
                                               r.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                <Link
                    href="/dashboard/sales-history"
                    className="shrink-0 inline-flex items-center gap-1 self-start rounded-lg border border-current/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                >
                    Ver ventas <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}

/**
 * Formatea una fecha futura como "en N min" / "en N h" / "ahora".
 * Si la fecha ya pasó (el cron debió haberla procesado pero no lo hizo
 * todavía), devuelve "atrasado N min".
 */
function formatRelativeFromNow(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    const absMin = Math.round(Math.abs(diffMs) / 60_000);
    if (Math.abs(diffMs) < 30_000) return 'ahora';
    const prefix = diffMs >= 0 ? 'en' : 'atrasado';
    if (absMin < 60) return `${prefix} ${absMin} min`;
    const absHr = Math.round(absMin / 60);
    if (absHr < 24) return `${prefix} ${absHr} h`;
    const absDay = Math.round(absHr / 24);
    return `${prefix} ${absDay} d`;
}
