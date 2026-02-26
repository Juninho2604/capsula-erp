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

interface TemplateOutput {
    outputItemId: string;
    outputItemName: string;
    expectedWeight?: number;
    expectedUnits?: number;
}

interface Template {
    id: string;
    name: string;
    description: string | null;
    sourceItem: { id: string; name: string; sku: string };
    allowedOutputs: {
        id: string;
        outputItem: { id: string; name: string; sku: string; baseUnit: string };
        expectedWeight: number | null;
        expectedUnits: number | null;
        sortOrder: number;
    }[];
}

export default function ProcessingTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [items, setItems] = useState<{ id: string; name: string; sku: string; baseUnit?: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Form state
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [sourceItemId, setSourceItemId] = useState('');
    const [outputs, setOutputs] = useState<TemplateOutput[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tmpl, allItems] = await Promise.all([
                getProcessingTemplatesAction(),
                getProteinItemsAction()
            ]);
            setTemplates(tmpl as Template[]);
            setItems(allItems);
        } catch {
            console.error('Error loading templates');
        }
        setLoading(false);
    };

    const addOutput = () => {
        setOutputs([...outputs, { outputItemId: '', outputItemName: '', expectedWeight: undefined }]);
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
            outputs: outputs.filter(o => o.outputItemId).map(o => ({
                outputItemId: o.outputItemId,
                expectedWeight: o.expectedWeight,
                expectedUnits: o.expectedUnits
            }))
        });

        if (res.success) {
            setMsg({ type: 'success', text: '✅ Plantilla creada exitosamente' });
            setShowCreate(false);
            setTemplateName('');
            setTemplateDescription('');
            setSourceItemId('');
            setOutputs([]);
            loadData();
        } else {
            setMsg({ type: 'error', text: res.message });
        }
        setIsSubmitting(false);
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Cargando plantillas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        📋 Plantillas de Procesamiento
                    </h2>
                    <p className="text-sm text-gray-500">
                        Define qué sub-productos se obtienen de cada proteína para estandarizar el desposte.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="min-h-[44px] rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md transition-all"
                >
                    {showCreate ? '✕ Cancelar' : '+ Nueva Plantilla'}
                </button>
            </div>

            {/* Mensaje */}
            {msg && (
                <div className={cn(
                    "rounded-lg px-4 py-3 text-sm font-medium",
                    msg.type === 'success' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                )}>
                    {msg.text}
                </div>
            )}

            {/* Formulario de Creación */}
            {showCreate && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900/50 dark:bg-amber-900/10 space-y-5">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Nueva Plantilla</h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Nombre de la Plantilla *
                            </label>
                            <input
                                type="text"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                placeholder="Ej: Desposte de Res"
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white min-h-[44px]"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Descripción (opcional)
                            </label>
                            <input
                                type="text"
                                value={templateDescription}
                                onChange={e => setTemplateDescription(e.target.value)}
                                placeholder="Notas sobre esta plantilla"
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white min-h-[44px]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Proteína Fuente (materia prima) *
                        </label>
                        <Combobox
                            items={items.map(i => ({ value: i.id, label: i.name }))}
                            value={sourceItemId}
                            onChange={setSourceItemId}
                            placeholder="Seleccionar proteína..."
                            searchPlaceholder="Buscar proteína..."
                        />
                    </div>

                    {/* Sub-productos permitidos */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Sub-Productos Permitidos *
                            </label>
                            <button
                                onClick={addOutput}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400 min-h-[36px]"
                            >
                                + Agregar Sub-Producto
                            </button>
                        </div>

                        {outputs.length === 0 ? (
                            <div className="rounded-lg border-2 border-dashed border-gray-300 py-6 text-center dark:border-gray-600">
                                <p className="text-sm text-gray-500">
                                    Agrega los cortes/sub-productos que se obtienen de esta proteína
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {outputs.map((output, idx) => (
                                    <div key={idx} className="flex items-center gap-3 rounded-lg bg-white p-3 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                        <div className="flex-1">
                                            <Combobox
                                                items={items.map(i => ({ value: i.id, label: i.name }))}
                                                value={output.outputItemId}
                                                onChange={val => {
                                                    const itemFound = items.find(i => i.id === val);
                                                    updateOutput(idx, { outputItemId: val, outputItemName: itemFound?.name || '' });
                                                }}
                                                placeholder="Seleccionar sub-producto..."
                                                searchPlaceholder="Buscar..."
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
                                                className="w-full rounded border border-gray-200 px-2 py-2 text-center text-sm dark:border-gray-600 dark:bg-gray-700 min-h-[40px]"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeOutput(idx)}
                                            className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px] min-w-[44px]"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Acciones */}
                    <div className="flex justify-end border-t border-amber-200 pt-4 dark:border-amber-800">
                        <button
                            onClick={handleCreate}
                            disabled={isSubmitting}
                            className="min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 font-medium text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
                        >
                            {isSubmitting ? '⏳ Guardando...' : '💾 Crear Plantilla'}
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de Plantillas */}
            {templates.length === 0 && !showCreate ? (
                <div className="rounded-xl border-2 border-dashed border-gray-300 py-12 text-center dark:border-gray-600">
                    <span className="text-5xl">📋</span>
                    <p className="mt-3 text-gray-500">No hay plantillas de procesamiento definidas.</p>
                    <p className="text-sm text-gray-400">Crea una para estandarizar el desposte de proteínas.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                        <div
                            key={template.id}
                            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white">{template.name}</h4>
                                    {template.description && (
                                        <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(template.id)}
                                    className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all dark:hover:bg-red-900/20"
                                    title="Eliminar"
                                >
                                    🗑️
                                </button>
                            </div>

                            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
                                <p className="text-xs text-gray-500">Proteína Fuente</p>
                                <p className="font-medium text-amber-700 dark:text-amber-400">🥩 {template.sourceItem.name}</p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-2">Sub-Productos ({template.allowedOutputs.length}):</p>
                                <div className="space-y-1">
                                    {template.allowedOutputs.map(out => (
                                        <div
                                            key={out.id}
                                            className="flex items-center justify-between rounded bg-gray-50 px-2.5 py-1.5 text-sm dark:bg-gray-700/50"
                                        >
                                            <span className="text-gray-700 dark:text-gray-300 truncate">{out.outputItem.name}</span>
                                            {out.expectedWeight && (
                                                <span className="ml-2 text-xs font-mono text-gray-400">~{out.expectedWeight}kg</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
