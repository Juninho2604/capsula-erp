'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getMenuForPOSAction, type CartItem } from '@/app/actions/pos.actions';

interface MenuItem {
    id: string;
    name: string;
    price: number;
    sku: string;
    categoryName?: string;
}

interface ParsedLine {
    raw: string;
    quantity: number;
    productName: string;
    matchedItem: MenuItem | null;
    matchScore: number;
    alternatives: MenuItem[];
    notes: string;
}

interface WhatsAppParserProps {
    onOrderReady: (items: CartItem[], customerName: string, customerPhone: string, customerAddress: string) => void;
}

// Normaliza texto para comparación fuzzy
function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^a-z0-9\s]/g, '') // Solo alfanuméricos
        .replace(/\s+/g, ' ')
        .trim();
}

// Fuzzy match score (0-1)
function fuzzyScore(input: string, target: string): number {
    const a = normalize(input);
    const b = normalize(target);

    // Coincidencia exacta
    if (a === b) return 1;

    // Contiene
    if (b.includes(a)) return 0.9;
    if (a.includes(b)) return 0.85;

    // Token matching - cuántas palabras del input están en el target
    const inputTokens = a.split(' ').filter(t => t.length > 2);
    const targetTokens = b.split(' ').filter(t => t.length > 2);

    if (inputTokens.length === 0 || targetTokens.length === 0) return 0;

    let matchCount = 0;
    for (const token of inputTokens) {
        if (targetTokens.some(t => t.includes(token) || token.includes(t))) {
            matchCount++;
        }
    }

    return matchCount / Math.max(inputTokens.length, 1) * 0.8;
}

// Parsear una línea de texto a cantidad + nombre
function parseLine(line: string): { quantity: number; productName: string; notes: string } | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return null;

    // Ignorar líneas que son saludos o irrelevantes
    const ignorePatterns = /^(hola|buenos|buenas|ok|listo|gracia|perfecto|dale|por favor|si|no|ahi|claro|muchas|buen|hey|bueno|como|esta|cuando|donde|para|aqui|habla|saludo|necesito|quiero|quisiera|pedido|mi pedido|orden|mi orden)/i;
    if (ignorePatterns.test(trimmed)) return null;

    let quantity = 1;
    let productName = trimmed;
    let notes = '';

    // Extraer notas entre paréntesis
    const noteMatch = productName.match(/\(([^)]+)\)/);
    if (noteMatch) {
        notes = noteMatch[1];
        productName = productName.replace(/\(([^)]+)\)/, '').trim();
    }

    // Extraer notas después de " - "
    const dashMatch = productName.match(/\s[-–]\s(.+)$/);
    if (dashMatch) {
        notes = notes ? `${notes}, ${dashMatch[1]}` : dashMatch[1];
        productName = productName.replace(/\s[-–]\s.+$/, '').trim();
    }

    // Patrones de cantidad al inicio: "2x", "2 x", "x2", "2  shak", "#2", "2-"
    const qtyPatterns = [
        /^(\d+)\s*[xX×]\s*/,       // 2x, 2 x, 2×
        /^[xX×]\s*(\d+)\s+/,        // x2
        /^#?(\d+)\s*[-–]?\s+/,      // 2 shawarma, 2- shawarma, #2 shawarma
        /^(\d+)\s+/,                 // simple: "2 whatever"
    ];

    for (const pattern of qtyPatterns) {
        const match = productName.match(pattern);
        if (match) {
            quantity = parseInt(match[1]) || 1;
            productName = productName.replace(pattern, '').trim();
            break;
        }
    }

    // Cantidad al final: "shawarma x2", "shawarma (2)"
    const qtyEndPatterns = [
        /\s*[xX×]\s*(\d+)$/,
        /\s*\((\d+)\)$/,
    ];
    for (const pattern of qtyEndPatterns) {
        const match = productName.match(pattern);
        if (match) {
            quantity = parseInt(match[1]) || quantity;
            productName = productName.replace(pattern, '').trim();
            break;
        }
    }

    if (!productName || productName.length < 2) return null;

    return { quantity, productName, notes };
}

