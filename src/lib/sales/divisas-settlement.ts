/**
 * Liquidación de un cobro en DIVISAS (cash USD/EUR/Zelle) sobre una cuenta de
 * mesa, con el descuento −33,33% aplicado **proporcionalmente a lo que se cobra
 * en ESTE pago**, no al saldo total de la mesa.
 *
 * Bug que corrige (TAB-3048, 23/06/2026):
 *   El cobro único en divisas calculaba `discount = balanceDue / 3` (⅓ de la
 *   cuenta ENTERA) aunque el pago fuera PARCIAL. En una mesa pagada en cuotas
 *   (ej. $52 en Cash y el resto en Zelle), el primer pago parcial se llevaba el
 *   descuento de toda la mesa y el siguiente volvía a descontar el remanente →
 *   sobre-descuento (la mesa cobró de menos ~$6–9).
 *
 * Modelo (decisión del dueño, 23/06): pagar en divisas = ⅓ off sobre la PORCIÓN
 * que se paga. Si se paga toda la cuenta, equivale exactamente a `balanceDue/3`
 * (idéntico al comportamiento previo, ya validado). Si se paga una parte, solo
 * esa parte recibe el −33,33%; el resto queda a precio pleno hasta pagarse.
 *
 * Convención de montos (igual que el resto del POS de mesa):
 *   - `balanceDue` = saldo BRUTO de ítems (pre-descuento, pre-servicio).
 *   - El 10% de servicio se calcula sobre el neto de ítems efectivamente pagado.
 *   - `receivedUSD` = divisas que entrega el cliente en este pago (ya con el
 *     beneficio de divisas, es decir lo que realmente paga, incluyendo servicio).
 *
 * Derivación: si el cliente entrega `R` en divisas y eso salda una porción bruta
 * `G` de la cuenta, entonces  R = (G·⅔)·(1 + servicio)  ⇒  G = R / (⅔ · mult).
 * Se topa `G` al `balanceDue` (no se puede saldar más que la cuenta).
 */

export interface DivisasSettlementInput {
    /** Saldo bruto de la mesa (ítems, pre-descuento, pre-servicio). */
    balanceDue: number;
    /** Divisas recibidas en este pago (lo que entrega el cliente). */
    receivedUSD: number;
    /** Si este cobro incluye el cargo de servicio. */
    serviceFeeIncluded: boolean;
    /** Tasa de servicio (fracción, ej. 0.10 = 10%). Default 0.10 (§85 —
     *  editable al cobro). Solo aplica si serviceFeeIncluded. */
    serviceRate?: number;
}

export interface DivisasSettlement {
    /** Porción BRUTA de la cuenta que cubre este pago (topada a balanceDue). */
    grossSettled: number;
    /** Descuento −33,33% sobre la porción pagada (= grossSettled / 3). */
    discountAmount: number;
    /** Neto de ítems aplicado al saldo (= grossSettled · ⅔). Lo que el servidor
     *  debe usar como `amount` para descontar bien el saldo y el 10%. */
    netItemsApplied: number;
    /** 10% de servicio sobre el neto aplicado (0 si no incluye servicio). */
    serviceFee: number;
    /** Factura real de este pago = netItemsApplied + serviceFee. */
    facturaReal: number;
}

const TWO_THIRDS = 2 / 3;

export function computeDivisasSettlement(input: DivisasSettlementInput): DivisasSettlement {
    const balanceDue = Math.max(0, Number.isFinite(input.balanceDue) ? input.balanceDue : 0);
    const received = Math.max(0, Number.isFinite(input.receivedUSD) ? input.receivedUSD : 0);
    const rate = input.serviceFeeIncluded
        ? (Number.isFinite(input.serviceRate as number) && (input.serviceRate as number) >= 0 ? (input.serviceRate as number) : 0.10)
        : 0;
    const serviceMult = 1 + rate;

    // Bruto que cubre lo recibido, topado al saldo de la mesa. Para un pago
    // completo (received ≥ target full divisas) el min() elige balanceDue →
    // discount = balanceDue/3 (idéntico al comportamiento previo).
    const grossSettled = Math.min(balanceDue, received / (TWO_THIRDS * serviceMult));
    const discountAmount = grossSettled / 3;
    const netItemsApplied = grossSettled - discountAmount; // = grossSettled · ⅔
    const serviceFee = netItemsApplied * rate;
    const facturaReal = netItemsApplied + serviceFee;

    return { grossSettled, discountAmount, netItemsApplied, serviceFee, facturaReal };
}
