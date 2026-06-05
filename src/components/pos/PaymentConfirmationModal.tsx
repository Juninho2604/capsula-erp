'use client';

/**
 * Modal de confirmación pre-cobro.
 *
 * Aparece después de que la cajera presione el botón de cobro pero
 * ANTES de invocar la server action que efectivamente registra el
 * pago. Reduce errores al elegir método.
 *
 * Activación: feature flag `requirePaymentConfirmation` por tenant.
 *
 * Soporta pago simple (un método) y pago mixto (lista de líneas).
 */

import { useEffect, useState } from 'react';
import { Check, X as XIcon, Loader2 } from 'lucide-react';
import { methodLabel, methodIcon } from './MixedPaymentSelector';

export type PaymentConfirmationLine = {
    method: string;
    amountUSD: number;
    amountBS?: number;
};

interface Props {
    open: boolean;
    /** Total que la cajera va a cobrar en USD (suma de las líneas). */
    totalUSD: number;
    /** Líneas del cobro. Si tiene 1 elemento se muestra resumen simple; si N, lista. */
    lines: PaymentConfirmationLine[];
    /** Texto del botón confirmar (default "Confirmar cobro"). */
    confirmLabel?: string;
    /** Si true, deshabilita botones y muestra spinner. */
    loading?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

function fmt(n: number) {
    return `$${n.toFixed(2)}`;
}

function MethodRow({ line }: { line: PaymentConfirmationLine }) {
    const Icon = methodIcon(line.method);
    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-capsula-ivory-surface border border-capsula-line">
            <div className="flex items-center gap-2 min-w-0">
                {Icon && <Icon className="h-4 w-4 text-capsula-ink-soft shrink-0" />}
                <span className="font-semibold text-capsula-ink truncate">{methodLabel(line.method)}</span>
            </div>
            <div className="text-right shrink-0">
                <div className="font-semibold tabular-nums text-capsula-ink">{fmt(line.amountUSD)}</div>
                {line.amountBS != null && line.amountBS > 0 && (
                    <div className="text-[10px] tabular-nums text-capsula-ink-muted">
                        Bs {line.amountBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function PaymentConfirmationModal({
    open,
    totalUSD,
    lines,
    confirmLabel = 'Confirmar cobro',
    loading = false,
    onCancel,
    onConfirm,
}: Props) {
    // Guard anti doble-tap: en pantalla táctil, dos toques rápidos sobre
    // "Confirmar" disparan dos onClick antes de que el modal se desmonte →
    // doble cobro. Este flag bloquea el segundo disparo dentro de la misma
    // apertura del modal. Se resetea cada vez que el modal se vuelve a abrir.
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (open) setBusy(false);
    }, [open]);

    if (!open) return null;

    const isSingle = lines.length === 1;
    const single = lines[0];
    const disabled = loading || busy;

    const handleConfirm = () => {
        if (busy) return;
        setBusy(true);
        onConfirm();
    };

    return (
        <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                <div className="border-b border-capsula-line p-5 flex items-center justify-between">
                    <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                        Confirmar cobro
                    </h3>
                    <button
                        onClick={onCancel}
                        disabled={disabled}
                        className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center disabled:opacity-50"
                        aria-label="Cancelar"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                            Total a cobrar
                        </div>
                        <div className="font-semibold text-4xl tracking-[-0.02em] tabular-nums text-capsula-ink">
                            {fmt(totalUSD)}
                        </div>
                    </div>

                    {isSingle ? (
                        <div className="text-center">
                            <div className="text-sm text-capsula-ink-soft mb-2">Con método</div>
                            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-capsula-navy-soft border border-capsula-line">
                                {(() => {
                                    const Icon = methodIcon(single.method);
                                    return Icon ? <Icon className="h-5 w-5 text-capsula-ink" /> : null;
                                })()}
                                <span className="font-semibold text-capsula-ink">
                                    {methodLabel(single.method)}
                                </span>
                            </div>
                            {single.amountBS != null && single.amountBS > 0 && (
                                <div className="mt-2 text-[11px] tabular-nums text-capsula-ink-muted">
                                    Equivale a Bs {single.amountBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                Desglose ({lines.length} pagos)
                            </div>
                            {lines.map((l, i) => (
                                <MethodRow key={i} line={l} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-capsula-line p-4 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={disabled}
                        className="pos-btn-secondary flex-1 py-3 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={disabled}
                        className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {disabled ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Check className="h-4 w-4" /> {confirmLabel}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
