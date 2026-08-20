/**
 * Configuración del COSTO DE ENVÍO del delivery (§157) — pura.
 *
 * Historia: el fee estaba escrito fijo en el código en dos lugares (la
 * pestaña de delivery y el server), con montos distintos según la moneda
 * ($4.50 en Bs, $3 en divisas). Omar cambió la política de precios —
 * $3 el envío normal y $1 el cercano, SEA CUAL SEA la moneda — editó "el
 * precio en el menú" y no pasó nada, porque el fee nunca salió del menú.
 *
 * Desde §157 el monto vive en SystemConfig, editable en Configuración → POS
 * (mismo patrón que el % de divisas, §87), y depende de la ZONA, no de la
 * moneda. La moneda sigue decidiendo únicamente en qué se cobra (Bs a tasa o
 * USD), nunca cuánto.
 */

export const DELIVERY_FEE_NORMAL_KEY = 'delivery_fee_normal';
export const DELIVERY_FEE_CERCANO_KEY = 'delivery_fee_cercano';

/** Defaults vigentes (política 2026-08-15): normal $3, cercano $1. */
export const DEFAULT_DELIVERY_FEE_NORMAL = 3;
export const DEFAULT_DELIVERY_FEE_CERCANO = 1;

/** Zona del envío — es lo que decide el monto. */
export type DeliveryZone = 'NORMAL' | 'CERCANO';

export interface DeliveryFees {
    normal: number;
    cercano: number;
}

export const DEFAULT_DELIVERY_FEES: DeliveryFees = {
    normal: DEFAULT_DELIVERY_FEE_NORMAL,
    cercano: DEFAULT_DELIVERY_FEE_CERCANO,
};

/**
 * Normaliza un fee a [0, 50]. Inválido → default de la zona. El tope evita
 * que un typo (300 en vez de 3.00) se cobre de verdad.
 */
export function normalizeDeliveryFee(value: number | null | undefined, fallback: number): number {
    if (value == null || !Number.isFinite(value)) return fallback;
    if (value < 0) return 0;
    if (value > 50) return 50;
    return Math.round(value * 100) / 100;
}

/** Parsea el string guardado en SystemConfig. */
export function parseDeliveryFee(raw: string | null | undefined, fallback: number): number {
    if (raw == null) return fallback;
    return normalizeDeliveryFee(parseFloat(raw), fallback);
}

/** Fee que corresponde a la zona. Zona desconocida → normal (nunca gratis por error). */
export function deliveryFeeForZone(fees: DeliveryFees, zone: DeliveryZone | null | undefined): number {
    return zone === 'CERCANO' ? fees.cercano : fees.normal;
}
