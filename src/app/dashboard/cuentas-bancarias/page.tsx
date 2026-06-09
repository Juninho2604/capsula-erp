import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getBankAccountsAction } from '@/app/actions/bank-account.actions';
import { CuentasBancariasView } from './cuentas-bancarias-view';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cuentas Bancarias | CAPSULA ERP',
  description: 'Cuentas, cajas y terminales — base de comisiones y conciliación bancaria',
};

export default async function CuentasBancariasPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER', 'AUDITOR'].includes(session.role)) {
    redirect('/dashboard');
  }

  const result = await getBankAccountsAction();

  return (
    <CuentasBancariasView
      initialAccounts={result.data ?? []}
      canEdit={['OWNER', 'ADMIN_MANAGER'].includes(session.role)}
    />
  );
}
