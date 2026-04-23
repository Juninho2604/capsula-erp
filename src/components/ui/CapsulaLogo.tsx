'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'mark' | 'full' | 'favicon' | 'wordmark' | 'icon';

interface CapsulaLogoProps {
    variant?: Variant;
    size?: number;
    className?: string;
    tone?: 'default' | 'ivory' | 'navy';
}

/**
 * CÁPSULA logo — bicolor circle (navy top / coral bottom) + wordmark.
 * Minimal Navy direction.
 */
export default function CapsulaLogo({
    variant = 'full',
    size = 32,
    className,
    tone = 'default',
}: CapsulaLogoProps) {
    // 'default' usa la var --capsula-ink (dark en light, light en dark)
    // 'ivory' y 'navy' son fijos (para fondos específicos).
    const wordColor =
        tone === 'ivory' ? '#F7F5F0' : tone === 'navy' ? '#1B2A3A' : 'var(--capsula-ink)';

    const Mark = (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="flex-shrink-0"
        >
            <defs>
                <clipPath id={`cap-logo-clip-${size}`}>
                    <circle cx="12" cy="12" r="11" />
                </clipPath>
            </defs>
            <g clipPath={`url(#cap-logo-clip-${size})`}>
                <rect x="0" y="0" width="24" height="12" fill="#1B2A3A" />
                <rect x="0" y="12" width="24" height="12" fill="#F25C3B" />
            </g>
        </svg>
    );

    if (variant === 'mark' || variant === 'favicon' || variant === 'icon') {
        return <span className={cn('inline-flex', className)}>{Mark}</span>;
    }

    if (variant === 'wordmark') {
        return (
            <span
                className={cn('inline-flex items-center', className)}
                style={{
                    fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    fontSize: Math.round(size * 0.5),
                    color: wordColor,
                }}
            >
                CÁPSULA
            </span>
        );
    }

    return (
        <span className={cn('inline-flex items-center gap-2.5', className)}>
            {Mark}
            <span
                style={{
                    fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    fontSize: Math.max(12, Math.round(size * 0.5)),
                    color: wordColor,
                    lineHeight: 1,
                }}
            >
                CÁPSULA
            </span>
        </span>
    );
}

// ─── Back-compat shims ───────────────────────────────────────
// Mantienen la API previa (CapsulaIsotipo / CapsulaNavbarLogo /
// CapsulaLogoDark / CapsulaLogoHero) para no romper consumidores
// existentes (p. ej. Sidebar.tsx).

/** Solo el mark (círculo bicolor). Reemplazo del antiguo isotipo. */
export function CapsulaIsotipo({
    size = 48,
    className,
}: {
    size?: number;
    className?: string;
    color?: string;
    barColor?: string;
}) {
    return <CapsulaLogo variant="mark" size={size} className={className} />;
}

/** Logo para navbar (tamaño optimizado). */
export function CapsulaNavbarLogo({ className = '' }: { className?: string }) {
    return <CapsulaLogo variant="full" size={36} className={className} />;
}

/** Logo para fondo oscuro (texto ivory). */
export function CapsulaLogoDark({
    size,
    className = '',
}: {
    size?: number;
    className?: string;
}) {
    return <CapsulaLogo variant="full" size={size ?? 32} tone="ivory" className={className} />;
}

/** Logo para splash/loading screen. */
export function CapsulaLogoHero({ className = '' }: { className?: string }) {
    return <CapsulaLogo variant="full" size={96} className={className} />;
}
