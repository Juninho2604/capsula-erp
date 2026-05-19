/**
 * GET /api/debug/whoami
 *
 * Endpoint de diagnóstico que muestra exactamente qué está viendo el
 * sistema en runtime productivo para el usuario que llama:
 *   - role / userId del JWT
 *   - allowedModules del JWT (puede ser undefined en JWTs viejos)
 *   - allowedModules guardado en BD
 *   - SystemConfig.enabled_modules (parseado en formato actual)
 *   - resultado de visibleModules (lista final que ve el sidebar)
 *   - MODULE_REGISTRY IDs incluidos en este build
 *   - Build SHA (de env BUILD_SHA si está seteado durante deploy)
 *
 * Útil para diagnosticar "por qué no veo el módulo X" sin abrir Prisma
 * Studio.
 *
 * Requiere sesión activa. Solo devuelve data del propio usuario, no
 * info sensible de otros tenants.
 */

import { NextResponse } from 'next/server';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { withTenant } from '@/lib/prisma-tenant-client';
import { visibleModules } from '@/lib/permissions/has-permission';
import { MODULE_REGISTRY, getVisibleModules } from '@/lib/constants/modules-registry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let tenantId: string | null = null;
    let tenantSlug: string | null = null;
    try {
        const ctx = await resolveTenantContext();
        tenantId = ctx.tenantId;
        tenantSlug = ctx.slug;
    } catch {
        // ignore
    }

    // ── BD: User.allowedModules ──────────────────────────────────────────
    let dbUserAllowedModules: string | null = null;
    if (session.id) {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.id },
            select: { allowedModules: true, role: true, isActive: true },
        });
        dbUserAllowedModules = dbUser?.allowedModules ?? null;
    }

    // ── BD: SystemConfig.enabled_modules (tenant-scoped) ─────────────────
    let dbEnabledModulesRaw: string | null = null;
    if (tenantId) {
        const db = withTenant(tenantId);
        const config = await db.systemConfig.findFirst({
            where: { key: 'enabled_modules' },
        });
        dbEnabledModulesRaw = config?.value ?? null;
    }

    // ── visibleModules: el filtro por usuario ────────────────────────────
    const userVisibleModules = visibleModules({
        role: session.role,
        allowedModules: dbUserAllowedModules,
        grantedPerms: (session as any).grantedPerms ?? null,
        revokedPerms: (session as any).revokedPerms ?? null,
    });

    // ── Módulos del registry incluidos en esta build ─────────────────────
    const registryIds = MODULE_REGISTRY.map((m) => ({
        id: m.id,
        label: m.label,
        section: m.section,
        enabledByDefault: m.enabledByDefault,
    }));
    const hasSoldItemsReport = registryIds.some((m) => m.id === 'sold_items_report');

    return NextResponse.json({
        version: {
            buildSha: process.env.BUILD_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown',
            buildTime: process.env.BUILD_TIME ?? 'unknown',
            nodeEnv: process.env.NODE_ENV,
        },
        session: {
            id: session.id,
            email: (session as any).email ?? null,
            role: session.role,
            jwtAllowedModules: (session as any).allowedModules ?? null, // del JWT directo
        },
        tenant: {
            id: tenantId,
            slug: tenantSlug,
        },
        db: {
            userAllowedModules: dbUserAllowedModules,
            systemConfigEnabledModulesRaw: dbEnabledModulesRaw,
        },
        computed: {
            userVisibleModules,
            soldItemsReportInRegistry: hasSoldItemsReport,
            registryCount: registryIds.length,
        },
        registryIds,
    }, { status: 200 });
}
