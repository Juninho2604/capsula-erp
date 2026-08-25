/**
 * Agregación de las notas de un plato despachado (§156.1) — pura.
 *
 * El "Arma tu Shawarma" se vende sin receta: lo que llevó cada unidad va en la
 * nota del ítem. Para descargar el consumo del período, quien hace el
 * inventario necesita LEER esas notas juntas — no abrir 37 ventas una por una.
 *
 * Agrupa por texto de nota normalizado y suma unidades, de mayor a menor: así
 * "12 × kibe + pollo" se multiplica de una vez en vez de contarse a mano.
 *
 * Las unidades SIN nota se cuentan aparte a propósito. Ese número es una
 * señal operativa: si crece, los mesoneros dejaron de escribir qué lleva el
 * plato, y el descargo pasa a ser adivinanza.
 */

export interface SoldLine {
    /** Nota del ítem tal como la escribió el mesonero. */
    note: string | null;
    /** Unidades de esa línea. */
    quantity: number;
}

export interface NoteGroup {
    /** Texto normalizado que se muestra. */
    note: string;
    /** Unidades totales despachadas con esa nota. */
    units: number;
    /** Cuántas líneas de venta distintas la comparten. */
    lines: number;
}

export interface DischargeNotesSummary {
    groups: NoteGroup[];
    /** Unidades despachadas sin ninguna nota. */
    withoutNote: number;
    /** Total de unidades del período (con y sin nota). */
    totalUnits: number;
}

/**
 * Normaliza para agrupar: espacios colapsados, sin mayúsculas/minúsculas ni
 * acentos. "Kibe + Pollo" y "kibe  +  pollo" son la misma combinación.
 */
export function normalizeNote(note: string | null | undefined): string {
    return (note ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function summarizeDischargeNotes(lines: SoldLine[]): DischargeNotesSummary {
    const byNote = new Map<string, { display: string; units: number; lines: number }>();
    let withoutNote = 0;
    let totalUnits = 0;

    for (const line of lines) {
        const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
        if (qty <= 0) continue;
        totalUnits += qty;

        const key = normalizeNote(line.note);
        if (!key) { withoutNote += qty; continue; }

        const prev = byNote.get(key);
        if (prev) {
            prev.units += qty;
            prev.lines += 1;
        } else {
            // Se muestra la primera redacción vista, no la normalizada: el
            // chef lee lo que escribió el mesonero, con sus mayúsculas.
            byNote.set(key, { display: (line.note ?? '').trim(), units: qty, lines: 1 });
        }
    }

    const groups: NoteGroup[] = Array.from(byNote.values())
        .map(v => ({ note: v.display, units: v.units, lines: v.lines }))
        // Más despachado primero: es el que más pesa en el descargo.
        .sort((a, b) => b.units - a.units || a.note.localeCompare(b.note));

    return { groups, withoutNote, totalUnits };
}
