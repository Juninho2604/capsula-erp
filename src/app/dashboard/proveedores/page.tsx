import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listSuppliersAction } from '@/app/actions/supplier.actions';
import { ProveedoresView } from './proveedores-view';

export const dynamic = 'force-dynamic';

export default async function ProveedoresPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) redirect('/dashboard');

  const res = await listSuppliersAction();
  return (
    <ProveedoresView
      initialSuppliers={res.data ?? []}
      canManage={['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)}
    />
  );
}
