import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSettlements } from '@/app/actions/intercompany.actions';

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

const STATUS_COLOR: Record<string, string> = {
    DRAFT:            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    APPROVED:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    PAID:             'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    DISPUTED:         'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

export default async function IntercompanyPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'AUDITOR'].includes(session.role)) {
        redirect('/dashboard');
    }

    const settlements = await getSettlements();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Intercompany</h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Liquidaciones y transferencias entre negocios del grupo
                    </p>
                </div>
                {/* TODO: Add "Nueva Liquidación" button (client action) */}
            </div>

            {/* Settlements table */}
            {settlements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
                    <p className="text-4xl"></p>
                    <p className="mt-2 font-medium text-gray-600 dark:text-gray-400">
                        No hay liquidaciones registradas
                    </p>
                    <p className="text-sm text-gray-400">
                        Crea la primera liquidación intercompany para empezar.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                            <tr>
                                <th className="px-5 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Código</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Período</th>
                                <th className="px-5 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                                <th className="px-5 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Total</th>
                                <th className="px-5 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Líneas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {settlements.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-5 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">{s.code}</td>
                                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                                        {new Date(s.periodStart).toLocaleDateString('es-VE')} —{' '}
                                        {new Date(s.periodEnd).toLocaleDateString('es-VE')}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status] ?? ''}`}>
                                            {STATUS_LABEL[s.status] ?? s.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                                        ${s.totalAmount.toFixed(2)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-gray-500">
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
