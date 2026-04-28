'use client';

import { useState, useEffect } from 'react';
import {
    ShoppingCart,
    Inbox,
    Upload,
    Factory,
    Settings,
    Wrench,
    Pencil,
    Handshake,
    Undo2,
    Coins,
    Beef,
    ClipboardList,
    Search,
    Download,
    Loader2,
    type LucideIcon,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
    getMonthlyMovementsAction,
    getMovementTypesAction,
    type MovementHistoryFilters,
} from '@/app/actions/movement-history.actions';

const MOVEMENT_TYPE_LABELS: Record<string, { label: string; Icon: LucideIcon; tone: string }> = {
    PURCHASE: { label: 'Compra', Icon: ShoppingCart, tone: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' },
    TRANSFER_IN: { label: 'Entrada Transfer.', Icon: Inbox, tone: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]' },
    TRANSFER_OUT: { label: 'Salida Transfer.', Icon: Upload, tone: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]' },
    PRODUCTION_IN: { label: 'Producción +', Icon: Factory, tone: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' },
    PRODUCTION_OUT: { label: 'Producción -', Icon: Settings, tone: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]' },
    ADJUSTMENT: { label: 'Ajuste', Icon: Wrench, tone: 'bg-capsula-navy-soft text-capsula-ink' },
    AUDIT: { label: 'Auditoría', Icon: Pencil, tone: 'bg-capsula-navy-soft text-capsula-ink' },
    LOAN_OUT: { label: 'Préstamo -', Icon: Handshake, tone: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]' },
    LOAN_RETURN: { label: 'Devolución', Icon: Undo2, tone: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' },
    SALE: { label: 'Venta', Icon: Coins, tone: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]' },
    PROCESSING: { label: 'Procesamiento', Icon: Beef, tone: 'bg-capsula-navy-soft text-capsula-ink' },
};

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function MovementHistoryView() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [movementType, setMovementType] = useState('');
    const [searchItem, setSearchItem] = useState('');
    const [movements, setMovements] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    useEffect(() => {
        getMovementTypesAction().then(setAvailableTypes);
    }, []);

    useEffect(() => {
        loadMovements();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, year, movementType]);

    async function loadMovements() {
        setIsLoading(true);
        const filters: MovementHistoryFilters = {
            month,
            year,
            movementType: movementType || undefined,
            itemName: searchItem || undefined,
        };
        const result = await getMonthlyMovementsAction(filters);
        if (result.success) {
            setMovements(result.data);
            setSummary(result.summary);
        }
        setIsLoading(false);
    }

    function handleSearch() {
        loadMovements();
    }

    function exportToExcel() {
        if (movements.length === 0) return;

        const headers = [
            'Fecha', 'Hora', 'Tipo', 'Producto', 'SKU', 'Cantidad', 'Unidad',
            'Costo Unit.', 'Costo Total', 'Referencia', 'Motivo', 'Notas', 'Realizado por',
        ];

        const rows = movements.map(m => {
            const date = new Date(m.date);
            return [
                date.toLocaleDateString('es-VE'),
                date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
                getTypeLabel(m.type),
                m.itemName,
                m.itemSku,
                m.quantity,
                m.unit || m.baseUnit,
                m.unitCost !== null ? m.unitCost.toFixed(2) : '',
                m.totalCost !== null ? m.totalCost.toFixed(2) : '',
                m.referenceNumber,
                m.reason,
                m.notes,
                m.createdBy,
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = '﻿' + headers.join(',') + '\n' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Movimientos_${MONTHS[month - 1]}_${year}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function getTypeLabel(type: string): string {
        return MOVEMENT_TYPE_LABELS[type]?.label || type;
    }

    function getTypeInfo(type: string) {
        return MOVEMENT_TYPE_LABELS[type] || { label: type, Icon: ClipboardList, tone: 'bg-capsula-ivory-alt text-capsula-ink-soft' };
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Historial de Movimientos</h1>
                    <p className="text-capsula-ink-muted">
                        Consulta y exporta todos los movimientos de inventario por mes
                    </p>
                </div>
                <button
                    onClick={exportToExcel}
                    disabled={movements.length === 0}
                    className="pos-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
                >
                    <Download className="h-4 w-4" /> Exportar a Excel
                </button>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                        <label className="pos-label">Mes</label>
                        <select
                            value={month}
                            onChange={e => setMonth(parseInt(e.target.value))}
                            className="pos-input mt-1"
                        >
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="pos-label">Año</label>
                        <select
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value))}
                            className="pos-input mt-1"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="pos-label">Tipo</label>
                        <select
                            value={movementType}
                            onChange={e => setMovementType(e.target.value)}
                            className="pos-input mt-1"
                        >
                            <option value="">Todos</option>
                            {availableTypes.map(t => (
                                <option key={t} value={t}>{getTypeLabel(t)}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="pos-label">Buscar Producto</label>
                        <div className="mt-1 flex gap-1">
                            <input
                                type="text"
                                value={searchItem}
                                onChange={e => setSearchItem(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Nombre…"
                                className="pos-input flex-1"
                            />
                            <button
                                onClick={handleSearch}
                                className="pos-btn px-3"
                                aria-label="Buscar"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-sm text-capsula-ink-muted">Total Movimientos</p>
                        <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink tabular-nums">{summary.totalMovements}</p>
                    </div>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-sm text-capsula-ink-muted">Costo Compras</p>
                        <p className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink tabular-nums">{formatCurrency(summary.totalPurchaseCost)}</p>
                    </div>
                    {Object.entries(summary.byType as Record<string, number>).slice(0, 2).map(([type, count]) => {
                        const info = getTypeInfo(type);
                        const Icon = info.Icon;
                        return (
                            <div key={type} className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                                <p className="flex items-center gap-2 text-sm text-capsula-ink-muted">
                                    <Icon className="h-4 w-4" /> {getTypeLabel(type)}
                                </p>
                                <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink tabular-nums">{count as number}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Movements Table */}
            <div className="overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-capsula-ink-muted" />
                    </div>
                ) : movements.length === 0 ? (
                    <div className="py-16 text-center text-capsula-ink-muted">
                        <ClipboardList className="mx-auto h-10 w-10 text-capsula-ink-faint" />
                        <p className="mt-3 text-lg font-medium text-capsula-ink">No hay movimientos para {MONTHS[month - 1]} {year}</p>
                        <p className="text-sm">Selecciona otro período o ajusta los filtros</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Fecha</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Tipo</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Producto</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Cantidad</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Costo</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Motivo</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Registrado por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-capsula-line">
                                {movements.map(m => {
                                    const typeInfo = getTypeInfo(m.type);
                                    const TypeIcon = typeInfo.Icon;
                                    const date = new Date(m.date);
                                    return (
                                        <tr key={m.id} className="hover:bg-capsula-ivory-surface">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <p className="font-medium text-capsula-ink">
                                                    {date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                                                </p>
                                                <p className="text-xs text-capsula-ink-faint">
                                                    {date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', typeInfo.tone)}>
                                                    <TypeIcon className="h-3 w-3" /> {typeInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-capsula-ink truncate max-w-[200px]">{m.itemName}</p>
                                                <p className="font-mono text-xs text-capsula-ink-muted">{m.itemSku}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={cn(
                                                    'font-mono font-semibold tabular-nums',
                                                    m.quantity > 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral'
                                                )}>
                                                    {m.quantity > 0 ? '+' : ''}{m.quantity.toFixed(2)}
                                                </span>
                                                <p className="text-xs text-capsula-ink-faint">{m.unit || m.baseUnit}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {m.totalCost !== null ? (
                                                    <span className="font-mono text-capsula-ink-soft tabular-nums">
                                                        {formatCurrency(m.totalCost)}
                                                    </span>
                                                ) : (
                                                    <span className="text-capsula-ink-faint">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="truncate max-w-[200px] text-capsula-ink-soft" title={m.reason}>
                                                    {m.reason || '-'}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-capsula-ink-soft whitespace-nowrap">
                                                {m.createdBy}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer info */}
            {movements.length > 0 && (
                <p className="text-center text-sm text-capsula-ink-muted">
                    Mostrando {movements.length} movimientos de {MONTHS[month - 1]} {year} · Haz clic en &quot;Exportar a Excel&quot; para descargar el reporte completo
                </p>
            )}
        </div>
    );
}
