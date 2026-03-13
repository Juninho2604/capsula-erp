'use client';

import { useState, useEffect, useRef } from 'react';

import PrintTicket from '@/components/pos/PrintTicket';
import { createSalesOrderAction, getMenuForPOSAction, validateManagerPinAction, type CartItem } from '@/app/actions/pos.actions';
import { printReceipt, printKitchenCommand } from '@/lib/print-command';

// ============================================================================

interface ModifierOption {
    id: string;
    name: string;
    priceAdjustment: number;
    isAvailable: boolean;
}

interface ModifierGroup {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    modifiers: ModifierOption[];
}

interface MenuItem {
    id: string;
    categoryId: string;
    sku: string;
    name: string;
    price: number;
    modifierGroups: {
        modifierGroup: ModifierGroup
    }[];
}

interface SelectedModifier {
    groupId: string;
    groupName: string;
    id: string;
    name: string;
    priceAdjustment: number;
    quantity: number;
}

type PaymentMethod = 'BS_POS' | 'ZELLE' | 'CASH_USD' | 'MOBILE_PAY';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; emoji: string; hasDivisasDiscount: boolean }[] = [
    { key: 'BS_POS',     label: 'Punto de Venta Bs', emoji: '🏧', hasDivisasDiscount: false },
    { key: 'ZELLE',      label: 'Zelle',              emoji: '💵', hasDivisasDiscount: true  },
    { key: 'CASH_USD',   label: 'Efectivo $',         emoji: '💴', hasDivisasDiscount: true  },
    { key: 'MOBILE_PAY', label: 'Pago Móvil',         emoji: '📱', hasDivisasDiscount: false },
];

