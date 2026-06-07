import { describe, it, expect } from 'vitest';
import { computeTabPreviewTotals } from './tab-preview';

describe('computeTabPreviewTotals — UN solo 10% (servicio), no se duplica', () => {
    it('caso mesa Yair 6/6: subtotal $72, divisas -$24, 10% → $48 + $4.80 = $52.80 (matchea cajera)', () => {
        const r = computeTabPreviewTotals({
            subtotal: 72,
            discount: 0,
            tipPercent: 10,
            divisasPreviewDiscount: 24,
            paidPartial: 0,
        });
        expect(r.netoPostDescuento).toBe(48);
        expect(r.serviceCharge).toBeCloseTo(4.8, 2);  // 10% × $48 NETO (§46)
        expect(r.grandTotal).toBeCloseTo(52.8, 2);    // == lo que cobra la cajera
        // Que NO haya doble 10% (no $7.20 + servicio adicional)
        expect(r.grandTotal).not.toBeCloseTo(57.6, 2);
    });

    it('caso mesa Carmen 6/6: subtotal $160.50 sin descuento, 10% → $176.55 (matchea cajera, no $192.60)', () => {
        const r = computeTabPreviewTotals({
            subtotal: 160.50,
            discount: 0,
            tipPercent: 10,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.serviceCharge).toBeCloseTo(16.05, 2);
        expect(r.grandTotal).toBeCloseTo(176.55, 2);
        // NO debe ser $192.60 (que era duplicación de servicio + propina)
        expect(r.grandTotal).not.toBeCloseTo(192.60, 2);
    });

    it('mesa sin descuento, 15% servicio → 15% sobre el subtotal completo', () => {
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 0,
            tipPercent: 15,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.serviceCharge).toBeCloseTo(15, 2);
        expect(r.grandTotal).toBeCloseTo(115, 2);
    });

    it('CORTESÍA 100%: subtotal $50, descuento $50 → neto 0, servicio 0, total 0', () => {
        const r = computeTabPreviewTotals({
            subtotal: 50,
            discount: 50,
            tipPercent: 10,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.netoPostDescuento).toBe(0);
        expect(r.serviceCharge).toBe(0);
        expect(r.grandTotal).toBe(0);
    });

    it('tipPercent 0 → solo el neto, sin línea de servicio', () => {
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 0,
            tipPercent: 0,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.serviceCharge).toBe(0);
        expect(r.grandTotal).toBe(100);
    });

    it('cobro parcial: descontar paidPartial del total', () => {
        // Mesa $100, tipPercent 10% → total $110. Ya pagó $60. Saldo $50.
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 0,
            tipPercent: 10,
            divisasPreviewDiscount: 0,
            paidPartial: 60,
        });
        expect(r.grandTotal).toBeCloseTo(110, 2);
        expect(r.saldoPendiente).toBeCloseTo(50, 2);
    });

    it('valores no finitos no rompen (defensivo)', () => {
        const r = computeTabPreviewTotals({
            subtotal: NaN,
            discount: -5,
            tipPercent: Infinity,
            divisasPreviewDiscount: undefined as unknown as number,
            paidPartial: NaN,
        });
        expect(r.grandTotal).toBe(0);
        expect(r.saldoPendiente).toBe(0);
    });

    it('descuento + divisas preview se suman', () => {
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 10,
            tipPercent: 10,
            divisasPreviewDiscount: 30,
            paidPartial: 0,
        });
        expect(r.discountTotal).toBe(40);
        expect(r.netoPostDescuento).toBe(60);
        expect(r.serviceCharge).toBeCloseTo(6, 2);
        expect(r.grandTotal).toBeCloseTo(66, 2);
    });
});
