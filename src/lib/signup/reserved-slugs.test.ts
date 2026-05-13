import { describe, it, expect } from 'vitest';
import { isReservedSlug, RESERVED_TENANT_SLUGS } from './reserved-slugs';

describe('isReservedSlug', () => {
    it('rechaza subdominios técnicos', () => {
        expect(isReservedSlug('www')).toBe(true);
        expect(isReservedSlug('api')).toBe(true);
        expect(isReservedSlug('mail')).toBe(true);
    });

    it('rechaza rutas de la app', () => {
        expect(isReservedSlug('admin')).toBe(true);
        expect(isReservedSlug('dashboard')).toBe(true);
        expect(isReservedSlug('login')).toBe(true);
        expect(isReservedSlug('signup')).toBe(true);
    });

    it('rechaza nombres de la marca', () => {
        expect(isReservedSlug('kpsula')).toBe(true);
        expect(isReservedSlug('capsula')).toBe(true);
        expect(isReservedSlug('shanklish')).toBe(true);
    });

    it('rechaza staging/dev/test', () => {
        expect(isReservedSlug('staging')).toBe(true);
        expect(isReservedSlug('dev')).toBe(true);
        expect(isReservedSlug('test')).toBe(true);
        expect(isReservedSlug('demo')).toBe(true);
    });

    it('es case-insensitive', () => {
        expect(isReservedSlug('WWW')).toBe(true);
        expect(isReservedSlug('Admin')).toBe(true);
        expect(isReservedSlug('KpSuLa')).toBe(true);
    });

    it('acepta slugs no reservados', () => {
        expect(isReservedSlug('mitiendaa')).toBe(false);
        expect(isReservedSlug('restaurant1')).toBe(false);
        expect(isReservedSlug('cafe-norte')).toBe(false);
        expect(isReservedSlug('panaderia')).toBe(false);
    });

    it('tiene un conjunto razonable de reservados', () => {
        expect(RESERVED_TENANT_SLUGS.size).toBeGreaterThan(40);
        expect(RESERVED_TENANT_SLUGS.size).toBeLessThan(200);
    });
});
