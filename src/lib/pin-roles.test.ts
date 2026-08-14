import { describe, it, expect } from 'vitest';
import {
    CHARGE_AUTH_ROLES,
    VOID_AUTH_USER_ROLES,
    canAuthorizeCharges,
    canAuthorizeVoids,
    pinRoleWarning,
} from './pin-roles';

describe('roles que autorizan con PIN (§153)', () => {
    it('cobros: dueño y gerencia, nadie más', () => {
        for (const r of ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER']) {
            expect(canAuthorizeCharges(r)).toBe(true);
        }
        for (const r of ['AREA_LEAD', 'CHEF', 'CASHIER', 'WAITER', 'KITCHEN_CHEF', 'AUDITOR', 'STAFF']) {
            expect(canAuthorizeCharges(r)).toBe(false);
        }
    });

    it('anulaciones: los de cobro más Jefe de Área', () => {
        expect(canAuthorizeVoids('AREA_LEAD')).toBe(true);
        for (const r of CHARGE_AUTH_ROLES) expect(canAuthorizeVoids(r)).toBe(true);
        expect(canAuthorizeVoids('WAITER')).toBe(false);
        expect(canAuthorizeVoids('CASHIER')).toBe(false);
    });

    it('todo el que cobra puede anular — sin callejones sin salida', () => {
        for (const r of CHARGE_AUTH_ROLES) {
            expect(VOID_AUTH_USER_ROLES).toContain(r);
        }
    });

    it('rol vacío o desconocido no autoriza nada', () => {
        for (const r of [null, undefined, '', 'INVENTADO']) {
            expect(canAuthorizeCharges(r)).toBe(false);
            expect(canAuthorizeVoids(r)).toBe(false);
        }
    });
});

describe('pinRoleWarning — el aviso al asignar (§153)', () => {
    it('rol de gerencia: sin aviso, el PIN sirve para todo', () => {
        for (const r of CHARGE_AUTH_ROLES) {
            expect(pinRoleWarning(r)).toBeNull();
        }
    });

    it('Jefe de Área: avisa que anula pero no cobra', () => {
        const w = pinRoleWarning('AREA_LEAD');
        expect(w).toContain('ANULACIONES');
        expect(w).toContain('NO cobros');
    });

    it('un rol que no autoriza nada lo dice sin rodeos — el caso TablePong', () => {
        // Ender quedó con rol WAITER y un PIN recién asignado que el POS
        // nunca iba a cargar como candidato. La pantalla decía
        // "PIN actualizado correctamente" y el PIN nacía muerto.
        const w = pinRoleWarning('WAITER');
        expect(w).toContain('WAITER');
        expect(w).toContain('NO autoriza');
        expect(w).toContain('Configuración → Roles');
    });

    it('sin rol también avisa, no revienta', () => {
        expect(pinRoleWarning(null)).toContain('NO autoriza');
        expect(pinRoleWarning(undefined)).toContain('NO autoriza');
    });
});
