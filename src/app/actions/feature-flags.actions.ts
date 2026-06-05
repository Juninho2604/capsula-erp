'use server';

/**
 * Gestión de feature flags por tenant. Solo OWNER puede leer y togglear.
 * Cambios efectivos en máximo 30 segundos (TTL del cache en feature-flags.ts).
 */

import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import {
    FEATURE_FLAGS,
    type FeatureFlagKey,
    getTenantFeatureFlags,
    setTenantFeatureFlag,
} from '@/lib/feature-flags';

function isOwner(role: string | undefined): boolean {
    return role === 'OWNER';
}

export type FeatureFlagRow = {
    key: FeatureFlagKey;
    label: string;
    description: string;
    enabled: boolean;
};

export async function getFeatureFlagsForCurrentTenantAction(): Promise<{
    success: boolean;
    message?: string;
    data?: FeatureFlagRow[];
}> {
    const session = await getSession();
    if (!session) return { success: false, message: 'Sin sesión.' };
    if (!isOwner(session.role)) {
        return { success: false, message: 'Solo el OWNER puede ver feature flags.' };
    }

    const { tenantId } = await resolveTenantContext();
    const flags = await getTenantFeatureFlags(tenantId);
    const rows: FeatureFlagRow[] = (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map(key => ({
        key,
        label: FEATURE_FLAGS[key].label,
        description: FEATURE_FLAGS[key].description,
        enabled: flags[key],
    }));
    return { success: true, data: rows };
}

export async function toggleFeatureFlagAction(
    flag: FeatureFlagKey,
    enabled: boolean,
): Promise<{ success: boolean; message?: string }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'Sin sesión.' };
    if (!isOwner(session.role)) {
        return { success: false, message: 'Solo el OWNER puede modificar feature flags.' };
    }
    if (!(flag in FEATURE_FLAGS)) {
        return { success: false, message: `Flag desconocido: ${flag}` };
    }

    const { tenantId } = await resolveTenantContext();
    await setTenantFeatureFlag(tenantId, flag, enabled);
    return { success: true };
}
