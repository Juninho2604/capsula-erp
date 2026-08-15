import { describe, it, expect } from 'vitest';
import {
    computeShortfalls,
    describeShortfall,
    shortfallMessage,
    shortfallAuditNote,
    type StockRequirementRow,
} from './stock-shortfall';

const row = (over: Partial<StockRequirementRow> = {}): StockRequirementRow => ({
    itemId: 'i1', name: 'Aceite de oliva', required: 5, available: 2, unit: 'L', ...over,
});

describe('computeShortfalls (§155)', () => {
    it('marca el faltante y el saldo negativo en que queda', () => {
        const [f] = computeShortfalls([row()]);
        expect(f.shortfall).toBe(3);
        expect(f.resulting).toBe(-3);
    });

    it('con stock suficiente no devuelve nada', () => {
        expect(computeShortfalls([row({ available: 5 })])).toEqual([]);
        expect(computeShortfalls([row({ available: 10 })])).toEqual([]);
    });

    it('un insumo que ya venía en negativo se hunde más', () => {
        // Segunda producción antes de cargar la entrada.
        const [f] = computeShortfalls([row({ available: -3, required: 2 })]);
        expect(f.shortfall).toBe(5);
        expect(f.resulting).toBe(-5);
    });

    it('sólo devuelve los que faltan, no todos', () => {
        const faltantes = computeShortfalls([
            row({ itemId: 'a', name: 'Aceite', available: 0, required: 4 }),
            row({ itemId: 'b', name: 'Sal', available: 10, required: 1 }),
            row({ itemId: 'c', name: 'Ajo', available: 0.5, required: 2 }),
        ]);
        expect(faltantes.map(f => f.name)).toEqual(['Aceite', 'Ajo']);
    });

    it('un residuo de coma flotante NO cuenta como faltante', () => {
        // 0.1 + 0.2 = 0.30000000000000004. Sin tolerancia esto bloqueaba una
        // producción que en realidad tenía el stock justo.
        expect(computeShortfalls([row({ required: 0.1 + 0.2, available: 0.3 })])).toEqual([]);
    });

    it('cantidades inválidas se tratan como cero, no rompen', () => {
        const [f] = computeShortfalls([row({ required: NaN, available: NaN })]);
        expect(f).toBeUndefined();
        const [g] = computeShortfalls([row({ required: 3, available: NaN })]);
        expect(g.shortfall).toBe(3);
    });

    it('empate exacto no es faltante', () => {
        expect(computeShortfalls([row({ required: 5, available: 5 })])).toEqual([]);
    });
});

describe('mensajes', () => {
    it('describe qué falta y en cuánto queda — es lo que se confirma', () => {
        const [f] = computeShortfalls([row()]);
        const texto = describeShortfall(f);
        expect(texto).toContain('Aceite de oliva');
        expect(texto).toContain('necesario 5 L');
        expect(texto).toContain('disponible 2 L');
        expect(texto).toContain('quedaría en -3 L');
    });

    it('el mensaje junta una línea por insumo', () => {
        const faltantes = computeShortfalls([
            row({ itemId: 'a', name: 'Aceite', available: 0, required: 4 }),
            row({ itemId: 'b', name: 'Ajo', available: 0, required: 2 }),
        ]);
        expect(shortfallMessage(faltantes).split('\n')).toHaveLength(2);
    });

    it('la nota de auditoría dice qué faltó y por qué queda en negativo', () => {
        const faltantes = computeShortfalls([row()]);
        const nota = shortfallAuditNote(faltantes);
        expect(nota).toContain('Aceite de oliva 3 L');
        expect(nota).toContain('cargue la entrada');
    });
});
