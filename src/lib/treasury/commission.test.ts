import { describe, it, expect } from 'vitest';
import { resolveTerminalForMethod, commissionBs, netBs, type TerminalLike } from './commission';

const term = (over: Partial<TerminalLike>): TerminalLike => ({
    posMethodKey: 'PDV_SUPERFERRO',
    commissionPct: 0.5,
    bankAccountId: 'acc1',
    isActive: true,
    ...over,
});

describe('resolveTerminalForMethod', () => {
    const terminals = [
        term({ posMethodKey: 'PDV_SUPERFERRO', bankAccountId: 'sf' }),
        term({ posMethodKey: 'PDV_SHANKLISH', bankAccountId: 'sh' }),
        term({ posMethodKey: 'MOVIL_NG', bankAccountId: 'ng', isActive: false }),
    ];

    it('mapea el método al terminal correcto', () => {
        expect(resolveTerminalForMethod('PDV_SHANKLISH', terminals)?.bankAccountId).toBe('sh');
    });
    it('ignora terminales inactivos', () => {
        expect(resolveTerminalForMethod('MOVIL_NG', terminals)).toBeNull();
    });
    it('devuelve null para método sin mapeo o vacío', () => {
        expect(resolveTerminalForMethod('CASH_USD', terminals)).toBeNull();
        expect(resolveTerminalForMethod(null, terminals)).toBeNull();
    });
});

describe('commissionBs / netBs', () => {
    it('calcula la comisión como % del Bs', () => {
        expect(commissionBs(100000, 0.5)).toBe(500);
        expect(commissionBs(37145.72, 0.32)).toBe(118.87);
    });
    it('comisión 0 si monto o pct no positivos', () => {
        expect(commissionBs(0, 0.5)).toBe(0);
        expect(commissionBs(1000, 0)).toBe(0);
        expect(commissionBs(-50, 0.5)).toBe(0);
    });
    it('neto = bruto − comisión', () => {
        expect(netBs(100000, 0.5)).toBe(99500);
        expect(netBs(37145.72, 0.32)).toBe(37026.85);
    });
});

import { terminalCommissionPct, accountCommissionPct } from './commission';

describe('terminalCommissionPct (PDV por contraparte)', () => {
    const t = { commissionPct: 0.5, commNaturalPct: 0, commJuridicaPct: 1.2 };
    it('natural cae al % legado si no hay commNaturalPct', () => {
        expect(terminalCommissionPct(t, 'NATURAL')).toBe(0.5);
    });
    it('natural usa commNaturalPct cuando existe', () => {
        expect(terminalCommissionPct({ ...t, commNaturalPct: 0.3 }, 'NATURAL')).toBe(0.3);
    });
    it('jurídica usa commJuridicaPct', () => {
        expect(terminalCommissionPct(t, 'JURIDICA')).toBe(1.2);
    });
});

describe('accountCommissionPct (pago móvil/transfer por dirección+contraparte)', () => {
    const a = { commInNaturalPct: 0, commInJuridicaPct: 0.5, commOutNaturalPct: 0.3, commOutJuridicaPct: 0.8 };
    it('ingreso natural = 0 (no cobra), jurídica cobra', () => {
        expect(accountCommissionPct(a, 'IN', 'NATURAL')).toBe(0);
        expect(accountCommissionPct(a, 'IN', 'JURIDICA')).toBe(0.5);
    });
    it('egreso cobra a ambas', () => {
        expect(accountCommissionPct(a, 'OUT', 'NATURAL')).toBe(0.3);
        expect(accountCommissionPct(a, 'OUT', 'JURIDICA')).toBe(0.8);
    });
});
