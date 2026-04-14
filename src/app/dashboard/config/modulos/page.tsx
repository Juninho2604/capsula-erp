import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUsers } from '@/app/actions/user.actions';
import { getEnabledModulesFromDB } from '@/app/actions/system-config.actions';
import { ModulosView } from './modulos-view';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Módulos | CAPSULA ERP',
  description: 'Configuración de módulos del sistema y por usuario',
};

export default async function ModulosPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
    redirect('/dashboard');
  }

  const [users, enabledIds] = await Promise.all([
    getUsers(),
    getEnabledModulesFromDB(),
  ]);

  return (
    <ModulosView
      users={users}
      enabledModuleIds={enabledIds}
      currentUserId={session.id}
      isOwner={session.role === 'OWNER'}
    />
  );
}
