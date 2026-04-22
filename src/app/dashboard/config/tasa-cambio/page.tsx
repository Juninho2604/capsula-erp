import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getExchangeRateHistory } from '@/app/actions/exchange.actions';
import { TasaCambioView } from './tasa-cambio-view';
import { Banknote } from 'lucide-react';

export const metadata = {
    title: 'Tasa de Cambio | CAPSULA ERP',
    description: 'Actualizar la tasa de cambio BCV',
};

export default async function TasaCambioPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const allowed = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'];
    if (!allowed.includes(session.role)) redirect('/dashboard');

    const history = await getExchangeRateHistory(15);

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <Banknote className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Configuración</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Tasa de cambio</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">Actualiza la tasa BCV diaria. Se aplica en todos los POS de manera inmediata.</p>
                </div>
            </div>
            <TasaCambioView history={history} />
        </div>
    );
}
