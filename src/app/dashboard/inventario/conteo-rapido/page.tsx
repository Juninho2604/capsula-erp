import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { resolveDefaultCountAreasAction } from '@/app/actions/inventory-count.actions';
import QuickCountView from './quick-count-view';

export const dynamic = 'force-dynamic';

const ALLOWED = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'];

export default async function ConteoRapidoPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ALLOWED.includes(session.role)) {
        redirect('/dashboard/inventario');
    }

    const { areas, principalId, productionId } = await resolveDefaultCountAreasAction();

    return (
        <QuickCountView
            areas={areas}
            defaultPrincipalId={principalId}
            defaultProductionId={productionId}
        />
    );
}
