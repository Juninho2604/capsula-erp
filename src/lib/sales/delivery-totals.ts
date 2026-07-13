/**
 * Totales de un pedido de DELIVERY con descuentos (§88) — PURO.
 *
 * Extraído para eliminar la duplicación cliente/servidor que causaba
 * descuadres: el POS (delivery/page.tsx) y el server (calculateCartTotals)
 * calculaban el total por separado y divergían en la CORTESÍA en %.
 *
 * Reglas de negocio (confirmadas por el dueño, 09/07):
 *   - El costo de ENVÍO se le paga al motorizado sí o sí:
 *       · Divisas: envío = feeDivisas ($3), y NUNCA menos.
 *       · Cortesía en % (parcial): el descuento aplica SOLO a los productos;
 *         el envío se cobra COMPLETO — salvo que se marque `discountIncludesDelivery`
 *         (§91), en cuyo caso el % también descuenta el envío (descuento global).
 *       · Cortesía 100%: comp total (todo gratis, incluido el envío).
 *       · Promo "Delivery Gratis": waivea el envío remanente (decisión
 *         explícita de regalar el envío).
 *   - Divisas: el % (editable §87) aplica a los ítems (o a la porción en
 *     divisas en pago mixto), nunca al envío.
 *
 * Devuelve el total ANTES del redondeo por método de pago (roundToWhole),
 * que el caller aplica después (idéntico en cliente y server).
 */

function round2(n: number): number { return Math.round(n * 100) / 100; }

/**
 * §112 — Base BRUTA de consumo que cubre un pago en divisas (gross-up).
 *
 * Bug que corrige: en pago mixto el descuento divisas se calculaba como
 * `pagado × ⅓` (efectivo 25% sobre la base cubierta). La regla real (misma
 * que computeDivisasSettlement de mesa) es: lo pagado en divisas ya trae el
 * beneficio, así que la porción de consumo que salda es
 * `pagado / (1 − rate)` y el descuento es `base × rate` (33,33% pleno).
 *
 * Caso canónico (pedido del OWNER): comida $30, envío Bs $4.50. El cliente
 * paga $20 en divisas + $4.50 en Bs → base cubierta = 20/(2/3) = $30 →
 * descuento $10 (33,33% de la comida) → total $24.50 = 20 + 4.50. Con la
 * fórmula vieja el descuento era $6.67 y quedaba saldo fantasma.
 *
 * Se topa a `itemsSubtotal`: pagar de más en divisas no genera descuento
 * sobre consumo inexistente (el exceso es vuelto/propina, no base).
 */
export function divisasBaseFromPaid(
    paidUsd: number,
    itemsSubtotal: number,
    rate: number = 1 / 3,
): number {
    const paid = Math.max(0, Number.isFinite(paidUsd) ? paidUsd : 0);
    const items = Math.max(0, Number.isFinite(itemsSubtotal) ? itemsSubtotal : 0);
    const r = Math.min(0.9, Math.max(0, Number.isFinite(rate) ? rate : 1 / 3));
    const netFactor = 1 - r;
    if (netFactor <= 0) return items;
    return Math.min(items, round2(paid / netFactor));
}

export type DeliveryDiscountType = 'NONE' | 'DIVISAS_33' | 'CORTESIA_100' | 'CORTESIA_PERCENT';

/**
 * §97 — Moneda del ENVÍO, elegida EXPLÍCITAMENTE por la cajera (nunca
 * inferida del descuento/método de pago, que era la fuente de descuadres en
 * pagos mixtos tipo Zelle+Cash):
 *   'DIVISAS' → feeDivisas ($3, piso al motorizado)
 *   'BS'      → feeNormal ($4.50, se cobra en Bs a tasa)
 *   'NONE'    → sin envío agregado (default del POS — se suma manual)
 *   'AUTO'    → comportamiento histórico (infiere por discountType). Solo
 *               para compatibilidad de callers viejos; el POS ya no lo usa.
 */
export type DeliveryFeeMode = 'AUTO' | 'DIVISAS' | 'BS' | 'NONE';

