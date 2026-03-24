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
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="font-bold">{result.message || 'Error al cargar los objetivos'}</p>
      </div>
    );
  }

  return <MetasView data={result.data} />;
}
