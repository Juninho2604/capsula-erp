import { describe, it, expect } from 'vitest';
import {
    assertCanModifyOwner,
    assertNotSelfRoleChange,
    assertNotSelfDeactivate,
} from './owner-invariants';

// Tests puros (sin BD). Los invariantes que requieren countActiveOwners
// (assertNotLastOwnerDegrade, assertNotLastOwnerDeactivate) se cubren
// en tests de integración separados que sí montan Prisma.

const owner = (id: string) => ({ actorId: id, actorRole: 'OWNER' });
const admin = (id: string) => ({ actorId: id, actorRole: 'ADMIN_MANAGER' });
const cashier = (id: string) => ({ actorId: id, actorRole: 'CASHIER' });
const target = (id: string, role: string) => ({ targetId: id, targetRole: role });

describe('assertCanModifyOwner', () => {
    it('OWNER puede modificar a otro OWNER', () => {
        const r = assertCanModifyOwner(owner('u1'), target('u2', 'OWNER'));
        expect(r.ok).toBe(true);
    });

    it('ADMIN_MANAGER NO puede modificar a un OWNER', () => {
        const r = assertCanModifyOwner(admin('u1'), target('u2', 'OWNER'));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toMatch(/OWNER/);
    });

    it('CASHIER NO puede modificar a un OWNER', () => {
        const r = assertCanModifyOwner(cashier('u1'), target('u2', 'OWNER'));
        expect(r.ok).toBe(false);
    });

    it('ADMIN_MANAGER puede modificar a un CASHIER', () => {
        const r = assertCanModifyOwner(admin('u1'), target('u2', 'CASHIER'));
        expect(r.ok).toBe(true);
    });

    it('OWNER puede modificar a un CASHIER', () => {
        const r = assertCanModifyOwner(owner('u1'), target('u2', 'CASHIER'));
        expect(r.ok).toBe(true);
    });
});

describe('assertNotSelfRoleChange', () => {
    it('Bloquea cambio de rol sobre sí mismo (OWNER)', () => {
        const r = assertNotSelfRoleChange(owner('u1'), target('u1', 'OWNER'));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toMatch(/propio rol/i);
    });

    it('Bloquea cambio de rol sobre sí mismo (ADMIN_MANAGER)', () => {
        const r = assertNotSelfRoleChange(admin('u1'), target('u1', 'ADMIN_MANAGER'));
        expect(r.ok).toBe(false);
    });

    it('Permite cambiar el rol de otro usuario', () => {
        const r = assertNotSelfRoleChange(owner('u1'), target('u2', 'CASHIER'));
        expect(r.ok).toBe(true);
    });
});

describe('assertNotSelfDeactivate', () => {
    it('Bloquea desactivación propia', () => {
        const r = assertNotSelfDeactivate(owner('u1'), target('u1', 'OWNER'), false);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toMatch(/desactivar/i);
    });

    it('Permite reactivación propia (caso teórico, no debería pasar pero no es invariante crítico)', () => {
        // Si el actor está desactivado no puede llegar acá (action-guard lo corta antes),
        // pero la regla debe ser estricta: solo bloqueamos el camino inseguro.
        const r = assertNotSelfDeactivate(owner('u1'), target('u1', 'OWNER'), true);
        expect(r.ok).toBe(true);
    });

    it('Permite desactivar a otro usuario', () => {
        const r = assertNotSelfDeactivate(owner('u1'), target('u2', 'CASHIER'), false);
        expect(r.ok).toBe(true);
    });
});
