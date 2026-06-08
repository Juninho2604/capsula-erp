import { describe, it, expect } from 'vitest';
import {
    computeItemsHash,
    isWithinIdempotencyWindow,
    IDEMPOTENCY_WINDOW_MS,
} from './idempotency';
import {
    extractItemNames,
    extractComandaMeta,
    computeComandaSignature,
} from './comanda';

describe('comanda parsing', () => {
    it('extrae nombres de ítems en varios shapes', () => {
        expect(
            extractItemNames({ items: [{ nombre: 'Poke', cantidad: 2 }, { name: 'Soda' }] }),
        ).toEqual(['Poke', 'Soda']);
        expect(extractItemNames({ productos: [{ producto: 'Sushi' }] })).toEqual(['Sushi']);
        expect(extractItemNames({})).toEqual([]);
        expect(extractItemNames(null)).toEqual([]);
    });

    it('extrae metadatos de cliente/entrega en raíz o anidados', () => {
        const meta = extractComandaMeta({
            cliente: { nombre: 'Ana', telefono: '0414', direccion: 'Calle 1' },
            total_usd: 12.5,
        });
        expect(meta.customerName).toBe('Ana');
        expect(meta.customerPhone).toBe('0414');
        expect(meta.deliveryAddress).toBe('Calle 1');
        expect(meta.totalUsd).toBe(12.5);
        expect(meta.lat).toBeNull();
    });

    it('firma estable es orden-independiente', () => {
        const a = computeComandaSignature({ items: [{ name: 'Poke', qty: 1 }, { name: 'Soda', qty: 2 }] });
        const b = computeComandaSignature({ items: [{ name: 'Soda', qty: 2 }, { name: 'Poke', qty: 1 }] });
        expect(a).toBe(b);
    });
});

describe('idempotency', () => {
    it('mismo canal+chat+comanda → mismo hash', () => {
        const c = { items: [{ name: 'Poke', qty: 1 }] };
        expect(computeItemsHash('telegram', '123', c)).toBe(computeItemsHash('telegram', '123', c));
    });

    it('distinto chat → distinto hash', () => {
        const c = { items: [{ name: 'Poke', qty: 1 }] };
        expect(computeItemsHash('telegram', '123', c)).not.toBe(computeItemsHash('telegram', '999', c));
    });

    it('distinta comanda → distinto hash', () => {
        expect(computeItemsHash('telegram', '1', { items: [{ name: 'A' }] })).not.toBe(
            computeItemsHash('telegram', '1', { items: [{ name: 'B' }] }),
        );
    });

    it('canal es case-insensible', () => {
        const c = { items: [{ name: 'X' }] };
        expect(computeItemsHash('Telegram', '1', c)).toBe(computeItemsHash('telegram', '1', c));
    });

    it('ventana de dedupe', () => {
        const now = new Date('2026-06-08T12:10:00Z');
        const recent = new Date('2026-06-08T12:05:00Z'); // 5 min antes
        const old = new Date('2026-06-08T11:50:00Z'); // 20 min antes
        expect(isWithinIdempotencyWindow(recent, now)).toBe(true);
        expect(isWithinIdempotencyWindow(old, now)).toBe(false);
    });

    it('no considera duplicado un createdAt futuro (delta negativo)', () => {
        const now = new Date('2026-06-08T12:00:00Z');
        const future = new Date('2026-06-08T12:05:00Z');
        expect(isWithinIdempotencyWindow(future, now)).toBe(false);
    });

    it('la ventana por defecto son 10 minutos', () => {
        expect(IDEMPOTENCY_WINDOW_MS).toBe(600000);
    });
});
