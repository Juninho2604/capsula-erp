'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    MessageCircle,
    Search,
    Loader2,
    Trash2,
    Check,
    HelpCircle,
    Plus,
    Minus,
    Upload,
    X as XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllItemsForPurchaseAction } from '@/app/actions/purchase.actions';
import { Combobox } from '@/components/ui/combobox';

interface InventoryItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    baseUnit: string;
}

export interface PurchaseOrderParsedItem {
    inventoryItemId: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
}

interface WhatsAppPurchaseParserProps {
    onOrderReady: (items: PurchaseOrderParsedItem[], supplierName?: string, notes?: string) => void;
}

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function fuzzyScore(input: string, target: string): number {
    const a = normalize(input);
    const b = normalize(target);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (b.includes(a)) return 0.92;
    if (a.includes(b)) return 0.88;

    const inputTokens = a.split(' ').filter(t => t.length > 1);
    const targetTokens = b.split(' ').filter(t => t.length > 1);
    if (inputTokens.length === 0 || targetTokens.length === 0) return 0;

    let matchCount = 0;
    let partialMatchCount = 0;
    for (const token of inputTokens) {
        const exactMatch = targetTokens.some(t => t === token);
        const partialMatch = targetTokens.some(t => t.includes(token) || token.includes(t));
        if (exactMatch) matchCount++;
        else if (partialMatch) partialMatchCount++;
    }
    return ((matchCount + partialMatchCount * 0.6) / Math.max(inputTokens.length, 1)) * 0.85;
}

function parsePurchaseLine(line: string): { quantity: number; productName: string; notes: string } | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return null;

    const ignorePatterns = /^(hola|buenos|buenas|ok|listo|gracia|perfecto|dale|por favor|si|no|ahi|claro|muchas|buen|hey|bueno|como|esta|cuando|donde|aqui|habla|saludo|bienvenido|menu|ver|tienen|disponible|hay|precio|cuanto|cuesta|omitir|ya|voy|lista|vale|exacto|genial|super|excelente|foto|imagen|audio|video|sticker|gif|documento|ubicacion|contacto|eliminaste)/i;
    if (ignorePatterns.test(trimmed.replace(/^[^a-záéíóú]*/i, ''))) return null;
    if (trimmed.length < 4 && !/^\d/.test(trimmed)) return null;

    let quantity = 1;
    let productName = trimmed;
    let notes = '';

    const noteMatch = productName.match(/\(([^)]+)\)/);
    if (noteMatch) {
        notes = noteMatch[1];
        productName = productName.replace(/\(([^)]+)\)/, '').trim();
    }
    const dashMatch = productName.match(/\s[-–]\s(.+)$/);
    if (dashMatch) {
        notes = notes ? `${notes}, ${dashMatch[1]}` : dashMatch[1];
        productName = productName.replace(/\s[-–]\s.+$/, '').trim();
    }

    const qtyPatterns = [
        /^(\d+(?:[.,]\d+)?)\s*[xX×]\s*/,
        /^[xX×]\s*(\d+(?:[.,]\d+)?)\s+/,
        /^#?(\d+(?:[.,]\d+)?)\s*[-–]?\s+/,
        /^(\d+(?:[.,]\d+)?)\s+/,
    ];
    for (const pattern of qtyPatterns) {
        const match = productName.match(pattern);
        if (match) {
            quantity = parseFloat(match[1].replace(',', '.')) || 1;
            productName = productName.replace(pattern, '').trim();
            break;
        }
    }

    const qtyEndPatterns = [/\s*[xX×]\s*(\d+(?:[.,]\d+)?)$/, /\s*\((\d+(?:[.,]\d+)?)\)$/];
    for (const pattern of qtyEndPatterns) {
        const match = productName.match(pattern);
        if (match) {
            quantity = parseFloat(match[1].replace(',', '.')) || quantity;
            productName = productName.replace(pattern, '').trim();
            break;
        }
    }

    if (!productName || productName.length < 2) return null;
    return { quantity, productName, notes };
}

