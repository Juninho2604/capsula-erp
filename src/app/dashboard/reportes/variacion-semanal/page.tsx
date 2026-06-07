import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listWeeklyCountsAction } from '@/app/actions/inventory-count.actions';
import VariacionSemanalView from './variacion-semanal-view';

export const dynamic = 'force-dynamic';

export default async function VariacionSemanalPage() {
    const res = await listWeeklyCountsAction({ limit: 50 });

    if (!res.success) {
        return (
            <div className="max-w-3xl mx-auto p-6 space-y-3">
                <Link href="/dashboard/reportes" className="text-sm text-capsula-coral hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-4 w-4" /> Volver a Reportes
                </Link>
                <div className="rounded-xl bg-[#F7E3DB] dark:bg-[#3B1F14] text-[#B04A2E] dark:text-[#EFD2C8] p-4">
                    <p className="font-semibold text-sm">No se pudo cargar el historial</p>
                    <p className="text-xs mt-1 opacity-90">{res.message ?? 'Error desconocido'}</p>
                </div>
            </div>
        );
    }

    return <VariacionSemanalView counts={res.counts ?? []} />;
}
