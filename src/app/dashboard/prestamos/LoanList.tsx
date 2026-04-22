'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import { resolveLoanAction } from '@/app/actions/loan.actions';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { Coins, Package, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

interface Loan {
    id: string;
    loaneeName: string;
    status: string;
    type: string;
    quantity: number;
    unit: string;
    loanDate: Date;
    resolvedAt: Date | null;
    agreedPrice: number | null;
    notes: string | null;
    inventoryItem: {
        name: string;
        sku: string;
    };
    createdBy: {
        firstName: string;
        lastName: string;
    };
}

interface AreaOption {
    id: string;
    name: string;
}

interface LoanListProps {
    loans: Loan[];
    areas: AreaOption[];
}

export default function LoanList({ loans, areas }: LoanListProps) {
    const { user } = useAuthStore();
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
    const [resolveNotes, setResolveNotes] = useState('');
    const [resolveAreaId, setResolveAreaId] = useState<string>('');

    const handleResolve = async (loan: Loan) => {
        if (!user) return;
        setResolvingId(loan.id);

        try {
            const result = await resolveLoanAction({
                loanId: loan.id,
                userId: user.id,
                resolutionType: loan.type as 'REPLACEMENT' | 'PAYMENT',
                notes: resolveNotes,
                areaId: resolveAreaId || undefined,
            });

            if (result.success) {
                toast.success('Préstamo finalizado con éxito');
                setShowResolveModal(null);
                setResolveNotes('');
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error('Error al finalizar');
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {loans.map((loan) => {
                    const Icon = loan.type === 'PAYMENT' ? Coins : Package;
                    const completed = loan.status === 'COMPLETED';
                    return (
                        <div
                            key={loan.id}
                            className={cn(
                                "group rounded-[var(--radius)] border p-5 shadow-cap-soft transition-all hover:-translate-y-px hover:shadow-cap-raised",
                                completed
                                    ? "border-[#D3E2D8] bg-[#E5EDE7]/50"
                                    : "border-capsula-line bg-capsula-ivory-surface",
                            )}
                        >
                            {/* Header */}
                            <div className="mb-4 flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border",
                                        completed
                                            ? "border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]"
                                            : "border-capsula-navy/20 bg-capsula-navy-soft text-capsula-navy",
                                    )}>
                                        <Icon className="h-4 w-4" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-capsula-ink">{loan.loaneeName}</h3>
                                        <p className="text-[11px] text-capsula-ink-muted">
                                            {format(new Date(loan.loanDate), "d MMM, yyyy", { locale: es })}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant={completed ? 'ok' : 'warn'}>
                                    {completed ? 'Completado' : 'Pendiente'}
                                </Badge>
                            </div>

                            {/* Content */}
                            <div className="mb-4 space-y-2 text-[13px]">
                                <p className="text-capsula-ink">
                                    <span className="font-mono font-semibold">{formatNumber(loan.quantity)} {loan.unit}</span> de {loan.inventoryItem.name}
                                </p>

                                <div className="flex items-center gap-2 text-[11px] text-capsula-ink-muted">
                                    <span>Tipo:</span>
                                    <span className="font-medium uppercase tracking-[0.08em] text-capsula-ink-soft">
                                        {loan.type === 'PAYMENT' ? 'Pago acordado' : 'Reposición'}
                                    </span>
                                </div>

                                {loan.type === 'PAYMENT' && loan.agreedPrice && (
                                    <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-capsula-ink-muted">Precio acordado</p>
                                        <p className="font-mono font-semibold text-capsula-ink">
                                            {formatCurrency(loan.agreedPrice)} / u
                                        </p>
                                    </div>
                                )}

                                {loan.notes && (
                                    <p className="inline-flex items-center gap-1 text-[11px] italic text-capsula-ink-muted">
                                        <MessageSquare className="h-3 w-3" strokeWidth={1.5} /> {loan.notes}
                                    </p>
                                )}
                            </div>

                            {/* Footer / Actions */}
                            <div className="flex items-center justify-between border-t border-capsula-line pt-3">
                                <p className="text-[11px] text-capsula-ink-muted">
                                    Por: <span className="font-medium text-capsula-ink-soft">{loan.createdBy.firstName}</span>
                                </p>

                                {loan.status === 'PENDING' && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setShowResolveModal(loan.id)}
                                    >
                                        {loan.type === 'PAYMENT' ? 'Confirmar pago' : 'Confirmar reposición'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {loans.length === 0 && (
                    <div className="col-span-full py-12 text-center text-[13px] text-capsula-ink-muted">
                        No hay préstamos registrados.
                    </div>
                )}
            </div>

            {/* Modal de Resolución */}
            {showResolveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
                        <h3 className="mb-4 font-heading text-[20px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                            Confirmar resolución
                        </h3>

                        <div className="space-y-4">
                            <p className="text-[13px] text-capsula-ink-soft">
                                ¿Estás seguro de marcar este préstamo como completado? Esto indica que:
                            </p>
                            <ul className="list-disc pl-5 text-[13px] text-capsula-ink-soft">
                                {loans.find(l => l.id === showResolveModal)?.type === 'PAYMENT'
                                    ? <li>El dinero ha sido recibido (cuentas por cobrar).</li>
                                    : <li>El producto ha sido devuelto al inventario.</li>
                                }
                            </ul>

                            {loans.find(l => l.id === showResolveModal)?.type === 'REPLACEMENT' && (
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                        Reingresar en almacén
                                    </label>
                                    <select
                                        className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                        value={resolveAreaId}
                                        onChange={(e) => setResolveAreaId(e.target.value)}
                                    >
                                        <option value="">Seleccionar…</option>
                                        {areas.map(area => (
                                            <option key={area.id} value={area.id}>{area.name}</option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-[11px] text-[#946A1C]">
                                        Debes seleccionar un almacén para reponer el stock.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Notas de cierre (opcional)
                                </label>
                                <textarea
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                    rows={3}
                                    placeholder="Ej: Pagado en efectivo…"
                                    value={resolveNotes}
                                    onChange={(e) => setResolveNotes(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setShowResolveModal(null);
                                        setResolveAreaId('');
                                    }}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        const loan = loans.find(l => l.id === showResolveModal);
                                        if (loan) handleResolve(loan);
                                    }}
                                    disabled={
                                        resolvingId !== null ||
                                        (loans.find(l => l.id === showResolveModal)?.type === 'REPLACEMENT' && !resolveAreaId)
                                    }
                                    isLoading={resolvingId !== null}
                                >
                                    {resolvingId ? 'Procesando…' : 'Confirmar'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
