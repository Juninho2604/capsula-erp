/**
 * Guard de las páginas (server components) del módulo delivery: exige sesión,
 * rol con acceso y feature flag `deliveryOps`. Redirige si no cumple.
 */

import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { MODULE_ROLE_ACCESS } from '@/lib/constants/modules-registry';

const ROLES = MODULE_ROLE_ACCESS['delivery'] ?? [];

export async function requireDeliveryPage(): Promise<void> {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ROLES.includes(session.role)) redirect('/dashboard');

    let enabled = false;
    try {
        const { tenantId } = await resolveTenantContext();
        enabled = await tenantFeatureEnabled(tenantId, 'deliveryOps');
    } catch {
        enabled = false;
    }
    if (!enabled) redirect('/dashboard');
}
