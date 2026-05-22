import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { OfflineBanner } from '@/components/offline-banner';
import { TenantSubdomainBanner } from '@/components/layout/TenantSubdomainBanner';
import { getSession } from '@/lib/auth';
import { getEnabledModulesFromDB } from '@/app/actions/system-config.actions';
import { visibleModules } from '@/lib/permissions/has-permission';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { isSuperAdmin } from '@/lib/super-admin';
import prisma from '@/server/db';

// Layout dinámico SIEMPRE — el sidebar depende del session + módulos
// habilitados, ambos varían por request/usuario. Sin esto, Next.js puede
// servir un render cacheado tras deploys que cambian el MODULE_REGISTRY
// (caso reportado 2026-05-19: módulo nuevo no aparecía aunque el deploy
// se había hecho).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    // Leer módulos habilitados desde BD (una sola vez por request, en el servidor)
    const enabledModuleIds = await getEnabledModulesFromDB();

    // visibleModules aplica las 4 capas: allowedModules (JWT) ∪ módulos de grantedPerms.
    // Fallback defensivo: JWTs emitidos ANTES del Prompt 2 no tienen `allowedModules`
    // (campo undefined). En ese caso consultamos BD para evitar mostrar de más al
    // usuario hasta que cierre sesión y vuelva a entrar.
    let userAllowedModules: string[] | null = null;
    if (session) {
        let allowedModules = session.allowedModules;
        if (allowedModules === undefined && session.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.id },
                select: { allowedModules: true },
            });
            allowedModules = dbUser?.allowedModules ?? null;
        }
        userAllowedModules = visibleModules({
            role: session.role,
            allowedModules: allowedModules ?? null,
            grantedPerms: session.grantedPerms ?? null,
            revokedPerms: session.revokedPerms ?? null,
        });
    }

    // Slug del tenant — para el banner de sub-dominio. Si falla la
    // resolución (cosa rara, no debería), el banner simplemente no se
    // muestra. Cero impacto en el resto del layout.
    let tenantSlug: string | null = null;
    try {
        const ctx = await resolveTenantContext();
        tenantSlug = ctx.slug;
    } catch {
        // ignore — banner se oculta solo
    }

    const sidebar = (
        <Sidebar
            initialUser={session}
            enabledModuleIds={enabledModuleIds}
            userAllowedModules={userAllowedModules}
            isSuperAdmin={isSuperAdmin(session?.email)}
        />
    );

    return (
        <>
            <OfflineBanner />
            <TenantSubdomainBanner
                tenantSlug={tenantSlug}
                userRole={session?.role ?? null}
            />
            <DashboardShell sidebar={sidebar}>
                {children}
            </DashboardShell>
        </>
    );
}
