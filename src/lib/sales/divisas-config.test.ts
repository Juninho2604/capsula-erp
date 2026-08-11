import { describe, it, expect } from 'vitest';
import {
    DEFAULT_DIVISAS_DISCOUNT_PERCENT,
    normalizeDivisasPercent,
    divisasDiscountRate,
    parseDivisasPercent,
    formatDivisasPercent,
} from './divisas-config';

describe('normalizeDivisasPercent', () => {
    it('default para null/NaN/undefined', () => {
        expect(normalizeDivisasPercent(null)).toBeCloseTo(33.333, 2);
        expect(normalizeDivisasPercent(undefined)).toBe(DEFAULT_DIVISAS_DISCOUNT_PERCENT);
        expect(normalizeDivisasPercent(NaN)).toBe(DEFAULT_DIVISAS_DISCOUNT_PERCENT);
    });
    it('clamp a [0, 90]', () => {
        expect(normalizeDivisasPercent(-5)).toBe(0);
        expect(normalizeDivisasPercent(120)).toBe(90);
        expect(normalizeDivisasPercent(40)).toBe(40);
    });
});

describe('divisasDiscountRate', () => {
    it('porcentaje → fracción', () => {
        expect(divisasDiscountRate(33.333)).toBeCloseTo(0.33333, 4);
        expect(divisasDiscountRate(40)).toBeCloseTo(0.4, 4);
        expect(divisasDiscountRate(null)).toBeCloseTo(1 / 3, 4);
    });
});

describe('parseDivisasPercent', () => {
    it('parsea string guardado; default si vacío/roto', () => {
        expect(parseDivisasPercent('40')).toBe(40);
        expect(parseDivisasPercent(null)).toBe(DEFAULT_DIVISAS_DISCOUNT_PERCENT);
        expect(parseDivisasPercent('basura')).toBe(DEFAULT_DIVISAS_DISCOUNT_PERCENT);
        expect(parseDivisasPercent('999')).toBe(90); // clamp
    });
});

describe('formatDivisasPercent', () => {
    it('recorta el default histórico a 2 decimales', () => {
        expect(formatDivisasPercent(DEFAULT_DIVISAS_DISCOUNT_PERCENT)).toBe('33.33');
    });

    it('un porcentaje entero no arrastra decimales', () => {
        expect(formatDivisasPercent(40)).toBe('40');
        expect(formatDivisasPercent(25)).toBe('25');
    });

    it('normaliza antes de formatear — nunca muestra un % que no se aplica', () => {
        expect(formatDivisasPercent(120)).toBe('90');
        expect(formatDivisasPercent(-5)).toBe('0');
        expect(formatDivisasPercent(null)).toBe('33.33');
        expect(formatDivisasPercent(undefined)).toBe('33.33');
    });

    it('el rótulo coincide con la tasa que usa el cálculo', () => {
        // Este es el bug que se corrige: el cartel decía 33% mientras el
        // cobro descontaba otra cosa. Rótulo y tasa salen del mismo número.
        for (const pct of [0, 10, 33.333333, 40, 55.5, 90]) {
            const rate = divisasDiscountRate(pct);
            expect(formatDivisasPercent(rate * 100)).toBe(formatDivisasPercent(pct));
        }
    });
});
