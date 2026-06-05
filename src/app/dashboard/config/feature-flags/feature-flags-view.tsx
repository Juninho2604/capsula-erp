'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
    toggleFeatureFlagAction,
    type FeatureFlagRow,
} from '@/app/actions/feature-flags.actions';
import type { FeatureFlagKey } from '@/lib/feature-flags';

export function FeatureFlagsView({ initialRows }: { initialRows: FeatureFlagRow[] }) {
    const [rows, setRows] = useState<FeatureFlagRow[]>(initialRows);
    const [pendingKey, setPendingKey] = useState<FeatureFlagKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    function handleToggle(row: FeatureFlagRow) {
        const next = !row.enabled;
        setRows(prev => prev.map(r => (r.key === row.key ? { ...r, enabled: next } : r)));
        setPendingKey(row.key);
        setError(null);
        startTransition(async () => {
            const res = await toggleFeatureFlagAction(row.key, next);
            if (!res.success) {
                setRows(prev => prev.map(r => (r.key === row.key ? { ...r, enabled: !next } : r)));
                setError(res.message ?? 'Error al actualizar el flag.');
            }
            setPendingKey(null);
        });
    }

    if (rows.length === 0) {
        return (
            <div className="bg-capsula-ivory border border-capsula-line p-8 rounded-2xl text-center text-capsula-ink-muted">
                No hay feature flags registrados todavía.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {error && (
                <div className="bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] border border-capsula-line p-3 rounded-xl text-sm">
                    {error}
                </div>
            )}
            {rows.map(row => {
                const isPending = pendingKey === row.key;
                return (
                    <div
                        key={row.key}
                        className="bg-capsula-ivory border border-capsula-line rounded-2xl p-5 flex items-start gap-4"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-capsula-ink">{row.label}</h3>
                                <code className="text-[10px] font-mono uppercase tracking-[0.08em] text-capsula-ink-muted bg-capsula-ivory-alt px-1.5 py-0.5 rounded">
                                    {row.key}
                                </code>
                            </div>
                            <p className="text-sm text-capsula-ink-soft">{row.description}</p>
                        </div>
                        <button
                            onClick={() => handleToggle(row)}
                            disabled={isPending}
                            className={[
                                'min-w-[112px] py-2.5 px-4 rounded-xl border font-semibold text-sm transition-colors inline-flex items-center justify-center gap-1.5',
                                row.enabled
                                    ? 'bg-capsula-navy-deep text-capsula-cream border-capsula-navy-deep'
                                    : 'bg-capsula-ivory-surface text-capsula-ink border-capsula-line hover:border-capsula-navy-deep/40',
                                isPending ? 'opacity-60 cursor-wait' : '',
                            ].join(' ')}
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : row.enabled ? (
                                <>
                                    <Check className="h-4 w-4" /> Activo
                                </>
                            ) : (
                                'Inactivo'
                            )}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
