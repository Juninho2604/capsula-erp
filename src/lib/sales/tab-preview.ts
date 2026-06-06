/**
 * Cálculo de la cuenta de mesa (pre-cobro) — POS Mesero "Mostrar al cliente".
 *
 * Modelo (acordado con el dueño, ver §46 y conversación 6/6 sobre imagen
 * mesero vs restaurante):
 *
 *   subtotal (bruto, items sumados)
 *   − descuento (DIVISAS_33, CORTESIA_*, divisasPreview si la cajera tocó el
 *     botón "Divisas" en el modal del mesero)
 *   = neto
 *   + 10% servicio sobre el neto (si la mesa es TABLE_SERVICE)
 *   + propina (% que el mesero sugirió) sobre el neto, NO sobre el bruto
 *   = total a cobrar
 *
 *   − paidPartial (lo que ya se cobró en splits anteriores)
 *   = saldoPendiente
 *
 * Por qué propina sobre NETO: ya estaba arreglado en `setOpenTabTipAction`
 * (server) en §46, PERO el POS Mesero tenía un cálculo CLIENT-SIDE paralelo
 * para subcuentas (mesero/page.tsx:1688) que seguía sobre el bruto. Esta
 * función centraliza el cálculo bien.
 *
 * Por qué mostrar el 10% al cliente: hasta ahora `totalServiceCharge` venía 0
 * antes del cobro, así que el cliente veía un total artificialmente bajo y la
 * cajera cobraba más. Ahora se muestra el esperado.
 */

export interface TabPreviewInput {
    /** Subtotal bruto (items sumados, sin descuentos). */
    subtotal: number;
    /** Descuento ya acumulado en la mesa (runningDiscount). */
    discount: number;
    /** Servicio 10% ya acumulado al cobrar (totalServiceCharge). 0 si no se cobró. */
    serviceChargeAccumulated: number;
    /** True si la mesa es TABLE_SERVICE (default true en bar/restaurante). */
    isTableService: boolean;
    /** Porcentaje de propina sugerido por el mesero (0/10/15/20). */
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
    /** Servicio 10% sobre el neto (esperado o ya acumulado, lo que aplique). */
    serviceCharge: number;
    /** Propina sobre el NETO. */
    tipAmount: number;
    /** Total a cobrar antes de aplicar pagos parciales. */
    grandTotal: number;
    /** Lo que el cliente debe pagar AHORA (descontando lo ya cobrado). */
    saldoPendiente: number;
}

function safe(n: number | null | undefined): number {
    return Number.isFinite(n as number) ? (n as number) : 0;
}

export function computeTabPreviewTotals(input: TabPreviewInput): TabPreviewTotals {
    const subtotal = Math.max(0, safe(input.subtotal));
    const discountAccum = Math.max(0, safe(input.discount));
    const divisasPreview = Math.max(0, safe(input.divisasPreviewDiscount));
    const tipPercent = Math.max(0, Math.min(100, safe(input.tipPercent)));
    const paidPartial = Math.max(0, safe(input.paidPartial));
    const serviceAccum = Math.max(0, safe(input.serviceChargeAccumulated));

    // Discount total = lo ya aplicado en runningDiscount + lo que está en preview.
    const discountTotal = discountAccum + divisasPreview;
    const netoPostDescuento = Math.max(0, subtotal - discountTotal);

    // Servicio 10%: si ya hay acumulado en cobros parciales, respetarlo + el
    // esperado del saldo restante (que aún no fue cobrado). Si no se ha cobrado
    // nada (caso típico al mostrar la cuenta al cliente), serviceAccum=0 y
    // serviceCharge = 10% del neto completo. Si la mesa NO es TABLE_SERVICE
    // (bar tab, evento), no hay 10%.
    const serviceCharge = input.isTableService
        ? (serviceAccum > 0 ? serviceAccum : Math.round(netoPostDescuento * 0.10 * 100) / 100)
        : 0;

    // Propina sobre NETO (no bruto). Centraliza el fix §46.
    const tipAmount = Math.round(netoPostDescuento * (tipPercent / 100) * 100) / 100;

    const grandTotal = Math.round((netoPostDescuento + serviceCharge + tipAmount) * 100) / 100;
    const saldoPendiente = Math.max(0, Math.round((grandTotal - paidPartial) * 100) / 100);

    return {
        subtotal,
        discountTotal,
        netoPostDescuento,
        serviceCharge,
        tipAmount,
        grandTotal,
        saldoPendiente,
    };
}
