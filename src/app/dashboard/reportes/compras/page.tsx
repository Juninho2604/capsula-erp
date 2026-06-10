import { redirect } from 'next/navigation';
import { PERM } from '@/lib/constants/permissions-registry';
import { getReportPageContext } from '@/lib/reports/page-guard';
import ComprasReportView from './compras-view';

export const dynamic = 'force-dynamic';

export default async function ReporteComprasPage() {
    const ctx = await getReportPageContext(PERM.REPORTES_COMPRAS_VER);
    if (!ctx.allowed) redirect('/dashboard/reportes');

    return (
        <ComprasReportView tenantName={ctx.tenantName} canExport={ctx.canExport} />
    );
}
