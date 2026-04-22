'use client';

import { useState, useCallback } from 'react';
import { parseCostUploadAction, processCostImportAction } from '@/app/actions/cost.actions';
import toast from 'react-hot-toast';
import { FileSpreadsheet, Upload, Check, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';

interface CostImportItem {
    row: number;
    date: string;
    category: string;
    productName: string;
    unit: string;
    quantity: number;
    supplier: string;
    currency: 'USD' | 'BS';
    unitCost: number;
    totalCost: number;
    matchedItemId?: string;
    status: 'MATCHED' | 'NOT_FOUND' | 'INVALID';
}

export function CostImporter() {
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewItems, setPreviewItems] = useState<CostImportItem[]>([]);
    const [summary, setSummary] = useState<{ total: number; matched: number; notFound: number; invalid: number } | null>(null);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setPreviewItems([]);
        setSummary(null);

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = (event.target?.result as string)?.split(',')[1];
                if (!base64) {
                    toast.error('Error leyendo archivo');
                    setIsLoading(false);
                    return;
                }

                const result = await parseCostUploadAction(base64);

                if (result.success && result.items) {
                    setPreviewItems(result.items);
                    setSummary(result.summary || null);
                    toast.success(result.message);
                } else {
                    toast.error(result.message);
                }
                setIsLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast.error('Error procesando archivo');
            setIsLoading(false);
        }
    }, []);

    const handleProcessImport = async () => {
        const matchedItems = previewItems
            .filter(item => item.matchedItemId)
            .map(item => ({
                matchedItemId: item.matchedItemId!,
                unitCost: item.unitCost,
                currency: item.currency,
                supplier: item.supplier,
            }));

        if (matchedItems.length === 0) {
            toast.error('No hay items coincidentes para importar');
            return;
        }

        setIsProcessing(true);
        const result = await processCostImportAction(matchedItems);
        setIsProcessing(false);

        if (result.success) {
            toast.success(result.message);
            setPreviewItems([]);
            setSummary(null);
        } else {
            toast.error(result.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                <h3 className="mb-4 inline-flex items-center gap-2 font-medium text-capsula-ink">
                    <Upload className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
                    Importar costos desde Excel
                </h3>

                <label className="block">
                    <div className="flex h-32 w-full cursor-pointer items-center justify-center rounded-[var(--radius)] border border-dashed border-capsula-line bg-capsula-ivory transition-colors hover:border-capsula-navy-deep/40">
                        <div className="text-center">
                            {isLoading ? (
                                <Loader2 className="mx-auto h-7 w-7 animate-spin text-capsula-navy" strokeWidth={1.5} />
                            ) : (
                                <FileSpreadsheet className="mx-auto h-7 w-7 text-capsula-ink-muted" strokeWidth={1.5} />
                            )}
                            <p className="mt-2 text-[13px] text-capsula-ink-muted">
                                {isLoading ? 'Procesando…' : 'Click para subir archivo COSTO.xlsx'}
                            </p>
                        </div>
                    </div>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        disabled={isLoading}
                        className="hidden"
                    />
                </label>

                {/* Summary Cards */}
                {summary && (
                    <div className="mt-4 grid grid-cols-4 gap-3">
                        <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-3 text-center">
                            <div className="font-mono text-[22px] font-semibold text-capsula-ink">{summary.total}</div>
                            <div className="text-[11px] text-capsula-ink-muted">Total</div>
                        </div>
                        <div className="rounded-[var(--radius)] border border-[#D3E2D8] bg-[#E5EDE7] p-3 text-center">
                            <div className="font-mono text-[22px] font-semibold text-[#2F6B4E]">{summary.matched}</div>
                            <div className="text-[11px] text-[#2F6B4E]">Coincidentes</div>
                        </div>
                        <div className="rounded-[var(--radius)] border border-[#E8D9B8] bg-[#F3EAD6] p-3 text-center">
                            <div className="font-mono text-[22px] font-semibold text-[#946A1C]">{summary.notFound}</div>
                            <div className="text-[11px] text-[#946A1C]">No encontrados</div>
                        </div>
                        <div className="rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle/40 p-3 text-center">
                            <div className="font-mono text-[22px] font-semibold text-capsula-coral">{summary.invalid}</div>
                            <div className="text-[11px] text-capsula-coral">Inválidos</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Table */}
            {previewItems.length > 0 && (
                <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-cap-soft">
                    <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-ivory p-4">
                        <h3 className="font-medium text-capsula-ink">
                            Vista previa <span className="text-[11px] text-capsula-ink-muted">({previewItems.length} registros)</span>
                        </h3>
                        <Button
                            variant="primary"
                            onClick={handleProcessImport}
                            disabled={isProcessing || summary?.matched === 0}
                            isLoading={isProcessing}
                        >
                            <Check className="h-4 w-4" strokeWidth={2} />
                            {isProcessing ? 'Procesando…' : `Importar ${summary?.matched || 0} costos`}
                        </Button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                        <table className="w-full border-collapse text-[13px]">
                            <thead className="sticky top-0">
                                <tr className="border-b border-capsula-line bg-capsula-ivory">
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Estado</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Fecha</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Producto</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Categoría</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Proveedor</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Costo unit.</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Moneda</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewItems.slice(0, 100).map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className={item.status === 'MATCHED'
                                            ? 'border-b border-capsula-line bg-[#E5EDE7]/40 last:border-b-0'
                                            : 'border-b border-capsula-line bg-[#F3EAD6]/30 last:border-b-0'
                                        }
                                    >
                                        <td className="px-4 py-3">
                                            {item.status === 'MATCHED' ? (
                                                <Badge variant="ok"><Check className="h-3 w-3" strokeWidth={2} /> Match</Badge>
                                            ) : (
                                                <Badge variant="warn"><HelpCircle className="h-3 w-3" strokeWidth={1.5} /> No encontrado</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-capsula-ink-soft">{item.date}</td>
                                        <td className="px-4 py-3 font-medium text-capsula-ink">{item.productName}</td>
                                        <td className="px-4 py-3 text-capsula-ink-soft">{item.category}</td>
                                        <td className="px-4 py-3 text-capsula-ink-soft">{item.supplier}</td>
                                        <td className="px-4 py-3 text-right font-mono text-capsula-ink">
                                            {item.unitCost.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant={item.currency === 'USD' ? 'ok' : 'info'}>
                                                {item.currency === 'USD' ? '$' : 'Bs'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {previewItems.length > 100 && (
                            <div className="border-t border-capsula-line bg-capsula-ivory p-4 text-center text-[12px] text-capsula-ink-muted">
                                Mostrando 100 de {previewItems.length} registros
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
