'use client';

/**
 * §167 — La pestaña activa del módulo, en la URL y en el historial.
 *
 * Reemplaza a `useState<ViewMode>('orders')`. Misma forma de uso, pero además:
 *
 *   - «Atrás» vuelve a la pestaña anterior en vez de sacar del módulo.
 *   - «Adelante» rehace el camino.
 *   - Refrescar o compartir el enlace cae en la misma pantalla.
 *
 * Usa el History API nativo (soportado por el App Router desde Next 14.1), no
 * `router.push`: cambiar de pestaña es navegación del cliente y no debe
 * disparar una vuelta al servidor en pantallas `force-dynamic`.
 */

import { useCallback, useEffect, useState } from 'react';
import { parseViewParam, buildViewSearch } from '@/lib/navigation/view-param';

export function useViewParam<T extends string>(
    valid: readonly T[],
    fallback: T,
    key = 'v',
): [T, (next: T) => void] {
    // Arranca en la vista de entrada para que servidor y cliente pinten igual;
    // la URL se lee en el efecto de abajo (en el servidor no hay `window`).
    const [view, setView] = useState<T>(fallback);

    useEffect(() => {
        const sync = () => setView(parseViewParam(window.location.search, key, valid, fallback));
        sync();
        // «Atrás» y «adelante» del navegador — el gesto del teléfono incluido.
        window.addEventListener('popstate', sync);
        return () => window.removeEventListener('popstate', sync);
        // `valid` suele ser un literal recreado en cada render: se compara por
        // contenido para no re-suscribir el listener en cada pasada.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, fallback, valid.join('|')]);

    const go = useCallback((next: T) => {
        setView(next);
        if (typeof window === 'undefined') return;
        try {
            const search = buildViewSearch(window.location.search, key, next, fallback);
            // pushState y no replaceState: cada pestaña es un paso atrás.
            window.history.pushState(null, '', `${window.location.pathname}${search}`);
        } catch {
            // Si el historial falla, la pantalla igual cambia de vista.
        }
    }, [key, fallback]);

    return [view, go];
}
