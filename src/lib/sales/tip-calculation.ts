/**
 * Cálculo de propina en POS Restaurante (mesa). Funciones puras testeables.
 *
 * Bug TAB-2433 (§46) tenía dos partes:
 *  A) La propina SUGERIDA por el mesero se calculaba sobre el subtotal bruto
 *     en vez del total neto (post-descuento). `suggestedTipAmount` lo corrige.
 *  B) La propina REGISTRADA al cobrar podía exceder lo que el cliente pagó
 *     (propina fantasma). `cappedTipForPayment` la limita al excedente real.
 */

/**
 * Propina sugerida = tipPercent sobre el TOTAL NETO (después de descuentos),
 * nunca sobre el subtotal bruto. Refleja `setOpenTabTipAction` en pos.actions.ts.
 */
export function suggestedTipAmount(runningTotalNeto: number, tipPercent: number): number {
    if (!Number.isFinite(runningTotalNeto) || !Number.isFinite(tipPercent)) return 0;
    if (tipPercent <= 0 || runningTotalNeto <= 0) return 0;
    return runningTotalNeto * (tipPercent / 100);
}

/**
 * Propina que se puede registrar realmente en un cobro: el mínimo entre la
 * propina pretendida (prefill o tipeada) y el excedente realmente cobrado
 * (lo pagado por encima de la factura = total neto + servicio). Nunca negativa.
 * Refleja el guard de `handlePaymentPinConfirm` en restaurante/page.tsx.
 */
export function cappedTipForPayment(args: {
    intendedTip: number;
    amountPaid: number;
    totalAntesServicio: number;
    serviceFee: number;
}): number {
    const intended = Number.isFinite(args.intendedTip) ? Math.max(0, args.intendedTip) : 0;
    const facturaReal = (args.totalAntesServicio || 0) + (args.serviceFee || 0);
    const realExcess = Math.max(0, (args.amountPaid || 0) - facturaReal);
    const capped = Math.min(intended, realExcess);
    return capped > 0 ? capped : 0;
}

/**
 * Monto que el split de la mesa debe registrar como `paidAmount`: el dinero
 * RETENIDO por el local = factura + propina, NO el bruto recibido.
 *
 * Por qué: el historial y el Z report calculan la propina de la mesa como
 * `paidAmount − factura` (excedente del split). Si el split guarda el bruto
 * recibido (incluyendo el vuelto a devolver en efectivo), ese vuelto se cuenta
 * como propina. Registrando solo lo retenido, el excedente del split == la
 * propina real, y NO hace falta crear una propina colectiva aparte (que
 * doble-contaba). Caso TAB-2433.
 *
 *   - Sobrepago: min(recibido, factura) = factura → retenido = factura + tip.
 *   - Pago justo o parcial: min(recibido, factura) = recibido, y tip=0
 *     (cappedTipForPayment lo capa al excedente=0) → retenido = recibido.
 */
export function keptAmountForSplit(args: {
    amountPaid: number;
    totalAntesServicio: number;
    serviceFee: number;
    tip: number;
}): number {
    const factura = (args.totalAntesServicio || 0) + (args.serviceFee || 0);
    const received = Math.max(0, args.amountPaid || 0);
    const tip = Math.max(0, args.tip || 0);
    return Math.min(received, factura) + tip;
}
