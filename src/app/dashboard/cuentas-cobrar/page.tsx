import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAccountsReceivableAction } from '@/app/actions/account-receivable.actions';
import { getBankAccountsAction } from '@/app/actions/bank-account.actions';
import { CuentasCobrarView } from './cuentas-cobrar-view';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cuentas por Cobrar | CAPSULA ERP',
  description: 'Control de lo que terceros le deben al negocio',
};

export default async function CuentasCobrarPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) {
    redirect('/dashboard');
  }

  const [result, accountsResult] = await Promise.all([
    getAccountsReceivableAction(),
    getBankAccountsAction(),
  ]);

  return (
    <CuentasCobrarView
      initialItems={result.data ?? []}
      summary={result.summary ?? { pendingUsd: 0, overdueUsd: 0, collectedUsd: 0, debtors: 0 }}
      bankAccounts={(accountsResult.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
      canEdit={['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)}
    />
  );
}
