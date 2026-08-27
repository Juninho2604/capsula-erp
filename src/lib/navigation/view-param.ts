/**
 * §167 — La vista activa de un módulo, guardada en la URL. Puro.
 *
 * Reporte de David: en Compras (y en la mayoría de los módulos con pestañas)
 * "no hay una manera de retroceder: hay que ir al menú de inicio y reiniciar
 * todos los pasos". La causa es que la vista activa vive sólo en memoria del
 * componente, no en la dirección. Entonces el botón «atrás» —el del navegador
 * en la PC, el gesto en el teléfono— no retrocede de pestaña: **saca del módulo
 * entero**, y lo que se estaba llenando se pierde.
 *
 * Con la vista en la URL (`?v=receive`), el historial del navegador entiende el
 * módulo: atrás vuelve a la pestaña anterior, adelante rehace, y refrescar o
 * compartir el enlace cae en la misma pantalla.
 *
 * Acá va sólo lo que se puede probar sin navegador; el hook que toca `history`
 * está en `@/lib/hooks/use-view-param`.
 */

/**
 * Lee la vista desde la query string, validándola contra las vistas que el
 * módulo realmente tiene. Un valor inventado o ausente cae al inicio — nunca
 * deja la pantalla en un estado que no existe.
 */
export function parseViewParam<T extends string>(
    search: string,
    key: string,
    valid: readonly T[],
    fallback: T,
): T {
    let raw: string | null = null;
    try {
        raw = new URLSearchParams(search || '').get(key);
    } catch {
        return fallback;
    }
    if (!raw) return fallback;
    return (valid as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * Arma la query string con la vista puesta, conservando los demás parámetros
 * (filtros, búsquedas) que el módulo ya tuviera en la dirección.
 *
 * La vista inicial se representa **quitando** el parámetro: así la dirección
 * "limpia" del módulo es la de su pantalla de entrada, y no se acumula ruido.
 */
export function buildViewSearch<T extends string>(
    search: string,
    key: string,
    view: T,
    fallback: T,
): string {
    const params = new URLSearchParams(search || '');
    if (view === fallback) params.delete(key);
    else params.set(key, view);
    const s = params.toString();
    return s ? `?${s}` : '';
}
