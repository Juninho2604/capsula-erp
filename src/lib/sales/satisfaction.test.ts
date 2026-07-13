import { describe, it, expect } from 'vitest';
import { summarizeSatisfaction, isSatisfactionRating } from './satisfaction';

describe('satisfaction helpers (§113)', () => {
    it('resume conteos, promedio y % positivo', () => {
        const s = summarizeSatisfaction(['EXCELENTE', 'EXCELENTE', 'BUENA', 'REGULAR', 'MALA']);
        expect(s.total).toBe(5);
        expect(s.counts).toEqual({ EXCELENTE: 2, BUENA: 1, REGULAR: 1, MALA: 1 });
        expect(s.avgScore).toBe(2.8); // (4+4+3+2+1)/5
        expect(s.positivePct).toBe(60); // 3 de 5
    });

    it('lista vacía = ceros sin dividir por cero', () => {
        const s = summarizeSatisfaction([]);
        expect(s.total).toBe(0);
        expect(s.avgScore).toBe(0);
        expect(s.positivePct).toBe(0);
    });

    it('ignora valores fuera de escala', () => {
        const s = summarizeSatisfaction(['EXCELENTE', 'GARBAGE', '', 'MALA']);
        expect(s.total).toBe(2);
        expect(s.avgScore).toBe(2.5);
    });

    it('isSatisfactionRating valida la escala', () => {
        expect(isSatisfactionRating('BUENA')).toBe(true);
        expect(isSatisfactionRating('buena')).toBe(false);
        expect(isSatisfactionRating(null)).toBe(false);
    });
});
