/**
 * Configuración del descuento por pago en DIVISAS (§87) — pura.
 *
 * El descuento por pagar en divisas (cash USD/EUR/Zelle) era 33,33% fijo.
 * Ahora es editable por OWNER/AUDITOR/ADMIN_MANAGER (depende de la situación
 * cambiaria del país). Se guarda como PORCENTAJE en SystemConfig
 * (`divisas_discount_percent`); acá viven el default y la normalización.
 *
 * IMPORTANTE: el descuento aplica SOLO a los ítems, NUNCA al fee de delivery
 * (que tiene su propio piso de $3 para el motorizado — ver DELIVERY_FEE_DIVISAS
 * y el guard en calculateCartTotals). Cambiar el % no toca ese piso.
 */

export const DIVISAS_DISCOUNT_CONFIG_KEY = 'divisas_discount_percent';

/** 33,33% — histórico (equivale a pagar ⅔). */
export const DEFAULT_DIVISAS_DISCOUNT_PERCENT = 100 / 3;

/** Piso del fee de delivery en divisas: SIEMPRE se le paga al motorizado. */
export const MIN_DELIVERY_FEE_DIVISAS = 3;

/** Normaliza un porcentaje de descuento divisas a [0, 90]. Fuera de rango o
 *  inválido → default. El tope 90% evita regalar la venta por error. */
export function normalizeDivisasPercent(percent: number | null | undefined): number {
    if (percent == null || !Number.isFinite(percent)) return DEFAULT_DIVISAS_DISCOUNT_PERCENT;
    if (percent < 0) return 0;
    if (percent > 90) return 90;
    return percent;
}

/** Porcentaje → fracción de descuento (ej. 33.33 → 0.3333). */
export function divisasDiscountRate(percent: number | null | undefined): number {
    return normalizeDivisasPercent(percent) / 100;
}

/** Parsea el string guardado en SystemConfig a porcentaje normalizado. */
export function parseDivisasPercent(raw: string | null | undefined): number {
    if (raw == null) return DEFAULT_DIVISAS_DISCOUNT_PERCENT;
    const n = parseFloat(raw);
    return normalizeDivisasPercent(n);
}
