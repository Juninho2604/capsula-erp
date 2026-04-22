import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSettlements } from '@/app/actions/intercompany.actions';
import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/PageHeader';

export const metadata = {
    title: 'Intercompany | CAPSULA ERP',
    description: 'Liquidaciones y trazabilidad entre negocios',
};

const STATUS_LABEL: Record<string, string> = {
    DRAFT:            'Borrador',
    PENDING_APPROVAL: 'Pendiente aprobación',
    APPROVED:         'Aprobado',
    PAID:             'Pagado',
    DISPUTED:         'Disputado',
};

const STATUS_VARIANT: Record<string, 'neutral' | 'warn' | 'info' | 'ok' | 'danger'> = {
    DRAFT:            'neutral',
    PENDING_APPROVAL: 'warn',
    APPROVED:         'info',
    PAID:             'ok',
    DISPUTED:         'danger',
};

export default async function IntercompanyPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'AUDITOR'].includes(session.role)) {
        redirect('/dashboard');
    }

    const settlements = await getSettlements();

    return (
        <div className="mx-auto max-w-[1400px] animate-in">
            <PageHeader
                kicker="Finanzas"
                title="Intercompany"
                description="Liquidaciones y transferencias entre negocios del grupo."
            />

            {settlements.length === 0 ? (
                <div className="rounded-[var(--radius)] border border-dashed border-capsula-line bg-capsula-ivory-surface p-12 text-center">
                    <Link2 className="mx-auto h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
                    <p className="mt-3 text-[14px] font-medium text-capsula-ink">No hay liquidaciones registradas</p>
                    <p className="mt-1 text-[13px] text-capsula-ink-muted">Crea la primera liquidación intercompany para empezar.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                    <table className="w-full border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-capsula-line bg-capsula-ivory">
                                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Código</th>
                                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Período</th>
                                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Estado</th>
                                <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Total</th>
                                <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Líneas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlements.map(s => (
                                <tr key={s.id} className="border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory">
                                    <td className="px-5 py-3 font-mono text-[12.5px] text-capsula-navy-deep">{s.code}</td>
                                    <td className="px-5 py-3 text-capsula-ink-soft">
                                        {new Date(s.periodStart).toLocaleDateString('es-VE')} —{' '}
                                        {new Date(s.periodEnd).toLocaleDateString('es-VE')}
                                    </td>
                                    <td className="px-5 py-3">
                                        <Badge variant={STATUS_VARIANT[s.status] ?? 'neutral'}>
                                            {STATUS_LABEL[s.status] ?? s.status}
                                        </Badge>
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-semibold text-capsula-ink">
                                        ${s.totalAmount.toFixed(2)}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-capsula-ink-muted">
                                        {s.lines.length}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
