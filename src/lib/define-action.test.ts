/**
 * Tests del wrapper defineAction.
 *
 * Mockear next/headers + getSession + Prisma para evitar tocar BD real.
 * Cubrimos los caminos clave: sin sesión, con permiso ok, con permiso
 * denegado, error en handler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Map<string, string>()),
    cookies: vi.fn(async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined })),
}));

const mockGetSession = vi.fn();
vi.mock('@/lib/auth', () => ({
    getSession: () => mockGetSession(),
}));

const mockPrismaUserFindUnique = vi.fn();
const mockPrismaTenantFindUnique = vi.fn();
vi.mock('@/server/db', () => ({
    default: {
        user: { findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args) },
        tenant: { findUnique: (...args: unknown[]) => mockPrismaTenantFindUnique(...args) },
    },
    prisma: {
        user: { findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args) },
        tenant: { findUnique: (...args: unknown[]) => mockPrismaTenantFindUnique(...args) },
    },
}));

// Imports estáticos: vi.mock se hoistea, así que esto funciona.
import { defineAction } from './define-action';
import { PERM } from '@/lib/constants/permissions-registry';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setSession(session: Record<string, unknown> | null) {
    mockGetSession.mockResolvedValue(session);
}

function setDbUser(user: Record<string, unknown> | null) {
    mockPrismaUserFindUnique.mockResolvedValue(user);
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: sin sesión, sin tenant resoluble (caerá a fallback).
    setSession(null);
    setDbUser(null);
    mockPrismaTenantFindUnique.mockResolvedValue(null);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('defineAction', () => {
    it('Sin permiso requerido: invoca handler con tenant fallback (Shanklish)', async () => {
        const action = defineAction({
            handler: async ({ tenant }) => ({ success: true, data: tenant }),
        });

        const result = await action(undefined);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toMatchObject({
                tenantId: 'tnt_shanklish_caracas',
                slug: 'shanklish',
                source: 'fallback',
            });
        }
    });

    it('Con permiso requerido pero sin sesión: retorna no autorizado', async () => {
        const action = defineAction({
            permission: PERM.MANAGE_USERS,
            handler: async () => ({ success: true }),
        });
        setSession(null);

        const result = await action(undefined);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.message).toMatch(/autorizado/i);
    });

    it('Con sesión válida + permiso ok: invoca handler con user', async () => {
        setSession({ id: 'u1' });
        setDbUser({
            id: 'u1',
            email: 'owner@x.com',
            role: 'OWNER',
            allowedModules: null,
            isActive: true,
            tokenVersion: 0,
        });

        const action = defineAction({
            permission: PERM.MANAGE_USERS,
            handler: async ({ user }) => ({ success: true, data: { id: user.id, role: user.role } }),
        });

        const result = await action(undefined);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual({ id: 'u1', role: 'OWNER' });
        }
    });

    it('Con sesión pero sin permiso suficiente: retorna sin permiso', async () => {
        setSession({ id: 'u1' });
        setDbUser({
            id: 'u1',
            email: 'cashier@x.com',
            role: 'CASHIER',
            allowedModules: null,
            isActive: true,
            tokenVersion: 0,
        });

        const action = defineAction({
            permission: PERM.MANAGE_USERS,
            handler: async () => ({ success: true }),
        });

        const result = await action(undefined);
        expect(result.success).toBe(false);
    });

    it('User inactivo: retorna usuario no válido aunque sesión exista', async () => {
        setSession({ id: 'u1' });
        setDbUser({
            id: 'u1',
            email: 'x@x.com',
            role: 'OWNER',
            allowedModules: null,
            isActive: false,
            tokenVersion: 0,
        });

        const action = defineAction({
            permission: PERM.MANAGE_USERS,
            handler: async () => ({ success: true }),
        });

        const result = await action(undefined);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.message).toMatch(/no v[áa]lido/i);
    });

    it('Excepción no controlada en handler: captura y retorna error genérico', async () => {
        setSession({ id: 'u1' });
        setDbUser({
            id: 'u1',
            email: 'owner@x.com',
            role: 'OWNER',
            allowedModules: null,
            isActive: true,
            tokenVersion: 0,
        });

        const action = defineAction({
            permission: PERM.MANAGE_USERS,
            name: 'failingAction',
            handler: async () => {
                throw new Error('boom');
            },
        });

        // Suprime el console.error esperado para no contaminar el output.
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await action(undefined);
        errSpy.mockRestore();

        expect(result.success).toBe(false);
        if (!result.success) expect(result.message).toMatch(/error/i);
    });

    it('Pasa argumentos del caller al handler', async () => {
        setSession({ id: 'u1' });
        setDbUser({
            id: 'u1',
            email: 'owner@x.com',
            role: 'OWNER',
            allowedModules: null,
            isActive: true,
            tokenVersion: 0,
        });

        const action = defineAction<{ x: number }, number>({
            permission: PERM.MANAGE_USERS,
            handler: async (_ctx, { x }) => ({ success: true, data: x * 2 }),
        });

        const result = await action({ x: 21 });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(42);
    });
});
