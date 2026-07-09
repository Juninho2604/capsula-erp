import { describe, it, expect } from 'vitest';
import { computeDeliveryTotals } from './delivery-totals';

const FEE = { feeNormal: 4.5, feeDivisas: 3 };

describe('computeDeliveryTotals — §88 (cortesía solo a ítems, envío al motorizado)', () => {
    it('SIN descuento: total = ítems + envío normal', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 16, discountType: 'NONE', ...FEE });
        expect(r.total).toBe(20.5);
        expect(r.deliveryFee).toBe(4.5);
        expect(r.discount).toBe(0);
    });

    it('CORTESÍA %: descuenta SOLO los ítems, el envío se cobra completo (el bug)', () => {
        // 2 shawarmas $16, cortesía 50%, envío $4.5.
        const r = computeDeliveryTotals({ itemsSubtotal: 16, discountType: 'CORTESIA_PERCENT', discountPercent: 50, ...FEE });
        expect(r.total).toBe(12.5);          // 8 (ítems) + 4.5 (envío) — NO 10.25
        expect(r.deliveryFee).toBe(4.5);
        expect(r.discount).toBe(8);          // solo los ítems
    });

    it('CORTESÍA 100%: comp total, todo gratis (incluye envío)', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 16, discountType: 'CORTESIA_100', ...FEE });
        expect(r.total).toBe(0);
        expect(r.discount).toBe(20.5);
    });

    it('DIVISAS full: descuenta ítems, envío baja a $3 (piso)', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 16, discountType: 'DIVISAS_33', divisasRate: 1 / 3, ...FEE });
        expect(r.total).toBeCloseTo(16 * (2 / 3) + 3, 2); // 10.667 + 3 = 13.667
        expect(r.deliveryFee).toBe(3);
    });

    it('DIVISAS % editable (§87): 40% aplica a ítems, envío sigue $3', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 20, discountType: 'DIVISAS_33', divisasRate: 0.40, ...FEE });
        expect(r.total).toBeCloseTo(20 * 0.6 + 3, 2); // 12 + 3 = 15
        expect(r.deliveryFee).toBe(3);
    });

    it('DIVISAS mixto: solo la porción en divisas recibe el descuento', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 20, discountType: 'DIVISAS_33', divisasBase: 10, divisasRate: 1 / 3, ...FEE });
        expect(r.total).toBeCloseTo(20 - 10 / 3 + 3, 2); // 20 - 3.333 + 3 = 19.667
    });

    it('el envío en divisas NUNCA baja de su piso, aunque el % sea alto', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 16, discountType: 'DIVISAS_33', divisasRate: 0.90, ...FEE });
        expect(r.deliveryFee).toBe(3); // el % no toca el envío
    });

    it('Delivery Gratis + cortesía %: waivea el envío COMPLETO, cortesía a ítems', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 16, discountType: 'CORTESIA_PERCENT', discountPercent: 50, freeDelivery: true, ...FEE });
        expect(r.total).toBe(8);        // solo ítems*(1-0.5), envío 0
        expect(r.deliveryFee).toBe(0);
    });

    it('Delivery Gratis + divisas: waivea el envío, descuento divisas a ítems', () => {
        const r = computeDeliveryTotals({ itemsSubtotal: 15, discountType: 'DIVISAS_33', divisasRate: 1 / 3, freeDelivery: true, ...FEE });
        expect(r.total).toBeCloseTo(15 * (2 / 3), 2); // 10, envío 0
        expect(r.deliveryFee).toBe(0);
    });

    it('discount = subtotal - total en todos los casos (reconcilia el recibo)', () => {
        for (const dt of ['NONE', 'DIVISAS_33', 'CORTESIA_PERCENT'] as const) {
            const r = computeDeliveryTotals({ itemsSubtotal: 23.4, discountType: dt, discountPercent: 30, divisasRate: 1 / 3, ...FEE });
            expect(r.discount).toBeCloseTo(r.subtotal - r.total, 2);
        }
    });
});
