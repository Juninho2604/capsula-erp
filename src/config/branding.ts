// ============================================================================
// CÁPSULA — Brand Identity Configuration
// ============================================================================
// Archivo central de identidad visual de CÁPSULA.
// Todos los colores, tipografías, logos y textos del sistema se leen de aquí.
// Para multitenant: cada tenant puede override estos valores via SystemConfig.
// ============================================================================

export const CAPSULA_BRAND = {
  // ─── IDENTIDAD ─────────────────────────────────────────────
  name: 'CÁPSULA',
  tagline: 'El ERP inteligente para tu restaurante',
  taglineShort: 'Tu negocio, una cápsula',
  domain: 'capsulapp.com',
  email: 'hola@capsulapp.com',
  
  // ─── REDES SOCIALES ────────────────────────────────────────
  social: {
    handle: '@capsulapp',
    instagram: 'https://instagram.com/capsulapp',
    tiktok: 'https://tiktok.com/@capsulapp',
    facebook: 'https://facebook.com/capsulapp',
    x: 'https://x.com/capsulapp',
    linkedin: 'https://linkedin.com/company/capsulapp',
  },

  // ─── PALETA: CORAL ENERGY ─────────────────────────────────
  colors: {
    // Primarios
    primary: '#FF6B4A',         // Coral — botones, links, CTAs
    primaryHover: '#E85A3A',    // Coral oscuro — hover states
    primaryLight: '#FF8A6F',    // Coral claro — badges, highlights
    primarySubtle: '#FFF0EC',   // Coral ultra-sutil — backgrounds

    // Secundarios
    secondary: '#1B2D45',       // Navy profundo — textos, headers
    secondaryLight: '#2A4060',  // Navy claro — subheadings
    secondarySubtle: '#F0F2F5', // Navy ultra-sutil — backgrounds

    // Accent
    accent: '#FFD93D',          // Amarillo dorado — alertas, destacados
    accentHover: '#F0C830',     // Amarillo hover
    accentSubtle: '#FFFBEB',    // Amarillo sutil — banners info

    // Fondos
    background: '#FFFFFF',      // Fondo principal
    backgroundWarm: '#FFF8F5',  // Fondo cálido (landing, onboarding)
    backgroundMuted: '#FFE8E0', // Fondo medio (cards, secciones)
    
    // Neutrales
    foreground: '#1B2D45',      // Texto principal (= secondary)
    muted: '#6B7280',           // Texto secundario
    mutedLight: '#9CA3AF',      // Texto terciario, placeholders
    border: '#E5E7EB',          // Bordes de inputs, cards
    borderLight: '#F3F4F6',     // Separadores sutiles

    // Semánticos
    success: '#10B981',         // Verde — completado, stock OK
    successSubtle: '#ECFDF5',
    warning: '#F59E0B',         // Ámbar — atención, stock bajo
    warningSubtle: '#FFFBEB',
    destructive: '#EF4444',     // Rojo — errores, void, eliminar
    destructiveSubtle: '#FEF2F2',
    info: '#3B82F6',            // Azul — información, sync
    infoSubtle: '#EFF6FF',
  },

  // ─── COLORES HSL PARA SHADCN/UI ───────────────────────────
  // Estos valores van en globals.css como CSS variables
  cssVariables: {
    light: {
      '--background': '0 0% 100%',
      '--foreground': '214 43% 19%',
      '--card': '0 0% 100%',
      '--card-foreground': '214 43% 19%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '214 43% 19%',
      '--primary': '11 100% 64%',           // #FF6B4A
      '--primary-foreground': '0 0% 100%',
      '--secondary': '214 43% 19%',         // #1B2D45
      '--secondary-foreground': '0 0% 100%',
      '--muted': '220 13% 91%',
      '--muted-foreground': '215 16% 47%',
      '--accent': '47 100% 62%',            // #FFD93D
      '--accent-foreground': '214 43% 19%',
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '0 0% 100%',
      '--border': '220 13% 91%',
      '--input': '220 13% 91%',
      '--ring': '11 100% 64%',              // Ring = primary
      '--radius': '0.625rem',               // 10px — bordes redondeados friendly
    },
    dark: {
      '--background': '214 43% 12%',
      '--foreground': '16 100% 98%',
      '--card': '214 43% 15%',
      '--card-foreground': '16 100% 98%',
      '--popover': '214 43% 15%',
      '--popover-foreground': '16 100% 98%',
      '--primary': '11 100% 64%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '214 30% 25%',
      '--secondary-foreground': '16 100% 98%',
      '--muted': '214 30% 20%',
      '--muted-foreground': '215 16% 65%',
      '--accent': '47 100% 62%',
      '--accent-foreground': '214 43% 19%',
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '0 0% 100%',
      '--border': '214 30% 22%',
      '--input': '214 30% 22%',
      '--ring': '11 100% 64%',
      '--radius': '0.625rem',
    },
  },

  // ─── TIPOGRAFÍA ────────────────────────────────────────────
  fonts: {
    heading: "'Nunito', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    // Google Fonts URL para importar
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap',
  },

  // ─── LOGO ──────────────────────────────────────────────────
  logo: {
    // Variantes disponibles (componente CapsulaLogo.tsx)
    variants: ['full', 'icon', 'favicon'] as const,
    // Concepto: Barras modulares dentro de forma cápsula
    concept: 'capsule-bars',
    // Tamaños predeterminados
    sizes: {
      favicon: 32,
      icon: 48,
      navbar: 36,
      full: 40,
      hero: 64,
    },
  },

  // ─── BRANDING POR TENANT (overrides) ──────────────────────
  // En multitenant, cada tenant puede tener su propia identidad
  // Estos campos se leen del SystemConfig del tenant
  tenantOverrideFields: [
    'name',
    'tagline',
    'colors.primary',
    'colors.primaryHover',
    'colors.secondary',
    'colors.accent',
    'colors.background',
    'colors.backgroundWarm',
    'logo.customUrl',       // URL del logo custom del tenant
    'fonts.heading',
    'fonts.body',
  ] as const,
} as const;

