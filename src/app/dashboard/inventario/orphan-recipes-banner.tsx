import Link from 'next/link';
import { AlertTriangle, ArrowRight, Layers } from 'lucide-react';
import { getOrphanRecipesSummaryAction } from '@/app/actions/recipe.actions';

// Banner gerencial: telemetría read-only que detecta MenuItems con recipeId
// roto (FK fantasma) o apuntando a recetas archivadas, además de recetas
// activas sin uso. Cero writes a BD.
//
// Server Component. Si los tres counts son 0, no renderiza nada.
//
// Útil como complemento del PendingDeductionBanner: muchos descargos
// pendientes vienen de MenuItem.recipeId roto, así que ver ambos juntos
// orienta a la causa raíz.
export default async function OrphanRecipesBanner() {
    const summary = await getOrphanRecipesSummaryAction({ recentLimit: 3 });

    const total = summary.menuItemsToGhostRecipe + summary.menuItemsToInactiveRecipe;
    if (total === 0 && summary.recipesUnused === 0) return null;

    // Si hay menuItems con problemas, tono warn (warn = naranja). Si solo
    // hay recetas inactivas no usadas, tono info (no es bloqueante).
    const tone = total > 0
        ? 'border-[#E8D9B8] bg-[#F3EAD6]/50 text-[#946A1C] dark:border-[#5a4a22] dark:bg-[#3B2F15]/50 dark:text-[#E8D9B8]'
        : 'border-[#D1DCE9] bg-[#E6ECF4] text-[#2A4060] dark:border-[#2a3a52] dark:bg-[#1A2636] dark:text-[#D1DCE9]';

    const Icon = total > 0 ? AlertTriangle : Layers;

    return (
        <div className={`rounded-xl border p-4 ${tone}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <h3 className="font-semibold">
                            {total > 0
                                ? `${total} ${total === 1 ? 'plato del menú' : 'platos del menú'} con receta rota`
                                : `${summary.recipesUnused} ${summary.recipesUnused === 1 ? 'receta activa sin usar' : 'recetas activas sin usar'}`}
                        </h3>
                        <p className="mt-1 text-sm opacity-90">
                            {summary.menuItemsToGhostRecipe > 0 && (
                                <>
                                    <strong>{summary.menuItemsToGhostRecipe}</strong> con <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs font-mono dark:bg-white/10">recipeId</code> apuntando a recetas que ya no existen
                                    {(summary.menuItemsToInactiveRecipe > 0 || summary.recipesUnused > 0) && '. '}
                                </>
                            )}
                            {summary.menuItemsToInactiveRecipe > 0 && (
                                <>
                                    <strong>{summary.menuItemsToInactiveRecipe}</strong> con receta archivada (<code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs font-mono dark:bg-white/10">isActive=false</code>)
                                    {summary.recipesUnused > 0 && '. '}
                                </>
                            )}
                            {summary.recipesUnused > 0 && (
                                <>
                                    <strong>{summary.recipesUnused}</strong> {summary.recipesUnused === 1 ? 'receta activa' : 'recetas activas'} sin ningún plato que las referencie
                                </>
                            )}
                            .
                        </p>
                        {(summary.recentGhosts.length > 0 || summary.recentInactive.length > 0) && (
                            <ul className="mt-2 space-y-0.5 text-xs">
                                {summary.recentGhosts.slice(0, 3).map(m => (
                                    <li key={m.id}>
                                        <span className="font-mono">{m.sku}</span> — {m.name} <em className="opacity-70">(receta inexistente)</em>
                                    </li>
                                ))}
                                {summary.recentInactive.slice(0, 3).map(m => (
                                    <li key={m.id}>
                                        <span className="font-mono">{m.sku}</span> — {m.name} <em className="opacity-70">(receta archivada{m.recipeName ? `: "${m.recipeName}"` : ''})</em>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                <Link
                    href="/dashboard/recetas"
                    className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-current/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                >
                    Ir a Recetas <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}
