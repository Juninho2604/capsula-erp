import { describe, it, expect } from 'vitest';
import { computeProductionNet, productionNetWarning } from './production-net';

const YOGURT = 'item-yogurt';
const LECHE = 'item-leche';

describe('computeProductionNet · el caso del yogurt (§154)', () => {
    it('yogurt con yogurt + leche: el neto descuenta el cultivo iniciador', () => {
        // 10 kg de yogurt usando 2 kg del propio yogurt y 8 de leche.
        const r = computeProductionNet({
            outputItemId: YOGURT,
            outputQuantity: 10,
            ingredients: [
                { itemId: YOGURT, quantity: 2 },
                { itemId: LECHE, quantity: 8 },
            ],
        });
        expect(r.selfConsuming).toBe(true);
        expect(r.consumedFromOutput).toBe(2);
        expect(r.net).toBe(8);
    });

    it('sin auto-consumo el neto es todo lo producido', () => {
        const r = computeProductionNet({
            outputItemId: YOGURT,
            outputQuantity: 10,
            ingredients: [{ itemId: LECHE, quantity: 10 }],
        });
        expect(r.selfConsuming).toBe(false);
        expect(r.consumedFromOutput).toBe(0);
        expect(r.net).toBe(10);
    });

    it('suma varias líneas del mismo producto de salida', () => {
        const r = computeProductionNet({
            outputItemId: YOGURT,
            outputQuantity: 10,
            ingredients: [
                { itemId: YOGURT, quantity: 1 },
                { itemId: YOGURT, quantity: 1.5 },
                { itemId: LECHE, quantity: 8 },
            ],
        });
        expect(r.consumedFromOutput).toBe(2.5);
        expect(r.net).toBe(7.5);
    });

    it('consumir más de lo producido da neto negativo, no rompe', () => {
        const r = computeProductionNet({
            outputItemId: YOGURT,
            outputQuantity: 2,
            ingredients: [{ itemId: YOGURT, quantity: 5 }],
        });
        expect(r.net).toBe(-3);
    });

    it('cantidades inválidas cuentan como cero', () => {
        const r = computeProductionNet({
            outputItemId: YOGURT,
            outputQuantity: NaN,
            ingredients: [{ itemId: YOGURT, quantity: NaN }],
        });
        expect(r.net).toBe(0);
        expect(r.selfConsuming).toBe(false);
    });
});

describe('productionNetWarning', () => {
    it('sin auto-consumo no hay aviso', () => {
        const net = computeProductionNet({
            outputItemId: YOGURT, outputQuantity: 10,
            ingredients: [{ itemId: LECHE, quantity: 10 }],
        });
        expect(productionNetWarning(net, 'Yogurt', 'KG')).toBeNull();
    });

    it('con auto-consumo dice producido, consumido y neto', () => {
        const net = computeProductionNet({
            outputItemId: YOGURT, outputQuantity: 10,
            ingredients: [{ itemId: YOGURT, quantity: 2 }],
        });
        const w = productionNetWarning(net, 'Yogurt', 'KG')!;
        expect(w).toContain('10 KG');
        expect(w).toContain('2 KG');
        expect(w).toContain('+8 KG');
    });

    it('el decimal mal puesto se ve en el neto — para eso existe el aviso', () => {
        const net = computeProductionNet({
            outputItemId: YOGURT, outputQuantity: 10,
            ingredients: [{ itemId: YOGURT, quantity: 0.2 }],
        });
        expect(productionNetWarning(net, 'Yogurt', 'KG')).toContain('+9.8 KG');
    });
});
