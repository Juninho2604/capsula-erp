import { describe, it, expect } from 'vitest';
import { computePostLoginUrl } from './post-login-redirect';

describe('computePostLoginUrl', () => {
    it('null si no hay slug', () => {
        expect(computePostLoginUrl(null, 'kpsula.app')).toBeNull();
        expect(computePostLoginUrl('', 'kpsula.app')).toBeNull();
    });

    it('null si slug es muy corto', () => {
        expect(computePostLoginUrl('a', 'kpsula.app')).toBeNull();
    });

    it('null si slug tiene chars inválidos', () => {
        expect(computePostLoginUrl('My_Tenant', 'kpsula.app')).toBeNull();
        expect(computePostLoginUrl('-bad', 'kpsula.app')).toBeNull();
        expect(computePostLoginUrl('bad@', 'kpsula.app')).toBeNull();
    });

    it('null si host no es kpsula.app ni subdomain de él', () => {
        expect(computePostLoginUrl('shanklish', 'localhost')).toBeNull();
        expect(computePostLoginUrl('shanklish', 'capsula-erp.vercel.app')).toBeNull();
        expect(computePostLoginUrl('shanklish', 'example.com')).toBeNull();
        expect(computePostLoginUrl('shanklish', '192.168.1.1')).toBeNull();
    });

    it('null si ya estamos en el subdomain correcto', () => {
        expect(computePostLoginUrl('shanklish', 'shanklish.kpsula.app')).toBeNull();
    });

    it('redirige desde root al subdomain', () => {
        expect(computePostLoginUrl('shanklish', 'kpsula.app')).toBe(
            'https://shanklish.kpsula.app/dashboard/home',
        );
    });

    it('redirige cross-subdomain si el host es otro', () => {
        // User logea con email Shanklish entrando a tablepong.kpsula.app
        // (raro pero defensivo). Debería ir a su subdomain.
        expect(computePostLoginUrl('shanklish', 'tablepong.kpsula.app')).toBe(
            'https://shanklish.kpsula.app/dashboard/home',
        );
    });

    it('acepta slugs con guiones', () => {
        expect(computePostLoginUrl('mi-restaurante', 'kpsula.app')).toBe(
            'https://mi-restaurante.kpsula.app/dashboard/home',
        );
    });

    it('host vacío → null (caso defensivo SSR)', () => {
        expect(computePostLoginUrl('shanklish', '')).toBeNull();
    });
});
