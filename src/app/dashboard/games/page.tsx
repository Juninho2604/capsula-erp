import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getGameStations, getActiveSessions, getGamesDashboardStats } from '@/app/actions/games.actions';

export const metadata = {
    title: 'Juegos | CAPSULA ERP',
    description: 'Gestión de estaciones de juego y sesiones activas',
};

const STATUS_CONFIG = {
    AVAILABLE:   { label: 'Disponible',   dot: '●', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
    IN_USE:      { label: 'En Uso',       dot: '●', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
    RESERVED:    { label: 'Reservado',    dot: '●', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    MAINTENANCE: { label: 'Mantenimiento',dot: '●', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
} as const;

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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="font-heading text-3xl tracking-[-0.02em] text-capsula-ink">
                        🎱 Juegos y Entretenimiento
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {stats.stationsAvailable} libre{stats.stationsAvailable !== 1 ? 's' : ''} ·{' '}
                        {stats.stationsOccupied} ocupad{stats.stationsOccupied !== 1 ? 'os' : 'o'} ·{' '}
                        {stats.reservationsToday} reserva{stats.reservationsToday !== 1 ? 's' : ''} hoy ·{' '}
                        {stats.queueWaiting} en cola
                    </p>
                </div>

                {/* Revenue today */}
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 dark:border-green-800 dark:bg-green-900/20">
                    <p className="text-xs text-green-600 dark:text-green-400">Facturado hoy</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">
                        ${stats.revenueToday.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Active sessions banner */}
            {activeSessions.length > 0 && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-700 dark:bg-purple-900/20">
                    <p className="mb-3 text-sm font-semibold text-purple-700 dark:text-purple-400">
                        Sesiones activas ({activeSessions.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {activeSessions.map(s => {
                            const elapsed = Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 60000);
                            return (
                                <div key={s.id} className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-gray-800">
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                        {s.station.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {s.customerName ?? 'Cliente'} · {elapsed}min
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Station grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {stations.map(station => {
                    const activeSession = station.sessions[0];
                    const cfg = STATUS_CONFIG[station.currentStatus as keyof typeof STATUS_CONFIG]
                        ?? STATUS_CONFIG.AVAILABLE;

                    const elapsed = activeSession
                        ? Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 60000)
                        : null;

                    return (
                        <div
                            key={station.id}
                            className={`rounded-xl border p-4 transition-all ${
                                activeSession
                                    ? 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20'
                                    : station.currentStatus === 'MAINTENANCE'
                                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                            }`}
                        >
                            {/* Station header */}
                            <div className="mb-3 flex items-start gap-2">
                                <span className="text-2xl">{station.gameType.icon ?? '🎮'}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold text-gray-900 dark:text-white">
                                        {station.name}
                                    </p>
                                    <p className="text-xs text-gray-400">{station.code}</p>
                                </div>
                            </div>

                            {/* Status pill */}
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                                {cfg.dot} {cfg.label}
                            </span>

                            {/* Active session info */}
                            {activeSession && elapsed !== null && (
                                <div className="mt-3 rounded-lg bg-white/60 p-2 text-xs dark:bg-black/20">
                                    <p className="font-medium text-gray-800 dark:text-gray-100">
                                        {activeSession.customerName ?? 'Cliente'}
                                    </p>
                                    <div className="mt-1 flex items-center justify-between text-gray-500">
                                        <span>
                                            {new Date(activeSession.startedAt).toLocaleTimeString('es-VE', {
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </span>
                                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                                            {elapsed >= 60
                                                ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}min`
                                                : `${elapsed}min`}
                                        </span>
                                    </div>
                                    {station.hourlyRate && (
                                        <p className="mt-0.5 text-right text-green-600 dark:text-green-400">
                                            ~${((elapsed / 60) * station.hourlyRate).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Hourly rate */}
                            {station.hourlyRate && !activeSession && (
                                <p className="mt-2 text-xs text-gray-400">
                                    ${station.hourlyRate.toFixed(2)}/hora
                                </p>
                            )}
                        </div>
                    );
                })}

                {stations.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
                        <p className="text-4xl">🎮</p>
                        <p className="mt-2 font-medium text-gray-600 dark:text-gray-400">
                            No hay estaciones configuradas
                        </p>
                        <p className="text-sm text-gray-400">
                            Inserta un <code className="font-mono">GameType</code> y{' '}
                            <code className="font-mono">GameStation</code> en la base de datos para comenzar.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
