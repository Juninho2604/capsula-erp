'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

/**
 * Registra el Service Worker de Cápsula y muestra un toast cuando hay una
 * versión nueva disponible para que el usuario active la actualización con
 * un click. Sin click, la nueva versión activa al cerrar todas las pestañas.
 *
 * Solo se ejecuta en producción y en navegadores con soporte. En dev se
 * desregistra cualquier SW previo para no servir HTML cacheado mientras
 * iteramos.
 */
export function PWARegister() {
    const promptedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator)) return;

        const isDev = process.env.NODE_ENV === 'development';

        if (isDev) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.unregister());
            });
            return;
        }

        const onLoad = async () => {
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none',
                });

                // Si ya hay un SW esperando al cargar (pestañas previas con la
                // versión vieja), pedir activación inmediata.
                if (reg.waiting) {
                    promptUpdate(reg);
                }

                reg.addEventListener('updatefound', () => {
                    const installing = reg.installing;
                    if (!installing) return;
                    installing.addEventListener('statechange', () => {
                        if (
                            installing.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            promptUpdate(reg);
                        }
                    });
                });

                // Cuando el SW nuevo toma control, recargar para garantizar
                // que la app corre contra los assets nuevos.
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                });
            } catch (err) {
                // Falló registrar SW — la app sigue funcionando sin PWA.
                console.warn('[PWA] No se pudo registrar Service Worker:', err);
            }
        };

        function promptUpdate(reg: ServiceWorkerRegistration) {
            if (promptedRef.current) return;
            promptedRef.current = true;
            toast(
                (t) => (
                    <div className="flex items-center gap-3">
                        <span className="text-sm">Nueva versión disponible</span>
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
                            }}
                            className="rounded-lg bg-capsula-navy-deep px-3 py-1 text-xs font-semibold text-capsula-cream"
                        >
                            Actualizar
                        </button>
                    </div>
                ),
                { duration: Infinity, id: 'pwa-update' }
            );
        }

        if (document.readyState === 'complete') {
            onLoad();
        } else {
            window.addEventListener('load', onLoad, { once: true });
        }
    }, []);

    return null;
}
