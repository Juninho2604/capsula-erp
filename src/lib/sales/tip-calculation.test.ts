import { describe, it, expect } from 'vitest';
import { suggestedTipAmount, cappedTipForPayment, keptAmountForSplit, roundingTipForCharge } from './tip-calculation';

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

describe('keptAmountForSplit — el split registra lo retenido (factura + propina), no el bruto', () => {
    it('TAB-2433 Zelle: recibido $53, factura $52.80, propina $0.20 → retenido $53 (excedente = $0.20 = propina)', () => {
        const tip = cappedTipForPayment({ intendedTip: 7.2, amountPaid: 53, totalAntesServicio: 48, serviceFee: 4.8 });
        const kept = keptAmountForSplit({ amountPaid: 53, totalAntesServicio: 48, serviceFee: 4.8, tip });
        expect(kept).toBeCloseTo(53, 2);
        expect(kept - (48 + 4.8)).toBeCloseTo(0.2, 2); // excedente del split == propina, contado UNA vez
    });

    it('efectivo: recibido $60, factura $52.80, propina $4 → retenido $56.80 (vuelto $3.20 NO se cuenta)', () => {
        const kept = keptAmountForSplit({ amountPaid: 60, totalAntesServicio: 48, serviceFee: 4.8, tip: 4 });
        expect(kept).toBeCloseTo(56.8, 2);
        expect(kept - 52.8).toBeCloseTo(4, 2); // excedente = propina real, no el vuelto de $7.20
    });

    it('efectivo sobrepago SIN propina (cliente quiere todo el vuelto): retenido = factura', () => {
        const tip = cappedTipForPayment({ intendedTip: 0, amountPaid: 60, totalAntesServicio: 48, serviceFee: 4.8 });
        const kept = keptAmountForSplit({ amountPaid: 60, totalAntesServicio: 48, serviceFee: 4.8, tip });
        expect(kept).toBeCloseTo(52.8, 2); // sin propina; el $7.20 sobrante es vuelto, no propina
    });

    it('pago justo: retenido = recibido = factura', () => {
        const kept = keptAmountForSplit({ amountPaid: 52.8, totalAntesServicio: 48, serviceFee: 4.8, tip: 0 });
        expect(kept).toBeCloseTo(52.8, 2);
    });

    it('pago parcial (recibido < factura): retenido = recibido, sin inflar', () => {
        const tip = cappedTipForPayment({ intendedTip: 5, amountPaid: 30, totalAntesServicio: 48, serviceFee: 4.8 });
        const kept = keptAmountForSplit({ amountPaid: 30, totalAntesServicio: 48, serviceFee: 4.8, tip });
        expect(kept).toBeCloseTo(30, 2);
    });
});

describe('roundingTipForCharge — redondeo→propina (cobro mesa divisas, dueño 16/06)', () => {
    it('Recibo 1 (Nicolás, divisas): factura $16.50 CASH_USD → ceil $17 → propina $0.50', () => {
        const t = roundingTipForCharge({ facturaReal: 16.5, paymentMethod: 'CASH_USD' });
        expect(t).toBeCloseTo(0.5, 2);
    });

    it('Recibo 2 (Ahsly, cortesía+cash): factura $25.74 CASH_USD → ceil $26 → propina $0.26', () => {
        const t = roundingTipForCharge({ facturaReal: 25.74, paymentMethod: 'CASH_USD' });
        expect(t).toBeCloseTo(0.26, 2);
    });

    it('ZELLE también redondea hacia arriba', () => {
        expect(roundingTipForCharge({ facturaReal: 12.01, paymentMethod: 'ZELLE' })).toBeCloseTo(0.99, 2);
        expect(roundingTipForCharge({ facturaReal: 12.99, paymentMethod: 'CASH_EUR' })).toBeCloseTo(0.01, 2);
    });

    it('factura ya en dólar entero → propina de redondeo $0', () => {
        expect(roundingTipForCharge({ facturaReal: 20, paymentMethod: 'CASH_USD' })).toBe(0);
    });

    it('métodos NO divisas (Bs, PDV, móvil) → sin redondeo (0)', () => {
        expect(roundingTipForCharge({ facturaReal: 16.5, paymentMethod: 'CASH_BS' })).toBe(0);
        expect(roundingTipForCharge({ facturaReal: 16.5, paymentMethod: 'PDV_SHANKLISH' })).toBe(0);
        expect(roundingTipForCharge({ facturaReal: 16.5, paymentMethod: 'MOVIL_NG' })).toBe(0);
    });

    it('pago mixto → target exacto, sin redondeo (0)', () => {
        expect(roundingTipForCharge({ facturaReal: 16.5, paymentMethod: 'CASH_USD', isMixed: true })).toBe(0);
    });

    it('nunca negativa; valores no finitos → 0', () => {
        expect(roundingTipForCharge({ facturaReal: NaN, paymentMethod: 'CASH_USD' })).toBe(0);
        expect(roundingTipForCharge({ facturaReal: -5, paymentMethod: 'CASH_USD' })).toBe(0);
    });

    it('integración con cappedTipForPayment: si el cliente paga justo (sin dólar entero), el redondeo se capa a 0', () => {
        // factura $16.50, cliente paga EXACTO $16.50 (no entregó $17): no hay excedente.
        const roundingTip = roundingTipForCharge({ facturaReal: 16.5, paymentMethod: 'CASH_USD' }); // 0.50
        const tip = cappedTipForPayment({
            intendedTip: Math.max(0, roundingTip),
            amountPaid: 16.5,
            totalAntesServicio: 15,
            serviceFee: 1.5,
        });
        expect(tip).toBe(0); // sin excedente real → sin propina fantasma
    });

    it('integración: cliente paga $20 → propina de redondeo $0.50 se registra (recibo=$17)', () => {
        const roundingTip = roundingTipForCharge({ facturaReal: 16.5, paymentMethod: 'CASH_USD' });
        const tip = cappedTipForPayment({
            intendedTip: Math.max(0, roundingTip),
            amountPaid: 20,
            totalAntesServicio: 15,
            serviceFee: 1.5,
        });
        expect(tip).toBeCloseTo(0.5, 2);
        // Recibo: factura 16.50 + propina 0.50 = $17.00 (== lo cobrado)
        expect(15 + 1.5 + tip).toBeCloseTo(17, 2);
    });
});
