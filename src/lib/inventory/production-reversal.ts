/**
 * §169 — Reverso de una producción cancelada. Puro.
 *
 * Reporte de Víctor (chef): *"Al cancelar la orden, teóricamente debe existir
 * un reverso de las producciones declaradas e insumos usados en la misma, y
 * esto no pasa — aunque cancele la orden las cantidades quedan sin descontar y
 * las producciones quedan intactas en el conteo del sistema."*
 *
 * Tenía razón: `deleteProductionOrderAction` sólo escribía
 * `status = 'CANCELLED'`. La etiqueta cambiaba, el inventario no. Un error de
 * tipeo en una producción quedaba grabado en el stock para siempre, y la
 * cancelación daba una falsa sensación de haberlo arreglado.
 *
 * El reverso es simétrico a lo que hizo la producción:
 *   - Los ingredientes consumidos (`PRODUCTION_OUT`, cantidad negativa)
 *     VUELVEN al almacén.
 *   - El producto terminado (`PRODUCTION_IN`, cantidad positiva) SALE del
 *     almacén.
 *
 * Nada se borra: el reverso son movimientos nuevos, de signo contrario, que
 * explican el ajuste en el Kardex. Los movimientos originales quedan como
 * hechos históricos — así se ve qué se produjo, qué se canceló y cuándo.
 */

export interface ProductionMovement {
    id: string;
    inventoryItemId: string;
    movementType: string;
    /** Con signo, tal como se guardó: negativo consumo, positivo producción. */
    quantity: number;
    unit: string;
    /** Almacén del movimiento. Null en movimientos anteriores a §169. */
    areaId?: string | null;
}

export interface ReversalLine {
    inventoryItemId: string;
    /** Cantidad CON SIGNO a aplicar al stock: + devuelve, − retira. */
    delta: number;
    unit: string;
    /** Tipo del movimiento de reverso a registrar. */
    movementType: 'PRODUCTION_IN' | 'PRODUCTION_OUT';
}

export type ReversalPlan =
    | { ok: true; lines: ReversalLine[]; areaId: string }
    | { ok: false; reason: 'NO_MOVEMENTS' | 'AREA_UNKNOWN' | 'AREA_AMBIGUOUS' };

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Arma el plan de reverso a partir de los movimientos que dejó la producción.
 *
 * @param movements  Movimientos PRODUCTION_IN / PRODUCTION_OUT de la orden.
 * @param fallbackAreaId Almacén indicado por quien cancela. Se usa sólo cuando
 *   los movimientos no lo traen (órdenes anteriores a §169, que no guardaban
 *   `areaId`). Nunca se adivina: sin dato y sin indicación, se rechaza.
 */
export function buildProductionReversal(
    movements: ProductionMovement[],
    fallbackAreaId?: string | null,
): ReversalPlan {
    const relevant = (movements ?? []).filter(
        m => m.movementType === 'PRODUCTION_IN' || m.movementType === 'PRODUCTION_OUT',
    );
    if (relevant.length === 0) return { ok: false, reason: 'NO_MOVEMENTS' };

    // El almacén sale de los propios movimientos. Si traen más de uno, no se
    // elige por mayoría: se aborta y que lo resuelva una persona.
    const areas = Array.from(new Set(relevant.map(m => m.areaId).filter(Boolean))) as string[];
    if (areas.length > 1) return { ok: false, reason: 'AREA_AMBIGUOUS' };
    const areaId = areas[0] ?? (fallbackAreaId || null);
    if (!areaId) return { ok: false, reason: 'AREA_UNKNOWN' };

    // Un mismo insumo puede aparecer en varias líneas (receta con el mismo
    // ingrediente repetido): se suman antes de invertir, para tocar el stock
    // una sola vez por insumo.
    const byItem = new Map<string, ReversalLine>();
    for (const m of relevant) {
        const qty = Number(m.quantity);
        if (!Number.isFinite(qty) || qty === 0) continue;
        // El reverso es el signo contrario de lo que hizo la producción.
        const delta = -qty;
        const prev = byItem.get(m.inventoryItemId);
        if (prev) {
            prev.delta = round4(prev.delta + delta);
        } else {
            byItem.set(m.inventoryItemId, {
                inventoryItemId: m.inventoryItemId,
                delta: round4(delta),
                unit: m.unit,
                movementType: delta > 0 ? 'PRODUCTION_IN' : 'PRODUCTION_OUT',
            });
        }
    }

    // Tras sumar, una línea puede quedar en cero (se produjo y se consumió el
    // mismo insumo en igual cantidad — el auto-consumo de §154): no se toca.
    const lines = Array.from(byItem.values())
        .filter(l => l.delta !== 0)
        .map(l => ({ ...l, movementType: (l.delta > 0 ? 'PRODUCTION_IN' : 'PRODUCTION_OUT') as ReversalLine['movementType'] }));

    if (lines.length === 0) return { ok: false, reason: 'NO_MOVEMENTS' };
    return { ok: true, lines, areaId };
}

export interface StockAfterReversal {
    inventoryItemId: string;
    /** Stock actual del insumo en el almacén. */
    current: number;
    /** Cómo queda tras aplicar el reverso. */
    after: number;
}

/**
 * Insumos que quedarían NEGATIVOS al revertir. Pasa cuando el producto
 * terminado ya se consumió o se vendió: retirarlo deja el saldo por debajo de
 * cero. No bloquea —el error de tipeo hay que corregirlo igual— pero quien
 * cancela tiene que verlo antes de confirmar (misma regla de §155).
 */
export function negativesAfterReversal(
    lines: ReversalLine[],
    stockByItem: Record<string, number>,
): StockAfterReversal[] {
    const out: StockAfterReversal[] = [];
    for (const l of lines) {
        const current = Number(stockByItem[l.inventoryItemId] ?? 0);
        const after = round4(current + l.delta);
        if (after < -0.0001) {
            out.push({ inventoryItemId: l.inventoryItemId, current, after });
        }
    }
    return out;
}
