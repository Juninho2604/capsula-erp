'use client';

/**
 * Global error boundary de Next.js — captura errores que escapan a
 * cualquier error.tsx por debajo (incluido el root layout). Se renderiza
 * SIN el layout normal porque el layout mismo puede haber crashed.
 *
 * Reemplaza la pantalla blanca por defecto de Next.js que solo dice
 * "Application error: a client-side exception has occurred (see the
 * browser console for more information)" — la que el mesonero ve y no
 * sabe qué hacer.
 *
 * Branded Minimal Navy. Botón "Reintentar" usa Next.js reset() para
 * intentar re-renderizar sin recargar la página. Botón secundario
 * recarga completa (descartando cualquier estado React corrupto).
 *
 * IMPORTANTE: tiene que ser un `RootLayout` propio (con <html><body>)
 * porque sustituye al root layout cuando este falla.
 */

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        if (typeof console !== 'undefined') {
            // Log para que dev tools muestren el stack real.
            console.error('[global-error]', error);
        }
    }, [error]);

    return (
        <html lang="es">
            <body
                style={{
                    margin: 0,
                    minHeight: '100vh',
                    backgroundColor: '#F7F5F0',
                    color: '#1B2438',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                }}
            >
                <div
                    style={{
                        maxWidth: '420px',
                        width: '100%',
                        backgroundColor: 'white',
                        border: '1px solid rgba(27, 36, 56, 0.08)',
                        borderRadius: '24px',
                        padding: '32px 28px',
                        textAlign: 'center',
                        boxShadow: '0 4px 24px rgba(27, 36, 56, 0.06)',
                    }}
                >
                    <div
                        style={{
                            width: '56px',
                            height: '56px',
                            margin: '0 auto 20px',
                            borderRadius: '50%',
                            backgroundColor: '#F7E3DB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B04A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <h1
                        style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            letterSpacing: '-0.02em',
                            marginBottom: '8px',
                        }}
                    >
                        Algo salió mal
                    </h1>
                    <p
                        style={{
                            fontSize: '14px',
                            color: 'rgba(27, 36, 56, 0.7)',
                            lineHeight: 1.5,
                            marginBottom: '24px',
                        }}
                    >
                        La aplicación encontró un error inesperado. Toca "Reintentar"
                        para volver a cargar la pantalla anterior. Si el error vuelve,
                        recarga completa.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                            onClick={reset}
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: '#1B2438',
                                color: '#F7F5F0',
                                fontSize: '15px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Reintentar
                        </button>
                        <button
                            onClick={() => {
                                if (typeof window !== 'undefined') window.location.reload();
                            }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                border: '1px solid rgba(27, 36, 56, 0.12)',
                                backgroundColor: 'transparent',
                                color: '#1B2438',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            Recargar completamente
                        </button>
                    </div>
                    {error.digest && (
                        <p
                            style={{
                                fontSize: '11px',
                                color: 'rgba(27, 36, 56, 0.4)',
                                marginTop: '20px',
                                fontFamily: 'monospace',
                            }}
                        >
                            ref: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
