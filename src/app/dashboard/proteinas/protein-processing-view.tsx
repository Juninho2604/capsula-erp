'use client';

import { useState, useEffect } from 'react';
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
import type { LucideIcon } from 'lucide-react';
import {
    Sparkles, Utensils, Package, Settings, ClipboardList, Beef,
    FileText, PlayCircle, CheckCircle2, XCircle, Plus, Eye, Trash2,
    Loader2, Link2, TrendingUp, ListChecks, ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

const STEP_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
    'LIMPIEZA':     { label: 'Limpieza',      icon: Sparkles },
    'MASERADO':     { label: 'Maserado',      icon: Utensils },
    'DISTRIBUCION': { label: 'Distribución',  icon: Package },
    'CUSTOM':       { label: 'Personalizado', icon: Settings },
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
                        toast('En este paso el peso puede AUMENTAR (ej: condimentos)');
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
            alert('Selecciona el producto a procesar');
            return;
        }
        if (frozenWeight <= 0) {
            alert('Ingresa el peso congelado');
            return;
        }
        if (drainedWeight <= 0) {
            alert('Ingresa el peso escurrido');
            return;
        }
        if (subProducts.length === 0) {
            alert('Agrega al menos un subproducto');
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
            alert(`✅ ${result.message}`);
            resetForm();
            setViewMode('list');
            loadData();
        } else {
            alert(`❌ ${result.message}`);
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
        alert(result.message);
        if (result.success) {
            loadData();
            setViewMode('list');
        }
    }

    // Cancelar procesamiento
    async function handleCancel(id: string) {
        const reason = prompt('Motivo de la cancelación:');
        if (!reason) return;

        const result = await cancelProteinProcessingAction(id, reason);
        alert(result.message);
        if (result.success) {
            loadData();
            setViewMode('list');
        }
    }

    // Status badges
    function getStatusBadge(status: string) {
        const variantMap: Record<string, 'neutral' | 'info' | 'ok' | 'danger'> = {
            DRAFT: 'neutral',
            IN_PROGRESS: 'info',
            COMPLETED: 'ok',
            CANCELLED: 'danger',
        };
        const labels: Record<string, string> = {
            DRAFT: 'Borrador',
            IN_PROGRESS: 'En proceso',
            COMPLETED: 'Completado',
            CANCELLED: 'Cancelado',
        };
        const StatusIcon =
            status === 'DRAFT' ? FileText :
            status === 'IN_PROGRESS' ? PlayCircle :
            status === 'COMPLETED' ? CheckCircle2 :
            status === 'CANCELLED' ? XCircle : FileText;
        return (
            <Badge variant={variantMap[status] || 'neutral'}>
                <StatusIcon className="h-3 w-3" strokeWidth={1.5} />
                {labels[status] || status}
            </Badge>
        );
    }

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-capsula-navy" strokeWidth={1.5} />
                    <p className="mt-3 text-[13px] text-capsula-ink-muted">Cargando…</p>
                </div>
            </div>
        );
    }

    const viewTabs: { id: typeof viewMode; label: string; icon: LucideIcon }[] = [
        { id: 'list', label: 'Ver registros', icon: ListChecks },
        { id: 'create', label: 'Nuevo procesamiento', icon: Plus },
        { id: 'templates', label: 'Plantillas', icon: ClipboardList },
    ];

    return (
        <div className="mx-auto max-w-[1400px] animate-in">
            <PageHeader
                kicker="Inventario"
                title="Procesamiento de proteínas"
                description="Registro de desposte y rendimiento de carnes."
                actions={
                    <div className="inline-flex rounded-full border border-capsula-line bg-capsula-ivory-surface p-1">
                        {viewTabs.map(tab => {
                            const Icon = tab.icon;
                            const active = viewMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        if (tab.id === 'list') { setViewMode('list'); setSelectedProcessing(null); }
                                        else if (tab.id === 'create') { setViewMode('create'); resetForm(); }
                                        else setViewMode('templates');
                                    }}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-colors',
                                        active
                                            ? 'bg-capsula-navy-deep text-capsula-ivory'
                                            : 'text-capsula-ink-muted hover:text-capsula-ink',
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {tab.label}
                                </button>
                            );
                        })}
                    </div>
                }
            />

            {/* Estadísticas */}
            {stats && viewMode === 'list' && (
                <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <KpiCard label="Total procesamientos" value={stats.totalProcessings} icon={ClipboardList} />
                    <KpiCard label="Peso total procesado" value={`${formatNumber(stats.totalFrozenWeight)} kg`} icon={Beef} />
                    <KpiCard label="Subproductos obtenidos" value={`${formatNumber(stats.totalSubProducts)} kg`} icon={Package} />
                    <KpiCard label="Rendimiento promedio" value={`${formatNumber(stats.avgYield)}%`} icon={TrendingUp} trend="up" />
                    <KpiCard label="Desperdicio promedio" value={`${formatNumber(stats.avgWaste)}%`} icon={Trash2} trend={stats.avgWaste > 15 ? 'down' : 'flat'} />
                </div>
            )}

            {/* Vista: Lista de procesamientos */}
            {viewMode === 'list' && (
                <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[13px]">
                            <thead>
                                <tr className="border-b border-capsula-line bg-capsula-ivory">
                                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Código</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Fecha</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Producto</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Proveedor</th>
                                    <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Peso inicial</th>
                                    <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Rendimiento</th>
                                    <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Estado</th>
                                    <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processings.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-14 text-center">
                                            <Beef className="mx-auto h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
                                            <p className="mt-3 text-[14px] font-medium text-capsula-ink">No hay procesamientos registrados</p>
                                            <div className="mt-4">
                                                <Button variant="primary" size="sm" onClick={() => setViewMode('create')}>
                                                    <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Crear primer procesamiento
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    processings.map((p: any) => (
                                        <tr key={p.id} className="border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory">
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => viewDetail(p.id)}
                                                    className="font-mono text-[12.5px] font-semibold text-capsula-navy hover:text-capsula-coral hover:underline"
                                                >
                                                    {p.code}
                                                </button>
                                            </td>
                                            <td className="px-5 py-3 text-capsula-ink-soft">
                                                {new Date(p.processDate).toLocaleDateString('es-VE')}
                                            </td>
                                            <td className="px-5 py-3 font-medium text-capsula-ink">{p.sourceItem}</td>
                                            <td className="px-5 py-3 text-capsula-ink-soft">{p.supplier}</td>
                                            <td className="px-5 py-3 text-center font-mono text-[12.5px] text-capsula-ink">
                                                {formatNumber(p.frozenWeight)} <span className="text-capsula-ink-muted">kg</span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={cn(
                                                    'font-mono text-[13px] font-semibold',
                                                    p.yieldPercentage >= 70 ? 'text-[#2F6B4E]' :
                                                    p.yieldPercentage >= 50 ? 'text-[#946A1C]' : 'text-capsula-coral',
                                                )}>
                                                    {formatNumber(p.yieldPercentage)}%
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                {getStatusBadge(p.status)}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => viewDetail(p.id)}
                                                        className="rounded-md p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-navy"
                                                        title="Ver detalle"
                                                    >
                                                        <Eye className="h-4 w-4" strokeWidth={1.5} />
                                                    </button>
                                                    {p.status === 'DRAFT' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleComplete(p.id)}
                                                                className="rounded-md p-1.5 text-capsula-ink-muted transition-colors hover:bg-[#E5EDE7] hover:text-[#2F6B4E]"
                                                                title="Completar"
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancel(p.id)}
                                                                className="rounded-md p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                                                title="Cancelar"
                                                            >
                                                                <XCircle className="h-4 w-4" strokeWidth={1.5} />
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
                    <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                        <div className="flex items-center gap-2 border-b border-capsula-line bg-capsula-ivory px-5 py-3">
                            <ClipboardList className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
                            <h2 className="font-medium text-capsula-ink">Datos del procesamiento</h2>
                        </div>

                        <div className="space-y-4 p-5">
                            {/* Fecha */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Fecha</label>
                                <input
                                    type="date"
                                    value={processDate}
                                    onChange={(e) => setProcessDate(e.target.value)}
                                    className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                />
                            </div>

                            {/* Paso del procesamiento */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Paso del procesamiento</label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {Object.entries(STEP_CONFIG).map(([value, config]) => {
                                        const Icon = config.icon;
                                        const hasTemplate = templateChain.some((t: any) => t.processingStep === value);
                                        const active = processingStep === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setProcessingStep(value)}
                                                className={cn(
                                                    'relative rounded-[var(--radius)] border px-3 py-3 text-left transition-colors',
                                                    active
                                                        ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                                                        : 'border-capsula-line bg-capsula-ivory-surface hover:border-capsula-line-strong',
                                                )}
                                            >
                                                <Icon
                                                    className={cn('mb-1 h-4 w-4', active ? 'text-capsula-navy-deep' : 'text-capsula-ink-soft')}
                                                    strokeWidth={1.5}
                                                />
                                                <span className={cn('block text-[12px] font-medium', active ? 'text-capsula-navy-deep' : 'text-capsula-ink')}>
                                                    {config.label}
                                                </span>
                                                {hasTemplate && (
                                                    <span
                                                        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-capsula-ivory-surface bg-capsula-coral"
                                                        title="Tiene plantilla"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Template chain indicator */}
                                {templateChain.length > 0 && (
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-capsula-ink-muted">
                                        <ClipboardList className="h-3 w-3" strokeWidth={1.5} />
                                        <span>Cadena disponible:</span>
                                        {templateChain
                                            .sort((a: any, b: any) => a.chainOrder - b.chainOrder)
                                            .map((t: any, i: number) => {
                                                const sc = STEP_CONFIG[t.processingStep] || STEP_CONFIG['CUSTOM'];
                                                const ChainIcon = sc.icon;
                                                const activeStep = t.processingStep === processingStep;
                                                return (
                                                    <span key={t.id} className="inline-flex items-center gap-1">
                                                        {i > 0 && <ArrowRight className="h-3 w-3 text-capsula-ink-faint" strokeWidth={1.5} />}
                                                        <span className={cn(
                                                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
                                                            activeStep
                                                                ? 'bg-capsula-navy-soft text-capsula-navy-deep'
                                                                : 'text-capsula-ink-faint',
                                                        )}>
                                                            <ChainIcon className="h-3 w-3" strokeWidth={1.5} />
                                                            {sc.label}
                                                        </span>
                                                    </span>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* Encadenar con procesamiento previo */}
                            {processingStep !== 'LIMPIEZA' && completedProcessings.length > 0 && (
                                <div className="rounded-[var(--radius)] border border-capsula-coral/20 bg-capsula-coral-subtle/40 p-3">
                                    <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-capsula-coral">
                                        <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Encadenar con procesamiento anterior
                                    </label>
                                    <select
                                        value={parentProcessingId}
                                        onChange={(e) => {
                                            setParentProcessingId(e.target.value);
                                            if (e.target.value) {
                                                const parent = completedProcessings.find(p => p.id === e.target.value);
                                                if (parent) {
                                                    setFrozenWeight(parent.totalSubProducts);
                                                    if (parent.subProducts.length > 0 && parent.subProducts[0].outputItemId) {
                                                        setSourceItemId(parent.subProducts[0].outputItemId);
                                                    }
                                                }
                                            }
                                        }}
                                        className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                    >
                                        <option value="">Sin encadenar (nuevo procesamiento)</option>
                                        {completedProcessings.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.code} — {p.sourceItem.name} ({p.processingStep}) — {p.totalSubProducts.toFixed(2)} kg output
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-[11px] text-capsula-coral/80">
                                        El peso de entrada se auto-llenará con la salida del paso anterior.
                                    </p>
                                </div>
                            )}

                            {/* Producto a procesar */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Producto a procesar *</label>
                                <Combobox
                                    items={proteinItems.map(item => ({
                                        value: item.id,
                                        label: `${item.name} (${item.category || 'Sin categoría'})`,
                                    }))}
                                    value={sourceItemId}
                                    onChange={(val) => setSourceItemId(val)}
                                    placeholder="Seleccionar producto…"
                                    searchPlaceholder="Buscar producto…"
                                    emptyMessage="No se encontró producto."
                                />
                            </div>

                            {/* Proveedor */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Proveedor</label>
                                <Combobox
                                    items={suppliers.map(s => ({ value: s.id, label: s.name }))}
                                    value={supplierId}
                                    onChange={(val) => setSupplierId(val)}
                                    placeholder="Seleccionar proveedor…"
                                    searchPlaceholder="Buscar proveedor…"
                                    emptyMessage="No se encontró proveedor."
                                />
                                {!supplierId && (
                                    <input
                                        type="text"
                                        value={supplierName}
                                        onChange={(e) => setSupplierName(e.target.value)}
                                        placeholder="O escribir nombre del proveedor…"
                                        className="mt-2 min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                    />
                                )}
                            </div>

                            {/* Área */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Área de procesamiento</label>
                                <Combobox
                                    items={areas.map(area => ({ value: area.id, label: area.name }))}
                                    value={areaId}
                                    onChange={(val) => setAreaId(val)}
                                    placeholder="Seleccionar área…"
                                    searchPlaceholder="Buscar área…"
                                    emptyMessage="No se encontró área."
                                />
                            </div>

                            {/* Pesos */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Peso congelado (kg) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={frozenWeight || ''}
                                        onChange={(e) => setFrozenWeight(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-right font-mono text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Peso escurrido (kg) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={drainedWeight || ''}
                                        onChange={(e) => setDrainedWeight(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-right font-mono text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Desperdicio reportado (kg) — entrada manual</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={reportedWaste || ''}
                                        onChange={(e) => setReportedWaste(parseFloat(e.target.value) || 0)}
                                        placeholder="Ingresa el desperdicio real según Excel…"
                                        className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle/30 px-3 py-2 text-right font-mono text-[14px] text-capsula-ink outline-none focus:border-capsula-coral"
                                    />
                                    <p className="mt-1 text-[10.5px] text-capsula-ink-muted">
                                        Este valor se usará para tus reportes de merma real.
                                    </p>
                                </div>
                            </div>

                            {/* Pérdida por escurrido / Ganancia de peso */}
                            {frozenWeight > 0 && drainedWeight > 0 && (
                                <div className={cn(
                                    'rounded-[var(--radius)] border px-3 py-2 text-[13px]',
                                    drainedWeight > frozenWeight
                                        ? 'border-capsula-coral/20 bg-capsula-coral-subtle text-capsula-coral'
                                        : 'border-[#D1DCE9] bg-[#E6ECF4] text-[#2A4060]',
                                )}>
                                    {drainedWeight > frozenWeight ? (
                                        <span className="flex items-start gap-1.5">
                                            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                            <span>
                                                Ganancia de peso: <strong>{formatNumber(drainedWeight - frozenWeight)} kg</strong> ({formatNumber(((drainedWeight - frozenWeight) / frozenWeight) * 100)}%)
                                                <span className="mt-0.5 block text-[11px] opacity-80">Se agregaron condimentos/marinado</span>
                                            </span>
                                        </span>
                                    ) : (
                                        <span>
                                            Pérdida por escurrido: <strong>{formatNumber(frozenWeight - drainedWeight)} kg</strong> ({formatNumber(drainLoss)}%)
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Notas */}
                            <div>
                                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Notas</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Observaciones del procesamiento…"
                                    rows={2}
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Subproductos */}
                    <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                        <div className="flex items-center gap-2 border-b border-capsula-line bg-capsula-ivory px-5 py-3">
                            <Beef className="h-4 w-4 text-capsula-coral" strokeWidth={1.5} />
                            <h2 className="font-medium text-capsula-ink">Subproductos</h2>
                            <span className="text-[11px] text-capsula-ink-muted">({subProducts.length})</span>
                        </div>

                        <div className="space-y-4 p-5">
                            {/* Agregar subproducto */}
                            <div className="space-y-3 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4">
                                <div className="mb-1 flex items-center justify-between">
                                    <label className="text-[12px] font-medium text-capsula-ink">Nuevo corte / subproducto</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateItem(!showCreateItem)}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-capsula-navy underline-offset-2 hover:text-capsula-coral hover:underline"
                                    >
                                        {showCreateItem ? <><XCircle className="h-3 w-3" strokeWidth={1.5} /> Cancelar creación</> : <><Plus className="h-3 w-3" strokeWidth={2} /> Crear nuevo ítem en inventario</>}
                                    </button>
                                </div>

                                {/* Mini form crear item */}
                                {showCreateItem && (
                                    <div className="mb-3 animate-in fade-in slide-in-from-top-2 rounded-[var(--radius)] border border-capsula-coral/20 bg-capsula-coral-subtle/30 p-3">
                                        <div className="mb-3 grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                value={newItemName}
                                                onChange={(e) => setNewItemName(e.target.value)}
                                                placeholder="Nombre (ej: Huesos de pollo)"
                                                className="col-span-2 min-h-[36px] rounded border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                                autoFocus
                                            />
                                            <select
                                                value={newItemUnit}
                                                onChange={(e) => setNewItemUnit(e.target.value)}
                                                className="min-h-[36px] rounded border border-capsula-line bg-capsula-ivory-surface px-2 py-1.5 text-[12.5px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                            >
                                                <option value="KG">Kilogramos</option>
                                                <option value="G">Gramos</option>
                                                <option value="UNIT">Unidad</option>
                                            </select>
                                            <select
                                                value={newItemType}
                                                onChange={(e) => setNewItemType(e.target.value)}
                                                className="min-h-[36px] rounded border border-capsula-line bg-capsula-ivory-surface px-2 py-1.5 text-[12.5px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                            >
                                                <option value="RAW_MATERIAL">Materia prima</option>
                                                <option value="SUB_RECIPE">Sub-receta</option>
                                                <option value="FINISHED_GOOD">Producto final</option>
                                            </select>
                                        </div>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={handleCreateItem}
                                            disabled={!newItemName.trim() || isCreatingItem}
                                            isLoading={isCreatingItem}
                                            className="w-full"
                                        >
                                            {isCreatingItem ? 'Creando…' : 'Guardar ítem'}
                                        </Button>
                                    </div>
                                )}

                                {/* Info plantilla activa */}
                                {activeTemplate && (() => {
                                    const tplStep = STEP_CONFIG[activeTemplate.processingStep] || STEP_CONFIG['CUSTOM'];
                                    const TplIcon = tplStep.icon;
                                    return (
                                        <div className="rounded-[var(--radius)] border border-capsula-navy/10 bg-capsula-navy-soft px-3 py-2 text-[12px]">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <TplIcon className="h-3.5 w-3.5 text-capsula-navy" strokeWidth={1.5} />
                                                <strong className="text-capsula-navy-deep">{activeTemplate.name}</strong>
                                                <span className="text-capsula-ink-muted">({activeTemplate.allowedOutputs.length} subproductos)</span>
                                                {activeTemplate.canGainWeight && (
                                                    <Badge variant="coral">
                                                        <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> Peso puede aumentar
                                                    </Badge>
                                                )}
                                            </div>
                                            {activeTemplate.allowedOutputs.some((o: any) => o.isIntermediate) && (
                                                <p className="mt-1 flex items-center gap-1 text-[10.5px] text-capsula-ink-muted">
                                                    <Link2 className="h-3 w-3" strokeWidth={1.5} />
                                                    Algunos productos son intermedios y pasarán al siguiente paso de la cadena.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <div className="flex-1">
                                        <Combobox
                                            items={availableSubItems.map((item: any) => ({
                                                value: item.id,
                                                label: `${item.name} (${item.baseUnit})${item.expectedWeight ? ` ~${item.expectedWeight}kg` : ''}`,
                                            }))}
                                            value={newSubProductItemId}
                                            onChange={(val) => {
                                                const item = availableSubItems.find((i: any) => i.id === val);
                                                setNewSubProductItemId(val);
                                                if (item) {
                                                    setNewSubProductName(item.name);
                                                    setNewSubProductUnitType(item.baseUnit);
                                                    if (item.expectedWeight && newSubProductWeight === 0) {
                                                        setNewSubProductWeight(item.expectedWeight);
                                                    }
                                                    if (item.expectedUnits) {
                                                        setNewSubProductUnits(item.expectedUnits);
                                                    }
                                                }
                                            }}
                                            placeholder={activeTemplate ? '— Seleccionar subproducto de plantilla —' : '— Seleccionar ítem existente —'}
                                            searchPlaceholder="Buscar ítem…"
                                            emptyMessage={activeTemplate ? 'No hay más subproductos en esta plantilla.' : 'No se encontró el ítem.'}
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
                                                className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-right font-mono text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                            />
                                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-capsula-ink-muted">{newSubProductUnitType}</span>
                                        </div>
                                        <div className="relative w-20">
                                            <input
                                                type="number"
                                                value={newSubProductUnits || ''}
                                                onChange={(e) => setNewSubProductUnits(parseInt(e.target.value) || 1)}
                                                placeholder="Uds"
                                                className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-right font-mono text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                            />
                                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-capsula-ink-muted">pza</span>
                                        </div>
                                        <button
                                            onClick={addSubProduct}
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-capsula-navy-deep text-capsula-ivory transition-colors hover:bg-capsula-navy"
                                            title="Agregar"
                                        >
                                            <Plus className="h-4 w-4" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Lista de subproductos */}
                            <div className="max-h-[300px] space-y-2 overflow-y-auto">
                                {subProducts.length === 0 ? (
                                    <p className="py-8 text-center text-[13px] text-capsula-ink-muted">
                                        Agrega los cortes/subproductos obtenidos
                                    </p>
                                ) : (
                                    subProducts.map((sp, index) => {
                                        const templateOutput = activeTemplate?.allowedOutputs?.find((o: any) => o.outputItem?.id === sp.outputItemId);
                                        const isIntermediate = templateOutput?.isIntermediate || false;
                                        return (
                                            <div
                                                key={sp.id}
                                                className={cn(
                                                    'flex items-center justify-between rounded-[var(--radius)] border px-3 py-2',
                                                    isIntermediate
                                                        ? 'border-capsula-coral/20 bg-capsula-coral-subtle/40'
                                                        : 'border-capsula-line bg-capsula-ivory',
                                                )}
                                            >
                                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                                    <span className="font-mono text-[11px] text-capsula-ink-muted">{index + 1}.</span>
                                                    <span className="truncate text-[13px] font-medium text-capsula-ink">{sp.name}</span>
                                                    {isIntermediate && (
                                                        <Badge variant="coral">
                                                            <Link2 className="h-3 w-3" strokeWidth={1.5} /> Intermedio
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="ml-2 flex items-center gap-3">
                                                    <span className="font-mono text-[12.5px] font-semibold text-capsula-ink">{formatNumber(sp.weight)} <span className="text-capsula-ink-muted">kg</span></span>
                                                    <span className="text-[11px] text-capsula-ink-muted">({sp.units} pza)</span>
                                                    <button
                                                        onClick={() => removeSubProduct(sp.id)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                                        title="Quitar"
                                                    >
                                                        <XCircle className="h-4 w-4" strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Resumen */}
                            <div className="space-y-2 border-t border-capsula-line pt-4">
                                <div className="flex justify-between text-[13px]">
                                    <span className="text-capsula-ink-muted">Total subproductos</span>
                                    <span className="font-mono font-semibold text-capsula-ink">{formatNumber(totalSubProductsWeight)} kg</span>
                                </div>
                                <div className="flex justify-between text-[13px]">
                                    <span className="text-capsula-ink-muted">Desperdicio</span>
                                    <span className={cn('font-mono font-semibold', wasteWeight > 0 ? 'text-capsula-coral' : 'text-capsula-ink-soft')}>
                                        {formatNumber(wasteWeight)} kg ({formatNumber(wastePercentage)}%)
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Rendimiento</span>
                                    <span className={cn(
                                        'font-mono text-[22px] font-semibold',
                                        yieldPercentage >= 70 ? 'text-[#2F6B4E]' :
                                        yieldPercentage >= 50 ? 'text-[#946A1C]' : 'text-capsula-coral',
                                    )}>
                                        {formatNumber(yieldPercentage)}%
                                    </span>
                                </div>
                            </div>

                            {/* Botón guardar */}
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleSubmit}
                                disabled={!sourceItemId || frozenWeight <= 0 || subProducts.length === 0 || isSubmitting}
                                isLoading={isSubmitting}
                                className="w-full"
                            >
                                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                                {isSubmitting ? 'Guardando…' : 'Guardar procesamiento'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vista: Detalle */}
            {viewMode === 'detail' && selectedProcessing && (
                <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                    <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-ivory px-5 py-4">
                        <div>
                            <h2 className="font-mono text-[16px] font-semibold text-capsula-navy-deep">
                                {selectedProcessing.code}
                            </h2>
                            <p className="text-[12px] text-capsula-ink-muted">
                                {new Date(selectedProcessing.processDate).toLocaleDateString('es-VE', {
                                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                })}
                            </p>
                        </div>
                        {getStatusBadge(selectedProcessing.status)}
                    </div>

                    <div className="grid gap-6 p-6 lg:grid-cols-2">
                        {/* Info general */}
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Información general</h3>
                            <div className="space-y-2 text-[13px]">
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Producto</span>
                                    <span className="font-medium text-capsula-ink">{selectedProcessing.sourceItem.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Proveedor</span>
                                    <span className="text-capsula-ink">{selectedProcessing.supplier?.name || selectedProcessing.supplierName || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Área</span>
                                    <span className="text-capsula-ink">{selectedProcessing.area.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Creado por</span>
                                    <span className="text-capsula-ink">{selectedProcessing.createdBy.firstName} {selectedProcessing.createdBy.lastName}</span>
                                </div>
                            </div>

                            <h3 className="pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Pesos y rendimiento</h3>
                            <div className="space-y-2 text-[13px]">
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Peso congelado</span>
                                    <span className="font-mono text-capsula-ink">{formatNumber(selectedProcessing.frozenWeight)} kg</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Peso escurrido</span>
                                    <span className="font-mono text-capsula-ink">{formatNumber(selectedProcessing.drainedWeight)} kg</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Total subproductos</span>
                                    <span className="font-mono text-[#2F6B4E]">{formatNumber(selectedProcessing.totalSubProducts)} kg</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-capsula-ink-muted">Desperdicio</span>
                                    <span className="font-mono text-capsula-coral">{formatNumber(selectedProcessing.wasteWeight)} kg ({formatNumber(selectedProcessing.wastePercentage)}%)</span>
                                </div>
                                <div className="flex items-baseline justify-between border-t border-capsula-line pt-3">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Rendimiento</span>
                                    <span className={cn(
                                        'font-mono text-[22px] font-semibold',
                                        selectedProcessing.yieldPercentage >= 70 ? 'text-[#2F6B4E]' :
                                        selectedProcessing.yieldPercentage >= 50 ? 'text-[#946A1C]' : 'text-capsula-coral',
                                    )}>
                                        {formatNumber(selectedProcessing.yieldPercentage)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Subproductos */}
                        <div>
                            <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Subproductos obtenidos</h3>
                            <div className="space-y-2">
                                {selectedProcessing.subProducts.map((sp: any, index: number) => (
                                    <div key={sp.id} className="flex items-center justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-3 py-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="font-mono text-[11px] text-capsula-ink-muted">{index + 1}.</span>
                                            <span className="truncate text-[13px] font-medium text-capsula-ink">{sp.name}</span>
                                            {sp.outputItem && (
                                                <span className="inline-flex items-center gap-0.5 text-[11px] text-capsula-coral">
                                                    <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                                                    {sp.outputItem.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="ml-2 text-right">
                                            <span className="font-mono text-[12.5px] text-capsula-ink">{formatNumber(sp.weight)} <span className="text-capsula-ink-muted">kg</span></span>
                                            <span className="ml-2 text-[11px] text-capsula-ink-muted">({sp.units} pza)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Acciones */}
                    {selectedProcessing.status === 'DRAFT' && (
                        <div className="flex justify-end gap-2 border-t border-capsula-line bg-capsula-ivory px-5 py-4">
                            <Button
                                variant="outline"
                                onClick={() => handleCancel(selectedProcessing.id)}
                            >
                                <XCircle className="h-4 w-4" strokeWidth={1.5} /> Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => handleComplete(selectedProcessing.id)}
                            >
                                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> Completar y actualizar inventario
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Vista: Plantillas de procesamiento */}
            {viewMode === 'templates' && (
                <ProcessingTemplates />
            )}
        </div>
    );
}
