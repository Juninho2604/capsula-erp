/**
 * §113 — Escala y helpers de la encuesta de satisfacción. PURO (testeable).
 */

export type SatisfactionRating = 'EXCELENTE' | 'BUENA' | 'REGULAR' | 'MALA';

export const SATISFACTION_RATINGS: SatisfactionRating[] = ['EXCELENTE', 'BUENA', 'REGULAR', 'MALA'];

export const SATISFACTION_META: Record<SatisfactionRating, { label: string; emoji: string; score: number; tone: 'ok' | 'warn' | 'danger' }> = {
    EXCELENTE: { label: 'Excelente', emoji: '🤩', score: 4, tone: 'ok' },
    BUENA:     { label: 'Buena',     emoji: '🙂', score: 3, tone: 'ok' },
    REGULAR:   { label: 'Regular',   emoji: '😐', score: 2, tone: 'warn' },
    MALA:      { label: 'Mala',      emoji: '😞', score: 1, tone: 'danger' },
};

export function isSatisfactionRating(v: unknown): v is SatisfactionRating {
    return typeof v === 'string' && (SATISFACTION_RATINGS as string[]).includes(v);
}

export interface SatisfactionSummary {
    total: number;
    counts: Record<SatisfactionRating, number>;
    /** Promedio 1–4 (0 si no hay respuestas). */
    avgScore: number;
    /** % de respuestas positivas (Excelente + Buena). */
    positivePct: number;
}

/**
 * Resume una lista de calificaciones generales. Ignora valores fuera de
 * escala (defensivo ante datos viejos).
 */
export function summarizeSatisfaction(ratings: string[]): SatisfactionSummary {
    const counts: Record<SatisfactionRating, number> = { EXCELENTE: 0, BUENA: 0, REGULAR: 0, MALA: 0 };
    let sum = 0;
    let total = 0;
    for (const r of ratings) {
        if (!isSatisfactionRating(r)) continue;
        counts[r] += 1;
        sum += SATISFACTION_META[r].score;
        total += 1;
    }
    const avgScore = total > 0 ? Math.round((sum / total) * 100) / 100 : 0;
    const positive = counts.EXCELENTE + counts.BUENA;
    const positivePct = total > 0 ? Math.round((positive / total) * 1000) / 10 : 0;
    return { total, counts, avgScore, positivePct };
}
