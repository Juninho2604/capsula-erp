import Link from 'next/link';
import {
    BarChart3, ClipboardList, Boxes, ShoppingCart, LineChart, Landmark, Lock,
} from 'lucide-react';
import { getReportPageContext } from '@/lib/reports/page-guard';
import { getExecutiveDayKpis } from '@/lib/reports/management-reports';
import ExecutiveDashboard from './executive-dashboard';

export const dynamic = 'force-dynamic';

interface FamilyTile {
    key: keyof Awaited<ReturnType<typeof getReportPageContext>>['familyPerms'];
    href: string;
    label: string;
    description: string;
    Icon: typeof BarChart3;
}

const FAMILIES: FamilyTile[] = [
    { key: 'ventas', href: '/dashboard/reportes/ventas', label: 'Ventas', description: 'Por producto, categoría, mesonero, área, canal y método de pago (Bs/USD).', Icon: BarChart3 },
    { key: 'operativos', href: '/dashboard/reportes/operativos', label: 'Operativos', description: 'Cierres X/Z, anulaciones con motivo, descuentos y transferencias de mesa.', Icon: ClipboardList },
    { key: 'inventario', href: '/dashboard/reportes/inventario', label: 'Inventario', description: 'Existencias valorizadas, kardex por rango y variación semanal.', Icon: Boxes },
    { key: 'compras', href: '/dashboard/reportes/compras', label: 'Compras', description: 'Compras por proveedor, OC vs recepciones y precios de insumos.', Icon: ShoppingCart },
    { key: 'gerencial', href: '/dashboard/reportes/gerencial', label: 'Gerencial', description: 'Ingeniería de menú (popularidad × margen). Solo roles administrativos.', Icon: LineChart },
    { key: 'fiscal', href: '/dashboard/reportes/fiscal', label: 'Fiscal', description: 'Documentos fiscales SENIAT — disponible en FASE C.', Icon: Landmark },
];

export default async function ReportesPage() {
    const ctx = await getReportPageContext(null);

    if (!ctx.allowed) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <div className="rounded-2xl border border-capsula-line bg-capsula-ivory p-10 text-center">
                    <Lock className="h-10 w-10 mx-auto text-capsula-ink-faint" />
                    <p className="mt-3 font-semibold text-capsula-ink">Sin acceso al módulo de Reportes</p>
                    <p className="mt-1 text-sm text-capsula-ink-muted">
                        Pide a un administrador que te otorgue los permisos de reportes
                        (reportes.ventas.ver, reportes.inventario.ver, …) desde Usuarios.
                    </p>
                </div>
            </div>
        );
    }

    // Dashboard ejecutivo del día (KPIs en vivo) — solo si puede ver ventas.
    const kpis = ctx.familyPerms.ventas
        ? await getExecutiveDayKpis(ctx.tenantId).catch(() => null)
        : null;

    return (
        <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
            <header>
                <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Reportes</h1>
                <p className="mt-1 text-sm text-capsula-ink-soft">
                    KPIs del día y reportes por familia — todos exportables, todos con la tasa
                    histórica de cada transacción.
                </p>
            </header>

            {kpis && <ExecutiveDashboard kpis={kpis} />}

            <section>
                <p className="pos-kicker mb-2">Familias de reportes</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {FAMILIES.map(fam => {
                        const allowed = ctx.familyPerms[fam.key];
                        const inner = (
                            <div className={`group relative rounded-2xl border border-capsula-line bg-capsula-ivory p-5 transition h-full ${allowed ? 'hover:border-capsula-navy-deep/40 hover:shadow-sm cursor-pointer' : 'opacity-50'}`}>
                                <div className="flex items-start gap-3">
                                    <div className="rounded-xl bg-capsula-navy-deep p-2.5 text-capsula-cream">
                                        <fam.Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-semibold text-capsula-ink">{fam.label}</h2>
                                            {!allowed && <Lock className="h-3.5 w-3.5 text-capsula-ink-faint" />}
                                        </div>
                                        <p className="mt-1 text-xs text-capsula-ink-muted leading-relaxed">{fam.description}</p>
                                    </div>
                                </div>
                            </div>
                        );
                        return allowed
                            ? <Link key={fam.key} href={fam.href}>{inner}</Link>
                            : <div key={fam.key}>{inner}</div>;
                    })}
                </div>
            </section>
        </div>
    );
}
