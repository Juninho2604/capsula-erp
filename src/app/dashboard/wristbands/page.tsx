import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getWristbandPlans } from '@/app/actions/games.actions';
import { Watch } from 'lucide-react';

export const metadata = { title: 'Planes de Pulsera | CAPSULA ERP' };

export default async function WristbandsPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        redirect('/dashboard');
    }

    const plans = await getWristbandPlans();

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <Watch className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Servicio</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Planes de pulsera</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        <span className="font-mono">{plans.length}</span> plan{plans.length !== 1 ? 'es' : ''} activo{plans.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map(plan => {
                    const hours   = Math.floor(plan.durationMinutes / 60);
                    const minutes = plan.durationMinutes % 60;

                    return (
                        <div
                            key={plan.id}
                            className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft"
                            style={plan.color ? { borderTopColor: plan.color, borderTopWidth: 4 } : {}}
                        >
                            <div className="p-5">
                                <div className="mb-4 flex items-center gap-3">
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-full text-capsula-ivory-surface shadow-cap-soft"
                                        style={{ backgroundColor: plan.color ?? '#11203A' }}
                                    >
                                        <Watch className="h-4 w-4" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <p className="font-heading text-[15px] text-capsula-navy-deep">{plan.name}</p>
                                        <p className="font-mono text-[11px] text-capsula-ink-muted">{plan.code}</p>
                                    </div>
                                </div>

                                {plan.description && (
                                    <p className="mb-3 text-[13px] text-capsula-ink-soft">{plan.description}</p>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between rounded-[var(--radius)] bg-capsula-ivory-alt/60 px-3 py-2">
                                        <span className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Duración</span>
                                        <span className="font-mono text-[13px] font-semibold text-capsula-navy-deep">
                                            {hours > 0 && `${hours}h `}{minutes > 0 && `${minutes}min`}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-[var(--radius)] bg-capsula-ivory-alt/60 px-3 py-2">
                                        <span className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Precio</span>
                                        <span className="font-mono text-[16px] font-semibold text-[#2F6B4E]">
                                            ${plan.price.toFixed(2)}
                                        </span>
                                    </div>
                                    {plan.maxSessions && (
                                        <div className="flex items-center justify-between rounded-[var(--radius)] bg-capsula-ivory-alt/60 px-3 py-2">
                                            <span className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Máx. estaciones</span>
                                            <span className="font-mono text-[13px] text-capsula-ink">{plan.maxSessions}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between rounded-[var(--radius)] bg-capsula-ivory-alt/60 px-3 py-2">
                                        <span className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Reservas usadas</span>
                                        <span className="font-mono text-[13px] text-capsula-ink">{plan._count.reservations}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {plans.length === 0 && (
                    <div className="col-span-full rounded-[var(--radius)] border border-dashed border-capsula-line p-12 text-center">
                        <Watch className="mx-auto h-10 w-10 text-capsula-ink-muted/50" strokeWidth={1.25} />
                        <p className="mt-2 font-medium text-capsula-ink-soft">
                            No hay planes de pulsera configurados
                        </p>
                        <p className="text-[12px] text-capsula-ink-muted">
                            Crea el primer plan con precio y duración para empezar a usarlo en reservaciones.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
