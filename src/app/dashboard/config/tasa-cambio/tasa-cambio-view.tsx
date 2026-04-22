'use client';

import { useState, useTransition } from 'react';
import { setExchangeRateAction } from '@/app/actions/exchange.actions';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { DollarSign, History } from 'lucide-react';

interface ExchangeRate {
    id: string;
    rate: number;
    effectiveDate: Date;
    source: string;
}

interface Props {
    history: ExchangeRate[];
}

export function TasaCambioView({ history }: Props) {
    const [rate, setRate] = useState('');
    const [isPending, startTransition] = useTransition();
    const latest = history[0];

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const parsed = parseFloat(rate.replace(',', '.'));
        if (isNaN(parsed) || parsed <= 0) {
            toast.error('Ingresa una tasa válida mayor a 0');
            return;
        }

        startTransition(async () => {
            const res = await setExchangeRateAction(parsed, new Date());
            if (res.success) {
                toast.success(res.message);
                setRate('');
            } else {
                toast.error(res.message);
            }
        });
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-capsula-ink-muted" strokeWidth={1.5} />
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Tasa actual</p>
                </div>
                {latest ? (
                    <>
                        <p className="mt-2 font-mono text-[36px] font-semibold text-capsula-navy-deep">
                            {latest.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="mt-1 text-[13px] text-capsula-ink-soft">Bs por 1 USD</p>
                        <p className="mt-3 text-[11px] text-capsula-ink-muted">
                            Actualizada el{' '}
                            {new Date(latest.effectiveDate).toLocaleDateString('es-VE', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                            })}
                        </p>
                    </>
                ) : (
                    <p className="mt-2 text-[13px] text-capsula-ink-muted">Sin tasa registrada</p>
                )}
            </div>

            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                <p className="mb-4 font-heading text-[15px] text-capsula-navy-deep">
                    Nueva tasa de hoy
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                            Tasa BCV (Bs por USD)
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Ej: 91.50"
                            value={rate}
                            onChange={e => setRate(e.target.value)}
                            className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-2.5 font-mono text-[16px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                            disabled={isPending}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isPending || !rate.trim()}
                        isLoading={isPending}
                        className="w-full"
                    >
                        {isPending ? 'Guardando…' : 'Guardar tasa de hoy'}
                    </Button>
                </form>
            </div>

            {history.length > 0 && (
                <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft md:col-span-2">
                    <div className="flex items-center gap-2 border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
                        <History className="h-4 w-4 text-capsula-ink-muted" strokeWidth={1.5} />
                        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                            Historial reciente
                        </h2>
                    </div>
                    <div className="divide-y divide-capsula-line">
                        {history.map((r) => (
                            <div key={r.id} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-capsula-ivory-alt/40">
                                <span className="text-[13px] text-capsula-ink-soft">
                                    {new Date(r.effectiveDate).toLocaleDateString('es-VE', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </span>
                                <span className="font-mono text-[13px] font-semibold text-capsula-navy-deep">
                                    {r.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
