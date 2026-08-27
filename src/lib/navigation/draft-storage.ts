/**
 * §167 — Borradores de formulario que sobreviven al «atrás». Puro.
 *
 * La otra mitad del reporte de David: *"guardar el avance que se había
 * realizado"*. Retroceder de pestaña no sirve de nada si al volver el
 * formulario está en blanco y hay que empezar de cero.
 *
 * El borrador vive en el navegador de quien lo escribe. No es un guardado de
 * verdad ni pretende serlo: es la red que evita perder veinte líneas cargadas a
 * mano por un toque accidental. Se borra solo al confirmar la operación.
 *
 * Cuidado del entorno (ver `docs/SHANKLISH_ONPREM_ASBUILT.md` §4.1): el POS
 * on-premise se sirve por `http://<ip-lan>`, que no es un contexto seguro. Eso
 * no afecta a `localStorage`, pero sí puede lanzar en modo privado o con las
 * cookies de sitio bloqueadas — por eso todo acceso va con guarda y try/catch,
 * y una falla al guardar nunca rompe la pantalla.
 */

const PREFIX = 'kpsula.draft.';

export const draftKey = (module: string, name: string) => `${PREFIX}${module}.${name}`;

/**
 * Interpreta lo guardado. Si el borrador está corrupto, es de una versión vieja
 * del formulario, o simplemente no es lo que se esperaba, se descarta en
 * silencio y se arranca limpio: un formulario en blanco es molesto, uno con
 * basura a medio leer es peor.
 */
export function parseDraft<T>(raw: string | null, fallback: T, isValid?: (v: unknown) => boolean): T {
    if (!raw) return fallback;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return fallback;
    }
    if (parsed === null || parsed === undefined) return fallback;
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
}

/** ¿Vale la pena ofrecer este borrador? Uno vacío no se le muestra a nadie. */
export function isDraftWorthRestoring(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object') return Object.keys(value as object).length > 0;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    return Boolean(value);
}

// ── Acceso al almacenamiento, siempre con guarda ────────────────────────────

function storage(): Storage | null {
    try {
        if (typeof window === 'undefined' || !('localStorage' in window)) return null;
        return window.localStorage;
    } catch {
        return null;
    }
}

export function readDraft<T>(key: string, fallback: T, isValid?: (v: unknown) => boolean): T {
    const s = storage();
    if (!s) return fallback;
    try {
        return parseDraft(s.getItem(key), fallback, isValid);
    } catch {
        return fallback;
    }
}

/** Devuelve si pudo guardar. No lanza nunca: perder el borrador no es un error. */
export function writeDraft(key: string, value: unknown): boolean {
    const s = storage();
    if (!s) return false;
    try {
        s.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        // Cuota llena o almacenamiento bloqueado. Se sigue trabajando sin red.
        return false;
    }
}

export function clearDraft(key: string): void {
    const s = storage();
    if (!s) return;
    try {
        s.removeItem(key);
    } catch {
        /* nada que hacer */
    }
}
