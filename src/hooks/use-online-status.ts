'use client';

import { useEffect, useState } from 'react';
import {
    type NetworkState,
    getNetworkState,
    startNetworkMonitor,
    subscribeNetworkStatus,
} from '@/lib/offline-cache/network-status';

let monitorStartedGlobally = false;

/**
 * Hook React para conocer el estado de conectividad en cualquier
 * componente cliente. La primera invocación en la app arranca el
 * monitor global (idempotente).
 *
 * @returns Estado actual ('online' | 'offline' | 'unknown') y el
 *   timestamp en milisegundos de la última transición a offline (útil
 *   para mostrar "sin red desde hace X min").
 */
export function useOnlineStatus(): { state: NetworkState; sinceOffline: number | null } {
    const [state, setState] = useState<NetworkState>(() => getNetworkState());
    const [sinceOffline, setSinceOffline] = useState<number | null>(null);

    useEffect(() => {
        if (!monitorStartedGlobally) {
            startNetworkMonitor();
            monitorStartedGlobally = true;
        }
        const unsubscribe = subscribeNetworkStatus((next) => {
            setState((prev) => {
                if (prev !== 'offline' && next === 'offline') setSinceOffline(Date.now());
                if (prev === 'offline' && next === 'online') setSinceOffline(null);
                return next;
            });
        });
        return unsubscribe;
    }, []);

    return { state, sinceOffline };
}
