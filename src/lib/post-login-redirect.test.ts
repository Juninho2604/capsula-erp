import { describe, it, expect } from 'vitest';
import { computePostLoginUrl } from './post-login-redirect';

describe('computePostLoginUrl', () => {
    describe('redirects al subdomain del tenant', () => {
        it('desde el root kpsula.app → manda al subdomain del slug', () => {
            expect(computePostLoginUrl('shanklish', 'kpsula.app'))
                .toBe('https://shanklish.kpsula.app/dashboard/home');
        });

        it('desde otro subdomain → manda al subdomain del slug', () => {
            // Cajera de Shanklish que abrió por error tablepong.kpsula.app
            expect(computePostLoginUrl('shanklish', 'tablepong.kpsula.app'))
                .toBe('https://shanklish.kpsula.app/dashboard/home');
        });

        it('acepta slugs nuevos con guiones y dígitos', () => {
            expect(computePostLoginUrl('mi-restaurante-2', 'kpsula.app'))
                .toBe('https://mi-restaurante-2.kpsula.app/dashboard/home');
        });
    });

    describe('NO redirige (devuelve null)', () => {
        it('cuando ya estamos en el subdomain correcto', () => {
            expect(computePostLoginUrl('shanklish', 'shanklish.kpsula.app')).toBeNull();
        });

        it('cuando no hay slug', () => {
            expect(computePostLoginUrl(null, 'kpsula.app')).toBeNull();
            expect(computePostLoginUrl('', 'kpsula.app')).toBeNull();
        });

        it('cuando el slug es inválido (caracteres prohibidos)', () => {
            expect(computePostLoginUrl('Foo Bar', 'kpsula.app')).toBeNull();
            expect(computePostLoginUrl('foo.bar', 'kpsula.app')).toBeNull();
            expect(computePostLoginUrl('-leading-hyphen', 'kpsula.app')).toBeNull();
        });

        it('cuando el slug es demasiado corto', () => {
            expect(computePostLoginUrl('a', 'kpsula.app')).toBeNull();
        });

        it('en hosts no-kpsula (localhost / IP / vercel preview)', () => {
            expect(computePostLoginUrl('shanklish', 'localhost')).toBeNull();
            expect(computePostLoginUrl('shanklish', '127.0.0.1')).toBeNull();
            expect(computePostLoginUrl('shanklish', 'capsula-erp.vercel.app')).toBeNull();
        });

        it('cuando no se puede determinar host', () => {
            expect(computePostLoginUrl('shanklish', '')).toBeNull();
        });
    });
});
