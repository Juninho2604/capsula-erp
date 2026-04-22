'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { deleteAuditAction } from '@/app/actions/audit.actions';
import { Badge } from '@/components/ui/Badge';
import { Eye, Trash2 } from 'lucide-react';

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

    const statusVariant = (s: string) =>
        s === 'APPROVED' ? 'ok' :
        s === 'DRAFT' ? 'warn' :
        s === 'REJECTED' ? 'danger' : 'neutral';
    const statusLabel = (s: string) =>
        s === 'DRAFT' ? 'Borrador' :
        s === 'APPROVED' ? 'Aprobado' :
        s === 'REJECTED' ? 'Rechazado' :
        s === 'VOIDED' ? 'Anulado' : s;

    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                <table className="w-full">
                    <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                        <tr>
                            {['Fecha', 'Nombre / ref', 'Estado', 'Creado por', 'Items', 'Acciones'].map((h, i) => (
                                <th key={h} className={`px-6 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted ${i === 4 ? 'text-center' : i === 5 ? 'text-right' : 'text-left'}`}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-capsula-line">
                        {audits.map((audit) => (
                            <tr key={audit.id} className="group transition-colors hover:bg-capsula-ivory-alt/40">
                                <td className="px-6 py-4 font-mono text-[13px] text-capsula-ink">
                                    {format(new Date(audit.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                                </td>
                                <td className="px-6 py-4">
                                    <Link href={`/dashboard/inventario/auditorias/${audit.id}`} className="font-medium text-capsula-navy-deep hover:text-capsula-coral">
                                        {audit.name || 'Sin nombre'}
                                    </Link>
                                    <p className="font-mono text-[11px] text-capsula-ink-muted">{audit.id.substring(0, 8)}…</p>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant={statusVariant(audit.status)}>{statusLabel(audit.status)}</Badge>
                                </td>
                                <td className="px-6 py-4 text-[13px] text-capsula-ink-soft">
                                    {audit.createdBy.firstName} {audit.createdBy.lastName}
                                </td>
                                <td className="px-6 py-4 text-center font-mono text-[13px] text-capsula-ink">
                                    {audit._count.items}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Link
                                            href={`/dashboard/inventario/auditorias/${audit.id}`}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-navy-deep"
                                            title="Ver detalles"
                                        >
                                            <Eye className="h-4 w-4" strokeWidth={1.5} />
                                        </Link>
                                        {audit.status === 'DRAFT' && (
                                            <button
                                                onClick={() => handleDelete(audit.id)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {audits.length === 0 && (
                    <div className="p-12 text-center text-[13px] text-capsula-ink-soft">
                        No hay auditorías registradas.
                    </div>
                )}
            </div>
        </div>
    );
}
