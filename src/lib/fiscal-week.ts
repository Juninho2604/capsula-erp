import { getCaracasNowParts } from './datetime';

/**
 * Semana fiscal estilo Excel "SC Capital" (cliente Shanklish).
 *
 * Reglas:
 *  - Semanas Lunes → Domingo.
 *  - Cada semana pertenece al mes que contiene su JUEVES (regla ISO-8601).
 *  - Numeradas S1..S5 dentro del mes: `week = ceil(díaDelJueves / 7)`.
 *
 * Por qué el jueves: garantiza que ~4 meses al año tengan una 5ª semana
 * (≈ "cada tres meses una S5", como lo piensa el dueño) y que la semana
 * caiga en el mes donde está la mayoría de sus días.
 *
 * IMPORTANTE — es un DEFAULT determinístico, no una verdad rígida:
 * el Excel real tiene ajustes manuales de borde (sobre todo en el arranque
 * de año). Por eso `BankReconciliation.fiscalWeek` / `BankAdjustment.fiscalWeek`
 * se guardan como string EDITABLE — este helper solo pre-llena el valor.
 *
 * La fecha se interpreta en zona horaria America/Caracas (igual que el resto
 * del sistema, vía `datetime.ts`).
 */

const MESES = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FiscalWeek {
    /** Año del mes fiscal (el del jueves de la semana). */
    year: number;
    /** Mes fiscal 1-12 (el del jueves de la semana). */
    month: number;
    /** Número de semana dentro del mes fiscal, 1-5. */
    week: number;
    /** Etiqueta estilo Excel, ej: "S5 ABRIL". */
    label: string;
}

/**
 * Devuelve la semana fiscal a la que pertenece una fecha.
 * @param date Fecha a clasificar (default: ahora). Se normaliza a día-calendario Caracas.
 */
export function fiscalWeekOf(date: Date = new Date()): FiscalWeek {
    const { year, month, day } = getCaracasNowParts(date);
    // Día-calendario Caracas como medianoche UTC (evita corrimientos por TZ).
    const d = new Date(Date.UTC(year, month, day));
    const dow = d.getUTCDay();              // 0=Dom .. 6=Sáb
    const sinceMonday = (dow + 6) % 7;      // días transcurridos desde el lunes
    const monday = new Date(d.getTime() - sinceMonday * DAY_MS);
    const thursday = new Date(monday.getTime() + 3 * DAY_MS);

    const fy = thursday.getUTCFullYear();
    const fm = thursday.getUTCMonth();      // 0-11
    const fday = thursday.getUTCDate();     // 1-31
    const week = Math.ceil(fday / 7);       // 1..5

    return { year: fy, month: fm + 1, week, label: `S${week} ${MESES[fm]}` };
}

/** Atajo: solo la etiqueta ("S5 ABRIL"). */
export function fiscalWeekLabel(date: Date = new Date()): string {
    return fiscalWeekOf(date).label;
}
