'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber, cn } from '@/lib/utils';
import {
    quickProductionAction,
    calculateRequirementsAction,
    getProductionRecipesAction,
    getProductionHistoryAction,
    getProductionAreasAction,
    getProductionItemsAction,
    manualProductionAction,
    updateProductionOrderAction,
    deleteProductionOrderAction,
    IngredientRequirement,
    ProductionActionResult,
} from '@/app/actions/production.actions';
import { Factory, Plus, Clock, CheckCircle, AlertTriangle, ChefHat, Package, Trash2, Edit3, X, Wrench, Check, Lightbulb, Loader2, FileText, Send } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import toast from 'react-hot-toast';

interface RecipeOption {
    id: string;
    name: string;
    outputItemName: string;
    outputQuantity: number;
    outputUnit: string;
    ingredientCount: number;
}

interface ProductionRecord {
    id: string;
    orderNumber: string;
    recipeName: string;
    plannedQuantity: number;
    actualQuantity: number | null;
    unit: string;
    status: string;
    createdBy: string;
    createdAt: Date;
    completedAt: Date | null;
    notes: string | null;
}

interface AreaOption {
    id: string;
    name: string;
}

interface InventoryItemOption {
    id: string;
    name: string;
    type: string;
    baseUnit: string;
    category: string | null;
}

interface ManualIngredient {
    id: string; // temp id
    itemId: string;
    quantity: number;
    unit: string;
}