let _idCounter = 0;
function genId() {
    return `po-${Date.now()}-${_idCounter++}`;
}

interface ParsedLine {
    id: string;
    raw: string;
    quantity: number;
    productName: string;
    matchedItem: InventoryItem | null;
    matchScore: number;
    alternatives: InventoryItem[];
    notes: string;
}

export default function WhatsAppPurchaseOrderParser({ onOrderReady }: WhatsAppPurchaseParserProps) {
    const [chatText, setChatText] = useState('');
    const [allItems, setAllItems] = useState<InventoryItem[]>([]);
    const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isParsing, setIsParsing] = useState(false);
    const [supplierName, setSupplierName] = useState('');
    const [extractedNotes, setExtractedNotes] = useState('');
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [manualProductId, setManualProductId] = useState('');
    const [manualQuantity, setManualQuantity] = useState(1);

    useEffect(() => {
        async function load() {
            const items = await getAllItemsForPurchaseAction();
            setAllItems(items.map(i => ({ id: i.id, name: i.name, sku: i.sku, category: i.category || 'Sin Categoría', baseUnit: i.baseUnit })));
            setIsLoading(false);
        }
        load();
    }, []);

    const parseChat = useCallback(() => {
        if (!chatText.trim()) return;
        setIsParsing(true);

        const lines = chatText.split('\n').filter(l => l.trim());
        for (const line of lines) {
            const provMatch = line.match(/(?:proveedor|provider|de)[\s:]+([A-Za-zÁ-Úá-ú\s]+)/i);
            if (provMatch) setSupplierName(provMatch[1].trim());
        }

        const results: ParsedLine[] = [];
        for (const line of lines) {
            const parsed = parsePurchaseLine(line);
            if (!parsed) continue;

            let bestMatch: InventoryItem | null = null;
            let bestScore = 0;
            const alternatives: InventoryItem[] = [];

            for (const item of allItems) {
                const score = Math.max(fuzzyScore(parsed.productName, item.name), fuzzyScore(parsed.productName, item.sku || ''));
                if (score > bestScore) {
                    if (bestMatch) alternatives.push(bestMatch);
                    bestScore = score;
                    bestMatch = item;
                } else if (score > 0.25) {
                    alternatives.push(item);
                }
            }

            if (bestScore < 0.4) bestMatch = null;

            results.push({
                id: genId(),
                raw: line.trim(),
                quantity: parsed.quantity,
                productName: parsed.productName,
                matchedItem: bestMatch,
                matchScore: bestScore,
                alternatives: alternatives.sort((a, b) => fuzzyScore(parsed.productName, b.name) - fuzzyScore(parsed.productName, a.name)).slice(0, 8),
                notes: parsed.notes,
            });
        }

        setParsedLines(results);
        setIsParsing(false);
    }, [chatText, allItems]);

    const updateMatch = (id: string, item: InventoryItem) => {
        setParsedLines(prev => prev.map(l => l.id === id ? { ...l, matchedItem: item, matchScore: 1 } : l));
    };

    const updateQuantity = (id: string, qty: number) => {
        if (qty <= 0) setParsedLines(prev => prev.filter(l => l.id !== id));
        else setParsedLines(prev => prev.map(l => l.id === id ? { ...l, quantity: qty } : l));
    };

    const removeLine = (id: string) => setParsedLines(prev => prev.filter(l => l.id !== id));

    const addManualProduct = () => {
        if (!manualProductId) return;
        const item = allItems.find(i => i.id === manualProductId);
        if (!item) return;
        setParsedLines(prev => [...prev, {
            id: genId(),
            raw: '(Agregado manualmente)',
            quantity: manualQuantity,
            productName: item.name,
            matchedItem: item,
            matchScore: 1,
            alternatives: [],
            notes: '',
        }]);
        setManualProductId('');
        setManualQuantity(1);
        setShowAddProduct(false);
    };

    const matchedLines = parsedLines.filter(l => l.matchedItem);
    const unmatchedLines = parsedLines.filter(l => !l.matchedItem);

    const handleConfirm = () => {
        const items: PurchaseOrderParsedItem[] = matchedLines.map(l => ({
            inventoryItemId: l.matchedItem!.id,
            name: l.matchedItem!.name,
            category: l.matchedItem!.category,
            quantity: l.quantity,
            unit: l.matchedItem!.baseUnit,
        }));
        onOrderReady(items, supplierName || undefined, extractedNotes || undefined);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <div className="flex flex-col items-center gap-2 text-capsula-ink-muted">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Cargando insumos…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-semibold text-capsula-ink">
                        <MessageCircle className="h-5 w-5 text-capsula-ink-soft" /> Pegar Chat de WhatsApp
                    </h3>
                    <span className="text-xs text-capsula-ink-muted tabular-nums">{allItems.length} insumos disponibles</span>
                </div>

                <textarea
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    placeholder={`Pega aquí el chat del proveedor...\n\nEjemplo:\n2 kg Arroz\n5x Aceite de oliva\n10 unidades Harina\n3 Crema de ajo\nProveedor: Distribuidora Los Andes`}
                    rows={8}
                    className="pos-input w-full resize-none px-4 py-3 text-sm font-mono"
                />

                <div className="mt-3 flex gap-2">
                    <button
                        onClick={parseChat}
                        disabled={!chatText.trim() || isParsing}
                        className="pos-btn inline-flex flex-1 min-h-[48px] items-center justify-center gap-2 px-6 py-3 disabled:opacity-50"
                    >
                        {isParsing
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando…</>
                            : <><Search className="h-4 w-4" /> Analizar Orden</>}
                    </button>
                    {parsedLines.length > 0 && (
                        <button
                            onClick={() => { setParsedLines([]); setChatText(''); setSupplierName(''); setExtractedNotes(''); }}
                            className="pos-btn-secondary inline-flex min-h-[48px] items-center gap-2 px-4 py-3 text-sm"
                        >
                            <Trash2 className="h-4 w-4" /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {parsedLines.length > 0 && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-5 shadow-sm">
                        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Datos extraídos</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <input
                                type="text"
                                value={supplierName}
                                onChange={e => setSupplierName(e.target.value)}
                                placeholder="Proveedor"
                                className="pos-input min-h-[44px] px-3 py-2.5 text-sm"
                            />
                            <input
                                type="text"
                                value={extractedNotes}
                                onChange={e => setExtractedNotes(e.target.value)}
                                placeholder="Notas / Instrucciones"
                                className="pos-input min-h-[44px] px-3 py-2.5 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-capsula-navy-deep px-5 py-3 text-capsula-ivory shadow-cap-soft">
                        <div className="flex items-center gap-4">
                            <div>
                                <span className="text-sm opacity-80">Reconocidos</span>
                                <span className="ml-1.5 text-lg font-semibold tabular-nums">{matchedLines.length}</span>
                            </div>
                            {unmatchedLines.length > 0 && (
                                <div>
                                    <span className="text-sm opacity-80">Sin match</span>
                                    <span className="ml-1.5 text-lg font-semibold tabular-nums text-[#E8D9B8]">{unmatchedLines.length}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                        <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
                            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">Items de la Orden ({parsedLines.length})</h4>
                            <button
                                onClick={() => setShowAddProduct(!showAddProduct)}
                                className="pos-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                            >
                                <Plus className="h-3.5 w-3.5" /> Agregar Item
                            </button>
                        </div>

                        {showAddProduct && (
                            <div className="flex items-center gap-3 border-b border-capsula-line bg-capsula-ivory-alt px-5 py-3">
                                <div className="flex-1">
                                    <Combobox
                                        items={allItems.map(i => ({ value: i.id, label: `${i.name} (${i.baseUnit})` }))}
                                        value={manualProductId}
                                        onChange={setManualProductId}
                                        placeholder="Buscar insumo..."
                                        searchPlaceholder="Arroz, Aceite, Harina..."
                                    />
                                </div>
                                <input
                                    type="number"
                                    min={0.1}
                                    step={0.1}
                                    value={manualQuantity}
                                    onChange={e => setManualQuantity(parseFloat(e.target.value) || 1)}
                                    className="pos-input min-h-[40px] w-20 px-2 py-2 text-center text-sm tabular-nums"
                                />
                                <button
                                    onClick={addManualProduct}
                                    disabled={!manualProductId}
                                    className="pos-btn inline-flex min-h-[40px] items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
                                >
                                    <Check className="h-4 w-4" /> Agregar
                                </button>
                            </div>
                        )}

                        <div className="divide-y divide-capsula-line">
                            {parsedLines.map((line) => (
                                <div
                                    key={line.id}
                                    className={cn(
                                        'px-5 py-3 transition-colors',
                                        !line.matchedItem && 'bg-[#F3EAD6]/40 dark:bg-[#3B2F15]/40',
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                                            line.matchedItem
                                                ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]'
                                                : 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]'
                                        )}>
                                            {line.matchedItem
                                                ? <Check className="h-4 w-4" />
                                                : <HelpCircle className="h-4 w-4" />}
                                        </div>

                                        <div className="flex flex-shrink-0 items-center gap-1">
                                            <button
                                                onClick={() => updateQuantity(line.id, line.quantity - 0.1)}
                                                className="flex h-7 w-7 items-center justify-center rounded-md bg-capsula-ivory-alt text-capsula-ink-soft transition-colors hover:bg-capsula-line-strong hover:text-capsula-ink"
                                                aria-label="Disminuir cantidad"
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </button>
                                            <input
                                                type="number"
                                                min={0.1}
                                                step={0.1}
                                                value={line.quantity}
                                                onChange={e => updateQuantity(line.id, parseFloat(e.target.value) || 1)}
                                                className="pos-input w-14 px-1 py-1 text-center text-sm font-mono tabular-nums"
                                            />
                                            <button
                                                onClick={() => updateQuantity(line.id, line.quantity + 0.1)}
                                                className="flex h-7 w-7 items-center justify-center rounded-md bg-capsula-navy-soft text-capsula-ink transition-colors hover:bg-capsula-navy-deep hover:text-capsula-ivory"
                                                aria-label="Aumentar cantidad"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            {line.matchedItem ? (
                                                <div>
                                                    <p className="truncate font-medium text-capsula-ink">{line.matchedItem.name}</p>
                                                    <p className="truncate text-[11px] text-capsula-ink-muted">&quot;{line.raw}&quot;</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-sm text-capsula-ink-soft">
                                                        <span className="font-mono text-[#946A1C] dark:text-[#E8D9B8]">?</span> &quot;{line.productName}&quot;
                                                    </p>
                                                    <p className="text-[11px] text-capsula-ink-muted">No se encontró en insumos</p>
                                                </div>
                                            )}
                                        </div>

                                        {line.matchedItem && (
                                            <span className="flex-shrink-0 text-xs text-capsula-ink-muted">{line.matchedItem.baseUnit}</span>
                                        )}

                                        <div className="flex flex-shrink-0 gap-1">
                                            {!line.matchedItem && line.alternatives.length > 0 && (
                                                <>
                                                    {line.alternatives.slice(0, 3).map(alt => (
                                                        <button
                                                            key={alt.id}
                                                            onClick={() => updateMatch(line.id, alt)}
                                                            className="rounded-full border border-capsula-line bg-capsula-ivory px-2.5 py-1 text-[11px] font-medium text-capsula-ink-soft transition-colors hover:border-capsula-navy-deep hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                                        >
                                                            {alt.name}
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                            <button
                                                onClick={() => removeLine(line.id)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                                aria-label={`Quitar ${line.matchedItem?.name || line.productName}`}
                                            >
                                                <XIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {matchedLines.length > 0 && (
                        <button
                            onClick={handleConfirm}
                            className="pos-btn flex min-h-[56px] w-full items-center justify-center gap-3 px-6 py-4"
                        >
                            <Upload className="h-5 w-5" />
                            <span>Cargar {matchedLines.length} items a la orden</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
