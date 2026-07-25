/**
 * Copiar al portapapeles funcionando también sobre http:// de LAN.
 *
 * `navigator.clipboard` es una API de secure context: existe en HTTPS y
 * localhost, pero es `undefined` sobre `http://<ip-lan>` — que es como se
 * sirve el POS desde el cutover on-premise (§118). Sin este helper, cada
 * "copiar" tira TypeError y la acción queda muerta.
 *
 * Fallback: `document.execCommand('copy')` sobre un textarea temporal.
 * Está deprecado pero es el único camino en contextos no seguros y sigue
 * soportado por todos los navegadores actuales.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
    // Camino moderno (HTTPS / localhost).
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Permiso denegado o documento sin foco → probamos el fallback.
        }
    }

    if (typeof document === 'undefined') return false;

    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        // Fuera de vista pero seleccionable (display:none no permite copiar).
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length); // iOS/Android necesitan el rango
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}
