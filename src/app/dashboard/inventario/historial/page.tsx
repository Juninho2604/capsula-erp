import { getInventoryHistoryAction } from '@/app/actions/inventory.actions';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import HistoryList from './HistoryList';

export default async function InventoryHistoryPage() {
    const movements = await getInventoryHistoryAction({ limit: 500 });

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 border-b border-capsula-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                        <History className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Inventario</div>
                        <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Historial de movimientos</h1>
                        <p className="mt-1 text-[13px] text-capsula-ink-soft">Registro agrupado de transacciones.</p>
                    </div>
                </div>
                <Link
                    href="/dashboard/inventario"
                    className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-2 text-[13px] font-medium text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                    Volver al inventario
                </Link>
            </div>

            <HistoryList initialMovements={movements} />
        </div>
    );
}
