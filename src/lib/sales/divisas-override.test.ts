import { describe, it, expect } from 'vitest';
import { resolveDivisasRate } from './divisas-override';
import { DEFAULT_DIVISAS_DISCOUNT_PERCENT } from './divisas-config';

const MGR = { firstName: 'Mauricio', lastName: 'Pérez' };
const CONFIGURED = 33.333333333333336;

describe('resolveDivisasRate', () => {
    it('sin ajuste pedido usa el configurado y no registra autor', () => {
        const r = resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: true,
        });
        expect(r).toEqual({ ok: true, rate: divisas(CONFIGURED), overrideBy: null });
    });

    it('con gerente verificado aplica el % pedido y deja el nombre', () => {
        const r = resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: true,
            requestedPercent: 40,
            manager: MGR,
        });
        expect(r).toEqual({ ok: true, rate: 0.4, overrideBy: 'Mauricio Pérez' });
    });

    it('rechaza el ajuste si no hay gerente verificado', () => {
        // Lo importante es que NO caiga al configurado en silencio: si el
        // cobro se registrara igual, un request armado a mano quedaría
        // indistinguible de uno autorizado.
        expect(resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: true,
            requestedPercent: 80,
            manager: null,
        })).toEqual({ ok: false, reason: 'UNAUTHORIZED' });

        expect(resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: true,
            requestedPercent: 80,
        })).toEqual({ ok: false, reason: 'UNAUTHORIZED' });
    });

    it('un gerente sin nombre no autoriza', () => {
        expect(resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: true,
            requestedPercent: 50,
            manager: { firstName: '  ', lastName: '' },
        })).toEqual({ ok: false, reason: 'UNAUTHORIZED' });
    });

    it('sin descuento de divisas el ajuste se ignora — no se cuela en un pago en Bs', () => {
        const r = resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: false,
            requestedPercent: 90,
            manager: MGR,
        });
        expect(r).toEqual({ ok: true, rate: divisas(CONFIGURED), overrideBy: null });
    });

    it('respeta el tope de 90% y el piso de 0%', () => {
        const alto = resolveDivisasRate({
            configuredPercent: CONFIGURED, discountApplies: true,
            requestedPercent: 150, manager: MGR,
        });
        expect(alto).toMatchObject({ ok: true, rate: 0.9 });

        const bajo = resolveDivisasRate({
            configuredPercent: CONFIGURED, discountApplies: true,
            requestedPercent: -20, manager: MGR,
        });
        expect(bajo).toMatchObject({ ok: true, rate: 0 });
    });

    it('un % pedido no numérico cae al configurado, no rechaza el cobro', () => {
        const r = resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: true,
            requestedPercent: NaN,
            manager: MGR,
        });
        expect(r).toEqual({ ok: true, rate: divisas(CONFIGURED), overrideBy: null });
    });

    it('0% es un ajuste válido — cobrar sin descuento pese a pagar en divisas', () => {
        const r = resolveDivisasRate({
            configuredPercent: CONFIGURED,
            discountApplies: true,
            requestedPercent: 0,
            manager: MGR,
        });
        expect(r).toEqual({ ok: true, rate: 0, overrideBy: 'Mauricio Pérez' });
    });

    it('el default histórico sigue siendo un tercio', () => {
        const r = resolveDivisasRate({
            configuredPercent: DEFAULT_DIVISAS_DISCOUNT_PERCENT,
            discountApplies: true,
        });
        expect(r).toMatchObject({ ok: true });
        if (r.ok) expect(r.rate).toBeCloseTo(1 / 3, 6);
    });
});

function divisas(percent: number): number {
    return percent / 100;
}
