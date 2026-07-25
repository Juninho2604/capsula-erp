/**
 * ID local único, seguro en contextos NO seguros (http:// de LAN).
 *
 * `crypto.randomUUID()` solo existe en secure contexts (HTTPS o localhost).
 * Desde el cutover on-premise (§118) el POS se sirve por `http://<ip-lan>`,
 * donde esa función es `undefined` y su llamada lanza TypeError. Incidente
 * real en Shanklish: el botón "Abrir Pickup" dejó de responder — el handler
 * moría en `crypto.randomUUID()` antes de crear el tab, sin feedback alguno.
 *
 * Estos IDs son claves de React/estado en memoria (pickup tabs, líneas de
 * carrito): solo necesitan ser únicos dentro de la sesión, no
 * criptográficamente aleatorios.
 */

let counter = 0;

export function localId(): string {
    // Camino nativo cuando el navegador lo ofrece (HTTPS, localhost).
    const c = globalThis.crypto as Crypto | undefined;
    if (typeof c?.randomUUID === 'function') {
        return c.randomUUID();
    }
    // Fallback: getRandomValues SÍ está disponible en http:// …
    if (typeof c?.getRandomValues === 'function') {
        const b = new Uint8Array(16);
        c.getRandomValues(b);
        const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    // …y si ni eso, timestamp + contador + random: suficiente para keys locales.
    counter += 1;
    return `id-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 10)}`;
}
