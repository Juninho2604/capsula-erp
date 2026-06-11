const CARACAS_UTC_OFFSET_HOURS = -4;

export function getCaracasNowParts(date = new Date()) {
    const shifted = new Date(date.getTime() + CARACAS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        day: shifted.getUTCDate(),
    };
}

export function getCaracasDayRange(date = new Date()) {
    const { year, month, day } = getCaracasNowParts(date);
    const start = new Date(Date.UTC(year, month, day, 4, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day, 27, 59, 59, 999));
    return { start, end };
}

export function getCaracasDateStamp(date = new Date()) {
    const { year, month, day } = getCaracasNowParts(date);
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Convierte un string de fecha-sola "YYYY-MM-DD" (de un <input type="date">)
 * a un Date anclado al MEDIODÍA de Caracas (16:00 UTC). Así, al releerlo en
 * timezone Caracas, el día calendario coincide con el que el usuario eligió.
 *
 * Evita el bug de `new Date("YYYY-MM-DD")`, que ancla a medianoche UTC y en
 * Caracas (UTC-4) cae el día anterior → promos que "vencen un día antes".
 * Venezuela no tiene DST, así que el offset fijo -4 es seguro.
 */
export function caracasDateOnlyToDate(ymd: string | null | undefined): Date | null {
    if (!ymd) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    return new Date(Date.UTC(year, month - 1, day, 16, 0, 0, 0));
}
