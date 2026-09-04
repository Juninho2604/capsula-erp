import { describe, it, expect } from 'vitest';
import { buildProductionReversal, negativesAfterReversal } from './production-reversal';

const consumo = (itemId: string, qty: number, areaId: string | null = 'area-1') => ({
    id: `m-${itemId}`, inventoryItemId: itemId, movementType: 'PRODUCTION_OUT',
    quantity: -qty, unit: 'KG', areaId,
});
const produccion = (itemId: string, qty: number, areaId: string | null = 'area-1') => ({
    id: `m-${itemId}-in`, inventoryItemId: itemId, movementType: 'PRODUCTION_IN',
    quantity: qty, unit: 'KG', areaId,
});

describe('buildProductionReversal (§169)', () => {
    it('devuelve los ingredientes y retira el producto terminado', () => {
        // Producción: consumió 3 de harina y 2 de carne, produjo 4 de kibbe.
        const r = buildProductionReversal([
            consumo('harina', 3), consumo('carne', 2), produccion('kibbe', 4),
        ]);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.areaId).toBe('area-1');
        const byItem = Object.fromEntries(r.lines.map(l => [l.inventoryItemId, l]));
        // Los insumos VUELVEN (+), el producto SALE (−).
        expect(byItem.harina.delta).toBe(3);
        expect(byItem.harina.movementType).toBe('PRODUCTION_IN');
        expect(byItem.carne.delta).toBe(2);
        expect(byItem.kibbe.delta).toBe(-4);
        expect(byItem.kibbe.movementType).toBe('PRODUCTION_OUT');
    });

    it('el almacén sale de los propios movimientos', () => {
        const r = buildProductionReversal([consumo('harina', 1, 'produccion')]);
        expect(r.ok && r.areaId).toBe('produccion');
    });

    it('sin almacén en los movimientos usa el indicado por quien cancela', () => {
        // Órdenes anteriores a §169: los movimientos no guardaban areaId.
        const r = buildProductionReversal([consumo('harina', 1, null)], 'area-elegida');
        expect(r.ok && r.areaId).toBe('area-elegida');
    });

    it('sin almacén y sin indicación NO adivina', () => {
        const r = buildProductionReversal([consumo('harina', 1, null)]);
        expect(r).toEqual({ ok: false, reason: 'AREA_UNKNOWN' });
    });

    it('movimientos en almacenes distintos se rechazan — que lo resuelva una persona', () => {
        const r = buildProductionReversal([
            consumo('harina', 1, 'area-1'), consumo('carne', 1, 'area-2'),
        ]);
        expect(r).toEqual({ ok: false, reason: 'AREA_AMBIGUOUS' });
    });

    it('una orden sin movimientos no tiene nada que revertir', () => {
        expect(buildProductionReversal([])).toEqual({ ok: false, reason: 'NO_MOVEMENTS' });
        expect(buildProductionReversal([
            { id: 'x', inventoryItemId: 'a', movementType: 'SALE', quantity: -1, unit: 'KG', areaId: 'area-1' },
        ])).toEqual({ ok: false, reason: 'NO_MOVEMENTS' });
    });

    it('el mismo insumo repetido se suma y toca el stock una sola vez', () => {
        const r = buildProductionReversal([consumo('harina', 2), consumo('harina', 3)]);
        expect(r.ok && r.lines).toHaveLength(1);
        expect(r.ok && r.lines[0].delta).toBe(5);
    });

    it('auto-consumo (§154) que se cancela entre sí no genera línea', () => {
        // Yogurt que se produce usando yogurt: entra 5, sale 5 → neto 0.
        const r = buildProductionReversal([consumo('yogurt', 5), produccion('yogurt', 5)]);
        expect(r).toEqual({ ok: false, reason: 'NO_MOVEMENTS' });
    });

    it('auto-consumo parcial revierte sólo el neto', () => {
        const r = buildProductionReversal([consumo('yogurt', 2), produccion('yogurt', 5)]);
        expect(r.ok && r.lines).toHaveLength(1);
        expect(r.ok && r.lines[0].delta).toBe(-3); // neto producido 3 → sale 3
    });

    it('cantidades inválidas o en cero se ignoran', () => {
        const r = buildProductionReversal([
            { id: 'a', inventoryItemId: 'x', movementType: 'PRODUCTION_OUT', quantity: NaN, unit: 'KG', areaId: 'area-1' },
            consumo('harina', 1),
        ]);
        expect(r.ok && r.lines).toHaveLength(1);
        expect(r.ok && r.lines[0].inventoryItemId).toBe('harina');
    });
});

describe('negativesAfterReversal', () => {
    it('avisa cuando retirar el producto deja el saldo bajo cero', () => {
        // El kibbe producido ya se vendió: al revertir queda en negativo.
        const r = buildProductionReversal([consumo('harina', 3), produccion('kibbe', 4)]);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const neg = negativesAfterReversal(r.lines, { harina: 10, kibbe: 1 });
        expect(neg).toHaveLength(1);
        expect(neg[0].inventoryItemId).toBe('kibbe');
        expect(neg[0].after).toBe(-3);
    });

    it('sin negativos devuelve lista vacía', () => {
        const r = buildProductionReversal([consumo('harina', 3), produccion('kibbe', 4)]);
        if (!r.ok) throw new Error('plan inválido');
        expect(negativesAfterReversal(r.lines, { harina: 10, kibbe: 20 })).toEqual([]);
    });

    it('un insumo sin fila de stock cuenta como cero', () => {
        const r = buildProductionReversal([produccion('kibbe', 2)]);
        if (!r.ok) throw new Error('plan inválido');
        expect(negativesAfterReversal(r.lines, {})).toHaveLength(1);
    });
});
