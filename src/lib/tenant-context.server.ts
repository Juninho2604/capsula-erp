/**
 * Tenant context resolver — server-side.
 *
 * Resuelve QUÉ tenant debe operar en el request actual:
 *   1. Subdomain en el host (caso normal en producción).
 *   2. JWT session si no hay subdomain pero el user está logueado.
 *   3. Fallback (Shanklish) durante la transición a multi-tenant pleno.
 *
 * ── Modo strict ───────────────────────────────────────────────────────────
 * Cuando `MULTI_TENANT_STRICT=true` está seteado, el paso 3 (fallback)
 * **lanza error en vez de devolver Shanklish**. Usar cuando hay ≥2 tenants
 * en producción y no queremos que un request sin contexto opere sobre el
 * tenant histórico por accidente. Sigue siendo OK en dev/test single-tenant.
 *
 * Incluso fuera de strict mode, cuando el fallback se dispara emitimos un
 * `console.warn` para que aparezca en logs y podamos detectar call-paths
 * que están actuando como Shanklish sin contexto explícito.
 */

import 'server-only';
import { headers } from 'next/headers';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/super-admin';
import {
    extractTenantSlugFromHost,
    FALLBACK_TENANT_SLUG,
    FALLBACK_TENANT_ID,
    type TenantContext,
} from './tenant-context';

export type { TenantContext };
export { FALLBACK_TENANT_SLUG, FALLBACK_TENANT_ID };

export class TenantContextUnresolvedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TenantContextUnresolvedError';
    }
}

/**
 * Lanzada cuando la sesión del usuario pertenece a un tenant distinto al
 * del subdomain que está pegando. Caller (middleware / server action /
 * route handler) debe convertirla en 403 o redirect a /login para que
 * el atacante no se filtre a otro tenant con su cookie.
 */
export class CrossTenantAccessError extends Error {
    readonly sessionTenantId: string;
    readonly hostTenantId: string;
    constructor(sessionTenantId: string, hostTenantId: string) {
        super(
            `Cross-tenant access blocked: session.tenantId=${sessionTenantId} ` +
                `≠ host.tenantId=${hostTenantId}`,
        );
        this.name = 'CrossTenantAccessError';
        this.sessionTenantId = sessionTenantId;
        this.hostTenantId = hostTenantId;
    }
}

function isStrictMode(): boolean {
    return process.env.MULTI_TENANT_STRICT === 'true';
}

/**
 * Resuelve el tenant del request actual. Llamar desde server actions /
 * server components / API routes. NO usar en client components ni en
 * middleware (middleware corre en Edge sin acceso a Prisma).
 *
 * En modo NO-strict (default histórico) siempre devuelve un TenantContext
 * válido — si nada resuelve, cae al fallback con warning.
 *
 * En modo strict (`MULTI_TENANT_STRICT=true`) lanza
 * `TenantContextUnresolvedError` si no se puede resolver. Convertí la
 * acción/endpoint a un 401/403 en el caller.
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
            // 1.b Defensa cross-subdomain — crítica para evitar fugas.
            //
            // La cookie de sesión tiene domain=.kpsula.app y viaja a TODOS
            // los subdomains. Un user logueado en shanklish.kpsula.app que
            // navega a tenantB.kpsula.app trae su cookie intacta. Si no
            // chequeamos pertenencia, el resolver devolvería tenantB y
            // todas las queries traerían data de tenantB → fuga total.
            //
            // Excepción: super admins pueden operar como cualquier tenant
            // por diseño (soporte, impersonation futura). El allowlist es
            // SUPER_ADMIN_EMAILS — verificado server-side cada request.
            const session = await getSession();
            if (session) {
                const sessionTenantId = (session as { tenantId?: string }).tenantId;
                if (
                    sessionTenantId &&
                    sessionTenantId !== tenant.id &&
                    !isSuperAdmin(session.email)
                ) {
                    throw new CrossTenantAccessError(sessionTenantId, tenant.id);
                }
            }
            return { tenantId: tenant.id, slug: tenant.slug, source: 'subdomain' };
        }
        // Slug en host pero no en BD. En strict mode esto es un 404 hard
        // (host de tenant inexistente, no debería caer a Shanklish).
        if (isStrictMode()) {
            throw new TenantContextUnresolvedError(
                `Host "${host}" tiene slug "${slug}" pero no existe en BD.`,
            );
        }
    }

    // 2. JWT session (host sin subdomain, e.g. kpsula.app root)
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
    if (isStrictMode()) {
        throw new TenantContextUnresolvedError(
            'No se pudo resolver tenant: ni subdomain ni session con tenantId válido. ' +
                'Strict mode activo (MULTI_TENANT_STRICT=true).',
        );
    }

    console.warn(
        '[tenant-context] Cayendo al fallback (Shanklish). ' +
            'Host="' + (host ?? '-') + '". ' +
            'Activar MULTI_TENANT_STRICT=true en prod cuando ≥2 tenants estén onboardeados.',
    );
    return {
        tenantId: FALLBACK_TENANT_ID,
        slug: FALLBACK_TENANT_SLUG,
        source: 'fallback',
    };
}
