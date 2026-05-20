import { describe, it, expect } from 'vitest';
import { computePostLoginUrl } from './post-login-redirect';

/**
 * Mientras el redirect al subdomain esté DESHABILITADO (ver
 * post-login-redirect.ts), la función siempre devuelve null.
 * El test verifica esa garantía — si alguien re-habilita la lógica
 * por error, estos tests fallan y avisan.
 */
describe('computePostLoginUrl (disabled)', () => {
    it('siempre devuelve null — el redirect al subdomain está deshabilitado', () => {
        expect(computePostLoginUrl('shanklish', 'kpsula.app')).toBeNull();
        expect(computePostLoginUrl('shanklish', 'tablepong.kpsula.app')).toBeNull();
        expect(computePostLoginUrl('mi-restaurante', 'kpsula.app')).toBeNull();
        // Y los casos que antes devolvían null siguen igual
        expect(computePostLoginUrl(null, 'kpsula.app')).toBeNull();
        expect(computePostLoginUrl('', 'kpsula.app')).toBeNull();
        expect(computePostLoginUrl('shanklish', 'shanklish.kpsula.app')).toBeNull();
        expect(computePostLoginUrl('shanklish', 'localhost')).toBeNull();
    });
});
