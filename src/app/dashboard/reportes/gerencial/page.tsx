import { redirect } from 'next/navigation';
import { PERM } from '@/lib/constants/permissions-registry';
import { getReportPageContext } from '@/lib/reports/page-guard';
import GerencialReportView from './gerencial-view';

export const dynamic = 'force-dynamic';

export default async function ReporteGerencialPage() {
    // Solo roles administrativos (OWNER / ADMIN_MANAGER / AUDITOR por base)
    const ctx = await getReportPageContext(PERM.REPORTES_GERENCIAL_VER);
    if (!ctx.allowed) redirect('/dashboard/reportes');

    return (
        <GerencialReportView tenantName={ctx.tenantName} canExport={ctx.canExport} />
    );
}