export default function ProduccionPage() {
    const { user } = useAuthStore();

    // Estado
    const [activeTab, setActiveTab] = useState<'receta' | 'manual' | 'historial'>('receta');
    const [recipes, setRecipes] = useState<RecipeOption[]>([]);
    const [areas, setAreas] = useState<AreaOption[]>([]);
    const [allItems, setAllItems] = useState<InventoryItemOption[]>([]);
    const [productionHistory, setProductionHistory] = useState<ProductionRecord[]>([]);

    // ── Formulario por Receta ──
    const [selectedRecipe, setSelectedRecipe] = useState('');
    const [quantity, setQuantity] = useState<number>(0);
    const [areaId, setAreaId] = useState('');
    const [notes, setNotes] = useState('');

    // Requerimientos calculados
    const [requirements, setRequirements] = useState<IngredientRequirement[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);

    // ── Formulario Manual ──
    const [manualOutputItem, setManualOutputItem] = useState('');
    const [manualOutputQty, setManualOutputQty] = useState<number>(0);
    const [manualOutputUnit, setManualOutputUnit] = useState('KG');
    const [manualAreaId, setManualAreaId] = useState('');
    const [manualNotes, setManualNotes] = useState('');
    const [manualIngredients, setManualIngredients] = useState<ManualIngredient[]>([]);
    const [newIngItemId, setNewIngItemId] = useState('');
    const [newIngQty, setNewIngQty] = useState<number>(0);
    const [newIngUnit, setNewIngUnit] = useState('KG');

    // Estado de procesamiento
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<ProductionActionResult | null>(null);

    // ── Edición en historial ──
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [editNotes, setEditNotes] = useState('');

    // Cargar datos al inicio
    useEffect(() => {
        Promise.all([
            getProductionRecipesAction(),
            getProductionAreasAction(),
            getProductionHistoryAction({ limit: 50 }),
            getProductionItemsAction(),
        ]).then(([recipesData, areasData, historyData, itemsData]) => {
            setRecipes(recipesData);
            setAreas(areasData);
            setProductionHistory(historyData);
            setAllItems(itemsData);
            if (areasData.length > 0 && !areaId) {
                const prodArea = areasData.find(a =>
                    a.name.toLowerCase().includes('producción') ||
                    a.name.toLowerCase().includes('produccion')
                );
                const defaultArea = prodArea?.id || areasData[0].id;
                setAreaId(defaultArea);
                setManualAreaId(defaultArea);
            }
        });
    }, []);

    // Calcular requerimientos cuando cambia receta o cantidad
    useEffect(() => {
        if (!selectedRecipe || quantity <= 0 || !areaId) {
            setRequirements([]);
            return;
        }
        setIsCalculating(true);
        calculateRequirementsAction(selectedRecipe, quantity, areaId)
            .then(res => {
                if (res.success) {
                    setRequirements(res.requirements);
                }
            })
            .finally(() => setIsCalculating(false));
    }, [selectedRecipe, quantity, areaId]);

    // Obtener receta seleccionada
    const selectedRecipeData = recipes.find(r => r.id === selectedRecipe);

    // Verificar si todos los ingredientes tienen stock suficiente
    const allIngredientsAvailable = requirements.length > 0 &&
        requirements.every(r => r.sufficient);

    // ── Handlers ──

    const handleRecipeProduction = async () => {
        if (!selectedRecipe || quantity <= 0 || !allIngredientsAvailable || !areaId) return;
        setIsSubmitting(true);
        setResult(null);
        try {
            const response = await quickProductionAction({
                recipeId: selectedRecipe,
                actualQuantity: quantity,
                areaId,
                notes,
            });
            setResult(response);
            if (response.success) {
                toast.success(response.message);
                const newHistory = await getProductionHistoryAction({ limit: 50 });
                setProductionHistory(newHistory);
                setSelectedRecipe('');
                setQuantity(0);
                setNotes('');
                setRequirements([]);
            } else {
                toast.error(response.message);
            }
        } catch (error) {
            toast.error('Error al procesar la producción');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleManualProduction = async () => {
        if (!manualOutputItem || manualOutputQty <= 0 || !manualAreaId) return;
        setIsSubmitting(true);
        setResult(null);
        try {
            const response = await manualProductionAction({
                outputItemId: manualOutputItem,
                outputQuantity: manualOutputQty,
                outputUnit: manualOutputUnit,
                areaId: manualAreaId,
                ingredients: manualIngredients.map(i => ({
                    itemId: i.itemId,
                    quantity: i.quantity,
                    unit: i.unit,
                })),
                notes: manualNotes,
            });
            setResult(response);
            if (response.success) {
                toast.success(response.message);
                const newHistory = await getProductionHistoryAction({ limit: 50 });
                setProductionHistory(newHistory);
                setManualOutputItem('');
                setManualOutputQty(0);
                setManualNotes('');
                setManualIngredients([]);
            } else {
                toast.error(response.message);
            }
        } catch (error) {
            toast.error('Error al procesar la producción manual');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addManualIngredient = () => {
        if (!newIngItemId || newIngQty <= 0) return;
        setManualIngredients(prev => [...prev, {
            id: `temp-${Date.now()}`,
            itemId: newIngItemId,
            quantity: newIngQty,
            unit: newIngUnit,
        }]);
        setNewIngItemId('');
        setNewIngQty(0);
    };

    const removeManualIngredient = (tempId: string) => {
        setManualIngredients(prev => prev.filter(i => i.id !== tempId));
    };

    const handleEditOrder = async (orderId: string) => {
        const response = await updateProductionOrderAction(orderId, { notes: editNotes });
        if (response.success) {
            toast.success(response.message);
            const newHistory = await getProductionHistoryAction({ limit: 50 });
            setProductionHistory(newHistory);
            setEditingOrderId(null);
        } else {
            toast.error(response.message);
        }
    };

    const handleCancelOrder = async (orderId: string) => {
        if (!confirm('¿Estás seguro de cancelar esta orden de producción?')) return;
        const response = await deleteProductionOrderAction(orderId);
        if (response.success) {
            toast.success(response.message);
            const newHistory = await getProductionHistoryAction({ limit: 50 });
            setProductionHistory(newHistory);
        } else {
            toast.error(response.message);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return <Badge variant="ok"><CheckCircle className="h-3 w-3" strokeWidth={1.5} /> Completado</Badge>;
            case 'IN_PROGRESS':
                return <Badge variant="info"><Clock className="h-3 w-3" strokeWidth={1.5} /> En proceso</Badge>;
            case 'CANCELLED':
                return <Badge variant="danger"><AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> Cancelado</Badge>;
            default:
                return <Badge variant="neutral">{status}</Badge>;
        }
    };

    const inputClass = 'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none';
    const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';

    // Helper: get item name by id
    const getItemName = (itemId: string) => allItems.find(i => i.id === itemId)?.name || itemId;
    const getItemUnit = (itemId: string) => allItems.find(i => i.id === itemId)?.baseUnit || 'KG';

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <Factory className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Operación</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Producción</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">Registrar producciones y consumo de ingredientes.</p>
                </div>
            </div>

            <div className="border-b border-capsula-line">
                <nav className="-mb-px flex gap-6">
                    <button
                        onClick={() => { setActiveTab('receta'); setResult(null); }}
                        className={cn(
                            'flex items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors',
                            activeTab === 'receta'
                                ? 'border-capsula-navy-deep text-capsula-navy-deep'
                                : 'border-transparent text-capsula-ink-muted hover:text-capsula-ink'
                        )}
                    >
                        <ChefHat className="h-4 w-4" strokeWidth={1.5} />
                        Desde receta
                    </button>
                    <button
                        onClick={() => { setActiveTab('manual'); setResult(null); }}
                        className={cn(
                            'flex items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors',
                            activeTab === 'manual'
                                ? 'border-capsula-coral text-capsula-coral'
                                : 'border-transparent text-capsula-ink-muted hover:text-capsula-ink'
                        )}
                    >
                        <Wrench className="h-4 w-4" strokeWidth={1.5} />
                        Producción manual
                    </button>
                    <button
                        onClick={() => setActiveTab('historial')}
                        className={cn(
                            'flex items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors',
                            activeTab === 'historial'
                                ? 'border-capsula-navy-deep text-capsula-navy-deep'
                                : 'border-transparent text-capsula-ink-muted hover:text-capsula-ink'
                        )}
                    >
                        <Clock className="h-4 w-4" strokeWidth={1.5} />
                        Historial <span className="font-mono text-[11px]">({productionHistory.length})</span>
                    </button>
                </nav>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                TAB: PRODUCCIÓN DESDE RECETA
               ═══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'receta' && (
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                            <div className="mb-6 flex items-center gap-3 border-b border-capsula-line pb-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt text-capsula-navy-deep">
                                    <ChefHat className="h-5 w-5" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h2 className="font-heading text-[16px] text-capsula-navy-deep">Producción desde receta</h2>
                                    <p className="text-[12px] text-capsula-ink-soft">Chef: {user?.firstName} {user?.lastName}</p>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label className={labelClass}>¿Qué acabas de producir? *</label>
                                    <Combobox
                                        items={recipes.map(r => ({
                                            value: r.id,
                                            label: `${r.name} (Rinde: ${r.outputQuantity} ${r.outputUnit})`
                                        }))}
                                        value={selectedRecipe}
                                        onChange={(val) => {
                                            setSelectedRecipe(val);
                                            const recipe = recipes.find(r => r.id === val);
                                            if (recipe) setQuantity(recipe.outputQuantity);
                                        }}
                                        placeholder="Seleccionar producto…"
                                        searchPlaceholder="Buscar receta…"
                                        emptyMessage="No hay recetas disponibles"
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Cantidad producida *</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={quantity || ''}
                                            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.1"
                                            placeholder="20"
                                            className="w-24 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 font-mono text-[14px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                        />
                                        <span className="font-mono text-[13px] text-capsula-ink-soft">
                                            {selectedRecipeData?.outputUnit || 'unidades'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Área de producción *</label>
                                    <select
                                        value={areaId}
                                        onChange={(e) => setAreaId(e.target.value)}
                                        className={inputClass}
                                    >
                                        {areas.map(area => (
                                            <option key={area.id} value={area.id}>{area.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className={labelClass}>Notas (opcional)</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Ej: Lote #45, temperatura perfecta"
                                        rows={2}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        {requirements.length > 0 && (
                            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                                <div className="border-b border-capsula-line px-6 py-4">
                                    <h3 className="flex items-center gap-2 font-heading text-[15px] text-capsula-navy-deep">
                                        <Package className="h-4 w-4 text-capsula-ink-muted" strokeWidth={1.5} />
                                        Ingredientes que se consumirán
                                    </h3>
                                    <p className="mt-0.5 text-[12px] text-capsula-ink-soft">
                                        Estos insumos se descontarán automáticamente del área seleccionada.
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[13px]">
                                        <thead className="bg-capsula-ivory-alt text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                            <tr>
                                                <th className="px-6 py-3 text-left">Ingrediente</th>
                                                <th className="px-6 py-3 text-right">Necesario</th>
                                                <th className="px-6 py-3 text-right">Disponible</th>
                                                <th className="px-6 py-3 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-capsula-line">
                                            {requirements.map((req) => (
                                                <tr key={req.itemId} className="transition-colors hover:bg-capsula-ivory-alt/50">
                                                    <td className="px-6 py-4 font-medium text-capsula-ink">{req.itemName}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-capsula-ink">{formatNumber(req.gross, 3)} {req.unit}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={cn('font-mono', req.sufficient ? 'text-capsula-ink-muted' : 'text-capsula-coral')}>
                                                            {formatNumber(req.available, 3)} {req.unit}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {req.sufficient ? (
                                                            <Badge variant="ok"><Check className="h-3 w-3" strokeWidth={2} /> OK</Badge>
                                                        ) : (
                                                            <Badge variant="danger"><X className="h-3 w-3" strokeWidth={2} /> Falta {formatNumber(req.gross - req.available, 3)}</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {result && (<ResultCard result={result} />)}
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-[var(--radius)] border border-capsula-line bg-[#E5EDE7]/40 p-6 shadow-cap-soft">
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleRecipeProduction}
                                disabled={isSubmitting || !selectedRecipe || quantity <= 0 || !allIngredientsAvailable || !areaId}
                                isLoading={isSubmitting}
                                className="w-full"
                            >
                                <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
                                {isSubmitting ? 'Procesando…' : 'Registrar producción'}
                            </Button>

                            {requirements.length > 0 && !allIngredientsAvailable && (
                                <p className="mt-3 flex items-center justify-center gap-1 text-center text-[12px] text-capsula-coral">
                                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    Stock insuficiente de algunos ingredientes
                                </p>
                            )}
                            {selectedRecipe && quantity > 0 && allIngredientsAvailable && (
                                <p className="mt-3 flex items-center justify-center gap-1 text-center text-[12px] text-[#2F6B4E]">
                                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                                    Todo listo para producir
                                </p>
                            )}
                        </div>

                        <div className="rounded-[var(--radius)] border border-capsula-line bg-[#F3EAD6]/40 p-4">
                            <h4 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#946A1C]">
                                <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.5} />
                                Recuerda
                            </h4>
                            <ul className="space-y-1 text-[12px] text-capsula-ink-soft">
                                <li>• Los ingredientes se descuentan del área seleccionada</li>
                                <li>• El producto terminado se suma a la misma área</li>
                                <li>• Luego puedes transferir al Restaurante</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                TAB: PRODUCCIÓN MANUAL
               ═══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'manual' && (
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                            <div className="mb-6 flex items-center gap-3 border-b border-capsula-line pb-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] border border-capsula-coral/40 bg-capsula-coral/10 text-capsula-coral">
                                    <Wrench className="h-5 w-5" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h2 className="font-heading text-[16px] text-capsula-navy-deep">Producción manual</h2>
                                    <p className="text-[12px] text-capsula-ink-soft">Crea una producción personalizada sin necesidad de receta.</p>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label className={labelClass}>¿Qué producto estás produciendo? *</label>
                                    <Combobox
                                        items={allItems.map(item => ({
                                            value: item.id,
                                            label: `${item.name} (${item.baseUnit})`
                                        }))}
                                        value={manualOutputItem}
                                        onChange={(val) => {
                                            setManualOutputItem(val);
                                            const item = allItems.find(i => i.id === val);
                                            if (item) setManualOutputUnit(item.baseUnit);
                                        }}
                                        placeholder="Seleccionar producto de salida…"
                                        searchPlaceholder="Buscar producto…"
                                        emptyMessage="No hay productos disponibles"
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Cantidad producida *</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={manualOutputQty || ''}
                                            onChange={(e) => setManualOutputQty(parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.1"
                                            placeholder="0"
                                            className="w-24 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 font-mono text-[14px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                        />
                                        <span className="font-mono text-[13px] text-capsula-ink-soft">{manualOutputUnit}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Área de producción *</label>
                                    <select
                                        value={manualAreaId}
                                        onChange={(e) => setManualAreaId(e.target.value)}
                                        className={inputClass}
                                    >
                                        {areas.map(area => (
                                            <option key={area.id} value={area.id}>{area.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className={labelClass}>Notas (opcional)</label>
                                    <textarea
                                        value={manualNotes}
                                        onChange={(e) => setManualNotes(e.target.value)}
                                        placeholder="Ej: Producción especial, ajuste de inventario…"
                                        rows={2}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                            <div className="flex items-center justify-between border-b border-capsula-line px-6 py-4">
                                <div>
                                    <h3 className="flex items-center gap-2 font-heading text-[15px] text-capsula-navy-deep">
                                        <Package className="h-4 w-4 text-capsula-ink-muted" strokeWidth={1.5} />
                                        Ingredientes a consumir
                                    </h3>
                                    <p className="mt-0.5 text-[12px] text-capsula-ink-soft">Agrega los insumos que se consumieron en esta producción.</p>
                                </div>
                                <Badge variant="warn">
                                    <span className="font-mono">{manualIngredients.length}</span> ítems
                                </Badge>
                            </div>

                            {manualIngredients.length > 0 && (
                                <div className="divide-y divide-capsula-line">
                                    {manualIngredients.map((ing, idx) => (
                                        <div key={ing.id} className="flex items-center justify-between px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-alt font-mono text-[11px] text-capsula-ink-soft">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-capsula-ink">{getItemName(ing.itemId)}</p>
                                                    <p className="font-mono text-[12px] text-capsula-ink-muted">{formatNumber(ing.quantity)} {ing.unit}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeManualIngredient(ing.id)}
                                                className="rounded-full p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="border-t border-capsula-line bg-capsula-ivory-alt/50 p-4">
                                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Agregar ingrediente</p>
                                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                                    <Combobox
                                        items={allItems
                                            .filter(item => !manualIngredients.some(i => i.itemId === item.id) && item.id !== manualOutputItem)
                                            .map(item => ({
                                                value: item.id,
                                                label: `${item.name} (${item.baseUnit})`
                                            }))}
                                        value={newIngItemId}
                                        onChange={(val) => {
                                            setNewIngItemId(val);
                                            const item = allItems.find(i => i.id === val);
                                            if (item) setNewIngUnit(item.baseUnit);
                                        }}
                                        placeholder="Seleccionar insumo…"
                                        searchPlaceholder="Buscar insumo…"
                                        emptyMessage="No hay insumos disponibles"
                                    />
                                    <input
                                        type="number"
                                        value={newIngQty || ''}
                                        onChange={(e) => setNewIngQty(parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        placeholder="Cant."
                                        className="w-20 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 font-mono text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                    />
                                    <span className="flex items-center font-mono text-[12px] text-capsula-ink-muted">
                                        {newIngUnit}
                                    </span>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={addManualIngredient}
                                        disabled={!newIngItemId || newIngQty <= 0}
                                    >
                                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {result && <ResultCard result={result} />}
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral/5 p-6 shadow-cap-soft">
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleManualProduction}
                                disabled={isSubmitting || !manualOutputItem || manualOutputQty <= 0 || !manualAreaId}
                                isLoading={isSubmitting}
                                className="w-full"
                            >
                                <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
                                {isSubmitting ? 'Procesando…' : 'Registrar producción manual'}
                            </Button>

                            {manualOutputItem && manualOutputQty > 0 && (
                                <div className="mt-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-3">
                                    <p className="text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">Resumen</p>
                                    <p className="mt-1 text-[13px] text-capsula-ink">
                                        <span className="font-mono text-[#2F6B4E]">+{formatNumber(manualOutputQty)}</span> {manualOutputUnit} de <strong className="text-capsula-navy-deep">{getItemName(manualOutputItem)}</strong>
                                    </p>
                                    {manualIngredients.length > 0 && (
                                        <div className="mt-2 border-t border-capsula-line pt-2">
                                            <p className="text-[11px] text-capsula-ink-muted">Se consumirán <span className="font-mono">{manualIngredients.length}</span> ingredientes</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-alt/50 p-4">
                            <h4 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-navy-deep">
                                <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.5} />
                                ¿Cuándo usar producción manual?
                            </h4>
                            <ul className="space-y-1 text-[12px] text-capsula-ink-soft">
                                <li>• Cuando no tienes una receta definida aún</li>
                                <li>• Para ajustes o producciones especiales</li>
                                <li>• Para registrar producción con cantidades personalizadas</li>
                                <li>• Los ingredientes son opcionales</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                TAB: HISTORIAL
               ═══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'historial' && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Producto</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Cantidad</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Responsable</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Notas</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {productionHistory.map((order) => (
                                    <tr key={order.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm font-medium text-emerald-600">{order.orderNumber}</span>
                                            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-gray-900 dark:text-white">{order.recipeName}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-mono text-gray-900 dark:text-white">
                                                {formatNumber(order.actualQuantity || order.plannedQuantity)} {order.unit}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">{getStatusBadge(order.status)}</td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{order.createdBy}</td>
                                        <td className="px-6 py-4 max-w-[200px]">
                                            {editingOrderId === order.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editNotes}
                                                        onChange={(e) => setEditNotes(e.target.value)}
                                                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleEditOrder(order.id)}
                                                        className="rounded bg-emerald-500 p-1 text-white hover:bg-emerald-600"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingOrderId(null)}
                                                        className="rounded bg-gray-300 p-1 text-gray-700 hover:bg-gray-400"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="truncate text-sm text-gray-500" title={order.notes || ''}>
                                                    {order.notes || '—'}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {order.status !== 'CANCELLED' && (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditingOrderId(order.id);
                                                            setEditNotes(order.notes || '');
                                                        }}
                                                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20"
                                                        title="Editar notas"
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelOrder(order.id)}
                                                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                                        title="Cancelar orden"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {productionHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                            No hay producciones registradas
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Component: Result Card ──
function ResultCard({ result }: { result: ProductionActionResult }) {
    return (
        <div className={cn(
            'rounded-xl p-6',
            result.success
                ? 'border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : 'border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        )}>
            <div className="flex items-start gap-3">
                <span className="text-2xl">{result.success ? '✅' : '❌'}</span>
                <div>
                    <p className={cn(
                        'font-semibold',
                        result.success ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'
                    )}>
                        {result.message}
                    </p>
                    {result.success && result.data && (
                        <div className="mt-3 space-y-2 text-sm text-emerald-700 dark:text-emerald-300">
                            <p>📦 Producido: {result.data.productAdded?.quantity} {result.data.productAdded?.unit} de {result.data.productAdded?.name}</p>
                            {result.data.ingredientsConsumed && result.data.ingredientsConsumed.length > 0 && (
                                <div className="mt-2">
                                    <p className="font-medium">Ingredientes consumidos:</p>
                                    <ul className="ml-4 list-disc">
                                        {result.data.ingredientsConsumed.map((ing, idx) => (
                                            <li key={idx}>{ing.name}: {formatNumber(ing.quantity, 3)} {ing.unit}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
