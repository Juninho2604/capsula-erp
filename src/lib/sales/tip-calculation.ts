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

/** Métodos en divisas efectivo/zelle que se redondean al dólar entero. */
const DIVISAS_CASH_METHODS = new Set(['CASH_USD', 'CASH_EUR', 'ZELLE']);

/**
 * Propina por REDONDEO del cobro (POS mesa, divisas efectivo/zelle).
 *
 * Decisión del dueño (16/06): el POS le dice a la cajera cobrar el dólar entero
 * hacia ARRIBA. La diferencia entre ese monto redondeado y la factura real
 * (neto post-descuento + 10% servicio) se registra como PROPINA, de modo que el
 * RECIBO, el SISTEMA y lo COBRADO muestren exactamente el mismo número y el
 * arqueo cuadre. Antes el redondeo solo afectaba la pantalla → el recibo/registro
 * quedaban por debajo de lo cobrado (desfase reportado por la cajera).
 *
 * Reglas:
 *   - Solo métodos divisas efectivo/zelle (CASH_USD, CASH_EUR, ZELLE).
 *   - Nunca negativa (Math.ceil siempre ≥ factura).
 *   - En pago mixto el target es exacto → 0 (no se redondea).
 *
 * El cap final lo aplica `cappedTipForPayment`: si el cliente pagó justo (sin
 * entregar el dólar entero), esta propina de redondeo se capa a 0.
 */
export function roundingTipForCharge(args: {
    facturaReal: number;
    paymentMethod: string;
    isMixed?: boolean;
}): number {
    const factura = Math.max(0, Number.isFinite(args.facturaReal) ? args.facturaReal : 0);
    if (args.isMixed) return 0;
    if (!DIVISAS_CASH_METHODS.has((args.paymentMethod || '').toUpperCase())) return 0;
    return Math.max(0, Math.ceil(factura) - factura);
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

/**
 * §103 — Porción NETA de ítems que un pago cubre (parcial o completo).
 *
 * El server espera `amount` = neto de ÍTEMS aplicado al balance (él le suma
 * el % de servicio encima). El bug de parciales: el cliente mandaba el BRUTO
 * recibido (ítems + servicio) → el server lo restaba del balance de ítems y
 * re-sumaba el 10% → cada porción parcial pagaba el servicio "gratis" para
 * el cliente (mesa $110 en dos mitades cobraba $104.50).
 *
 * Fórmula: retenido para factura = min(recibido, facturaReal); de eso, la
 * porción de ítems = retenido / (1 + serviceRate). Con serviceRate 0 (exento
 * o no TABLE_SERVICE) es identidad. Redondeado a centavos.
 */
export function netItemsPortionForPayment(args: {
    amountPaid: number;
    totalAntesServicio: number;
    serviceFee: number;
    serviceRate: number;
}): number {
    const factura = Math.max(0, (args.totalAntesServicio || 0) + (args.serviceFee || 0));
    const received = Math.max(0, args.amountPaid || 0);
    const keptForFactura = Math.min(received, factura);
    const rate = Number.isFinite(args.serviceRate) && args.serviceRate > 0 ? args.serviceRate : 0;
    return Math.round((keptForFactura / (1 + rate)) * 100) / 100;
}
