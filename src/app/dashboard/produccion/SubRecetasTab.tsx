'use client';

/**
 * §120 — Pestaña "Sub-recetas" del módulo Producción.
 *
 * Pedido del gerente general: las sub-recetas (salsas, masas, aderezos…) se
 * gestionan aquí — el mismo módulo donde luego se producen — y las recetas de
 * platos del menú viven en Catálogo/Recetas. Reutiliza RecipeList fijada a
 * SUB_RECIPE (lockedType) para no duplicar UI ni lógica.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Loader2, Plus } from 'lucide-react';
import { getRecipesAction } from '@/app/actions/recipe.actions';
import RecipeList from '@/app/dashboard/recetas/RecipeList';

type RecipeRow = Awaited<ReturnType<typeof getRecipesAction>>[number];

export default function SubRecetasTab() {
    const [recipes, setRecipes] = useState<RecipeRow[] | null>(null);

    useEffect(() => {
        let alive = true;
        getRecipesAction()
            .then((all) => { if (alive) setRecipes(all.filter(r => r.type === 'SUB_RECIPE')); })
            .catch(() => { if (alive) setRecipes([]); });
        return () => { alive = false; };
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink inline-flex items-center gap-2">
                        <Layers className="h-5 w-5 text-capsula-ink-soft" />
                        Sub-recetas
                    </h2>
                    <p className="text-sm text-capsula-ink-muted">
                        Salsas, masas, aderezos y preparaciones intermedias. Las recetas de platos del menú se gestionan desde Catálogo → Menú.
                    </p>
                </div>
                <Link
                    href="/dashboard/recetas/nueva?tipo=SUB_RECIPE"
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm shrink-0"
                >
                    <Plus className="h-4 w-4" /> Nueva sub-receta
                </Link>
            </div>

            {recipes === null ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory py-12 text-capsula-ink-muted">
                    <Loader2 className="h-5 w-5 animate-spin" /> Cargando sub-recetas…
                </div>
            ) : (
                <RecipeList recipes={recipes} lockedType="SUB_RECIPE" />
            )}
        </div>
    );
}
