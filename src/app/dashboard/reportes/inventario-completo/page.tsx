import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getInventoryReportAction } from '@/app/actions/reports.actions';
import InventoryReportView from './inventory-report-view';

export const dynamic = 'force-dynamic';

export default async function InventoryReportPage() {
    const res = await getInventoryReportAction();

    if (!res.success) {
        return (
            <div className="max-w-3xl mx-auto p-6 space-y-3">
                <Link href="/dashboard/reportes" className="text-sm text-capsula-coral hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-4 w-4" /> Volver a Reportes
                </Link>
                <div className="rounded-xl bg-[#F7E3DB] dark:bg-[#3B1F14] text-[#B04A2E] dark:text-[#EFD2C8] p-4">
                    <p className="font-semibold text-sm">No se pudo generar el reporte</p>
                    <p className="text-xs mt-1 opacity-90">{res.message ?? 'Error desconocido'}</p>
                </div>
            </div>
        );
    }

    return (
        <InventoryReportView
            initialRows={res.rows ?? []}
            areas={res.areas ?? []}
            generatedAt={res.generatedAt ?? new Date()}
        />
    );
}
