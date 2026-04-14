// ============================================================================
// CÁPSULA — useBranding Hook
// ============================================================================
// Hook React para acceder al branding del tenant actual.
// En multitenant, lee el branding del SystemConfig.
// Fallback: usa CAPSULA_BRAND defaults.
// ============================================================================

'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { CAPSULA_BRAND, getTenantBranding, type BrandColors } from '@/config/branding';

// En futuro multitenant, esto vendrá de un context provider
const CURRENT_TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_ID || 'capsula';

interface BrandingHook {
  /** Nombre del negocio/marca */
  name: string;
  /** Tagline principal */
  tagline: string;
  /** Tagline corto */
  taglineShort: string;
  /** Paleta de colores completa */
  colors: BrandColors;
  /** Tipografías */
  fonts: typeof CAPSULA_BRAND.fonts;
  /** Redes sociales */
  social: typeof CAPSULA_BRAND.social;
  /** Slug del tenant actual */
  tenantSlug: string;
  /** ¿Es la marca CÁPSULA por defecto o un tenant custom? */
  isDefault: boolean;
  /** Helper: obtener color primario del tenant */
  primaryColor: string;
  /** Helper: obtener color secundario del tenant */
  secondaryColor: string;
  /** Helper: obtener color accent del tenant */
  accentColor: string;
}

/**
 * Hook para acceder al branding del tenant actual
 * 
 * @example
 * ```tsx
 * function Header() {
 *   const { name, primaryColor, colors } = useBranding();
 *   return <h1 style={{ color: primaryColor }}>{name}</h1>;
 * }
 * ```
 */
export function useBranding(): BrandingHook {
  const branding = useMemo(() => {
    const brand = getTenantBranding(CURRENT_TENANT_SLUG);
    
    return {
      name: brand.name,
      tagline: brand.tagline,
      taglineShort: brand.taglineShort,
      colors: brand.colors,
      fonts: brand.fonts,
      social: brand.social,
      tenantSlug: CURRENT_TENANT_SLUG,
      isDefault: CURRENT_TENANT_SLUG === 'capsula',
      primaryColor: brand.colors.primary,
      secondaryColor: brand.colors.secondary,
      accentColor: brand.colors.accent,
    };
  }, []);

  return branding;
}

/**
 * Hook para obtener solo los colores del tenant
 * Útil para componentes que solo necesitan la paleta
 */
export function useBrandColors() {
  const { colors } = useBranding();
  return colors;
}

/**
 * Hook para generar estilos CSS inline basados en el branding
 * Útil para componentes que no pueden usar Tailwind
 */
export function useBrandStyles() {
  const { colors, fonts } = useBranding();

  return useMemo(() => ({
    primaryButton: {
      backgroundColor: colors.primary,
      color: '#FFFFFF',
      fontFamily: fonts.body,
      fontWeight: 600,
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
    } as CSSProperties,

    secondaryButton: {
      backgroundColor: 'transparent',
      color: colors.primary,
      fontFamily: fonts.body,
      fontWeight: 600,
      borderRadius: '10px',
      border: `2px solid ${colors.primary}`,
      cursor: 'pointer',
    } as CSSProperties,

    heading: {
      fontFamily: fonts.heading,
      fontWeight: 800,
      color: colors.secondary,
    } as CSSProperties,

    body: {
      fontFamily: fonts.body,
      color: colors.foreground,
    } as CSSProperties,

    card: {
      backgroundColor: colors.background,
      borderRadius: '12px',
      border: `1px solid ${colors.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    } as CSSProperties,

    warmSection: {
      backgroundColor: colors.backgroundWarm,
    } as CSSProperties,
  }), [colors, fonts]);
}

export default useBranding;
