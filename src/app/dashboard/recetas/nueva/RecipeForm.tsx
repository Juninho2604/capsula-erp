'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { UnitOfMeasure } from '@/types';
import { UNIT_INFO } from '@/lib/constants/units';
import { createRecipeAction, updateRecipeAction } from '@/app/actions/recipe.actions';
import { createQuickItem } from '@/app/actions/inventory.actions';
import { toast } from 'react-hot-toast';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import {
    ArrowLeft, Plus, Trash2, FilePlus2, X, Check, Loader2,
    ClipboardList, Coins, Save, Lock, Soup, Beaker, Factory, Utensils, FolderOpen, Package, ChefHat,
} from 'lucide-react';

interface IngredientOption {
    id: string;
    name: string;
    type: string;
    baseUnit: string;
    currentCost: number;
}

interface RecipeFormProps {
    availableIngredients: IngredientOption[];
    initialData?: any;
}

interface DraftIngredient {
    id: string;
    inventoryItemId: string;
    quantity: number;
    unit: UnitOfMeasure;
    wastePercentage: number;
    notes: string;
}

const UNITS: { value: UnitOfMeasure; label: string }[] = [
    { value: 'KG', label: 'Kilogramos' },
    { value: 'G', label: 'Gramos' },
    { value: 'L', label: 'Litros' },
    { value: 'ML', label: 'Mililitros' },
    { value: 'UNIT', label: 'Unidades' },
    { value: 'PORTION', label: 'Porciones' },
];

