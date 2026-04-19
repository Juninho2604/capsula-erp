// ============================================================================
// CÁPSULA — Logo Component
// ============================================================================
// Concepto: Barras modulares dentro de forma cápsula
// Variantes: full (isotipo + texto), icon (isotipo solo), favicon (mínimo)
//
// Uso:
//   <CapsulaLogo />                          → logotipo completo
//   <CapsulaLogo variant="icon" />           → isotipo solo
//   <CapsulaLogo variant="favicon" />        → favicon 32px
//   <CapsulaLogo color="white" />            → sobre fondo oscuro
//   <CapsulaLogo size={64} />                → tamaño custom
// ============================================================================

'use client';

import React from 'react';
import { CAPSULA_BRAND, type LogoVariant } from '@/config/branding';

interface CapsulaLogoProps {
  variant?: LogoVariant;
  size?: number;
  color?: string;
  className?: string;
  /** Mostrar texto al lado del isotipo (solo variant="full") */
  showText?: boolean;
  /** Color del texto (solo variant="full") */
  textColor?: string;
  /** Color de las barras internas. Por defecto contrasta automáticamente con `color` */
  barColor?: string;
}

/** Detecta si un color se consideraría "claro" para calcular contraste */
function isLightColor(c: string): boolean {
  const light = ['white', '#fff', '#ffffff', 'rgb(255,255,255)'];
  return light.includes(c.toLowerCase().replace(/\s/g, ''));
}

/**
 * Isotipo: Barras modulares dentro de forma cápsula (pill shape)
 * 3 barras de diferente altura representan los módulos del ERP
 */
function CapsulaIsotipo({
  color = CAPSULA_BRAND.colors.primary,
  size = 48,
  barColor,
}: {
  color?: string;
  size?: number;
  barColor?: string;
}) {
  // Si el pill es blanco, las barras usan coral para ser visibles.
  // Si el pill es oscuro/coral, las barras usan blanco (comportamiento original).
  const resolvedBarColor = barColor ?? (isLightColor(color) ? CAPSULA_BRAND.colors.primary : 'white');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CÁPSULA logo"
      role="img"
    >
      {/* Cápsula (pill shape) */}
      <rect x="8" y="16" width="48" height="32" rx="16" fill={color} />
      {/* Barra izquierda — módulo 1 */}
      <rect x="22" y="24" width="6" height="16" rx="3" fill={resolvedBarColor} opacity="0.9" />
      {/* Barra central — módulo 2 (más alta) */}
      <rect x="32" y="20" width="6" height="24" rx="3" fill={resolvedBarColor} opacity="0.7" />
      {/* Barra derecha — módulo 3 */}
      <rect x="42" y="26" width="6" height="12" rx="3" fill={resolvedBarColor} opacity="0.5" />
    </svg>
  );
}

/**
 * Componente principal del logo CÁPSULA
 */
export default function CapsulaLogo({
  variant = 'full',
  size,
  color,
  className = '',
  showText = true,
  textColor,
  barColor,
}: CapsulaLogoProps) {
  const defaultSize = size || CAPSULA_BRAND.logo.sizes[variant] || 48;
  const logoColor = color || CAPSULA_BRAND.colors.primary;
  const labelColor = textColor || CAPSULA_BRAND.colors.secondary;

  // Favicon — isotipo ultra compacto
  if (variant === 'favicon') {
    return (
      <CapsulaIsotipo
        color={logoColor}
        size={defaultSize}
        barColor={barColor}
      />
    );
  }

  // Icon — isotipo solo
  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <CapsulaIsotipo
          color={logoColor}
          size={defaultSize}
          barColor={barColor}
        />
      </div>
    );
  }

  // Full — isotipo + texto "CÁPSULA"
  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label="CÁPSULA"
    >
      <CapsulaIsotipo
        color={logoColor}
        size={defaultSize}
        barColor={barColor}
      />
      {showText && (
        <span
          style={{
            fontFamily: CAPSULA_BRAND.fonts.heading,
            fontWeight: 800,
            fontSize: defaultSize * 0.55,
            color: labelColor,
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          CÁPSULA
        </span>
      )}
    </div>
  );
}

// ─── Subcomponentes exportados para uso directo ──────────────

/** Solo el isotipo SVG inline — para usar en emails, PDFs, etc. */
export { CapsulaIsotipo };

/** Logo para navbar (tamaño optimizado) */
export function CapsulaNavbarLogo({ className = '' }: { className?: string }) {
  return (
    <CapsulaLogo
      variant="full"
      size={CAPSULA_BRAND.logo.sizes.navbar}
      className={className}
    />
  );
}

/** Logo para fondo oscuro (colores invertidos) */
export function CapsulaLogoDark({
  size,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <CapsulaLogo
      variant="full"
      color="white"
      textColor="white"
      size={size}
      className={className}
    />
  );
}

/** Logo para splash/loading screen */
export function CapsulaLogoHero({ className = '' }: { className?: string }) {
  return (
    <CapsulaLogo
      variant="full"
      size={CAPSULA_BRAND.logo.sizes.hero}
      className={className}
    />
  );
}