export interface DeliveryTotalsInput {
    itemsSubtotal: number;
    discountType: DeliveryDiscountType;
    /** Solo CORTESIA_PERCENT: 0–100. */
    discountPercent?: number | null;
    /**
     * §91 — Cortesía GLOBAL: aplica el % de cortesía TAMBIÉN al envío
     * (descuento global). Solo tiene efecto con `CORTESIA_PERCENT`; con
     * `CORTESIA_100` el envío ya va gratis y con `DIVISAS_33` el envío mantiene
     * su piso al motorizado. Default/undefined = false → envío completo (§88).
     */
    discountIncludesDelivery?: boolean;
    /** Solo DIVISAS_33 en pago mixto: porción en divisas que recibe el
     *  descuento. null/undefined = todo el subtotal (pago full divisas). */
    divisasBase?: number | null;
    /** Fracción de descuento divisas (§87). Default 1/3. */
    divisasRate?: number;
    /** Promo "Delivery Gratis": waivea el envío remanente. */
    freeDelivery?: boolean;
    /** §97: moneda del envío elegida por la cajera. Default 'AUTO' (histórico). */
    feeMode?: DeliveryFeeMode;
    feeNormal: number;   // ej. 4.5
    feeDivisas: number;  // ej. 3 (piso — nunca menos)
}

export interface DeliveryTotals {
    /** Valor de lista = ítems + envío normal (para reportar el bruto). */
    subtotal: number;
    /** Envío efectivo cobrado (post promo gratis). */
    deliveryFee: number;
    /** Descuento total aplicado = subtotal - total. */
    discount: number;
    /** Total a cobrar ANTES del redondeo por método. */
    total: number;
}

export function computeDeliveryTotals(input: DeliveryTotalsInput): DeliveryTotals {
    const items = Math.max(0, Number.isFinite(input.itemsSubtotal) ? input.itemsSubtotal : 0);
    const feeNormal = Math.max(0, input.feeNormal);
    // Piso del envío en divisas: nunca menos que feeDivisas.
    const feeDivisasFloor = Math.max(0, input.feeDivisas);
    const rate = Number.isFinite(input.divisasRate as number)
        ? Math.min(0.9, Math.max(0, input.divisasRate as number))
        : 1 / 3;
    const pct = Math.min(100, Math.max(0, input.discountPercent ?? 0)) / 100;

    // §97: envío por modo EXPLÍCITO. 'AUTO' preserva la inferencia histórica
    // (divisas usa su piso). Promo gratis → 0 más abajo.
    const feeMode = input.feeMode ?? 'AUTO';
    const feeBase =
        feeMode === 'DIVISAS' ? feeDivisasFloor
        : feeMode === 'BS' ? feeNormal
        : feeMode === 'NONE' ? 0
        : (input.discountType === 'DIVISAS_33' ? feeDivisasFloor : feeNormal);
    // §91: cortesía global → el % también descuenta el envío. Solo aplica a
    // CORTESIA_PERCENT; el resto de tipos mantienen su envío completo/piso.
    const feeAfterCourtesy =
        input.discountType === 'CORTESIA_PERCENT' && input.discountIncludesDelivery
            ? feeBase * (1 - pct)
            : feeBase;
    const deliveryFee = input.freeDelivery ? 0 : round2(feeAfterCourtesy);

    // Descuento sobre los ÍTEMS (nunca sobre el envío, salvo comp total).
    let itemsAfterDiscount: number;
    switch (input.discountType) {
        case 'DIVISAS_33': {
            const base = input.divisasBase == null ? items : Math.max(0, input.divisasBase);
            itemsAfterDiscount = items - base * rate;
            break;
        }
        case 'CORTESIA_100':
            itemsAfterDiscount = 0;
            break;
        case 'CORTESIA_PERCENT':
            itemsAfterDiscount = items * (1 - pct);
            break;
        default:
            itemsAfterDiscount = items;
    }

    // Cortesía 100% = comp total (incluye el envío). El resto: ítems + envío.
    const total = input.discountType === 'CORTESIA_100'
        ? 0
        : round2(itemsAfterDiscount + deliveryFee);

    // Valor de lista del envío para el subtotal: con modo explícito es el
    // precio de ese modo (el fee no genera "descuento" fantasma); en AUTO se
    // mantiene el histórico (feeNormal siempre).
    const listFee =
        feeMode === 'DIVISAS' ? feeDivisasFloor
        : feeMode === 'BS' ? feeNormal
        : feeMode === 'NONE' ? 0
        : feeNormal;
    const subtotal = round2(items + listFee);
    const discount = round2(subtotal - total);

    return { subtotal, deliveryFee, discount, total };
}
