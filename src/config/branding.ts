/**
 * src/config/branding.ts
 * ─────────────────────────────────────────────────────────────────────
 * Fuente única de verdad para la identidad visual y nomenclatura del
 * tenant activo. Todos los valores se leen de variables de entorno
 * NEXT_PUBLIC_* (compiladas en build time — configurar en .env.local).
 *
 * Para instalar un cliente nuevo basta con ajustar su .env.local;
 * ningún archivo de código debe mencionar el nombre de un negocio.
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Identidad del tenant ─────────────────────────────────────────────

export const BRAND = {
  /** Nombre de la plataforma SaaS (ej. "Cápsula ERP") */
  appName:      process.env.NEXT_PUBLIC_APP_NAME      ?? 'Cápsula ERP',
  /** Nombre del negocio cliente (ej. "Mi Restaurante") */
  businessName: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? 'Mi Negocio',
  /** Email de soporte visible en pantallas de login/error */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'soporte@capsulapp.com',
  /** Ruta al logo (relativa a /public). Usar /logo.png por default. */
  logoPath:     process.env.NEXT_PUBLIC_LOGO_PATH     ?? '/logo.png',
  /** Prefijo para claves de localStorage — evita colisiones entre tenants */
  storePrefix:  process.env.NEXT_PUBLIC_STORE_PREFIX  ?? 'capsula',
} as const;

// ── Métodos de pago ──────────────────────────────────────────────────
//
// IMPORTANTE: Los IDs (PDV_SHANKLISH, etc.) son invariables — están
// almacenados en registros históricos de la BD. Solo los labels y
// propiedades son configurables aquí.
//
// Para configurar labels en producción:
//   NEXT_PUBLIC_PM_PDV1="💳 Mi Terminal POS"
//   NEXT_PUBLIC_PM_PDV2="💳 Terminal Backup"
//   NEXT_PUBLIC_PM_MOVIL="📱 Pago Móvil"

export const PAYMENT_METHODS = [
  { id: 'CASH_USD',       label: process.env.NEXT_PUBLIC_PM_CASH_USD ?? '💵 Cash $',         isBs: false },
  { id: 'CASH_EUR',       label: process.env.NEXT_PUBLIC_PM_CASH_EUR ?? '€ Cash €',          isBs: false },
  { id: 'ZELLE',          label: process.env.NEXT_PUBLIC_PM_ZELLE    ?? '⚡ Zelle',           isBs: false },
  { id: 'CASH_BS',        label: process.env.NEXT_PUBLIC_PM_CASH_BS  ?? '💴 Efectivo Bs',    isBs: true  },
  { id: 'PDV_SHANKLISH',  label: process.env.NEXT_PUBLIC_PM_PDV1     ?? '💳 PDV Terminal 1', isBs: true  },
  { id: 'PDV_SUPERFERRO', label: process.env.NEXT_PUBLIC_PM_PDV2     ?? '💳 PDV Terminal 2', isBs: true  },
  { id: 'MOVIL_NG',       label: process.env.NEXT_PUBLIC_PM_MOVIL    ?? '📱 Pago Móvil',     isBs: true  },
  { id: 'CORTESIA',       label: '🎁 Cortesía',                                               isBs: false },
] as const;

export type PaymentMethodId = typeof PAYMENT_METHODS[number]['id'];

/** Mapa rápido ID → label para uso en tablas, badges y selectores */
export const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.id, m.label])
);

/** Set de IDs que operan en Bs (muestran conversión a USD) */
export const BS_METHOD_IDS = new Set<string>(
  PAYMENT_METHODS.filter((m) => m.isBs).map((m) => m.id)
);

// ── Claves de localStorage ───────────────────────────────────────────
//
// Usa storePrefix para evitar que distintos tenants en el mismo
// navegador compartan configuración de terminal.

export const STORAGE_KEYS = {
  posConfig:    `${BRAND.storePrefix}_pos_config`,
  cashierShift: `${BRAND.storePrefix}_cashier_shift`,
  authStore:    `${BRAND.storePrefix}-auth`,
} as const;
