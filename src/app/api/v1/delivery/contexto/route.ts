/**
 * GET /api/v1/delivery/contexto
 *
 * Lo llama n8n al inicio de cada conversación e inyecta el resultado en el
 * prompt del bot. Reemplaza las variables manuales {AGOTADOS_HOY},
 * {TASA_BS_DIA}, {NOTAS_GERENTE}.
 *
 * Auth: X-API-Key (por tenant). Requiere feature flag `deliveryOps`.
 *
 * Fase 1: devuelve `sedes` (con zonas + coords) y `tasa_bs`. `agotados`,
 * `notas_gerente` y `reglas_ruteo` salen vacíos hasta Fase 4/4.5.
 */

import { NextResponse } from 'next/server';
import { authenticateDeliveryApi } from '@/lib/delivery/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { withTenant } from '@/lib/prisma-tenant-client';
import { buildDeliveryContext, type ContextSede } from '@/lib/delivery/context';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const auth = authenticateDeliveryApi(req);
    if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await tenantFeatureEnabled(auth.tenantId, 'deliveryOps'))) {
        return NextResponse.json({ error: 'delivery_ops disabled' }, { status: 403 });
    }

    const db = withTenant(auth.tenantId);
    const now = new Date();

    const [configs, zones, rate, agotados, notas, reglas] = await Promise.all([
        db.branchDeliveryConfig.findMany({
            where: { isActive: true },
            include: { branch: { select: { id: true, name: true, isActive: true } } },
        }),
        db.deliveryZone.findMany({ where: { isActive: true } }),
        db.exchangeRate.findFirst({ orderBy: { effectiveDate: 'desc' } }),
        // Agotados = ítems marcados NO disponibles por sede.
        db.itemAvailability.findMany({ where: { available: false } }),
        // Notas activas y no vencidas.
        db.managerNote.findMany({
            where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            orderBy: { createdAt: 'desc' },
        }),
        db.routingRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
    ]);

    const zonesByBranch = new Map<string, string[]>();
    for (const z of zones) {
        const list = zonesByBranch.get(z.branchId) ?? [];
        list.push(z.name);
        zonesByBranch.set(z.branchId, list);
    }

    const sedes: ContextSede[] = configs
        .filter(c => c.branch?.isActive)
        .map(c => ({
            id: c.branch!.id,
            nombre: c.branch!.name,
            zonas: zonesByBranch.get(c.branchId) ?? [],
            lat: c.lat ?? null,
            lon: c.lon ?? null,
        }));

    const context = buildDeliveryContext({
        sedes,
        tasaBs: rate?.rate ?? null,
        agotados: agotados.map(a => ({ sede_id: a.branchId, item: a.itemLabel })),
        notas: notas.map(n => ({
            sede_id: n.branchId,
            texto: n.text,
            vigencia: n.expiresAt ? n.expiresAt.toISOString().slice(0, 10) : null,
        })),
        reglasRuteo: reglas.map(r => ({
            si_incluye_producto: r.matchProduct,
            enviar_a_sede_id: r.branchId,
        })),
    });

    return NextResponse.json(context);
}
