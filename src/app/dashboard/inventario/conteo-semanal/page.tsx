import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { resolveDefaultCountAreasAction } from '@/app/actions/inventory-count.actions';
import PhysicalCountClient from './PhysicalCountClient';

export const dynamic = 'force-dynamic';

const ALLOWED = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'];
const CAN_RESET = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

export default async function ConteoSemanalPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!ALLOWED.includes(session.role)) {
    redirect('/dashboard/inventario');
  }

  const { areas, principalId, productionId } = await resolveDefaultCountAreasAction();

  return (
    <PhysicalCountClient
      areas={areas}
      defaultPrincipalId={principalId}
      defaultProductionId={productionId}
      canReset={CAN_RESET.includes(session.role)}
    />
  );
}
