/**
 * Lógica pura de sesiones de conteo de inventario (§138).
 *
 * Sin Prisma ni I/O: solo cálculo, para poder testearlo entero. Las actions
 * cargan datos, llaman a estos helpers y persisten.
 *
 * Conceptos:
 *  - Una SESIÓN cubre N almacenes y vive en el servidor → se retoma desde
 *    cualquier dispositivo, hoy o mañana.
 *  - Cada ENTRADA es (item, almacén) → cantidad contada, con autor y hora.
 *  - Al APLICAR se calcula la varianza contra el stock del sistema y se
 *    ajusta el inventario.
 */

/** Estados posibles de una sesión. */
export type CountSessionStatus = 'OPEN' | 'REVIEW' | 'APPLIED' | 'CANCELLED';

/** Tipos de evento de la bitácora. */
export type CountEventType =
    | 'CREATED'
    | 'RESUMED'
    | 'REVIEW'
    | 'REOPENED'
    | 'APPLIED'
    | 'CANCELLED';

export interface CountEntryLike {
    inventoryItemId: string;
    areaId: string;
    qtyCounted: number;
}

/** Stock actual del sistema por (item, área). */
export interface StockLookup {
    inventoryItemId: string;
    areaId: string;
    currentStock: number;
}

export interface VarianceRow {
    inventoryItemId: string;
    areaId: string;
    counted: number;
    system: number;
    /** contado − sistema. Negativo = falta mercancía. */
    variance: number;
    /** |varianza| relativa al sistema. null si el sistema estaba en 0. */
    variancePct: number | null;
}

/** Clave estable para el par (item, área). */
export function entryKey(inventoryItemId: string, areaId: string): string {
    return `${inventoryItemId}::${areaId}`;
}

/**
 * Redondeo a 4 decimales — evita que 0.1+0.2 genere varianzas fantasma de
 * 1e-17 que después se ven como "diferencia" en pantalla.
 */
export function round4(n: number): number {
    return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/**
 * Calcula la varianza de cada cantidad contada contra el stock del sistema.
 * Las entradas sin stock conocido se tratan como sistema = 0 (item que nunca
 * tuvo ubicación en esa área: contarlo es un alta legítima).
 */
export function computeVariances(
    entries: CountEntryLike[],
    stock: StockLookup[],
): VarianceRow[] {
    const stockMap = new Map<string, number>();
    for (const s of stock) {
        stockMap.set(entryKey(s.inventoryItemId, s.areaId), s.currentStock);
    }

    return entries.map(e => {
        const system = stockMap.get(entryKey(e.inventoryItemId, e.areaId)) ?? 0;
        const counted = round4(e.qtyCounted);
        const variance = round4(counted - system);
        return {
            inventoryItemId: e.inventoryItemId,
            areaId: e.areaId,
            counted,
            system: round4(system),
            variance,
            variancePct: system === 0 ? null : round4((variance / system) * 100),
        };
    });
}

export interface VarianceFlagOptions {
    /** Diferencia absoluta a partir de la cual se marca. Default 5 unidades. */
    absThreshold?: number;
    /** Diferencia porcentual a partir de la cual se marca. Default 20%. */
    pctThreshold?: number;
}

/**
 * Diferencias que ameritan revisión humana antes de tocar el stock.
 *
 * Se marca si supera el umbral absoluto O el porcentual. El caso "sistema en
 * 0 y se contó algo" se marca siempre que supere el umbral absoluto: no hay
 * porcentaje que calcular pero sí es un alta que conviene mirar.
 *
 * Ordenadas por magnitud absoluta descendente: lo más grave primero.
 */
export function flagForReview(
    rows: VarianceRow[],
    opts: VarianceFlagOptions = {},
): VarianceRow[] {
    const absThreshold = opts.absThreshold ?? 5;
    const pctThreshold = opts.pctThreshold ?? 20;

    return rows
        .filter(r => {
            if (r.variance === 0) return false;
            if (Math.abs(r.variance) >= absThreshold) return true;
            if (r.variancePct !== null && Math.abs(r.variancePct) >= pctThreshold) return true;
            return false;
        })
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

export interface AreaProgress {
    areaId: string;
    counted: number;
    total: number;
    pct: number;
}

/**
 * Avance por almacén: cuántos items del catálogo ya tienen cantidad escrita.
 * Es lo que permite retomar mañana sabiendo exactamente qué falta.
 */
export function progressByArea(
    entries: CountEntryLike[],
    areaIds: string[],
    totalItems: number,
): AreaProgress[] {
    const perArea = new Map<string, Set<string>>();
    for (const e of entries) {
        const set = perArea.get(e.areaId) ?? new Set<string>();
        set.add(e.inventoryItemId);
        perArea.set(e.areaId, set);
    }

    return areaIds.map(areaId => {
        const counted = perArea.get(areaId)?.size ?? 0;
        return {
            areaId,
            counted,
            total: totalItems,
            pct: totalItems > 0 ? Math.round((counted / totalItems) * 100) : 0,
        };
    });
}

/**
 * Correlativo legible de la sesión: CNT-<año>-<mes>-<secuencia 3 dígitos>.
 * `existingThisMonth` es cuántas sesiones ya existen en ese mes.
 */
export function buildSessionCode(date: Date, existingThisMonth: number): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const seq = String(existingThisMonth + 1).padStart(3, '0');
    return `CNT-${year}-${month}-${seq}`;
}

/**
 * Transiciones de estado permitidas. Cualquier otra combinación se rechaza —
 * evita, por ejemplo, aplicar dos veces la misma sesión (que duplicaría los
 * ajustes de stock).
 */
const ALLOWED_TRANSITIONS: Record<CountSessionStatus, CountSessionStatus[]> = {
    OPEN: ['REVIEW', 'CANCELLED'],
    REVIEW: ['OPEN', 'APPLIED', 'CANCELLED'],
    APPLIED: [],
    CANCELLED: [],
};

export function canTransition(from: CountSessionStatus, to: CountSessionStatus): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Mensaje explicativo cuando la transición no está permitida. */
export function transitionError(from: CountSessionStatus, to: CountSessionStatus): string {
    if (from === 'APPLIED') return 'Esta sesión ya fue aplicada — no se puede modificar.';
    if (from === 'CANCELLED') return 'Esta sesión fue cancelada.';
    return `No se puede pasar de ${from} a ${to}.`;
}
