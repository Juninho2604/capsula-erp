import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSatisfactionSurveysAction } from '@/app/actions/satisfaction.actions';
import { EncuestasView } from './encuestas-view';

export const dynamic = 'force-dynamic';

export default async function EncuestasPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) redirect('/dashboard');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  const res = await getSatisfactionSurveysAction(today);

  return <EncuestasView initialData={res.data ?? null} initialDate={today} />;
}
