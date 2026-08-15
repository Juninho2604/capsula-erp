/**
 * Faltantes de stock al producir (§155) — puro.
 *
 * Por qué existe: el sistema bloqueaba una producción cuando el stock
 * registrado no alcanzaba. Pero la materia prima muchas veces SÍ está en el
 * restaurante — lo que falta es cargar la entrada. Bloquear no protege el
 * inventario: la producción ocurre igual en la cocina y queda sin registrar,
 * y eso rompe el costo del plato, el Kardex y el conteo siguiente sin dejar
 * rastro de por qué.
 *
 * Decisión de Omar (2026-08-15): dejar registrar la producción y que el
 * insumo quede en NEGATIVO. El negativo es una deuda visible que se salda
 * sola al cargar la entrada; la producción no registrada es invisible.
 *
 * Cómo se protege el dato:
 *  - No es automático: hay que confirmar viendo la lista de qué queda en
 *    negativo y cuánto. Ese listado es lo que separa el caso real de un
 *    error de tipeo (litros donde iban mililitros).
 *  - Queda rastro en la orden y en los movimientos, con quién lo registró.
 *  - Los negativos tienen que quedar VISIBLES después (ver §155 en el
 *    contexto): un negativo que nadie mira es el descuadre de la masa filo.
 */

export interface StockRequirementRow {
    itemId: string;
    name: string;
    /** Cantidad necesaria (ya con merma aplicada, si aplica). */
    required: number;
    /** Stock disponible en el área. Puede ser negativo si ya venía en rojo. */
    available: number;
    unit: string;
}

export interface ShortfallLine extends StockRequirementRow {
    /** Cuánto falta (siempre > 0). */
    shortfall: number;
    /** Saldo en el que queda el insumo tras la producción (negativo). */
    resulting: number;
}

/** Líneas que no alcanzan. Vacío = hay stock para todo. */
export function computeShortfalls(rows: StockRequirementRow[]): ShortfallLine[] {
    const out: ShortfallLine[] = [];
    for (const r of rows) {
        const required = num(r.required);
        const available = num(r.available);
        // Tolerancia de un gramo/mililitro: sin esto un residuo de coma
        // flotante (0.30000000000000004 vs 0.3) dispara un falso faltante.
        if (available >= required - 0.001) continue;
        out.push({
            ...r,
            required,
            available,
            shortfall: round3(required - available),
            resulting: round3(available - required),
        });
    }
    return out;
}

/** Resumen de una línea, para la confirmación y para el mensaje de error. */
export function describeShortfall(line: ShortfallLine): string {
    return `${line.name}: necesario ${trim(line.required)} ${line.unit}, `
        + `disponible ${trim(line.available)} ${line.unit} → quedaría en ${trim(line.resulting)} ${line.unit}`;
}

export function shortfallMessage(lines: ShortfallLine[]): string {
    return lines.map(describeShortfall).join('\n');
}

/** Nota que se guarda en la orden y en los movimientos, para el Kardex. */
export function shortfallAuditNote(lines: ShortfallLine[]): string {
    const detalle = lines.map(l => `${l.name} ${trim(l.shortfall)} ${l.unit}`).join(', ');
    return `Producción registrada con faltante de inventario: ${detalle}. `
        + 'Los insumos quedan en negativo hasta que se cargue la entrada correspondiente.';
}

function num(n: number): number {
    return Number.isFinite(n) ? n : 0;
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

function trim(n: number): string {
    return (Math.round(n * 1000) / 1000).toString();
}
