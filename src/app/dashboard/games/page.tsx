import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getGameStations, getActiveSessions, getGamesDashboardStats } from '@/app/actions/games.actions';
import { Gamepad2, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export const metadata = {
    title: 'Juegos | CAPSULA ERP',
    description: 'Gestión de estaciones de juego y sesiones activas',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'ok' | 'coral' | 'warn' | 'danger' }> = {
    AVAILABLE:   { label: 'Disponible',    variant: 'ok' },
    IN_USE:      { label: 'En uso',        variant: 'coral' },
    RESERVED:    { label: 'Reservado',     variant: 'warn' },
    MAINTENANCE: { label: 'Mantenimiento', variant: 'danger' },
};

export default async function GamesPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        redirect('/dashboard');
    }

    const [stations, activeSessions, stats] = await Promise.all([
        getGameStations(),
        getActiveSessions(),
        getGamesDashboardStats(),
    ]);

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-capsula-line pb-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                        <Gamepad2 className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Entretenimiento</div>
                        <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Juegos y entretenimiento</h1>
                        <p className="mt-1 text-[13px] text-capsula-ink-soft">
                            <span className="font-mono">{stats.stationsAvailable}</span> libre{stats.stationsAvailable !== 1 ? 's' : ''} ·{' '}
                            <span className="font-mono">{stats.stationsOccupied}</span> ocupad{stats.stationsOccupied !== 1 ? 'os' : 'o'} ·{' '}
                            <span className="font-mono">{stats.reservationsToday}</span> reserva{stats.reservationsToday !== 1 ? 's' : ''} hoy ·{' '}
                            <span className="font-mono">{stats.queueWaiting}</span> en cola
                        </p>
                    </div>
                </div>

                <div className="rounded-[var(--radius)] border border-[#D3E2D8] bg-[#E5EDE7]/40 px-4 py-2">
                    <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-[#2F6B4E]">
                        <Coins className="h-3 w-3" strokeWidth={1.5} />
                        Facturado hoy
                    </p>
                    <p className="mt-0.5 font-mono text-[20px] font-semibold text-[#2F6B4E]">
                        ${stats.revenueToday.toFixed(2)}
                    </p>
                </div>
            </div>

            {activeSessions.length > 0 && (
                <div className="rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral/5 p-4">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-coral">
                        Sesiones activas <span className="font-mono">({activeSessions.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {activeSessions.map(s => {
                            const elapsed = Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 60000);
                            return (
                                <div key={s.id} className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 shadow-cap-soft">
                                    <p className="text-[12px] font-semibold text-capsula-ink">{s.station.name}</p>
                                    <p className="font-mono text-[11px] text-capsula-ink-muted">
                                        {s.customerName ?? 'Cliente'} · {elapsed}min
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {stations.map(station => {
                    const activeSession = station.sessions[0];
                    const cfg = STATUS_CONFIG[station.currentStatus] ?? STATUS_CONFIG.AVAILABLE;

                    const elapsed = activeSession
                        ? Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 60000)
                        : null;

                    const cardStyles = activeSession
                        ? 'border-capsula-coral/30 bg-capsula-coral/5'
                        : station.currentStatus === 'MAINTENANCE'
                        ? 'border-capsula-coral/20 bg-capsula-coral/5'
                        : 'border-capsula-line bg-capsula-ivory-surface';

                    return (
                        <div
                            key={station.id}
                            className={`rounded-[var(--radius)] border p-4 shadow-cap-soft transition-all ${cardStyles}`}
                        >
                            <div className="mb-3 flex items-start gap-2">
                                <span className="text-2xl">{station.gameType.icon ?? <Gamepad2 className="h-5 w-5 inline text-capsula-ink-soft" strokeWidth={1.5} />}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-heading text-[15px] text-capsula-navy-deep">
                                        {station.name}
                                    </p>
                                    <p className="font-mono text-[11px] text-capsula-ink-muted">{station.code}</p>
                                </div>
                            </div>

                            <Badge variant={cfg.variant}>{cfg.label}</Badge>

                            {activeSession && elapsed !== null && (
                                <div className="mt-3 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-2">
                                    <p className="text-[12px] font-medium text-capsula-ink">
                                        {activeSession.customerName ?? 'Cliente'}
                                    </p>
                                    <div className="mt-1 flex items-center justify-between">
                                        <span className="font-mono text-[11px] text-capsula-ink-muted">
                                            {new Date(activeSession.startedAt).toLocaleTimeString('es-VE', {
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </span>
                                        <span className="font-mono text-[12px] font-semibold text-capsula-coral">
                                            {elapsed >= 60
                                                ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}min`
                                                : `${elapsed}min`}
                                        </span>
                                    </div>
                                    {station.hourlyRate && (
                                        <p className="mt-0.5 text-right font-mono text-[11px] text-[#2F6B4E]">
                                            ~${((elapsed / 60) * station.hourlyRate).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}

                            {station.hourlyRate && !activeSession && (
                                <p className="mt-2 font-mono text-[11px] text-capsula-ink-muted">
                                    ${station.hourlyRate.toFixed(2)}/hora
                                </p>
                            )}
                        </div>
                    );
                })}

                {stations.length === 0 && (
                    <div className="col-span-full rounded-[var(--radius)] border border-dashed border-capsula-line p-12 text-center">
                        <Gamepad2 className="mx-auto h-10 w-10 text-capsula-ink-muted/50" strokeWidth={1.25} />
                        <p className="mt-2 font-medium text-capsula-ink-soft">
                            No hay estaciones configuradas
                        </p>
                        <p className="text-[12px] text-capsula-ink-muted">
                            Inserta un <code className="font-mono">GameType</code> y{' '}
                            <code className="font-mono">GameStation</code> en la base de datos para comenzar.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
