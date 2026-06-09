import { describe, it, expect } from 'vitest';
import { hmacSign } from './webhook-sign';
import { buildWebhookPayload, type WebhookOrderInput } from './webhook-payload';

describe('hmacSign', () => {
    it('es determinística (mismo body+secreto → misma firma)', () => {
        expect(hmacSign('{"a":1}', 'secret')).toBe(hmacSign('{"a":1}', 'secret'));
    });
    it('produce 64 hex chars (sha256)', () => {
        expect(hmacSign('x', 'k')).toMatch(/^[0-9a-f]{64}$/);
    });
    it('cambia con el secreto', () => {
        expect(hmacSign('x', 'k1')).not.toBe(hmacSign('x', 'k2'));
    });
    it('cambia con el body', () => {
        expect(hmacSign('a', 'k')).not.toBe(hmacSign('b', 'k'));
    });
});

const order: WebhookOrderInput = {
    id: 'ord1',
    correlative: 'PP-00127',
    status: 'EN_CAMINO',
    channel: 'telegram',
    chatId: '123',
    customerName: 'Ana',
    customerPhone: '0414',
    deliveryAddress: 'Calle 1',
    totalUsd: 12.5,
    branch: { id: 'b1', name: 'El Hatillo' },
    driver: { id: 'd1', name: 'Luis', phone: '0424' },
};

describe('buildWebhookPayload', () => {
    it('arma el body { evento, orden }', () => {
        const body = buildWebhookPayload('orden.en_camino', order);
        expect(body.evento).toBe('orden.en_camino');
        expect(body.orden.correlativo).toBe('PP-00127');
        expect(body.orden.estado).toBe('EN_CAMINO');
        expect(body.orden.canal).toBe('telegram');
        expect(body.orden.chat_id).toBe('123');
        expect(body.orden.cliente).toEqual({ nombre: 'Ana', telefono: '0414' });
        expect(body.orden.sede).toEqual({ id: 'b1', nombre: 'El Hatillo' });
        expect(body.orden.motorizado).toEqual({ id: 'd1', nombre: 'Luis', telefono: '0424' });
    });

    it('sede y motorizado null cuando no hay', () => {
        const body = buildWebhookPayload('orden.en_cocina', {
            ...order,
            branch: null,
            driver: null,
        });
        expect(body.orden.sede).toBeNull();
        expect(body.orden.motorizado).toBeNull();
    });
});
