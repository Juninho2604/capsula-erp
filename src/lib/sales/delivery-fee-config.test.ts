import { describe, it, expect } from 'vitest';
import {
    normalizeDeliveryFee,
    parseDeliveryFee,
    deliveryFeeForZone,
    DEFAULT_DELIVERY_FEES,
} from './delivery-fee-config';

describe('delivery-fee-config (§157)', () => {
    it('la política vigente: normal $3, cercano $1', () => {
        expect(DEFAULT_DELIVERY_FEES).toEqual({ normal: 3, cercano: 1 });
    });

    it('la zona decide el monto; zona desconocida cae a normal, nunca a gratis', () => {
        expect(deliveryFeeForZone(DEFAULT_DELIVERY_FEES, 'NORMAL')).toBe(3);
        expect(deliveryFeeForZone(DEFAULT_DELIVERY_FEES, 'CERCANO')).toBe(1);
        expect(deliveryFeeForZone(DEFAULT_DELIVERY_FEES, null)).toBe(3);
        expect(deliveryFeeForZone(DEFAULT_DELIVERY_FEES, undefined)).toBe(3);
    });

    it('normaliza: negativos a 0, typo grande topado a 50, redondeo a centavos', () => {
        expect(normalizeDeliveryFee(-2, 3)).toBe(0);
        expect(normalizeDeliveryFee(300, 3)).toBe(50); // 300 en vez de 3.00
        expect(normalizeDeliveryFee(1.239, 3)).toBe(1.24);
        expect(normalizeDeliveryFee(NaN, 3)).toBe(3);
        expect(normalizeDeliveryFee(null, 1)).toBe(1);
    });

    it('parsea lo guardado en SystemConfig con fallback por zona', () => {
        expect(parseDeliveryFee('3', 4.5)).toBe(3);
        expect(parseDeliveryFee('1', 3)).toBe(1);
        expect(parseDeliveryFee('basura', 3)).toBe(3);
        expect(parseDeliveryFee(null, 1)).toBe(1);
        expect(parseDeliveryFee('0', 3)).toBe(0); // gratis explícito es válido
    });
});
