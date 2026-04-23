'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftRight, ChevronDown, X as XIcon } from 'lucide-react';
import { getExchangeRateValue, setExchangeRateAction } from '@/app/actions/exchange.actions';
import { usdToBs } from '@/lib/currency';

interface CurrencyCalculatorProps {
    className?: string;
    totalUsd?: number;
    hasServiceFee?: boolean;
    deliveryFee?: number;
    onRateUpdated?: (rate: number) => void;
    /**
     * Cuando inline=true el panel se muestra directamente (sin botón ni modal).
     * Ideal para paneles de cobro en delivery, pickup y salón.
     */
    inline?: boolean;
    /**
     * Cuando startCollapsed=true (sólo en modo inline) el panel arranca
     * plegado mostrando sólo la tasa y el total en Bs en una línea compacta.
     * El usuario puede expandirlo pulsando el botón ▼.
     */
    startCollapsed?: boolean;
}

export function CurrencyCalculator({
    className,
    totalUsd,
    hasServiceFee,
    deliveryFee,
    onRateUpdated,
    inline = false,
    startCollapsed = false,
}: CurrencyCalculatorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(!startCollapsed);
    const [rate, setRate] = useState<number | null>(null);
    const [editableRate, setEditableRate] = useState('');
    const [usdInput, setUsdInput] = useState('');
    const [isSavingRate, setIsSavingRate] = useState(false);

    useEffect(() => {
        getExchangeRateValue().then((value) => {
            setRate(value);
            if (value) {
                setEditableRate(value.toFixed(2));
                onRateUpdated?.(value);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const usd = parseFloat(usdInput.replace(',', '.')) || 0;
    const parsedRate = parseFloat(editableRate.replace(',', '.')) || 0;
    const effectiveRate = parsedRate > 0 ? parsedRate : rate || 0;
    const bs = effectiveRate > 0 && usd > 0 ? usdToBs(usd, effectiveRate) : 0;

    const handleUpdateRate = async () => {
        if (parsedRate <= 0) return;
        setIsSavingRate(true);
        try {
            const result = await setExchangeRateAction(parsedRate, new Date());
            if (!result.success) return;
            const rounded = Math.round(parsedRate * 100) / 100;
            setRate(rounded);
            setEditableRate(rounded.toFixed(2));
            onRateUpdated?.(rounded);
        } finally {
            setIsSavingRate(false);
        }
    };

    // ── Panel de contenido (compartido por inline y modal) ───────────────────
    const panel = (
        <div className="space-y-3">
            {/* Tasa del día */}
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory-alt p-3">
                <label className="pos-label">Tasa del día (1 USD = Bs)</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={editableRate}
                        onChange={(e) => setEditableRate(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateRate()}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 tabular-nums text-capsula-ink outline-none focus:border-capsula-navy-deep"
                    />
                    <button
                        type="button"
                        onClick={handleUpdateRate}
                        disabled={isSavingRate}
                        className="shrink-0 rounded-lg border border-capsula-navy-deep bg-capsula-navy-deep px-3 py-2 text-xs font-medium text-capsula-ivory transition-colors hover:bg-capsula-navy disabled:opacity-50"
                    >
                        {isSavingRate ? '…' : 'Actualizar'}
                    </button>
                </div>
            </div>

            {/* Calculadora libre */}
            <div>
                <label className="pos-label">Monto en USD</label>
                <input
                    type="text"
                    inputMode="decimal"
                    value={usdInput}
                    onChange={(e) => setUsdInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory-surface px-4 py-3 text-xl font-medium tabular-nums text-capsula-ink outline-none focus:border-capsula-navy-deep"
                />
            </div>
            <div className="rounded-xl border border-[#D3E2D8] bg-[#E5EDE7]/40 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#2F6B4E]/80">
                    Equivalente en bolívares
                </p>
                <p className="mt-1 font-semibold text-2xl tabular-nums tracking-[-0.02em] text-[#2F6B4E]">
                    {bs > 0
                        ? bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0,00'} Bs
                </p>
            </div>

            {/* Total de la venta */}
            {typeof totalUsd === 'number' && totalUsd > 0 && effectiveRate > 0 && (
                <div className="rounded-xl border border-capsula-navy/10 bg-capsula-navy-soft px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-soft">
                        Total de la venta ({totalUsd.toFixed(2)} USD)
                    </p>
                    {hasServiceFee && (
                        <p className="mt-1 text-[11px] text-[#946A1C]">
                            + 10% Servicio ({(totalUsd * 0.1).toFixed(2)} USD)
                        </p>
                    )}
                    {deliveryFee && (
                        <p className="mt-1 text-[11px] text-[#946A1C]">
                            + Delivery ({deliveryFee.toFixed(2)} USD)
                        </p>
                    )}
                    <p className="mt-2 font-semibold text-2xl tabular-nums tracking-[-0.02em] text-capsula-ink">
                        {usdToBs(
                            totalUsd + (hasServiceFee ? totalUsd * 0.1 : 0) + (deliveryFee || 0),
                            effectiveRate
                        ).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                    </p>
                </div>
            )}
        </div>
    );

    // ── Modo inline con soporte para colapso ─────────────────────────────────
    if (inline) {
        const totalBs = effectiveRate > 0 && typeof totalUsd === 'number' && totalUsd > 0
            ? usdToBs(
                totalUsd + (hasServiceFee ? totalUsd * 0.1 : 0) + (deliveryFee || 0),
                effectiveRate
              )
            : null;

        return (
            <div className={`overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface ${className ?? ''}`}>
                <button
                    type="button"
                    onClick={() => setIsExpanded((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-capsula-ivory-alt/60"
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4 shrink-0 text-capsula-ink-muted" />
                        {effectiveRate > 0 ? (
                            <span className="text-sm font-medium tabular-nums text-capsula-ink">
                                1 USD = {effectiveRate.toLocaleString('es-VE')} Bs
                            </span>
                        ) : (
                            <span className="pos-kicker">Tasa no configurada</span>
                        )}
                        {totalBs !== null && (
                            <span className="ml-1 truncate text-xs font-medium tabular-nums text-capsula-ink-soft">
                                · ${(totalUsd! + (hasServiceFee ? totalUsd! * 0.1 : 0) + (deliveryFee || 0)).toFixed(2)} = {totalBs.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs
                            </span>
                        )}
                    </div>
                    <ChevronDown
                        className={`ml-2 h-4 w-4 shrink-0 text-capsula-ink-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </button>

                {isExpanded && (
                    <div className="border-t border-capsula-line px-4 pb-4 pt-3">
                        {panel}
                    </div>
                )}
            </div>
        );
    }

    // ── Modo modal (botón + overlay) ─────────────────────────────────────────
    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`inline-flex items-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-4 py-2 text-sm font-medium text-capsula-ink transition-colors hover:border-capsula-navy-deep hover:bg-capsula-ivory-alt ${className ?? ''}`}
                title="Calculadora USD → Bs"
            >
                <ArrowLeftRight className="h-4 w-4" />
                <span>USD → Bs</span>
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-capsula-navy-deep/60 p-4 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="w-full max-w-sm overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-deep"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                                Calculadora USD → Bs
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                                aria-label="Cerrar"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                        {panel}
                    </div>
                </div>
            )}
        </>
    );
}
