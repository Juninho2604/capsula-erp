/**
 * Validación zod + resolución de rango de fechas para las actions de
 * reportes. Los días llegan como 'YYYY-MM-DD' (día Caracas) y se convierten
 * a [start, end] UTC con getCaracasDayRange (§20.2 — regla canónica).
 */

import { z } from 'zod';
import { getCaracasDayRange } from '@/lib/datetime';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const reportRangeSchema = z.object({
    from: z.string().regex(DAY_RE, 'from debe ser YYYY-MM-DD'),
    to: z.string().regex(DAY_RE, 'to debe ser YYYY-MM-DD'),
    branchIds: z.array(z.string().min(1)).max(20).optional(),
});

export type ReportRangeInput = z.infer<typeof reportRangeSchema>;

/** Máximo de días consultables de una vez (protege la BD de rangos absurdos). */
export const MAX_RANGE_DAYS = 366;

export function resolveRangeDates(input: { from: string; to: string }): { from: Date; to: Date } | { error: string } {
    const from = getCaracasDayRange(new Date(input.from + 'T12:00:00')).start;
    const to = getCaracasDayRange(new Date(input.to + 'T12:00:00')).end;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return { error: 'Fechas inválidas' };
    }
    if (from > to) return { error: 'El inicio del rango no puede ser posterior al fin' };
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    if (days > MAX_RANGE_DAYS) return { error: `El rango máximo es ${MAX_RANGE_DAYS} días` };
    return { from, to };
}
