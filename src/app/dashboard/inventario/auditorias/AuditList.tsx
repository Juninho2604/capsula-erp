'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Trash2, Pencil, Check, Ban, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { deleteAuditAction } from '@/app/actions/audit.actions';

interface Audit {
    id: string;
    name: string | null;
    status: string;
    createdAt: Date;
    createdById: string;
    createdBy: { firstName: string | null; lastName: string | null };
    resolvedAt: Date | null;
    resolvedBy: { firstName: string | null; lastName: string | null } | null;
    _count: { items: number };
}

const STATUS_META: Record<string, { label: string; tone: string; Icon: typeof Pencil }> = {
    DRAFT: {
        label: 'Borrador',
        tone: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]',
        Icon: Pencil,
    },
    APPROVED: {
        label: 'Aprobado',
        tone: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
        Icon: Check,
    },
    REJECTED: {
        label: 'Rechazado',
        tone: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]',
        Icon: Ban,
    },
    VOIDED: {
        label: 'Anulado',
        tone: 'bg-capsula-ivory-alt text-capsula-ink-muted',
        Icon: ShieldOff,
    },
};

export function AuditList({ initialAudits }: { initialAudits: Audit[] }) {
    const [audits, setAudits] = useState(initialAudits);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta auditoría?')) return;
        const res = await deleteAuditAction(id);
        if (res.success) {
            toast.success('Auditoría eliminada');
            setAudits(audits.filter(a => a.id !== id));
        } else {
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                <table className="w-full">
                    <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                        <tr>
                            <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Fecha</th>
                            <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Nombre / Ref</th>
                            <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Estado</th>
                            <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Creado Por</th>
                            <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Items</th>
                            <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-capsula-line">
                        {audits.map((audit) => {
                            const meta = STATUS_META[audit.status] ?? STATUS_META.VOIDED;
                            const StatusIcon = meta.Icon;
                            return (
                                <tr key={audit.id} className="group hover:bg-capsula-ivory-surface">
                                    <td className="px-6 py-4 text-sm text-capsula-ink tabular-nums">
                                        {format(new Date(audit.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link
                                            href={`/dashboard/inventario/auditorias/${audit.id}`}
                                            className="font-medium text-capsula-coral hover:underline"
                                        >
                                            {audit.name || 'Sin nombre'}
                                        </Link>
                                        <p className="font-mono text-xs text-capsula-ink-muted">{audit.id.substring(0, 8)}…</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                                            meta.tone,
                                        )}>
                                            <StatusIcon className="h-3 w-3" />
                                            {meta.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-capsula-ink-soft">
                                        {audit.createdBy.firstName} {audit.createdBy.lastName}
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm font-medium text-capsula-ink tabular-nums">
                                        {audit._count.items}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Link
                                                href={`/dashboard/inventario/auditorias/${audit.id}`}
                                                className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                                title="Ver detalles"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                            {audit.status === 'DRAFT' && (
                                                <button
                                                    onClick={() => handleDelete(audit.id)}
                                                    className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {audits.length === 0 && (
                    <div className="p-12 text-center text-capsula-ink-muted">
                        No hay auditorías registradas.
                    </div>
                )}
            </div>
        </div>
    );
}
