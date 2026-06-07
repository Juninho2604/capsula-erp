/**
 * Cálculo de la cuenta de mesa (pre-cobro) — POS Mesero "Mostrar al cliente".
 *
 * MODELO (definido por el dueño, conversación 6/6 tras foto Carmen):
 *
 *   - **Solo existe el 10% servicio.** Lo que la UI vieja llamaba "Propina"
 *     era en realidad el servicio (mismo cargo que la cajera cobra). NO hay
 *     propina inmediata adicional al servicio.
 *   - La propina extra al equipo (si el cliente la deja al irse) se registra
 *     después por "Propina colectiva" (PR #272), vinculada a la mesa.
 *   - El % que el mesero selecciona (10/15/20) se persiste como `tipPercent`
 *     en BD por compatibilidad, pero conceptualmente es el SERVICIO sugerido.
 *
 * FÓRMULA:
 *
 *   subtotal − descuento − divisasPreview = neto
 *   + serviceCharge (= neto × tipPercent, sobre el NETO no el bruto — §46)
 *   = total
 *   − pagado parcial = saldoPendiente
 *
 * Lo que la cajera cobra (`appliedAmount × 0.10` en pos.actions.ts:1961) sale
 * exactamente igual: 10% sobre el monto post-descuento.
 */

export interface TabPreviewInput {
    /** Subtotal bruto (items sumados, sin descuentos). */
    subtotal: number;
    /** Descuento ya acumulado en la mesa (runningDiscount). */
    discount: number;
    /** Porcentaje seleccionado por el mesero (0/10/15/20). Es el SERVICIO. */
    tipPercent: number;
    /** Descuento de divisas en preview (cliente tocó el botón en el modal). */
    divisasPreviewDiscount: number;
    /** Suma de paidAmount de los splits ya cobrados. */
    paidPartial: number;
}

export interface TabPreviewTotals {
    /** Bruto. */
    subtotal: number;
    /** Suma de todos los descuentos efectivos (runningDiscount + preview divisas). */
    discountTotal: number;
    /** Neto post-descuentos (= subtotal − discountTotal). */
    netoPostDescuento: number;
    /** Servicio (% del neto). Línea ÚNICA del 10% que ve el cliente. */
    serviceCharge: number;
    /** Total a cobrar antes de aplicar pagos parciales. */
    grandTotal: number;
    /** Lo que el cliente debe pagar AHORA (descontando lo ya cobrado). */
    saldoPendiente: number;
}

function safe(n: number | null | undefined): number {
    return Number.isFinite(n as number) ? (n as number) : 0;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function computeTabPreviewTotals(input: TabPreviewInput): TabPreviewTotals {
    const subtotal = Math.max(0, safe(input.subtotal));
    const discountAccum = Math.max(0, safe(input.discount));
    const divisasPreview = Math.max(0, safe(input.divisasPreviewDiscount));
    const tipPercent = Math.max(0, Math.min(100, safe(input.tipPercent)));
    const paidPartial = Math.max(0, safe(input.paidPartial));

    const discountTotal = discountAccum + divisasPreview;
    const netoPostDescuento = Math.max(0, subtotal - discountTotal);

    // 10% servicio sobre el NETO (no sobre el bruto). Esta es la línea ÚNICA
    // del 10% que ve el cliente — la "propina" del selector del mesero ES el
    // servicio. Conceptualmente: lo que cobra la cajera al final.
    const serviceCharge = round2(netoPostDescuento * (tipPercent / 100));

    const grandTotal = round2(netoPostDescuento + serviceCharge);
    const saldoPendiente = Math.max(0, round2(grandTotal - paidPartial));

    return {
        subtotal,
        discountTotal,
        netoPostDescuento,
        serviceCharge,
        grandTotal,
        saldoPendiente,
    };
}
