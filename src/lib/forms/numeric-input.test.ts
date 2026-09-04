import { describe, it, expect } from 'vitest';
import {
    sanitizeNumericText, parseNumericText, isIntermediateNumericText, formatNumericValue,
} from './numeric-input';

describe('sanitizeNumericText (§170)', () => {
    it('deja pasar dígitos y un separador decimal', () => {
        expect(sanitizeNumericText('0.5')).toBe('0.5');
        expect(sanitizeNumericText('0,5')).toBe('0,5');
        expect(sanitizeNumericText('12')).toBe('12');
    });

    it('el cero inicial sobrevive — es el bug que reportó Víctor', () => {
        expect(sanitizeNumericText('0')).toBe('0');
        expect(sanitizeNumericText('0.')).toBe('0.');
        expect(sanitizeNumericText('0.0')).toBe('0.0');
    });

    it('descarta letras y símbolos', () => {
        expect(sanitizeNumericText('12abc')).toBe('12');
        expect(sanitizeNumericText('$3.50')).toBe('3.50');
    });

    it('un segundo separador no entra', () => {
        expect(sanitizeNumericText('1.2.3')).toBe('1.23');
        expect(sanitizeNumericText('1,2,3')).toBe('1,23');
    });

    it('el signo sólo si se permite, y sólo al principio', () => {
        expect(sanitizeNumericText('-5')).toBe('5');
        expect(sanitizeNumericText('-5', { allowNegative: true })).toBe('-5');
        expect(sanitizeNumericText('5-3', { allowNegative: true })).toBe('53');
    });
});

describe('parseNumericText', () => {
    it('convierte con punto o con coma', () => {
        expect(parseNumericText('0.5')).toBe(0.5);
        expect(parseNumericText('0,5')).toBe(0.5);
        expect(parseNumericText('12')).toBe(12);
    });

    it('el cero es un valor, no un vacío', () => {
        expect(parseNumericText('0')).toBe(0);
        expect(parseNumericText('0.0')).toBe(0);
    });

    it('lo que aún no es número devuelve null, NO cero', () => {
        // La distinción es todo el arreglo: `|| 0` convertía "aún no escribo
        // nada" en "cero", y ahí se perdía lo tecleado.
        expect(parseNumericText('')).toBeNull();
        expect(parseNumericText('.')).toBeNull();
        expect(parseNumericText('-')).toBeNull();
        expect(parseNumericText('abc')).toBeNull();
    });

    it('un texto a medio escribir con separador final se resuelve', () => {
        expect(parseNumericText('0.')).toBe(0);
        expect(parseNumericText('12,')).toBe(12);
    });
});

describe('isIntermediateNumericText', () => {
    it('reconoce los pasos legítimos al escribir', () => {
        for (const s of ['', '.', ',', '-', '0.', '12,']) {
            expect(isIntermediateNumericText(s)).toBe(true);
        }
    });

    it('un número completo no es intermedio', () => {
        for (const s of ['0', '0.5', '12']) {
            expect(isIntermediateNumericText(s)).toBe(false);
        }
    });
});

describe('formatNumericValue', () => {
    it('muestra el número', () => {
        expect(formatNumericValue(0.5)).toBe('0.5');
        expect(formatNumericValue(12)).toBe('12');
    });

    it('cero y nulo salen vacíos, para poder teclear encima', () => {
        expect(formatNumericValue(0)).toBe('');
        expect(formatNumericValue(null)).toBe('');
        expect(formatNumericValue(undefined)).toBe('');
    });

    it('con showZero el cero sí se muestra', () => {
        expect(formatNumericValue(0, { showZero: true })).toBe('0');
    });

    it('valores inválidos no rompen', () => {
        expect(formatNumericValue(NaN)).toBe('');
        expect(formatNumericValue(Infinity)).toBe('');
    });
});
