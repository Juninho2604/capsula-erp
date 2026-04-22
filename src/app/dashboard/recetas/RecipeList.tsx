'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, cn } from '@/lib/utils';
import { updateRecipeCostAction } from '@/app/actions/recipe.actions';
import { toast } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { RefreshCcw, Check, ChefHat, Utensils, ArrowRight, Soup, Beaker, Factory, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { LucideIcon } from 'lucide-react';

interface Recipe {
    id: string;
    name: string;
    description: string | null;
    type: string;
    category: string;
    baseUnit: string;
    costPerUnit: number;
    isApproved: boolean;
    createdBy: string;
}

interface RecipeListProps {
    recipes: Recipe[];
}

export default function RecipeList({ recipes }: RecipeListProps) {
    const { canViewCosts, user } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => { setShowCosts(canViewCosts()); }, [canViewCosts]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const handleCalculateCost = async (e: React.MouseEvent, recipe: Recipe) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) return;

        setUpdatingId(recipe.id);
        toast.loading('Calculando costos...', { id: 'cost-calc' });

        try {
            const result = await updateRecipeCostAction(recipe.id, user.id);

            if (result.success) {
                toast.success(result.message, { id: 'cost-calc' });
            } else {
                toast.error(result.message || 'Error al calcular costos', { id: 'cost-calc' });
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de conexión', { id: 'cost-calc' });
        } finally {
            setUpdatingId(null);
        }
    };

    // Group recipes by category
    const groupedRecipes = recipes.reduce((acc, recipe) => {
        const cat = recipe.category || 'Sin Categoría';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(recipe);
        return acc;
    }, {} as Record<string, Recipe[]>);

    const sortedCategories = Object.keys(groupedRecipes).sort();

    const getCategoryIcon = (category: string): LucideIcon => {
        if (category.includes('CREMA')) return Soup;
        if (category.includes('PANTRY')) return Beaker;
        if (category.includes('PRODUCCION')) return Factory;
        return FolderOpen;
    };

    return (
        <div className="space-y-8">
            {sortedCategories.map(category => {
                const CatIcon = getCategoryIcon(category);
                return (
                    <div key={category} className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-capsula-line pb-3">
                            <CatIcon className="h-5 w-5 text-capsula-ink-soft" strokeWidth={1.5} />
                            <h2 className="font-heading text-[18px] uppercase tracking-[0.08em] text-capsula-navy-deep">
                                {category}
                            </h2>
                            <span className="font-mono text-[12px] text-capsula-ink-muted">
                                ({groupedRecipes[category].length})
                            </span>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {groupedRecipes[category].map((recipe) => {
                                const TypeIcon = recipe.type === 'SUB_RECIPE' ? ChefHat : Utensils;
                                return (
                                    <div
                                        key={recipe.id}
                                        className="group rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-5 shadow-cap-soft transition-all hover:border-capsula-navy-deep/40 hover:shadow-md"
                                    >
                                        <div className="mb-4 flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt text-capsula-navy-deep">
                                                    <TypeIcon className="h-5 w-5" strokeWidth={1.5} />
                                                </div>
                                                <div>
                                                    <h3 className="font-heading text-[15px] text-capsula-navy-deep">
                                                        {recipe.name}
                                                    </h3>
                                                    <Badge variant={recipe.type === 'SUB_RECIPE' ? 'coral' : 'ok'}>
                                                        {recipe.type === 'SUB_RECIPE' ? 'Sub-receta' : 'Producto final'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            {recipe.isApproved && (
                                                <Badge variant="ok">
                                                    <Check className="h-3 w-3" strokeWidth={2} />
                                                    Aprobada
                                                </Badge>
                                            )}
                                        </div>

                                        {recipe.description && (
                                            <p className="mb-4 line-clamp-2 text-[13px] text-capsula-ink-soft">
                                                {recipe.description}
                                            </p>
                                        )}

                                        <div className="mb-4 grid grid-cols-2 gap-3">
                                            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt/50 p-2">
                                                <p className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Rinde</p>
                                                <p className="mt-0.5 font-mono text-[13px] text-capsula-ink">
                                                    1 {recipe.baseUnit}
                                                </p>
                                            </div>
                                            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt/50 p-2">
                                                <p className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Categoría</p>
                                                <p className="mt-0.5 text-[13px] text-capsula-ink">
                                                    {recipe.category}
                                                </p>
                                            </div>
                                        </div>

                                        {showCosts && (
                                            <div className="mb-4 rounded-[var(--radius)] border border-capsula-line bg-[#F3EAD6]/40 p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">
                                                        Costo unitario
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[16px] font-semibold text-capsula-navy-deep">
                                                            {formatCurrency(recipe.costPerUnit)}
                                                        </span>
                                                        <button
                                                            onClick={(e) => handleCalculateCost(e, recipe)}
                                                            disabled={updatingId === recipe.id}
                                                            className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-navy-deep disabled:opacity-50"
                                                            title="Recalcular costos"
                                                        >
                                                            <RefreshCcw className={cn('h-4 w-4', updatingId === recipe.id && 'animate-spin')} strokeWidth={1.5} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between border-t border-capsula-line pt-4">
                                            <p className="text-[11px] text-capsula-ink-muted">
                                                Por: <span className="text-capsula-ink-soft">{recipe.createdBy}</span>
                                            </p>
                                            <Link
                                                href={`/dashboard/recetas/${recipe.id}`}
                                                className="inline-flex items-center gap-1 text-[13px] font-medium text-capsula-navy-deep transition-colors hover:text-capsula-coral"
                                            >
                                                Ver detalles
                                                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
