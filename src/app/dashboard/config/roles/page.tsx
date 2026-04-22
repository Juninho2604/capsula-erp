import { getUsers } from '@/app/actions/user.actions';
import { RolesView } from './roles-view';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
    title: 'Configuración de Roles | Shanklish App',
    description: 'Gestión de roles y permisos de usuarios',
};

export default async function RolesConfigPage() {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    // Doble chequeo de seguridad en renderizado (las acciones tambien validan)
    // Usamos el rol "raw" string para validación simple aquí, o la utilidad hasPermission
    // pero por ahora dejamos que la acción maneje el error detallado o el componente renderice estado vacío

    let users: any[] = [];
    try {
        users = await getUsers();
    } catch (e) {
        // Si falla autorización, devuelve array vacío o redirige
        // console.error(e);
    }

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Configuración</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Roles y permisos</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">Administra los accesos de los usuarios al sistema.</p>
                </div>
            </div>

            <RolesView initialUsers={users} currentUserRole={session.role} />
        </div>
    );
}
