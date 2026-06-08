/**
 * Guard común de las server actions del módulo delivery: exige sesión, rol con
 * acceso al módulo y feature flag `deliveryOps` ON. Devuelve tenantId + userId.
 *
 * Permiso por sede: NO implementado (opción A del plan §17). Cualquier rol con
 * acceso a `delivery` opera sobre todas las sedes del tenant. El scoping por
 * sede (opción B) queda para una fase futura.
 */

import 'server-only';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { MODULE_ROLE_ACCESS } from '@/lib/constants/modules-registry';

const DELIVERY_ROLES = MODULE_ROLE_ACCESS['delivery'] ?? [];

export type DeliveryGuardResult =
    | { ok: true; tenantId: string; userId: string }
    | { ok: false; message: string };

export async function deliveryGuard(): Promise<DeliveryGuardResult> {
    const session = await getSession();
    if (!session) return { ok: false, message: 'Sin sesión.' };
    if (!DELIVERY_ROLES.includes(session.role)) {
        return { ok: false, message: 'Sin permiso para el módulo de delivery.' };
    }
    const { tenantId } = await resolveTenantContext();
    if (!(await tenantFeatureEnabled(tenantId, 'deliveryOps'))) {
        return { ok: false, message: 'El módulo de delivery no está habilitado.' };
    }
    return { ok: true, tenantId, userId: session.id };
}
