import { describe, it, expect } from 'vitest';
import { canVoidPayable, payableCountsTowardDebt } from './payable-void';

const base = { status: 'PENDING', paidAmountUsd: 0, retentionIvaUsd: 0, retentionIslrUsd: 0 };

describe('canVoidPayable (§160)', () => {
    it('una deuda pendiente sin abonos se puede anular', () => {
        // El caso de admin: FACTURA 007023, $183.71, Pendiente, sin pagos.
        expect(canVoidPayable(base)).toEqual({ ok: true, reason: null });
    });

    it('vencida o parcial-sin-plata también se puede', () => {
        expect(canVoidPayable({ ...base, status: 'OVERDUE' }).ok).toBe(true);
        expect(canVoidPayable({ ...base, status: 'DISPUTED' }).ok).toBe(true);
    });

    it('con abonos NO se anula — el dinero ya se movió', () => {
        const r = canVoidPayable({ ...base, status: 'PARTIAL', paidAmountUsd: 50 });
        expect(r.ok).toBe(false);
        expect(r.reason).toContain('$50.00');
        expect(r.reason).toContain('abonos');
    });

    it('con retenciones aplicadas tampoco', () => {
        // §115 — las retenciones cierran saldo sin efectivo, pero son reales.
        const iva = canVoidPayable({ ...base, retentionIvaUsd: 12.5 });
        expect(iva.ok).toBe(false);
        expect(iva.reason).toContain('retenciones');

        const islr = canVoidPayable({ ...base, retentionIslrUsd: 3 });
        expect(islr.ok).toBe(false);

        const ambas = canVoidPayable({ ...base, retentionIvaUsd: 10, retentionIslrUsd: 5 });
        expect(ambas.reason).toContain('$15.00');
    });

    it('una deuda ya saldada no se anula', () => {
        expect(canVoidPayable({ ...base, status: 'PAID' }).ok).toBe(false);
    });

    it('anular dos veces no procede', () => {
        const r = canVoidPayable({ ...base, status: 'VOID' });
        expect(r.ok).toBe(false);
        expect(r.reason).toContain('ya está anulada');
    });

    it('un residuo de centavo no bloquea la anulación', () => {
        // Sin tolerancia, un 0.001 de coma flotante trababa la anulación de
        // una deuda que en la práctica no tiene un solo abono.
        expect(canVoidPayable({ ...base, paidAmountUsd: 0.001 }).ok).toBe(true);
        expect(canVoidPayable({ ...base, retentionIvaUsd: 0.002 }).ok).toBe(true);
    });

    it('montos inválidos se tratan como cero, no rompen', () => {
        expect(canVoidPayable({ ...base, paidAmountUsd: NaN }).ok).toBe(true);
        expect(canVoidPayable({ status: 'PENDING', paidAmountUsd: 0 }).ok).toBe(true);
    });

    it('el estado en minúsculas se reconoce igual', () => {
        expect(canVoidPayable({ ...base, status: 'void' }).ok).toBe(false);
    });
});

describe('payableCountsTowardDebt', () => {
    it('las anuladas y las pagadas no suman a la deuda', () => {
        expect(payableCountsTowardDebt('VOID')).toBe(false);
        expect(payableCountsTowardDebt('PAID')).toBe(false);
    });

    it('pendiente, parcial y vencida sí suman', () => {
        for (const s of ['PENDING', 'PARTIAL', 'OVERDUE', 'DISPUTED']) {
            expect(payableCountsTowardDebt(s)).toBe(true);
        }
    });
});
