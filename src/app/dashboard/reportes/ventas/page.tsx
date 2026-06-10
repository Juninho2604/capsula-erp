import { redirect } from 'next/navigation';
import { PERM } from '@/lib/constants/permissions-registry';
import { getReportPageContext } from '@/lib/reports/page-guard';
import VentasReportView from './ventas-view';

export const dynamic = 'force-dynamic';

export default async function ReporteVentasPage() {
    const ctx = await getReportPageContext(PERM.REPORTES_VENTAS_VER);
    if (!ctx.allowed) redirect('/dashboard/reportes');

    return (
        <VentasReportView
            tenantName={ctx.tenantName}
            branches={ctx.branches}
            canExport={ctx.canExport}
        />
    );
}
