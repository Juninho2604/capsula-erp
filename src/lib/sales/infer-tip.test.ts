import { describe, it, expect } from 'vitest';
import { inferOrderTip } from './infer-tip';

describe('inferOrderTip — los 3 casos del flujo POS', () => {
    it('Caso A — cliente paga justo: tip = 0', () => {
        expect(inferOrderTip({ total: 20, amountPaid: 20, change: 0 })).toBe(0);
    });

    it('Caso B — "quedate con el vuelto" (excedente como propina): tip = excedente', () => {
        // Cliente paga $25 por una cuenta de $20 y no quiere vuelto.
        expect(inferOrderTip({ total: 20, amountPaid: 25, change: 0 })).toBe(5);
    });

    it('Caso C — propina explícita + vuelto (el bug histórico): tip = lo que se quedó la cajera', () => {
        // Cliente paga $25, cajera marca $3 de propina, le devuelve $2.
        // amountPaid=25, change=2 (vuelto bruto $5 menos $3 de propina).
        // Excedente real = 25 - 2 - 20 = $3. El Z report viejo daba 0 acá.
        expect(inferOrderTip({ total: 20, amountPaid: 25, change: 2 })).toBe(3);
    });

    it('pago mixto: amountPaid es la suma de líneas; misma fórmula', () => {
        // 2 líneas suman $25, cuenta $20, cliente no quiere vuelto.
        expect(inferOrderTip({ total: 20, amountPaid: 25, change: 0 })).toBe(5);
        // Pago mixto con vuelto + propina: 25 entregado, 2 vuelto, propina $3.
        expect(inferOrderTip({ total: 20, amountPaid: 25, change: 2 })).toBe(3);
    });

    it('cliente pagó menos (cuenta abierta a crédito o error de carga): tip = 0', () => {
        expect(inferOrderTip({ total: 20, amountPaid: 15, change: 0 })).toBe(0);
    });

    it('tolera nulls/undefined sin lanzar NaN', () => {
        expect(inferOrderTip({ total: 20, amountPaid: null, change: null })).toBe(0);
        expect(inferOrderTip({ total: 20, amountPaid: undefined, change: undefined })).toBe(0);
    });
});
