/**
 * §163 — Clasificación de métodos de pago y su monto en bolívares. Puro.
 *
 * Dos cosas que estaban resueltas a mano dentro del Reporte Z:
 *
 * 1. **El clasificador.** La cadena de `if` que reparte cada método en su
 *    casilla del arqueo vivía escrita dentro de `z-report.actions.ts`, y se le
 *    había escapado `CASH_BS`: el efectivo en bolívares no coincidía con
 *    ninguna rama y terminaba en "Otros". Acá queda una sola tabla.
 *
 * 2. **El monto en Bs.** PDV, Pago Móvil y Efectivo Bs se cobran en bolívares
 *    — el cuadre contra el lote del punto y contra el banco se hace en Bs, no
 *    en dólares. El sistema ya guarda `amountBs` y la tasa del momento del
 *    cobro (PaymentSplit / SalesOrderPayment).
 *
 * **No se reconvierte con la tasa de hoy.** Es la regla que ya fija el propio
 * esquema para estos campos: un cobro viejo sin Bs registrado se reporta como
 * "no registrado", nunca como un número inventado con la tasa actual — si la
 * tasa se movió durante el día, ese número no cuadraría contra el lote del
 * punto y mandaría a la cajera a buscar un descuadre que no existe.
 */

export type PaymentBucket =
    | 'cash'      // efectivo en divisas (USD / EUR)
    | 'cashBs'    // efectivo en bolívares
    | 'zelle'
    | 'card'      // punto de venta (PDV) — se cobra en Bs
    | 'mobile'    // pago móvil — se cobra en Bs
    | 'transfer'
    | 'external'  // PedidosYA y otros canales que cobran ellos
    | 'other';

/** Método (como se persiste) → casilla del arqueo. */
const BUCKET_BY_METHOD: Record<string, PaymentBucket> = {
    CASH: 'cash',
    CASH_USD: 'cash',
    CASH_EUR: 'cash',
    // Efectivo en bolívares: casilla propia. Antes caía en "Otros" porque el
    // clasificador del Z sólo miraba CASH / CASH_USD / CASH_EUR.
    CASH_BS: 'cashBs',
    ZELLE: 'zelle',
    CARD: 'card',
    BS_POS: 'card',
    PDV_SHANKLISH: 'card',
    PDV_SUPERFERRO: 'card',
    MOBILE_PAY: 'mobile',
    PAGO_MOVIL: 'mobile',
    MOVIL_NG: 'mobile',
    TRANSFER: 'transfer',
    BANK_TRANSFER: 'transfer',
    PY: 'external',
};

export function paymentBucket(method: string | null | undefined): PaymentBucket {
    return BUCKET_BY_METHOD[(method ?? '').toUpperCase()] ?? 'other';
}

/**
 * ¿Este método se cobra en bolívares? Son los que la administración cuadra
 * contra el lote del punto y el estado de cuenta, en Bs.
 */
export function isBsPaymentMethod(method: string | null | undefined): boolean {
    const b = paymentBucket(method);
    return b === 'card' || b === 'mobile' || b === 'cashBs' || b === 'transfer';
}

export interface BsSource {
    /** Monto en Bs guardado al momento del cobro. Null en cobros históricos. */
    amountBs?: number | null;
    /** Tasa usada en ESE cobro (no la de hoy). */
    exchangeRate?: number | null;
    /** Monto en USD de la línea, para derivar Bs con la tasa del cobro. */
    amountUSD?: number | null;
}

const finite = (n: unknown): number | null =>
    typeof n === 'number' && Number.isFinite(n) ? n : null;

/**
 * Bolívares realmente cobrados en esta línea.
 *
 * Orden: el Bs guardado; si no está, se deriva con la tasa **de ese cobro**;
 * si tampoco hay tasa, `null` = no registrado (la pantalla lo dice, no lo
 * rellena con la tasa de hoy).
 */
export function registeredBs(src: BsSource): number | null {
    const stored = finite(src.amountBs);
    if (stored !== null && stored > 0) return Math.round(stored * 100) / 100;

    const rate = finite(src.exchangeRate);
    const usd = finite(src.amountUSD);
    if (rate !== null && rate > 0 && usd !== null && usd > 0) {
        return Math.round(usd * rate * 100) / 100;
    }
    return null;
}

export type BsBreakdown = Record<PaymentBucket, number>;

export const emptyBsBreakdown = (): BsBreakdown => ({
    cash: 0, cashBs: 0, zelle: 0, card: 0, mobile: 0, transfer: 0, external: 0, other: 0,
});

/**
 * Acumulador del arqueo en Bs. Devuelve si el monto quedó registrado, para
 * que el reporte pueda avisar "hay cobros en Bs sin monto guardado" en vez de
 * mostrar un subtotal incompleto como si fuera el total.
 */
export function accumulateBs(
    acc: BsBreakdown,
    method: string | null | undefined,
    src: BsSource,
): boolean {
    if (!isBsPaymentMethod(method)) return true;
    const bs = registeredBs(src);
    if (bs === null) return false;
    const b = paymentBucket(method);
    acc[b] = Math.round((acc[b] + bs) * 100) / 100;
    return true;
}
