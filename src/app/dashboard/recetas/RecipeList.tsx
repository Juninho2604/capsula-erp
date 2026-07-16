'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, cn } from '@/lib/utils';
import { fuzzySearch } from '@/lib/fuzzy-search';
import { updateRecipeCostAction, deleteRecipeAction } from '@/app/actions/recipe.actions';
import { toast } from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import {
    RefreshCcw,
    ClipboardList,
    Layers,
    UtensilsCrossed,
    Check,
    Search,
    Pencil,
    Trash2,
    Loader2,
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
    /**
     * §120: fija la lista a un solo tipo (oculta el toggle Todas/Sub/Productos).
     * Usado por la pestaña "Sub-recetas" del módulo Producción.
     */
    lockedType?: 'SUB_RECIPE' | 'FINISHED_GOOD';
}

import type { UserRole } from '@/types';

const DELETE_ROLES: UserRole[] = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF'];

export default function RecipeList({ recipes, lockedType }: RecipeListProps) {
    const router = useRouter();
    const { canViewCosts, hasRole, user } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    const [canDelete, setCanDelete] = useState(false);
    useEffect(() => {
        setShowCosts(canViewCosts());
        setCanDelete(hasRole(DELETE_ROLES));
    }, [canViewCosts, hasRole]);

    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    // §120: por defecto la lista abre en "Productos" (recetas del menú) — las
    // sub-recetas viven en Producción → Sub-recetas. El toggle sigue
    // permitiendo ver Todas/Sub-recetas cuando no hay lockedType.
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'SUB_RECIPE' | 'FINISHED_GOOD'>(lockedType ?? 'FINISHED_GOOD');

    const uniqueCategories = useMemo(() => {
        const cats = new Set(recipes.map(r => r.category || 'Sin Categoría'));
        return Array.from(cats).sort();
    }, [recipes]);

    const filteredRecipes = useMemo(() => {
        let items = recipes.filter(r => {
            if (categoryFilter !== 'ALL' && (r.category || 'Sin Categoría') !== categoryFilter) return false;
            if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
            return true;
        });
        if (searchQuery.trim()) {
            items = fuzzySearch(items, searchQuery, { keys: ['name', 'category', 'baseUnit'] });
        }
        return items;
    }, [recipes, searchQuery, categoryFilter, typeFilter]);

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

    const handleDelete = async (e: React.MouseEvent, recipe: Recipe) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`¿Eliminar la receta "${recipe.name}"?\n\nEs reversible desde la base de datos, pero los productos del menú que la usen dejarán de descontar inventario.`)) return;

        setDeletingId(recipe.id);
        try {
            const result = await deleteRecipeAction(recipe.id);
            if (result.success) {
                toast.success(result.message, { duration: 6000 });
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar la receta');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar receta por nombre, categoría o unidad..."
                        className="pos-input w-full pl-10"
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="pos-input sm:w-56"
                >
                    <option value="ALL">Todas las categorías</option>
                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {/* §112: división visible sub-recetas / productos (antes era un
                    select discreto que pasaba desapercibido). §120: oculto si
                    la lista está fijada a un tipo (pestaña Sub-recetas). */}
                {!lockedType && (
                <div className="flex rounded-xl border border-capsula-line overflow-hidden text-xs font-semibold shrink-0">
                    {([
                        { value: 'ALL', label: `Todas (${recipes.length})` },
                        { value: 'SUB_RECIPE', label: `Sub-recetas (${recipes.filter(r => r.type === 'SUB_RECIPE').length})` },
                        { value: 'FINISHED_GOOD', label: `Productos (${recipes.filter(r => r.type === 'FINISHED_GOOD').length})` },
                    ] as const).map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setTypeFilter(opt.value)}
                            className={`px-3 py-2 transition-colors ${
                                typeFilter === opt.value
                                    ? 'bg-capsula-navy-deep text-capsula-cream'
                                    : 'bg-capsula-ivory-surface text-capsula-ink-muted hover:bg-capsula-ivory-alt'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                )}
                <span className="text-sm text-capsula-ink-muted tabular-nums shrink-0">
                    {filteredRecipes.length} de {recipes.length}
                </span>
            </div>

            {/* Tabla */}
            <div className="overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="w-full relative">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            <tr className="border-b border-capsula-line bg-capsula-ivory-alt">
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Receta
                                </th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Categoría
                                </th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Rinde
                                </th>
                                {showCosts && (
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                        Costo/Unidad
                                    </th>
                                )}
                                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Estado
                                </th>
                                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-capsula-line">
                            {filteredRecipes.map((recipe) => {
                                const TypeIcon = recipe.type === 'SUB_RECIPE' ? Layers : UtensilsCrossed;
                                const typeLabel = recipe.type === 'SUB_RECIPE' ? 'Sub-receta' : 'Producto Final';
                                return (
                                    <tr
                                        key={recipe.id}
                                        onClick={() => router.push(`/dashboard/recetas/${recipe.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-capsula-ivory-surface"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-capsula-ivory-alt text-capsula-ink-soft">
                                                    <TypeIcon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-capsula-ink truncate">{recipe.name}</p>
                                                    <p className="text-xs text-capsula-ink-muted">{typeLabel}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-capsula-ink-muted">
                                            {recipe.category || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-mono text-sm tabular-nums text-capsula-ink">
                                                {recipe.outputQuantity && recipe.outputQuantity > 0 ? recipe.outputQuantity : 1}
                                            </span>
                                            <span className="ml-1 text-xs text-capsula-ink-muted">
                                                {recipe.outputUnit ?? recipe.baseUnit}
                                            </span>
                                        </td>
                                        {showCosts && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <span className="font-mono text-sm font-semibold tabular-nums text-capsula-ink">
                                                        {formatCurrency(recipe.costPerUnit)}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleCalculateCost(e, recipe)}
                                                        disabled={updatingId === recipe.id}
                                                        className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink disabled:opacity-50"
                                                        title="Recalcular costo"
                                                    >
                                                        <RefreshCcw className={cn('h-3.5 w-3.5', updatingId === recipe.id && 'animate-spin')} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-center">
                                            {recipe.isApproved ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E5EDE7] px-2 py-0.5 text-xs font-medium text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]">
                                                    <Check className="h-3 w-3" /> Aprobada
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-capsula-ivory-alt px-2 py-0.5 text-xs font-medium text-capsula-ink-muted">
                                                    Borrador
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="inline-flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/dashboard/recetas/${recipe.id}`); }}
                                                    className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                                    title="Editar receta"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        onClick={(e) => handleDelete(e, recipe)}
                                                        disabled={deletingId === recipe.id}
                                                        className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral disabled:opacity-50"
                                                        title="Eliminar receta"
                                                    >
                                                        {deletingId === recipe.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredRecipes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ClipboardList className="mx-auto h-10 w-10 text-capsula-ink-faint" />
                        <p className="mt-2 font-medium text-capsula-ink">
                            {searchQuery.trim() ? `Ninguna receta coincide con "${searchQuery}"` : 'No hay recetas'}
                        </p>
                        <p className="text-sm text-capsula-ink-muted">
                            {searchQuery.trim() ? 'Prueba con otro nombre o limpia el filtro' : 'Crea la primera desde "Nueva receta"'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
