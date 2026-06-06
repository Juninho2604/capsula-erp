import { describe, it, expect } from 'vitest';
import { suggestedTipAmount, cappedTipForPayment } from './tip-calculation';

describe('suggestedTipAmount — Bug A (§46): propina sobre total NETO, no bruto', () => {
    it('sin descuento: 10% de $48 = $4.80', () => {
        expect(suggestedTipAmount(48, 10)).toBeCloseTo(4.8, 2);
    });

    it('TAB-2433: mesa con DIVISAS_33 — total neto $48 → 10% = $4.80 (NO $7.20)', () => {
        // Bruto $72, descuento -33.33% → neto $48. El bug daba 10%×72=$7.20.
        expect(suggestedTipAmount(48, 10)).toBeCloseTo(4.8, 2);
        expect(suggestedTipAmount(48, 10)).not.toBeCloseTo(7.2, 2);
    });

    it('CORTESIA_PERCENT 50%: bruto $100 → neto $50 → 10% = $5', () => {
        expect(suggestedTipAmount(50, 10)).toBeCloseTo(5, 2);
    });

    it('CORTESIA_100: total neto $0 → propina $0', () => {
        expect(suggestedTipAmount(0, 10)).toBe(0);
    });

    it('tipPercent 0 → 0; valores no finitos → 0', () => {
        expect(suggestedTipAmount(48, 0)).toBe(0);
        expect(suggestedTipAmount(NaN, 10)).toBe(0);
        expect(suggestedTipAmount(48, NaN)).toBe(0);
    });

    it('15% y 20% sobre neto', () => {
        expect(suggestedTipAmount(48, 15)).toBeCloseTo(7.2, 2);
        expect(suggestedTipAmount(48, 20)).toBeCloseTo(9.6, 2);
    });
});

describe('cappedTipForPayment — Bug B (§46): propina capada al excedente real', () => {
    it('TAB-2433 exacto: factura $52.80, pagó $53 Zelle, prefill $7.20 → capa a $0.20', () => {
        const tip = cappedTipForPayment({
            intendedTip: 7.2,
            amountPaid: 53,
            totalAntesServicio: 48,
            serviceFee: 4.8,
        });
        expect(tip).toBeCloseTo(0.2, 2);
        expect(tip).not.toBeCloseTo(7.2, 2); // ya no es fantasma
    });

    it('excedente real cubre la propina pretendida: se registra completa', () => {
        // Factura $52.80, cliente pagó $60 → excedente $7.20 cubre el prefill.
        const tip = cappedTipForPayment({
            intendedTip: 7.2,
            amountPaid: 60,
            totalAntesServicio: 48,
            serviceFee: 4.8,
        });
        expect(tip).toBeCloseTo(7.2, 2);
    });

    it('pagó justo la factura: propina 0 (no fantasma)', () => {
        const tip = cappedTipForPayment({
            intendedTip: 7.2,
            amountPaid: 52.8,
            totalAntesServicio: 48,
            serviceFee: 4.8,
        });
        expect(tip).toBe(0);
    });

    it('sin servicio incluido: factura = solo total antes de servicio', () => {
        // Factura $48 (sin 10%), pagó $50 → excedente $2, prefill $7.20 → $2.
        const tip = cappedTipForPayment({
            intendedTip: 7.2,
            amountPaid: 50,
            totalAntesServicio: 48,
            serviceFee: 0,
        });
        expect(tip).toBeCloseTo(2, 2);
    });

    it('propina pretendida 0 → 0', () => {
        expect(cappedTipForPayment({ intendedTip: 0, amountPaid: 60, totalAntesServicio: 48, serviceFee: 4.8 })).toBe(0);
    });

    it('pagó menos que la factura (no debería pasar) → 0, nunca negativo', () => {
        expect(cappedTipForPayment({ intendedTip: 7.2, amountPaid: 40, totalAntesServicio: 48, serviceFee: 4.8 })).toBe(0);
    });
});
