import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getBankAccountsAction } from '@/app/actions/bank-account.actions';
import { ConciliacionView } from './conciliacion-view';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Conciliación Bancaria | CAPSULA ERP',
  description: 'Conciliación de cuentas: esperado del sistema vs estado de cuenta',
};

export default async function ConciliacionPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
    redirect('/dashboard');
  }

  const result = await getBankAccountsAction();
  const accounts = (result.data ?? []).map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  return (
    <ConciliacionView
      accounts={accounts}
      canEdit={['OWNER', 'ADMIN_MANAGER'].includes(session.role)}
    />
  );
}
