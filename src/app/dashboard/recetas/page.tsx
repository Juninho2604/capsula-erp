
import Link from 'next/link';
import { AlertTriangle, ClipboardList, Plus } from 'lucide-react';
import { getRecipesAction } from '@/app/actions/recipe.actions';
import { getMenuItemsWithoutRecipeAction } from '@/app/actions/menu.actions';
import RecipeList from './RecipeList';
import MissingRecipesPanel from './MissingRecipesPanel';
import OutdatedRecipeCostsBanner from './outdated-recipe-costs-banner';

export const dynamic = 'force-dynamic';

export default async function RecetasPage() {
    const [allRecipes, missingResult] = await Promise.all([
        getRecipesAction(),
        getMenuItemsWithoutRecipeAction(),
    ]);

    const missingItems = missingResult.data ?? [];

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Recetas</h1>
                    <p className="text-capsula-ink-muted">
                        {allRecipes.length} recetas disponibles
                        {missingItems.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#F3EAD6] px-2 py-0.5 text-xs font-medium text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                                <AlertTriangle className="h-3 w-3" /> {missingItems.length} platos sin receta
                            </span>
                        )}
                    </p>
                </div>
                <Link
                    href="/dashboard/recetas/nueva"
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                >
                    <Plus className="h-4 w-4" /> Nueva Receta
                </Link>
            </div>

            {/* Banner read-only: recetas con costo desactualizado vs ingredientes */}
            <OutdatedRecipeCostsBanner />

            {/* Platos del Menú sin Receta */}
            {missingItems.length > 0 && (
                <MissingRecipesPanel items={missingItems} />
            )}

            {/* Recipe List Component */}
            {allRecipes.length > 0 ? (
                <RecipeList recipes={allRecipes} />
            ) : (
                /* Empty State */
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-capsula-line bg-capsula-ivory py-16 text-center">
                    <ClipboardList className="h-10 w-10 text-capsula-ink-faint" />
                    <h3 className="mt-4 font-semibold text-lg tracking-[-0.01em] text-capsula-ink">No hay recetas</h3>
                    <p className="mt-1 text-capsula-ink-muted">
                        Comienza creando tu primera receta para calcular sus costos
                    </p>
                    <Link
                        href="/dashboard/recetas/nueva"
                        className="pos-btn mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        <Plus className="h-4 w-4" /> Crear Receta
                    </Link>
                </div>
            )}
        </div>
    );
}
