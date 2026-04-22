import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ModulesConfigView } from './modules-config-view';
import { getEnabledModulesFromDB } from '@/app/actions/system-config.actions';
import { Puzzle } from 'lucide-react';

export const metadata = {
    title: 'Módulos del Sistema | CAPSULA ERP',
    description: 'Activar y desactivar módulos del sistema',
};

export default async function ModulesConfigPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (session.role !== 'OWNER') redirect('/dashboard');

    // Leer estado actual desde la BD para inicializar los switches correctamente
    const enabledModuleIds = await getEnabledModulesFromDB();

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <Puzzle className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Configuración</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Módulos del sistema</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        Activa o desactiva módulos. Los cambios se guardan en la base de datos y se aplican de inmediato — sin reiniciar el servidor ni editar variables de entorno.
                    </p>
                </div>
            </div>

            <ModulesConfigView initialEnabledIds={enabledModuleIds} />
        </div>
    );
}
