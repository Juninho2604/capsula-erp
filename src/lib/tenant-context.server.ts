/**
 * Tenant context resolver — server-side.
 *
 * Resuelve QUÉ tenant debe operar en el request actual:
 *   1. Subdomain en el host (caso normal en producción).
 *   2. JWT session si no hay subdomain pero el user está logueado.
 *   3. Fallback (Shanklish) durante la transición a multi-tenant pleno.
 *
 * IMPORTANTE: este módulo NO se importa todavía en ningún server action.
 * Es código "dormante" — se activará cuando arranquemos Fase 3 plena.
 */

import 'server-only';
import { headers } from 'next/headers';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import {
    extractTenantSlugFromHost,
    FALLBACK_TENANT_SLUG,
    FALLBACK_TENANT_ID,
    type TenantContext,
} from './tenant-context';

export type { TenantContext };
export { FALLBACK_TENANT_SLUG, FALLBACK_TENANT_ID };

/**
 * Resuelve el tenant del request actual. Llamar desde server actions /
 * server components / API routes. NO usar en client components ni en
 * middleware (middleware corre en Edge sin acceso a Prisma).
 *
 * Devuelve siempre un TenantContext válido — nunca null. Si nada resuelve,
 * cae al fallback de Shanklish.
 */
export async function resolveTenantContext(): Promise<TenantContext> {
    // 1. Subdomain del host
    const h = await headers();
    const host = h.get('host');
    const slug = extractTenantSlugFromHost(host);
    if (slug) {
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: { id: true, slug: true },
        });
        if (tenant) {
            return { tenantId: tenant.id, slug: tenant.slug, source: 'subdomain' };
        }
        // Slug en host pero no en BD: caemos al fallback. En Fase 3 plena
        // esto pasa a ser 404 (host de tenant inexistente).
    }

    // 2. JWT session
    const session = await getSession();
    if (session) {
        const tenantIdFromJwt = (session as { tenantId?: string }).tenantId;
        if (tenantIdFromJwt) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantIdFromJwt },
                select: { id: true, slug: true },
            });
            if (tenant) {
                return { tenantId: tenant.id, slug: tenant.slug, source: 'session' };
            }
        }
    }

    // 3. Fallback — Shanklish mientras hay un solo tenant.
    return {
        tenantId: FALLBACK_TENANT_ID,
        slug: FALLBACK_TENANT_SLUG,
        source: 'fallback',
    };
}
