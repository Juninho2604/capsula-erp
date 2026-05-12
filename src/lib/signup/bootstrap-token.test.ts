import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { createBootstrapToken, verifyBootstrapToken } from './bootstrap-token';

describe('bootstrap-token', () => {
    it('round-trip: token recién creado verifica con el mismo payload', async () => {
        const token = await createBootstrapToken({
            userId: 'usr_123',
            tenantId: 'tnt_abc',
            tenantSlug: 'shanklish',
        });
        const verified = await verifyBootstrapToken(token);
        expect(verified).not.toBeNull();
        expect(verified?.userId).toBe('usr_123');
        expect(verified?.tenantId).toBe('tnt_abc');
        expect(verified?.tenantSlug).toBe('shanklish');
        expect(verified?.kind).toBe('signup-bootstrap');
    });

    it('rechaza un JWT vacío o malformado', async () => {
        expect(await verifyBootstrapToken('')).toBeNull();
        expect(await verifyBootstrapToken('not.a.jwt')).toBeNull();
    });

    it('rechaza un JWT con firma inválida (otro secret)', async () => {
        const otherKey = new TextEncoder().encode('x'.repeat(40));
        const forged = await new SignJWT({
            kind: 'signup-bootstrap',
            userId: 'usr_x',
            tenantId: 'tnt_x',
            tenantSlug: 'evil',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('60s')
            .sign(otherKey);
        expect(await verifyBootstrapToken(forged)).toBeNull();
    });

    it('rechaza un JWT firmado correctamente pero con kind incorrecto', async () => {
        // Si alguien intenta reusar un session-JWT como bootstrap, debe rechazarse
        // aunque la firma sea válida. El kind="signup-bootstrap" es el guard.
        // Usamos el mismo secret de fallback que createBootstrapToken usa cuando
        // JWT_SECRET no está seteado (o no cumple el mínimo de 32 chars).
        const sameKey = new TextEncoder().encode(
            (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32)
                ? process.env.JWT_SECRET
                : 'shanklish-super-secret-key-2024',
        );
        const wrongKind = await new SignJWT({
            kind: 'session',
            userId: 'usr_x',
            tenantId: 'tnt_x',
            tenantSlug: 'shanklish',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('60s')
            .sign(sameKey);
        expect(await verifyBootstrapToken(wrongKind)).toBeNull();
    });
});
