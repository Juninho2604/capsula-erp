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
 * §106 — Guardián de versión de build: además del ciclo de vida del SW
 * (que solo se dispara si cambia sw.js, cosa que los deploys normales NO
 * hacen), polleamos /api/version cada pocos minutos y al volver la app a
 * primer plano. Si el BUILD_ID del servidor cambió respecto al que vimos
 * al cargar, recargamos con la misma lógica "cuando sea seguro". Esto
 * elimina la clase de bug de tablets sirviendo bundle viejo contra server
 * nuevo (incidente TAB-3691/TAB-3690, 12/07/2026: historial renderizaba
 * "10% SERV: No" con la BD correcta).
 *
 * Solo en producción. En dev se desregistra cualquier SW previo y
 * /api/version devuelve 'dev' constante (nunca dispara reload).
 */

const VERSION_POLL_MS = 5 * 60 * 1000; // 5 minutos

function safeToReload(): boolean {
    const active = document.activeElement as HTMLElement | null;
    const isTyping = !!active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable
    );
    // Modales shadcn (role/data-state) + modales POS estándar (backdrop
    // `fixed inset-0`, patrón CLAUDE.md §7). Si hay uno abierto, la cajera
    // puede estar en medio de un cobro — no recargamos.
    const hasOpenModal = document.querySelector(
        '[role="dialog"], [data-state="open"], div.fixed.inset-0'
    );
    return !isTyping && !hasOpenModal;
}

function makeReloadWhenSafe() {
    let refreshing = false;
    return () => {
        if (refreshing) return;
        refreshing = true;
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
}

export function PWARegister() {
    // ── Service Worker: registro + auto-update por ciclo de vida ─────────
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

        const reloadWhenSafe = makeReloadWhenSafe();

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

    // ── §106 Guardián de versión: pollear /api/version y recargar ────────
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (process.env.NODE_ENV === 'development') return;

        const reloadWhenSafe = makeReloadWhenSafe();
        let knownBuildId: string | null = null;
        let stopped = false;

        const check = async () => {
            if (stopped) return;
            try {
                const res = await fetch('/api/version', { cache: 'no-store' });
                if (!res.ok) return;
                const body = (await res.json()) as { buildId?: string };
                const serverBuildId = body?.buildId;
                if (!serverBuildId || serverBuildId === 'dev') return;
                if (knownBuildId === null) {
                    knownBuildId = serverBuildId;
                    return;
                }
                if (serverBuildId !== knownBuildId) {
                    console.info(
                        `[PWA] Build nuevo en servidor (${knownBuildId} → ${serverBuildId}), recargando…`
                    );
                    stopped = true;
                    reloadWhenSafe();
                }
            } catch {
                // Sin red / error transitorio: silencio, se reintenta en el
                // próximo ciclo. La cinta offline ya avisa al usuario.
            }
        };

        check();
        const interval = setInterval(check, VERSION_POLL_MS);

        // Tablets que duermen toda la noche: al volver a primer plano,
        // chequear de una vez en lugar de esperar el próximo tick.
        const onVisible = () => {
            if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            stopped = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    return null;
}
