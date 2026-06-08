import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { MODULE_ROLE_ACCESS } from '@/lib/constants/modules-registry';
import { listDeliveryOrdersAction } from '@/app/actions/delivery.actions';
import { DeliveryBoardView } from './delivery-board-view';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Gestión de Deliverys | KPSULA',
    description: 'Centro de operaciones de delivery',
};

const ALLOWED_ROLES = MODULE_ROLE_ACCESS['delivery'] ?? [];

export default async function DeliveryPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ALLOWED_ROLES.includes(session.role)) redirect('/dashboard');

    // El módulo solo existe si el tenant tiene el flag deliveryOps ON.
    let enabled = false;
    try {
        const { tenantId } = await resolveTenantContext();
        enabled = await tenantFeatureEnabled(tenantId, 'deliveryOps');
    } catch {
        enabled = false;
    }
    if (!enabled) redirect('/dashboard');

    const { orders, branches, drivers } = await listDeliveryOrdersAction();

    return <DeliveryBoardView initialOrders={orders} branches={branches} drivers={drivers} />;
}
