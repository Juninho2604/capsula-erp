'use client';

import { useState, useMemo } from 'react';
import { formatNumber, cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Clock, User, FileText, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Movement {
    id: string;
    createdAt: Date;
    movementType: string;
    quantity: number;
    unit: string;
    inventoryItem: {
        name: string;
        sku: string;
        baseUnit: string;
    };
    createdBy: {
        firstName: string;
        lastName: string;
    };
    reason: string | null;
    notes: string | null;
}

interface GroupedTransaction {
    id: string;
    date: Date;
    type: string;
    reason: string;
    user: string;
    items: Movement[];
    totalItems: number;
}

export default function HistoryList({ initialMovements }: { initialMovements: any[] }) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const groupedTransactions = useMemo(() => {
        const groups: GroupedTransaction[] = [];
        if (!initialMovements.length) return groups;

        // Sort by date desc (should already be sorted but ensuring)
        const sorted = [...initialMovements].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        let currentGroup: GroupedTransaction | null = null;

        for (const mov of sorted) {
            const movDate = new Date(mov.createdAt);
            const movTime = movDate.getTime();

            // Heuristic to group movements: 
            // Same User AND Same Type AND (Same Reason OR Close Time < 2 seconds)
            const isSameGroup = currentGroup &&
                currentGroup.user === (mov.createdBy?.firstName + ' ' + mov.createdBy?.lastName) &&
                currentGroup.type === mov.movementType &&
                (Math.abs(currentGroup.date.getTime() - movTime) < 5000) && // 5 sec threshold
                (currentGroup.reason === (mov.reason || 'Sin razón'));

            if (isSameGroup) {
                currentGroup!.items.push(mov);
                currentGroup!.totalItems++;
            } else {
                if (currentGroup) groups.push(currentGroup);

                currentGroup = {
                    id: mov.id, // Use first movement ID as group ID
                    date: movDate,
                    type: mov.movementType,
                    reason: mov.reason || 'Movimiento Manual',
                    user: mov.createdBy?.firstName + ' ' + mov.createdBy?.lastName || 'Sistema',
                    items: [mov],
                    totalItems: 1
                };
            }
        }
        if (currentGroup) groups.push(currentGroup);

        return groups;
    }, [initialMovements]);

    const toggleGroup = (id: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedGroups(newExpanded);
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'INCOMING': return { label: 'Entrada de mercancía', color: 'text-[#2F6B4E] bg-[#E5EDE7]/60 border-[#2F6B4E]/30' };
            case 'OUTGOING': return { label: 'Salida / merma', color: 'text-capsula-coral bg-capsula-coral/10 border-capsula-coral/30' };
            case 'TRANSFER_IN': return { label: 'Transferencia recibida', color: 'text-capsula-navy bg-capsula-navy/10 border-capsula-navy/30' };
            case 'TRANSFER_OUT': return { label: 'Transferencia enviada', color: 'text-[#946A1C] bg-[#F3EAD6]/60 border-[#946A1C]/30' };
            case 'ADJUSTMENT_IN': return { label: 'Ajuste de inventario (+)', color: 'text-[#2F6B4E] bg-[#E5EDE7]/60 border-[#2F6B4E]/30' };
            case 'ADJUSTMENT_OUT': return { label: 'Ajuste de inventario (-)', color: 'text-capsula-coral bg-capsula-coral/10 border-capsula-coral/30' };
            default: return { label: type, color: 'text-capsula-ink-soft bg-capsula-ivory-alt border-capsula-line' };
        }
    };

    const handleExportCSV = () => {
        const headers = ['Fecha', 'Usuario', 'Tipo de Movimiento', 'Producto', 'SKU', 'Cantidad', 'Unidad', 'Razon/Area', 'Notas'];
        const rows = initialMovements.map(m => {
            const date = new Date(m.createdAt).toLocaleString();
            const user = `${m.createdBy?.firstName || ''} ${m.createdBy?.lastName || ''}`.trim();
            const type = getTypeLabel(m.movementType).label;
            const producto = m.inventoryItem?.name || '';
            const sku = m.inventoryItem?.sku || '';
            const qty = m.quantity;
            const unit = m.unit;
            const reason = m.reason ? m.reason.replace(/,/g, ' ') : '';
            const notes = m.notes ? m.notes.replace(/,/g, ' ') : '';
            return `${date},${user},${type},${producto},${sku},${qty},${unit},${reason},${notes}`;
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `historial_inventario_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex justify-end">
                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-capsula-navy-deep hover:bg-capsula-navy-ink text-capsula-ivory-surface px-4 py-2 rounded-lg font-medium transition shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Descargar Excel (CSV)
                </button>
            </div>
            <ScrollArea className="h-[calc(100vh-250px)] pr-4">
                <div className="space-y-4">
                    {groupedTransactions.map((group) => {
                        const typeStyle = getTypeLabel(group.type);
                        const isExpanded = expandedGroups.has(group.id);

                        return (
                            <div key={group.id} className="rounded-xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft transition-all hover:shadow-md">
                                {/* Header del Grupo */}
                                <div
                                    onClick={() => toggleGroup(group.id)}
                                    className="flex cursor-pointer items-center justify-between p-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg border", typeStyle.color)}>
                                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-capsula-navy-deep">
                                                    {typeStyle.label}
                                                </h3>
                                                <span className="rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-xs font-medium text-capsula-ink-soft border border-capsula-line">
                                                    {group.totalItems} items
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-capsula-ink-soft">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {group.date.toLocaleString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3.5 w-3.5" />
                                                    {group.user}
                                                </span>
                                                {group.reason && (
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="h-3.5 w-3.5" />
                                                        {group.reason.length > 30 ? group.reason.substring(0, 30) + '...' : group.reason}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Detalles Desplegables */}
                                {isExpanded && (
                                    <div className="border-t border-capsula-line bg-capsula-ivory-alt/40 px-4 py-3">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs font-medium text-capsula-ink-soft">
                                                    <th className="pb-2 pl-2">Producto</th>
                                                    <th className="pb-2 text-right">Cantidad</th>
                                                    <th className="pb-2 pl-4">Nota Item</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-capsula-line">
                                                {group.items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td className="py-2 pl-2">
                                                            <span className="font-medium text-capsula-navy-deep">{item.inventoryItem.name}</span>
                                                            <span className="ml-2 text-xs text-capsula-ink-muted">{item.inventoryItem.sku}</span>
                                                        </td>
                                                        <td className={cn(
                                                            "py-2 text-right font-mono",
                                                            item.quantity > 0 ? "text-[#2F6B4E]" : "text-capsula-coral"
                                                        )}>
                                                            {item.quantity > 0 ? '+' : ''}{formatNumber(item.quantity)} {item.unit}
                                                        </td>
                                                        <td className="py-2 pl-4 text-capsula-ink-soft text-xs">
                                                            {item.notes || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {groupedTransactions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-capsula-ink-soft">
                            <p>No hay movimientos registrados recientes</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
