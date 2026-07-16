'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Plus, Trash2, X as XIcon, Check, Loader2, Save, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { UnitOfMeasure } from '@/types';
import { UNIT_INFO } from '@/lib/constants/units';
import { createRecipeAction, updateRecipeAction } from '@/app/actions/recipe.actions';
import { createQuickItem } from '@/app/actions/inventory.actions';
import { toast } from 'react-hot-toast';
import { Combobox } from '@/components/ui/combobox';
import { ModalPortal } from '@/components/ui/modal-portal';

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
    /**
     * §120: tipo preseleccionado al crear (ej. desde Producción → Sub-recetas
     * con ?tipo=SUB_RECIPE). Ignorado si hay initialData (edición).
     */
    initialType?: 'SUB_RECIPE' | 'FINISHED_GOOD';
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

// §109.1: familias de unidades compatibles por unidad base del insumo.
// Al elegir un insumo, su unidad se auto-rellena y el selector solo ofrece
// conversiones seguras de la misma familia (masa↔masa, volumen↔volumen) —
// imposible asignarle "Unidades" a un aceite en litros por error humano.
const UNIT_FAMILIES: Record<string, UnitOfMeasure[]> = {
    KG: ['KG', 'G'],
    G: ['G', 'KG'],
    L: ['L', 'ML'],
    ML: ['ML', 'L'],
    UNIT: ['UNIT'],
    PORTION: ['PORTION'],
};

const unitLabel = (v: string) => UNITS.find(u => u.value === v)?.label ?? v;

