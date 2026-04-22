import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getQueueTickets } from '@/app/actions/games.actions';
import { Ticket, Bell } from 'lucide-react';

export const metadata = { title: 'Cola de Espera | CAPSULA ERP' };

export default async function QueuePage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'].includes(session.role)) {
        redirect('/dashboard');
    }

    const tickets = await getQueueTickets(['WAITING', 'CALLED']);

    const waiting = tickets.filter(t => t.status === 'WAITING');
    const called  = tickets.filter(t => t.status === 'CALLED');

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <Ticket className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Servicio</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Cola de espera</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        <span className="font-mono">{waiting.length}</span> en espera · <span className="font-mono">{called.length}</span> llamado{called.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {called.length > 0 && (
                <div>
                    <h2 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#946A1C]">
                        <Bell className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Llamados — pasen a su estación
                    </h2>
                    <div className="space-y-2">
                        {called.map(t => (
                            <div
                                key={t.id}
                                className="flex items-center gap-4 rounded-[var(--radius)] border border-[#946A1C]/30 bg-[#F3EAD6]/40 px-5 py-3"
                            >
                                <span className="font-mono text-[22px] font-semibold text-[#946A1C]">#{t.ticketNumber}</span>
                                <div className="flex-1">
                                    <p className="font-medium text-capsula-ink">{t.customerName}</p>
                                    <p className="text-[12.5px] text-capsula-ink-soft">
                                        <span className="font-mono">{t.guestCount}</span> persona{t.guestCount !== 1 ? 's' : ''} ·{' '}
                                        {t.station?.name ?? 'Cualquier estación'}
                                    </p>
                                </div>
                                {t.calledAt && (
                                    <span className="font-mono text-[11px] text-[#946A1C]">
                                        Llamado{' '}
                                        {new Date(t.calledAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                                <span className="animate-pulse rounded-full bg-[#946A1C] px-3 py-1 text-[11px] font-medium tracking-wide text-capsula-ivory-surface">
                                    LLAMADO
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                    En espera
                </h2>
                {waiting.length === 0 ? (
                    <div className="rounded-[var(--radius)] border border-dashed border-capsula-line p-8 text-center">
                        <Ticket className="mx-auto h-8 w-8 text-capsula-ink-muted/50" strokeWidth={1.25} />
                        <p className="mt-1 text-[13px] text-capsula-ink-soft">Cola vacía — sin espera activa</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {waiting.map((t, idx) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-5 py-3 shadow-cap-soft"
                            >
                                <span className="w-8 text-center font-mono text-[15px] font-semibold text-capsula-ink-muted/60">
                                    {idx + 1}
                                </span>
                                <span className="font-mono text-[13px] font-semibold text-capsula-ink-soft">
                                    #{t.ticketNumber}
                                </span>
                                <div className="flex-1">
                                    <p className="font-medium text-capsula-ink">{t.customerName}</p>
                                    <p className="text-[12.5px] text-capsula-ink-soft">
                                        <span className="font-mono">{t.guestCount}</span> persona{t.guestCount !== 1 ? 's' : ''}{' '}
                                        {t.station ? `· ${t.station.name}` : ''}
                                    </p>
                                </div>
                                {t.estimatedWaitMinutes != null && t.estimatedWaitMinutes > 0 && (
                                    <span className="font-mono text-[12px] text-capsula-ink-muted">
                                        ~{t.estimatedWaitMinutes} min
                                    </span>
                                )}
                                <span className="font-mono text-[11px] text-capsula-ink-muted">
                                    {new Date(t.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
