import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getReservations } from '@/app/actions/games.actions';
import { CalendarDays, Check, Gamepad2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export const metadata = { title: 'Reservaciones | CAPSULA ERP' };

const STATUS_CONFIG: Record<string, { label: string; variant: 'warn' | 'info' | 'ok' | 'danger' | 'neutral' }> = {
    PENDING:    { label: 'Pendiente',      variant: 'warn' },
    CONFIRMED:  { label: 'Confirmada',     variant: 'info' },
    CHECKED_IN: { label: 'Check-in',       variant: 'ok' },
    NO_SHOW:    { label: 'No se presentó', variant: 'danger' },
    CANCELLED:  { label: 'Cancelada',      variant: 'neutral' },
};

export default async function ReservationsPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'].includes(session.role)) {
        redirect('/dashboard');
    }

    const today = new Date();
    const reservations = await getReservations({ date: today });

    const activeReservations = reservations.filter(r =>
        ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status)
    );
    const passedReservations = reservations.filter(r =>
        ['NO_SHOW', 'CANCELLED'].includes(r.status)
    );

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Servicio</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Reservaciones</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        <span className="font-mono">{activeReservations.length}</span> activa{activeReservations.length !== 1 ? 's' : ''} para hoy ·{' '}
                        {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
            </div>

            {activeReservations.length === 0 && passedReservations.length === 0 ? (
                <div className="rounded-[var(--radius)] border border-dashed border-capsula-line p-12 text-center">
                    <CalendarDays className="mx-auto h-10 w-10 text-capsula-ink-muted/50" strokeWidth={1.25} />
                    <p className="mt-2 text-[13px] font-medium text-capsula-ink-soft">
                        Sin reservaciones para hoy
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {[...activeReservations, ...passedReservations].map(r => {
                        const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.PENDING;
                        const rowStyles =
                            r.status === 'CHECKED_IN'
                                ? 'border-[#2F6B4E]/30 bg-[#E5EDE7]/40'
                                : r.status === 'CANCELLED' || r.status === 'NO_SHOW'
                                ? 'border-capsula-line bg-capsula-ivory-alt/40 opacity-60'
                                : 'border-capsula-line bg-capsula-ivory-surface';

                        return (
                            <div
                                key={r.id}
                                className={`flex items-center gap-4 rounded-[var(--radius)] border px-5 py-3 transition-colors ${rowStyles}`}
                            >
                                <span className="text-2xl">{r.station.gameType.icon ?? <Gamepad2 className="h-5 w-5 text-capsula-ink-soft inline" strokeWidth={1.5} />}</span>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-capsula-ink">{r.customerName}</p>
                                        {r.customerPhone && (
                                            <span className="font-mono text-[11px] text-capsula-ink-muted">{r.customerPhone}</span>
                                        )}
                                    </div>
                                    <p className="text-[12.5px] text-capsula-ink-soft">
                                        {r.station.name} · <span className="font-mono">{r.guestCount}</span> persona{r.guestCount !== 1 ? 's' : ''}
                                        {r.wristbandPlan && ` · ${r.wristbandPlan.name}`}
                                    </p>
                                </div>

                                <div className="shrink-0 text-right">
                                    <p className="font-mono text-[13px] font-semibold text-capsula-navy-deep">
                                        {new Date(r.scheduledStart).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                        {' — '}
                                        {new Date(r.scheduledEnd).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    {r.depositAmount > 0 && (
                                        <p className={`flex items-center justify-end gap-1 text-[11px] font-mono ${r.depositPaid ? 'text-[#2F6B4E]' : 'text-[#946A1C]'}`}>
                                            Depósito ${r.depositAmount.toFixed(2)} {r.depositPaid ? <Check className="h-3 w-3" strokeWidth={2} /> : '(pendiente)'}
                                        </p>
                                    )}
                                </div>

                                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
