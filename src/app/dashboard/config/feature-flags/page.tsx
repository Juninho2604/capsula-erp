import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getFeatureFlagsForCurrentTenantAction } from '@/app/actions/feature-flags.actions';
import { FeatureFlagsView } from './feature-flags-view';

export const metadata = {
    title: 'Feature Flags | KPSULA',
    description: 'Kill switch por tenant para features con riesgo.',
};

export default async function FeatureFlagsConfigPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (session.role !== 'OWNER') {
        return (
            <div className="space-y-6">
                <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                    Feature Flags
                </h1>
                <div className="bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] border border-capsula-line p-4 rounded-xl text-sm">
                    Solo el OWNER puede ver o modificar feature flags.
                </div>
            </div>
        );
    }

    const res = await getFeatureFlagsForCurrentTenantAction();
    const rows = res.success ? res.data ?? [] : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                    Feature Flags
                </h1>
                <p className="text-capsula-ink-soft">
                    Kill switch por tenant. Prende o apaga features con riesgo sin redeploy.
                    Cambios efectivos en hasta 30 segundos.
                </p>
            </div>
            <FeatureFlagsView initialRows={rows} />
        </div>
    );
}
