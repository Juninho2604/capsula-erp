import { describe, it, expect } from 'vitest';
import { computeTabPreviewTotals } from './tab-preview';

describe('computeTabPreviewTotals — POS Mesero "Mostrar al cliente"', () => {
    it('caso de la imagen del 6/6 (TAB-Yair) — coincide con lo que la cajera cobra', () => {
        // Mesa: items $72 (Té $12 + Tabla $60). Mesero toca 10% propina.
        // Cliente tocó "Divisas" (preview -33.33%).
        const r = computeTabPreviewTotals({
            subtotal: 72,
            discount: 0,
            serviceChargeAccumulated: 0,
            isTableService: true,
            tipPercent: 10,
            divisasPreviewDiscount: 24,
            paidPartial: 0,
        });
        expect(r.netoPostDescuento).toBe(48);
        expect(r.serviceCharge).toBeCloseTo(4.8, 2);  // 10% × $48 neto (no × $72 bruto)
        expect(r.tipAmount).toBeCloseTo(4.8, 2);      // 10% × $48 neto (§46, NO $7.20)
        expect(r.grandTotal).toBeCloseTo(57.6, 2);    // 48 + 4.8 + 4.8
        // La cajera cobra 48 + 4.8 servicio = 52.80 (sin propina). Si el cliente
        // paga la propina sugerida, agrega 4.80 más → 57.60.
        // El número que aparecía en pantalla ($55.20) ahora NO debería pasar.
        expect(r.grandTotal).not.toBeCloseTo(55.2, 2);
    });

    it('mesa sin descuento, propina 10% → 10% servicio + 10% propina sobre el subtotal', () => {
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 0,
            serviceChargeAccumulated: 0,
            isTableService: true,
            tipPercent: 10,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.serviceCharge).toBeCloseTo(10, 2);
        expect(r.tipAmount).toBeCloseTo(10, 2);
        expect(r.grandTotal).toBeCloseTo(120, 2);
    });

    it('CORTESÍA 100%: subtotal $50, descuento $50 → neto 0, servicio 0, propina 0', () => {
        const r = computeTabPreviewTotals({
            subtotal: 50,
            discount: 50,
            serviceChargeAccumulated: 0,
            isTableService: true,
            tipPercent: 10,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.netoPostDescuento).toBe(0);
        expect(r.serviceCharge).toBe(0);
        expect(r.tipAmount).toBe(0);
        expect(r.grandTotal).toBe(0);
    });

    it('mesa BAR_TAB (no TABLE_SERVICE) → sin 10% servicio', () => {
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 0,
            serviceChargeAccumulated: 0,
            isTableService: false,
            tipPercent: 10,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.serviceCharge).toBe(0);
        expect(r.tipAmount).toBeCloseTo(10, 2);
        expect(r.grandTotal).toBeCloseTo(110, 2);
    });

    it('cobro parcial previo: respeta el serviceCharge acumulado en BD', () => {
        // La mesa ya tuvo 1 cobro previo que acumuló serviceCharge=$5.
        // El neto restante sigue siendo $50. NO se vuelve a calcular el 10%
        // (ya está cobrado). Esto matchea lo que registra el server al cobrar.
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 0,
            serviceChargeAccumulated: 5,
            isTableService: true,
            tipPercent: 10,
            divisasPreviewDiscount: 0,
            paidPartial: 55,
        });
        expect(r.serviceCharge).toBe(5);
        expect(r.tipAmount).toBeCloseTo(10, 2);
        expect(r.grandTotal).toBeCloseTo(115, 2);   // 100 + 5 + 10
        expect(r.saldoPendiente).toBeCloseTo(60, 2); // 115 − 55 ya pagados
    });

    it('valores no finitos no rompen (defensivo)', () => {
        const r = computeTabPreviewTotals({
            subtotal: NaN,
            discount: -5,
            serviceChargeAccumulated: NaN,
            isTableService: true,
            tipPercent: Infinity,
            divisasPreviewDiscount: undefined as unknown as number,
            paidPartial: NaN,
        });
        expect(r.grandTotal).toBe(0);
        expect(r.saldoPendiente).toBe(0);
    });

    it('propina sin servicio (mesa pickup que viene con isTableService=false pero propina explícita)', () => {
        const r = computeTabPreviewTotals({
            subtotal: 50,
            discount: 0,
            serviceChargeAccumulated: 0,
            isTableService: false,
            tipPercent: 15,
            divisasPreviewDiscount: 0,
            paidPartial: 0,
        });
        expect(r.serviceCharge).toBe(0);
        expect(r.tipAmount).toBeCloseTo(7.5, 2);
        expect(r.grandTotal).toBeCloseTo(57.5, 2);
    });

    it('previo más divisas: ambos descuentos se suman (CORTESÍA + divisas no es el caso, pero defensivo)', () => {
        const r = computeTabPreviewTotals({
            subtotal: 100,
            discount: 10,
            serviceChargeAccumulated: 0,
            isTableService: true,
            tipPercent: 10,
            divisasPreviewDiscount: 30,
            paidPartial: 0,
        });
        expect(r.discountTotal).toBe(40);
        expect(r.netoPostDescuento).toBe(60);
        expect(r.serviceCharge).toBeCloseTo(6, 2);
        expect(r.tipAmount).toBeCloseTo(6, 2);
        expect(r.grandTotal).toBeCloseTo(72, 2);
    });
});
