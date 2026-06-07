import Link from 'next/link';
import { FileSpreadsheet, BarChart3, Repeat, Coins } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ReportTile {
    href: string;
    label: string;
    description: string;
    Icon: typeof FileSpreadsheet;
    status: 'available' | 'soon';
}

const TILES: ReportTile[] = [
    {
        href: '/dashboard/reportes/inventario-completo',
        label: 'Inventario completo',
        description: 'Todos los SKU activos con stock por área, agrupados por categoría. Exportable a Excel.',
        Icon: FileSpreadsheet,
        status: 'available',
    },
    {
        href: '/dashboard/reportes/variacion-semanal',
        label: 'Variación semana vs semana',
        description: 'Compara dos conteos físicos semanales. Top mermas y entradas no registradas por SKU.',
        Icon: Repeat,
        status: 'soon',
    },
    {
        href: '/dashboard/reportes/movimientos',
        label: 'Movimientos por rango',
        description: 'Historial de transferencias, ajustes, ventas y mermas por rango de fechas y área.',
        Icon: BarChart3,
        status: 'soon',
    },
    {
        href: '/dashboard/reportes/ventas-costos',
        label: 'Ventas + costos + margen',
        description: 'Reporte financiero por período: ventas, costo teórico, margen por categoría.',
        Icon: Coins,
        status: 'soon',
    },
];

export default function ReportesPage() {
    return (
        <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
            <header>
                <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Reportes</h1>
                <p className="mt-1 text-sm text-capsula-ink-soft">
                    Reportes exportables a Excel — todos centralizados. El catálogo crece progresivamente:
                    los marcados como <em>Próximamente</em> ya tienen actions backend (§51.A, §50)
                    y se irán habilitando vista por vista.
                </p>
            </header>

            <div className="grid sm:grid-cols-2 gap-4">
                {TILES.map(t => (
                    <ReportCard key={t.href} tile={t} />
                ))}
            </div>
        </div>
    );
}

function ReportCard({ tile }: { tile: ReportTile }) {
    const isAvailable = tile.status === 'available';
    const Icon = tile.Icon;
    const inner = (
        <div className={`group relative rounded-2xl border border-capsula-line bg-capsula-ivory p-5 transition ${isAvailable ? 'hover:border-capsula-navy-deep/40 hover:shadow-sm cursor-pointer' : 'opacity-60'}`}>
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-capsula-navy-deep p-2.5 text-capsula-cream">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-capsula-ink">{tile.label}</h2>
                        {!isAvailable && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                                Próximamente
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-capsula-ink-muted leading-relaxed">{tile.description}</p>
                </div>
            </div>
        </div>
    );

    return isAvailable ? <Link href={tile.href}>{inner}</Link> : inner;
}
