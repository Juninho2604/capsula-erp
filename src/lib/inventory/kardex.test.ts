import { describe, it, expect } from 'vitest';
import {
    movementDirection,
    movementDelta,
    computeRunningBalances,
    reconcile,
} from './kardex';

describe('kardex — dirección de movimientos', () => {
    it('clasifica los tipos conocidos', () => {
        expect(movementDirection('PURCHASE')).toBe('IN');
        expect(movementDirection('PRODUCTION')).toBe('IN');
        expect(movementDirection('ADJUSTMENT_IN')).toBe('IN');
        expect(movementDirection('LOAN_RETURN')).toBe('IN');
        expect(movementDirection('SALE')).toBe('OUT');
        expect(movementDirection('WASTE')).toBe('OUT');
        expect(movementDirection('LOAN_OUT')).toBe('OUT');
        expect(movementDirection('TRANSFER_OUT')).toBe('OUT');
    });

    it('tipos legacy no listados: decide por sufijo, y sin sufijo es UNKNOWN', () => {
        expect(movementDirection('FOO_IN')).toBe('IN');
        expect(movementDirection('FOO_OUT')).toBe('OUT');
        expect(movementDirection('MISTERIO')).toBe('UNKNOWN');
    });

    it('delta usa valor absoluto de la cantidad (movimientos guardan qty positiva)', () => {
        expect(movementDelta('SALE', 3)).toBe(-3);
        expect(movementDelta('SALE', -3)).toBe(-3);
        expect(movementDelta('PURCHASE', 5)).toBe(5);
        expect(movementDelta('MISTERIO', 9)).toBe(0);
    });
});

describe('kardex — saldo corrido hacia atrás', () => {
    const mov = (id: string, type: string, qty: number) => ({
        id, movementType: type, quantity: qty, createdAt: new Date(),
    });

    it('reconstruye el saldo desde el stock actual', () => {
        // Historia real (viejo → nuevo): compra 10, venta 3, ajuste −2 → stock 5.
        // El Kardex la recibe DESC (nuevo → viejo).
        const desc = [
            mov('m3', 'ADJUSTMENT_OUT', 2),
            mov('m2', 'SALE', 3),
            mov('m1', 'PURCHASE', 10),
        ];
        const { rows, openingBalance } = computeRunningBalances(desc, 5);
        expect(rows[0].balanceAfter).toBe(5);  // tras el ajuste
        expect(rows[1].balanceAfter).toBe(7);  // tras la venta
        expect(rows[2].balanceAfter).toBe(10); // tras la compra
        expect(openingBalance).toBe(0);        // antes de todo
    });

    it('separa entradas y salidas por columna', () => {
        const { rows } = computeRunningBalances([mov('a', 'SALE', 2), mov('b', 'PURCHASE', 8)], 6);
        expect(rows[0]).toMatchObject({ qtyIn: 0, qtyOut: 2 });
        expect(rows[1]).toMatchObject({ qtyIn: 8, qtyOut: 0 });
    });

    it('sin movimientos: saldo inicial = stock actual', () => {
        const { rows, openingBalance } = computeRunningBalances([], 42);
        expect(rows).toHaveLength(0);
        expect(openingBalance).toBe(42);
    });

    it('no acumula ruido de coma flotante', () => {
        const desc = Array.from({ length: 10 }, (_, i) => mov(`m${i}`, 'SALE', 0.1));
        const { openingBalance } = computeRunningBalances(desc, 1);
        expect(openingBalance).toBe(2);
    });

    it('un tipo UNKNOWN no altera el saldo (delta 0)', () => {
        const { rows, openingBalance } = computeRunningBalances(
            [mov('x', 'MISTERIO', 99), mov('y', 'PURCHASE', 10)],
            10,
        );
        expect(rows[0].balanceAfter).toBe(10);
        expect(openingBalance).toBe(0);
    });
});

describe('kardex — conciliación contra el stock actual', () => {
    it('sin descuadre cuando los movimientos explican el stock', () => {
        const r = reconcile(42, 42);
        expect(r.hasDiscrepancy).toBe(false);
        expect(r.unexplained).toBe(0);
    });

    it('detecta stock que los movimientos NO explican (caso masa filo 39 vs 42)', () => {
        // El chef cargó 39 pero el stock dice 42: 3 unidades entraron por una
        // vía sin movimiento (import inicial, ajuste directo, otra área).
        const r = reconcile(42, 39);
        expect(r.hasDiscrepancy).toBe(true);
        expect(r.unexplained).toBe(3);
    });

    it('tolera residuos menores a un centésimo', () => {
        expect(reconcile(10, 9.999).hasDiscrepancy).toBe(false);
    });
});