export default function RecipeForm({ availableIngredients, initialData }: RecipeFormProps) {
    const router = useRouter();
    const { user, canViewCosts } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => { setShowCosts(canViewCosts()); }, [canViewCosts]);

    // Estados del formulario
    const [recipeName, setRecipeName] = useState(initialData?.name || '');
    const [category, setCategory] = useState<string>(initialData?.category || 'RECETAS PRODUCCION');
    const [description, setDescription] = useState(initialData?.description || '');
    const [type, setType] = useState<'SUB_RECIPE' | 'FINISHED_GOOD'>(
        initialData?.outputItem?.type === 'FINISHED_GOOD' ? 'FINISHED_GOOD' : 'SUB_RECIPE'
    );
    const [outputQuantity, setOutputQuantity] = useState<number>(initialData?.outputQuantity || 1);
    const [outputUnit, setOutputUnit] = useState<UnitOfMeasure>(initialData?.outputUnit || 'KG');
    const [yieldPercentage, setYieldPercentage] = useState<number>(initialData?.yieldPercentage || 100);
    const [prepTime, setPrepTime] = useState<number>(initialData?.prepTime || 0);
    const [cookTime, setCookTime] = useState<number>(initialData?.cookTime || 0);

    // Submitting state
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Lista local de ingredientes disponibles (incluye nuevos creados on-the-fly)
    const [localIngredients, setLocalIngredients] = useState<IngredientOption[]>(availableIngredients);

    // Ingredientes
    const [ingredients, setIngredients] = useState<DraftIngredient[]>(
        initialData?.ingredients?.map((ing: any) => ({
            id: ing.id || `temp-${Math.random()}`,
            inventoryItemId: ing.ingredientItemId,
            quantity: ing.quantity,
            unit: ing.unit,
            wastePercentage: ing.wastePercentage,
            notes: ing.notes || ''
        })) || []
    );
    const [showAddIngredient, setShowAddIngredient] = useState(false);

    // Estado para nuevo ingrediente
    const [newIngredient, setNewIngredient] = useState<Partial<DraftIngredient>>({
        inventoryItemId: '',
        quantity: 0,
        unit: 'KG',
        wastePercentage: 0,
        notes: '',
    });

    // Estado para crear insumo nuevo
    const [showCreateItem, setShowCreateItem] = useState(false);
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemUnit, setNewItemUnit] = useState<string>('KG');
    const [newItemType, setNewItemType] = useState<string>('RAW_MATERIAL');
    const [newItemCost, setNewItemCost] = useState<number>(0);

    // Filtrar items disponibles (no agregar el mismo dos veces)
    const availableOptions = useMemo(() => {
        const usedIds = new Set(ingredients.map(i => i.inventoryItemId));
        return localIngredients.filter(item => !usedIds.has(item.id));
    }, [ingredients, localIngredients]);

    // Calcular costos de todos los ingredientes (Preview en vivo)
    const ingredientCosts = useMemo(() => {
        return ingredients.map(ing => {
            const item = localIngredients.find(i => i.id === ing.inventoryItemId);

            // Simple cost estimation assuming units match base unit or 1:1 for now
            // In a real app we'd need client-side unit conversion or fetch conversion rates
            // For now, let's assume if baseUnit != unit, we might be off unless it matches

            let quantityInBase = ing.quantity;
            // Very naive conversion for demo if units differ
            if (ing.unit === 'G' && item?.baseUnit === 'KG') quantityInBase = ing.quantity / 1000;
            if (ing.unit === 'ML' && item?.baseUnit === 'L') quantityInBase = ing.quantity / 1000;

            const unitCost = item?.currentCost || 0;
            const grossQuantity = ing.quantity / (1 - ing.wastePercentage / 100);
            const grossQuantityBase = quantityInBase / (1 - ing.wastePercentage / 100);

            const totalCost = grossQuantityBase * unitCost;

            return {
                ...ing,
                itemName: item?.name || 'Unknown',
                itemType: item?.type,
                unitCost,
                totalCost,
                grossQuantity
            };
        });
    }, [ingredients, availableIngredients]);

    // Totales
    const totalIngredientsCost = useMemo(() => {
        return ingredientCosts.reduce((sum, ing) => sum + ing.totalCost, 0);
    }, [ingredientCosts]);

    const effectiveOutput = outputQuantity * (yieldPercentage / 100);
    const costPerUnit = effectiveOutput > 0 ? totalIngredientsCost / effectiveOutput : 0;

    // Agregar ingrediente
    const addIngredient = () => {
        if (!newIngredient.inventoryItemId || !newIngredient.quantity) return;

        const newIng: DraftIngredient = {
            id: `temp-${Date.now()}`,
            inventoryItemId: newIngredient.inventoryItemId,
            quantity: newIngredient.quantity || 0,
            unit: newIngredient.unit || 'KG',
            wastePercentage: newIngredient.wastePercentage || 0,
            notes: newIngredient.notes || '',
        };

        setIngredients([...ingredients, newIng]);
        setNewIngredient({ inventoryItemId: '', quantity: 0, unit: 'KG', wastePercentage: 0, notes: '' });
        setShowAddIngredient(false);
    };

    // Crear insumo nuevo on-the-fly
    const handleCreateItem = async () => {
        if (!newItemName.trim() || !user) return;
        setIsCreatingItem(true);
        try {
            const result = await createQuickItem({
                name: newItemName.trim(),
                unit: newItemUnit,
                type: newItemType,
                userId: user.id,
                cost: newItemCost > 0 ? newItemCost : undefined,
            });
            if (result.success && result.item) {
                // Agregar a la lista local de ingredientes
                const newOption: IngredientOption = {
                    id: result.item.id,
                    name: result.item.name,
                    type: result.item.type,
                    baseUnit: result.item.baseUnit,
                    currentCost: newItemCost || 0,
                };
                setLocalIngredients(prev => [...prev, newOption].sort((a, b) => a.name.localeCompare(b.name)));
                // Pre-seleccionar en el dropdown
                setNewIngredient(prev => ({
                    ...prev,
                    inventoryItemId: result.item!.id,
                    unit: result.item!.baseUnit as UnitOfMeasure,
                }));
                toast.success(`Insumo "${newItemName}" creado exitosamente`);
                // Resetear
                setNewItemName('');
                setNewItemUnit('KG');
                setNewItemType('RAW_MATERIAL');
                setNewItemCost(0);
                setShowCreateItem(false);
            } else {
                toast.error(result.message || 'Error al crear el insumo');
            }
        } catch (error) {
            toast.error('Error al crear el insumo');
        } finally {
            setIsCreatingItem(false);
        }
    };

    // Eliminar ingrediente
    const removeIngredient = (id: string) => {
        setIngredients(ingredients.filter(ing => ing.id !== id));
    };

    const handleSubmit = async () => {
        if (!user) return;

        try {
            setIsSubmitting(true);

            const payload = {
                name: recipeName,
                category,
                description,
                type,
                outputQuantity,
                outputUnit,
                yieldPercentage,
                prepTime,
                cookTime,
                userId: user.id,
                ingredients: ingredients.map(ing => ({
                    itemId: ing.inventoryItemId,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    wastePercentage: ing.wastePercentage,
                    notes: ing.notes
                }))
            };

            let result;
            if (initialData) {
                result = await updateRecipeAction({ ...payload, id: initialData.id });
            } else {
                result = await createRecipeAction(payload);
            }

            if (result.success) {
                toast.success(initialData ? 'Receta actualizada' : 'Receta creada con éxito');
                router.push(initialData ? `/dashboard/recetas/${initialData.id}` : '/dashboard/recetas');
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error('Error al guardar receta');
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';
    const inputClass = 'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none';

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-4 border-b border-capsula-line pb-6">
                <Link
                    href="/dashboard/recetas"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                </Link>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Catálogo</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                        {initialData ? 'Editar receta' : 'Nueva receta'}
                    </h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        {initialData ? `Editando: ${initialData.name}` : `Creando como: ${user?.firstName}`}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                        <h2 className="mb-4 font-heading text-[16px] text-capsula-navy-deep">
                            Información básica
                        </h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className={labelClass}>Nombre de la receta *</label>
                                <input
                                    type="text"
                                    value={recipeName}
                                    onChange={(e) => setRecipeName(e.target.value)}
                                    placeholder="Ej: Salsa de ajo de la casa"
                                    className={inputClass}
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className={labelClass}>Categoría</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="RECETAS CREMAS">Cremas</option>
                                    <option value="RECETAS PANTRY">Pantry</option>
                                    <option value="RECETAS PRODUCCION">Producción</option>
                                    <option value="ARMADO EN SERVICIO">Armado en servicio</option>
                                    <option value="GENERAL">General / Otros</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label className={labelClass}>Tipo de producción</label>
                                <div className="flex gap-4">
                                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-capsula-ink">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="SUB_RECIPE"
                                            checked={type === 'SUB_RECIPE'}
                                            onChange={() => setType('SUB_RECIPE')}
                                            className="text-capsula-navy-deep focus:ring-capsula-navy-deep"
                                        />
                                        Sub-receta (intermedio)
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-capsula-ink">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="FINISHED_GOOD"
                                            checked={type === 'FINISHED_GOOD'}
                                            onChange={() => setType('FINISHED_GOOD')}
                                            className="text-capsula-navy-deep focus:ring-capsula-navy-deep"
                                        />
                                        Producto final (venta)
                                    </label>
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className={labelClass}>Descripción</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Instrucciones breves o descripción…"
                                    rows={2}
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Cantidad producida *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={outputQuantity}
                                        onChange={(e) => setOutputQuantity(parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.1"
                                        className="w-24 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 font-mono text-[14px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                    />
                                    <select
                                        value={outputUnit}
                                        onChange={(e) => setOutputUnit(e.target.value as UnitOfMeasure)}
                                        className={`flex-1 ${inputClass}`}
                                    >
                                        {UNITS.map(u => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Rendimiento (yield) %</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={yieldPercentage}
                                        onChange={(e) => setYieldPercentage(parseFloat(e.target.value) || 100)}
                                        min="1"
                                        max="100"
                                        className={`${inputClass} pr-10 font-mono`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-capsula-ink-muted">%</span>
                                </div>
                                <p className="mt-1 text-[11px] text-capsula-ink-muted">
                                    Real: <span className="font-mono">{formatNumber(effectiveOutput)}</span> {outputUnit}
                                </p>
                            </div>

                            <div>
                                <label className={labelClass}>Tiempo prep. (min)</label>
                                <input
                                    type="number"
                                    value={prepTime}
                                    onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
                                    min="0"
                                    className={`${inputClass} font-mono`}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Tiempo cocción (min)</label>
                                <input
                                    type="number"
                                    value={cookTime}
                                    onChange={(e) => setCookTime(parseInt(e.target.value) || 0)}
                                    min="0"
                                    className={`${inputClass} font-mono`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                        <div className="flex items-center justify-between border-b border-capsula-line px-6 py-4">
                            <div>
                                <h2 className="font-heading text-[16px] text-capsula-navy-deep">Ingredientes</h2>
                                <p className="text-[12px] text-capsula-ink-muted">
                                    <span className="font-mono">{ingredients.length}</span> ítems
                                </p>
                            </div>
                            <Button variant="primary" size="sm" onClick={() => setShowAddIngredient(true)}>
                                <Plus className="h-4 w-4" strokeWidth={1.5} />
                                Agregar
                            </Button>
                        </div>

                        <div className="divide-y divide-capsula-line">
                            {ingredientCosts.map((ing, index) => (
                                <div key={ing.id} className="flex items-center gap-4 px-6 py-4">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-alt font-mono text-[12px] text-capsula-ink-soft">
                                        {index + 1}
                                    </div>

                                    <div className="flex-1">
                                        <p className="font-medium text-capsula-ink">{ing.itemName}</p>
                                        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-capsula-ink-muted">
                                            <span className="font-mono">
                                                {formatNumber(ing.quantity)} {ing.unit}
                                            </span>
                                            {ing.wastePercentage > 0 && (
                                                <Badge variant="warn">
                                                    {ing.wastePercentage}% merma
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {showCosts && (
                                        <div className="text-right">
                                            <p className="font-mono text-[13px] font-semibold text-capsula-navy-deep">
                                                {formatCurrency(ing.totalCost)}
                                            </p>
                                            <p className="font-mono text-[11px] text-capsula-ink-muted">
                                                {(ing.unitCost).toFixed(2)}/u
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => removeIngredient(ing.id)}
                                        className="rounded-full p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                    </button>
                                </div>
                            ))}

                            {ingredients.length === 0 && !showAddIngredient && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <ClipboardList className="h-10 w-10 text-capsula-ink-muted/50" strokeWidth={1.25} />
                                    <p className="mt-2 text-[13px] text-capsula-ink-soft">
                                        No hay ingredientes. Agrega el primero.
                                    </p>
                                </div>
                            )}
                        </div>

                        {showAddIngredient && (
                            <div className="border-t border-capsula-line bg-capsula-ivory-alt/50 p-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="font-heading text-[14px] text-capsula-navy-deep">
                                        Agregar ingrediente
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateItem(!showCreateItem)}
                                        className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[#2F6B4E]/40 bg-[#E5EDE7]/60 px-3 py-1.5 text-[12px] font-medium text-[#2F6B4E] transition-colors hover:bg-[#E5EDE7]"
                                    >
                                        {showCreateItem ? (
                                            <>
                                                <X className="h-3.5 w-3.5" strokeWidth={1.5} /> Cerrar
                                            </>
                                        ) : (
                                            <>
                                                <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Crear insumo nuevo
                                            </>
                                        )}
                                    </button>
                                </div>

                                {showCreateItem && (
                                    <div className="mb-5 rounded-[var(--radius)] border border-[#2F6B4E]/30 bg-[#E5EDE7]/40 p-4">
                                        <h4 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#2F6B4E]">
                                            <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                            Crear insumo nuevo
                                        </h4>
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <div className="sm:col-span-2">
                                                <label className={labelClass}>Nombre del insumo *</label>
                                                <input
                                                    type="text"
                                                    value={newItemName}
                                                    onChange={(e) => setNewItemName(e.target.value)}
                                                    placeholder="Ej: Aceite de oliva, harina de trigo…"
                                                    className={inputClass}
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Unidad base *</label>
                                                <select
                                                    value={newItemUnit}
                                                    onChange={(e) => setNewItemUnit(e.target.value)}
                                                    className={inputClass}
                                                >
                                                    {UNITS.map(u => (
                                                        <option key={u.value} value={u.value}>{u.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Tipo</label>
                                                <select
                                                    value={newItemType}
                                                    onChange={(e) => setNewItemType(e.target.value)}
                                                    className={inputClass}
                                                >
                                                    <option value="RAW_MATERIAL">Materia prima</option>
                                                    <option value="SUB_RECIPE">Sub-receta</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <p className="text-[11px] text-capsula-ink-muted">
                                                Se creará en el inventario y podrás darle entrada (compras) luego.
                                            </p>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={handleCreateItem}
                                                disabled={!newItemName.trim() || isCreatingItem}
                                                isLoading={isCreatingItem}
                                            >
                                                <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                {isCreatingItem ? 'Creando…' : 'Crear insumo'}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Insumo / sub-receta</label>
                                        <Combobox
                                            items={availableOptions.map(item => ({
                                                value: item.id,
                                                label: `${item.name} (${item.baseUnit}) — $${formatNumber(item.currentCost)}`
                                            }))}
                                            value={newIngredient.inventoryItemId || ''}
                                            onChange={(val) => {
                                                const item = localIngredients.find(i => i.id === val);
                                                setNewIngredient({
                                                    ...newIngredient,
                                                    inventoryItemId: val,
                                                    unit: (item?.baseUnit as UnitOfMeasure) || 'KG'
                                                });
                                            }}
                                            placeholder="Seleccionar…"
                                            searchPlaceholder="Buscar insumo…"
                                            emptyMessage="No se encontró el insumo."
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Cantidad</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={newIngredient.quantity || ''}
                                                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: parseFloat(e.target.value) || 0 })}
                                                min="0"
                                                step="0.01"
                                                placeholder="1"
                                                className="w-20 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 font-mono text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                            />
                                            <select
                                                value={newIngredient.unit}
                                                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value as UnitOfMeasure })}
                                                className="flex-1 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-2 py-2 text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                            >
                                                {UNITS.map(u => (
                                                    <option key={u.value} value={u.value}>{u.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Merma %</label>
                                        <input
                                            type="number"
                                            value={newIngredient.wastePercentage || ''}
                                            onChange={(e) => setNewIngredient({ ...newIngredient, wastePercentage: parseFloat(e.target.value) || 0 })}
                                            min="0"
                                            max="99"
                                            placeholder="0"
                                            className={`${inputClass} font-mono`}
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setShowAddIngredient(false)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={addIngredient}
                                        disabled={!newIngredient.inventoryItemId || !newIngredient.quantity}
                                    >
                                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Agregar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    {showCosts ? (
                        <div className="sticky top-24 rounded-[var(--radius)] border border-capsula-line bg-[#F3EAD6]/40 p-6 shadow-cap-soft">
                            <div className="mb-4 flex items-center gap-2">
                                <Coins className="h-5 w-5 text-[#946A1C]" strokeWidth={1.5} />
                                <h3 className="font-heading text-[16px] text-capsula-navy-deep">
                                    Resumen estimado
                                </h3>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-[12px]">
                                    <span className="text-capsula-ink-soft">Costo ingredientes</span>
                                    <span className="font-mono font-medium text-capsula-navy-deep">
                                        {formatCurrency(totalIngredientsCost)}
                                    </span>
                                </div>

                                <div className="flex justify-between text-[12px]">
                                    <span className="text-capsula-ink-soft">Producción efectiva</span>
                                    <span className="font-mono text-capsula-navy-deep">
                                        {formatNumber(effectiveOutput)} {outputUnit}
                                    </span>
                                </div>

                                <div className="border-t border-[#946A1C]/20 pt-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">
                                            Costo por unidad
                                        </span>
                                        <span className="font-mono text-[20px] font-semibold text-capsula-navy-deep">
                                            {formatCurrency(costPerUnit)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt p-6 text-center">
                            <Lock className="mx-auto h-8 w-8 text-capsula-ink-muted/60" strokeWidth={1.25} />
                            <p className="mt-2 text-[13px] text-capsula-ink-soft">
                                Los costos no están disponibles para tu rol.
                            </p>
                        </div>
                    )}

                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={!recipeName || ingredients.length === 0 || isSubmitting}
                        isLoading={isSubmitting}
                        className="w-full"
                    >
                        <Save className="h-4 w-4" strokeWidth={1.5} />
                        {isSubmitting ? 'Guardando…' : 'Guardar receta'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
