'use client';

import { useEffect } from 'react';

/**
 * Registra el Service Worker de Cápsula y aplica actualizaciones **de
 * forma automática y silenciosa**. Cuando detecta una versión nueva en
 * segundo plano, envía SKIP_WAITING al SW pendiente, espera el
 * controllerchange y recarga la página una sola vez.
 *
 * Por qué auto en lugar de prompt: el POS lo usan mesoneros que no
 * entienden de Service Workers. Un toast "Actualizar" que requiere tap
 * es fricción y se pierde con la cinta de "sin conexión" o un modal.
 *
 * Seguridad: solo recargamos cuando NO hay actividad activa del usuario
 * (sin input focuseado y sin modales abiertos). Si el mesonero está en
 * medio de tipear notas o agregar ítems, esperamos a que termine. El
 * carrito está persistido en IndexedDB (§37.5), así que aunque hubiera
 * un reload mid-orden el contexto se restaura.
 *
 * Solo en producción. En dev se desregistra cualquier SW previo.
 */
export function PWARegister() {
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

        let refreshing = false;
        const reloadWhenSafe = () => {
            if (refreshing) return;
            refreshing = true;
            const safeToReload = () => {
                const active = document.activeElement as HTMLElement | null;
                const isTyping = !!active && (
                    active.tagName === 'INPUT' ||
                    active.tagName === 'TEXTAREA' ||
                    active.isContentEditable
                );
                const hasOpenModal = document.querySelector('[role="dialog"], [data-state="open"]');
                return !isTyping && !hasOpenModal;
            };
            // Intentar recargar inmediato si es seguro. Si no, reintentar cada 5s
            // hasta que lo sea — hasta un máximo de 60s para no quedar atascado.
            let attempts = 0;
            const tryReload = () => {
                attempts += 1;
                if (safeToReload() || attempts > 12) {
                    window.location.reload();
                } else {
                    setTimeout(tryReload, 5000);
                }
            };
            tryReload();
        };

        const onLoad = async () => {
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none',
                });

                // Si ya hay un SW esperando al cargar (sesión previa que no
                // recargó), activarlo inmediatamente.
                if (reg.waiting && navigator.serviceWorker.controller) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                reg.addEventListener('updatefound', () => {
                    const installing = reg.installing;
                    if (!installing) return;
                    installing.addEventListener('statechange', () => {
                        // Solo auto-actualizamos cuando hay un controller previo
                        // (es decir, es un UPDATE, no la primera instalación).
                        if (
                            installing.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            installing.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });

                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    reloadWhenSafe();
                });

                // Forzar chequeo de actualizaciones cada 60 minutos mientras
                // la app está abierta — útil para tablets que se quedan
                // encendidas todo el servicio sin recargar.
                setInterval(() => {
                    reg.update().catch(() => {});
                }, 60 * 60 * 1000);
            } catch (err) {
                console.warn('[PWA] No se pudo registrar Service Worker:', err);
            }
        };

        if (document.readyState === 'complete') {
            onLoad();
        } else {
            window.addEventListener('load', onLoad, { once: true });
        }
    }, []);

    return null;
}
