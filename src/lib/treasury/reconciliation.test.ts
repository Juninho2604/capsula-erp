import { describe, it, expect } from 'vitest';
import { computeReconciliation, defaultTolerance } from './reconciliation';

describe('computeReconciliation', () => {
    it('OPEN cuando no hay estado de cuenta', () => {
        const r = computeReconciliation({ expectedIn: 100000, commissionCalc: 500, statementIn: null });
        expect(r.status).toBe('OPEN');
        expect(r.differential).toBe(0);
    });

    it('RECONCILED cuando la comisión implícita ≈ la calculada', () => {
        // banco dejó 99500 → implícita 500 = calculada 500 → diff 0
        const r = computeReconciliation(
            { expectedIn: 100000, commissionCalc: 500, statementIn: 99500 },
            1
        );
        expect(r.differential).toBe(0);
        expect(r.status).toBe('RECONCILED');
    });

    it('DISCREPANCY cuando el banco cobró más de lo esperado', () => {
        // banco dejó 99000 → implícita 1000 vs calculada 500 → diff 500
        const r = computeReconciliation(
            { expectedIn: 100000, commissionCalc: 500, statementIn: 99000 },
            1
        );
        expect(r.differential).toBe(500);
        expect(r.status).toBe('DISCREPANCY');
    });

    it('absorbe redondeos dentro de la tolerancia', () => {
        // diferencia de 0.30 Bs con tolerancia default (max(1, 0.5%)) → RECONCILED
        const r = computeReconciliation({ expectedIn: 100000, commissionCalc: 500, statementIn: 99499.7 });
        expect(r.status).toBe('RECONCILED');
    });

    it('defaultTolerance = max(1, 0.5% del esperado)', () => {
        expect(defaultTolerance(100)).toBe(1);
        expect(defaultTolerance(100000)).toBe(500);
    });
});
