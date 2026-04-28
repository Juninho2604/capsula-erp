import { Coins } from 'lucide-react';
import { getRecipesWithOutdatedCostAction } from '@/app/actions/recipe.actions';

// Server Component read-only que detecta recetas cuyo costo snapshot
// (CostHistory más reciente del outputItem) está desactualizado respecto
// al costo más reciente de algún ingrediente. Si todo está sincronizado,
// no renderiza nada.
//
// Cero writes a BD. La sugerencia operativa es que el usuario haga clic
// en "Recalcular costos" en cada card de receta afectada (RecipeList ya
// expone el botón).
export default async function OutdatedRecipeCostsBanner() {
    const summary = await getRecipesWithOutdatedCostAction({ limit: 10 });

    if (summary.count === 0) return null;

    return (
        <div className="rounded-xl border border-[#E8D9B8] bg-[#F3EAD6]/50 p-4 text-[#946A1C] dark:border-[#5a4a22] dark:bg-[#3B2F15]/50 dark:text-[#E8D9B8]">
            <div className="flex gap-3">
                <Coins className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                    <h3 className="font-semibold">
                        {summary.count} {summary.count === 1 ? 'receta tiene' : 'recetas tienen'} costo desactualizado
                    </h3>
                    <p className="mt-1 text-sm opacity-90">
                        {summary.outdated > 0 && (
                            <><strong>{summary.outdated}</strong> con snapshot anterior al último cambio de costo de un ingrediente. </>
                        )}
                        {summary.withoutSnapshot > 0 && (
                            <><strong>{summary.withoutSnapshot}</strong> sin snapshot de costo. </>
                        )}
                        El margen y el descargo pueden estar usando valores históricos. Usa <strong>Recalcular costos</strong> en cada card afectada.
                    </p>
                    {summary.top.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                            {summary.top.slice(0, 5).map(r => (
                                <li key={r.id}>
                                    <span className="font-mono">{r.outputSku}</span> — {r.name}
                                    {r.driftDays !== null && (
                                        <em className="opacity-70">
                                            {' '}(desfase de {r.driftDays} {r.driftDays === 1 ? 'día' : 'días'} vs ingrediente <em>&quot;{r.latestIngredientName}&quot;</em>)
                                        </em>
                                    )}
                                    {r.kind === 'NO_SNAPSHOT' && (
                                        <em className="opacity-70"> (sin snapshot de costo)</em>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
