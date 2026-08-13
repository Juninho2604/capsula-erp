import { describe, it, expect } from 'vitest';
import { nextDivisasDiscount, isDivisasMethod, divisasPortion, type DivisasAutoInput } from './divisas-auto-discount';

const base: DivisasAutoInput = {
    mixedMode: false,
    mixedMethods: [],
    method: 'CASH_USD',
    methodTouched: false,
    current: 'NONE',
};

describe('isDivisasMethod', () => {
    it('efectivo USD/EUR y Zelle entran; los bolívares no', () => {
        for (const m of ['CASH', 'CASH_USD', 'CASH_EUR', 'ZELLE']) {
            expect(isDivisasMethod(m)).toBe(true);
        }
        for (const m of ['CASH_BS', 'MOBILE_PAY', 'CARD', 'TRANSFER', 'PDV_SHANKLISH', '']) {
            expect(isDivisasMethod(m)).toBe(false);
        }
        expect(isDivisasMethod(null)).toBe(false);
        expect(isDivisasMethod(undefined)).toBe(false);
    });
});

describe('nextDivisasDiscount · pago mixto (el bug de la cajera, §152)', () => {
    it('con una línea en Zelle y otra en efectivo, aplica el descuento', () => {
        // Reporte: "tengo un pago de zelle y cash y me toma el monto completo".
        expect(nextDivisasDiscount({
            ...base, mixedMode: true, mixedMethods: ['ZELLE', 'CASH_USD'],
        })).toBe('DIVISAS_33');
    });

    it('aplica aunque la cajera nunca haya tocado el selector único', () => {
        // Ir directo a mixto dejaba methodTouched en false, y el efecto leía
        // eso como "no eligió nada" → borraba el descuento recién puesto.
        expect(nextDivisasDiscount({
            ...base, mixedMode: true, methodTouched: false,
            mixedMethods: ['ZELLE', 'CASH_BS'], current: 'DIVISAS_33',
        })).toBeNull(); // ya está bien, no hay que tocarlo
    });

    it('no lo borra cuando el método único quedó en bolívares', () => {
        // Tocar Pago Móvil y después pasar a mixto también lo rompía.
        expect(nextDivisasDiscount({
            ...base, mixedMode: true, methodTouched: true, method: 'MOBILE_PAY',
            mixedMethods: ['ZELLE', 'CASH_BS'],
        })).toBe('DIVISAS_33');
    });

    it('sin ninguna línea en divisas no hay descuento', () => {
        expect(nextDivisasDiscount({
            ...base, mixedMode: true, mixedMethods: ['CASH_BS', 'MOBILE_PAY'],
        })).toBeNull(); // ya estaba en NONE
        expect(nextDivisasDiscount({
            ...base, mixedMode: true, mixedMethods: ['CASH_BS'], current: 'DIVISAS_33',
        })).toBe('NONE');
    });

    it('mixto sin líneas todavía no descuenta', () => {
        expect(nextDivisasDiscount({ ...base, mixedMode: true, mixedMethods: [] })).toBeNull();
        expect(nextDivisasDiscount({
            ...base, mixedMode: true, mixedMethods: [], current: 'DIVISAS_33',
        })).toBe('NONE');
    });
});

describe('nextDivisasDiscount · método único (no se rompe el candado §121)', () => {
    it('sin método elegido no hay descuento — la pre-cuenta sale sin descontar', () => {
        // El POS arranca con CASH_USD de centinela. Si esto se abriera, las
        // pre-cuentas volverían a imprimirse descontadas sin que nadie lo pida.
        expect(nextDivisasDiscount({ ...base, methodTouched: false })).toBeNull();
        expect(nextDivisasDiscount({
            ...base, methodTouched: false, current: 'DIVISAS_33',
        })).toBe('NONE');
    });

    it('con efectivo o Zelle elegido, aplica', () => {
        expect(nextDivisasDiscount({ ...base, methodTouched: true, method: 'ZELLE' })).toBe('DIVISAS_33');
        expect(nextDivisasDiscount({ ...base, methodTouched: true, method: 'CASH_EUR' })).toBe('DIVISAS_33');
    });

    it('al pasar a bolívares lo quita — la cuenta en Bs no lleva descuento', () => {
        expect(nextDivisasDiscount({
            ...base, methodTouched: true, method: 'CASH_BS', current: 'DIVISAS_33',
        })).toBe('NONE');
    });
});

describe('nextDivisasDiscount · la cortesía manda', () => {
    it('no pisa una cortesía elegida a mano, en ningún modo', () => {
        for (const current of ['CORTESIA_100', 'CORTESIA_PERCENT'] as const) {
            expect(nextDivisasDiscount({ ...base, current, methodTouched: true, method: 'ZELLE' })).toBeNull();
            expect(nextDivisasDiscount({
                ...base, current, mixedMode: true, mixedMethods: ['ZELLE'],
            })).toBeNull();
            expect(nextDivisasDiscount({
                ...base, current, methodTouched: true, method: 'CASH_BS',
            })).toBeNull();
        }
    });
});

describe('nextDivisasDiscount · estabilidad', () => {
    it('devuelve null cuando ya está en el valor correcto — no hay bucle de render', () => {
        expect(nextDivisasDiscount({
            ...base, methodTouched: true, method: 'ZELLE', current: 'DIVISAS_33',
        })).toBeNull();
        expect(nextDivisasDiscount({
            ...base, methodTouched: true, method: 'CASH_BS', current: 'NONE',
        })).toBeNull();
    });
});

describe('divisasPortion · suma TODAS las líneas en divisas (§152)', () => {
    it('Zelle + efectivo suman los dos, no uno solo', () => {
        // El reporte de Omar: "tomaba el descuento de una sola operación
        // cuando en pago mixto los dos eran divisas".
        expect(divisasPortion([
            { method: 'ZELLE', amountUSD: 50 },
            { method: 'CASH_USD', amountUSD: 40 },
        ])).toBe(90);
    });

    it('con tres líneas en divisas suma las tres', () => {
        expect(divisasPortion([
            { method: 'ZELLE', amountUSD: 20 },
            { method: 'CASH_USD', amountUSD: 15 },
            { method: 'CASH_EUR', amountUSD: 5 },
        ])).toBe(40);
    });

    it('deja afuera las líneas en bolívares', () => {
        expect(divisasPortion([
            { method: 'ZELLE', amountUSD: 30 },
            { method: 'CASH_BS', amountUSD: 25 },
            { method: 'MOBILE_PAY', amountUSD: 10 },
        ])).toBe(30);
    });

    it('sin líneas en divisas da cero, y no rompe con montos inválidos', () => {
        expect(divisasPortion([{ method: 'CASH_BS', amountUSD: 40 }])).toBe(0);
        expect(divisasPortion([])).toBe(0);
        expect(divisasPortion([{ method: 'ZELLE', amountUSD: NaN }])).toBe(0);
    });
});
