import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { getRecipeByIdAction } from '@/app/actions/recipe.actions';
import { UNIT_INFO } from '@/lib/constants/units';
import { ArrowLeft, Pencil, Coins, Info } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

import { getSession } from '@/lib/auth';
import { canViewCosts, UserRole } from '@/types';

export default async function RecipeDetailPage({ params }: { params: { id: string } }) {
    const session = await getSession();
    const showCosts = session ? canViewCosts(session.role as UserRole) : false;

    const recipe = await getRecipeByIdAction(params.id);

    if (!recipe) {
        notFound();
    }

    const effectiveOutput = recipe.outputQuantity * (recipe.yieldPercentage / 100);
    const totalCost = recipe.outputItem.currentCost * effectiveOutput;

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 border-b border-capsula-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/recetas"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                    >
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                    </Link>
                    <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Receta</div>
                        <div className="flex items-center gap-3">
                            <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                {recipe.name}
                            </h1>
                            <Badge variant={recipe.outputItem.type === 'SUB_RECIPE' ? 'coral' : 'ok'}>
                                {recipe.outputItem.type === 'SUB_RECIPE' ? 'Sub-receta' : 'Producto final'}
                            </Badge>
                        </div>
                        <p className="mt-1 text-[13px] text-capsula-ink-soft">
                            {recipe.description || 'Sin descripción'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link
                        href={`/dashboard/recetas/${params.id}/editar`}
                        className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-2 text-[13px] font-medium text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                    >
                        <Pencil className="h-4 w-4" strokeWidth={1.5} />
                        Editar
                    </Link>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                        <div className="border-b border-capsula-line px-6 py-4">
                            <h3 className="font-heading text-[16px] text-capsula-navy-deep">
                                Ingredientes <span className="ml-1 font-mono text-[13px] text-capsula-ink-muted">({recipe.ingredients.length})</span>
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px]">
                                <thead className="bg-capsula-ivory-alt text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    <tr>
                                        <th className="px-6 py-3">Ingrediente</th>
                                        <th className="px-6 py-3 text-right">Cant. neta</th>
                                        <th className="px-6 py-3 text-right">Merma</th>
                                        <th className="px-6 py-3 text-right">Cant. bruta</th>
                                        {showCosts && (
                                            <>
                                                <th className="px-6 py-3 text-right">Costo unit.</th>
                                                <th className="px-6 py-3 text-right">Total</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-capsula-line">
                                    {recipe.ingredients.map((ing) => {
                                        const grossQty = ing.quantity / (1 - ing.wastePercentage / 100);
                                        const totalIngCost = grossQty * ing.currentCost;

                                        return (
                                            <tr key={ing.id} className="transition-colors hover:bg-capsula-ivory-alt/50">
                                                <td className="px-6 py-4 font-medium text-capsula-ink">
                                                    {ing.ingredientItem.name}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-capsula-ink">
                                                    {formatNumber(ing.quantity)} {ing.unit}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {ing.wastePercentage > 0 ? (
                                                        <span className="font-mono text-capsula-coral">
                                                            {ing.wastePercentage}%
                                                        </span>
                                                    ) : <span className="text-capsula-ink-muted">—</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-capsula-ink-soft">
                                                    {formatNumber(grossQty, 3)} {ing.unit}
                                                </td>
                                                {showCosts && (
                                                    <>
                                                        <td className="px-6 py-4 text-right font-mono text-capsula-ink-soft">
                                                            {formatCurrency(ing.currentCost)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono font-medium text-capsula-navy-deep">
                                                            ~{formatCurrency(totalIngCost)}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                        <h3 className="mb-4 font-heading text-[16px] text-capsula-navy-deep">
                            Detalles de producción
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between border-b border-capsula-line pb-2">
                                <span className="text-[12px] uppercase tracking-[0.08em] text-capsula-ink-muted">Cantidad base</span>
                                <span className="font-mono text-[13px] text-capsula-ink">
                                    {formatNumber(recipe.outputQuantity)} {recipe.outputUnit}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-capsula-line pb-2">
                                <span className="text-[12px] uppercase tracking-[0.08em] text-capsula-ink-muted">Rendimiento</span>
                                <span className={`font-mono text-[13px] ${recipe.yieldPercentage < 100 ? 'text-[#946A1C]' : 'text-[#2F6B4E]'}`}>
                                    {recipe.yieldPercentage}%
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-capsula-line pb-2">
                                <span className="text-[12px] uppercase tracking-[0.08em] text-capsula-ink-muted">Producción efectiva</span>
                                <span className="font-mono text-[13px] font-semibold text-capsula-navy-deep">
                                    {formatNumber(effectiveOutput)} {recipe.outputUnit}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[12px] uppercase tracking-[0.08em] text-capsula-ink-muted">Tiempo total</span>
                                <span className="font-mono text-[13px] text-capsula-ink">
                                    {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
                                </span>
                            </div>
                        </div>
                    </div>

                    {showCosts && (
                        <div className="rounded-[var(--radius)] border border-capsula-line bg-[#F3EAD6]/40 p-6 shadow-cap-soft">
                            <div className="mb-4 flex items-center gap-2">
                                <Coins className="h-5 w-5 text-[#946A1C]" strokeWidth={1.5} />
                                <h3 className="font-heading text-[16px] text-capsula-navy-deep">
                                    Análisis de costos
                                </h3>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Costo unitario</p>
                                <p className="font-mono text-[28px] font-semibold text-capsula-navy-deep">
                                    {formatCurrency(recipe.outputItem.currentCost)}
                                </p>
                                <p className="text-[12px] text-capsula-ink-soft">
                                    por {UNIT_INFO[recipe.outputUnit as keyof typeof UNIT_INFO]?.labelEs || recipe.outputUnit}
                                </p>
                            </div>

                            <div className="mt-6 space-y-3 border-t border-[#946A1C]/20 pt-4">
                                <div className="flex justify-between text-[12px]">
                                    <span className="text-capsula-ink-soft">Costo total lote</span>
                                    <span className="font-mono font-medium text-capsula-navy-deep">
                                        {formatCurrency(totalCost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt/50 p-4">
                        <Info className="h-4 w-4 shrink-0 text-capsula-navy-deep" strokeWidth={1.5} />
                        <p className="text-[11.5px] text-capsula-ink-soft">
                            <span className="font-medium text-capsula-navy-deep">Info:</span> Los costos mostrados son calculados automáticamente basados en el precio actual de inventario (FIFO/Promedio) de cada ingrediente.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
