import { describe, it, expect } from 'vitest';
import { extractTenantSlugFromHost } from './tenant-context';

describe('extractTenantSlugFromHost', () => {
    it('Devuelve null si no hay host', () => {
        expect(extractTenantSlugFromHost(null)).toBeNull();
        expect(extractTenantSlugFromHost(undefined)).toBeNull();
        expect(extractTenantSlugFromHost('')).toBeNull();
    });

    it('Devuelve el subdomain en hosts válidos', () => {
        expect(extractTenantSlugFromHost('shanklish.kpsula.app')).toBe('shanklish');
        expect(extractTenantSlugFromHost('acme.kpsula.app')).toBe('acme');
    });

    it('Devuelve null en root domains', () => {
        expect(extractTenantSlugFromHost('kpsula.app')).toBeNull();
        expect(extractTenantSlugFromHost('localhost')).toBeNull();
        expect(extractTenantSlugFromHost('localhost:3000')).toBeNull();
    });

    it('Ignora "www" como subdomain', () => {
        expect(extractTenantSlugFromHost('www.kpsula.app')).toBeNull();
    });

    it('Es case-insensitive', () => {
        expect(extractTenantSlugFromHost('SHANKLISH.kpsula.app')).toBe('shanklish');
    });

    it('Ignora puerto', () => {
        expect(extractTenantSlugFromHost('shanklish.kpsula.app:443')).toBe('shanklish');
    });

    it('Rechaza slugs con caracteres inválidos', () => {
        expect(extractTenantSlugFromHost('-bad.kpsula.app')).toBeNull();
        expect(extractTenantSlugFromHost('bad@.kpsula.app')).toBeNull();
        expect(extractTenantSlugFromHost('mucho_underscore.kpsula.app')).toBeNull();
    });

    it('Acepta slugs con guiones internos', () => {
        expect(extractTenantSlugFromHost('mi-restaurante.kpsula.app')).toBe('mi-restaurante');
    });

    it('Vercel preview domains: no extrae como tenant', () => {
        // Los previews de Vercel son tipo my-project-xxx.vercel.app — la app
        // root es vercel.app así que cualquier subdomain ahí NO es un tenant.
        expect(extractTenantSlugFromHost('vercel.app')).toBeNull();
        expect(extractTenantSlugFromHost('capsula-erp.vercel.app')).toBeNull();
        expect(extractTenantSlugFromHost('capsula-erp-git-main.vercel.app')).toBeNull();
        expect(extractTenantSlugFromHost('xxx-yyy-zzz.vercel.app')).toBeNull();
    });

    it('Dominios ajenos: nunca extrae tenant', () => {
        expect(extractTenantSlugFromHost('example.com')).toBeNull();
        expect(extractTenantSlugFromHost('shanklish.example.com')).toBeNull();
        expect(extractTenantSlugFromHost('attacker.evil.com')).toBeNull();
    });

    it('IP raw: null', () => {
        expect(extractTenantSlugFromHost('192.168.1.1')).toBeNull();
        expect(extractTenantSlugFromHost('192.168.1.1:3000')).toBeNull();
    });

    it('Multi-nivel kpsula.app: toma primera label', () => {
        // Útil para staging.kpsula.app → no es tenant, pero
        // shanklish.staging.kpsula.app → tenant "shanklish" en sub-env.
        expect(extractTenantSlugFromHost('staging.kpsula.app')).toBe('staging');
        expect(extractTenantSlugFromHost('shanklish.staging.kpsula.app')).toBe('shanklish');
    });
});
