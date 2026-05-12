'use client';

import { useEffect } from 'react';

/**
 * Supresor global de errores de red en el cliente.
 *
 * Cubre el caso donde server actions o fetches en background fallan
 * durante offline sin try/catch (polling, useEffect IIFE, refresh
 * automático, etc.). Sin esta defensa, Next.js los muestra como
 * "Application error: a client-side exception has occurred" y rompe
 * toda la pantalla.
 *
 * Filtramos por patrón de mensaje (`NETWORK_ERROR_PATTERNS`) — NUNCA
 * suprimimos errores reales de lógica. Cuando matchea, hacemos
 * `event.preventDefault()` para que el navegador no escale al error
 * boundary global.
 *
 * **Debe montarse en root layout** (no en dashboard/layout) para que
 * los listeners estén activos antes de que cualquier ruta hija renderice
 * y potencialmente lance una excepción durante el primer paint.
 *
 * NO renderiza nada visualmente. Solo registra event listeners.
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
    /err_name_not_resolved/i,
    /unexpected end of (?:json|stream)/i,  // server action devuelve HTML offline → parse falla
    /not valid json/i,
    /unexpected token .* in json/i,
];

function isNetworkError(reason: unknown): boolean {
    if (!reason) return false;
    const msg = reason instanceof Error ? reason.message : String(reason);
    return NETWORK_ERROR_PATTERNS.some((re) => re.test(msg));
}

export function NetworkErrorSuppressor() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            if (isNetworkError(event.reason)) {
                event.preventDefault();
                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[network-suppressor] suppressed:', event.reason);
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

    return null;
}