export default function RecipeForm({ availableIngredients, initialData, initialType }: RecipeFormProps) {
    const router = useRouter();
    const { user, canViewCosts } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => { setShowCosts(canViewCosts()); }, [canViewCosts]);

    // Estados del formulario
    const [recipeName, setRecipeName] = useState(initialData?.name || '');
    const [category, setCategory] = useState<string>(initialData?.category || 'RECETAS PRODUCCION');
    const [description, setDescription] = useState(initialData?.description || '');
    const [type, setType] = useState<'SUB_RECIPE' | 'FINISHED_GOOD'>(
        initialData
            ? (initialData?.outputItem?.type === 'FINISHED_GOOD' ? 'FINISHED_GOOD' : 'SUB_RECIPE')
            : (initialType ?? 'SUB_RECIPE')
    );
    // Cantidades como STRING mientras se tipea: un estado numérico +
    // parseFloat por tecla rompe los decimales ("0.009" → el "0." intermedio
    // se parsea a 0 y el input se resetea). Se parsean al usar.
    const [outputQuantityStr, setOutputQuantityStr] = useState<string>(String(initialData?.outputQuantity ?? 1));
    const outputQuantity = parseFloat(outputQuantityStr) || 0;
    const [outputUnit, setOutputUnit] = useState<UnitOfMeasure>(initialData?.outputUnit || 'KG');
    const [yieldPercentageStr, setYieldPercentageStr] = useState<string>(String(initialData?.yieldPercentage ?? 100));
    const yieldPercentage = parseFloat(yieldPercentageStr) || 100;
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

    // Estado para nuevo ingrediente (cantidad/merma como string, ver arriba)
    const [newIngredient, setNewIngredient] = useState<Partial<DraftIngredient>>({
        inventoryItemId: '',
        quantity: 0,
        unit: 'KG',
        wastePercentage: 0,
        notes: '',
    });
    const [newQuantityStr, setNewQuantityStr] = useState('');
    const [newWasteStr, setNewWasteStr] = useState('');

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

    // Foco directo a Cantidad al elegir el insumo — evita el click extra.
    const qtyInputRef = useRef<HTMLInputElement>(null);

    // §109.1: insumo seleccionado en el modal y sus unidades compatibles.
    const selectedNewItem = localIngredients.find(i => i.id === newIngredient.inventoryItemId) ?? null;
    const newUnitOptions: UnitOfMeasure[] = selectedNewItem
        ? (UNIT_FAMILIES[selectedNewItem.baseUnit] ?? UNITS.map(u => u.value))
        : [];

    // Agregar ingrediente. El modal QUEDA ABIERTO y listo para el siguiente
    // (flujo típico: cargar varios ingredientes seguidos sin re-abrir ni
    // hacer scroll). Se cierra con "Listo".
    const addIngredient = () => {
        const qty = parseFloat(newQuantityStr);
        if (!newIngredient.inventoryItemId || !Number.isFinite(qty) || qty <= 0) return;

        const item = localIngredients.find(i => i.id === newIngredient.inventoryItemId);
        // §109.1: la unidad SIEMPRE dentro de la familia del insumo; si por
        // algún estado viejo no lo está, cae a la unidad base del insumo.
        const family = item ? (UNIT_FAMILIES[item.baseUnit] ?? []) : [];
        const safeUnit: UnitOfMeasure = newIngredient.unit && family.includes(newIngredient.unit)
            ? newIngredient.unit
            : ((item?.baseUnit as UnitOfMeasure) || 'KG');
        const newIng: DraftIngredient = {
            id: `temp-${Date.now()}`,
            inventoryItemId: newIngredient.inventoryItemId,
            quantity: qty,
            unit: safeUnit,
            wastePercentage: parseFloat(newWasteStr) || 0,
            notes: newIngredient.notes || '',
        };

        setIngredients([...ingredients, newIng]);
        setNewIngredient({ inventoryItemId: '', quantity: 0, unit: 'KG', wastePercentage: 0, notes: '' });
        setNewQuantityStr('');
        setNewWasteStr('');
        toast.success(`${item?.name ?? 'Ingrediente'} agregado`, { duration: 1500 });
    };

    // Enter en Cantidad/Merma = click en Agregar.
    const submitOnEnter = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addIngredient();
        }
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
                // §109: insumo recién creado ya quedó seleccionado — foco a Cantidad.
                setTimeout(() => qtyInputRef.current?.focus(), 0);
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

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/recetas"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-capsula-line text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt"
                        aria-label="Volver a recetas"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">{initialData ? 'Editar Receta' : 'Nueva Receta'}</h1>
                        <p className="text-capsula-ink-muted">
                            {initialData ? `Editando: ${initialData.name}` : `Creando como: ${user?.firstName}`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Formulario Principal */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Info básica */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-sm">
                        <h2 className="mb-4 font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Información Básica</h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Nombre de la Receta *
                                </label>
                                <input
                                    type="text"
                                    value={recipeName}
                                    onChange={(e) => setRecipeName(e.target.value)}
                                    placeholder="Ej: Salsa de Ajo de la Casa"
                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Categoría
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                >
                                    <option value="RECETAS CREMAS">Cremas</option>
                                    <option value="RECETAS PANTRY">Pantry</option>
                                    <option value="RECETAS PRODUCCION">Producción</option>
                                    <option value="ARMADO EN SERVICIO">Armado en Servicio</option>
                                    <option value="GENERAL">General/Otros</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Tipo de Producción
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="SUB_RECIPE"
                                            checked={type === 'SUB_RECIPE'}
                                            onChange={() => setType('SUB_RECIPE')}
                                            className="accent-capsula-navy-deep focus:ring-capsula-navy-deep/20"
                                        />
                                        <span className="text-sm">Sub-receta (Intermedio)</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="FINISHED_GOOD"
                                            checked={type === 'FINISHED_GOOD'}
                                            onChange={() => setType('FINISHED_GOOD')}
                                            className="accent-capsula-navy-deep focus:ring-capsula-navy-deep/20"
                                        />
                                        <span className="text-sm">Producto Final (Venta)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Descripción
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Instrucciones breves o descripción..."
                                    rows={2}
                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Cantidad Producida *
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={outputQuantityStr}
                                        onChange={(e) => setOutputQuantityStr(e.target.value)}
                                        min="0"
                                        step="any"
                                        className="w-24 rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                    />
                                    <select
                                        value={outputUnit}
                                        onChange={(e) => setOutputUnit(e.target.value as UnitOfMeasure)}
                                        className="flex-1 rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                    >
                                        {UNITS.map(u => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Rendimiento (Yield) %
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={yieldPercentageStr}
                                        onChange={(e) => setYieldPercentageStr(e.target.value)}
                                        min="1"
                                        max="100"
                                        step="any"
                                        className="w-full rounded-lg border border-capsula-line bg-white px-4 py-2.5 pr-10 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-capsula-ink-muted">%</span>
                                </div>
                                <p className="mt-1 text-xs text-capsula-ink-muted">
                                    Real: {formatNumber(effectiveOutput)} {outputUnit}
                                </p>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Tiempo Prep. (min)
                                </label>
                                <input
                                    type="number"
                                    value={prepTime}
                                    onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
                                    min="0"
                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink-soft">
                                    Tiempo Cocción (min)
                                </label>
                                <input
                                    type="number"
                                    value={cookTime}
                                    onChange={(e) => setCookTime(parseInt(e.target.value) || 0)}
                                    min="0"
                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Ingredientes */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface shadow-sm">
                        <div className="flex items-center justify-between border-b border-capsula-line px-6 py-4">
                            <div>
                                <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Ingredientes</h2>
                                <p className="text-sm text-capsula-ink-muted">
                                    {ingredients.length} items
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAddIngredient(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-capsula-navy-deep px-4 py-2 text-sm font-semibold text-capsula-cream transition-colors hover:bg-capsula-navy"
                            >
                                <Plus className="h-4 w-4" /> Agregar
                            </button>
                        </div>

                        {/* Lista de ingredientes */}
                        <div className="divide-y divide-capsula-line">
                            {ingredientCosts.map((ing, index) => (
                                <div key={ing.id} className="flex items-center gap-4 px-6 py-4">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-capsula-navy-soft text-sm font-semibold text-capsula-ink">
                                        {index + 1}
                                    </div>

                                    <div className="flex-1">
                                        <p className="font-medium text-capsula-ink">
                                            {ing.itemName}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm text-capsula-ink-muted">
                                            <span>
                                                {formatNumber(ing.quantity, 4)} {ing.unit}
                                            </span>
                                            {ing.wastePercentage > 0 && (
                                                <span className="rounded bg-[#F3EAD6] px-1.5 py-0.5 text-xs text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]">
                                                    {ing.wastePercentage}% merma
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {showCosts && (
                                        <div className="text-right">
                                            <p className="font-mono text-sm font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                                                {formatCurrency(ing.totalCost)}
                                            </p>
                                            <p className="text-xs text-capsula-ink-muted">
                                                {(ing.unitCost).toFixed(2)}/u
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => removeIngredient(ing.id)}
                                        className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                        aria-label="Quitar ingrediente"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}

                            {ingredients.length === 0 && !showAddIngredient && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <span className="text-4xl"></span>
                                    <p className="mt-2 text-capsula-ink-muted">
                                        No hay ingredientes. Agrega el primero.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal para agregar ingrediente — overlay centrado (§109):
                            siempre a la vista aunque la lista sea larga; cero scroll.
                            Queda abierto tras agregar para cargar varios seguidos. */}
                        {showAddIngredient && (
                            <ModalPortal>
                            <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                            <div className="bg-capsula-ivory border border-capsula-line w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
                            <div className="border-b border-capsula-line p-5 flex items-center justify-between sticky top-0 bg-capsula-ivory z-10">
                                <div>
                                    <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Agregar ingrediente</h3>
                                    <p className="text-xs text-capsula-ink-muted">{ingredients.length} en la receta — agrega varios seguidos y cierra con «Listo»</p>
                                </div>
                                <button
                                    onClick={() => setShowAddIngredient(false)}
                                    className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center"
                                    aria-label="Cerrar"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-5">
                                <div className="mb-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateItem(!showCreateItem)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#A8C8B0] bg-[#E5EDE7] px-3 py-1.5 text-xs font-semibold text-[#2F6B4E] transition-colors hover:opacity-80 dark:border-[#2A4D38] dark:bg-[#1E3B2C] dark:text-[#6FB88F]"
                                    >
                                        {showCreateItem ? <><XIcon className="h-3.5 w-3.5" /> Cerrar</> : <><Plus className="h-3.5 w-3.5" /> Crear Insumo Nuevo</>}
                                    </button>
                                </div>

                                {/* Mini-formulario para crear insumo nuevo */}
                                {showCreateItem && (
                                    <div className="mb-5 rounded-lg border border-capsula-line bg-capsula-ivory-surface p-4">
                                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-capsula-ink">
                                            Crear Insumo Nuevo
                                        </h4>
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <div className="sm:col-span-2">
                                                <label className="mb-1 block text-xs font-medium text-capsula-ink-muted">
                                                    Nombre del insumo *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newItemName}
                                                    onChange={(e) => setNewItemName(e.target.value)}
                                                    placeholder="Ej: Aceite de Oliva, Harina de Trigo..."
                                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none focus:ring-2 focus:ring-capsula-navy-deep/20"
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-capsula-ink-muted">
                                                    Unidad base *
                                                </label>
                                                <select
                                                    value={newItemUnit}
                                                    onChange={(e) => setNewItemUnit(e.target.value)}
                                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                                >
                                                    {UNITS.map(u => (
                                                        <option key={u.value} value={u.value}>{u.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-capsula-ink-muted">
                                                    Tipo
                                                </label>
                                                <select
                                                    value={newItemType}
                                                    onChange={(e) => setNewItemType(e.target.value)}
                                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                                >
                                                    <option value="RAW_MATERIAL">Materia Prima</option>
                                                    <option value="SUB_RECIPE">Sub-Receta</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <p className="text-xs text-capsula-ink-muted dark:text-capsula-ink-muted">
                                                Se creará en el inventario y podrás darle entrada (compras) luego.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleCreateItem}
                                                disabled={!newItemName.trim() || isCreatingItem}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-capsula-navy-deep px-4 py-2 text-sm font-semibold text-capsula-cream transition-colors hover:bg-capsula-navy disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isCreatingItem ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</> : <><Check className="h-4 w-4" /> Crear Insumo</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="sm:col-span-2">
                                        <label className="mb-1 block text-sm text-capsula-ink-muted">
                                            Insumo / Sub-receta
                                        </label>
                                        <Combobox
                                            items={[...availableOptions]
                                                // §114: sub-recetas primero para que salten a la vista.
                                                .sort((a, b) => {
                                                    const rank = (t: string) => (t === 'SUB_RECIPE' ? 0 : 1);
                                                    return rank(a.type) - rank(b.type) || a.name.localeCompare(b.name);
                                                })
                                                .map(item => ({
                                                    value: item.id,
                                                    // §114: grupos visibles en el selector — "Sub-recetas" arriba,
                                                    // "Insumos" abajo. Resuelve "no me deja ver las sub-recetas".
                                                    group: item.type === 'SUB_RECIPE' ? 'Sub-recetas' : 'Insumos',
                                                    label: `${item.name} (${item.baseUnit}) - $${formatNumber(item.currentCost)}`
                                                }))}
                                            value={newIngredient.inventoryItemId || ''}
                                            onChange={(val) => {
                                                const item = localIngredients.find(i => i.id === val);
                                                setNewIngredient({
                                                    ...newIngredient,
                                                    inventoryItemId: val,
                                                    unit: (item?.baseUnit as UnitOfMeasure) || 'KG'
                                                });
                                                // §109: al elegir insumo, el foco salta directo a
                                                // Cantidad — sin click ni scroll intermedio.
                                                setTimeout(() => qtyInputRef.current?.focus(), 0);
                                            }}
                                            placeholder="Seleccionar..."
                                            searchPlaceholder="Buscar insumo..."
                                            emptyMessage="No se encontró el insumo."
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm text-capsula-ink-muted">
                                            Cantidad
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                ref={qtyInputRef}
                                                type="number"
                                                value={newQuantityStr}
                                                onChange={(e) => setNewQuantityStr(e.target.value)}
                                                onKeyDown={submitOnEnter}
                                                min="0"
                                                step="any"
                                                placeholder="1"
                                                className="w-24 rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink tabular-nums focus:border-capsula-navy-deep focus:outline-none"
                                            />
                                            <select
                                                value={newIngredient.unit}
                                                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value as UnitOfMeasure })}
                                                disabled={!selectedNewItem || newUnitOptions.length <= 1}
                                                className="flex-1 rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-2.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none disabled:opacity-60"
                                            >
                                                {!selectedNewItem && <option value="">— elige el insumo —</option>}
                                                {newUnitOptions.map(v => (
                                                    <option key={v} value={v}>{unitLabel(v)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {selectedNewItem && (
                                            <p className="mt-1 text-[11px] text-capsula-ink-muted">
                                                {newUnitOptions.length > 1
                                                    ? <>Unidad del insumo: <span className="font-semibold">{unitLabel(selectedNewItem.baseUnit)}</span> — puedes cambiar a {newUnitOptions.filter(v => v !== selectedNewItem.baseUnit).map(unitLabel).join(', ')}</>
                                                    : <>Unidad fija del insumo: <span className="font-semibold">{unitLabel(selectedNewItem.baseUnit)}</span></>}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm text-capsula-ink-muted">
                                            Merma %
                                        </label>
                                        <input
                                            type="number"
                                            value={newWasteStr}
                                            onChange={(e) => setNewWasteStr(e.target.value)}
                                            onKeyDown={submitOnEnter}
                                            min="0"
                                            max="99"
                                            step="any"
                                            placeholder="0"
                                            className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-2.5 text-sm text-capsula-ink tabular-nums focus:border-capsula-navy-deep focus:outline-none"
                                        />
                                    </div>
                                </div>

                            </div>
                            <div className="border-t border-capsula-line p-4 flex gap-3">
                                <button
                                    onClick={() => setShowAddIngredient(false)}
                                    className="pos-btn-secondary flex-1 py-3"
                                >
                                    Listo
                                </button>
                                <button
                                    onClick={addIngredient}
                                    disabled={!newIngredient.inventoryItemId || !(parseFloat(newQuantityStr) > 0)}
                                    className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" /> Agregar y seguir
                                </button>
                            </div>
                            </div>
                            </div>
                            </ModalPortal>
                        )}
                    </div>
                </div>

                {/* Panel lateral - Resumen de costos */}
                <div className="space-y-4">
                    {/* Costo Total Card */}
                    {showCosts ? (
                        <div className="sticky top-24 rounded-xl border border-capsula-line bg-capsula-navy-soft p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="text-2xl"></span>
                                <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Resumen Estimado</h3>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-capsula-ink-muted">Costo ingredientes:</span>
                                    <span className="font-mono font-medium text-capsula-ink">
                                        {formatCurrency(totalIngredientsCost)}
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-capsula-ink-muted">Producción efectiva:</span>
                                    <span className="font-medium text-capsula-ink">
                                        {formatNumber(effectiveOutput)} {outputUnit}
                                    </span>
                                </div>

                                <div className="border-t border-capsula-line pt-3">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-capsula-ink">
                                            Costo por unidad:
                                        </span>
                                        <span className="font-semibold text-xl tracking-[-0.02em] text-capsula-coral">
                                            {formatCurrency(costPerUnit)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-capsula-line bg-capsula-ivory-alt p-6 text-center">
                            <span className="text-4xl"></span>
                            <p className="mt-2 text-sm text-capsula-ink-muted">
                                Los costos no están disponibles para tu rol.
                            </p>
                        </div>
                    )}

                    {/* Guardar */}
                    <button
                        onClick={handleSubmit}
                        disabled={!recipeName || ingredients.length === 0 || isSubmitting}
                        className="pos-btn w-full py-3 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                            </>
                        ) : (
                            <><Save className="h-4 w-4" /> Guardar Receta</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