export default function WhatsAppOrderParser({ onOrderReady }: WhatsAppParserProps) {
    const [chatText, setChatText] = useState('');
    const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
    const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isParsing, setIsParsing] = useState(false);

    // Customer info extracted
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');

    // Load menu on mount
    useEffect(() => {
        async function loadMenu() {
            try {
                const result = await getMenuForPOSAction();
                if (result.success && result.data) {
                    const items: MenuItem[] = [];
                    for (const cat of result.data) {
                        for (const item of cat.items) {
                            items.push({
                                id: item.id,
                                name: item.name,
                                price: item.price,
                                sku: item.sku,
                                categoryName: cat.name,
                            });
                        }
                    }
                    setAllMenuItems(items);
                }
            } catch (e) {
                console.error('Error loading menu:', e);
            }
            setIsLoading(false);
        }
        loadMenu();
    }, []);

    const parseChat = useCallback(() => {
        if (!chatText.trim()) return;
        setIsParsing(true);

        // Split into lines
        const lines = chatText.split('\n').filter(l => l.trim());
        const results: ParsedLine[] = [];

        // Try to extract customer info
        for (const line of lines) {
            const phoneMatch = line.match(/(0\d{3}[-\s]?\d{7}|\+?58\d{10})/);
            if (phoneMatch) setCustomerPhone(phoneMatch[1].replace(/[-\s]/g, ''));

            const namePatterns = [
                /(?:nombre|cliente|para|a nombre de)[\s:]+([A-ZÁ-Ú][a-zá-ú]+(?:\s[A-ZÁ-Ú][a-zá-ú]+)*)/i,
                /(?:habla|soy|me llamo)[\s:]+([A-ZÁ-Ú][a-zá-ú]+(?:\s[A-ZÁ-Ú][a-zá-ú]+)*)/i,
            ];
            for (const pat of namePatterns) {
                const nameMatch = line.match(pat);
                if (nameMatch) setCustomerName(nameMatch[1]);
            }

            const addrPatterns = [
                /(?:dirección|direccion|entregar en|enviar a|llevar a|dir)[\s:]+(.{10,})/i,
            ];
            for (const pat of addrPatterns) {
                const addrMatch = line.match(pat);
                if (addrMatch) setCustomerAddress(addrMatch[1].trim());
            }
        }

        // Parse each line for order items
        for (const line of lines) {
            const parsed = parseLine(line);
            if (!parsed) continue;

            // Find best match
            let bestMatch: MenuItem | null = null;
            let bestScore = 0;
            const alternatives: MenuItem[] = [];

            for (const item of allMenuItems) {
                const score = fuzzyScore(parsed.productName, item.name);
                if (score > bestScore) {
                    if (bestMatch) alternatives.push(bestMatch);
                    bestScore = score;
                    bestMatch = item;
                } else if (score > 0.3) {
                    alternatives.push(item);
                }
            }

            // Only accept matches above threshold
            if (bestScore < 0.4) {
                bestMatch = null;
            }

            results.push({
                raw: line.trim(),
                quantity: parsed.quantity,
                productName: parsed.productName,
                matchedItem: bestMatch,
                matchScore: bestScore,
                alternatives: alternatives.sort((a, b) => fuzzyScore(parsed.productName, b.name) - fuzzyScore(parsed.productName, a.name)).slice(0, 5),
                notes: parsed.notes
            });
        }

        setParsedLines(results);
        setIsParsing(false);
    }, [chatText, allMenuItems]);

    const updateMatch = (idx: number, item: MenuItem) => {
        const newParsed = [...parsedLines];
        newParsed[idx] = { ...newParsed[idx], matchedItem: item, matchScore: 1 };
        setParsedLines(newParsed);
    };

    const updateQuantity = (idx: number, qty: number) => {
        const newParsed = [...parsedLines];
        newParsed[idx] = { ...newParsed[idx], quantity: qty };
        setParsedLines(newParsed);
    };

    const removeLine = (idx: number) => {
        setParsedLines(parsedLines.filter((_, i) => i !== idx));
    };

    const matchedLines = parsedLines.filter(l => l.matchedItem);
    const unmatchedLines = parsedLines.filter(l => !l.matchedItem);
    const orderTotal = matchedLines.reduce((sum, l) => sum + (l.matchedItem!.price * l.quantity), 0);

    const handleConfirm = () => {
        const cartItems: CartItem[] = matchedLines.map(l => ({
            menuItemId: l.matchedItem!.id,
            name: l.matchedItem!.name,
            quantity: l.quantity,
            unitPrice: l.matchedItem!.price,
            modifiers: [],
            notes: l.notes || undefined,
            lineTotal: l.matchedItem!.price * l.quantity,
        }));
        onOrderReady(cartItems, customerName, customerPhone, customerAddress);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Input Area */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">💬</span> Pegar Chat de WhatsApp
                    </h3>
                    <span className="text-xs text-gray-400">{allMenuItems.length} items en menú</span>
                </div>

                <textarea
                    id="whatsapp-chat-input"
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    onInput={e => setChatText((e.target as HTMLTextAreaElement).value)}
                    placeholder={`Pega aquí el chat del cliente...\n\nEjemplo:\n2 shawarma mixto\n1 tabla familiar\n3 kebbe frito\nNombre: Juan Pérez\nDirección: Av. Libertador, Edif. Los Pinos, Apto 3B`}
                    rows={8}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white resize-none"
                />

                <button
                    onClick={parseChat}
                    disabled={!chatText.trim() || isParsing}
                    className="mt-3 w-full min-h-[48px] rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                >
                    {isParsing ? '⏳ Analizando...' : '🔍 Analizar Pedido'}
                </button>
            </div>

            {/* Results */}
            {parsedLines.length > 0 && (
                <div className="space-y-4">
                    {/* Customer info */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <h4 className="text-sm font-semibold text-gray-500 mb-3">📋 Datos del Cliente</h4>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Nombre"
                                className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white min-h-[44px]"
                            />
                            <input
                                type="text"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="Teléfono"
                                className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white min-h-[44px]"
                            />
                            <input
                                type="text"
                                value={customerAddress}
                                onChange={e => setCustomerAddress(e.target.value)}
                                placeholder="Dirección"
                                className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white min-h-[44px]"
                            />
                        </div>
                    </div>

                    {/* Matched items */}
                    {matchedLines.length > 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                            <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-3">
                                ✅ Items Reconocidos ({matchedLines.length})
                            </h4>
                            <div className="space-y-2">
                                {parsedLines.map((line, idx) => {
                                    if (!line.matchedItem) return null;
                                    return (
                                        <div key={idx} className="flex items-center gap-3 rounded-lg bg-white p-3 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateQuantity(idx, Math.max(1, line.quantity - 1))}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 font-bold"
                                                >
                                                    −
                                                </button>
                                                <span className="w-8 text-center font-mono font-bold text-lg">{line.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(idx, line.quantity + 1)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 dark:text-white">{line.matchedItem.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-gray-500">"{line.raw}"</p>
                                                    {line.matchScore < 0.9 && (
                                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                                            {Math.round(line.matchScore * 100)}% match
                                                        </span>
                                                    )}
                                                </div>
                                                {line.notes && (
                                                    <p className="text-xs text-blue-500 mt-0.5">📝 {line.notes}</p>
                                                )}
                                            </div>

                                            <div className="text-right">
                                                <p className="font-bold text-emerald-600">${(line.matchedItem.price * line.quantity).toFixed(2)}</p>
                                                <p className="text-xs text-gray-400">${line.matchedItem.price.toFixed(2)} c/u</p>
                                            </div>

                                            <button
                                                onClick={() => removeLine(idx)}
                                                className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    );
                                })}

                                <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-3 dark:border-emerald-800">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Estimado:</span>
                                    <span className="text-xl font-bold text-emerald-600">${orderTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Unmatched items */}
                    {unmatchedLines.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-900/10">
                            <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">
                                ⚠️ No Reconocidos ({unmatchedLines.length})
                            </h4>
                            <div className="space-y-3">
                                {parsedLines.map((line, idx) => {
                                    if (line.matchedItem) return null;
                                    return (
                                        <div key={idx} className="rounded-lg bg-white p-3 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                                    <span className="font-mono font-bold text-amber-600">{line.quantity}x</span> "{line.productName}"
                                                </p>
                                                <button
                                                    onClick={() => removeLine(idx)}
                                                    className="text-xs text-gray-400 hover:text-red-500"
                                                >
                                                    Ignorar
                                                </button>
                                            </div>

                                            {line.alternatives.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="text-xs text-gray-400">¿Quisiste decir?</span>
                                                    {line.alternatives.map(alt => (
                                                        <button
                                                            key={alt.id}
                                                            onClick={() => updateMatch(idx, alt)}
                                                            className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                        >
                                                            {alt.name} (${alt.price})
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Confirm button */}
                    {matchedLines.length > 0 && (
                        <button
                            onClick={handleConfirm}
                            className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-lg font-bold text-white shadow-lg hover:shadow-xl transition-all"
                        >
                            ✅ Cargar {matchedLines.length} items al carrito — ${orderTotal.toFixed(2)}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
