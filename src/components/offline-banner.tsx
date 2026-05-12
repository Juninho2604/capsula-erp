'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';

/**
 * Patrones de errores que indican fallo de red al hacer fetch desde el
 * cliente — incluye Server Actions Next.js, fetch directo y abort signals.
 *
 * Cuando estamos offline, estos rechazos son ruido esperado: cualquier
 * polling o background task que no envolvimos en try/catch caería en uno
 * de estos. Sin filtrar, Next.js los muestra como "Application error:
 * a client-side exception has occurred" y rompe la pantalla del POS.
 *
 * Filtramos por mensaje (no por isOffline) porque también queremos cubrir
 * el caso de blips muy cortos (1-2s) donde la red está caída pero el
 * detector todavía no marcó offline.
 */
const NETWORK_ERROR_PATTERNS = [
    /failed to fetch/i,
    /network error/i,
    /networkerror/i,
    /load failed/i,             // Safari / WebKit
    /connection (?:refused|reset|closed)/i,
    /the operation was aborted/i,
    /^abort/i,
    /timeout/i,
    /err_internet_disconnected/i,
    /err_network_changed/i,
];

function isNetworkError(reason: unknown): boolean {
    if (!reason) return false;
    const msg = reason instanceof Error ? reason.message : String(reason);
    return NETWORK_ERROR_PATTERNS.some((re) => re.test(msg));
}

/**
 * Banner global de estado de red. Se renderiza al tope de la página y
 * solo aparece cuando hay que decir algo:
 *  - Sin conexión: cinta amarilla persistente "Sin conexión — modo lectura".
 *  - Reconexión: cinta verde durante 3s "Conexión restaurada" y desaparece.
 *
 * No muestra nada cuando el estado es 'unknown' (justo al arrancar) ni
 * cuando lleva tiempo online — para no agregar ruido visual permanente.
 *
 * Diseño Minimal Navy: tonos sutiles autorizados (warn amarillo, ok verde)
 * según CLAUDE.md §3.
 */
export function OfflineBanner() {
    const { state } = useOnlineStatus();
    const [showReconnected, setShowReconnected] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        if (state === 'offline') {
            setWasOffline(true);
            setShowReconnected(false);
        } else if (state === 'online' && wasOffline) {
            setShowReconnected(true);
            setWasOffline(false);
            const t = setTimeout(() => setShowReconnected(false), 3000);
            return () => clearTimeout(t);
        }
    }, [state, wasOffline]);

    /**
     * Defensa global contra crashes "Application error: client-side
     * exception" causados por server actions o fetches que fallan
     * durante offline sin try/catch.
     *
     * Solo suprimimos rechazos cuyo mensaje claramente es de red — NO
     * ocultamos errores reales de lógica de aplicación. Patrones en
     * NETWORK_ERROR_PATTERNS arriba.
     *
     * Listeners registrados una sola vez: este componente vive en
     * dashboard/layout.tsx por lo que se monta una vez por sesión.
     */
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            if (isNetworkError(event.reason)) {
                event.preventDefault();
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[offline-banner] suppressed network rejection:', event.reason);
                }
            }
        };
        const onError = (event: ErrorEvent) => {
            if (isNetworkError(event.error) || isNetworkError(event.message)) {
                event.preventDefault();
            }
        };
        window.addEventListener('unhandledrejection', onUnhandledRejection);
        window.addEventListener('error', onError);
        return () => {
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
            window.removeEventListener('error', onError);
        };
    }, []);

    if (state === 'offline') {
        return (
            <div
                role="status"
                aria-live="polite"
                className="fixed inset-x-0 top-0 z-[80] bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.14em] shadow-sm"
            >
                <span className="inline-flex items-center gap-2">
                    <WifiOff className="h-3.5 w-3.5" />
                    Sin conexión — modo lectura
                </span>
            </div>
        );
    }

    if (showReconnected) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="fixed inset-x-0 top-0 z-[80] bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.14em] shadow-sm"
            >
                <span className="inline-flex items-center gap-2">
                    <Wifi className="h-3.5 w-3.5" />
                    Conexión restaurada
                </span>
            </div>
        );
    }

    return null;
}
