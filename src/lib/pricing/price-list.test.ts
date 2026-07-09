import { describe, it, expect } from 'vitest';
import {
    parseChannels,
    pickListForChannel,
    channelPriceMap,
    isPriceListChannel,
    type PriceListForResolve,
} from './price-list';

const list = (over: Partial<PriceListForResolve>): PriceListForResolve => ({
    id: 'l', channels: [], priority: 0, updatedAtMs: 0, items: [], ...over,
});

describe('parseChannels', () => {
    it('parsea JSON válido y filtra keys inválidas', () => {
        expect(parseChannels('["DELIVERY","WINK","BASURA"]')).toEqual(['DELIVERY', 'WINK']);
    });
    it('tolera null / JSON roto / no-array', () => {
        expect(parseChannels(null)).toEqual([]);
        expect(parseChannels('no json')).toEqual([]);
        expect(parseChannels('{"a":1}')).toEqual([]);
    });
});

describe('isPriceListChannel', () => {
    it('valida keys', () => {
        expect(isPriceListChannel('DELIVERY')).toBe(true);
        expect(isPriceListChannel('X')).toBe(false);
        expect(isPriceListChannel(3)).toBe(false);
    });
});

describe('pickListForChannel', () => {
    it('null si ninguna cubre el canal', () => {
        expect(pickListForChannel([list({ channels: ['WINK'] })], 'DELIVERY')).toBeNull();
    });
    it('mayor priority gana', () => {
        const a = list({ id: 'a', channels: ['DELIVERY'], priority: 1 });
        const b = list({ id: 'b', channels: ['DELIVERY'], priority: 5 });
        expect(pickListForChannel([a, b], 'DELIVERY')!.id).toBe('b');
    });
    it('empate de priority → updatedAt más reciente', () => {
        const a = list({ id: 'a', channels: ['DELIVERY'], priority: 2, updatedAtMs: 100 });
        const b = list({ id: 'b', channels: ['DELIVERY'], priority: 2, updatedAtMs: 200 });
        expect(pickListForChannel([a, b], 'DELIVERY')!.id).toBe('b');
    });
});

describe('channelPriceMap', () => {
    it('devuelve overrides de la lista ganadora', () => {
        const l = list({
            channels: ['DELIVERY'],
            items: [{ menuItemId: 'x', price: 12 }, { menuItemId: 'y', price: 8 }],
        });
        const m = channelPriceMap([l], 'DELIVERY');
        expect(m.get('x')).toBe(12);
        expect(m.get('y')).toBe(8);
        expect(m.has('z')).toBe(false);
    });
    it('ignora precios ≤0 o no finitos (defensivo)', () => {
        const l = list({
            channels: ['WINK'],
            items: [{ menuItemId: 'a', price: 0 }, { menuItemId: 'b', price: -5 }, { menuItemId: 'c', price: NaN }, { menuItemId: 'd', price: 10 }],
        });
        const m = channelPriceMap([l], 'WINK');
        expect(m.size).toBe(1);
        expect(m.get('d')).toBe(10);
    });
    it('canal sin lista → mapa vacío', () => {
        expect(channelPriceMap([list({ channels: ['WINK'] })], 'DELIVERY').size).toBe(0);
    });
    it('solo la lista GANADORA define precios (no se acumulan)', () => {
        const win = list({ id: 'win', channels: ['DELIVERY'], priority: 9, items: [{ menuItemId: 'x', price: 5 }] });
        const lose = list({ id: 'lose', channels: ['DELIVERY'], priority: 1, items: [{ menuItemId: 'y', price: 99 }] });
        const m = channelPriceMap([win, lose], 'DELIVERY');
        expect(m.get('x')).toBe(5);
        expect(m.has('y')).toBe(false); // la perdedora no aporta
    });
});
