import { describe, it, expect } from 'vitest';
import { resolveSubAccountCortesia, subCortesiaLabel } from './subaccount-cortesia';

const manager = { firstName: 'David', lastName: 'Salazar' };

describe('resolveSubAccountCortesia (§168)', () => {
    it('cortesía total cubre el subtotal completo', () => {
        const r = resolveSubAccountCortesia({ type: 'CORTESIA_100', subtotal: 42.5, manager });
        expect(r).toEqual({ ok: true, discount: 42.5, percent: 100, authorizedBy: 'David Salazar' });
    });

    it('cortesía en % descuenta la fracción, a centavos', () => {
        const r = resolveSubAccountCortesia({ type: 'CORTESIA_PERCENT', percent: 15, subtotal: 33.33, manager });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.discount).toBe(5);       // 4.9995 → 5.00
            expect(r.percent).toBe(15);
        }
    });

    it('SIN gerente no hay cortesía — nunca se degrada en silencio', () => {
        // El caso que motivó resolveDivisasRate (§149.2): un fallback callado
        // habría cobrado completo a un cliente al que se le prometió descuento.
        const r = resolveSubAccountCortesia({ type: 'CORTESIA_100', subtotal: 10, manager: null });
        expect(r).toEqual({ ok: false, reason: 'UNAUTHORIZED' });
    });

    it('el 100% como porcentaje se rechaza — para eso está CORTESIA_100', () => {
        const r = resolveSubAccountCortesia({ type: 'CORTESIA_PERCENT', percent: 100, subtotal: 10, manager });
        expect(r).toEqual({ ok: false, reason: 'INVALID_PERCENT' });
    });

    it('porcentajes fuera de rango o inválidos se rechazan', () => {
        for (const percent of [0, -5, 150, NaN, undefined, null]) {
            const r = resolveSubAccountCortesia({ type: 'CORTESIA_PERCENT', percent: percent as number, subtotal: 10, manager });
            expect(r.ok).toBe(false);
        }
    });

    it('subtotal cero o inválido no genera descuento', () => {
        for (const subtotal of [0, -3, NaN]) {
            const r = resolveSubAccountCortesia({ type: 'CORTESIA_100', subtotal, manager });
            expect(r).toEqual({ ok: false, reason: 'INVALID_SUBTOTAL' });
        }
    });

    it('gerente sin apellido igual firma', () => {
        const r = resolveSubAccountCortesia({
            type: 'CORTESIA_100', subtotal: 5,
            manager: { firstName: 'Maurizio', lastName: null },
        });
        expect(r.ok && r.authorizedBy).toBe('Maurizio');
    });

    it('decimales del % se conservan en la etiqueta pero el cálculo va a centavos', () => {
        const r = resolveSubAccountCortesia({ type: 'CORTESIA_PERCENT', percent: 12.5, subtotal: 80, manager });
        expect(r.ok && r.discount).toBe(10);
        expect(r.ok && r.percent).toBe(12.5);
    });
});

describe('subCortesiaLabel', () => {
    it('enteros sin decimales, fracciones con dos', () => {
        expect(subCortesiaLabel(100)).toBe('Cortesía 100%');
        expect(subCortesiaLabel(15)).toBe('Cortesía 15%');
        expect(subCortesiaLabel(12.5)).toBe('Cortesía 12.50%');
    });
});
