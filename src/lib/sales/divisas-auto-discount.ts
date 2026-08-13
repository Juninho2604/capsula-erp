/**
 * Cuándo corresponde el descuento por divisas en el POS (§152) — puro.
 *
 * Regla de negocio: pagar en divisas (efectivo USD/EUR o Zelle) lleva
 * descuento. El POS lo aplica y lo quita solo, siguiendo el método de pago.
 *
 * El efecto que hacía esto miraba ÚNICAMENTE el selector de método único, y
 * el pago mixto no existía para él. Como entrar en modo mixto no marca ningún
 * método como elegido, el efecto lo leía como "todavía no eligió nada" y su
 * respuesta a eso era BORRAR el descuento — incluso el que la cajera acababa
 * de poner a mano. El botón parecía muerto y la mesa se cobraba completa.
 *
 * Dos cosas que no se pueden perder al arreglarlo:
 *
 *  1. El candado de "método no elegido" en modo único (§121, 16-jul). El POS
 *     arranca con CASH_USD como valor centinela; sin ese candado las
 *     PRE-CUENTAS salían impresas con descuento que nadie autorizó.
 *  2. Una cortesía elegida a mano manda. Si la cajera puso CORTESIA, el
 *     automático no la pisa.
 */

/** Métodos cuyo dinero entra en divisas. Espejo del safeguard del server. */
export const DIVISAS_PAYMENT_METHODS = new Set(['CASH', 'CASH_USD', 'CASH_EUR', 'ZELLE']);

export function isDivisasMethod(method: string | null | undefined): boolean {
    return !!method && DIVISAS_PAYMENT_METHODS.has(method);
}

export type PosDiscountType = 'NONE' | 'DIVISAS_33' | 'CORTESIA_100' | 'CORTESIA_PERCENT';

export interface DivisasAutoInput {
    /** true si el cobro se está armando como pago mixto (varias líneas). */
    mixedMode: boolean;
    /** Métodos de las líneas del pago mixto. Ignorado si mixedMode es false. */
    mixedMethods: string[];
    /** Método del selector único. */
    method: string;
    /** ¿La cajera tocó el selector único? Centinela de §121. */
    methodTouched: boolean;
    /** Descuento actualmente elegido. */
    current: PosDiscountType;
}

/**
 * Descuento que corresponde según el estado del cobro.
 *
 * Devuelve `null` cuando no hay que tocar nada — o porque ya está en el valor
 * correcto, o porque hay una cortesía que el automático no debe pisar.
 */
export function nextDivisasDiscount(input: DivisasAutoInput): 'NONE' | 'DIVISAS_33' | null {
    // Cortesía elegida a mano: manda sobre el automático.
    if (input.current !== 'NONE' && input.current !== 'DIVISAS_33') return null;

    const target: 'NONE' | 'DIVISAS_33' = input.mixedMode
        // En mixto alcanza con que UNA línea entre en divisas: el monto sobre
        // el que aplica lo resuelve después el cálculo con gross-up (§112).
        ? (input.mixedMethods.some(isDivisasMethod) ? 'DIVISAS_33' : 'NONE')
        // En único, sin método elegido no hay descuento (candado §121).
        : (input.methodTouched && isDivisasMethod(input.method) ? 'DIVISAS_33' : 'NONE');

    return target === input.current ? null : target;
}

export interface PaymentLineLike {
    method: string;
    amountUSD: number;
}

/**
 * Porción del pago mixto que entra en divisas: la SUMA de todas las líneas
 * que califican, no una sola.
 *
 * Existe como función aparte porque estaba escrita inline dos veces (mesa y
 * pickup) y es la entrada del cálculo de descuento. Cuando las dos líneas son
 * divisas —Zelle + efectivo, el caso que reportó la cajera— esto devuelve el
 * total entregado, y el gross-up de computeDivisasSettlement lo topa al saldo
 * de la mesa: el descuento resultante es el GLOBAL, no el de una línea.
 */
export function divisasPortion(lines: PaymentLineLike[]): number {
    return lines
        .filter(l => isDivisasMethod(l.method))
        .reduce((sum, l) => sum + (Number.isFinite(l.amountUSD) ? l.amountUSD : 0), 0);
}
