'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';

/**
 * Error boundary del segmento /dashboard.
 *
 * Next.js invoca este componente cuando cualquier ruta hija
 * (`/dashboard/pos/mesero`, etc.) lanza un error que escapa a los
 * `try/catch` locales. Sin este archivo, el error sube al
 * `global-error.tsx` y muestra una pantalla blanca de error.
 *
 * Estrategia:
 *  - Si el error es de red (`Failed to fetch`, etc.): mostramos una
 *    pantalla amigable "Sin conexión" y AUTO-RESET cuando vuelve la red.
 *    Esto es el caso más común durante offline — un server action o
 *    fetch en background falló sin try/catch y subió hasta acá. Al
 *    volver la red, `reset()` re-renderiza el segmento.
 *  - Si es otro tipo de error: mostramos un fallback similar al
 *    global-error.tsx (icono coral, "Algo salió mal", Reintentar +
 *    Recargar) pero conservando el layout del dashboard.
 *
 * IMPORTANTE: este archivo NO sustituye al `try/catch` local. Cada
 * server action invocada en background sigue debiendo estar envuelta
 * — este boundary es el last resort para errores que se escapan.
 */

const NETWORK_ERROR_PATTERNS = [
    /failed to fetch/i,
    /network error/i,
    /networkerror/i,
    /load failed/i,
    /connection (?:refused|reset|closed)/i,
    /the operation was aborted/i,
    /^abort/i,
    /timeout/i,
    /err_internet_disconnected/i,
    /err_network_changed/i,
    /err_name_not_resolved/i,
    /unexpected end of (?:json|stream)/i,
    /not valid json/i,
    /unexpected token .* in json/i,
];

function isNetworkError(error: Error | null | undefined): boolean {
    if (!error) return false;
    const msg = error.message ?? String(error);
    return NETWORK_ERROR_PATTERNS.some((re) => re.test(msg));
}

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { state } = useOnlineStatus();
    const [isRetrying, setIsRetrying] = useState(false);
    const networkError = isNetworkError(error);

    // Log para depuración en dev.
    useEffect(() => {
        console.error('[dashboard-error]', error);
    }, [error]);

    // Auto-reset cuando vuelve la red, solo para errores de red.
    useEffect(() => {
        if (!networkError) return;
        if (state === 'online') {
            const t = setTimeout(() => {
                setIsRetrying(true);
                reset();
            }, 800);
            return () => clearTimeout(t);
        }
    }, [networkError, state, reset]);

    const handleManualRetry = () => {
        setIsRetrying(true);
        reset();
    };

    if (networkError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-capsula-ivory">
                <div className="max-w-md w-full bg-white border border-capsula-line rounded-3xl p-8 text-center shadow-sm">
                    <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-[#F3EAD6] dark:bg-[#3B2F15] flex items-center justify-center">
                        <WifiOff className="h-7 w-7 text-[#946A1C] dark:text-[#E8D9B8]" />
                    </div>
                    <h1 className="text-xl font-semibold tracking-[-0.02em] text-capsula-ink mb-2">
                        Sin conexión
                    </h1>
                    <p className="text-sm text-capsula-ink-soft leading-relaxed mb-6">
                        Una acción no pudo completarse porque no hay internet.
                        Cuando vuelva la señal la pantalla se recupera sola.
                    </p>
                    <button
                        onClick={handleManualRetry}
                        disabled={isRetrying}
                        className="w-full py-3 rounded-xl bg-capsula-navy-deep text-capsula-cream font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                        {isRetrying ? 'Reintentando…' : 'Reintentar ahora'}
                    </button>
                    {state === 'offline' && (
                        <p className="text-[11px] text-capsula-ink-muted mt-4 uppercase tracking-[0.14em]">
                            Esperando red…
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Error no relacionado a red — mostramos detalle técnico colapsable
    // y opciones de recuperación.
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-capsula-ivory">
            <div className="max-w-md w-full bg-white border border-capsula-line rounded-3xl p-8 shadow-sm">
                <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-[#F7E3DB] dark:bg-[#3B1F14] flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B04A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <h1 className="text-xl font-semibold tracking-[-0.02em] text-capsula-ink mb-2 text-center">
                    Algo salió mal
                </h1>
                <p className="text-sm text-capsula-ink-soft leading-relaxed mb-6 text-center">
                    La aplicación encontró un error inesperado. Toca "Reintentar"
                    para volver a cargar esta pantalla.
                </p>
                <div className="space-y-2.5">
                    <button
                        onClick={handleManualRetry}
                        className="w-full py-3 rounded-xl bg-capsula-navy-deep text-capsula-cream font-semibold text-sm"
                    >
                        Reintentar
                    </button>
                    <button
                        onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
                        className="w-full py-2.5 rounded-xl border border-capsula-line text-capsula-ink font-medium text-sm"
                    >
                        Recargar completamente
                    </button>
                </div>
                {(error.message || error.digest) && (
                    <details className="mt-5 bg-capsula-ivory-alt border border-capsula-line rounded-xl px-3 py-2.5">
                        <summary className="text-xs text-capsula-ink-soft cursor-pointer font-medium list-none">
                            Detalle técnico (para soporte)
                        </summary>
                        {error.message && (
                            <p className="mt-2 text-xs font-mono text-capsula-ink break-words leading-snug">
                                {error.message}
                            </p>
                        )}
                        {error.digest && (
                            <p className="mt-1.5 text-[11px] font-mono text-capsula-ink-muted">
                                ref: {error.digest}
                            </p>
                        )}
                    </details>
                )}
            </div>
        </div>
    );
}
