import { describe, it, expect } from 'vitest';
import {
    settlePayable, checkPaymentFits, applicableAdvance, advanceRemaining, round2,
} from './payable-settlement';

describe('settlePayable — saldo con pagos y retenciones (§115)', () => {
    it('factura nueva sin nada = PENDING, saldo = total', () => {
        const s = settlePayable({ totalUsd: 100, paidUsd: 0 });
        expect(s).toMatchObject({ remainingUsd: 100, status: 'PENDING', isClosed: false, retainedUsd: 0 });
    });

    it('pago parcial = PARTIAL', () => {
        const s = settlePayable({ totalUsd: 100, paidUsd: 40 });
        expect(s.remainingUsd).toBe(60);
        expect(s.status).toBe('PARTIAL');
    });

    it('pago total = PAID, saldo 0', () => {
        const s = settlePayable({ totalUsd: 100, paidUsd: 100 });
        expect(s).toMatchObject({ remainingUsd: 0, status: 'PAID', isClosed: true });
    });

    it('anticipo cubre parte + retención IVA cierra el resto → PAID sin caja extra', () => {
        // Total $100: anticipo aplicado $90 + retención IVA $10 = cerrada.
        const s = settlePayable({ totalUsd: 100, paidUsd: 90, retentionIvaUsd: 10 });
        expect(s.settledUsd).toBe(100);
        expect(s.remainingUsd).toBe(0);
        expect(s.status).toBe('PAID');
        expect(s.retainedUsd).toBe(10);
    });

    it('caso del OWNER: adelanto no cubre total, se retiene IVA+ISLR para cerrar', () => {
        // Factura $1000. Pagó $850. Retención IVA $75 + ISLR $75 = $150. Cierra.
        const s = settlePayable({ totalUsd: 1000, paidUsd: 850, retentionIvaUsd: 75, retentionIslrUsd: 75 });
        expect(s.retainedUsd).toBe(150);
        expect(s.settledUsd).toBe(1000);
        expect(s.isClosed).toBe(true);
        expect(s.status).toBe('PAID');
    });

    it('retención parcial sin cubrir total sigue PARTIAL', () => {
        const s = settlePayable({ totalUsd: 1000, paidUsd: 500, retentionIslrUsd: 100 });
        expect(s.remainingUsd).toBe(400);
        expect(s.status).toBe('PARTIAL');
    });

    it('tolerancia de centavo cierra la factura', () => {
        const s = settlePayable({ totalUsd: 100, paidUsd: 99.995 });
        expect(s.isClosed).toBe(true);
    });

    it('no produce saldo negativo', () => {
        const s = settlePayable({ totalUsd: 100, paidUsd: 120 });
        expect(s.remainingUsd).toBe(0);
        expect(s.status).toBe('PAID');
    });
});

describe('checkPaymentFits — no sobrepasar el saldo (§115)', () => {
    it('acepta un pago dentro del saldo', () => {
        const r = checkPaymentFits({ totalUsd: 100, alreadyPaidUsd: 40, alreadyRetainedUsd: 0, newAmountUsd: 60 });
        expect(r.ok).toBe(true);
        expect(r.maxApplicableUsd).toBe(60);
    });

    it('rechaza un pago que excede el saldo', () => {
        const r = checkPaymentFits({ totalUsd: 100, alreadyPaidUsd: 40, alreadyRetainedUsd: 0, newAmountUsd: 61 });
        expect(r.ok).toBe(false);
        expect(r.reason).toContain('60.00');
    });

    it('cuenta las retenciones ya aplicadas al topar el saldo', () => {
        const r = checkPaymentFits({ totalUsd: 100, alreadyPaidUsd: 50, alreadyRetainedUsd: 30, newAmountUsd: 25 });
        expect(r.ok).toBe(false); // solo quedan $20
        expect(r.maxApplicableUsd).toBe(20);
    });

    it('rechaza monto cero o negativo', () => {
        expect(checkPaymentFits({ totalUsd: 100, alreadyPaidUsd: 0, alreadyRetainedUsd: 0, newAmountUsd: 0 }).ok).toBe(false);
    });
});

describe('anticipos (§115)', () => {
    it('applicableAdvance = min(saldo anticipo, saldo factura)', () => {
        expect(applicableAdvance(50, 80)).toBe(50);
        expect(applicableAdvance(120, 80)).toBe(80);
        expect(applicableAdvance(0, 80)).toBe(0);
        expect(applicableAdvance(-10, 80)).toBe(0);
    });

    it('advanceRemaining = monto − aplicado, nunca negativo', () => {
        expect(advanceRemaining(100, 30)).toBe(70);
        expect(advanceRemaining(100, 100)).toBe(0);
        expect(advanceRemaining(100, 150)).toBe(0);
    });
});

describe('round2', () => {
    it('mata centavos fantasma', () => {
        expect(round2(0.1 + 0.2)).toBe(0.3);
        expect(round2(NaN)).toBe(0);
    });
});
