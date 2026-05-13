import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isSuperAdmin, __resetSuperAdminCache } from './super-admin';

describe('isSuperAdmin', () => {
    const original = process.env.SUPER_ADMIN_EMAILS;

    beforeEach(() => {
        __resetSuperAdminCache();
    });

    afterEach(() => {
        process.env.SUPER_ADMIN_EMAILS = original;
        __resetSuperAdminCache();
    });

    it('devuelve false si la env var no está seteada', () => {
        delete process.env.SUPER_ADMIN_EMAILS;
        expect(isSuperAdmin('foo@bar.com')).toBe(false);
    });

    it('devuelve false si la env var está vacía', () => {
        process.env.SUPER_ADMIN_EMAILS = '';
        expect(isSuperAdmin('foo@bar.com')).toBe(false);
    });

    it('devuelve true para un email exacto', () => {
        process.env.SUPER_ADMIN_EMAILS = 'admin@kpsula.app';
        expect(isSuperAdmin('admin@kpsula.app')).toBe(true);
    });

    it('es case-insensitive', () => {
        process.env.SUPER_ADMIN_EMAILS = 'admin@kpsula.app';
        expect(isSuperAdmin('ADMIN@KPSULA.app')).toBe(true);
        expect(isSuperAdmin('Admin@Kpsula.App')).toBe(true);
    });

    it('soporta lista separada por coma con espacios', () => {
        process.env.SUPER_ADMIN_EMAILS = 'a@x.com, b@x.com ,c@x.com';
        expect(isSuperAdmin('a@x.com')).toBe(true);
        expect(isSuperAdmin('b@x.com')).toBe(true);
        expect(isSuperAdmin('c@x.com')).toBe(true);
        expect(isSuperAdmin('d@x.com')).toBe(false);
    });

    it('email null/undefined/empty → false', () => {
        process.env.SUPER_ADMIN_EMAILS = 'admin@x.com';
        expect(isSuperAdmin(null)).toBe(false);
        expect(isSuperAdmin(undefined)).toBe(false);
        expect(isSuperAdmin('')).toBe(false);
    });
});
