'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

/**
 * DataTable — look minimal para las tablas del ERP.
 *   <DataTable
 *     columns={[{key:'sku', header:'SKU'}, {key:'nombre', header:'Producto'}, ...]}
 *     rows={items}
 *     onRowClick={row => ...}
 *     search
 *   />
 */

export interface Column<T = any> {
    key: keyof T | string;
    header: string;
    align?: 'left' | 'right' | 'center';
    mono?: boolean;
    width?: string | number;
    render?: (row: T) => React.ReactNode;
    className?: string;
}

interface Props<T = any> {
    columns: Column<T>[];
    rows: T[];
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
    caption?: string;
    search?: boolean;
    searchPlaceholder?: string;
    className?: string;
}

export function DataTable<T extends Record<string, any>>({
    columns, rows, onRowClick, emptyMessage = 'Sin registros', caption,
    search, searchPlaceholder = 'Buscar…', className,
}: Props<T>) {
    const [q, setQ] = React.useState('');
    const filtered = React.useMemo(() => {
        if (!search || !q.trim()) return rows;
        const n = q.trim().toLowerCase();
        return rows.filter((r) =>
            columns.some((c) => String((r as any)[c.key] ?? '').toLowerCase().includes(n))
        );
    }, [rows, q, columns, search]);

    return (
        <div className={cn(
            'overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface',
            className
        )}>
            {(caption || search) && (
                <div className="flex items-center justify-between gap-4 border-b border-capsula-line px-5 py-3">
                    {caption && <div className="text-[13px] font-medium text-capsula-ink">{caption}</div>}
                    {search && (
                        <div className="relative ml-auto">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="h-9 w-56 rounded-full border border-capsula-line bg-capsula-ivory pl-8 pr-3 text-[13px] text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                    <thead>
                        <tr className="border-b border-capsula-line bg-capsula-ivory">
                            {columns.map((c) => (
                                <th
                                    key={String(c.key)}
                                    style={{ width: c.width }}
                                    className={cn(
                                        'px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted',
                                        c.align === 'right' ? 'text-right' :
                                        c.align === 'center' ? 'text-center' : 'text-left',
                                    )}
                                >
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-5 py-14 text-center text-capsula-ink-muted">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row, i) => (
                                <tr
                                    key={i}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={cn(
                                        'border-b border-capsula-line last:border-b-0 transition-colors',
                                        onRowClick && 'cursor-pointer hover:bg-capsula-ivory',
                                    )}
                                >
                                    {columns.map((c) => (
                                        <td
                                            key={String(c.key)}
                                            className={cn(
                                                'px-5 py-3 text-capsula-ink',
                                                c.align === 'right' ? 'text-right' :
                                                c.align === 'center' ? 'text-center' : 'text-left',
                                                c.mono && 'font-mono text-[12.5px]',
                                                c.className,
                                            )}
                                        >
                                            {c.render ? c.render(row) : (row as any)[c.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DataTable;
