import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getCountSessionAction } from '@/app/actions/count-session.actions';
import CountSessionDetailView from './count-session-detail-view';

export const dynamic = 'force-dynamic';

import { canCount } from '@/lib/inventory/count-permissions';

export default async function ConteoSesionPage({ params }: { params: { sessionId: string } }) {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!canCount(session.role)) redirect('/dashboard/inventario');

    const res = await getCountSessionAction(params.sessionId);
    if (!res.success || !res.data) notFound();

    return <CountSessionDetailView initial={res.data} />;
}
