'use client';

/**
 * Piezas compartidas de las vistas de reportes (Minimal Navy, CLAUDE.md):
 *  - <ReportToolbar>: presets de fecha + rango custom + sucursal + toggle
 *    Bs/USD/ambas + export Excel/PDF (gateados por reportes.exportar).
 *  - <ReportSkeleton>: loading con skeletons (no spinners).
 *  - <ReportEmptyState>: estado vacío elegante para tenants sin data.
 *  - <FamilyTabs>: sub-navegación dentro de una familia.
 */

import { useState } from 'react';
import { FileSpreadsheet, FileText, Inbox } from 'lucide-react';
import {
    type CurrencyMode, type DateRange, type RangePreset,
    PRESET_LABELS, presetRange, caracasToday,
} from './format';

export interface BranchOption { id: string; name: string }

interface ToolbarProps {
    range: DateRange;
    onRangeChange: (r: DateRange) => void;
    branches?: BranchOption[];
    branchId?: string;                       // '' = todas
    onBranchChange?: (id: string) => void;
    currency?: CurrencyMode;
    onCurrencyChange?: (m: CurrencyMode) => void;
    canExport: boolean;
    onExportExcel?: () => void;
    onExportPdf?: () => void;
    busy?: boolean;
}

const PRESETS: RangePreset[] = ['HOY', 'AYER', 'SEMANA', 'MES', 'MES_ANTERIOR'];

export function ReportToolbar(props: ToolbarProps) {
    const [activePreset, setActivePreset] = useState<RangePreset>('HOY');

    const applyPreset = (p: RangePreset) => {
        setActivePreset(p);
        props.onRangeChange(presetRange(p));
    };

    const setCustom = (field: 'from' | 'to', value: string) => {
        setActivePreset('CUSTOM');
        props.onRangeChange({ ...props.range, [field]: value });
    };

    return (
        <div className="bg-capsula-ivory border border-capsula-line rounded-2xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map(p => (
                    <button
                        key={p}
                        onClick={() => applyPreset(p)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                            activePreset === p
                                ? 'bg-capsula-navy-deep text-capsula-cream'
                                : 'bg-capsula-ivory-alt text-capsula-ink-soft hover:bg-capsula-navy-soft'
                        }`}
                    >
                        {PRESET_LABELS[p]}
                    </button>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                    <input
                        type="date"
                        value={props.range.from}
                        max={caracasToday()}
                        onChange={e => setCustom('from', e.target.value)}
                        className="pos-input !py-1.5 !px-2 text-xs w-[8.5rem]"
                    />
                    <span className="text-capsula-ink-faint text-xs">→</span>
                    <input
                        type="date"
                        value={props.range.to}
                        max={caracasToday()}
                        onChange={e => setCustom('to', e.target.value)}
                        className="pos-input !py-1.5 !px-2 text-xs w-[8.5rem]"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {props.branches && props.branches.length > 1 && props.onBranchChange && (
                    <select
                        value={props.branchId ?? ''}
                        onChange={e => props.onBranchChange!(e.target.value)}
                        className="pos-input !py-1.5 !px-2 text-xs"
                    >
                        <option value="">Todas las sucursales</option>
                        {props.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                )}

                {props.currency && props.onCurrencyChange && (
                    <div className="inline-flex rounded-full border border-capsula-line overflow-hidden">
                        {(['USD', 'BS', 'AMBAS'] as CurrencyMode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => props.onCurrencyChange!(m)}
                                className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
                                    props.currency === m
                                        ? 'bg-capsula-navy-deep text-capsula-cream'
                                        : 'bg-capsula-ivory text-capsula-ink-muted hover:bg-capsula-ivory-alt'
                                }`}
                            >
                                {m === 'AMBAS' ? '$ + Bs' : m === 'BS' ? 'Bs' : '$'}
                            </button>
                        ))}
                    </div>
                )}

                {props.canExport && (
                    <div className="flex items-center gap-2 ml-auto">
                        {props.onExportExcel && (
                            <button
                                onClick={props.onExportExcel}
                                disabled={props.busy}
                                className="pos-btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                            </button>
                        )}
                        {props.onExportPdf && (
                            <button
                                onClick={props.onExportPdf}
                                disabled={props.busy}
                                className="pos-btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <FileText className="h-3.5 w-3.5" /> PDF
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function ReportSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="space-y-3 animate-pulse" aria-label="Cargando reporte">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-capsula-ivory-alt" />
                ))}
            </div>
            <div className="rounded-2xl border border-capsula-line overflow-hidden">
                <div className="h-9 bg-capsula-ivory-alt" />
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="h-10 border-t border-capsula-line bg-capsula-ivory" />
                ))}
            </div>
        </div>
    );
}

export function ReportEmptyState({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-capsula-line bg-capsula-ivory p-10 text-center">
            <Inbox className="h-10 w-10 mx-auto text-capsula-ink-faint" />
            <p className="mt-3 font-semibold text-capsula-ink">{title}</p>
            {hint && <p className="mt-1 text-xs text-capsula-ink-muted max-w-sm mx-auto">{hint}</p>}
        </div>
    );
}

export function FamilyTabs<T extends string>({ tabs, active, onChange }: {
    tabs: Array<{ key: T; label: string }>;
    active: T;
    onChange: (k: T) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1.5 no-print">
            {tabs.map(t => (
                <button
                    key={t.key}
                    onClick={() => onChange(t.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                        active === t.key
                            ? 'bg-capsula-navy-deep text-capsula-cream'
                            : 'bg-capsula-ivory border border-capsula-line text-capsula-ink-soft hover:bg-capsula-ivory-alt'
                    }`}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
