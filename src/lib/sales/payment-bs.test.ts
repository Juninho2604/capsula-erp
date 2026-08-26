import { describe, it, expect } from 'vitest';
import {
    paymentBucket, isBsPaymentMethod, registeredBs, accumulateBs, emptyBsBreakdown,
} from './payment-bs';

describe('paymentBucket (§163)', () => {
    it('efectivo en divisas va a cash', () => {
        for (const m of ['CASH', 'CASH_USD', 'CASH_EUR']) {
            expect(paymentBucket(m)).toBe('cash');
        }
    });

    it('CASH_BS tiene casilla propia — antes caía en "Otros"', () => {
        // El bug: el clasificador del Z sólo miraba CASH/CASH_USD/CASH_EUR, así
        // que el efectivo en bolívares se reportaba como "Otros" en el arqueo.
        expect(paymentBucket('CASH_BS')).toBe('cashBs');
        expect(paymentBucket('CASH_BS')).not.toBe('other');
    });

    it('los PDV van a card y el pago móvil a mobile', () => {
        for (const m of ['CARD', 'BS_POS', 'PDV_SHANKLISH', 'PDV_SUPERFERRO']) {
            expect(paymentBucket(m)).toBe('card');
        }
        for (const m of ['MOBILE_PAY', 'PAGO_MOVIL', 'MOVIL_NG']) {
            expect(paymentBucket(m)).toBe('mobile');
        }
    });

    it('minúsculas, null y desconocidos no rompen', () => {
        expect(paymentBucket('zelle')).toBe('zelle');
        expect(paymentBucket(null)).toBe('other');
        expect(paymentBucket('INVENTADO')).toBe('other');
    });
});

describe('isBsPaymentMethod', () => {
    it('se cobran en Bs: PDV, pago móvil, efectivo Bs y transferencia', () => {
        for (const m of ['PDV_SHANKLISH', 'MOVIL_NG', 'CASH_BS', 'TRANSFER']) {
            expect(isBsPaymentMethod(m)).toBe(true);
        }
    });

    it('las divisas no', () => {
        for (const m of ['CASH_USD', 'CASH_EUR', 'ZELLE', 'PY']) {
            expect(isBsPaymentMethod(m)).toBe(false);
        }
    });
});

describe('registeredBs', () => {
    it('usa el Bs guardado al cobrar', () => {
        expect(registeredBs({ amountBs: 4500.5, exchangeRate: 100, amountUSD: 10 })).toBe(4500.5);
    });

    it('sin Bs guardado, deriva con la tasa DE ESE COBRO', () => {
        expect(registeredBs({ amountBs: null, exchangeRate: 36.5, amountUSD: 10 })).toBe(365);
    });

    it('sin Bs ni tasa del cobro devuelve null — no se inventa con la tasa de hoy', () => {
        // Regla del esquema: un cobro viejo se reporta "no registrado". Un
        // número reconvertido a tasa actual no cuadra contra el lote del punto.
        expect(registeredBs({ amountUSD: 10 })).toBeNull();
        expect(registeredBs({ amountBs: null, exchangeRate: 0, amountUSD: 10 })).toBeNull();
    });

    it('valores inválidos no producen NaN', () => {
        expect(registeredBs({ amountBs: NaN, exchangeRate: NaN, amountUSD: NaN })).toBeNull();
    });
});

describe('accumulateBs', () => {
    it('suma cada método en su casilla', () => {
        const acc = emptyBsBreakdown();
        accumulateBs(acc, 'PDV_SHANKLISH', { amountBs: 1000 });
        accumulateBs(acc, 'PDV_SUPERFERRO', { amountBs: 500 });
        accumulateBs(acc, 'MOVIL_NG', { amountBs: 250.25 });
        expect(acc.card).toBe(1500);
        expect(acc.mobile).toBe(250.25);
    });

    it('los métodos en divisas no suman al arqueo en Bs', () => {
        const acc = emptyBsBreakdown();
        accumulateBs(acc, 'ZELLE', { amountBs: 999 });
        expect(acc.zelle).toBe(0);
    });

    it('avisa cuando un cobro en Bs no tiene monto registrado', () => {
        const acc = emptyBsBreakdown();
        expect(accumulateBs(acc, 'PDV_SHANKLISH', { amountBs: 1000 })).toBe(true);
        expect(accumulateBs(acc, 'PDV_SHANKLISH', { amountUSD: 10 })).toBe(false);
        // El que faltaba no suma: el subtotal queda corto y por eso hay que avisar.
        expect(acc.card).toBe(1000);
    });
});
