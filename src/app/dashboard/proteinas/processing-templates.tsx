'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    getProcessingTemplatesAction,
    createProcessingTemplateAction,
    deleteProcessingTemplateAction,
    getProteinItemsAction
} from '@/app/actions/protein-processing.actions';
import { Combobox } from '@/components/ui/combobox';
import type { LucideIcon } from 'lucide-react';
import {
    Sparkles, Utensils, Package, Settings, ClipboardList, Trash2,
    Plus, X, Save, Loader2, Link2, TrendingUp, Beef, Lightbulb, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

interface TemplateOutput {
    outputItemId: string;
    outputItemName: string;
    expectedWeight?: number;
    expectedUnits?: number;
    isIntermediate?: boolean;
}

interface Template {
    id: string;
    name: string;
    description: string | null;
    processingStep: string;
    canGainWeight: boolean;
    chainOrder: number;
    sourceItem: { id: string; name: string; sku: string };
    allowedOutputs: {
        id: string;
        outputItem: { id: string; name: string; sku: string; baseUnit: string };
        expectedWeight: number | null;
        expectedUnits: number | null;
        sortOrder: number;
        isIntermediate: boolean;
    }[];
}

const STEP_CONFIG: Record<string, { label: string; icon: LucideIcon; description: string }> = {
    'LIMPIEZA':     { label: 'Limpieza',      icon: Sparkles,       description: 'Limpiar y separar la proteína cruda' },
    'MASERADO':     { label: 'Maserado',      icon: Utensils,       description: 'Agregar condimentos/marinado (peso puede aumentar)' },
    'DISTRIBUCION': { label: 'Distribución',  icon: Package,        description: 'Repartir en productos finales para venta' },
    'CUSTOM':       { label: 'Personalizado', icon: Settings,       description: 'Paso personalizado' },
};

const inputClass =
    'min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[14px] text-capsula-ink outline-none transition-colors focus:border-capsula-navy-deep';
const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';

export default function ProcessingTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [items, setItems] = useState<{ id: string; name: string; sku: string; baseUnit?: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [sourceItemId, setSourceItemId] = useState('');
    const [processingStep, setProcessingStep] = useState('LIMPIEZA');
    const [canGainWeight, setCanGainWeight] = useState(false);
    const [chainOrder, setChainOrder] = useState(0);
    const [outputs, setOutputs] = useState<TemplateOutput[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (processingStep === 'MASERADO') {
            setCanGainWeight(true);
        } else {
            setCanGainWeight(false);
        }
    }, [processingStep]);

    useEffect(() => {
        if (sourceItemId && processingStep) {
            const item = items.find(i => i.id === sourceItemId);
            if (item) {
                const stepLabel = STEP_CONFIG[processingStep]?.label || processingStep;
                setTemplateName(`${stepLabel} de ${item.name}`);
            }
        }
    }, [sourceItemId, processingStep, items]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tmpl, allItems] = await Promise.all([
                getProcessingTemplatesAction(),
                getProteinItemsAction()
            ]);
            setTemplates(tmpl as unknown as Template[]);
            setItems(allItems);
        } catch {
            console.error('Error loading templates');
        }
        setLoading(false);
    };

    const addOutput = () => {
        setOutputs([...outputs, { outputItemId: '', outputItemName: '', expectedWeight: undefined, isIntermediate: false }]);
    };

    const removeOutput = (idx: number) => {
        setOutputs(outputs.filter((_, i) => i !== idx));
    };

    const updateOutput = (idx: number, updates: Partial<TemplateOutput>) => {
        const newOutputs = [...outputs];
        newOutputs[idx] = { ...newOutputs[idx], ...updates };
        setOutputs(newOutputs);
    };

    const handleCreate = async () => {
        if (!templateName || !sourceItemId || outputs.filter(o => o.outputItemId).length === 0) {
            setMsg({ type: 'error', text: 'Completa nombre, item fuente y al menos un sub-producto.' });
            return;
        }

        setIsSubmitting(true);
        const res = await createProcessingTemplateAction({
            name: templateName,
            description: templateDescription || undefined,
            sourceItemId,
            processingStep,
            canGainWeight,
            chainOrder,
            outputs: outputs.filter(o => o.outputItemId).map(o => ({
                outputItemId: o.outputItemId,
                expectedWeight: o.expectedWeight,
                expectedUnits: o.expectedUnits,
                isIntermediate: o.isIntermediate || false,
            }))
        });

        if (res.success) {
            setMsg({ type: 'success', text: 'Plantilla creada exitosamente' });
            setShowCreate(false);
            resetForm();
            loadData();
        } else {
            setMsg({ type: 'error', text: res.message });
        }
        setIsSubmitting(false);
    };

    const resetForm = () => {
        setTemplateName('');
        setTemplateDescription('');
        setSourceItemId('');
        setProcessingStep('LIMPIEZA');
        setCanGainWeight(false);
        setChainOrder(0);
        setOutputs([]);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta plantilla?')) return;
        const res = await deleteProcessingTemplateAction(id);
        if (res.success) {
            loadData();
        } else {
            alert('Error: ' + res.message);
        }
    };

    const templatesBySource = templates.reduce((acc, t) => {
        const key = t.sourceItem.id;
        if (!acc[key]) {
            acc[key] = { sourceItem: t.sourceItem, templates: [] };
        }
        acc[key].templates.push(t);
        return acc;
    }, {} as Record<string, { sourceItem: { id: string; name: string; sku: string }; templates: Template[] }>);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-capsula-navy" strokeWidth={1.5} />
                    <p className="mt-2 text-[13px] text-capsula-ink-muted">Cargando plantillas…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="flex items-center gap-2 font-heading text-[20px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                        <ClipboardList className="h-5 w-5 text-capsula-navy" strokeWidth={1.5} />
                        Plantillas de procesamiento
                    </h2>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        Define los pasos y sub-productos de cada proteína. Podés crear plantillas por paso (Limpieza → Maserado → Distribución).
                    </p>
                </div>
                <Button
                    variant={showCreate ? 'ghost' : 'primary'}
                    onClick={() => { setShowCreate(!showCreate); if (showCreate) resetForm(); }}
                >
                    {showCreate ? <><X className="h-4 w-4" strokeWidth={1.5} /> Cancelar</> : <><Plus className="h-4 w-4" strokeWidth={2} /> Nueva plantilla</>}
                </Button>
            </div>

            {/* Mensaje */}
            {msg && (
                <div className={cn(
                    'flex items-center gap-2 rounded-[var(--radius)] border px-4 py-3 text-[13px] font-medium',
                    msg.type === 'success'
                        ? 'border-[#D3E2D8] bg-[#E5EDE7] text-[#2F6B4E]'
                        : 'border-[#EFD2C8] bg-[#F7E3DB] text-[#B04A2E]',
                )}>
                    {msg.type === 'success'
                        ? <Check className="h-4 w-4" strokeWidth={1.5} />
                        : <X className="h-4 w-4" strokeWidth={1.5} />}
                    {msg.text}
                </div>
            )}

            {/* Formulario de creación */}
            {showCreate && (
                <div className="space-y-5 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                    <h3 className="font-heading text-[18px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                        Nueva plantilla de procesamiento
                    </h3>

                    {/* Paso del procesamiento */}
                    <div>
                        <label className={labelClass}>Paso del procesamiento *</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {Object.entries(STEP_CONFIG).map(([value, config]) => {
                                const Icon = config.icon;
                                const active = processingStep === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setProcessingStep(value)}
                                        className={cn(
                                            'rounded-[var(--radius)] border px-3 py-3 text-left transition-colors',
                                            active
                                                ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                                                : 'border-capsula-line bg-capsula-ivory-surface hover:border-capsula-line-strong',
                                        )}
                                    >
                                        <Icon
                                            className={cn('mb-1 h-4 w-4', active ? 'text-capsula-navy-deep' : 'text-capsula-ink-soft')}
                                            strokeWidth={1.5}
                                        />
                                        <div className={cn('text-[13px] font-medium', active ? 'text-capsula-navy-deep' : 'text-capsula-ink')}>
                                            {config.label}
                                        </div>
                                        <div className="mt-0.5 text-[10.5px] leading-tight text-capsula-ink-muted">
                                            {config.description}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>Proteína / Ítem fuente *</label>
                            <Combobox
                                items={items.map(i => ({ value: i.id, label: i.name }))}
                                value={sourceItemId}
                                onChange={setSourceItemId}
                                placeholder="Seleccionar proteína…"
                                searchPlaceholder="Buscar proteína…"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Nombre de la plantilla *</label>
                            <input
                                type="text"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                placeholder="Se auto-genera basado en ítem y paso"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    {/* Opciones avanzadas */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className={labelClass}>Descripción (opcional)</label>
                            <input
                                type="text"
                                value={templateDescription}
                                onChange={e => setTemplateDescription(e.target.value)}
                                placeholder="Notas sobre esta plantilla"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Orden en cadena</label>
                            <input
                                type="number"
                                min={0}
                                value={chainOrder}
                                onChange={e => setChainOrder(parseInt(e.target.value) || 0)}
                                className={inputClass + ' font-mono'}
                            />
                            <p className="mt-1 text-[10.5px] text-capsula-ink-faint">0 = primer paso, 1 = segundo, etc.</p>
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={canGainWeight}
                                    onChange={e => setCanGainWeight(e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-capsula-line after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-capsula-line-strong after:bg-white after:transition-all after:content-[''] peer-checked:bg-capsula-navy-deep peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                            </label>
                            <div>
                                <span className="text-[13px] font-medium text-capsula-ink">¿Peso puede aumentar?</span>
                                <p className="text-[10.5px] text-capsula-ink-muted">Ej: maserado agrega condimentos</p>
                            </div>
                        </div>
                    </div>

                    {/* Sub-productos */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                Sub-productos / salidas de este paso *
                            </label>
                            <Button variant="ghost" size="sm" onClick={addOutput}>
                                <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Agregar sub-producto
                            </Button>
                        </div>

                        {outputs.length === 0 ? (
                            <div className="rounded-[var(--radius)] border border-dashed border-capsula-line bg-capsula-ivory py-6 text-center">
                                <p className="text-[13px] text-capsula-ink-muted">
                                    Agrega los cortes/sub-productos que se obtienen en este paso
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {outputs.map((output, idx) => (
                                    <div key={idx} className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-3">
                                        <div className="min-w-[220px] flex-1">
                                            <Combobox
                                                items={items.map(i => ({ value: i.id, label: i.name }))}
                                                value={output.outputItemId}
                                                onChange={val => {
                                                    const itemFound = items.find(i => i.id === val);
                                                    updateOutput(idx, { outputItemId: val, outputItemName: itemFound?.name || '' });
                                                }}
                                                placeholder="Seleccionar sub-producto…"
                                                searchPlaceholder="Buscar…"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                min={0}
                                                step={0.1}
                                                value={output.expectedWeight ?? ''}
                                                onChange={e => updateOutput(idx, { expectedWeight: parseFloat(e.target.value) || undefined })}
                                                placeholder="Peso kg"
                                                className="min-h-[40px] w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory px-2 py-2 text-center font-mono text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5" title="¿Es producto intermedio? (pasa al siguiente paso)">
                                            <label className="relative inline-flex cursor-pointer items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={output.isIntermediate || false}
                                                    onChange={e => updateOutput(idx, { isIntermediate: e.target.checked })}
                                                    className="peer sr-only"
                                                />
                                                <div className="peer h-5 w-9 rounded-full bg-capsula-line after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-capsula-line-strong after:bg-white after:transition-all after:content-[''] peer-checked:bg-capsula-coral peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                                            </label>
                                            <span className="inline-flex w-14 items-center gap-0.5 text-[10.5px] leading-tight text-capsula-ink-muted">
                                                {output.isIntermediate ? <><Link2 className="h-3 w-3" strokeWidth={1.5} /> Inter.</> : 'Final'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeOutput(idx)}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                        >
                                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="mt-2 flex items-start gap-1.5 text-[10.5px] text-capsula-ink-muted">
                            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.5} />
                            Marcá como &quot;Intermedio&quot; los productos que serán input del siguiente paso (ej: Lomito Limpio → Maserado). Los productos finales se agregan directamente al inventario.
                        </p>
                    </div>

                    {/* Acciones */}
                    <div className="flex justify-end border-t border-capsula-line pt-4">
                        <Button
                            variant="primary"
                            onClick={handleCreate}
                            disabled={isSubmitting}
                            isLoading={isSubmitting}
                        >
                            <Save className="h-4 w-4" strokeWidth={1.5} />
                            {isSubmitting ? 'Guardando…' : 'Crear plantilla'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Lista de plantillas */}
            {templates.length === 0 && !showCreate ? (
                <div className="rounded-[var(--radius)] border border-dashed border-capsula-line bg-capsula-ivory-surface py-12 text-center">
                    <ClipboardList className="mx-auto h-8 w-8 text-capsula-ink-faint" strokeWidth={1.5} />
                    <p className="mt-3 text-[14px] font-medium text-capsula-ink">No hay plantillas de procesamiento definidas.</p>
                    <p className="text-[13px] text-capsula-ink-muted">Crea una para estandarizar el procesamiento de proteínas.</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {Object.entries(templatesBySource).map(([sourceId, group]) => (
                        <div key={sourceId} className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                            <div className="flex items-center gap-2 border-b border-capsula-line bg-capsula-ivory px-5 py-3">
                                <Beef className="h-4 w-4 text-capsula-coral" strokeWidth={1.5} />
                                <h3 className="font-medium text-capsula-ink">{group.sourceItem.name}</h3>
                                <span className="text-[11px] text-capsula-ink-muted">
                                    ({group.templates.length} {group.templates.length === 1 ? 'paso' : 'pasos'})
                                </span>
                            </div>

                            <div className="p-5">
                                <div className="relative">
                                    {group.templates.length > 1 && (
                                        <div className="absolute bottom-8 left-6 top-8 w-px bg-capsula-line-strong"></div>
                                    )}

                                    <div className="space-y-4">
                                        {group.templates
                                            .sort((a, b) => a.chainOrder - b.chainOrder)
                                            .map((template) => {
                                                const stepConfig = STEP_CONFIG[template.processingStep] || STEP_CONFIG['CUSTOM'];
                                                const StepIcon = stepConfig.icon;
                                                return (
                                                    <div key={template.id} className="group relative flex gap-4">
                                                        <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory">
                                                            <StepIcon className="h-5 w-5 text-capsula-navy" strokeWidth={1.5} />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-2 flex items-start justify-between gap-2">
                                                                <div>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <h4 className="text-[14px] font-medium text-capsula-ink">{stepConfig.label}</h4>
                                                                        <span className="text-[11px] text-capsula-ink-muted">Paso {template.chainOrder + 1}</span>
                                                                        {template.canGainWeight && (
                                                                            <Badge variant="coral">
                                                                                <TrendingUp className="h-3 w-3" strokeWidth={1.5} />
                                                                                Peso puede aumentar
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[12px] text-capsula-ink-muted">{template.name}</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDelete(template.id)}
                                                                    className="rounded-md p-1.5 text-capsula-ink-muted opacity-0 transition-all hover:bg-capsula-coral-subtle hover:text-capsula-coral group-hover:opacity-100"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                                                </button>
                                                            </div>

                                                            <div className="flex flex-wrap gap-1.5">
                                                                {template.allowedOutputs.map(out => (
                                                                    <Badge
                                                                        key={out.id}
                                                                        variant={out.isIntermediate ? 'coral' : 'neutral'}
                                                                    >
                                                                        {out.isIntermediate && <Link2 className="h-3 w-3" strokeWidth={1.5} />}
                                                                        {out.outputItem.name}
                                                                        {out.expectedWeight && (
                                                                            <span className="font-mono text-[10px] opacity-70">~{out.expectedWeight}kg</span>
                                                                        )}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
