import { describe, it, expect } from 'vitest';
import {
    DEFAULT_DIVISAS_DISCOUNT_PERCENT,
    normalizeDivisasPercent,
    divisasDiscountRate,
    parseDivisasPercent,
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
