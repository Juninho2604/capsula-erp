import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCurrencyExchangesAction, getExchangeBankAccountsAction } from '@/app/actions/currency-exchange.actions';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { CambioDivisasView } from './cambio-divisas-view';

export const dynamic = 'force-dynamic';

export default async function CambioDivisasPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER', 'AUDITOR'].includes(session.role)) redirect('/dashboard');

  const [exchangesRes, accountsRes, dayRate] = await Promise.all([
    getCurrencyExchangesAction(),
    getExchangeBankAccountsAction(),
    getExchangeRateValue().catch(() => null),
  ]);

  return (
    <CambioDivisasView
      initialExchanges={exchangesRes.data ?? []}
      accounts={accountsRes.data ?? []}
      dayRate={dayRate}
      canManage={['OWNER', 'ADMIN_MANAGER'].includes(session.role)}
    />
  );
}
