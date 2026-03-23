import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ModulesConfigView } from './modules-config-view';

export const metadata = {
    title: 'Módulos del Sistema | CAPSULA ERP',
    description: 'Activar y desactivar módulos del sistema',
};

export default async function ModulesConfigPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (session.role !== 'OWNER') redirect('/dashboard');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Configuración de Módulos
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Activa o desactiva módulos del sistema. Copia la variable generada en tu archivo{' '}
                    <code className="rounded bg-gray-100 px-1 font-mono dark:bg-gray-800">.env</code> y
                    reinicia el servidor para aplicar los cambios.
                </p>
            </div>
            <ModulesConfigView />
        </div>
    );
}
