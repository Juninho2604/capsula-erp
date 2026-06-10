import { describe, it, expect } from 'vitest';
import { reportRangeSchema, resolveRangeDates } from './range';

describe('reportRangeSchema', () => {
    it('acepta rango válido', () => {
        expect(reportRangeSchema.safeParse({ from: '2026-06-01', to: '2026-06-10' }).success).toBe(true);
    });
    it('rechaza formato no YYYY-MM-DD', () => {
        expect(reportRangeSchema.safeParse({ from: '01/06/2026', to: '2026-06-10' }).success).toBe(false);
    });
    it('rechaza branchIds no-array', () => {
        expect(reportRangeSchema.safeParse({ from: '2026-06-01', to: '2026-06-10', branchIds: 'x' }).success).toBe(false);
    });
});

describe('resolveRangeDates', () => {
    it('convierte días Caracas a límites UTC (04:00 → 03:59 del siguiente)', () => {
        const r = resolveRangeDates({ from: '2026-06-01', to: '2026-06-01' });
        if ('error' in r) throw new Error(r.error);
        expect(r.from.toISOString()).toBe('2026-06-01T04:00:00.000Z');
        expect(r.to.toISOString()).toBe('2026-06-02T03:59:59.999Z');
    });
    it('rechaza from > to', () => {
        const r = resolveRangeDates({ from: '2026-06-10', to: '2026-06-01' });
        expect('error' in r).toBe(true);
    });
    it('rechaza rangos mayores al máximo', () => {
        const r = resolveRangeDates({ from: '2024-01-01', to: '2026-06-01' });
        expect('error' in r).toBe(true);
    });
});
