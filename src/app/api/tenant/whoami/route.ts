/**
 * GET /api/tenant/whoami
 *
 * Paso D.a del multi-tenant — primer consumidor real de
 * `resolveTenantContext()`. Devuelve el tenant resuelto para este request,
 * indicando de dónde se resolvió:
 *
 *   - 'subdomain' → el host era `<slug>.kpsula.app` y el slug existe en BD.
 *   - 'session'   → no había subdomain válido pero el JWT lleva tenantId.
 *   - 'fallback'  → ninguno de los anteriores; cae a Shanklish.
 *
 * Útil para:
 *   1. Verificar en producción que el middleware passive (Paso C) está
 *      pasando el host correctamente al resolver server-side.
 *   2. Diagnosticar problemas de routing por tenant cuando empecemos a
 *      onboardar nuevos tenants.
 *   3. Servir como referencia para futuras migraciones de actions a
 *      `defineAction()` (Paso D.b).
 *
 * Requiere sesión activa — no filtra info sensible pero evita exponer
 * detalles del modelo de tenants a internet abierto.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveTenantContext();

    return NextResponse.json({
        tenantId: ctx.tenantId,
        slug: ctx.slug,
        source: ctx.source,
        sessionTenantId: (session as { tenantId?: string }).tenantId ?? null,
    });
}
