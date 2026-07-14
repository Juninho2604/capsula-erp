/**
 * §115 — Liquidación de una cuenta por pagar (factura de proveedor). PURO.
 *
 * Una factura se salda por TRES vías, y cada una cuenta distinto para el
 * flujo de caja (clave para NO duplicar egresos):
 *
 *   1. Pagos en EFECTIVO (AccountPayment isCash=true): sale plata de verdad.
 *      Cuentan como egreso.
 *   2. Aplicación de ANTICIPO (AccountPayment isCash=false): el efectivo ya
 *      salió cuando se hizo el anticipo (SupplierAdvance). Aplicarlo a la
 *      factura NO mueve caja — solo asigna. NO cuenta como egreso.
 *   3. RETENCIONES IVA/ISLR: plata que se le retiene al proveedor (se paga
 *      luego al fisco). NO sale al proveedor → NO es egreso hacia él. Cierra
 *      saldo de la factura sin caja.
 *
 * saldoPendiente = total − pagos(cash+noCash) − retenciónIVA − retenciónISLR
 *
 * Todos los montos en USD. round2 en cada frontera para evitar centavos
 * fantasma.
 */

export function round2(n: number): number {
    return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export type PayableStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export interface PayableSettlementInput {
    totalUsd: number;
    /** Suma de TODOS los pagos aplicados (efectivo + aplicaciones de anticipo). */
    paidUsd: number;
    retentionIvaUsd?: number;
    retentionIslrUsd?: number;
}

export interface PayableSettlement {
    /** Lo aplicado por retenciones (IVA + ISLR). */
    retainedUsd: number;
    /** Total cubierto = pagos + retenciones. */
    settledUsd: number;
    /** Saldo pendiente (≥ 0). */
    remainingUsd: number;
    status: PayableStatus;
    /** true si la factura quedó saldada (saldo < 1¢). */
    isClosed: boolean;
}

const EPS = 0.01;

export function settlePayable(input: PayableSettlementInput): PayableSettlement {
    const total = Math.max(0, round2(input.totalUsd));
    const paid = Math.max(0, round2(input.paidUsd));
    const iva = Math.max(0, round2(input.retentionIvaUsd ?? 0));
    const islr = Math.max(0, round2(input.retentionIslrUsd ?? 0));
    const retained = round2(iva + islr);
    const settled = round2(paid + retained);
    const rawRemaining = round2(total - settled);
    const isClosed = rawRemaining <= EPS;
    const remaining = isClosed ? 0 : rawRemaining;
    const status: PayableStatus = isClosed ? 'PAID' : settled > EPS ? 'PARTIAL' : 'PENDING';
    return { retainedUsd: retained, settledUsd: settled, remainingUsd: remaining, status, isClosed };
}

/**
 * Valida que un nuevo pago/retención no exceda el saldo. Devuelve el máximo
 * aplicable (por si el caller quiere recortar en vez de rechazar).
 */
export interface ApplyCheck {
    ok: boolean;
    maxApplicableUsd: number;
    reason?: string;
}

export function checkPaymentFits(args: {
    totalUsd: number;
    alreadyPaidUsd: number;
    alreadyRetainedUsd: number;
    newAmountUsd: number;
}): ApplyCheck {
    const total = Math.max(0, round2(args.totalUsd));
    const covered = round2(Math.max(0, args.alreadyPaidUsd) + Math.max(0, args.alreadyRetainedUsd));
    const maxApplicable = round2(Math.max(0, total - covered));
    const amount = round2(args.newAmountUsd);
    if (amount <= 0) return { ok: false, maxApplicableUsd: maxApplicable, reason: 'El monto debe ser mayor a 0' };
    if (amount > maxApplicable + EPS) {
        return { ok: false, maxApplicableUsd: maxApplicable, reason: `Excede el saldo pendiente ($${maxApplicable.toFixed(2)})` };
    }
    return { ok: true, maxApplicableUsd: maxApplicable };
}

/**
 * Monto de un anticipo que se puede aplicar a una factura: el mínimo entre lo
 * que le queda al anticipo y lo que le queda a la factura. Nunca negativo.
 */
export function applicableAdvance(advanceRemainingUsd: number, payableRemainingUsd: number): number {
    return round2(Math.max(0, Math.min(
        Math.max(0, advanceRemainingUsd),
        Math.max(0, payableRemainingUsd),
    )));
}

/** Saldo no aplicado de un anticipo. */
export function advanceRemaining(amountUsd: number, appliedUsd: number): number {
    return round2(Math.max(0, Math.max(0, amountUsd) - Math.max(0, appliedUsd)));
}
