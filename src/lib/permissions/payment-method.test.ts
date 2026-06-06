import { describe, it, expect } from 'vitest';
import { canViewPaymentMethod, shouldHidePaymentMethod } from './payment-method';

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

describe('shouldHidePaymentMethod — política de ocultamiento', () => {
    it('OWNER / ADMIN_MANAGER: nunca se oculta (aunque flag on / sin export)', () => {
        expect(shouldHidePaymentMethod({ role: 'OWNER', canExport: false, flagOn: true })).toBe(false);
        expect(shouldHidePaymentMethod({ role: 'ADMIN_MANAGER', canExport: false, flagOn: true })).toBe(false);
    });

    it('cajera (solo lectura, sin EXPORT_SALES): SIEMPRE oculto, con o sin flag', () => {
        expect(shouldHidePaymentMethod({ role: 'CASHIER', canExport: false, flagOn: false })).toBe(true);
        expect(shouldHidePaymentMethod({ role: 'CASHIER', canExport: false, flagOn: true })).toBe(true);
        expect(shouldHidePaymentMethod({ role: 'WAITER', canExport: false, flagOn: false })).toBe(true);
    });

    it('rol de gestión que exporta (OPS_MANAGER/AUDITOR): según el flag', () => {
        expect(shouldHidePaymentMethod({ role: 'OPS_MANAGER', canExport: true, flagOn: false })).toBe(false);
        expect(shouldHidePaymentMethod({ role: 'OPS_MANAGER', canExport: true, flagOn: true })).toBe(true);
        expect(shouldHidePaymentMethod({ role: 'AUDITOR', canExport: true, flagOn: false })).toBe(false);
        expect(shouldHidePaymentMethod({ role: 'AUDITOR', canExport: true, flagOn: true })).toBe(true);
    });

    it('rol sin permiso ni export, sin flag: oculto (no expone método)', () => {
        expect(shouldHidePaymentMethod({ role: 'CHEF', canExport: false, flagOn: false })).toBe(true);
        expect(shouldHidePaymentMethod({ role: undefined, canExport: false, flagOn: false })).toBe(true);
    });
});
