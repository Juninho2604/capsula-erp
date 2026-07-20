import { describe, it, expect } from 'vitest';
import { qtyToBaseUnit } from './unit-conversion';

describe('qtyToBaseUnit — normalización a unidad base (§109.1)', () => {
    it('convierte masa: 200 G de un insumo en KG → 0.2 KG', () => {
        expect(qtyToBaseUnit(200, 'G', 'KG')).toEqual({ quantity: 0.2, unit: 'KG', converted: true });
    });

    it('convierte volumen: 500 ML de un insumo en L → 0.5 L', () => {
        expect(qtyToBaseUnit(500, 'ML', 'L')).toEqual({ quantity: 0.5, unit: 'L', converted: true });
    });

    it('convierte al revés: 0.25 KG de un insumo en G → 250 G', () => {
        expect(qtyToBaseUnit(0.25, 'KG', 'G')).toEqual({ quantity: 250, unit: 'G', converted: true });
    });

    it('misma unidad = identidad sin marca de conversión', () => {
        expect(qtyToBaseUnit(3, 'L', 'L')).toEqual({ quantity: 3, unit: 'L', converted: false });
    });

    it('familias distintas NO se convierten (nunca inventar conversión)', () => {
        expect(qtyToBaseUnit(2, 'UNIT', 'KG')).toEqual({ quantity: 2, unit: 'UNIT', converted: false });
        expect(qtyToBaseUnit(2, 'L', 'KG')).toEqual({ quantity: 2, unit: 'L', converted: false });
    });

    it('unidades desconocidas o vacías quedan sin cambios', () => {
        expect(qtyToBaseUnit(5, 'CAJA', 'KG')).toEqual({ quantity: 5, unit: 'CAJA', converted: false });
        expect(qtyToBaseUnit(5, '', 'KG')).toEqual({ quantity: 5, unit: 'KG', converted: false });
        expect(qtyToBaseUnit(5, null, undefined)).toEqual({ quantity: 5, unit: '', converted: false });
    });

    it('PORTION es identidad (ambigua por diseño)', () => {
        expect(qtyToBaseUnit(2, 'PORTION', 'KG').converted).toBe(false);
    });

    it('docenas: 2 DOZEN de un insumo en UNIT → 24', () => {
        expect(qtyToBaseUnit(2, 'DOZEN', 'UNIT')).toEqual({ quantity: 24, unit: 'UNIT', converted: true });
    });

    it('redondeo a 6 decimales sin ruido FP', () => {
        expect(qtyToBaseUnit(0.1, 'KG', 'G').quantity).toBe(100);
        expect(qtyToBaseUnit(33, 'G', 'KG').quantity).toBe(0.033);
    });

    it('case-insensitive', () => {
        expect(qtyToBaseUnit(200, 'g', 'kg')).toEqual({ quantity: 0.2, unit: 'KG', converted: true });
    });
});

// ── §127: alias de unidades en español ──────────────────────────────────────
import { normalizeUnitCode } from './unit-conversion';

describe('normalizeUnitCode (§127)', () => {
    it('resuelve alias comunes a su canónico', () => {
        expect(normalizeUnitCode('UND')).toBe('UNIT');
        expect(normalizeUnitCode('unidades')).toBe('UNIT');
        expect(normalizeUnitCode('Gr')).toBe('G');
        expect(normalizeUnitCode('LT')).toBe('L');
        expect(normalizeUnitCode('kilos')).toBe('KG');
        expect(normalizeUnitCode('cc')).toBe('ML');
    });
    it('canónicos y desconocidos quedan tal cual (mayúsculas)', () => {
        expect(normalizeUnitCode('KG')).toBe('KG');
        expect(normalizeUnitCode('SACO')).toBe('SACO');
        expect(normalizeUnitCode('')).toBe('');
        expect(normalizeUnitCode(null)).toBe('');
    });
});

describe('qtyToBaseUnit con alias (§127)', () => {
    it("'UND' contra base 'UNIT' → identidad, unit canónica", () => {
        expect(qtyToBaseUnit(3, 'UND', 'UNIT')).toEqual({ quantity: 3, unit: 'UNIT', converted: false });
    });
    it("'GR' contra base 'KG' → convierte (200 GR = 0.2 KG)", () => {
        expect(qtyToBaseUnit(200, 'GR', 'KG')).toEqual({ quantity: 0.2, unit: 'KG', converted: true });
    });
    it("'unidades' contra base 'UND' → misma unidad tras normalizar, identidad", () => {
        expect(qtyToBaseUnit(5, 'unidades', 'UND')).toEqual({ quantity: 5, unit: 'UNIT', converted: false });
    });
});
