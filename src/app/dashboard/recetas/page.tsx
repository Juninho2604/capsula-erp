import Link from 'next/link';
import { getRecipesAction } from '@/app/actions/recipe.actions';
import { getMenuItemsWithoutRecipeAction } from '@/app/actions/menu.actions';
import { AlertTriangle, BookOpen, Plus } from 'lucide-react';
import RecipeList from './RecipeList';
import MissingRecipesPanel from './MissingRecipesPanel';

export const dynamic = 'force-dynamic';

export default async function RecetasPage() {
    const [allRecipes, missingResult] = await Promise.all([
        getRecipesAction(),
        getMenuItemsWithoutRecipeAction(),
    ]);

    const missingItems = missingResult.data ?? [];

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 border-b border-capsula-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                        <BookOpen className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Catálogo</div>
                        <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Recetas</h1>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-capsula-ink-soft">
                            <span>{allRecipes.length} recetas disponibles</span>
                            {missingItems.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-capsula-coral/40 bg-capsula-coral/10 px-2 py-0.5 text-[11px] font-medium text-capsula-coral">
                                    <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                                    {missingItems.length} platos sin receta
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard/recetas/nueva"
                    className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-capsula-navy-deep px-4 py-2.5 text-[13px] font-medium text-capsula-ivory-surface shadow-cap-soft transition-colors hover:bg-capsula-navy-ink"
                >
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                    Nueva receta
                </Link>
            </div>

            {missingItems.length > 0 && (
                <MissingRecipesPanel items={missingItems} />
            )}

            {allRecipes.length > 0 ? (
                <RecipeList recipes={allRecipes} />
            ) : (
                <div className="flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-capsula-line py-16 text-center">
                    <BookOpen className="h-12 w-12 text-capsula-ink-muted/50" strokeWidth={1.25} />
                    <h3 className="mt-4 font-heading text-[18px] text-capsula-navy-deep">No hay recetas</h3>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">Comienza creando tu primera receta para calcular sus costos.</p>
                    <Link
                        href="/dashboard/recetas/nueva"
                        className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-capsula-navy-deep px-4 py-2 text-[13px] font-medium text-capsula-ivory-surface transition-colors hover:bg-capsula-navy-ink"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        Crear receta
                    </Link>
                </div>
            )}
        </div>
    );
}
