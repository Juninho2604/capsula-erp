import { describe, it, expect } from 'vitest';
import { canViewPaymentMethod } from './payment-method';

describe('canViewPaymentMethod', () => {
    it('permite a OWNER y ADMIN_MANAGER', () => {
        expect(canViewPaymentMethod('OWNER')).toBe(true);
        expect(canViewPaymentMethod('ADMIN_MANAGER')).toBe(true);
    });

    it('bloquea a CASHIER, WAITER y demás roles operativos', () => {
        expect(canViewPaymentMethod('CASHIER')).toBe(false);
        expect(canViewPaymentMethod('WAITER')).toBe(false);
        expect(canViewPaymentMethod('KITCHEN_CHEF')).toBe(false);
        expect(canViewPaymentMethod('CHEF')).toBe(false);
        expect(canViewPaymentMethod('AREA_LEAD')).toBe(false);
        expect(canViewPaymentMethod('OPS_MANAGER')).toBe(false);
        expect(canViewPaymentMethod('HR_MANAGER')).toBe(false);
        expect(canViewPaymentMethod('AUDITOR')).toBe(false);
    });

    it('bloquea cuando role es null, undefined o string vacío', () => {
        expect(canViewPaymentMethod(null)).toBe(false);
        expect(canViewPaymentMethod(undefined)).toBe(false);
        expect(canViewPaymentMethod('')).toBe(false);
    });

    it('bloquea roles desconocidos', () => {
        expect(canViewPaymentMethod('SUPER_ADMIN')).toBe(false);
        expect(canViewPaymentMethod('owner')).toBe(false);
    });
});
