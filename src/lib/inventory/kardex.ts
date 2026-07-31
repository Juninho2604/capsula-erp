/**
 * Kardex de inventario (§145) — lógica pura, sin I/O.
 *
 * Un Kardex responde, por producto: qué entró, qué salió, quién lo hizo y
 * cuál era el saldo después de cada movimiento. Acá vive el cálculo; la
 * action carga datos y la vista pinta.
 *
 * El saldo corrido se reconstruye HACIA ATRÁS desde el stock actual (que es
 * el dato confiable): saldo tras el movimiento más reciente = stock actual;
 * cada paso hacia el pasado deshace el delta. Así el Kardex de un rango
 * acotado (30 días) no necesita recorrer toda la historia.
 */

/** Tipos de movimiento que SUMAN stock. */
const IN_TYPES = new Set([
    'PURCHASE',
    'PRODUCTION',
    'PRODUCTION_IN',
    'ADJUSTMENT_IN',
    'TRANSFER_IN',
    'LOAN_RETURN',
    'INCOMING',
]);

/** Tipos que RESTAN stock. */
const OUT_TYPES = new Set([
    'SALE',
    'PRODUCTION_OUT',
    'ADJUSTMENT_OUT',
    'TRANSFER_OUT',
    'WASTE',
    'LOAN_OUT',
    'OUTGOING',
]);

export type MovementDirection = 'IN' | 'OUT' | 'UNKNOWN';

export function movementDirection(type: string): MovementDirection {
    const t = (type || '').toUpperCase();
    if (IN_TYPES.has(t)) return 'IN';
    if (OUT_TYPES.has(t)) return 'OUT';
    // Heurística para tipos legacy no listados: el sufijo manda.
    if (t.endsWith('_IN')) return 'IN';
    if (t.endsWith('_OUT')) return 'OUT';
    return 'UNKNOWN';
}

/** Delta con signo que el movimiento aplicó al stock. UNKNOWN → 0 (se marca). */
export function movementDelta(type: string, quantity: number): number {
    const dir = movementDirection(type);
    const qty = Math.abs(quantity);
    if (dir === 'IN') return qty;
    if (dir === 'OUT') return -qty;
    return 0;
}

export interface KardexMovementInput {
    id: string;
    movementType: string;
    quantity: number;
    /** Fecha del movimiento — solo para verificación de orden. */
    createdAt: Date | string;
}

export interface KardexRow<T extends KardexMovementInput = KardexMovementInput> {
    movement: T;
    direction: MovementDirection;
    /** Cantidad que entró (0 si fue salida). */
    qtyIn: number;
    /** Cantidad que salió (0 si fue entrada). */
    qtyOut: number;
    /** Stock que quedó DESPUÉS de este movimiento. */
    balanceAfter: number;
}

/**
 * Reconstruye el saldo corrido. `movementsDesc` DEBE venir del más reciente
 * al más antiguo (orden del Kardex en pantalla); `currentStock` es el stock
 * vigente del producto en el ámbito elegido (un almacén o global).
 *
 * Devuelve las filas en el mismo orden (desc) + el saldo al inicio del rango
 * (lo que había antes del movimiento más antiguo mostrado).
 */
export function computeRunningBalances<T extends KardexMovementInput>(
    movementsDesc: T[],
    currentStock: number,
): { rows: KardexRow<T>[]; openingBalance: number } {
    const rows: KardexRow<T>[] = [];
    let balance = round4(currentStock);

    for (const m of movementsDesc) {
        const dir = movementDirection(m.movementType);
        const delta = movementDelta(m.movementType, m.quantity);
        rows.push({
            movement: m,
            direction: dir,
            qtyIn: delta > 0 ? delta : 0,
            qtyOut: delta < 0 ? -delta : 0,
            balanceAfter: balance,
        });
        // Deshacer el delta para conocer el saldo previo a este movimiento.
        balance = round4(balance - delta);
    }

    return { rows, openingBalance: balance };
}

/**
 * Conciliación global: ¿la suma de TODOS los movimientos de la historia
 * explica el stock actual? La diferencia típica viene de cargas iniciales
 * por Excel sin movimiento, o de módulos que ajustaron stock directo.
 *
 * `sumAllDeltas` = Σ movementDelta sobre toda la historia del producto.
 */
export function reconcile(currentStock: number, sumAllDeltas: number): {
    /** stock actual − lo que los movimientos explican. */
    unexplained: number;
    /** true si el descuadre es relevante (> 0.01 en valor absoluto). */
    hasDiscrepancy: boolean;
} {
    const unexplained = round4(currentStock - sumAllDeltas);
    return { unexplained, hasDiscrepancy: Math.abs(unexplained) > 0.01 };
}

export function round4(n: number): number {
    return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
