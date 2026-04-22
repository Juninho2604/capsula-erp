import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CostImporter } from './CostImporter';
import { getCurrentCostsAction } from '@/app/actions/cost.actions';
import { CheckCircle2, AlertTriangle, Package, ClipboardList, Coins } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

export default async function CostosPage() {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    const costsResult = await getCurrentCostsAction();
    const items = costsResult.items || [];

    const withCost = items.filter(i => i.currentCost !== null).length;
    const withoutCost = items.filter(i => i.currentCost === null).length;

    return (
        <div className="mx-auto max-w-[1400px] animate-in">
            <PageHeader
                kicker="Finanzas"
                title="Módulo de costos"
                description="Gestión de precios de compra y cálculo de COGS."
            />

            {/* KPI Cards */}
            <div className="mb-6 grid gap-4 md:grid-cols-3">
                <KpiCard
                    label="Con costo"
                    value={withCost}
                    icon={CheckCircle2}
                    hint="Ítems con precio registrado"
                />
                <KpiCard
                    label="Sin costo"
                    value={withoutCost}
                    icon={AlertTriangle}
                    hint="Requieren actualización"
                    trend={withoutCost > 0 ? 'down' : 'flat'}
                />
                <KpiCard
                    label="Total ítems"
                    value={items.length}
                    icon={Package}
                    hint="Materias primas en inventario"
                />
            </div>

            {/* Cost Importer */}
            <CostImporter />

            {/* Current Costs Table */}
            {items.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                    <div className="flex items-center gap-2 border-b border-capsula-line bg-capsula-ivory px-5 py-3">
                        <ClipboardList className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
                        <h3 className="font-medium text-capsula-ink">Costos actuales de materias primas</h3>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                        <table className="w-full border-collapse text-[13px]">
                            <thead className="sticky top-0">
                                <tr className="border-b border-capsula-line bg-capsula-ivory">
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Producto</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">SKU</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Categoría</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Unidad</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Costo actual</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Moneda</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id} className="border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory">
                                        <td className="px-4 py-3 font-medium text-capsula-ink">{item.name}</td>
                                        <td className="px-4 py-3 font-mono text-[11.5px] text-capsula-ink-muted">{item.sku || '—'}</td>
                                        <td className="px-4 py-3 text-capsula-ink-soft">{item.category || '—'}</td>
                                        <td className="px-4 py-3 text-capsula-ink-soft">{item.baseUnit}</td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {item.currentCost !== null ? (
                                                <span className="font-semibold text-[#2F6B4E]">
                                                    {item.currentCost.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-[#946A1C]">Sin precio</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {item.currentCost !== null && (
                                                <Badge variant={item.currency === 'USD' ? 'ok' : 'info'}>
                                                    {item.currency === 'USD' ? '$' : 'Bs'}
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
