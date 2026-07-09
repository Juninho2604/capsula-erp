import { describe, it, expect } from 'vitest';
import { computeDivisasSettlement } from './divisas-settlement';

describe('computeDivisasSettlement — descuento divisas proporcional al pago', () => {
    it('pago COMPLETO en divisas: equivale a balanceDue/3 (idéntico al comportamiento previo)', () => {
        // Mesa Yair 6/6 (mismo caso del test de tab-preview): bruto $72.
        // Full divisas → neto $48, +10% = $52.80 a cobrar.
        const r = computeDivisasSettlement({ balanceDue: 72, receivedUSD: 52.8, serviceFeeIncluded: true });
        expect(r.grossSettled).toBeCloseTo(72, 2);
        expect(r.discountAmount).toBeCloseTo(24, 2);     // 72 / 3
        expect(r.netItemsApplied).toBeCloseTo(48, 2);    // 72 * 2/3
        expect(r.serviceFee).toBeCloseTo(4.8, 2);
        expect(r.facturaReal).toBeCloseTo(52.8, 2);
    });

    it('sobrepago (cliente entrega más que el total divisas): topa al saldo, no sobre-descuenta', () => {
        // Entrega $60 sobre una cuenta cuyo total divisas era $52.80.
        const r = computeDivisasSettlement({ balanceDue: 72, receivedUSD: 60, serviceFeeIncluded: true });
        expect(r.grossSettled).toBeCloseTo(72, 2);       // topado a balanceDue
        expect(r.discountAmount).toBeCloseTo(24, 2);     // nunca más de balanceDue/3
        expect(r.netItemsApplied).toBeCloseTo(48, 2);
    });

    it('BUG TAB-3048: pago PARCIAL de $52 en una mesa de $104.49 → descuento ~$23.64, NO $34.83', () => {
        const r = computeDivisasSettlement({ balanceDue: 104.49, receivedUSD: 52, serviceFeeIncluded: true });
        expect(r.discountAmount).toBeCloseTo(23.64, 2);   // antes (buggeado) daba 34.83 = balanceDue/3
        expect(r.netItemsApplied).toBeCloseTo(47.27, 2);
        expect(r.serviceFee).toBeCloseTo(4.73, 2);
        expect(r.facturaReal).toBeCloseTo(52, 2);         // el cliente paga exactamente lo que entregó
        expect(r.grossSettled).toBeLessThan(104.49);      // no salda toda la mesa
    });

    it('TAB-3048 completo en dos cuotas suma EXACTAMENTE el descuento de pagar todo de una', () => {
        // Cuota 1: $52 cash. Cuota 2: el resto en zelle. La suma de descuentos
        // debe dar balanceDue/3 = 34.83 (y no 40.72 como con el bug).
        const c1 = computeDivisasSettlement({ balanceDue: 104.49, receivedUSD: 52, serviceFeeIncluded: true });
        const remaining = 104.49 - c1.grossSettled;
        // El resto se paga completo: target full divisas del remanente.
        const fullTarget2 = remaining * (2 / 3) * 1.1;
        const c2 = computeDivisasSettlement({ balanceDue: remaining, receivedUSD: fullTarget2, serviceFeeIncluded: true });
        expect(c1.discountAmount + c2.discountAmount).toBeCloseTo(104.49 / 3, 2); // 34.83
        expect(c1.netItemsApplied + c2.netItemsApplied).toBeCloseTo(104.49 * 2 / 3, 2);
    });

    it('sin servicio (serviceFeeIncluded=false): el neto = lo pagado, descuento = pagado/2', () => {
        const r = computeDivisasSettlement({ balanceDue: 90, receivedUSD: 30, serviceFeeIncluded: false });
        expect(r.serviceFee).toBe(0);
        expect(r.grossSettled).toBeCloseTo(45, 2);        // 30 / (2/3)
        expect(r.discountAmount).toBeCloseTo(15, 2);      // 45 / 3 = pagado/2
        expect(r.netItemsApplied).toBeCloseTo(30, 2);
    });

    it('uso MIXTO (divisas + Bs): solo la porción en divisas recibe descuento', () => {
        // Mesa $100. Cliente paga $30 en divisas (cash/zelle) y el resto en Bs.
        // El −33% aplica solo a lo que cubre la porción en divisas.
        const r = computeDivisasSettlement({ balanceDue: 100, receivedUSD: 30, serviceFeeIncluded: true });
        expect(r.grossSettled).toBeLessThan(100);            // las divisas no saldan toda la cuenta
        expect(r.grossSettled).toBeCloseTo(40.91, 2);        // 30 / (2/3 · 1.1)
        expect(r.discountAmount).toBeCloseTo(13.64, 2);      // < balanceDue/3 (33.33): solo su porción
    });

    it('serviceRate custom (§85): 15% aplica en el multiplicador y en el fee', () => {
        // Pago completo de mesa $100 con servicio 15%: full target = 100·⅔·1.15.
        const fullTarget = 100 * (2 / 3) * 1.15;
        const r = computeDivisasSettlement({ balanceDue: 100, receivedUSD: fullTarget, serviceFeeIncluded: true, serviceRate: 0.15 });
        expect(r.grossSettled).toBeCloseTo(100, 2);
        expect(r.netItemsApplied).toBeCloseTo(66.67, 2);        // 100·⅔
        expect(r.serviceFee).toBeCloseTo(66.67 * 0.15, 2);      // 15% del neto
    });

    it('serviceRate ausente con servicio ON → default 10% (compat)', () => {
        const withDefault = computeDivisasSettlement({ balanceDue: 72, receivedUSD: 52.8, serviceFeeIncluded: true });
        const withExplicit = computeDivisasSettlement({ balanceDue: 72, receivedUSD: 52.8, serviceFeeIncluded: true, serviceRate: 0.10 });
        expect(withDefault).toEqual(withExplicit);
    });

    it('discountRate custom (§87): 40% cambia neto y descuento; default 1/3 intacto', () => {
        // Pago completo mesa $90 sin servicio, 40% off: paga 60% = $54.
        const r = computeDivisasSettlement({ balanceDue: 90, receivedUSD: 54, serviceFeeIncluded: false, discountRate: 0.40 });
        expect(r.grossSettled).toBeCloseTo(90, 2);
        expect(r.discountAmount).toBeCloseTo(36, 2);      // 40% de 90
        expect(r.netItemsApplied).toBeCloseTo(54, 2);     // 60% de 90
    });

    it('discountRate ausente → default 1/3 (compat con tests históricos)', () => {
        const a = computeDivisasSettlement({ balanceDue: 72, receivedUSD: 48, serviceFeeIncluded: false });
        const b = computeDivisasSettlement({ balanceDue: 72, receivedUSD: 48, serviceFeeIncluded: false, discountRate: 1 / 3 });
        expect(a).toEqual(b);
        expect(a.discountAmount).toBeCloseTo(24, 2);       // 72/3
    });

    it('recibido 0 o saldo 0 → todo en cero (sin NaN)', () => {
        expect(computeDivisasSettlement({ balanceDue: 50, receivedUSD: 0, serviceFeeIncluded: true }))
            .toMatchObject({ grossSettled: 0, discountAmount: 0, netItemsApplied: 0, serviceFee: 0 });
        expect(computeDivisasSettlement({ balanceDue: 0, receivedUSD: 40, serviceFeeIncluded: true }))
            .toMatchObject({ grossSettled: 0, discountAmount: 0 });
    });
});
