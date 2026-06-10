import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileSpreadsheet, Repeat } from 'lucide-react';
import { PERM } from '@/lib/constants/permissions-registry';
import { getReportPageContext } from '@/lib/reports/page-guard';
import KardexView from './kardex-view';

export const dynamic = 'force-dynamic';

export default async function ReporteInventarioPage() {
    const ctx = await getReportPageContext(PERM.REPORTES_INVENTARIO_VER);
    if (!ctx.allowed) redirect('/dashboard/reportes');

    return (
        <div className="max-w-6xl mx-auto space-y-4 p-4 sm:p-6">
            {/* Reportes de inventario ya existentes (§51.B/§51.C) */}
            <div className="grid sm:grid-cols-2 gap-3">
                <Link href="/dashboard/reportes/inventario-completo" className="rounded-2xl border border-capsula-line bg-capsula-ivory p-4 hover:border-capsula-navy-deep/40 transition flex items-center gap-3">
                    <div className="rounded-xl bg-capsula-navy-deep p-2.5 text-capsula-cream"><FileSpreadsheet className="h-5 w-5" /></div>
                    <div>
                        <p className="font-semibold text-capsula-ink text-sm">Existencias valorizadas</p>
                        <p className="text-xs text-capsula-ink-muted">Todos los SKU con stock por área y valor (Excel)</p>
                    </div>
                </Link>
                <Link href="/dashboard/reportes/variacion-semanal" className="rounded-2xl border border-capsula-line bg-capsula-ivory p-4 hover:border-capsula-navy-deep/40 transition flex items-center gap-3">
                    <div className="rounded-xl bg-capsula-navy-deep p-2.5 text-capsula-cream"><Repeat className="h-5 w-5" /></div>
                    <div>
                        <p className="font-semibold text-capsula-ink text-sm">Variación semana vs semana</p>
                        <p className="text-xs text-capsula-ink-muted">Comparativa entre conteos físicos (mermas/entradas)</p>
                    </div>
                </Link>
            </div>

            <KardexView
                tenantName={ctx.tenantName}
                canExport={ctx.canExport}
            />
        </div>
    );
}
