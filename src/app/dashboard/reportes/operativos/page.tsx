import { redirect } from 'next/navigation';
import { PERM } from '@/lib/constants/permissions-registry';
import { getReportPageContext } from '@/lib/reports/page-guard';
import OperativosReportView from './operativos-view';

export const dynamic = 'force-dynamic';

export default async function ReporteOperativosPage() {
    const ctx = await getReportPageContext(PERM.REPORTES_OPERATIVOS_VER);
    if (!ctx.allowed) redirect('/dashboard/reportes');

    return (
        <OperativosReportView
            tenantName={ctx.tenantName}
            branches={ctx.branches}
            canExport={ctx.canExport}
        />
    );
}
