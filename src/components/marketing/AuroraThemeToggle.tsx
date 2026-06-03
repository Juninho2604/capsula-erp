'use client';

/**
 * Toggle de tema (light / dark) específico para la landing y páginas
 * marketing. Estética minimalista alineada con el lenguaje Aurora del
 * marketing (botón circular pequeño, ícono Sun/Moon, hover suave).
 *
 * Comparte el mismo provider `next-themes` que el dashboard, así que el
 * cambio se sincroniza con el resto de la app: si el usuario navega del
 * marketing al dashboard (login), el theme elegido se mantiene.
 *
 * Maneja la hidratación (next-themes no expone el tema en SSR para
 * evitar mismatch) renderizando un placeholder mientras `mounted`
 * es false.
 */

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export default function AuroraThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Antes de montar, render placeholder del mismo tamaño para evitar
    // saltos de layout y mismatch de hidratación.
    if (!mounted) {
        return (
            <div
                className="cap-theme-toggle"
                aria-hidden="true"
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    border: '1px solid var(--cap-hair)',
                    background: 'transparent',
                }}
            />
        );
    }

    const current = (resolvedTheme ?? theme ?? 'dark') as 'dark' | 'light';
    const isDark = current === 'dark';

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="cap-link inline-flex items-center justify-center transition-colors"
            style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: '1px solid var(--cap-hair-bright)',
                background:
                    'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            }}
        >
            {isDark ? (
                <Sun className="h-4 w-4" strokeWidth={1.6} />
            ) : (
                <Moon className="h-4 w-4" strokeWidth={1.6} />
            )}
        </button>
    );
}
