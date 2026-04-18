import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUsers } from '@/app/actions/user.actions';
import PermisosUsuarioView from './permisos-usuario-view';

export const dynamic = 'force-dynamic';

export default async function PermisosUsuarioPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
    redirect('/dashboard');
  }

  const users = await getUsers();

  return <PermisosUsuarioView users={users} currentUserId={session.id} />;
}
