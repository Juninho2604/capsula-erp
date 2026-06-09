/**
 * Motor de conciliación bancaria (Tesorería Fase 2).
 *
 * Compara lo que el sistema espera que entró a la cuenta (ventas PDV/PM) contra
 * lo que el estado de cuenta del banco dice que llegó. La brecha debería ser la
 * comisión: si la comisión implícita por el banco coincide con la calculada, la
 * cuenta concilia.
 *
 *   comisiónImplícita = expectedIn − statementIn   (lo que el banco se quedó)
 *   differential      = comisiónImplícita − commissionCalc
 *
 *   differential ≈ 0  → RECONCILED  (el modelo de comisión es correcto)
 *   |differential| > tolerancia → DISCREPANCY (el banco cobró distinto)
 *   statementIn sin teclear → OPEN
 *
 * Montos en la moneda de la cuenta (Bs o $). Funciones puras (sin DB).
 */

export type ReconStatus = 'OPEN' | 'RECONCILED' | 'DISCREPANCY';

export interface ReconInput {
    expectedIn: number;
    commissionCalc: number;
    statementIn: number | null | undefined;
}

export interface ReconResult {
    differential: number;
    status: ReconStatus;
}

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Tolerancia por defecto para considerar conciliado: el mayor entre 1 unidad
 * de moneda y 0.5% del monto esperado (absorbe redondeos de tasa/centavos).
 */
export function defaultTolerance(expectedIn: number): number {
    return Math.max(1, Math.abs(expectedIn) * 0.005);
}

export function computeReconciliation(
    input: ReconInput,
    tolerance?: number
): ReconResult {
    if (input.statementIn === null || input.statementIn === undefined) {
        return { differential: 0, status: 'OPEN' };
    }
    const impliedCommission = input.expectedIn - input.statementIn;
    const differential = round2(impliedCommission - input.commissionCalc);
    const tol = tolerance ?? defaultTolerance(input.expectedIn);
    const status: ReconStatus = Math.abs(differential) <= tol ? 'RECONCILED' : 'DISCREPANCY';
    return { differential, status };
}

/**
 * Pérdida BCV en USD (solo cuentas Bs). Mismo Bs vale menos $ a la tasa de
 * liquidación que a la de la venta:
 *   pérdida = USD_reconocido_al_vender − USD_realizado_al_liquidar
 *           = usdAtSale − (expectedInBs / rateSettle)
 * Negativos (ganancia cambiaria) se reportan tal cual. Devuelve 0 si la tasa
 * de liquidación no es válida.
 */
export function computeBcvLossUsd(
    usdAtSale: number,
    expectedInBs: number,
    rateSettle: number | null | undefined
): number {
    if (!rateSettle || rateSettle <= 0) return 0;
    return round2(usdAtSale - expectedInBs / rateSettle);
}
