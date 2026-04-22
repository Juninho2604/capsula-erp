'use client';

import { useState, useEffect } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import {
    getMonthlyMovementsAction,
    getMovementTypesAction,
    type MovementHistoryFilters,
} from '@/app/actions/movement-history.actions';

const MOVEMENT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    PURCHASE:       { label: 'Compra',            icon: '🛒', color: 'bg-[#E5EDE7]/60 text-[#2F6B4E] border border-[#2F6B4E]/30' },
    TRANSFER_IN:    { label: 'Entrada transfer.', icon: '📥', color: 'bg-capsula-navy/10 text-capsula-navy border border-capsula-navy/30' },
    TRANSFER_OUT:   { label: 'Salida transfer.',  icon: '📤', color: 'bg-capsula-coral/10 text-capsula-coral border border-capsula-coral/30' },
    PRODUCTION_IN:  { label: 'Producción +',      icon: '🏭', color: 'bg-[#E5EDE7]/60 text-[#2F6B4E] border border-[#2F6B4E]/30' },
    PRODUCTION_OUT: { label: 'Producción -',      icon: '⚙️', color: 'bg-[#F3EAD6]/60 text-[#946A1C] border border-[#946A1C]/30' },
    ADJUSTMENT:     { label: 'Ajuste',            icon: '🔧', color: 'bg-capsula-navy/10 text-capsula-navy border border-capsula-navy/30' },
    AUDIT:          { label: 'Auditoría',         icon: '📝', color: 'bg-capsula-ivory-alt text-capsula-ink-soft border border-capsula-line' },
    LOAN_OUT:       { label: 'Préstamo -',        icon: '🤝', color: 'bg-capsula-coral/10 text-capsula-coral border border-capsula-coral/30' },
    LOAN_RETURN:    { label: 'Devolución',        icon: '↩️', color: 'bg-[#E5EDE7]/60 text-[#2F6B4E] border border-[#2F6B4E]/30' },
    SALE:           { label: 'Venta',             icon: '💰', color: 'bg-[#F3EAD6]/60 text-[#946A1C] border border-[#946A1C]/30' },
    PROCESSING:     { label: 'Procesamiento',     icon: '🥩', color: 'bg-capsula-coral/10 text-capsula-coral border border-capsula-coral/30' },
};

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
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
        if (movements.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        // Build CSV content (Excel-compatible)
        const headers = [
            'Fecha', 'Hora', 'Tipo', 'Producto', 'SKU', 'Cantidad', 'Unidad',
            'Costo Unit.', 'Costo Total', 'Referencia', 'Motivo', 'Notas', 'Realizado por'
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

        const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
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
        return MOVEMENT_TYPE_LABELS[type] || { label: type, icon: '📋', color: 'bg-capsula-ivory-alt text-capsula-ink-soft border border-capsula-line' };
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-capsula-navy-deep">
                        📊 Historial de Movimientos
                    </h1>
                    <p className="text-capsula-ink-soft">
                        Consulta y exporta todos los movimientos de inventario por mes
                    </p>
                </div>
                <button
                    onClick={exportToExcel}
                    disabled={movements.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                >
                    📥 Exportar a Excel
                </button>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4 shadow-cap-soft">
                <div className="grid gap-3 sm:grid-cols-4">
                    {/* Month */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-capsula-ink-soft">Mes</label>
                        <select
                            value={month}
                            onChange={e => setMonth(parseInt(e.target.value))}
                            className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                        >
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-capsula-ink-soft">Año</label>
                        <select
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value))}
                            className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Type filter */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-capsula-ink-soft">Tipo</label>
                        <select
                            value={movementType}
                            onChange={e => setMovementType(e.target.value)}
                            className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                        >
                            <option value="">Todos</option>
                            {availableTypes.map(t => (
                                <option key={t} value={t}>{getTypeLabel(t)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search by item */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-capsula-ink-soft">Buscar Producto</label>
                        <div className="flex gap-1">
                            <input
                                type="text"
                                value={searchItem}
                                onChange={e => setSearchItem(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Nombre..."
                                className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                            />
                            <button
                                onClick={handleSearch}
                                className="rounded-lg bg-capsula-navy-deep px-3 text-capsula-ivory-surface text-sm hover:bg-capsula-navy-ink"
                            >
                                🔍
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4">
                        <p className="text-sm text-capsula-ink-soft">Total Movimientos</p>
                        <p className="text-2xl font-bold text-capsula-navy-deep">{summary.totalMovements}</p>
                    </div>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4">
                        <p className="text-sm text-capsula-ink-soft">Costo Compras</p>
                        <p className="text-2xl font-bold text-[#2F6B4E]">{formatCurrency(summary.totalPurchaseCost)}</p>
                    </div>
                    {Object.entries(summary.byType as Record<string, number>).slice(0, 2).map(([type, count]) => (
                        <div key={type} className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-4">
                            <p className="text-sm text-capsula-ink-soft">{getTypeInfo(type).icon} {getTypeLabel(type)}</p>
                            <p className="text-2xl font-bold text-capsula-navy-deep">{count as number}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Movements Table */}
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
                    </div>
                ) : movements.length === 0 ? (
                    <div className="py-16 text-center text-capsula-ink-soft">
                        <span className="text-4xl">📭</span>
                        <p className="mt-3 text-lg font-medium">No hay movimientos para {MONTHS[month - 1]} {year}</p>
                        <p className="text-sm">Selecciona otro período o ajusta los filtros</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-soft">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-soft">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-soft">Producto</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-capsula-ink-soft">Cantidad</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-capsula-ink-soft">Costo</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-soft">Motivo</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-capsula-ink-soft">Registrado por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-capsula-line">
                                {movements.map(m => {
                                    const typeInfo = getTypeInfo(m.type);
                                    const date = new Date(m.date);
                                    return (
                                        <tr key={m.id} className="hover:bg-capsula-ivory-alt/50">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <p className="font-medium text-capsula-navy-deep">
                                                    {date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                                                </p>
                                                <p className="text-xs text-capsula-ink-muted">
                                                    {date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', typeInfo.color)}>
                                                    {typeInfo.icon} {typeInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-capsula-navy-deep truncate max-w-[200px]">{m.itemName}</p>
                                                <p className="text-xs text-capsula-ink-muted">{m.itemSku}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={cn(
                                                    'font-mono font-semibold',
                                                    m.quantity > 0 ? 'text-[#2F6B4E]' : 'text-capsula-coral'
                                                )}>
                                                    {m.quantity > 0 ? '+' : ''}{m.quantity.toFixed(2)}
                                                </span>
                                                <p className="text-xs text-capsula-ink-muted">{m.unit || m.baseUnit}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {m.totalCost !== null ? (
                                                    <span className="font-mono text-capsula-ink">
                                                        {formatCurrency(m.totalCost)}
                                                    </span>
                                                ) : (
                                                    <span className="text-capsula-ink-muted">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-capsula-ink-soft truncate max-w-[200px]" title={m.reason}>
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
                    Mostrando {movements.length} movimientos de {MONTHS[month - 1]} {year}
                    {' '} • Haz clic en "Exportar a Excel" para descargar el reporte completo
                </p>
            )}
        </div>
    );
}
