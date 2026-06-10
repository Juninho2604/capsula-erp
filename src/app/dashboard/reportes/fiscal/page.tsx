import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileWarning } from 'lucide-react';
import { PERM } from '@/lib/constants/permissions-registry';
import { getReportPageContext } from '@/lib/reports/page-guard';

export const dynamic = 'force-dynamic';

/**
 * Familia F — FISCAL. Placeholder honesto: el sistema NO tiene todavía
 * infraestructura fiscal SENIAT (sin adaptador TFHKA, sin números de
 * control, sin IVA/IGTF desglosado) — ver DIAGNOSTICO_REPORTES.md §3.F.
 * El reporte de documentos emitidos se habilita en FASE C cuando exista
 * el modelo FiscalDocument + integración con impresora fiscal.
 */
export default async function ReporteFiscalPage() {
    const ctx = await getReportPageContext(PERM.REPORTES_FISCAL_VER);
    if (!ctx.allowed) redirect('/dashboard/reportes');

    return (
        <div className="max-w-3xl mx-auto space-y-4 p-4 sm:p-6">
            <header className="flex items-center gap-3">
                <Link href="/dashboard/reportes" className="h-9 w-9 rounded-full border border-capsula-line flex items-center justify-center text-capsula-ink-muted hover:bg-capsula-ivory-alt">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <h1 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">Reportes fiscales</h1>
            </header>

            <div className="rounded-2xl border border-capsula-line bg-capsula-ivory p-8 text-center">
                <FileWarning className="h-10 w-10 mx-auto text-capsula-ink-faint" />
                <p className="mt-3 font-semibold text-capsula-ink">Disponible en una fase posterior</p>
                <p className="mt-2 text-sm text-capsula-ink-soft max-w-md mx-auto">
                    El resumen de documentos fiscales emitidos (Providencias SENIAT) requiere la
                    integración con impresora fiscal (adaptador TFHKA), números de control y el
                    desglose IVA/IGTF — infraestructura planificada en FASE C del plan de reportes.
                </p>
                <p className="mt-3 text-xs text-capsula-ink-muted">
                    Mientras tanto, los correlativos internos (REST/DEL/PKP) y sus totales están
                    disponibles en Reportes → Operativos y en el Historial de ventas.
                </p>
            </div>
        </div>
    );
}
