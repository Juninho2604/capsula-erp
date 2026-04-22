import { getAuditsAction } from '@/app/actions/audit.actions';
import { AuditList } from './AuditList';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldCheck } from 'lucide-react';

export default async function AuditsPage() {
    const audits = await getAuditsAction();

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 border-b border-capsula-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                        <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Inventario</div>
                        <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Auditorías de inventario</h1>
                        <p className="mt-1 text-[13px] text-capsula-ink-soft">Historial de revisiones y conteos físicos.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/dashboard/inventario"
                        className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-2 text-[13px] font-medium text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                    >
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                        Volver
                    </Link>
                    <Link
                        href="/dashboard/inventario/importar"
                        className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-capsula-navy-deep px-4 py-2 text-[13px] font-medium text-capsula-ivory-surface shadow-cap-soft transition-colors hover:bg-capsula-navy-ink"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Nueva revisión
                    </Link>
                </div>
            </div>

            <AuditList initialAudits={audits as any} />
        </div>
    );
}