// ─── COLORES LEGACY POR TENANT (para migración) ─────────────
// Los colores originales de cada tenant antes de CÁPSULA
export const TENANT_LEGACY_COLORS = {
  tablepong: {
    primary: '#E60023',     // Rojo Table Pong
    secondary: '#1A2B5B',   // Navy Table Pong
    accent: '#FFD93D',
  },
  shanklish: {
    primary: '#D4A76A',     // Dorado/arena árabe
    secondary: '#2D1B0E',   // Marrón oscuro
    accent: '#8B4513',      // Saddle brown
  },
} as const;

// ─── TIPOS ───────────────────────────────────────────────────
// Mapeamos las keys de CAPSULA_BRAND.colors a string (no literales).
// Reason: getTenantBranding puede mezclar colores de tenants con valores
// distintos a los defaults (#FF6B4A). Si usamos `typeof CAPSULA_BRAND.colors`
// directamente, TypeScript espera literales exactos y falla al asignar
// el resultado del merge del tenant.
export type BrandColors = { [K in keyof typeof CAPSULA_BRAND.colors]: string };
export type BrandFonts = { [K in keyof typeof CAPSULA_BRAND.fonts]: string };
export type LogoVariant = typeof CAPSULA_BRAND.logo.variants[number];
export type TenantSlug = keyof typeof TENANT_LEGACY_COLORS;

// ─── HELPER: Obtener branding del tenant actual ──────────────
export function getTenantBranding(tenantSlug?: string) {
  const base = { ...CAPSULA_BRAND };
  
  if (tenantSlug && tenantSlug in TENANT_LEGACY_COLORS) {
    const legacy = TENANT_LEGACY_COLORS[tenantSlug as TenantSlug];
    return {
      ...base,
      colors: {
        ...base.colors,
        ...legacy,
      },
    };
  }
  
  return base;
}
