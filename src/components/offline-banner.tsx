'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';

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
 *
 * NOTA: el supresor global de errores de red vive ahora en
 * <NetworkErrorSuppressor /> montado en root layout, NO aquí. Aquí solo
 * UI del banner.
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
