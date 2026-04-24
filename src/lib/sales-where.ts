/**
 * Canonical Prisma `where` clauses for SalesOrder revenue queries.
 *
 * Single source of truth so every surface (dashboard, estadísticas, metas,
 * finanzas, Z-report) stays in sync. Rules encoded here:
 *   1. Exclude CANCELLED orders.
 *   2. Exclude PROPINA COLECTIVA orders (they get their own KPI).
 *   3. Date range must always be Caracas-timezone-aware (caller provides it).
 */

/** Revenue orders in a date range — excludes cancelled + propinas colectivas. */
export function revenueWhere(start: Date, end: Date) {
    return {
        status: { not: 'CANCELLED' } as const,
        customerName: { not: 'PROPINA COLECTIVA' } as const,
        createdAt: { gte: start, lte: end },
    };
}

/** Propinas colectivas in a date range. */
export function propinasWhere(start: Date, end: Date) {
    return {
        status: { not: 'CANCELLED' } as const,
        customerName: 'PROPINA COLECTIVA' as const,
        createdAt: { gte: start, lte: end },
    };
}

/** Cancelled (voided) orders in a date range — keyed on voidedAt. */
export function cancelledWhere(start: Date, end: Date) {
    return {
        status: 'CANCELLED' as const,
        voidedAt: { gte: start, lte: end },
    };
}
