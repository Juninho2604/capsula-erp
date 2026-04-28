'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, cn } from '@/lib/utils';
import { fuzzySearch } from '@/lib/fuzzy-search';
import { updateRecipeCostAction } from '@/app/actions/recipe.actions';
import { toast } from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import {
    RefreshCcw,
    Soup,
    Container,
    Factory,
    ClipboardList,
    Layers,
    UtensilsCrossed,
    Check,
    ArrowRight,
    Search,
} from 'lucide-react';

interface Recipe {
    id: string;
    name: string;
    description: string | null;
    type: string;
    category: string;
    baseUnit: string;
    outputQuantity?: number;
    outputUnit?: string;
    costPerUnit: number;
    costPerServing?: number;
    isApproved: boolean;
    createdBy: string;
}

interface RecipeListProps {
    recipes: Recipe[];
}

function categoryIcon(category: string) {
    if (category.includes('CREMA')) return Soup;
    if (category.includes('PANTRY')) return Container;
    if (category.includes('PRODUCCION')) return Factory;
    return ClipboardList;
}

export default function RecipeList({ recipes }: RecipeListProps) {
    const { canViewCosts, user } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => { setShowCosts(canViewCosts()); }, [canViewCosts]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Búsqueda fuzzy sobre nombre, categoría y unidad — tolerante a typos
    // y diacríticos. Si la query es vacía, devuelve todas las recetas.
    const filteredRecipes = useMemo(
        () => fuzzySearch(recipes, searchQuery, { keys: ['name', 'category', 'baseUnit'] }),
        [recipes, searchQuery],
    );

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

    const groupedRecipes = filteredRecipes.reduce((acc, recipe) => {
        const cat = recipe.category || 'Sin Categoría';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(recipe);
        return acc;
    }, {} as Record<string, Recipe[]>);

    const sortedCategories = Object.keys(groupedRecipes).sort();

    return (
        <div className="space-y-6">
            {/* Búsqueda fuzzy sobre nombre, categoría o unidad */}
            <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar receta por nombre, categoría o unidad..."
                    className="pos-input w-full pl-10"
                />
            </div>

            {/* Empty state cuando hay query y nada coincide */}
            {searchQuery.trim() && filteredRecipes.length === 0 && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory py-12 text-center">
                    <ClipboardList className="mx-auto h-10 w-10 text-capsula-ink-faint" />
                    <p className="mt-2 font-medium text-capsula-ink">
                        Ninguna receta coincide con &quot;{searchQuery}&quot;
                    </p>
                    <p className="text-sm text-capsula-ink-muted">
                        Prueba con otro nombre o limpia el filtro
                    </p>
                </div>
            )}

            {sortedCategories.map(category => {
                const CategoryIcon = categoryIcon(category);
                return (
                    <div key={category} className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-capsula-line pb-2">
                            <CategoryIcon className="h-5 w-5 text-capsula-ink-soft" />
                            <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">{category}</h2>
                            <span className="text-sm text-capsula-ink-muted tabular-nums">
                                ({groupedRecipes[category].length})
                            </span>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {groupedRecipes[category].map((recipe) => {
                                const TypeIcon = recipe.type === 'SUB_RECIPE' ? Layers : UtensilsCrossed;
                                const typeLabel = recipe.type === 'SUB_RECIPE' ? 'Sub-receta' : 'Producto Final';
                                return (
                                    <div
                                        key={recipe.id}
                                        className="group rounded-xl border border-capsula-line bg-capsula-ivory p-5 shadow-sm transition-all hover:border-capsula-line-strong hover:shadow-md"
                                    >
                                        {/* Header */}
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-capsula-ivory-alt text-capsula-ink-soft">
                                                    <TypeIcon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">{recipe.name}</h3>
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-xs font-medium text-capsula-ink-soft">
                                                        <TypeIcon className="h-3 w-3" />
                                                        {typeLabel}
                                                    </span>
                                                </div>
                                            </div>
                                            {recipe.isApproved && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E5EDE7] px-2 py-1 text-xs font-medium text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]">
                                                    <Check className="h-3 w-3" /> Aprobada
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        {recipe.description && (
                                            <p className="mb-4 line-clamp-2 text-sm text-capsula-ink-muted">
                                                {recipe.description}
                                            </p>
                                        )}

                                        {/* Details */}
                                        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-lg bg-capsula-ivory-alt p-2">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Rinde</p>
                                                <p className="font-medium text-capsula-ink tabular-nums">
                                                    1 {recipe.baseUnit}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-capsula-ivory-alt p-2">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Categoría</p>
                                                <p className="font-medium text-capsula-ink truncate">
                                                    {recipe.category}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Cost (if visible) */}
                                        {showCosts && (
                                            <div className="mb-4 rounded-lg bg-capsula-navy-soft p-3 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-capsula-ink-soft">
                                                        Costo unitario:
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-lg font-semibold tabular-nums text-capsula-ink">
                                                            {formatCurrency(recipe.costPerUnit)}
                                                        </span>
                                                        <button
                                                            onClick={(e) => handleCalculateCost(e, recipe)}
                                                            disabled={updatingId === recipe.id}
                                                            className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory hover:text-capsula-ink disabled:opacity-50"
                                                            title="Recalcular costos"
                                                        >
                                                            <RefreshCcw className={cn("h-4 w-4", updatingId === recipe.id && "animate-spin")} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* costPerServing: solo visible cuando rinde > 1 unidad y es distinto del costPerUnit */}
                                                {recipe.outputQuantity && recipe.outputQuantity > 1 && recipe.costPerServing != null && (
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-capsula-ink-muted">
                                                            Por {recipe.outputUnit ?? recipe.baseUnit} (rinde {recipe.outputQuantity}):
                                                        </span>
                                                        <span className="font-mono tabular-nums text-capsula-ink-soft">
                                                            {formatCurrency(recipe.costPerServing)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between border-t border-capsula-line pt-4">
                                            <p className="text-xs text-capsula-ink-muted">
                                                Por: {recipe.createdBy}
                                            </p>
                                            <Link
                                                href={`/dashboard/recetas/${recipe.id}`}
                                                className="inline-flex items-center gap-1 text-sm font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
                                            >
                                                Ver detalles <ArrowRight className="h-3.5 w-3.5" />
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
