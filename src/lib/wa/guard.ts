/**
 * Guard de las server actions del módulo Conversaciones (UI del dashboard).
 * Tres capas: sesión + permiso granular CONVERSATIONS_MANAGE (RBAC 4 capas,
 * cubre roles base y grantedPerms individuales) + feature flag del tenant.
 */
import 'server-only';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export type WaGuardResult =
    | { ok: true; tenantId: string; userId: string; userName: string; userRole: string }
    | { ok: false; message: string };

export async function waGuard(): Promise<WaGuardResult> {
    const guard = await checkActionPermission(PERM.CONVERSATIONS_MANAGE);
    if (!guard.ok) return { ok: false, message: guard.message };

    let tenantId: string;
    try {
        ({ tenantId } = await resolveTenantContext());
    } catch {
        return { ok: false, message: 'Sin contexto de tenant.' };
    }

    const enabled = await tenantFeatureEnabled(tenantId, 'waConversations').catch(() => false);
    if (!enabled) return { ok: false, message: 'El módulo Conversaciones no está activo para este tenant.' };

    const u = guard.user as any;
    return {
        ok: true,
        tenantId,
        userId: u.id,
        userName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Usuario',
        userRole: u.role,
    };
}
