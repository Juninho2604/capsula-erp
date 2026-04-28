
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Layers, UtensilsCrossed, Info, Coins } from 'lucide-react';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import { getRecipeByIdAction } from '@/app/actions/recipe.actions';
import { UNIT_INFO } from '@/lib/constants/units';

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
    const TypeIcon = recipe.outputItem.type === 'SUB_RECIPE' ? Layers : UtensilsCrossed;
    const typeLabel = recipe.outputItem.type === 'SUB_RECIPE' ? 'Sub-receta' : 'Producto Final';

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/recetas"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-capsula-line text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                        aria-label="Volver a recetas"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">{recipe.name}</h1>
                            <span className="inline-flex items-center gap-1 rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-xs font-medium text-capsula-ink-soft">
                                <TypeIcon className="h-3 w-3" />
                                {typeLabel}
                            </span>
                        </div>
                        <p className="text-capsula-ink-muted">
                            {recipe.description || 'Sin descripción'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link
                        href={`/dashboard/recetas/${params.id}/editar`}
                        className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        <Pencil className="h-4 w-4" /> Editar
                    </Link>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content - Ingredients */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                        <div className="border-b border-capsula-line px-6 py-4">
                            <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                                Ingredientes ({recipe.ingredients.length})
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-capsula-ivory-alt text-[11px] uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Ingrediente</th>
                                        <th className="px-6 py-3 font-semibold text-right">Cant. Neta</th>
                                        <th className="px-6 py-3 font-semibold text-right">Merma</th>
                                        <th className="px-6 py-3 font-semibold text-right">Cant. Bruta</th>
                                        {showCosts && (
                                            <>
                                                <th className="px-6 py-3 font-semibold text-right">Costo Unit.</th>
                                                <th className="px-6 py-3 font-semibold text-right">Total</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-capsula-line">
                                    {recipe.ingredients.map((ing) => {
                                        const grossQty = ing.quantity / (1 - ing.wastePercentage / 100);
                                        const totalIngCost = grossQty * ing.currentCost;

                                        return (
                                            <tr key={ing.id} className="hover:bg-capsula-ivory-surface">
                                                <td className="px-6 py-4 font-medium text-capsula-ink">
                                                    {ing.ingredientItem.name}
                                                </td>
                                                <td className="px-6 py-4 text-right text-capsula-ink-soft tabular-nums">
                                                    {formatNumber(ing.quantity)} {ing.unit}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums">
                                                    {ing.wastePercentage > 0 ? (
                                                        <span className="text-capsula-coral">
                                                            {ing.wastePercentage}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-capsula-ink-muted">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right text-capsula-ink-soft tabular-nums">
                                                    {formatNumber(grossQty, 3)} {ing.unit}
                                                </td>
                                                {showCosts && (
                                                    <>
                                                        <td className="px-6 py-4 text-right text-capsula-ink-soft tabular-nums">
                                                            {formatCurrency(ing.currentCost)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-capsula-ink tabular-nums">
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

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Production Info */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-6 shadow-sm">
                        <h3 className="mb-4 font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Detalles de Producción</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between border-b border-capsula-line pb-2">
                                <span className="text-sm text-capsula-ink-muted">Cantidad Base</span>
                                <span className="text-sm font-medium text-capsula-ink tabular-nums">
                                    {formatNumber(recipe.outputQuantity)} {recipe.outputUnit}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-capsula-line pb-2">
                                <span className="text-sm text-capsula-ink-muted">Rendimiento (Yield)</span>
                                <span className={cn(
                                    'text-sm font-medium tabular-nums',
                                    recipe.yieldPercentage < 100 ? 'text-[#946A1C] dark:text-[#E8D9B8]' : 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                )}>
                                    {recipe.yieldPercentage}%
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-capsula-line pb-2">
                                <span className="text-sm text-capsula-ink-muted">Producción Efectiva</span>
                                <span className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink tabular-nums">
                                    {formatNumber(effectiveOutput)} {recipe.outputUnit}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-capsula-ink-muted">Tiempo Total</span>
                                <span className="text-sm font-medium text-capsula-ink tabular-nums">
                                    {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Cost Summary */}
                    {showCosts && (
                        <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <Coins className="h-5 w-5 text-capsula-ink-soft" />
                                <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Análisis de Costos</h3>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Costo Unitario</p>
                                <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink tabular-nums">
                                    {formatCurrency(recipe.outputItem.currentCost)}
                                </p>
                                <p className="text-sm text-capsula-ink-muted">
                                    por {UNIT_INFO[recipe.outputUnit as keyof typeof UNIT_INFO]?.labelEs || recipe.outputUnit}
                                </p>
                            </div>

                            <div className="mt-6 space-y-3 border-t border-capsula-line pt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-capsula-ink-muted">Costo Total Lote:</span>
                                    <span className="font-medium text-capsula-ink tabular-nums">
                                        {formatCurrency(totalCost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl border border-[#D1DCE9] bg-[#E6ECF4] p-4 text-[#2A4060] dark:border-[#2a3a52] dark:bg-[#1A2636] dark:text-[#D1DCE9]">
                        <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed">
                                Los costos mostrados son calculados automáticamente basados en el precio actual de inventario (FIFO/Promedio) de cada ingrediente.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
