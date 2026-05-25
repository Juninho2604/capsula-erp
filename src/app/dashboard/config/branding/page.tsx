import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getTenantBrandingAction } from '@/app/actions/branding.actions';
import { BrandingForm } from './branding-form';

export const metadata = {
    title: 'Identidad del Negocio | KPSULA',
    description: 'Logo, RIF, razón social y nombre que aparecen en recibos y headers',
};

export default async function BrandingConfigPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (session.role !== 'OWNER' && session.role !== 'ADMIN_MANAGER') {
        // Otros roles: dashboard sin denuncia explícita (no leakeamos
        // existencia de esta página por permiso)
        redirect('/dashboard');
    }

    const branding = await getTenantBrandingAction();
    if (!branding) {
        // Si el contexto no resuelve tenant, no podemos mostrar nada útil
        redirect('/dashboard');
    }

    return (
        <div className="min-h-screen bg-capsula-ivory">
            <div className="max-w-5xl mx-auto p-6 md:p-10">
                <div className="mb-8">
                    <h1 className="font-semibold text-2xl md:text-3xl tracking-[-0.02em] text-capsula-ink">
                        Identidad del Negocio
                    </h1>
                    <p className="mt-2 text-sm text-capsula-ink-muted">
                        Estos datos aparecen en los recibos que imprimís y en los encabezados
                        del POS. Si los dejás vacíos, los recibos saldrán sin esa información.
                    </p>
                </div>

                <BrandingForm initialBranding={branding} />
            </div>
        </div>
    );
}
