/**
 * Gate server-side de la page /dashboard/conversaciones — espejo de
 * require-delivery-page.ts: sesión → permiso → feature flag.
 */
import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions/has-permission';
import { PERM } from '@/lib/constants/permissions-registry';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export async function requireConversacionesPage(): Promise<{ tenantId: string; role: string }> {
    const session = await getSession();
    if (!session) redirect('/login');

    const allowed = hasPermission(
        {
            role: session.role,
            allowedModules: (session as any).allowedModules ?? null,
            grantedPerms: (session as any).grantedPerms ?? null,
            revokedPerms: (session as any).revokedPerms ?? null,
        },
        PERM.CONVERSATIONS_MANAGE,
    );
    if (!allowed) redirect('/dashboard');

    let tenantId = '';
    let enabled = false;
    try {
        ({ tenantId } = await resolveTenantContext());
        enabled = await tenantFeatureEnabled(tenantId, 'waConversations');
    } catch {
        enabled = false;
    }
    if (!enabled) redirect('/dashboard');

    return { tenantId, role: session.role };
}
