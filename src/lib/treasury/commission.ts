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

// ─── Comisiones configurables por dirección y contraparte (Fase 3) ───────────

export type Counterparty = 'NATURAL' | 'JURIDICA';
export type CommissionDirection = 'IN' | 'OUT';

export interface TerminalCommissionConfig {
    commissionPct: number; // legado (fallback de natural)
    commNaturalPct: number;
    commJuridicaPct: number;
}

export interface AccountCommissionConfig {
    commInNaturalPct: number;
    commInJuridicaPct: number;
    commOutNaturalPct: number;
    commOutJuridicaPct: number;
}

/**
 * % de comisión de un PDV (ingreso) según la contraparte. Natural cae al %
 * legado (`commissionPct`) si no se configuró el nuevo campo.
 */
export function terminalCommissionPct(t: TerminalCommissionConfig, cp: Counterparty): number {
    if (cp === 'JURIDICA') return t.commJuridicaPct || 0;
    return t.commNaturalPct || t.commissionPct || 0;
}

/**
 * % de comisión de la cuenta (pago móvil / transferencia, sin PDV) según
 * dirección (ingreso/egreso) y contraparte. Regla típica VE: ingreso natural
 * suele ser 0; egreso cobra a ambas. Todo configurable.
 */
export function accountCommissionPct(a: AccountCommissionConfig, dir: CommissionDirection, cp: Counterparty): number {
    if (dir === 'IN') return cp === 'JURIDICA' ? (a.commInJuridicaPct || 0) : (a.commInNaturalPct || 0);
    return cp === 'JURIDICA' ? (a.commOutJuridicaPct || 0) : (a.commOutNaturalPct || 0);
}
