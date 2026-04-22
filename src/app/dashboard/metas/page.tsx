import { AlertTriangle } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getMetasAction } from '@/app/actions/metas.actions';
import { MetasView } from './metas-view';

export const dynamic = 'force-dynamic';

export default async function MetasPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const result = await getMetasAction();

  if (!result.success || !result.data) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center text-capsula-ink-muted">
        <AlertTriangle className="h-8 w-8 text-[#946A1C]" />
        <p className="text-sm font-medium text-capsula-ink">
          {result.message || 'Error al cargar los objetivos'}
        </p>
      </div>
    );
  }

  return <MetasView data={result.data} />;
}
