/**
 * Tipos compartidos de la capa de servicios de reportería (Prompt 2 — FASE A).
 *
 * Contratos de la capa:
 *  - Toda función recibe `ReportFilters` con el tenantId YA resuelto por la
 *    server action desde la sesión (NUNCA del cliente).
 *  - `branchIds` filtra `SalesOrder.branchId` cuando aplica. Vacío/undefined
 *    = todas las sucursales (consolidado). Nota: las ventas directas
 *    históricas tienen branchId NULL (BUG #5 — poblado desde 2026-06-10);
 *    al filtrar por sucursal el legado sin branch queda fuera.
 *  - Dual currency: los montos Bs provienen SOLO de valores persistidos con
 *    su tasa histórica (SalesOrderPayment.amountBS, PaymentSplit.amountBs,
 *    SalesOrder.totalBs). Lo que no tiene Bs persistido se reporta en
 *    `usdSinTasa` — JAMÁS se reconvierte con la tasa de hoy.
 *  - Solo lectura: ningún servicio muta datos.
 */

export interface ReportFilters {
    tenantId: string;
    /** Rango [from, to] en UTC, ya convertido desde día Caracas por la action. */
    from: Date;
    to: Date;
    /** Sucursales permitidas/seleccionadas. Vacío = consolidado. */
    branchIds?: string[];
}

/** Monto dual: USD siempre; Bs solo si la tasa histórica está persistida. */
export interface DualMoney {
    usd: number;
    /** Suma de montos Bs persistidos con tasa histórica. */
    bs: number;
    /** Porción del USD que NO tiene Bs/tasa persistida ("Bs no registrado"). */
    usdSinTasa: number;
}

export const emptyDualMoney = (): DualMoney => ({ usd: 0, bs: 0, usdSinTasa: 0 });

/** Criterio de los reportes de ventas por dimensión (ver DIAGNOSTICO BUG #7):
 *  FACTURADO = órdenes no anuladas y no-PROPINA COLECTIVA del rango (igual a
 *  `revenueWhere` de Finanzas/Dashboard — incluye mesas abiertas sin cobrar).
 *  COBRADO  = líneas de pago (directas) + splits PAID (mesas).
 *  El cruce FACTURADO↔COBRADO con su puente vive en verify-reports.ts. */
export type SalesCriterion = 'FACTURADO' | 'COBRADO';
