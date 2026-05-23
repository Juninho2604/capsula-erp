/**
 * Tests de aislamiento multi-tenant del cron retry de outbox.
 *
 * No instancia Prisma — verifica la lógica de decisión sobre qué tenant
 * usar y cuándo skipear. La función `retryInventoryDeductionFromOutbox`
 * tiene 3 paths críticos para multi-tenant:
 *
 *   1. source='cron' + retry con salesOrder válido → procesa con tenantId
 *      del salesOrder (no del contexto del request).
 *   2. source='authenticated' + ctx coincide con retry → procesa.
 *   3. source='authenticated' + ctx NO coincide → SKIPPED + back to PENDING.
 *
 * Estos tests cubren el contrato de los stubs de Prisma que la función usa,
 * para garantizar que el refactor del bug (PR pre-flight onboarding) no se
 * regrese silenciosamente.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks deben venir ANTES de los imports del módulo bajo test.
vi.mock('server-only', () => ({}));

// vi.hoisted: las variables se hoistean junto con los vi.mock para que
// estén disponibles cuando los factories ejecutan al cargar el módulo.
const m = vi.hoisted(() => ({
    updateManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateMock: vi.fn(),
    createMock: vi.fn(),
    resolveTenantContextMock: vi.fn(),
}));

vi.mock('@/server/db', () => {
    const stub = {
        inventoryDeductionRetry: {
            updateMany: m.updateManyMock,
            findUnique: m.findUniqueMock,
            update: m.updateMock,
            create: m.createMock,
        },
    };
    return { default: stub, prisma: stub };
});

vi.mock('@/lib/tenant-context.server', () => ({
    resolveTenantContext: m.resolveTenantContextMock,
}));

vi.mock('@/lib/prisma-tenant-client', () => ({
    withTenant: () => ({
        $transaction: vi.fn(),
        menuItem: { findUnique: vi.fn() },
        menuModifier: { findUnique: vi.fn() },
        recipe: { findUnique: vi.fn() },
    }),
}));

vi.mock('@/lib/auth', () => ({ getSession: vi.fn(), updateSessionCashier: vi.fn() }));
vi.mock('@/server/services/inventory.service', () => ({ registerSale: vi.fn() }));
vi.mock('@/lib/datetime', () => ({ getCaracasDateStamp: vi.fn(), getCaracasDayRange: vi.fn() }));
vi.mock('@/lib/invoice-counter', () => ({ getNextCorrelativo: vi.fn() }));
vi.mock('@/app/actions/system-config.actions', () => ({ getStockValidationEnabled: vi.fn() }));
vi.mock('@/app/actions/purchase.actions', () => ({ createReorderBroadcastsAction: vi.fn() }));
vi.mock('@/app/actions/user.actions', () => ({ pbkdf2Hex: vi.fn(), hashPin: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn(), getClientIp: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { retryInventoryDeductionFromOutbox } from './pos.actions';

const TENANT_A = 'tnt_a';
const TENANT_B = 'tnt_b';

describe('retryInventoryDeductionFromOutbox — aislamiento multi-tenant', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.updateManyMock.mockResolvedValue({ count: 1 });
        m.updateMock.mockResolvedValue({});
    });

    it('source=cron: marca FAILED si retry no tiene salesOrder (huérfano)', async () => {
        m.findUniqueMock.mockResolvedValue({
            id: 'r1', salesOrderId: null, payload: '{}',
            attempts: 1, maxAttempts: 5, salesOrder: null,
        });

        const result = await retryInventoryDeductionFromOutbox('r1', { source: 'cron' });

        expect(result.status).toBe('FAILED');
        expect(result.error).toMatch(/orphan/i);
        // No llamamos resolveTenantContext en path cron.
        expect(m.resolveTenantContextMock).not.toHaveBeenCalled();
    });

    it('source=cron: NO llama resolveTenantContext incluso con salesOrder válido', async () => {
        m.findUniqueMock.mockResolvedValue({
            id: 'r2', salesOrderId: 'so1', payload: 'invalid-json',
            attempts: 1, maxAttempts: 5,
            salesOrder: { tenantId: TENANT_B, status: 'PAID' },
        });

        await retryInventoryDeductionFromOutbox('r2', { source: 'cron' });

        // Path cron NUNCA llama resolveTenantContext: el tenant viene del
        // salesOrder del retry, no del contexto del request.
        expect(m.resolveTenantContextMock).not.toHaveBeenCalled();
    });

    it('source=authenticated: valida que ctx coincide con tenant del retry', async () => {
        // El retry pertenece a tenant B, pero el contexto es tenant A.
        m.findUniqueMock.mockResolvedValue({
            id: 'r3', salesOrderId: 'so1', payload: '{}',
            attempts: 1, maxAttempts: 5,
            salesOrder: { tenantId: TENANT_B, status: 'PAID' },
        });
        m.resolveTenantContextMock.mockResolvedValue({ tenantId: TENANT_A });

        const result = await retryInventoryDeductionFromOutbox('r3', { source: 'authenticated' });

        expect(result.status).toBe('SKIPPED');
        // Debe devolver el retry a PENDING para que el cron lo tome después.
        expect(m.updateMock).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'r3' },
            data: { status: 'PENDING' },
        }));
    });

    it('source=authenticated (default): mismo ctx procede normalmente', async () => {
        m.findUniqueMock.mockResolvedValue({
            id: 'r4', salesOrderId: 'so1', payload: 'invalid-json',
            attempts: 1, maxAttempts: 5,
            salesOrder: { tenantId: TENANT_A, status: 'PAID' },
        });
        m.resolveTenantContextMock.mockResolvedValue({ tenantId: TENANT_A });

        const result = await retryInventoryDeductionFromOutbox('r4');

        // Procede más allá del cross-tenant guard. Falla por payload inválido
        // pero el FAILED viene del parse JSON, no del guard. Lo importante:
        // que NO devuelva SKIPPED (eso indicaría guard rejection).
        expect(result.status).toBe('FAILED');
        // Y que resolveTenantContext SÍ se haya llamado (path autenticado).
        expect(m.resolveTenantContextMock).toHaveBeenCalled();
    });

    it('claim retorna count=0 → SKIPPED sin tocar otros estados', async () => {
        m.updateManyMock.mockResolvedValue({ count: 0 });

        const result = await retryInventoryDeductionFromOutbox('r5', { source: 'cron' });

        expect(result.status).toBe('SKIPPED');
        expect(m.findUniqueMock).not.toHaveBeenCalled();
    });
});
