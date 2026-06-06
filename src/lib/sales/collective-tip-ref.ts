/**
 * Vínculo de una propina colectiva (posterior al cierre) con la mesa de la
 * que provino. Se guarda dentro del `notes` del SalesOrder ficticio con un
 * marcador estable `[tab:<correlativo>]`, para mostrar el correlativo
 * vinculado en el historial sin necesidad de una columna nueva.
 *
 * Funciones puras y testeables, usadas por `recordCollectiveTipAction`
 * (escritura) y por el historial de ventas (lectura/display).
 */

const TAB_MARKER_RE = /\s*\[tab:([^\]]+)\]\s*/;

/** Inserta el marcador del correlativo de mesa al final de la nota. */
export function embedTabCode(note: string, tabCode?: string | null): string {
    const base = (note || '').trim() || 'Propina colectiva';
    const code = (tabCode || '').trim();
    if (!code) return base;
    return `${base} [tab:${code}]`;
}

/** Devuelve el correlativo de mesa vinculado, o null si no hay. */
export function extractTabCode(note?: string | null): string | null {
    if (!note) return null;
    const m = TAB_MARKER_RE.exec(note);
    return m ? m[1].trim() : null;
}

/** Nota legible sin el marcador técnico (para mostrar al usuario). */
export function stripTabMarker(note?: string | null): string {
    if (!note) return '';
    return note.replace(TAB_MARKER_RE, ' ').trim();
}
