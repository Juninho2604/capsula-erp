'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useOnlineStatus } from './use-online-status';

/**
 * Hook que bloquea acciones mutadoras cuando el cliente está offline.
 *
 * Uso típico:
 * ```tsx
 * const guardMutation = useOfflineGuard();
 *
 * <button onClick={() => guardMutation(() => sendOrderToKitchen(), {
 *   blockedMessage: 'Sin conexión — la orden no se puede enviar a cocina.'
 * })}>Enviar</button>
 * ```
 *
 * - Si está online: ejecuta el callback normal.
 * - Si está offline: muestra toast.error con el mensaje configurado y
 *   NO ejecuta el callback. Devuelve undefined.
 *
 * Devuelve también `isOffline` para que la UI pueda preventivamente
 * deshabilitar botones (mejor UX que dejar al usuario presionar y recibir
 * el toast).
 */
export function useOfflineGuard() {
    const { state } = useOnlineStatus();
    const isOffline = state === 'offline';

    const guardMutation = useCallback(
        async <T,>(
            fn: () => Promise<T> | T,
            opts?: { blockedMessage?: string }
        ): Promise<T | undefined> => {
            if (isOffline) {
                toast.error(
                    opts?.blockedMessage ??
                        'Sin conexión. Intenta de nuevo cuando vuelva la señal.'
                );
                return undefined;
            }
            return await fn();
        },
        [isOffline]
    );

    return { guardMutation, isOffline };
}
