'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';

import { registrarEntradaMercancia } from '@/app/actions/entrada.actions';
import {
    Plus,
    ArrowLeft,
    FileText,
    Camera,
    Upload,
    Loader2,
    Check,
    Eye,
    Trash2,
    Package,
    TrendingUp,
    TrendingDown,
    Save,
    Lightbulb,
    AlertTriangle,
    X as XIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Combobox } from '@/components/ui/combobox';
import QuickItemModal from './QuickItemModal';

// Tipos
interface UploadedFile {
    fileName: string;
    url: string;
    size: number;
    type: string;
}

interface EntradaItem {
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
}

interface Props {
    itemsList: any[];
    areasList: any[];
}

export default function EntradaMercanciaForm({ itemsList, areasList }: Props) {
    const { user, canViewCosts } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => { setShowCosts(canViewCosts()); }, [canViewCosts]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estado del formulario principal
    const [referenceNumber, setReferenceNumber] = useState('');
    const [areaId, setAreaId] = useState(areasList[0]?.id || '');
    const [notes, setNotes] = useState('');
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Estado para agregar items
    const [selectedItem, setSelectedItem] = useState('');
    const [quantity, setQuantity] = useState<number>(0);
    const [unit, setUnit] = useState('UNIT');
    const [unitCost, setUnitCost] = useState<number>(0);

    // Lista de items a registrar en esta entrada
    const [entradaItems, setEntradaItems] = useState<EntradaItem[]>([]);

    // Estado de UI
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // OCR State
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const [ocrSuggestions, setOcrSuggestions] = useState<any[]>([]);
    const [showOcrModal, setShowOcrModal] = useState(false);

    // Import OCR Action (dynamic import to avoid server-client issues if not used)
    // import { processHandwrittenNotesAction } from '@/app/actions/ocr.actions';



    const [isQuickItemModalOpen, setIsQuickItemModalOpen] = useState(false);

    // Lista local para actualizar cuando se crea uno nuevo sin recargar
    const [localItems, setLocalItems] = useState(itemsList);

    // Formatted date for display (avoid hydration mismatch)
    const [displayDate, setDisplayDate] = useState('');
    useEffect(() => {
        setDisplayDate(new Date().toLocaleDateString('es-VE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
        }));
    }, []);

    // Obtener item seleccionado
    const selectedItemData = localItems.find(i => i.id === selectedItem);

    // Auto-llenar costo actual cuando se selecciona item
    useEffect(() => {
        if (selectedItemData) {
            setUnit(selectedItemData.baseUnit);
            setUnitCost(selectedItemData.currentCost || 0);
        }
    }, [selectedItemData]);

    // Manejar upload de archivo
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Tipo de archivo no permitido. Use JPG, PNG, WebP o PDF.');
            return;
        }

        // Validar tamaño (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('El archivo excede el tamaño máximo de 5MB');
            return;
        }

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('referenceNumber', referenceNumber || 'sin-ref');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                setUploadedFile(data.data);
                toast.success('Archivo subido');
            } else {
                toast.error(data.error || 'Error al subir archivo');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Error al subir archivo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleOCRProcess = async () => {
        if (!uploadedFile) {
            toast.error('Primero sube una imagen');
            return;
        }
        if (!uploadedFile.type.startsWith('image/')) {
            toast.error('Solo se pueden procesar imágenes (JPG, PNG) con IA, no PDFs.');
            return;
        }

        setIsProcessingOCR(true);
        try {
            // Fetch the image to get blob/base64
            const response = await fetch(uploadedFile.url);
            const blob = await response.blob();

            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                // Call Server Action
                const { processHandwrittenNotesAction } = await import('@/app/actions/ocr.actions');
                const result = await processHandwrittenNotesAction(base64data);

                if (result.success) {
                    setOcrSuggestions(result.suggestions ?? []);
                    setShowOcrModal(true);
                } else {
                    toast.error('Error OCR: ' + result.message);
                }
                setIsProcessingOCR(false);
            };

        } catch (error) {
            console.error('Error procesando OCR', error);
            toast.error('Error al procesar la imagen con IA');
            setIsProcessingOCR(false);
        }
    };

    const acceptOcrItem = (suggestion: any) => {
        if (!suggestion.match) return;

        const item = localItems.find(i => i.id === suggestion.match.item.id);
        if (!item) return;

        // Add to main list
        const newItem: EntradaItem = {
            id: `ocr-${Date.now()}-${Math.random()}`,
            itemId: item.id,
            itemName: item.name,
            quantity: suggestion.detectedQuantity || 1,
            unit: item.baseUnit,
            unitCost: item.currentCost || 0,
            totalCost: (suggestion.detectedQuantity || 1) * (item.currentCost || 0),
        };

        if (!entradaItems.some(e => e.itemId === newItem.itemId)) {
            setEntradaItems(prev => [...prev, newItem]);
        }
    };


    // Agregar item a la lista
    const addItem = () => {
        if (!selectedItem || quantity <= 0) return;

        const item = localItems.find(i => i.id === selectedItem);
        if (!item) return;

        // Verificar si ya existe
        if (entradaItems.some(e => e.itemId === selectedItem)) {
            toast.error('Este insumo ya está en la lista');
            return;
        }

        const newItem: EntradaItem = {
            id: `temp-${Date.now()}`,
            itemId: selectedItem,
            itemName: item.name,
            quantity,
            unit,
            unitCost,
            totalCost: quantity * unitCost,
        };

        setEntradaItems([...entradaItems, newItem]);

        // Limpiar formulario de item
        setSelectedItem('');
        setQuantity(0);
        setUnitCost(0);
    };

    // Eliminar item de la lista
    const removeItem = (id: string) => {
        setEntradaItems(entradaItems.filter(i => i.id !== id));
    };

    // Calcular total
    const totalEntrada = entradaItems.reduce((sum, item) => sum + item.totalCost, 0);

    // Enviar entrada
    const handleSubmit = async () => {
        if (entradaItems.length === 0) {
            toast.error('Agrega al menos un insumo');
            return;
        }

        setIsSubmitting(true);
        setResult(null);

        try {
            // Iterar y enviar cada item
            let successCount = 0;
            let lastError = '';

            for (const item of entradaItems) {
                const res = await registrarEntradaMercancia({
                    inventoryItemId: item.itemId,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitCost: item.unitCost,
                    areaId: areaId,
                    referenceNumber: referenceNumber,
                    documentUrl: uploadedFile?.url,
                    notes: notes,
                    userId: user?.id || 'cmkvq94uo0000ua0ns6g844yr',
                });

                if (res.success) {
                    successCount++;
                } else {
                    console.error('Fallo en item:', item.itemName, res.message);
                    lastError = res.message;
                }
            }

            if (successCount > 0) {
                setResult({
                    success: true,
                    message: `Se registraron ${successCount} de ${entradaItems.length} items exitosamente.`,
                });

                if (successCount === entradaItems.length) {
                    setEntradaItems([]);
                    setReferenceNumber('');
                    setUploadedFile(null);
                    setNotes('');
                }
            } else {
                setResult({
                    success: false,
                    message: `Error al registrar: ${lastError}`,
                });
            }

        } catch (error) {
            setResult({
                success: false,
                message: 'Error de conexión al registrar entrada',
            });
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
                        href="/dashboard/inventario"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-capsula-line text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                        aria-label="Volver a Inventario"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Entrada de Mercancía</h1>
                        <p className="text-capsula-ink-muted">
                            Registro de llegada de insumos de proveedores
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Formulario Principal */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Información del Documento */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-6 shadow-sm">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-capsula-navy-deep text-capsula-ivory shadow-cap-soft">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Datos de la Nota de Entrega</h2>
                                <p className="text-sm text-capsula-ink-muted">
                                    Información del documento de Profit
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Número de Referencia */}
                            <div>
                                <label className="pos-label">N° Nota de Entrega *</label>
                                <input
                                    type="text"
                                    value={referenceNumber}
                                    onChange={(e) => setReferenceNumber(e.target.value)}
                                    placeholder="Ej: NE-2026-00123"
                                    className="pos-input mt-1"
                                />
                            </div>

                            {/* Área de Almacenamiento */}
                            <div>
                                <label className="pos-label">Área de Almacenamiento</label>
                                <select
                                    value={areaId}
                                    onChange={(e) => setAreaId(e.target.value)}
                                    className="pos-input mt-1"
                                >
                                    {areasList.map(area => (
                                        <option key={area.id} value={area.id}>
                                            {area.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Upload de Imagen */}
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 flex items-center gap-1.5 pos-label">
                                    <Camera className="h-4 w-4" /> Imagen de la Nota de Entrega
                                </label>

                                <div className="relative">
                                    {!uploadedFile ? (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className={cn(
                                                'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                                                isUploading
                                                    ? 'border-capsula-line-strong bg-capsula-ivory-alt'
                                                    : 'border-capsula-line hover:border-capsula-line-strong hover:bg-capsula-ivory-alt/60'
                                            )}
                                        >
                                            {isUploading ? (
                                                <div className="flex flex-col items-center">
                                                    <Loader2 className="h-8 w-8 animate-spin text-capsula-ink-muted" />
                                                    <p className="mt-2 text-sm text-capsula-ink-soft">Subiendo archivo…</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="mx-auto h-8 w-8 text-capsula-ink-muted" />
                                                    <p className="mt-2 text-sm text-capsula-ink-soft">
                                                        Haz clic para subir o arrastra la imagen aquí
                                                    </p>
                                                    <p className="text-xs text-capsula-ink-faint">
                                                        JPG, PNG, WebP o PDF (máx. 5MB)
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-[#D3E2D8] bg-[#E5EDE7]/40 p-4 dark:border-[#3a5b48] dark:bg-[#1E3B2C]/40">
                                            <div className="flex items-center gap-4">
                                                <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-capsula-line bg-capsula-ivory">
                                                    {uploadedFile.type.startsWith('image/') ? (
                                                        <Image
                                                            src={uploadedFile.url}
                                                            alt="Nota de entrega"
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center text-capsula-ink-soft">
                                                            <FileText className="h-8 w-8" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="flex items-center gap-1.5 font-medium text-[#2F6B4E] dark:text-[#6FB88F]">
                                                        <Check className="h-4 w-4" /> Documento adjunto
                                                    </p>
                                                    <p className="text-sm text-[#2F6B4E]/80 dark:text-[#6FB88F]/80">
                                                        {uploadedFile.fileName}
                                                    </p>
                                                    <p className="text-xs text-capsula-ink-muted">
                                                        {(uploadedFile.size / 1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setShowPreview(true)}
                                                        className="rounded-lg p-2 text-[#2F6B4E] transition-colors hover:bg-[#E5EDE7] dark:text-[#6FB88F] dark:hover:bg-[#1E3B2C]"
                                                        title="Ver documento"
                                                        aria-label="Ver documento"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setUploadedFile(null)}
                                                        className="rounded-lg p-2 text-capsula-coral transition-colors hover:bg-capsula-coral/10"
                                                        title="Eliminar"
                                                        aria-label="Eliminar adjunto"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* Notas */}
                            <div className="sm:col-span-2">
                                <label className="pos-label">Notas (opcional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Observaciones sobre la entrega..."
                                    rows={2}
                                    className="pos-input mt-1 w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Agregar Insumos */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-6 shadow-sm">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-capsula-navy-deep text-capsula-ivory shadow-cap-soft">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Insumos Recibidos</h2>
                                <p className="text-sm text-capsula-ink-muted">
                                    Agrega los items de la nota de entrega
                                </p>
                            </div>
                        </div>

                        {/* Formulario para agregar item */}
                        <div className="mb-4 rounded-lg border border-capsula-line bg-capsula-ivory-alt p-4">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                <div className="lg:col-span-2">
                                    <label className="pos-label">Insumo</label>
                                    <div className="mt-1 flex gap-2">
                                        <div className="flex-1">
                                            <Combobox
                                                items={localItems.map(item => ({ value: item.id, label: `${item.name} (${item.baseUnit})` }))}
                                                value={selectedItem}
                                                onChange={(val) => setSelectedItem(val === selectedItem ? '' : val)}
                                                placeholder="Seleccionar..."
                                                searchPlaceholder="Buscar insumo..."
                                                emptyMessage="No se encontró el insumo."
                                                allowCreate={true}
                                                onCreateNew={() => setIsQuickItemModalOpen(true)}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsQuickItemModalOpen(true)}
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-capsula-line bg-capsula-ivory text-capsula-ink-soft transition-colors hover:border-capsula-navy-deep hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                            title="Crear nuevo insumo"
                                            aria-label="Crear nuevo insumo"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="pos-label">Cantidad</label>
                                    <div className="mt-1 flex gap-1">
                                        <input
                                            type="number"
                                            value={quantity || ''}
                                            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.1"
                                            placeholder="0"
                                            className="pos-input w-16 px-2 py-2 text-sm tabular-nums"
                                        />
                                        <select
                                            value={unit}
                                            onChange={(e) => setUnit(e.target.value)}
                                            className="pos-input flex-1 px-2 py-2 text-sm"
                                        >
                                            <option value={selectedItemData?.baseUnit || 'UNIT'}>
                                                {selectedItemData?.baseUnit || 'UNIT'}
                                            </option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="pos-label">Costo Unit. (USD)</label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-capsula-ink-muted">$</span>
                                        <input
                                            type="number"
                                            value={unitCost || ''}
                                            onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="pos-input w-full py-2 pl-6 pr-2 text-sm tabular-nums"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-end">
                                    <button
                                        onClick={addItem}
                                        disabled={!selectedItem || quantity <= 0}
                                        className="pos-btn inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Agregar
                                    </button>
                                </div>
                            </div>

                            {/* Indicador de cambio de costo */}
                            {selectedItemData && unitCost > 0 && selectedItemData.currentCost > 0 &&
                                Math.abs(unitCost - selectedItemData.currentCost) > 0.01 && (
                                    <p className={cn(
                                        'mt-2 inline-flex items-center gap-1.5 text-xs tabular-nums',
                                        unitCost > selectedItemData.currentCost ? 'text-capsula-coral' : 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                    )}>
                                        {unitCost > selectedItemData.currentCost
                                            ? <TrendingUp className="h-3.5 w-3.5" />
                                            : <TrendingDown className="h-3.5 w-3.5" />}
                                        Costo anterior: ${selectedItemData.currentCost.toFixed(2)} → Nuevo: ${unitCost.toFixed(2)}
                                    </p>
                                )}
                        </div>

                        {/* Lista de items agregados */}
                        {entradaItems.length > 0 ? (
                            <div className="overflow-hidden rounded-lg border border-capsula-line">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-capsula-line bg-capsula-ivory-alt">
                                            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Insumo</th>
                                            <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Cantidad</th>
                                            {showCosts && (
                                                <>
                                                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Costo Unit.</th>
                                                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Total</th>
                                                </>
                                            )}
                                            <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-capsula-line">
                                        {entradaItems.map(item => (
                                            <tr key={item.id} className="hover:bg-capsula-ivory-surface">
                                                <td className="px-4 py-3 font-medium text-capsula-ink">
                                                    {item.itemName}
                                                </td>
                                                <td className="px-4 py-3 text-right text-capsula-ink-soft tabular-nums">
                                                    {formatNumber(item.quantity)} {item.unit}
                                                </td>
                                                {showCosts && (
                                                    <>
                                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-capsula-ink-soft">
                                                            {formatCurrency(item.unitCost)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-capsula-ink">
                                                            {formatCurrency(item.totalCost)}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="rounded-lg p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                        aria-label={`Eliminar ${item.itemName}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {showCosts && (
                                        <tfoot>
                                            <tr className="border-t-2 border-capsula-line-strong bg-capsula-ivory-alt">
                                                <td colSpan={3} className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                                    Total:
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-lg font-semibold tabular-nums text-capsula-ink">
                                                    {formatCurrency(totalEntrada)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-lg border-2 border-dashed border-capsula-line py-8 text-center">
                                <Package className="mx-auto h-8 w-8 text-capsula-ink-faint" />
                                <p className="mt-2 text-capsula-ink-muted">
                                    Agrega los insumos de la nota de entrega
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Resultado */}
                    {result && (
                        <div className={cn(
                            'rounded-xl border p-4',
                            result.success
                                ? 'border-[#D3E2D8] bg-[#E5EDE7]/40 dark:border-[#3a5b48] dark:bg-[#1E3B2C]/40'
                                : 'border-[#E8C2B7] bg-[#F7E3DB]/40 dark:border-[#5b3328] dark:bg-[#3B1F14]/40'
                        )}>
                            <div className="flex items-center gap-2">
                                {result.success
                                    ? <Check className="h-5 w-5 text-[#2F6B4E] dark:text-[#6FB88F]" />
                                    : <AlertTriangle className="h-5 w-5 text-[#B04A2E] dark:text-[#EFD2C8]" />}
                                <p className={cn(
                                    'font-medium',
                                    result.success
                                        ? 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                        : 'text-[#B04A2E] dark:text-[#EFD2C8]'
                                )}>
                                    {result.message}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Panel lateral */}
                <div className="space-y-4">
                    {/* Resumen y botón guardar */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                        <h3 className="mb-4 flex items-center gap-2 font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                            <FileText className="h-5 w-5 text-capsula-ink-soft" /> Resumen de Entrada
                        </h3>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-capsula-ink-muted">N° Referencia:</span>
                                <span className="font-medium text-capsula-ink tabular-nums">
                                    {referenceNumber || '-'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-capsula-ink-muted">Items:</span>
                                <span className="font-medium text-capsula-ink tabular-nums">
                                    {entradaItems.length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-capsula-ink-muted">Documento:</span>
                                <span className={cn(
                                    'inline-flex items-center gap-1 font-medium',
                                    uploadedFile ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-ink-faint'
                                )}>
                                    {uploadedFile && <Check className="h-3.5 w-3.5" />}
                                    {uploadedFile ? 'Adjunto' : 'Sin adjuntar'}
                                </span>
                            </div>
                            {showCosts && (
                                <div className="flex justify-between border-t border-capsula-line pt-3">
                                    <span className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Total:</span>
                                    <span className="font-semibold text-xl tracking-[-0.02em] tabular-nums text-capsula-ink">
                                        {formatCurrency(totalEntrada)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || entradaItems.length === 0}
                            className="pos-btn mt-6 w-full py-3 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Save className="h-4 w-4" /> Guardar Entrada
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Info de costo promedio */}
                    <div className="rounded-xl border border-[#D1DCE9] bg-[#E6ECF4] p-4 dark:border-[#2a3a52] dark:bg-[#1A2636]">
                        <h4 className="mb-2 flex items-center gap-2 font-medium text-[#2A4060] dark:text-[#D1DCE9]">
                            <Lightbulb className="h-4 w-4" /> Costo Promedio Ponderado
                        </h4>
                        <p className="text-sm text-[#2A4060]/85 dark:text-[#D1DCE9]/85">
                            Si el precio de un insumo cambia, el sistema recalcula automáticamente
                            el costo promedio basado en el stock existente y la nueva entrada.
                        </p>
                    </div>

                    {/* Info del usuario */}
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Registrado por</p>
                        <p className="mt-1 font-medium text-capsula-ink">
                            {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-capsula-ink-faint">
                            {displayDate}
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de preview de imagen */}
            {showPreview && uploadedFile && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-capsula-ink/60 p-4 backdrop-blur-sm"
                    onClick={() => setShowPreview(false)}
                >
                    <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory shadow-2xl">
                        <button
                            onClick={() => setShowPreview(false)}
                            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-capsula-ink/70 text-capsula-ivory transition-colors hover:bg-capsula-ink"
                            aria-label="Cerrar preview"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                        {uploadedFile.type.startsWith('image/') ? (
                            <Image
                                src={uploadedFile.url}
                                alt="Nota de entrega"
                                width={800}
                                height={600}
                                className="max-h-[85vh] w-auto object-contain"
                            />
                        ) : (
                            <iframe
                                src={uploadedFile.url}
                                className="h-[80vh] w-[60vw]"
                                title="Documento"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Resultados OCR */}
            {showOcrModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-capsula-ink/60 p-4 backdrop-blur-sm">
                    <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-capsula-line bg-capsula-ivory shadow-2xl">
                        <div className="border-b border-capsula-line bg-capsula-ivory-alt p-4">
                            <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Resultados del Análisis IA</h3>
                            <p className="text-sm text-capsula-ink-muted">
                                Revisa los items detectados. La IA puede equivocarse con la caligrafía difícil.
                            </p>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-4">
                            {ocrSuggestions.length === 0 ? (
                                <p className="text-center text-capsula-ink-muted">No se detectaron items legibles.</p>
                            ) : (
                                <div className="space-y-3">
                                    {ocrSuggestions.map((sugg, idx) => (
                                        <div key={idx} className="flex items-center justify-between rounded-lg border border-capsula-line bg-capsula-ivory p-3 shadow-sm">
                                            <div>
                                                <p className="font-mono text-xs text-capsula-ink-muted">
                                                    Detectado: &quot;{sugg.originalText}&quot;
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    {sugg.match ? (
                                                        <>
                                                            <span className="font-semibold text-[#2F6B4E] dark:text-[#6FB88F]">
                                                                {sugg.match.item.name}
                                                            </span>
                                                            <span className="rounded bg-capsula-ivory-alt px-1.5 py-0.5 text-xs text-capsula-ink-muted tabular-nums">
                                                                {sugg.detectedQuantity} {sugg.match.item.baseUnit}
                                                            </span>
                                                            {sugg.match.score > 0.3 && (
                                                                <AlertTriangle className="h-3.5 w-3.5 text-[#946A1C] dark:text-[#E8D9B8]" aria-label="Confianza baja" />
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-capsula-coral">No encontrado en inventario</span>
                                                    )}
                                                </div>
                                            </div>

                                            {sugg.match && (
                                                <button
                                                    onClick={() => {
                                                        acceptOcrItem(sugg);
                                                        setOcrSuggestions(prev => prev.filter((_, i) => i !== idx));
                                                    }}
                                                    className="rounded-lg bg-[#E5EDE7] px-3 py-1.5 text-sm font-medium text-[#2F6B4E] transition-colors hover:bg-[#D3E2D8] dark:bg-[#1E3B2C] dark:text-[#6FB88F] dark:hover:bg-[#264a39]"
                                                >
                                                    Agregar
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-capsula-line bg-capsula-ivory-alt p-4">
                            <button
                                onClick={() => setShowOcrModal(false)}
                                className="pos-btn-secondary px-4 py-2"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de creación rápida */}
            <QuickItemModal
                isOpen={isQuickItemModalOpen}
                onClose={() => setIsQuickItemModalOpen(false)}
                onSuccess={(newItem) => {
                    setLocalItems([...localItems, newItem]);
                    setSelectedItem(newItem.id);
                }}
            />
        </div>
    );
}

