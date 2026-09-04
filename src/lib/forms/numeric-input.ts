/**
 * §170 — Escribir números sin que el campo pelee. Puro.
 *
 * Reporte de Víctor: *"en el cuadro donde se pone la cantidad del ingrediente
 * no deja escribir el 0. Hay que escribir primero el número mayor a 0 y luego
 * mover el cursor a la izquierda y escribir el punto al lado y poner el 0."*
 *
 * La causa es un patrón repetido en 23 campos del sistema:
 *
 *     value={cantidad || ''}
 *     onChange={e => setCantidad(parseFloat(e.target.value) || 0)}
 *
 * Al teclear `0`: `parseFloat('0')` es 0, `0 || 0` es 0, y entonces
 * `value={0 || ''}` **vacía el campo**. El cero desaparece mientras se escribe.
 * Después el punto tampoco sobrevive (`parseFloat('0.')` vuelve a dar 0), así
 * que escribir "0.5" de corrido es imposible — hay que hacer el truco del
 * cursor que describe Víctor.
 *
 * La salida es no guardar un número mientras se escribe: se guarda el TEXTO
 * tal cual, y se convierte a número sólo cuando el texto ya es un número. Los
 * estados intermedios (`''`, `0`, `0.`, `.`) son válidos y se respetan.
 *
 * Coma y punto valen igual: en Venezuela el decimal se teclea con coma y los
 * teclados numéricos táctiles suelen dar coma.
 */

/** Deja sólo lo que puede formar un número: dígitos, un separador decimal y un signo inicial. */
export function sanitizeNumericText(raw: string, opts?: { allowNegative?: boolean }): string {
    let s = (raw ?? '').replace(/[^\d.,-]/g, '');

    // Signo: sólo al principio, y sólo si se permite.
    const negative = opts?.allowNegative && s.startsWith('-');
    s = s.replace(/-/g, '');

    // Un solo separador decimal: se conserva el primero, los demás se caen.
    const firstSep = s.search(/[.,]/);
    if (firstSep !== -1) {
        s = s.slice(0, firstSep + 1) + s.slice(firstSep + 1).replace(/[.,]/g, '');
    }

    return (negative ? '-' : '') + s;
}

/**
 * Convierte a número. Devuelve null cuando el texto todavía no es un número
 * (vacío, sólo el punto, sólo el signo) — que NO es lo mismo que cero.
 */
export function parseNumericText(raw: string): number | null {
    const s = (raw ?? '').trim().replace(',', '.');
    if (s === '' || s === '.' || s === '-' || s === '-.') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/**
 * ¿Este texto es un paso intermedio legítimo mientras se escribe?
 * `0`, `0.`, `.`, `-` y el vacío lo son: el campo debe dejarlos quietos.
 */
export function isIntermediateNumericText(raw: string): boolean {
    const s = (raw ?? '').trim();
    if (s === '' || s === '.' || s === ',' || s === '-') return true;
    return /^-?\d*[.,]$/.test(s);
}

/**
 * Texto a mostrar cuando el valor viene de afuera (carga inicial, reset).
 * Un valor nulo o cero-por-defecto se muestra vacío para no estorbar al
 * teclear encima; un cero explícito sí se muestra.
 */
export function formatNumericValue(value: number | null | undefined, opts?: { showZero?: boolean }): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    if (value === 0 && !opts?.showZero) return '';
    return String(value);
}
