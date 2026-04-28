'use client';

import { useState, useEffect } from 'react';
import {
    Brush,
    Soup,
    Package,
    Settings,
    ClipboardList,
    Plus,
    Eye,
    CheckCircle2,
    Ban,
    Pencil,
    RefreshCw,
    Link2,
    Droplets,
    Save,
    Check,
    Loader2,
    X as XIcon,
    type LucideIcon,
} from 'lucide-react';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import {
    getProteinItemsAction,
    getProcessingAreasAction,
    getSuppliersAction,
    createProteinProcessingAction,
    getProteinProcessingsAction,
    getProteinProcessingByIdAction,
    completeProteinProcessingAction,
    cancelProteinProcessingAction,
    getProteinProcessingStatsAction,
    getTemplateBySourceItemAction,
    getTemplateChainAction,
    getCompletedProcessingsForChainAction,
    SubProductInput
} from '@/app/actions/protein-processing.actions';
import { createQuickItem } from '@/app/actions/inventory.actions';
import { toast } from 'react-hot-toast';
import { Combobox } from '@/components/ui/combobox';
import ProcessingTemplates from './processing-templates';

const STEP_CONFIG: Record<string, { label: string; Icon: LucideIcon; color: string; bgColor: string; borderColor: string }> = {
    'LIMPIEZA': { label: 'Limpieza', Icon: Brush as LucideIcon, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' },
    'MASERADO': { label: 'Maserado', Icon: Soup as LucideIcon, color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300' },
    'DISTRIBUCION': { label: 'Distribución', Icon: Package as LucideIcon, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' },
    'CUSTOM': { label: 'Personalizado', Icon: Settings as LucideIcon, color: 'text-capsula-ink-soft', bgColor: 'bg-capsula-ivory-alt', borderColor: 'border-capsula-line-strong' },
};

interface SubProduct extends SubProductInput {
    id: string;
    outputItemId?: string; // ID del item de inventario al que corresponde
}

export default function ProteinProcessingView() {
    const [proteinItems, setProteinItems] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [processings, setProcessings] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [selectedProcessing, setSelectedProcessing] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estado del formulario
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail' | 'templates'>('list');
    const [processDate, setProcessDate] = useState(new Date().toISOString().slice(0, 10));
    const [sourceItemId, setSourceItemId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [frozenWeight, setFrozenWeight] = useState<number>(0);
    const [drainedWeight, setDrainedWeight] = useState<number>(0);
    const [areaId, setAreaId] = useState('');
    const [notes, setNotes] = useState('');
    const [reportedWaste, setReportedWaste] = useState<number>(0);

    // Subproductos
    const [subProducts, setSubProducts] = useState<SubProduct[]>([]);
    const [newSubProductName, setNewSubProductName] = useState('');
    const [newSubProductItemId, setNewSubProductItemId] = useState('');
    const [newSubProductWeight, setNewSubProductWeight] = useState<number>(0);
    const [newSubProductUnits, setNewSubProductUnits] = useState<number>(1);
    const [newSubProductUnitType, setNewSubProductUnitType] = useState<string>('KG');

    // Estado para crear insumo nuevo (Subproducto)
    const [showCreateItem, setShowCreateItem] = useState(false);
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemUnit, setNewItemUnit] = useState<string>('KG');
    const [newItemType, setNewItemType] = useState<string>('RAW_MATERIAL');

    // Estado para plantilla activa
    const [activeTemplate, setActiveTemplate] = useState<any>(null);
    const [templateChain, setTemplateChain] = useState<any[]>([]);
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    // Estado para procesamiento en cadena
    const [processingStep, setProcessingStep] = useState('LIMPIEZA');
    const [parentProcessingId, setParentProcessingId] = useState('');
    const [completedProcessings, setCompletedProcessings] = useState<any[]>([]);

    // Cargar cadena de plantillas cuando cambia el sourceItem
    useEffect(() => {
        if (sourceItemId) {
            setLoadingTemplate(true);
            Promise.all([
                getTemplateBySourceItemAction(sourceItemId, processingStep),
                getTemplateChainAction(sourceItemId)
            ]).then(([template, chain]) => {
                setActiveTemplate(template);
                setTemplateChain(chain);
                setLoadingTemplate(false);
                if (template) {
                    toast.success(`Plantilla "${template.name}" cargada (${(template as any).processingStep || 'LIMPIEZA'})`);
                    // Auto-detect if this step can gain weight
                    if ((template as any).canGainWeight) {
                        toast(`↑ En este paso el peso puede AUMENTAR (ej: condimentos)`);
                    }
                }
                if (chain.length > 1) {
                    toast(`Cadena de ${chain.length} pasos disponible para esta proteína`);
                }
            });
        } else {
            setActiveTemplate(null);
            setTemplateChain([]);
        }
    }, [sourceItemId, processingStep]);

    // Lista de items filtrada: si hay plantilla, solo mostrar los outputs permitidos; si no, todos
    const availableSubItems = activeTemplate
        ? activeTemplate.allowedOutputs.map((o: any) => ({
            id: o.outputItem.id,
            name: o.outputItem.name,
            sku: o.outputItem.sku,
            baseUnit: o.outputItem.baseUnit,
            expectedWeight: o.expectedWeight,
            expectedUnits: o.expectedUnits,
            isIntermediate: o.isIntermediate || false,
        }))
        : proteinItems;

    // Cargar datos iniciales
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        const [itemsData, areasData, suppliersData, processingsData, statsData, completedData] = await Promise.all([
            getProteinItemsAction(),
            getProcessingAreasAction(),
            getSuppliersAction(),
            getProteinProcessingsAction(),
            getProteinProcessingStatsAction(),
            getCompletedProcessingsForChainAction()
        ]);
        setProteinItems(itemsData);
        setAreas(areasData);
        setSuppliers(suppliersData);
        setProcessings(processingsData);
        setStats(statsData);
        setCompletedProcessings(completedData);

        if (areasData.length > 0) {
            setAreaId(areasData[0].id);
        }

        setIsLoading(false);
    }

    // Agregar subproducto
    function addSubProduct() {
        if ((!newSubProductName && !newSubProductItemId) || newSubProductWeight <= 0) {
            toast.error('Selecciona un producto y peso válido');
            return;
        }

        const selectedItem = proteinItems.find(i => i.id === newSubProductItemId);
        const name = selectedItem ? selectedItem.name : newSubProductName;

        const newProduct: SubProduct = {
            id: Date.now().toString(),
            name: name,
            weight: newSubProductWeight,
            units: newSubProductUnits,
            unitType: newSubProductUnitType,
            outputItemId: newSubProductItemId || undefined
        };

        setSubProducts([...subProducts, newProduct]);
        setNewSubProductName('');
        setNewSubProductItemId('');
        setNewSubProductWeight(0);
        setNewSubProductUnits(1);
    }

    // Crear insumo nuevo on-the-fly
    const handleCreateItem = async () => {
        if (!newItemName.trim()) return;
        setIsCreatingItem(true);
        try {
            // Asumimos userId fijo o del contexto si estuviera disponible, por ahora pasamos uno genérico si no lo tenemos a mano
            // Nota: En una app real usaríamos useAuthStore como en RecipeForm
            const result = await createQuickItem({
                name: newItemName.trim(),
                unit: newItemUnit,
                type: newItemType,
                userId: 'system', // El backend lo revalidará o usará session
                cost: 0,
            });
            if (result.success && result.item) {
                // Actualizar la lista local de items
                setProteinItems(prev => [...prev, result.item!].sort((a, b) => a.name.localeCompare(b.name)));

                // Seleccionar el nuevo item
                setNewSubProductItemId(result.item!.id);
                setNewSubProductName(result.item!.name);
                setNewSubProductUnitType(result.item!.baseUnit);

                toast.success(`Insumo "${newItemName}" creado`);
                setShowCreateItem(false);
                setNewItemName('');
            } else {
                toast.error(result.message || 'Error al crear item');
            }
        } catch (error) {
            toast.error('Error al crear item');
        } finally {
            setIsCreatingItem(false);
        }
    };

    // Eliminar subproducto
    function removeSubProduct(id: string) {
        setSubProducts(subProducts.filter(sp => sp.id !== id));
    }

    // Calcular totales
    const totalSubProductsWeight = subProducts.reduce((sum, sp) => sum + sp.weight, 0);
    const wasteWeight = Math.max(0, drainedWeight - totalSubProductsWeight);
    const wastePercentage = drainedWeight > 0 ? (wasteWeight / drainedWeight) * 100 : 0;
    const yieldPercentage = frozenWeight > 0 ? (totalSubProductsWeight / frozenWeight) * 100 : 0;
    const drainLoss = frozenWeight > 0 ? ((frozenWeight - drainedWeight) / frozenWeight) * 100 : 0;

    // Guardar procesamiento
    async function handleSubmit() {
        if (!sourceItemId) {
            toast.error('Selecciona el producto a procesar');
            return;
        }
        if (frozenWeight <= 0) {
            toast.error('Ingresa el peso congelado');
            return;
        }
        if (drainedWeight <= 0) {
            toast.error('Ingresa el peso escurrido');
            return;
        }
        if (subProducts.length === 0) {
            toast.error('Agrega al menos un subproducto');
            return;
        }

        setIsSubmitting(true);
        const result = await createProteinProcessingAction({
            processDate: new Date(processDate),
            sourceItemId,
            supplierId: supplierId || undefined,
            supplierName: supplierName || undefined,
            frozenWeight,
            drainedWeight,
            areaId,
            notes: notes || undefined,
            reportedWaste: reportedWaste || undefined,
            processingStep: processingStep || 'LIMPIEZA',
            parentProcessingId: parentProcessingId || undefined,
            subProducts: subProducts.map(sp => ({
                name: sp.name,
                weight: sp.weight,
                units: sp.units,
                unitType: sp.unitType,
                outputItemId: sp.outputItemId
            }))
        });

        if (result.success) {
            toast.success(result.message);
            resetForm();
            setViewMode('list');
            loadData();
        } else {
            toast.error(result.message);
        }
        setIsSubmitting(false);
    }

    // Resetear formulario
    function resetForm() {
        setProcessDate(new Date().toISOString().slice(0, 10));
        setSourceItemId('');
        setSupplierId('');
        setSupplierName('');
        setFrozenWeight(0);
        setDrainedWeight(0);
        setNotes('');
        setReportedWaste(0);
        setSubProducts([]);
        setProcessingStep('LIMPIEZA');
        setParentProcessingId('');
    }

    // Ver detalle
    async function viewDetail(id: string) {
        const processing = await getProteinProcessingByIdAction(id);
        setSelectedProcessing(processing);
        setViewMode('detail');
    }

    // Completar procesamiento
    async function handleComplete(id: string) {
        if (!confirm('¿Completar este procesamiento? Se actualizará el inventario.')) return;

        const result = await completeProteinProcessingAction(id);
        if (result.success) { toast.success(result.message); loadData(); setViewMode('list'); }
        else toast.error(result.message);
    }

    // Cancelar procesamiento
    async function handleCancel(id: string) {
        const reason = prompt('Motivo de la cancelación:');
        if (!reason) return;

        const result = await cancelProteinProcessingAction(id, reason);
        if (result.success) { toast.success(result.message); loadData(); setViewMode('list'); }
        else toast.error(result.message);
    }

    // Status badges
    function getStatusBadge(status: string) {
        const meta: Record<string, { tone: string; Icon: LucideIcon; label: string }> = {
            DRAFT: { tone: 'bg-capsula-ivory-alt text-capsula-ink-soft', Icon: Pencil, label: 'Borrador' },
            IN_PROGRESS: { tone: 'bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]', Icon: RefreshCw, label: 'En Proceso' },
            COMPLETED: { tone: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]', Icon: CheckCircle2, label: 'Completado' },
            CANCELLED: { tone: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]', Icon: Ban, label: 'Cancelado' },
        };
        const m = meta[status] || meta.DRAFT;
        const SIcon = m.Icon;
        return (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', m.tone)}>
                <SIcon className="h-3 w-3" /> {m.label}
            </span>
        );
    }

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-capsula-ink-muted">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Cargando…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Procesamiento de proteínas</h1>
                    <p className="mt-1 text-sm text-capsula-ink-soft">
                        Registro de desposte y rendimiento de carnes
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => { setViewMode('list'); setSelectedProcessing(null); }}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                            viewMode === 'list'
                                ? 'bg-capsula-navy-deep text-capsula-ivory shadow-cap-soft'
                                : 'border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt'
                        )}
                    >
                        <ClipboardList className="h-4 w-4" /> Ver Registros
                    </button>
                    <button
                        onClick={() => { setViewMode('create'); resetForm(); }}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                            viewMode === 'create'
                                ? 'bg-capsula-navy-deep text-capsula-ivory shadow-cap-soft'
                                : 'border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt'
                        )}
                    >
                        <Plus className="h-4 w-4" /> Nuevo Procesamiento
                    </button>
                    <button
                        onClick={() => setViewMode('templates')}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                            viewMode === 'templates'
                                ? 'bg-capsula-navy-deep text-capsula-ivory shadow-cap-soft'
                                : 'border border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:bg-capsula-ivory-alt'
                        )}
                    >
                        <ClipboardList className="h-4 w-4" /> Plantillas
                    </button>
                </div>
            </div>

            {/* Estadísticas */}
            {stats && viewMode === 'list' && (
                <div className="grid gap-4 sm:grid-cols-5">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-sm text-capsula-ink-muted">Total Procesamientos</p>
                        <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">{stats.totalProcessings}</p>
                    </div>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-sm text-capsula-ink-muted">Peso Total Procesado</p>
                        <p className="font-semibold text-2xl tracking-[-0.02em] text-blue-600">{formatNumber(stats.totalFrozenWeight)} kg</p>
                    </div>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-sm text-capsula-ink-muted">Subproductos Obtenidos</p>
                        <p className="font-semibold text-2xl tracking-[-0.02em] text-emerald-600">{formatNumber(stats.totalSubProducts)} kg</p>
                    </div>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-sm text-capsula-ink-muted">Rendimiento Promedio</p>
                        <p className="font-semibold text-2xl tracking-[-0.02em] tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(stats.avgYield)}%</p>
                    </div>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-sm text-capsula-ink-muted">Desperdicio Promedio</p>
                        <p className="font-semibold text-2xl tracking-[-0.02em] text-red-600">{formatNumber(stats.avgWaste)}%</p>
                    </div>
                </div>
            )}

            {/* Vista: Lista de procesamientos */}
            {viewMode === 'list' && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-capsula-line bg-capsula-ivory-alt">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Código</th>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Fecha</th>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Producto</th>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Proveedor</th>
                                    <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Peso Inicial</th>
                                    <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Rendimiento</th>
                                    <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Estado</th>
                                    <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-capsula-line">
                                {processings.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-capsula-ink-muted">
                                            <ClipboardList className="mx-auto h-10 w-10 text-capsula-ink-faint" />
                                            <p className="mt-2">No hay procesamientos registrados</p>
                                            <button
                                                onClick={() => setViewMode('create')}
                                                className="pos-btn mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
                                            >
                                                <Plus className="h-4 w-4" /> Crear primer procesamiento
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    processings.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-capsula-ivory-surface">
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => viewDetail(p.id)}
                                                    className="font-medium text-capsula-coral hover:underline"
                                                >
                                                    {p.code}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-sm tabular-nums text-capsula-ink-muted">
                                                {new Date(p.processDate).toLocaleDateString('es-VE')}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-capsula-ink">{p.sourceItem}</td>
                                            <td className="px-6 py-4 text-sm text-capsula-ink-muted">{p.supplier}</td>
                                            <td className="px-6 py-4 text-center font-mono tabular-nums text-capsula-ink">{formatNumber(p.frozenWeight)} kg</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn(
                                                    'font-semibold tabular-nums',
                                                    p.yieldPercentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                                                        p.yieldPercentage >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                                                )}>
                                                    {formatNumber(p.yieldPercentage)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {getStatusBadge(p.status)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        onClick={() => viewDetail(p.id)}
                                                        className="rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                                        title="Ver detalle"
                                                        aria-label="Ver detalle"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {p.status === 'DRAFT' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleComplete(p.id)}
                                                                className="rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-[#E5EDE7] hover:text-[#2F6B4E] dark:hover:bg-[#1E3B2C] dark:hover:text-[#6FB88F]"
                                                                title="Completar"
                                                                aria-label="Completar"
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancel(p.id)}
                                                                className="rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                                title="Cancelar"
                                                                aria-label="Cancelar"
                                                            >
                                                                <Ban className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Vista: Crear procesamiento */}
            {viewMode === 'create' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Formulario principal */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                        <div className="border-b border-capsula-line px-6 py-4">
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Datos del Procesamiento</h2>
                        </div>

                        <div className="space-y-4 p-6">
                            {/* Fecha */}
                            <div>
                                <label className="pos-label">Fecha</label>
                                <input
                                    type="date"
                                    value={processDate}
                                    onChange={(e) => setProcessDate(e.target.value)}
                                    className="pos-input mt-1 w-full"
                                />
                            </div>

                            {/* Paso del Procesamiento */}
                            <div>
                                <label className="pos-label mb-2">Paso del Procesamiento</label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {Object.entries(STEP_CONFIG).map(([value, config]) => {
                                        const hasTemplate = templateChain.some((t: any) => t.processingStep === value);
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setProcessingStep(value)}
                                                className={cn(
                                                    'relative rounded-xl border-2 px-3 py-3 text-xs font-medium transition-all',
                                                    processingStep === value
                                                        ? `${config.bgColor} ${config.borderColor} ${config.color} ring-2 ring-offset-1`
                                                        : 'border-capsula-line text-capsula-ink-muted hover:bg-capsula-ivory-alt'
                                                )}
                                            >
                                                {(() => { const StepIcon = config.Icon; return <StepIcon className="mx-auto h-5 w-5" />; })()}
                                                <span className="mt-0.5 block">{config.label}</span>
                                                {hasTemplate && (
                                                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-capsula-ivory bg-capsula-coral" title="Tiene plantilla"></span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Template chain indicator */}
                                {templateChain.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-capsula-ink-muted">
                                        <span>Cadena disponible:</span>
                                        {templateChain
                                            .sort((a: any, b: any) => a.chainOrder - b.chainOrder)
                                            .map((t: any, i: number) => {
                                                const sc = STEP_CONFIG[t.processingStep] || STEP_CONFIG['CUSTOM'];
                                                return (
                                                    <span key={t.id} className="flex items-center gap-0.5">
                                                        {i > 0 && <span className="text-capsula-ink-faint">→</span>}
                                                        <span className={cn(
                                                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
                                                            t.processingStep === processingStep ? `${sc.bgColor} ${sc.color}` : 'text-capsula-ink-faint'
                                                        )}>
                                                            <sc.Icon className="h-3 w-3" /> {sc.label}
                                                        </span>
                                                    </span>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* Encadenar con procesamiento previo (P5) */}
                            {processingStep !== 'LIMPIEZA' && completedProcessings.length > 0 && (
                                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-900/10">
                                    <label className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-purple-800 dark:text-purple-300">
                                        <Link2 className="h-4 w-4" /> Encadenar con procesamiento anterior
                                    </label>
                                    <select
                                        value={parentProcessingId}
                                        onChange={(e) => {
                                            setParentProcessingId(e.target.value);
                                            // Auto-fill frozen weight from parent's total output
                                            if (e.target.value) {
                                                const parent = completedProcessings.find(p => p.id === e.target.value);
                                                if (parent) {
                                                    setFrozenWeight(parent.totalSubProducts);
                                                    // Auto-select the first sub-product as source item
                                                    if (parent.subProducts.length > 0 && parent.subProducts[0].outputItemId) {
                                                        setSourceItemId(parent.subProducts[0].outputItemId);
                                                    }
                                                }
                                            }
                                        }}
                                        className="w-full rounded-lg border border-purple-200 bg-capsula-ivory px-4 py-2.5 text-sm text-capsula-ink dark:border-purple-700"
                                    >
                                        <option value="">Sin encadenar (nuevo procesamiento)</option>
                                        {completedProcessings.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.code} — {p.sourceItem.name} ({p.processingStep}) — {p.totalSubProducts.toFixed(2)} kg output
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                                        El peso de entrada se auto-llenará con la salida del paso anterior
                                    </p>
                                </div>
                            )}

                            {/* Producto a procesar */}
                            <div>
                                <label className="pos-label">Producto a Procesar *</label>
                                <Combobox
                                    items={proteinItems.map(item => ({
                                        value: item.id,
                                        label: `${item.name} (${item.category || 'Sin categoría'})`
                                    }))}
                                    value={sourceItemId}
                                    onChange={(val) => setSourceItemId(val)}
                                    placeholder="Seleccionar producto..."
                                    searchPlaceholder="Buscar producto..."
                                    emptyMessage="No se encontró producto."
                                />
                            </div>

                            {/* Proveedor */}
                            <div>
                                <label className="pos-label">Proveedor</label>
                                <Combobox
                                    items={suppliers.map(s => ({
                                        value: s.id,
                                        label: s.name
                                    }))}
                                    value={supplierId}
                                    onChange={(val) => setSupplierId(val)}
                                    placeholder="Seleccionar proveedor..."
                                    searchPlaceholder="Buscar proveedor..."
                                    emptyMessage="No se encontró proveedor."
                                />
                                {!supplierId && (
                                    <input
                                        type="text"
                                        value={supplierName}
                                        onChange={(e) => setSupplierName(e.target.value)}
                                        placeholder="O escribir nombre del proveedor..."
                                        className="pos-input mt-2 w-full"
                                    />
                                )}
                            </div>

                            {/* Área */}
                            <div>
                                <label className="pos-label">Área de Procesamiento</label>
                                <Combobox
                                    items={areas.map(area => ({
                                        value: area.id,
                                        label: area.name
                                    }))}
                                    value={areaId}
                                    onChange={(val) => setAreaId(val)}
                                    placeholder="Seleccionar área..."
                                    searchPlaceholder="Buscar área..."
                                    emptyMessage="No se encontró área."
                                />
                            </div>

                            {/* Pesos */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="pos-label">Peso Congelado (kg) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={frozenWeight || ''}
                                        onChange={(e) => setFrozenWeight(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="pos-input mt-1 w-full tabular-nums"
                                    />
                                </div>
                                <div>
                                    <label className="pos-label">Peso Escurrido (kg) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={drainedWeight || ''}
                                        onChange={(e) => setDrainedWeight(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="pos-input mt-1 w-full tabular-nums"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="pos-label">Desperdicio Reportado (kg) — Entrada Manual</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={reportedWaste || ''}
                                        onChange={(e) => setReportedWaste(parseFloat(e.target.value) || 0)}
                                        placeholder="Ingresa el desperdicio real según Excel..."
                                        className="mt-1 w-full rounded-lg border border-red-200 bg-red-50/30 px-4 py-2.5 tabular-nums text-capsula-ink focus:border-red-500 focus:outline-none dark:border-red-900 dark:bg-red-950/30"
                                    />
                                    <p className="mt-1 text-[10px] text-capsula-ink-muted">
                                        * Este valor se usará para tus reportes de merma real.
                                    </p>
                                </div>
                            </div>

                            {/* Pérdida por escurrido / Ganancia de peso */}
                            {frozenWeight > 0 && drainedWeight > 0 && (
                                <div className={cn(
                                    'rounded-lg p-3 text-sm',
                                    drainedWeight > frozenWeight
                                        ? 'bg-purple-50 dark:bg-purple-950/30'
                                        : 'bg-blue-50 dark:bg-blue-950/30'
                                )}>
                                    {drainedWeight > frozenWeight ? (
                                        <span className="text-purple-700">
                                            ↑ Ganancia de peso: <strong>{formatNumber(drainedWeight - frozenWeight)} kg</strong> ({formatNumber(((drainedWeight - frozenWeight) / frozenWeight) * 100)}%)
                                            <span className="mt-0.5 block text-xs opacity-70">Se agregaron condimentos/marinado</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-blue-700">
                                            <Droplets className="h-3.5 w-3.5" />
                                            Pérdida por escurrido: <strong>{formatNumber(frozenWeight - drainedWeight)} kg</strong> ({formatNumber(drainLoss)}%)
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Notas */}
                            <div>
                                <label className="pos-label">Notas</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Observaciones del procesamiento..."
                                    rows={2}
                                    className="pos-input mt-1 w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Subproductos */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                        <div className="border-b border-capsula-line px-6 py-4">
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Subproductos ({subProducts.length})</h2>
                        </div>

                        <div className="space-y-4 p-6">
                            {/* Agregar subproducto */}
                            <div className="space-y-4 rounded-lg border border-capsula-line bg-capsula-ivory-alt p-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="text-sm font-medium text-capsula-ink-soft">Nuevo corte / subproducto</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateItem(!showCreateItem)}
                                        className="text-xs font-medium text-emerald-600 underline transition-colors hover:text-emerald-700 dark:text-emerald-400"
                                    >
                                        {showCreateItem ? 'Cancelar creación' : '+ Crear nuevo item en inventario'}
                                    </button>
                                </div>

                                {/* Mini form crear item */}
                                {showCreateItem && (
                                    <div className="animate-in fade-in slide-in-from-top-2 mb-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                                        <div className="mb-3 grid grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                value={newItemName}
                                                onChange={(e) => setNewItemName(e.target.value)}
                                                placeholder="Nombre (ej: Huesos de Pollo)"
                                                className="col-span-2 rounded border border-emerald-200 bg-capsula-ivory px-3 py-1.5 text-sm text-capsula-ink dark:border-emerald-800"
                                                autoFocus
                                            />
                                            <select
                                                value={newItemUnit}
                                                onChange={(e) => setNewItemUnit(e.target.value)}
                                                className="rounded border border-emerald-200 bg-capsula-ivory px-3 py-1.5 text-sm text-capsula-ink dark:border-emerald-800"
                                            >
                                                <option value="KG">Kilogramos</option>
                                                <option value="G">Gramos</option>
                                                <option value="UNIT">Unidad</option>
                                            </select>
                                            <select
                                                value={newItemType}
                                                onChange={(e) => setNewItemType(e.target.value)}
                                                className="rounded border border-emerald-200 bg-capsula-ivory px-3 py-1.5 text-sm text-capsula-ink dark:border-emerald-800"
                                            >
                                                <option value="RAW_MATERIAL">Materia Prima</option>
                                                <option value="SUB_RECIPE">Sub-receta</option>
                                                <option value="FINISHED_GOOD">Producto Final</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={handleCreateItem}
                                            disabled={!newItemName.trim() || isCreatingItem}
                                            className="w-full rounded bg-emerald-600 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            {isCreatingItem ? 'Creando…' : 'Guardar Item'}
                                        </button>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="flex-1">
                                        {activeTemplate && (
                                            <div className={cn(
                                                'mb-2 px-3 py-2 rounded-lg border text-xs',
                                                STEP_CONFIG[activeTemplate.processingStep]?.bgColor || 'bg-amber-50',
                                                STEP_CONFIG[activeTemplate.processingStep]?.borderColor || 'border-amber-200',
                                                STEP_CONFIG[activeTemplate.processingStep]?.color || 'text-amber-700'
                                            )}>
                                                <div className="flex items-center gap-1.5">
                                                    {(() => {
                                                        const TplIcon = STEP_CONFIG[activeTemplate.processingStep]?.Icon ?? ClipboardList;
                                                        return <TplIcon className="h-3.5 w-3.5" />;
                                                    })()}
                                                    <strong>{activeTemplate.name}</strong>
                                                    <span className="opacity-70">({activeTemplate.allowedOutputs.length} subproductos)</span>
                                                    {activeTemplate.canGainWeight && (
                                                        <span className="ml-1 rounded-full bg-purple-200 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">↑ Peso puede aumentar</span>
                                                    )}
                                                </div>
                                                {activeTemplate.allowedOutputs.some((o: any) => o.isIntermediate) && (
                                                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] opacity-70">
                                                        <Link2 className="h-3 w-3" /> Algunos productos son intermedios y pasarán al siguiente paso de la cadena.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        <Combobox
                                            items={availableSubItems.map((item: any) => ({
                                                value: item.id,
                                                label: `${item.name} (${item.baseUnit})${item.expectedWeight ? ` ~${item.expectedWeight}kg` : ''}`
                                            }))}
                                            value={newSubProductItemId}
                                            onChange={(val) => {
                                                const item = availableSubItems.find((i: any) => i.id === val);
                                                setNewSubProductItemId(val);
                                                if (item) {
                                                    setNewSubProductName(item.name);
                                                    setNewSubProductUnitType(item.baseUnit);
                                                    // Pre-fill expected weight from template if available
                                                    if (item.expectedWeight && newSubProductWeight === 0) {
                                                        setNewSubProductWeight(item.expectedWeight);
                                                    }
                                                    if (item.expectedUnits) {
                                                        setNewSubProductUnits(item.expectedUnits);
                                                    }
                                                }
                                            }}
                                            placeholder={activeTemplate ? "-- Seleccionar subproducto de plantilla --" : "-- Seleccionar item existente --"}
                                            searchPlaceholder="Buscar item..."
                                            emptyMessage={activeTemplate ? "No hay más subproductos en esta plantilla." : "No se encontró el item."}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative w-24">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newSubProductWeight || ''}
                                                onChange={(e) => setNewSubProductWeight(parseFloat(e.target.value) || 0)}
                                                placeholder="Peso"
                                                className="pos-input w-full px-3 py-2 text-sm tabular-nums"
                                            />
                                            <span className="absolute right-2 top-2 text-xs text-capsula-ink-muted">{newSubProductUnitType}</span>
                                        </div>
                                        <div className="relative w-20">
                                            <input
                                                type="number"
                                                value={newSubProductUnits || ''}
                                                onChange={(e) => setNewSubProductUnits(parseInt(e.target.value) || 1)}
                                                placeholder="Uds"
                                                className="pos-input w-full px-3 py-2 text-sm tabular-nums"
                                            />
                                            <span className="absolute right-2 top-2 text-xs text-capsula-ink-muted">pza</span>
                                        </div>
                                        <button
                                            onClick={addSubProduct}
                                            className="pos-btn inline-flex items-center justify-center px-4 py-2"
                                            aria-label="Agregar subproducto"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Lista de subproductos */}
                            <div className="max-h-[300px] space-y-2 overflow-y-auto">
                                {subProducts.length === 0 ? (
                                    <p className="py-8 text-center text-capsula-ink-muted">
                                        Agrega los cortes/subproductos obtenidos
                                    </p>
                                ) : (
                                    subProducts.map((sp, index) => {
                                        const templateOutput = activeTemplate?.allowedOutputs?.find((o: any) => o.outputItem?.id === sp.outputItemId);
                                        const isIntermediate = templateOutput?.isIntermediate || false;
                                        return (
                                            <div key={sp.id} className={cn(
                                                'flex items-center justify-between rounded-lg p-3',
                                                isIntermediate ? 'border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30' : 'bg-capsula-ivory-alt'
                                            )}>
                                                <div className="flex-1">
                                                    <span className="mr-2 text-capsula-ink-muted tabular-nums">{index + 1}.</span>
                                                    <span className="font-medium text-capsula-ink">{sp.name}</span>
                                                    {isIntermediate && (
                                                        <span className="ml-2 rounded bg-orange-200 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">Intermedio</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-sm tabular-nums text-capsula-ink">{formatNumber(sp.weight)} kg</span>
                                                    <span className="text-xs text-capsula-ink-muted tabular-nums">({sp.units} pza)</span>
                                                    <button
                                                        onClick={() => removeSubProduct(sp.id)}
                                                        className="rounded p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                        aria-label={`Quitar ${sp.name}`}
                                                    >
                                                        <XIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Resumen */}
                            <div className="space-y-2 border-t border-capsula-line pt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-capsula-ink-muted">Total Subproductos:</span>
                                    <span className="font-semibold tabular-nums text-capsula-ink">{formatNumber(totalSubProductsWeight)} kg</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-capsula-ink-muted">Desperdicio:</span>
                                    <span className={cn('font-semibold tabular-nums', wasteWeight > 0 ? 'text-red-600 dark:text-red-400' : 'text-capsula-ink-soft')}>
                                        {formatNumber(wasteWeight)} kg ({formatNumber(wastePercentage)}%)
                                    </span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span className="text-capsula-ink">Rendimiento:</span>
                                    <span className={cn(
                                        'tabular-nums',
                                        yieldPercentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                                            yieldPercentage >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                                    )}>
                                        {formatNumber(yieldPercentage)}%
                                    </span>
                                </div>
                            </div>

                            {/* Botón guardar */}
                            <button
                                onClick={handleSubmit}
                                disabled={!sourceItemId || frozenWeight <= 0 || subProducts.length === 0 || isSubmitting}
                                className="pos-btn inline-flex w-full items-center justify-center gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" /> {isSubmitting ? 'Guardando…' : 'Guardar Procesamiento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vista: Detalle */}
            {viewMode === 'detail' && selectedProcessing && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                    <div className="flex items-center justify-between border-b border-capsula-line px-6 py-4">
                        <div>
                            <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">{selectedProcessing.code}</h2>
                            <p className="text-sm text-capsula-ink-muted">
                                {new Date(selectedProcessing.processDate).toLocaleDateString('es-VE', {
                                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                })}
                            </p>
                        </div>
                        {getStatusBadge(selectedProcessing.status)}
                    </div>

                    <div className="grid gap-6 p-6 lg:grid-cols-2">
                        {/* Info general */}
                        <div className="space-y-4">
                            <h3 className="font-medium text-capsula-ink">Información General</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Producto:</span>
                                    <span className="font-medium text-capsula-ink">{selectedProcessing.sourceItem.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Proveedor:</span>
                                    <span className="text-capsula-ink">{selectedProcessing.supplier?.name || selectedProcessing.supplierName || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Área:</span>
                                    <span className="text-capsula-ink">{selectedProcessing.area.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Creado por:</span>
                                    <span className="text-capsula-ink">{selectedProcessing.createdBy.firstName} {selectedProcessing.createdBy.lastName}</span>
                                </div>
                            </div>

                            <h3 className="pt-4 font-medium text-capsula-ink">Pesos y Rendimiento</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Peso Congelado:</span>
                                    <span className="font-mono tabular-nums text-capsula-ink">{formatNumber(selectedProcessing.frozenWeight)} kg</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Peso Escurrido:</span>
                                    <span className="font-mono tabular-nums text-capsula-ink">{formatNumber(selectedProcessing.drainedWeight)} kg</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Total Subproductos:</span>
                                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(selectedProcessing.totalSubProducts)} kg</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Desperdicio:</span>
                                    <span className="font-mono tabular-nums text-red-600 dark:text-red-400">{formatNumber(selectedProcessing.wasteWeight)} kg ({formatNumber(selectedProcessing.wastePercentage)}%)</span>
                                </div>
                                <div className="flex justify-between border-t border-capsula-line pt-2 text-lg font-bold">
                                    <span className="text-capsula-ink">Rendimiento:</span>
                                    <span className={cn(
                                        'tabular-nums',
                                        selectedProcessing.yieldPercentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                                            selectedProcessing.yieldPercentage >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                                    )}>
                                        {formatNumber(selectedProcessing.yieldPercentage)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Subproductos */}
                        <div>
                            <h3 className="mb-4 font-medium text-capsula-ink">Subproductos Obtenidos</h3>
                            <div className="space-y-2">
                                {selectedProcessing.subProducts.map((sp: any, index: number) => (
                                    <div key={sp.id} className="flex items-center justify-between rounded-lg bg-capsula-ivory-alt p-3">
                                        <div>
                                            <span className="mr-2 text-capsula-ink-muted tabular-nums">{index + 1}.</span>
                                            <span className="font-medium text-capsula-ink">{sp.name}</span>
                                            {sp.outputItem && (
                                                <span className="ml-2 text-xs text-capsula-coral">
                                                    → {sp.outputItem.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono tabular-nums text-capsula-ink">{formatNumber(sp.weight)} kg</span>
                                            <span className="ml-2 text-xs text-capsula-ink-muted tabular-nums">({sp.units} pza)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Acciones */}
                    {selectedProcessing.status === 'DRAFT' && (
                        <div className="flex justify-end gap-3 border-t border-capsula-line px-6 py-4">
                            <button
                                onClick={() => handleCancel(selectedProcessing.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-capsula-line bg-capsula-coral/10 px-4 py-2 font-medium text-capsula-coral transition-colors hover:bg-capsula-coral/20"
                            >
                                <Ban className="h-4 w-4" /> Cancelar
                            </button>
                            <button
                                onClick={() => handleComplete(selectedProcessing.id)}
                                className="pos-btn inline-flex items-center gap-2 px-4 py-2"
                            >
                                <CheckCircle2 className="h-4 w-4" /> Completar y Actualizar Inventario
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Vista: Plantillas de Procesamiento */}
            {viewMode === 'templates' && (
                <ProcessingTemplates />
            )}
        </div>
    );
}
