/**
 * Tests de injectTenantInArgs (función pura).
 *
 * No instancia Prisma — solo verifica la lógica de transformación de args.
 * La integración con el cliente real se cubre cuando se active Fase 3
 * con tests E2E.
 */

import { describe, it, expect } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/db', () => ({ default: { $extends: () => ({}) } }));
vi.mock('@prisma/client', () => ({ Prisma: {} }));

import { vi } from 'vitest';
import { injectTenantInArgs, TENANT_AWARE_MODELS } from './prisma-tenant-client';

const TID = 'tnt_shanklish_caracas';

describe('injectTenantInArgs — modelo NO multi-tenant', () => {
    it('Devuelve args sin cambios para modelos no listados', () => {
        const args = { where: { id: 'x' } };
        const out = injectTenantInArgs('NonExistentModel', 'findMany', args, TID);
        expect(out).toBe(args);
    });

    it('Devuelve args sin cambios para modelos de tablas pivote no listadas', () => {
        // RecipeIngredient cuelga de Recipe (que sí tiene tenantId), pero
        // el modelo en sí no tiene tenantId directo. La extension lo deja
        // pasar — se filtra implícitamente vía la FK al Recipe.
        const args = { where: { recipeId: 'r1' } };
        const out = injectTenantInArgs('RecipeIngredient', 'findMany', args, TID);
        expect(out).toBe(args);
    });
});

describe('injectTenantInArgs — operaciones de lectura', () => {
    it('findMany sin where: añade where con tenantId', () => {
        const out = injectTenantInArgs('MenuItem', 'findMany', {}, TID) as Record<string, unknown>;
        expect(out.where).toEqual({ tenantId: TID });
    });

    it('findMany con where existente: combina sin sobreescribir', () => {
        const out = injectTenantInArgs(
            'MenuItem',
            'findMany',
            { where: { isActive: true } },
            TID,
        ) as Record<string, unknown>;
        expect(out.where).toEqual({ isActive: true, tenantId: TID });
    });

    it('findFirst aplica igual', () => {
        const out = injectTenantInArgs('SalesOrder', 'findFirst', { where: { status: 'PAID' } }, TID) as Record<string, unknown>;
        expect(out.where).toEqual({ status: 'PAID', tenantId: TID });
    });

    it('count y aggregate también filtran', () => {
        const c = injectTenantInArgs('SalesOrder', 'count', {}, TID) as Record<string, unknown>;
        expect(c.where).toEqual({ tenantId: TID });

        const a = injectTenantInArgs('SalesOrder', 'aggregate', { _sum: { total: true } }, TID) as Record<string, unknown>;
        expect(a.where).toEqual({ tenantId: TID });
        expect(a._sum).toEqual({ total: true });
    });

    it('updateMany y deleteMany filtran via where', () => {
        const u = injectTenantInArgs('User', 'updateMany', { where: { isActive: false }, data: { role: 'X' } }, TID) as Record<string, unknown>;
        expect(u.where).toEqual({ isActive: false, tenantId: TID });
        expect(u.data).toEqual({ role: 'X' });

        const d = injectTenantInArgs('User', 'deleteMany', {}, TID) as Record<string, unknown>;
        expect(d.where).toEqual({ tenantId: TID });
    });
});

describe('injectTenantInArgs — operaciones de creación', () => {
    it('create: añade tenantId en data', () => {
        const out = injectTenantInArgs(
            'MenuItem',
            'create',
            { data: { name: 'Shawarma', price: 10 } },
            TID,
        ) as Record<string, { name: string; price: number; tenantId: string }>;
        expect(out.data).toEqual({ tenantId: TID, name: 'Shawarma', price: 10 });
    });

    it('create: si data ya tiene tenantId, NO se sobreescribe', () => {
        // Caller explícito gana — útil para scripts admin que crean en
        // tenant distinto del actual (cross-tenant operations legítimas).
        const out = injectTenantInArgs(
            'MenuItem',
            'create',
            { data: { name: 'X', tenantId: 'other-tenant' } },
            TID,
        ) as Record<string, { name: string; tenantId: string }>;
        expect(out.data.tenantId).toBe('other-tenant');
    });

    it('createMany con array: inyecta en cada item', () => {
        const out = injectTenantInArgs(
            'MenuItem',
            'createMany',
            { data: [{ name: 'A' }, { name: 'B' }] },
            TID,
        ) as Record<string, Array<{ name: string; tenantId: string }>>;
        expect(out.data).toEqual([
            { tenantId: TID, name: 'A' },
            { tenantId: TID, name: 'B' },
        ]);
    });
});

describe('injectTenantInArgs — upsert', () => {
    it('upsert: where + create reciben tenantId', () => {
        const out = injectTenantInArgs(
            'SystemConfig',
            'upsert',
            {
                where: { key: 'enabled_modules' },
                create: { key: 'enabled_modules', value: '[]' },
                update: { value: '[]' },
            },
            TID,
        ) as Record<string, Record<string, unknown>>;
        expect(out.where).toEqual({ key: 'enabled_modules', tenantId: TID });
        expect(out.create).toEqual({ tenantId: TID, key: 'enabled_modules', value: '[]' });
        // update NO recibe tenantId: el where ya filtra.
        expect(out.update).toEqual({ value: '[]' });
    });
});

describe('injectTenantInArgs — operaciones NO tocadas', () => {
    it('findUnique: NO se modifica (usa unique global, Fase 2.B lo cambiará)', () => {
        const args = { where: { email: 'x@y.com' } };
        const out = injectTenantInArgs('User', 'findUnique', args, TID);
        expect(out).toBe(args);
    });

    it('update específico: NO se modifica', () => {
        const args = { where: { id: 'u1' }, data: { role: 'X' } };
        const out = injectTenantInArgs('User', 'update', args, TID);
        expect(out).toBe(args);
    });

    it('delete específico: NO se modifica', () => {
        const args = { where: { id: 'u1' } };
        const out = injectTenantInArgs('User', 'delete', args, TID);
        expect(out).toBe(args);
    });
});

describe('TENANT_AWARE_MODELS', () => {
    it('Contiene los 51 modelos esperados (SalesOrderPayment removido en fix #188 — modelo sin tenantId en schema)', () => {
        expect(TENANT_AWARE_MODELS.length).toBe(51);
    });

    it('Incluye modelos críticos del POS', () => {
        expect(TENANT_AWARE_MODELS).toContain('User');
        expect(TENANT_AWARE_MODELS).toContain('SalesOrder');
        expect(TENANT_AWARE_MODELS).toContain('OpenTab');
        expect(TENANT_AWARE_MODELS).toContain('Waiter');
        expect(TENANT_AWARE_MODELS).toContain('Branch');
    });
});
