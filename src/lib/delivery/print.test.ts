import { describe, it, expect } from 'vitest';
import { buildDeliveryKitchenPayload } from './print';
import { parseComandaItems } from './comanda';

const baseOrder = {
    correlative: 'PP-00127',
    customerName: 'Ana Pérez',
    customerPhone: '04141234567',
    deliveryAddress: 'Av. El Hatillo, qta 5',
    deliveryRef: 'Portón verde',
    createdAt: '2026-06-08T16:00:00.000Z',
    comanda: {
        items: [
            { nombre: 'Poke de salmón', cantidad: 2, modificadores: ['sin cebolla', 'extra aguacate'] },
            { name: 'Limonada', qty: 1 },
        ],
    },
};

describe('parseComandaItems — modificadores', () => {
    it('extrae modificadores (array de strings)', () => {
        const items = parseComandaItems(baseOrder.comanda);
        expect(items[0].modifiers).toEqual(['sin cebolla', 'extra aguacate']);
        expect(items[1].modifiers).toEqual([]);
    });

    it('extrae modificadores de array de objetos {name}', () => {
        const items = parseComandaItems({
            items: [{ nombre: 'X', modifiers: [{ name: 'doble' }, { nombre: 'picante' }] }],
        });
        expect(items[0].modifiers).toEqual(['doble', 'picante']);
    });
});

describe('buildDeliveryKitchenPayload', () => {
    it('arma un payload KITCHEN con label DELIVERY', () => {
        const p = buildDeliveryKitchenPayload(baseOrder);
        expect(p.type).toBe('KITCHEN');
        expect(p.orderType).toBe('DELIVERY');
        expect(p.orderTypeLabel).toBe('DELIVERY');
        expect(p.orderNumber).toBe('PP-00127');
        expect(p.createdAt).toBe('2026-06-08T16:00:00.000Z');
    });

    it('mapea ítems con cantidad y modificadores', () => {
        const p = buildDeliveryKitchenPayload(baseOrder);
        expect(p.items).toEqual([
            { name: 'Poke de salmón', quantity: 2, modifiers: ['sin cebolla', 'extra aguacate'] },
            { name: 'Limonada', quantity: 1, modifiers: [] },
        ]);
    });

    it('mete dirección + referencia + teléfono en customerAddress', () => {
        const p = buildDeliveryKitchenPayload(baseOrder);
        expect(p.customerName).toBe('Ana Pérez');
        expect(p.customerAddress).toBe('Av. El Hatillo, qta 5 · Ref: Portón verde · Tel: 04141234567');
    });

    it('tolera campos faltantes (sin dirección/teléfono → null)', () => {
        const p = buildDeliveryKitchenPayload({
            correlative: 'PP-1',
            createdAt: '2026-06-08T16:00:00.000Z',
            comanda: { items: [{ name: 'X' }] },
        });
        expect(p.customerName).toBeNull();
        expect(p.customerAddress).toBeNull();
        expect(p.items[0]).toEqual({ name: 'X', quantity: 1, modifiers: [] });
    });

    it('ítem sin nombre cae a "Ítem"', () => {
        const p = buildDeliveryKitchenPayload({
            correlative: 'PP-1',
            createdAt: '2026-06-08T16:00:00.000Z',
            comanda: { items: [{ cantidad: 3 }] },
        });
        expect(p.items[0]).toEqual({ name: 'Ítem', quantity: 3, modifiers: [] });
    });
});
