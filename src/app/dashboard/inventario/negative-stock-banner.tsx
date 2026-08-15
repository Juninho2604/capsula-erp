import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getNegativeStockSummaryAction } from '@/app/actions/inventory.actions';

/**
 * §155 — Insumos que quedaron en NEGATIVO.
 *
 * Pasa cuando se registra una producción que realmente ocurrió pero cuya
 * materia prima todavía no tenía la entrada cargada. El negativo es una deuda
 * legítima y transitoria: se salda sola al cargar la entrada.
 *
 * Este banner existe porque un negativo que nadie ve deja de ser transitorio
 * y se convierte en el descuadre de inventario que después nadie sabe
 * explicar (§145, caso masa filo). Server Component read-only; si no hay
 * negativos no renderiza nada.
 */
export default async function NegativeStockBanner() {
    const { total, rows } = await getNegativeStockSummaryAction();
    if (total === 0) return null;

    const visibles = rows.slice(0, 5);
    const resto = total - visibles.length;

    return (
        <div className="rounded-xl border border-[#E8C2B7] bg-[#F7E3DB]/60 p-4 text-[#B04A2E] dark:border-[#5b3328] dark:bg-[#3B1F14]/60 dark:text-[#EFD2C8]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <h3 className="font-semibold">
                            {total === 1
                                ? '1 insumo con stock en negativo'
                                : `${total} insumos con stock en negativo`}
                        </h3>
                        <p className="mt-1 text-sm opacity-90">
                            Se produjo con materia prima cuya entrada todavía no se cargó.
                            Al registrar la compra el saldo se acomoda solo.
                        </p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {visibles.map((r, i) => (
                                <li key={`${r.itemId}-${i}`} className="tabular-nums">
                                    <span className="font-medium">{r.name}</span>
                                    <span className="opacity-80"> · {r.areaName}: </span>
                                    <span className="font-semibold">
                                        {Math.round(r.quantity * 1000) / 1000} {r.unit}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {resto > 0 && (
                            <p className="mt-1 text-sm opacity-80">
                                y {resto} {resto === 1 ? 'más' : 'más'}.
                            </p>
                        )}
                    </div>
                </div>
                <Link
                    href="/dashboard/inventario/entrada"
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-current px-3 py-2 text-sm font-semibold transition-colors hover:bg-current/10"
                >
                    Cargar entrada
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </div>
    );
}
