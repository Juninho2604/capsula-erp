import { describe, it, expect } from 'vitest';
import { caracasDateOnlyToDate, getCaracasDateStamp } from './datetime';

describe('caracasDateOnlyToDate', () => {
    it('ancla la fecha al mediodía de Caracas (16:00 UTC), NO a medianoche UTC', () => {
        const d = caracasDateOnlyToDate('2026-06-11')!;
        expect(d.toISOString()).toBe('2026-06-11T16:00:00.000Z');
    });

    it('al releer en timezone Caracas, el día calendario coincide con el elegido', () => {
        // El bug original: new Date("2026-06-11") = 2026-06-11T00:00Z → en
        // Caracas (UTC-4) es 2026-06-10. El helper lo evita.
        const d = caracasDateOnlyToDate('2026-06-11')!;
        expect(getCaracasDateStamp(d)).toBe('2026-06-11');
    });

    it('round-trip estable para el formulario (toISOString().slice(0,10))', () => {
        for (const ymd of ['2026-01-01', '2026-06-11', '2026-12-31']) {
            const d = caracasDateOnlyToDate(ymd)!;
            expect(d.toISOString().slice(0, 10)).toBe(ymd);
        }
    });

    it('devuelve null para null/undefined/string vacío/formato inválido', () => {
        expect(caracasDateOnlyToDate(null)).toBeNull();
        expect(caracasDateOnlyToDate(undefined)).toBeNull();
        expect(caracasDateOnlyToDate('')).toBeNull();
        expect(caracasDateOnlyToDate('11/06/2026')).toBeNull();
        expect(caracasDateOnlyToDate('2026-6-1')).toBeNull();
    });
});
