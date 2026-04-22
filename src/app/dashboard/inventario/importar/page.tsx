'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { createAuditAction } from '@/app/actions/audit.actions';
import { parseUploadAction, processImportAction, type ImportPreviewResult } from '@/app/actions/import.actions';
import { getAreasForSelect } from '@/app/actions/entrada.actions';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

export default function ImportPage() {
    const { user } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [importType, setImportType] = useState<'ENTRADA_ALMACEN' | 'MERMA' | 'INVENTARIO_INICIAL'>('INVENTARIO_INICIAL');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDraft, setIsDraft] = useState(false);
    const [effectiveDate, setEffectiveDate] = useState('');

    // NEW: Area selector state
    const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
    const [selectedAreaId, setSelectedAreaId] = useState<string>('');

    // Fetch areas on mount
    useEffect(() => {
        getAreasForSelect().then(list => {
            setAreas(list);
            // Set default to Almacén Principal if exists
            const almacen = list.find(a => a.name.toLowerCase().includes('almacen principal'));
            if (almacen) setSelectedAreaId(almacen.id);
        });
    }, []);

    // ... (rest of handlers unchanged until handleImport)

    const handleImport = async () => {
        if (!preview || !preview.items || !user) return;

        // Filter valid items: must have match OR can be new in MASTER LOAD
        const validItems = preview.items.filter(i =>
            (i.matchedItemId || importType === 'INVENTARIO_INICIAL') &&
            (i.quantity >= 0 || i.shouldRename) // Allow 0 quantity for creation
        );

        if (validItems.length === 0) {
            toast.error('No hay items válidos para importar');
            return;
        }

        // --- DRAFT / AUDIT FLOW ---
        if (isDraft) {
            const auditItems = validItems
                .filter(i => i.matchedItemId) // Only existing items
                .map(i => ({
                    inventoryItemId: i.matchedItemId!,
                    countedStock: i.quantity
                }));

            if (auditItems.length === 0) {
                toast.error('Para auditoría solo se procesan items ya existentes (Coincidencias)');
                return;
            }

            if (!confirm(`Se creará un BORRADOR de Auditoría con ${auditItems.length} items.\nEl inventario NO se afectará hasta que se apruebe.\n¿Continuar?`)) return;

            setIsProcessing(true);
            const res = await createAuditAction({
                name: `Importación ${importType} - ${effectiveDate || new Date().toLocaleDateString()}`,
                items: auditItems,
                areaId: selectedAreaId || undefined,
                effectiveDate: effectiveDate || undefined
            });

            setIsProcessing(false);
            if (res.success) {
                toast.success('Auditoría borrador creada');
                // Redirect
                window.location.href = `/dashboard/inventario/auditorias/${res.auditId}`;
                return;
            } else {
                toast.error(res.message);
                return;
            }
        }

        // --- NORMAL FLOW ---
        const countRename = validItems.filter(i => i.shouldRename).length;
        const countStock = validItems.filter(i => i.quantity > 0).length;
        const countNew = validItems.filter(i => !i.matchedItemId).length;

        if (!confirm(`Importar:\n- ${countNew} Nuevos Items\n- ${countStock} Ajustes de Stock\n- ${countRename} Renombres\n¿Confirmar?`)) return;

        setIsProcessing(true);
        try {
            const mappedItems = validItems.map(i => ({
                matchedItemId: i.matchedItemId,
                quantity: i.quantity,
                unit: i.unit,
                shouldRename: i.shouldRename,
                newName: i.itemName,
                category: i.category,
                itemName: i.itemName
            }));

            const result = await processImportAction(mappedItems, importType, selectedAreaId || undefined);
            if (result.success) {
                toast.success(result.message);
                setFile(null);
                setPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error('Error al procesar importación');
        } finally {
            setIsProcessing(false);
        }
    };


    const handleUnitChange = (index: number, newUnit: string) => {
        if (!preview || !preview.items) return;
        const newItems = [...preview.items];
        newItems[index] = { ...newItems[index], unit: newUnit };
        setPreview({ ...preview, items: newItems });
    };

    const handleQuantityChange = (index: number, newQty: string) => {
        if (!preview || !preview.items) return;
        // Allow typing (string) but validate later
        const qty = parseFloat(newQty);
        const newItems = [...preview.items];
        newItems[index] = { ...newItems[index], quantity: isNaN(qty) ? 0 : qty };
        setPreview({ ...preview, items: newItems });
    };

    const handleMatchChange = (index: number, itemId: string) => {
        if (!preview || !preview.items) return;
        const newItems = [...preview.items];
        const match = preview.allItems?.find(i => i.id === itemId);

        newItems[index] = {
            ...newItems[index],
            matchedItemId: itemId,
            status: itemId ? 'MATCHED' : 'NOT_FOUND',
            // If manual match and names differ, suggest rename?
            shouldRename: false // Reset
        };
        setPreview({ ...preview, items: newItems });
    };

    const handleRenameToggle = (index: number) => {
        if (!preview || !preview.items) return;
        const newItems = [...preview.items];
        newItems[index] = { ...newItems[index], shouldRename: !newItems[index].shouldRename };
        setPreview({ ...preview, items: newItems });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setPreview(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file) {
            toast.error('Por favor selecciona un archivo primero');
            return;
        }
        setIsProcessing(true);
        console.log('Iniciando análisis...', file.name, file.size);

        try {
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    console.log('Archivo leído, enviando al servidor...');
                    const base64 = reader.result as string;
                    const result = await parseUploadAction(base64, importType);
                    console.log('Resultado del servidor:', result);

                    if (result.success) {
                        setPreview(result);
                        if (result.items && result.items.length === 0) {
                            toast.error('El archivo se leyó pero no se encontraron filas válidas.');
                        } else {
                            toast.success(`Análisis completado: ${result.items?.length} filas.`);
                        }
                    } else {
                        toast.error(result.message || 'Error desconocido al analizar');
                    }
                } catch (serverError) {
                    console.error('Error procesando respuesta:', serverError);
                    toast.error('Error al procesar la respuesta del servidor');
                } finally {
                    setIsProcessing(false);
                }
            };

            reader.onerror = () => {
                console.error('Error de lectura de archivo');
                toast.error('Error al leer el archivo localmente');
                setIsProcessing(false);
            };

            reader.readAsDataURL(file);

        } catch (error) {
            console.error('Error general:', error);
            toast.error('Error inesperado');
            setIsProcessing(false);
        }
    };

    const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';
    const selectClass = 'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none';
    const hintClass = 'mt-1 text-[11px] text-capsula-ink-muted';

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Inventario</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Importación masiva de planillas</h1>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="mb-6 grid gap-6 md:grid-cols-3">
                        <div>
                            <label className={labelClass}>1. Tipo de planilla</label>
                            <select
                                value={importType}
                                onChange={(e) => setImportType(e.target.value as any)}
                                className={selectClass}
                            >
                                <option value="INVENTARIO_INICIAL">Inventario Inicial (Planilla Orden de Compra)</option>
                                <option value="ENTRADA_ALMACEN">Entrada de Almacén (Planilla Diaria)</option>
                                <option value="MERMA">Registro de Mermas</option>
                            </select>
                            <p className={hintClass}>
                                Formatos soportados: &quot;ORDEN DE COMPRA NO TOCAR&quot;, &quot;ENTRADA ALMACEN&quot;, &quot;REGISTRO DE MERMA&quot;.
                            </p>
                        </div>

                        <div>
                            <label className={labelClass}>2. Área destino</label>
                            <select
                                value={selectedAreaId}
                                onChange={(e) => setSelectedAreaId(e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Seleccionar área…</option>
                                {areas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                            <p className={hintClass}>Donde se registrará el inventario importado.</p>
                        </div>

                        <div>
                            <label className={labelClass}>3. Sube tu archivo</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="block w-full text-[13px] text-capsula-ink-soft file:mr-4 file:rounded-full file:border-0 file:bg-capsula-navy-deep file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-capsula-ivory-surface hover:file:bg-capsula-navy-ink"
                            />
                        </div>
                    </div>

                    {file && !preview && (
                        <Button variant="primary" onClick={handleAnalyze} isLoading={isProcessing}>
                            <Upload className="h-4 w-4" strokeWidth={1.5} />
                            {isProcessing ? 'Analizando…' : 'Analizar archivo'}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {preview && preview.items && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between border-b border-capsula-line py-4">
                        <div className="flex w-full items-center justify-between">
                            <CardTitle className="font-heading text-[18px] text-capsula-navy-deep">
                                Vista previa ({preview.items.length} filas detectadas)
                            </CardTitle>
                            <div className="flex items-center gap-3 text-[12px]">
                                <span className="inline-flex items-center gap-1 font-mono text-[#2F6B4E]">
                                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    {preview.items.filter(i => i.status === 'MATCHED').length} validados
                                </span>
                                <span className="inline-flex items-center gap-1 font-mono text-capsula-coral">
                                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    {preview.items.filter(i => i.status !== 'MATCHED').length} errores
                                </span>
                            </div>
                        </div>
                    </CardHeader>

                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-left text-[13px]">
                            <thead className="bg-capsula-ivory-alt text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                <tr>
                                    <th className="px-6 py-3">Fila</th>
                                    <th className="px-6 py-3">Ítem (Excel)</th>
                                    <th className="px-6 py-3">Link sistema</th>
                                    <th className="px-6 py-3">Cantidad</th>
                                    <th className="px-6 py-3">Unidad</th>
                                    <th className="px-6 py-3">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-capsula-line">
                                {preview.items.map((item, idx) => (
                                    <tr key={idx} className={item.status !== 'MATCHED' ? 'bg-capsula-coral/5' : ''}>
                                        <td className="px-6 py-3 font-mono text-capsula-ink-muted">{item.row}</td>
                                        <td className="px-6 py-3 font-medium text-capsula-ink">
                                            {item.itemName}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col gap-1">
                                                <select
                                                    className="w-48 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-[12px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                                    value={item.matchedItemId || ''}
                                                    onChange={(e) => handleMatchChange(idx, e.target.value)}
                                                >
                                                    <option value="">— Seleccionar —</option>
                                                    {preview.allItems?.map(opt => (
                                                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                                                    ))}
                                                </select>

                                                {item.matchedItemId && (
                                                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-capsula-ink-muted">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!item.shouldRename}
                                                            onChange={() => handleRenameToggle(idx)}
                                                            className="rounded border-capsula-line text-capsula-navy-deep focus:ring-capsula-navy-deep"
                                                        />
                                                        Renombrar en sistema
                                                    </label>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="number"
                                                step="any"
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                                className="w-24 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-2 py-1 font-mono text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <select
                                                value={item.unit || 'KG'}
                                                onChange={(e) => handleUnitChange(idx, e.target.value)}
                                                className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                            >
                                                <option value="KG">KG</option>
                                                <option value="UNI">UND</option>
                                                <option value="LTS">LTS</option>
                                                <option value="GR">GR</option>
                                                <option value="ML">ML</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-3">
                                            {item.status === 'MATCHED' ? (
                                                item.isFuzzyMatch ? (
                                                    <Badge variant="warn">Coincidencia 80%</Badge>
                                                ) : (
                                                    <Badge variant="ok">Exacta</Badge>
                                                )
                                            ) : item.status === 'NOT_FOUND' ? (
                                                importType === 'INVENTARIO_INICIAL' ? (
                                                    <Badge variant="info">
                                                        <Sparkles className="h-3 w-3" strokeWidth={1.5} /> Se creará
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="danger">No encontrado</Badge>
                                                )
                                            ) : (
                                                <Badge variant="warn">Cant. inválida</Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[var(--radius)] border-t border-capsula-line bg-capsula-ivory-alt px-6 py-4">
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isDraft}
                                onChange={(e) => setIsDraft(e.target.checked)}
                                className="h-4 w-4 rounded border-capsula-line text-capsula-navy-deep focus:ring-capsula-navy-deep"
                            />
                            <span className="text-[13px] font-medium text-capsula-ink">
                                Cargar como borrador (auditoría)
                            </span>
                        </label>

                        {isDraft && (
                            <div className="ml-4 flex items-center gap-2">
                                <label className="whitespace-nowrap text-[13px] text-capsula-ink-soft">Fecha efectiva:</label>
                                <input
                                    type="date"
                                    value={effectiveDate}
                                    onChange={e => setEffectiveDate(e.target.value)}
                                    className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                />
                                <span className="text-[11px] text-capsula-ink-muted">(vacío = hoy)</span>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => { setFile(null); setPreview(null); }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleImport}
                                disabled={isProcessing || preview.items.filter(i => i.status === 'MATCHED').length === 0}
                                isLoading={isProcessing}
                            >
                                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                                {isProcessing ? 'Importando…' : 'Confirmar importación'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
