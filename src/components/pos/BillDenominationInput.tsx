'use client';

import { useState, useEffect } from 'react';

const USD_BILLS = [100, 50, 20, 10, 5, 1] as const;

export interface DenominationMap {
    [key: number]: number; // bill value → count
    total: number;
}

interface Props {
    label?: string;
    onChange: (json: string, total: number) => void;
    initialJson?: string | null;
}

export function BillDenominationInput({ label = 'Desglose de Billetes', onChange, initialJson }: Props) {
    const initial = initialJson ? (() => {
        try { return JSON.parse(initialJson) as Record<string, number>; } catch { return {}; }
    })() : {};

    const [counts, setCounts] = useState<Record<number, string>>(() =>
        Object.fromEntries(USD_BILLS.map(b => [b, initial[b] != null ? String(initial[b]) : '']))
    );

    const total = USD_BILLS.reduce((sum, b) => sum + (parseInt(counts[b] || '0') || 0) * b, 0);

    useEffect(() => {
        const map: Record<string, number> = {};
        let hasAny = false;
        for (const b of USD_BILLS) {
            const n = parseInt(counts[b] || '0') || 0;
            if (n > 0) { map[b] = n; hasAny = true; }
        }
        if (hasAny) {
            map['total'] = total;
            onChange(JSON.stringify(map), total);
        } else {
            onChange('', 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [counts]);

    const update = (bill: number, value: string) => {
        setCounts(prev => ({ ...prev, [bill]: value }));
    };

    return (
        <div className="space-y-2">
            <p className="pos-label">{label}</p>
            <div className="overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory-surface">
                {USD_BILLS.map((bill, i) => {
                    const count = parseInt(counts[bill] || '0') || 0;
                    const subtotal = count * bill;
                    return (
                        <div
                            key={bill}
                            className={`flex items-center gap-3 px-3 py-2 text-sm ${i < USD_BILLS.length - 1 ? 'border-b border-capsula-line' : ''}`}
                        >
                            <span className="w-10 text-right font-medium tabular-nums text-capsula-ink">${bill}</span>
                            <span className="text-xs text-capsula-ink-muted">×</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={counts[bill]}
                                onChange={e => update(bill, e.target.value)}
                                placeholder="0"
                                className="w-16 rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1 text-center text-sm font-medium tabular-nums text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                            />
                            <span className="flex-1 text-xs text-capsula-ink-muted">= </span>
                            <span className={`text-right font-mono text-sm tabular-nums ${subtotal > 0 ? 'font-medium text-capsula-ink' : 'text-capsula-ink-muted'}`}>
                                ${subtotal.toFixed(2)}
                            </span>
                        </div>
                    );
                })}
                <div className="flex items-center justify-between border-t-2 border-capsula-navy-deep/30 bg-capsula-navy-soft px-3 py-2">
                    <span className="text-sm font-medium uppercase tracking-[0.1em] text-capsula-ink">Total</span>
                    <span className="font-heading text-lg tabular-nums tracking-[-0.01em] text-capsula-ink">${total.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
}
