'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Printer, Ban, Check, Loader2 } from 'lucide-react';
import { updateAuditItemAction, approveAuditAction, voidAuditAction } from '@/app/actions/audit.actions';
import { cn, formatNumber } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

interface AuditItem {
    id: string;
    inventoryItem: { name: string; sku: string; baseUnit: string };
    systemStock: number;
    countedStock: number;
    difference: number;
    costSnapshot: number | null;
    notes: string | null;
}

interface Audit {
    id: string;
    name: string | null;
    status: string;
    createdAt: Date;
    createdBy: { firstName: string | null; lastName: string | null };
    resolvedAt: Date | null;
    resolvedBy: { firstName: string | null; lastName: string | null } | null;
    items: AuditItem[];
    notes?: string | null;
}

const STATUS_TONE: Record<string, string> = {
    DRAFT: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]',
    APPROVED: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
    REJECTED: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]',
    VOIDED: 'bg-capsula-ivory-alt text-capsula-ink-muted',
};

export function AuditDetail({ audit }: { audit: Audit }) {
    const router = useRouter();
    useAuthStore();
    const [isApproving, setIsApproving] = useState(false);
    const [items, setItems] = useState(audit.items);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    const handleStartEdit = (item: AuditItem) => {
        if (audit.status !== 'DRAFT') return;
        setEditingId(item.id);
        setEditValue(item.countedStock.toString());
    };

    const handleSaveEdit = async (id: string, originalCount: number) => {
        const val = parseFloat(editValue);
        if (isNaN(val)) return;

        if (val === originalCount) {
            setEditingId(null);
            return;
        }

        setItems(items.map(i => i.id === id ? { ...i, countedStock: val, difference: val - i.systemStock } : i));
        setEditingId(null);

        const res = await updateAuditItemAction({ itemId: id, countedStock: val });
        if (!res.success) {
            toast.error(res.message);
            router.refresh();
        } else {
            toast.success('Guardado');
        }
    };

    const handleApprove = async () => {
        if (!confirm('¿Estás seguro de aprobar esta auditoría? Esto actualizará el inventario REAL.')) return;

        setIsApproving(true);
        const res = await approveAuditAction({ auditId: audit.id });
        setIsApproving(false);

        if (res.success) {
            toast.success('Auditoría Aprobada Exitosamente');
            router.refresh();
        } else {
            toast.error(res.message);
        }
    };

    const handleVoid = async () => {
        if (!confirm('¿Estás seguro de ANULAR esta auditoría?\n\nEsto revertirá todos los movimientos de stock generados.\nEsta acción no se puede deshacer.')) return;

        const res = await voidAuditAction(audit.id);
        if (res.success) {
            toast.success('Auditoría anulada correctamente');
            router.refresh();
        } else {
            toast.error(res.message);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            {/* Header / Actions - Hidden on Print */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-capsula-line bg-capsula-ivory p-6 shadow-sm print:hidden sm:flex-row sm:items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                            {audit.name || 'Auditoría sin nombre'}
                        </h1>
                        <span className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            STATUS_TONE[audit.status] ?? STATUS_TONE.VOIDED,
                        )}>
                            {audit.status}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-capsula-ink-muted">
                        Creado por {audit.createdBy.firstName} el {format(new Date(audit.createdAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                    {audit.notes && (
                        <p className="mt-1 max-w-md whitespace-pre-wrap text-xs text-capsula-ink-faint">{audit.notes}</p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handlePrint}
                        className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        <Printer className="h-4 w-4" /> Imprimir
                    </button>

                    {audit.status === 'APPROVED' && (
                        <button
                            onClick={handleVoid}
                            className="inline-flex items-center gap-2 rounded-lg border border-capsula-line bg-capsula-coral/10 px-4 py-2 text-sm font-medium text-capsula-coral transition-colors hover:bg-capsula-coral/20"
                        >
                            <Ban className="h-4 w-4" /> Anular Auditoría
                        </button>
                    )}

                    {audit.status === 'DRAFT' && (
                        <button
                            onClick={handleApprove}
                            disabled={isApproving}
                            className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                        >
                            {isApproving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</>
                            ) : (
                                <><Check className="h-4 w-4" /> Aprobar y Ajustar Inventario</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-8">
                <h1 className="font-semibold text-2xl tracking-[-0.02em]">Reporte de auditoría de inventario</h1>
                <p className="text-sm">Ref: {audit.id}</p>
                <div className="mt-4 flex justify-between border-b pb-4">
                    <div>
                        <p><strong>Fecha:</strong> {format(new Date(audit.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                        <p><strong>Responsable:</strong> {audit.createdBy.firstName} {audit.createdBy.lastName}</p>
                        <p><strong>Almacén:</strong> Global / Principal</p>
                    </div>
                    <div className="text-right">
                        <p><strong>Estado:</strong> {audit.status}</p>
                        <p><strong>Items:</strong> {audit.items.length}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm print:border-0 print:shadow-none">
                <table className="w-full text-left text-sm">
                    <thead className="bg-capsula-ivory-alt print:bg-capsula-ivory-alt">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Item</th>
                            <th className="px-4 py-3 font-semibold text-lg tracking-[-0.01em] text-capsula-ink text-right">Sistema</th>
                            <th className="px-4 py-3 font-semibold text-lg tracking-[-0.01em] text-capsula-ink text-right">Conteo Físico</th>
                            <th className="px-4 py-3 font-semibold text-lg tracking-[-0.01em] text-capsula-ink text-right">Diferencia</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-capsula-line">
                        {items.map((item) => (
                            <tr key={item.id} className="group">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-capsula-ink">{item.inventoryItem.name}</div>
                                    <div className="font-mono text-xs text-capsula-ink-muted">{item.inventoryItem.sku}</div>
                                </td>
                                <td className="px-4 py-3 text-right text-capsula-ink-muted tabular-nums">
                                    {formatNumber(item.systemStock)} {item.inventoryItem.baseUnit}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {editingId === item.id ? (
                                        <input
                                            type="number"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={() => handleSaveEdit(item.id, item.countedStock)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id, item.countedStock)}
                                            autoFocus
                                            className="pos-input w-24 px-2 py-1 text-right tabular-nums"
                                        />
                                    ) : (
                                        <div
                                            onClick={() => handleStartEdit(item)}
                                            className={cn(
                                                "cursor-pointer rounded px-2 py-1 transition-colors hover:bg-capsula-ivory-alt tabular-nums",
                                                audit.status !== 'DRAFT' && "cursor-default hover:bg-transparent"
                                            )}
                                        >
                                            <span className="font-semibold">{formatNumber(item.countedStock)}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className={cn(
                                        "font-medium tabular-nums",
                                        item.difference > 0 ? "text-[#2F6B4E] dark:text-[#6FB88F]" :
                                            item.difference < 0 ? "text-capsula-coral" : "text-capsula-ink-muted"
                                    )}>
                                        {item.difference > 0 ? '+' : ''}{formatNumber(item.difference)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Print signature */}
            <div className="hidden print:flex mt-12 justify-between px-8">
                <div className="border-t border-black px-8 pt-2 text-center">
                    <p>Contado Por</p>
                </div>
                <div className="border-t border-black px-8 pt-2 text-center">
                    <p>Verificado Por</p>
                </div>
                <div className="border-t border-black px-8 pt-2 text-center">
                    <p>Aprobado Por</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 1cm; size: A4; }
                    body { background: white; color: black; }
                    nav, aside, header { display: none !important; }
                    main { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
        </div>
    );
}
