import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAreasForSelect } from '@/app/actions/entrada.actions';
import { listCountSessionsAction } from '@/app/actions/count-session.actions';
import CountSessionsView from './count-sessions-view';

export const dynamic = 'force-dynamic';

const ALLOWED = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'];
const CAN_APPLY = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

export default async function ConteoRapidoPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ALLOWED.includes(session.role)) {
        redirect('/dashboard/inventario');
    }

    const [areas, sessions] = await Promise.all([
        getAreasForSelect(),
        listCountSessionsAction(),
    ]);

    return (
        <CountSessionsView
            areas={areas.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }))}
            initialSessions={sessions.data ?? []}
            canApply={CAN_APPLY.includes(session.role)}
        />
    );
}