export default function POSRestaurantPage() {
    // ── Impresión ──────────────────────────────────────────────────────────
    const ticketRef = useRef<HTMLDivElement>(null);

    const handlePrintTicket = () => {
        const printContent = ticketRef.current;
        if (!printContent) return;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>Factura</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { width: 72mm; min-width: 72mm; max-width: 72mm; margin: 0 auto; padding: 2mm; font-family: 'Times New Roman', serif; }
                        * { box-sizing: border-box; }
                        .text-center { text-align: center; } .text-right { text-align: right; }
                        .font-bold { font-weight: bold; } .italic { font-style: italic; }
                        .uppercase { text-transform: uppercase; } .leading-tight { line-height: 1.1; }
                        .flex { display: flex; } .flex-col { display: flex; flex-direction: column; }
                        .justify-between { justify-content: space-between; } .justify-end { justify-content: flex-end; }
                        .items-end { align-items: flex-end; } .flex-1 { flex: 1; }
                        .w-full { width: 100%; } .w-8 { width: 8mm; display: inline-block; text-align: right; margin-right: 2px; }
                        .w-12 { width: 12mm; display: inline-block; } .w-14 { width: 14mm; display: inline-block; text-align: right; }
                        .w-16 { width: 16mm; display: inline-block; text-align: right; } .w-48 { width: 100%; }
                        .mb-1 { margin-bottom: 3px; } .mb-2 { margin-bottom: 6px; } .mb-4 { margin-bottom: 12px; }
                        .mt-1 { margin-top: 3px; } .mt-2 { margin-top: 6px; } .mt-8 { margin-top: 24px; }
                        .mr-2 { margin-right: 6px; } .pb-2 { padding-bottom: 6px; } .pl-10 { padding-left: 10mm; }
                        .my-2 { margin-top: 6px; margin-bottom: 6px; }
                        .border-b { border-bottom: 1px solid #000; } .border-t { border-top: 1px dashed #000; }
                        .border-dashed { border-style: dashed; }
                        .text-\\[10px\\] { font-size: 10px; } .text-\\[11px\\] { font-size: 11px; }
                        .text-\\[12px\\] { font-size: 12px; } .text-\\[14px\\] { font-size: 14px; }
                        .text-3xl { font-size: 20px; } .font-serif { font-family: 'Times New Roman', serif; }
                        .hidden { display: none; }
                    </style>
                </head>
                <body>${printContent.innerHTML}</body>
                </html>
            `);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 5000);
            }, 500);
        }
    };

    // ── Estado Principal ───────────────────────────────────────────────────
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const [lastOrder, setLastOrder] = useState<{
        orderNumber: string;
        total: number;
        subtotal: number;
        discount: number;
        itemsSnapshot: any[];
        paymentMethod: PaymentMethod;
        amountPaid: number;
    } | null>(null);

    // ── Modal de Modificadores ─────────────────────────────────────────────
    const [showModifierModal, setShowModifierModal] = useState(false);
    const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
    const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemNotes, setItemNotes] = useState('');

    // ── Pago ───────────────────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BS_POS');
    const [amountReceived, setAmountReceived] = useState('');

    // ── Cortesía (variable 0-100%) ─────────────────────────────────────────
    const [cortesiaActive, setCortesiaActive] = useState(false);
    const [cortesiaPct, setCortesiaPct] = useState(100);
    const [cortesiaReason, setCortesiaReason] = useState('');
    const [authorizedManager, setAuthorizedManager] = useState<{ id: string; name: string } | null>(null);

    // Modal cortesía: primero configura %, luego pide PIN
    const [showCortesiaModal, setShowCortesiaModal] = useState(false);
    const [tempPct, setTempPct] = useState(100);
    const [tempReason, setTempReason] = useState('');

    // Modal PIN
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');

    // Responsive
    const [showMobileCart, setShowMobileCart] = useState(false);

    // ── Carga de Menú ──────────────────────────────────────────────────────
    useEffect(() => {
        async function loadMenu() {
            try {
                const result = await getMenuForPOSAction();
                if (result.success && result.data) {
                    setCategories(result.data);
                    if (result.data.length > 0) setSelectedCategory(result.data[0].id);
                }
            } catch (error) {
                console.error('Error cargando menú:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadMenu();
    }, []);

    useEffect(() => {
        if (selectedCategory) {
            const category = categories.find(c => c.id === selectedCategory);
            if (category) setMenuItems(category.items);
        }
    }, [selectedCategory, categories]);

    // Items filtrados por búsqueda (busca en TODAS las categorías)
    const allItems: MenuItem[] = categories.flatMap(c => c.items);
    const filteredItems: MenuItem[] = searchTerm.trim()
        ? allItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : menuItems;

    const getCategoryIcon = (name: string) => {
        if (name.includes('Tabla') || name.includes('Combo')) return '🍱';
        if (name.includes('Queso')) return '🧀';
        if (name.includes('Platos')) return '🍛';
        if (name.includes('Shawarma')) return '🥙';
        if (name.includes('Especial')) return '⭐';
        if (name.includes('Ensalada')) return '🥗';
        if (name.includes('Crema')) return '🥣';
        if (name.includes('Bebida')) return '🥤';
        if (name.includes('Postre')) return '🍨';
        return '🍽️';
    };

    // ── Carrito ────────────────────────────────────────────────────────────
    const handleAddToCart = (item: MenuItem) => {
        setSelectedItemForModifier(item);
        setCurrentModifiers([]);
        setItemQuantity(1);
        setItemNotes('');
        setShowModifierModal(true);
    };

    const removeFromCart = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const updateModifierQuantity = (group: ModifierGroup, modifier: ModifierOption, change: number) => {
        const currentInGroup = currentModifiers.filter(m => m.groupId === group.id);
        const totalSelectedInGroup = currentInGroup.reduce((sum, m) => sum + m.quantity, 0);
        const existingMod = currentModifiers.find(m => m.id === modifier.id && m.groupId === group.id);
        const currentQty = existingMod ? existingMod.quantity : 0;

        if (change > 0) {
            if (group.maxSelections > 1 && totalSelectedInGroup >= group.maxSelections) return;
            if (group.maxSelections === 1) {
                if (totalSelectedInGroup >= 1 && existingMod) return;
                if (totalSelectedInGroup >= 1 && !existingMod) {
                    const others = currentModifiers.filter(m => m.groupId !== group.id);
                    setCurrentModifiers([...others, { groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: 1 }]);
                    return;
                }
            }
        }

        const newQty = currentQty + change;
        if (newQty < 0) return;

        let newModifiers = [...currentModifiers];
        if (existingMod) {
            if (newQty === 0) {
                newModifiers = newModifiers.filter(m => !(m.id === modifier.id && m.groupId === group.id));
            } else {
                newModifiers = newModifiers.map(m => (m.id === modifier.id && m.groupId === group.id) ? { ...m, quantity: newQty } : m);
            }
        } else if (newQty > 0) {
            newModifiers.push({ groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: newQty });
        }
        setCurrentModifiers(newModifiers);
    };

    const isGroupValid = (group: ModifierGroup) => {
        if (!group.isRequired) return true;
        const count = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
        return count >= group.minSelections;
    };

    const confirmAddToCart = () => {
        if (!selectedItemForModifier) return;
        const allGroupsValid = selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup));
        if (!allGroupsValid) return;

        const modifierTotal = currentModifiers.reduce((sum, m) => sum + (m.priceAdjustment * m.quantity), 0);
        const lineTotal = (selectedItemForModifier.price + modifierTotal) * itemQuantity;

        const explodedModifiers = currentModifiers.flatMap(m =>
            Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment })
        );

        const newItem: CartItem = {
            menuItemId: selectedItemForModifier.id,
            name: selectedItemForModifier.name,
            quantity: itemQuantity,
            unitPrice: selectedItemForModifier.price,
            modifiers: explodedModifiers,
            notes: itemNotes || undefined,
            lineTotal,
        };

        setCart([...cart, newItem]);
        setShowModifierModal(false);
        setSelectedItemForModifier(null);
    };

    // ── Totales ────────────────────────────────────────────────────────────
    const cartTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const isDivisas = PAYMENT_METHODS.find(p => p.key === paymentMethod)?.hasDivisasDiscount ?? false;
    const divisasDiscount = isDivisas ? cartTotal * 0.33 : 0;
    const cortesiaDiscount = cortesiaActive ? cartTotal * (cortesiaPct / 100) : 0;
    // Cortesía tiene prioridad sobre divisas
    const discountAmount = cortesiaActive ? cortesiaDiscount : divisasDiscount;
    const finalTotal = cartTotal - discountAmount;
    const paidAmount = parseFloat(amountReceived) || 0;
    const changeAmount = paidAmount - finalTotal;

    // ── Cortesía ───────────────────────────────────────────────────────────
    const handleOpenCortesia = () => {
        setTempPct(cortesiaActive ? cortesiaPct : 100);
        setTempReason(cortesiaActive ? cortesiaReason : '');
        setShowCortesiaModal(true);
    };

    const handleCortesiaConfirmConfig = () => {
        if (!tempReason.trim()) {
            alert('Debes escribir el motivo de la cortesía');
            return;
        }
        setShowCortesiaModal(false);
        setPinInput('');
        setPinError('');
        setShowPinModal(true);
    };

    const handleCancelCortesia = () => {
        setCortesiaActive(false);
        setCortesiaPct(100);
        setCortesiaReason('');
        setAuthorizedManager(null);
    };

    const handlePinSubmit = async () => {
        const res = await validateManagerPinAction(pinInput);
        if (res.success && res.data) {
            setAuthorizedManager({ id: res.data.managerId, name: res.data.managerName });
            setCortesiaActive(true);
            setCortesiaPct(tempPct);
            setCortesiaReason(tempReason);
            setShowPinModal(false);
        } else {
            setPinError('PIN inválido o sin permisos');
        }
    };

    const handlePinKey = (k: string) => {
        if (k === 'back') setPinInput(p => p.slice(0, -1));
        else if (k === 'clear') setPinInput('');
        else if (pinInput.length < 6) setPinInput(p => p + k);
    };

    // ── Pago ───────────────────────────────────────────────────────────────
    const handlePaymentMethodChange = (pm: PaymentMethod) => {
        setPaymentMethod(pm);
        // Si cambia a método sin divisas y hay divisas auto, no afecta cortesía
    };

    // ── Checkout ───────────────────────────────────────────────────────────
    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);
        try {
            const discountType = cortesiaActive ? 'CORTESIA' : (isDivisas ? 'DIVISAS_33' : 'NONE');

            const result = await createSalesOrderAction({
                orderType: 'RESTAURANT',
                customerName: customerName || 'Cliente Restaurante',
                items: cart,
                paymentMethod,
                amountPaid: paidAmount || finalTotal,
                discountType,
                discountPercent: cortesiaActive ? cortesiaPct : undefined,
                courtesyReason: cortesiaActive ? cortesiaReason : undefined,
                authorizedById: authorizedManager?.id,
                notes: undefined
            });

            if (result.success && result.data) {
                printKitchenCommand({
                    orderNumber: result.data.orderNumber,
                    orderType: 'RESTAURANT',
                    customerName: customerName,
                    items: cart.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        modifiers: item.modifiers.map(m => m.name),
                        notes: item.notes,
                    })),
                    createdAt: new Date(),
                });

                setLastOrder({
                    orderNumber: result.data.orderNumber,
                    total: finalTotal,
                    subtotal: cartTotal,
                    discount: discountAmount,
                    paymentMethod,
                    amountPaid: paidAmount || finalTotal,
                    itemsSnapshot: cart.map(item => ({
                        sku: '00-000',
                        name: item.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.lineTotal,
                        modifiers: item.modifiers.map(m => m.name),
                    })),
                });

                setCart([]);
                setCustomerName('');
                setAmountReceived('');
                setCortesiaActive(false);
                setCortesiaPct(100);
                setCortesiaReason('');
                setAuthorizedManager(null);
                setShowMobileCart(false);
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error venta:', error);
            alert('Error procesando venta');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) return <div className="text-white p-10">Cargando menú...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white relative">
            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 fixed top-0 w-full z-30 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🧀</span>
                    <div>
                        <h1 className="text-2xl font-bold">Shanklish POS</h1>
                        <p className="text-amber-100 text-sm">Restaurante</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className="lg:hidden bg-gray-800 p-2 rounded-lg" onClick={() => setShowMobileCart(true)}>
                        🛒 <b>${cartTotal.toFixed(2)}</b>
                    </button>
                    <p className="hidden lg:block font-mono text-lg">{new Date().toLocaleDateString('es-VE')}</p>
                </div>
            </div>

            <div className="flex h-screen pt-[5rem]">
                {/* ── Panel Izquierdo: Menú ─────────────────────────────── */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Barra de búsqueda */}
                    <div className="px-4 pt-4 pb-2 bg-gray-900">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar plato en todo el menú..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-amber-500 outline-none text-lg"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xl">✕</button>
                            )}
                        </div>
                    </div>

                    {/* Categorías (ocultas al buscar) */}
                    {!searchTerm && (
                        <div className="flex gap-2 px-4 pb-2 bg-gray-900 overflow-x-auto whitespace-nowrap snap-x">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-base transition-all flex items-center gap-2 snap-start ${selectedCategory === cat.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-gray-700 text-gray-300'}`}
                                >
                                    <span>{getCategoryIcon(cat.name)}</span> {cat.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Grid de Items */}
                    <div className="flex-1 p-4 overflow-y-auto pb-24">
                        {searchTerm && filteredItems.length === 0 && (
                            <div className="text-center text-gray-500 mt-16 text-lg">No se encontró "{searchTerm}"</div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToCart(item)}
                                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500/50 rounded-2xl p-4 text-left transition-all hover:scale-[1.01] h-36 flex flex-col justify-between shadow-lg"
                                >
                                    <div className="font-bold text-base leading-tight line-clamp-3">{item.name}</div>
                                    <div className="text-2xl font-black text-amber-500">${item.price.toFixed(2)}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Panel Derecho: Carrito ────────────────────────────── */}
                <div className={`fixed inset-0 z-40 bg-gray-900 flex flex-col transition-transform duration-300 lg:static lg:bg-gray-800 lg:w-[22rem] lg:translate-x-0 lg:border-l lg:border-gray-700 ${showMobileCart ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="lg:hidden p-4 border-b border-gray-700 flex justify-between bg-gray-800">
                        <h2 className="font-bold text-xl">Carrito</h2>
                        <button onClick={() => setShowMobileCart(false)}>✕</button>
                    </div>

                    {/* Cliente */}
                    <div className="p-3 border-b border-gray-700 bg-gray-800/50">
                        <input
                            type="text"
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            placeholder="👤 Cliente / Mesa"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:border-amber-500 outline-none"
                        />
                    </div>

                    {/* Items del carrito */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {cart.length === 0 ? (
                            <div className="text-center text-gray-500 mt-10">
                                <div className="text-4xl mb-2">🛒</div>
                                <p>Carrito vacío</p>
                            </div>
                        ) : (
                            cart.map((item, i) => (
                                <div key={i} className="bg-gray-700 p-2.5 rounded-lg border border-gray-600">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 mr-2">
                                            <div className="flex items-center gap-1.5 font-bold text-sm">
                                                <span className="bg-amber-500 text-black w-5 h-5 flex items-center justify-center rounded-full text-xs flex-shrink-0">{item.quantity}</span>
                                                <span className="leading-tight">{item.name}</span>
                                            </div>
                                            {item.modifiers.length > 0 && (
                                                <div className="text-xs text-gray-400 mt-0.5 pl-6">{item.modifiers.map(m => m.name).join(', ')}</div>
                                            )}
                                            {item.notes && (
                                                <div className="text-xs text-amber-300 mt-0.5 pl-6 italic">"{item.notes}"</div>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="font-bold text-amber-400 text-sm">${item.lineTotal.toFixed(2)}</div>
                                            <button onClick={() => removeFromCart(i)} className="text-red-400 text-xs hover:underline">✕</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Panel de Pago */}
                    <div className="p-3 bg-gray-800 border-t border-gray-700 space-y-2.5">
                        {/* Métodos de Pago */}
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1.5">💳 Método de Pago</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {PAYMENT_METHODS.map(pm => (
                                    <button
                                        key={pm.key}
                                        onClick={() => handlePaymentMethodChange(pm.key)}
                                        className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center gap-1.5 justify-center transition-all ${paymentMethod === pm.key ? (pm.hasDivisasDiscount ? 'bg-blue-600 text-white shadow-lg' : 'bg-amber-500 text-black shadow-lg') : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                    >
                                        <span>{pm.emoji}</span>
                                        <span>{pm.label}</span>
                                    </button>
                                ))}
                            </div>
                            {isDivisas && !cortesiaActive && (
                                <p className="text-xs text-blue-400 mt-1 text-center">💵 Descuento divisas 33% aplicado</p>
                            )}
                        </div>

                        {/* Cortesía */}
                        <div className="flex gap-1.5">
                            {cortesiaActive ? (
                                <div className="flex-1 bg-purple-900/40 border border-purple-500/50 rounded-lg px-3 py-2 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-purple-300">🎁 Cortesía {cortesiaPct}%</span>
                                        <p className="text-xs text-purple-400/80 truncate max-w-[120px]">{cortesiaReason}</p>
                                        <p className="text-xs text-purple-400/60">Auth: {authorizedManager?.name}</p>
                                    </div>
                                    <button onClick={handleCancelCortesia} className="text-red-400 hover:text-red-300 text-lg ml-2">✕</button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleOpenCortesia}
                                    className="flex-1 py-2 bg-gray-700 hover:bg-purple-900/30 border border-gray-600 hover:border-purple-500/50 rounded-lg text-xs font-bold text-gray-300 hover:text-purple-300 transition-all flex items-center justify-center gap-1.5"
                                >
                                    🎁 Aplicar Cortesía
                                </button>
                            )}
                        </div>

                        {/* Monto recibido (solo efectivo Bs) */}
                        {paymentMethod === 'BS_POS' && (
                            <div className="bg-gray-900 rounded-lg p-2 border border-gray-700">
                                <label className="text-xs text-gray-400">Recibido Bs:</label>
                                <input
                                    type="number"
                                    value={amountReceived}
                                    onChange={e => setAmountReceived(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded p-1.5 text-right text-white font-bold mt-1"
                                    placeholder="0"
                                />
                            </div>
                        )}

                        {/* Totales */}
                        <div className="bg-gray-900 rounded-lg p-3 border border-gray-700 space-y-1">
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Subtotal</span><span>${cartTotal.toFixed(2)}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-sm text-blue-400">
                                    <span>
                                        {cortesiaActive ? `🎁 Cortesía ${cortesiaPct}%` : '💵 Divisas 33%'}
                                    </span>
                                    <span>-${discountAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-black border-t border-gray-700 pt-1">
                                <span>TOTAL</span>
                                <span className="text-amber-400">${finalTotal.toFixed(2)}</span>
                            </div>
                            {paymentMethod === 'BS_POS' && changeAmount > 0 && (
                                <div className="flex justify-between text-green-400 text-sm">
                                    <span>Cambio</span><span>${changeAmount.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* Botón Cobrar */}
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || isProcessing}
                            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-black text-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? '⏳ Procesando...' : <>✅ COBRAR <span>${finalTotal.toFixed(2)}</span></>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Botón flotante carrito (mobile) */}
            {!showMobileCart && cart.length > 0 && (
                <button
                    onClick={() => setShowMobileCart(true)}
                    className="lg:hidden fixed bottom-6 right-6 bg-amber-500 text-black px-6 py-4 rounded-full font-bold shadow-2xl z-50 animate-bounce"
                >
                    🛒 ${cartTotal.toFixed(2)}
                </button>
            )}

            {/* ── Modal Modificadores ──────────────────────────────────── */}
            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] shadow-2xl border border-gray-700">
                        <div className="p-5 border-b border-gray-700 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-bold text-white">{selectedItemForModifier.name}</h3>
                                <p className="text-amber-500 font-bold text-xl mt-1">${selectedItemForModifier.price.toFixed(2)}</p>
                            </div>
                            <button onClick={() => setShowModifierModal(false)} className="text-gray-400 hover:text-white text-3xl">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {selectedItemForModifier.modifierGroups?.map((groupRel) => {
                                const group = groupRel.modifierGroup;
                                const totalSelected = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                                const isValid = !group.isRequired || totalSelected >= group.minSelections;

                                return (
                                    <div key={group.id} className={`p-4 rounded-xl border-2 ${isValid ? 'border-gray-700 bg-gray-750' : 'border-red-500/50 bg-red-900/10'}`}>
                                        <div className="flex justify-between mb-3">
                                            <h4 className="font-bold text-lg text-amber-100">{group.name}</h4>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${isValid ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                {totalSelected} / {group.maxSelections}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {group.modifiers.map(mod => {
                                                const existing = currentModifiers.find(m => m.id === mod.id && m.groupId === group.id);
                                                const qty = existing ? existing.quantity : 0;
                                                const isMaxReached = group.maxSelections > 1 && totalSelected >= group.maxSelections;
                                                const isRadio = group.maxSelections === 1;

                                                return (
                                                    <div key={mod.id} className={`flex justify-between items-center p-3 rounded-lg border transition-all ${qty > 0 ? 'bg-amber-900/30 border-amber-500' : 'bg-gray-800 border-gray-600'}`}>
                                                        <span className="text-gray-200 font-medium">{mod.name}</span>
                                                        {isRadio ? (
                                                            <button
                                                                onClick={() => updateModifierQuantity(group, mod, 1)}
                                                                className={`w-6 h-6 rounded-full border flex items-center justify-center ${qty > 0 ? 'bg-amber-500 border-amber-500 text-black' : 'border-gray-500'}`}
                                                            >
                                                                {qty > 0 && '✓'}
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-3 bg-gray-900 rounded-lg p-1">
                                                                <button onClick={() => updateModifierQuantity(group, mod, -1)} disabled={qty === 0} className={`w-8 h-8 rounded flex items-center justify-center font-bold ${qty > 0 ? 'bg-gray-700 text-white hover:bg-gray-600' : 'text-gray-600 cursor-not-allowed'}`}>-</button>
                                                                <span className="w-6 text-center font-bold text-amber-500">{qty}</span>
                                                                <button onClick={() => updateModifierQuantity(group, mod, 1)} disabled={isMaxReached} className={`w-8 h-8 rounded flex items-center justify-center font-bold ${!isMaxReached ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>+</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {group.minSelections > 0 && totalSelected < group.minSelections && (
                                            <p className="text-red-400 text-xs mt-2 text-right">Faltan {group.minSelections - totalSelected}</p>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="bg-gray-750 p-4 rounded-xl border border-gray-700">
                                <label className="text-sm text-gray-400 uppercase font-bold block mb-2">📝 Notas de Cocina</label>
                                <textarea
                                    value={itemNotes}
                                    onChange={e => setItemNotes(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white h-20 resize-none focus:border-amber-500 outline-none"
                                    placeholder="Sin cebolla, extra picante..."
                                />
                            </div>

                            <div className="flex items-center justify-between bg-gray-750 p-4 rounded-xl border border-gray-700">
                                <span className="font-bold text-lg">Cantidad</span>
                                <div className="flex items-center gap-4 bg-gray-900 rounded-full p-1">
                                    <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 font-bold text-xl">-</button>
                                    <span className="w-8 text-center font-bold text-xl">{itemQuantity}</span>
                                    <button onClick={() => setItemQuantity(itemQuantity + 1)} className="w-10 h-10 rounded-full bg-amber-500 text-black hover:bg-amber-400 font-bold text-xl">+</button>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-700 flex gap-3">
                            <button onClick={() => setShowModifierModal(false)} className="flex-1 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600">Cancelar</button>
                            <button
                                onClick={confirmAddToCart}
                                disabled={selectedItemForModifier?.modifierGroups.some(g => !isGroupValid(g.modifierGroup))}
                                className="flex-[2] py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black rounded-xl font-black text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ➕ AGREGAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Configurar Cortesía ────────────────────────────── */}
            {showCortesiaModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-sm p-6 border border-purple-500/30 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-3xl">🎁</span>
                            <h3 className="text-xl font-bold">Configurar Cortesía</h3>
                        </div>

                        {/* Porcentaje */}
                        <div className="mb-5">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm text-gray-400 font-bold">Descuento</label>
                                <span className="text-2xl font-black text-purple-400">{tempPct}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={tempPct}
                                onChange={e => setTempPct(Number(e.target.value))}
                                className="w-full accent-purple-500"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0%</span>
                                <span>25%</span>
                                <span>50%</span>
                                <span>75%</span>
                                <span>100%</span>
                            </div>
                            {/* Atajos rápidos */}
                            <div className="flex gap-2 mt-2">
                                {[25, 50, 75, 100].map(p => (
                                    <button key={p} onClick={() => setTempPct(p)} className={`flex-1 py-1 rounded text-xs font-bold ${tempPct === p ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{p}%</button>
                                ))}
                            </div>
                        </div>

                        {/* Montos */}
                        <div className="bg-gray-900 rounded-lg p-3 mb-5 text-sm space-y-1">
                            <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
                            <div className="flex justify-between text-purple-400 font-bold"><span>Descuento {tempPct}%</span><span>-${(cartTotal * tempPct / 100).toFixed(2)}</span></div>
                            <div className="flex justify-between text-white font-black border-t border-gray-700 pt-1"><span>Total</span><span>${(cartTotal * (1 - tempPct / 100)).toFixed(2)}</span></div>
                        </div>

                        {/* Motivo (obligatorio) */}
                        <div className="mb-5">
                            <label className="text-sm text-gray-400 font-bold block mb-1">Motivo <span className="text-red-400">*</span></label>
                            <textarea
                                value={tempReason}
                                onChange={e => setTempReason(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white resize-none h-20 focus:border-purple-500 outline-none text-sm"
                                placeholder="Ej: Cumpleaños de cliente, Queja resuelta, Cortesía de gerencia..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowCortesiaModal(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold">Cancelar</button>
                            <button
                                onClick={handleCortesiaConfirmConfig}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold"
                            >
                                🔐 Autorizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal PIN Gerente ─────────────────────────────────────── */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4">
                    <div className="bg-gray-800 p-6 rounded-2xl w-80 border border-purple-500/30">
                        <div className="text-center mb-4">
                            <span className="text-3xl">🔐</span>
                            <h3 className="text-xl font-bold mt-2">PIN de Gerente</h3>
                            <p className="text-xs text-gray-400 mt-1">Cortesía {tempPct}% - "{tempReason}"</p>
                        </div>
                        <div className="bg-black p-4 rounded-xl text-center text-3xl tracking-widest mb-4 font-mono min-h-[60px] flex items-center justify-center">
                            {pinInput ? pinInput.replace(/./g, '●') : <span className="text-gray-600">● ● ● ●</span>}
                        </div>
                        {pinError && <p className="text-red-400 text-sm text-center mb-2">{pinError}</p>}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                <button key={n} onClick={() => handlePinKey(n.toString())} className="bg-gray-700 hover:bg-gray-600 p-4 rounded-xl font-bold text-xl transition-colors">{n}</button>
                            ))}
                            <button onClick={() => handlePinKey('clear')} className="bg-red-900/50 hover:bg-red-900 text-red-300 rounded-xl font-bold text-sm p-4 transition-colors">C</button>
                            <button onClick={() => handlePinKey('0')} className="bg-gray-700 hover:bg-gray-600 p-4 rounded-xl font-bold text-xl transition-colors">0</button>
                            <button onClick={() => handlePinKey('back')} className="bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-xl p-4 transition-colors">⌫</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowPinModal(false); setShowCortesiaModal(true); }} className="flex-1 py-3 bg-gray-700 rounded-xl font-bold">← Volver</button>
                            <button onClick={handlePinSubmit} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Orden Exitosa ───────────────────────────────────── */}
            {lastOrder && (
                <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4">
                    <div className="bg-white text-black w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-5xl">✅</span>
                        </div>
                        <h2 className="text-3xl font-black mb-2 font-serif text-gray-900">¡Orden Exitosa!</h2>
                        <p className="text-xl text-gray-600 font-serif mb-2">Orden #{lastOrder.orderNumber}</p>
                        <p className="text-sm text-gray-500 mb-6">
                            {PAYMENT_METHODS.find(p => p.key === lastOrder.paymentMethod)?.emoji}{' '}
                            {PAYMENT_METHODS.find(p => p.key === lastOrder.paymentMethod)?.label}
                            {lastOrder.discount > 0 && ` · Descuento $${lastOrder.discount.toFixed(2)}`}
                        </p>

                        <div className="flex flex-col gap-3">
                            <button onClick={handlePrintTicket} className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg">
                                🖨️ IMPRIMIR FACTURA
                            </button>
                            <button onClick={() => setLastOrder(null)} className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold text-lg border-2 border-gray-200">
                                ➕ Nueva Orden
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Componente Oculto para Impresión */}
            {lastOrder && (
                <div style={{ display: 'none' }}>
                    <PrintTicket
                        ref={ticketRef}
                        data={{
                            orderNumber: lastOrder.orderNumber,
                            orderType: 'RESTAURANT',
                            items: lastOrder.itemsSnapshot.map(i => ({
                                name: i.name,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                lineTotal: i.total,
                                modifiers: i.modifiers.map((m: string) => ({ name: m, priceAdjustment: 0 }))
                            })),
                            subtotal: lastOrder.subtotal,
                            total: lastOrder.total,
                            paymentMethod: lastOrder.paymentMethod,
                            amountPaid: lastOrder.amountPaid,
                            change: lastOrder.amountPaid - lastOrder.total > 0 ? lastOrder.amountPaid - lastOrder.total : 0,
                            date: new Date()
                        }}
                    />
                </div>
            )}
        </div>
    );
}
