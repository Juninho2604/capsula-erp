import { describe, it, expect } from 'vitest';
import { normalizePhone, isPlaceholderName } from './link';

describe('normalizePhone', () => {
    it('quita todo lo no-dígito y devuelve solo dígitos', () => {
        expect(normalizePhone('0424-1234567')).toBe('04241234567');
        expect(normalizePhone('+58 424 123 4567')).toBe('584241234567');
        expect(normalizePhone('(0212) 555-1234')).toBe('02125551234');
    });

    it('devuelve null si tiene menos de 7 dígitos (no es teléfono usable)', () => {
        expect(normalizePhone('123456')).toBeNull();
        expect(normalizePhone('---')).toBeNull();
        expect(normalizePhone('')).toBeNull();
        expect(normalizePhone(null)).toBeNull();
        expect(normalizePhone(undefined)).toBeNull();
    });

    it('mismo teléfono escrito distinto normaliza igual (clave para dedupe)', () => {
        const a = normalizePhone('0424-123-4567');
        const b = normalizePhone('04241234567');
        const c = normalizePhone('(0424) 123 4567');
        expect(a).toBe(b);
        expect(b).toBe(c);
    });
});

describe('isPlaceholderName', () => {
    it('vacío / null / undefined → placeholder', () => {
        expect(isPlaceholderName('')).toBe(true);
        expect(isPlaceholderName('   ')).toBe(true);
        expect(isPlaceholderName(null)).toBe(true);
        expect(isPlaceholderName(undefined)).toBe(true);
    });

    it('nombres genéricos del POS → placeholder (case insensitive)', () => {
        expect(isPlaceholderName('Cliente en Caja')).toBe(true);
        expect(isPlaceholderName('CLIENTE EN CAJA')).toBe(true);
        expect(isPlaceholderName('Cliente')).toBe(true);
        expect(isPlaceholderName('Consumidor Final')).toBe(true);
        expect(isPlaceholderName('Delivery')).toBe(true);
        expect(isPlaceholderName('PROPINA COLECTIVA')).toBe(true);
    });

    it('un nombre real NO es placeholder', () => {
        expect(isPlaceholderName('Luis Caculler')).toBe(false);
        expect(isPlaceholderName('Juan Pérez')).toBe(false);
        expect(isPlaceholderName('María')).toBe(false);
    });
});
