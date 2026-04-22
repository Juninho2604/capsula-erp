import Link from 'next/link';
import { getLoansAction } from '@/app/actions/loan.actions';
import LoanList from './LoanList';
import prisma from '@/server/db';
import { Handshake, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PrestamosPage() {
    const loans = await getLoansAction();
    const areas = await prisma.area.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
    });

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 border-b border-capsula-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                        <Handshake className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Finanzas</div>
                        <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                            Préstamos de insumos
                        </h1>
                        <p className="mt-1 text-[13px] text-capsula-ink-soft">
                            Gestiona préstamos a restaurantes vecinos.
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard/prestamos/nuevo"
                    className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-capsula-navy-deep px-4 py-2.5 text-[13px] font-medium text-capsula-ivory-surface shadow-cap-soft transition-colors hover:bg-capsula-navy-ink"
                >
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                    Nuevo préstamo
                </Link>
            </div>

            <LoanList loans={loans} areas={areas} />
        </div>
    );
}
