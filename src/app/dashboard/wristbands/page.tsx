import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getWristbandPlans } from '@/app/actions/games.actions';

export const metadata = { title: 'Planes de Pulsera | CAPSULA ERP' };

export default async function WristbandsPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        redirect('/dashboard');
    }

    const plans = await getWristbandPlans();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Planes de pulsera</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    {plans.length} plan{plans.length !== 1 ? 'es' : ''} activo{plans.length !== 1 ? 's' : ''}
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map(plan => {
                    const hours   = Math.floor(plan.durationMinutes / 60);
                    const minutes = plan.durationMinutes % 60;

                    return (
                        <div
                            key={plan.id}
                            className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                            style={plan.color ? { borderTopColor: plan.color, borderTopWidth: 4 } : {}}
                        >
                            <div className="p-5">
                                <div className="mb-4 flex items-center gap-3">
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white shadow"
                                        style={{ backgroundColor: plan.color ?? '#6366f1' }}
                                    >
                                        ⌚
                                    </div>
                                    <div>
                                        <p className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">{plan.name}</p>
                                        <p className="text-xs text-gray-400 font-mono">{plan.code}</p>
                                    </div>
                                </div>

                                {plan.description && (
                                    <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                                        <span className="text-sm text-gray-500">Duración</span>
                                        <span className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                                            {hours > 0 && `${hours}h `}{minutes > 0 && `${minutes}min`}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                                        <span className="text-sm text-gray-500">Precio</span>
                                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                            ${plan.price.toFixed(2)}
                                        </span>
                                    </div>
                                    {plan.maxSessions && (
                                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                                            <span className="text-sm text-gray-500">Máx. estaciones</span>
                                            <span className="font-medium">{plan.maxSessions}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                                        <span className="text-sm text-gray-500">Reservas usadas</span>
                                        <span className="font-medium">{plan._count.reservations}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {plans.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
                        <p className="text-4xl">⌚</p>
                        <p className="mt-2 font-medium text-gray-600 dark:text-gray-400">
                            No hay planes de pulsera configurados
                        </p>
                        <p className="text-sm text-gray-400">
                            Crea el primer plan con precio y duración para empezar a usarlo en reservaciones.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
