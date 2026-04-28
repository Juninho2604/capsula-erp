import { describe, it, expect } from 'vitest';
import { generateSkuCode, parseSkuCode, sanitizeSegment, skuPrefix } from './sku';

describe('sanitizeSegment', () => {
    it('uppercases and strips diacritics', () => {
        expect(sanitizeSegment('café')).toBe('CAFE');
    });
    it('removes special chars and spaces', () => {
        expect(sanitizeSegment('be-b 1!')).toBe('BEB1');
    });
    it('returns null for empty / whitespace', () => {
        expect(sanitizeSegment('')).toBeNull();
        expect(sanitizeSegment('   ')).toBeNull();
        expect(sanitizeSegment(null)).toBeNull();
        expect(sanitizeSegment(undefined)).toBeNull();
    });
    it('clamps to 5 chars', () => {
        expect(sanitizeSegment('CARNESEXAGER')).toBe('CARNE');
    });
});

describe('generateSkuCode', () => {
    it('FAM + sequence (2 segments)', () => {
        expect(generateSkuCode({ familyCode: 'BEB', sequence: 1 })).toBe('BEB-001');
    });
    it('FAM-SUB-FMT-NNN (4 segments)', () => {
        expect(
            generateSkuCode({ familyCode: 'BEB', subCode: 'CER', formatCode: '330', sequence: 1 }),
        ).toBe('BEB-CER-330-001');
    });
    it('FAM-SUB-NNN (3 segments)', () => {
        expect(generateSkuCode({ familyCode: 'PRO', subCode: 'RES', sequence: 14 })).toBe('PRO-RES-014');
    });
    it('FAM-FMT-NNN (3 segments, sub omitido)', () => {
        expect(generateSkuCode({ familyCode: 'LAC', formatCode: 'LT', sequence: 2 })).toBe('LAC-LT-002');
    });
    it('zero-pads sequence to 3 digits', () => {
        expect(generateSkuCode({ familyCode: 'X', sequence: 7 })).toBe('X-007');
        expect(generateSkuCode({ familyCode: 'X', sequence: 999 })).toBe('X-999');
    });
    it('does not truncate sequence > 999', () => {
        expect(generateSkuCode({ familyCode: 'X', sequence: 1000 })).toBe('X-1000');
    });
    it('throws on invalid familyCode', () => {
        expect(() => generateSkuCode({ familyCode: '', sequence: 1 })).toThrow();
        expect(() => generateSkuCode({ familyCode: '   ', sequence: 1 })).toThrow();
    });
    it('throws on invalid sequence', () => {
        expect(() => generateSkuCode({ familyCode: 'BEB', sequence: -1 })).toThrow();
        expect(() => generateSkuCode({ familyCode: 'BEB', sequence: NaN })).toThrow();
    });
    it('uppercases input familyCode automatically', () => {
        expect(generateSkuCode({ familyCode: 'beb', sequence: 1 })).toBe('BEB-001');
    });
});

describe('parseSkuCode', () => {
    it('parses 4-segment canonical', () => {
        expect(parseSkuCode('BEB-CER-330-001')).toEqual({
            familyCode: 'BEB', subCode: 'CER', formatCode: '330', sequence: 1,
        });
    });
    it('parses 3-segment with format (heurística: contiene dígitos)', () => {
        expect(parseSkuCode('LAC-LT-002')).toEqual({
            familyCode: 'LAC', subCode: 'LT', sequence: 2, // LT no tiene dígitos → tratado como sub
        });
        expect(parseSkuCode('LAC-330-002')).toEqual({
            familyCode: 'LAC', formatCode: '330', sequence: 2,
        });
    });
    it('parses 2-segment FAM-NNN', () => {
        expect(parseSkuCode('PRO-014')).toEqual({ familyCode: 'PRO', sequence: 14 });
    });
    it('returns null for non-canonical', () => {
        expect(parseSkuCode('SKU-ABC')).toBeNull(); // ABC no es secuencial
        expect(parseSkuCode('')).toBeNull();
        expect(parseSkuCode('-001')).toBeNull(); // family vacía
        expect(parseSkuCode('BEB-CER-FMT-EXTRA-001')).toBeNull(); // 5 segments
    });
});

describe('skuPrefix', () => {
    it('returns prefix without sequence', () => {
        expect(skuPrefix('BEB-CER-330-001')).toBe('BEB-CER-330');
        expect(skuPrefix('PRO-RES-014')).toBe('PRO-RES');
        expect(skuPrefix('PRO-014')).toBe('PRO');
    });
    it('returns null for invalid', () => {
        expect(skuPrefix('not-a-sku')).toBeNull();
    });
});
