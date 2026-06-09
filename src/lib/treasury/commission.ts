/**
 * Motor de comisiones bancarias (Tesorería Fase 1).
 *
 * Cada terminal (PDV) cobra un % sobre el monto en Bs de la transacción.
 * El método de pago de la venta (`SalesOrderPayment.method`) se mapea al
 * terminal vía `PosTerminal.posMethodKey`; de ahí salen la cuenta y el %.
 *
 * Funciones puras (sin DB) para que sean testeables y reusables por la
 * pantalla de conciliación (Fase 2).
 */

export interface TerminalLike {
    posMethodKey: string | null;
    commissionPct: number;
    bankAccountId: string;
    isActive: boolean;
}

/** Redondeo a 2 decimales (céntimos de Bs). */
function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Terminal ACTIVO cuyo `posMethodKey` coincide con el método de pago.
 * Devuelve null si ningún terminal mapea ese método.
 */
export function resolveTerminalForMethod<T extends TerminalLike>(
    method: string | null | undefined,
    terminals: T[]
): T | null {
    if (!method) return null;
    return terminals.find((t) => t.isActive && t.posMethodKey === method) ?? null;
}

/** Comisión en Bs: `amountBs × pct / 100`. Negativos/0 → 0. */
export function commissionBs(amountBs: number, commissionPct: number): number {
    if (!amountBs || amountBs <= 0 || !commissionPct || commissionPct <= 0) return 0;
    return round2((amountBs * commissionPct) / 100);
}

/** Monto neto en Bs tras descontar la comisión. */
export function netBs(amountBs: number, commissionPct: number): number {
    const gross = amountBs > 0 ? amountBs : 0;
    return round2(gross - commissionBs(amountBs, commissionPct));
}
