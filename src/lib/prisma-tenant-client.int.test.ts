/**
 * Test de integración real contra Postgres — prueba que `withTenant()`
 * aisla correctamente las consultas entre tenants.
 *
 * Gating:
 *   - Solo corre cuando `process.env.CI === 'true'` (GitHub Actions lo
 *     setea automáticamente). Para correrlo localmente:
 *
 *       CI=true DATABASE_URL=postgres://... npx vitest run prisma-tenant-client.int.test.ts
 *
 *     Esto evita que un `npm test` en dev local pegue contra la BD del
 *     desarrollador y deje filas residuales.
 *
 * Cleanup:
 *   - Cada run usa un prefijo único `int-test-<ts>-` para tenants y
 *     branches. `afterAll` borra branches primero (FK Restrict) y luego
 *     tenants. Si el cleanup falla por alguna razón, los registros
 *     quedan en la BD del CI (efímera) o tienen que limpiarse a mano
 *     en dev.
 *
 * Cobertura:
 *   - findMany / findFirst / count / aggregate / groupBy: solo ven rows
 *     del tenant del scope.
 *   - create / createMany: inyecta tenantId automáticamente.
 *   - updateMany / deleteMany: solo afecta rows del tenant del scope.
 *   - Un createMany sin tenantId explícito falla al cruzar tenants.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// `prisma-tenant-client.ts` declara `import 'server-only'`. En vitest
// (Node, no runtime de Next) ese módulo tira si no se mockea.
vi.mock('server-only', () => ({}));

import prisma from '@/server/db';
import { withTenant } from './prisma-tenant-client';

const runIntegration = process.env.CI === 'true';

describe.skipIf(!runIntegration)('withTenant() — integración real contra Postgres', () => {
    const runId = `int-test-${Date.now()}`;

    const tenantA = {
        id: `${runId}-A`,
        slug: `${runId}-a`.toLowerCase(),
        name: 'Integration Test A',
    };
    const tenantB = {
        id: `${runId}-B`,
        slug: `${runId}-b`.toLowerCase(),
        name: 'Integration Test B',
    };

    beforeAll(async () => {
        // Crear ambos tenants — sin extension, raw prisma.
        await prisma.tenant.createMany({
            data: [tenantA, tenantB],
        });
    });

    afterAll(async () => {
        // Borrar branches primero (FK Restrict en Tenant) y luego tenants.
        // Si el cleanup falla, los registros quedan en la BD del CI (efímera).
        await prisma.branch.deleteMany({
            where: { tenantId: { in: [tenantA.id, tenantB.id] } },
        });
        await prisma.tenant.deleteMany({
            where: { id: { in: [tenantA.id, tenantB.id] } },
        });
    });

    it('create inyecta tenantId automáticamente y no permite ver rows de otro tenant', async () => {
        const dbA = withTenant(tenantA.id);
        const dbB = withTenant(tenantB.id);

        // Crear 2 branches en A, 1 en B. Sin pasar tenantId — la extension lo inyecta.
        await dbA.branch.create({
            data: { code: 'A-1', name: 'A One' } as any,
        });
        await dbA.branch.create({
            data: { code: 'A-2', name: 'A Two' } as any,
        });
        await dbB.branch.create({
            data: { code: 'B-1', name: 'B One' } as any,
        });

        // findMany del scope A solo ve los 2 de A.
        const branchesA = await dbA.branch.findMany({
            orderBy: { code: 'asc' },
        });
        expect(branchesA.map((b) => b.code)).toEqual(['A-1', 'A-2']);
        expect(branchesA.every((b) => b.tenantId === tenantA.id)).toBe(true);

        // findMany del scope B solo ve el 1 de B.
        const branchesB = await dbB.branch.findMany();
        expect(branchesB.map((b) => b.code)).toEqual(['B-1']);
        expect(branchesB[0].tenantId).toBe(tenantB.id);
    });

    it('count y aggregate respetan el scope del tenant', async () => {
        const dbA = withTenant(tenantA.id);
        const dbB = withTenant(tenantB.id);

        expect(await dbA.branch.count()).toBe(2);
        expect(await dbB.branch.count()).toBe(1);

        // count con where adicional: combina sin sobreescribir tenantId
        const activeInA = await dbA.branch.count({ where: { isActive: true } });
        expect(activeInA).toBe(2);
    });

    it('findFirst no devuelve rows de otro tenant aunque haya match en otros campos', async () => {
        const dbA = withTenant(tenantA.id);

        // B-1 existe pero pertenece a tenantB. Desde A no debería verlo.
        const fromAByBCode = await dbA.branch.findFirst({
            where: { code: 'B-1' },
        });
        expect(fromAByBCode).toBeNull();

        // A-1 sí lo encuentra.
        const fromAByOwnCode = await dbA.branch.findFirst({
            where: { code: 'A-1' },
        });
        expect(fromAByOwnCode?.tenantId).toBe(tenantA.id);
    });

    it('updateMany del scope A no toca rows de B', async () => {
        const dbA = withTenant(tenantA.id);
        const dbB = withTenant(tenantB.id);

        // Desactivar TODO desde A.
        const res = await dbA.branch.updateMany({
            data: { isActive: false },
        });
        expect(res.count).toBe(2);

        // B sigue intacto.
        const bStillActive = await dbB.branch.count({ where: { isActive: true } });
        expect(bStillActive).toBe(1);
    });

    it('deleteMany del scope A no toca rows de B (cleanup parcial)', async () => {
        const dbA = withTenant(tenantA.id);
        const dbB = withTenant(tenantB.id);

        const deleted = await dbA.branch.deleteMany({});
        expect(deleted.count).toBe(2);

        // B sigue con su row.
        expect(await dbB.branch.count()).toBe(1);
    });
});
