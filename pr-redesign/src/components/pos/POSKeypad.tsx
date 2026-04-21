'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * POSKeypad — teclado numérico táctil para POS / calculadora de cambio.
 * Optimizado Redmi Pad 2 (min-h 64px por tecla).
 *
 * <POSKeypad value={amount} onChange={setAmount} />
 */

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];

interface Props {
    value: string;
    onChange: (v: string) => void;
    onEnter?: () => void;
    className?: string;
}

export function POSKeypad({ value, onChange, onEnter, className }: Props) {
    const handle = (k: string) => {
        if (k === '⌫') return onChange(value.slice(0, -1));
        if (k === '.' && value.includes('.')) return;
        onChange((value === '0' && k !== '.' ? '' : value) + k);
    };

    return (
        <div className={cn('space-y-3', className)}>
            <div className="rounded-xl border border-capsula-line-strong bg-capsula-ivory px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Monto</div>
                <div className="font-mono text-3xl font-medium tabular-nums text-capsula-navy-deep">
                    {value || '0'}
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
                {KEYS.map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => handle(k)}
                        className="pos-btn pos-btn-secondary !min-h-[64px] text-2xl"
                    >
                        {k}
                    </button>
                ))}
            </div>
            {onEnter && (
                <button type="button" onClick={onEnter} className="pos-btn w-full !min-h-[64px] text-lg">
                    Confirmar
                </button>
            )}
        </div>
    );
}

export default POSKeypad;
