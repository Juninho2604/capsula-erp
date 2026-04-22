'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { createSalesOrderAction, recordCollectiveTipAction, getMenuForPOSAction, validateManagerPinAction, type CartItem, type PaymentLine } from '@/app/actions/pos.actions';
import MixedPaymentSelector from '@/components/pos/MixedPaymentSelector';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { printReceipt, printKitchenCommand } from '@/lib/print-command';
import { getPOSConfig } from '@/lib/pos-settings';
import toast from 'react-hot-toast';
import WhatsAppOrderParser from '@/components/whatsapp-order-parser';
import { PriceDisplay } from '@/components/pos/PriceDisplay';
import { CurrencyCalculator } from '@/components/pos/CurrencyCalculator';
import type { LucideIcon } from 'lucide-react';
import {
    Bike, MessageCircle, Coins, Package, User, Phone, MapPin, Search, X,
    Plus, Minus, Loader2, Check, ShoppingBag, Sandwich, Pizza, Soup,
    Utensils, UtensilsCrossed, Beef, Wheat, Cookie, GlassWater, Salad,
    Banknote, Euro, Zap, CreditCard, Smartphone, Gift, Split,
    MessageSquare, Trash2, Delete,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const DELIVERY_FEE_NORMAL = 4.5;
const DELIVERY_FEE_DIVISAS = 3;


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
    modifierGroups: { modifierGroup: ModifierGroup }[];
}

interface SelectedModifier {
    groupId: string;
    groupName: string;
    id: string;
    name: string;
    priceAdjustment: number;
    quantity: number;
}

export default function POSDeliveryPage() {
    const { posFullscreen } = useUIStore();
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);


    // MODAL STATE
    const [showModifierModal, setShowModifierModal] = useState(false);
    const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
    const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemNotes, setItemNotes] = useState('');

    // PAYMENT STATE
    const [isMixedMode, setIsMixedMode] = useState(false);
    // Single-payment mode
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CASH_USD' | 'CASH_EUR' | 'CASH_BS' | 'CARD' | 'TRANSFER' | 'MOVIL_NG' | 'PDV_SHANKLISH' | 'PDV_SUPERFERRO' | 'ZELLE'>('PDV_SHANKLISH');
    const [amountReceived, setAmountReceived] = useState('');
    // Mixed-payment mode
    const [mixedPayments, setMixedPayments] = useState<PaymentLine[]>([]);
    const [mixedPaymentsComplete, setMixedPaymentsComplete] = useState(false);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);

    // DISCOUNT STATE
    const [discountType, setDiscountType] = useState<'NONE' | 'DIVISAS_33' | 'CORTESIA_100' | 'CORTESIA_PERCENT'>('NONE');
    const [authorizedManager, setAuthorizedManager] = useState<{ id: string, name: string } | null>(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [cortesiaPercent, setCortesiaPercent] = useState('100');

    // PROPINA COLECTIVA
    const [showTipModal, setShowTipModal] = useState(false);
    const [tipAmount, setTipAmount] = useState('');
    const [tipMethod, setTipMethod] = useState<string>('CASH_USD');
    const [tipClientRef, setTipClientRef] = useState('');
    const [isTipProcessing, setIsTipProcessing] = useState(false);

    // WHATSAPP PARSER
    const [showWhatsAppParser, setShowWhatsAppParser] = useState(false);

    // SEARCH
    const [productSearch, setProductSearch] = useState('');

    const [mobileView, setMobileView] = useState<"menu" | "order">("menu");

    useEffect(() => {
        async function loadMenu() {
            try {
                const [menuResult, rate] = await Promise.all([
                    getMenuForPOSAction(),
                    getExchangeRateValue(),
                ]);
                if (menuResult.success && menuResult.data) {
                    setCategories(menuResult.data);
                    if (menuResult.data.length > 0) setSelectedCategory(menuResult.data[0].id);
                }
                setExchangeRate(rate);
            } catch (error) { console.error(error); } finally { setIsLoading(false); }
        }
        loadMenu();
    }, []);

    useEffect(() => {
        if (selectedCategory) {
            const cat = categories.find(c => c.id === selectedCategory);
            if (cat) setMenuItems(cat.items);
        }
    }, [selectedCategory, categories]);

    useEffect(() => {
        // Auto-clear Divisas in single mode when method switches away from USD
        if (!isMixedMode && !isDivisasMethod(paymentMethod) && discountType === 'DIVISAS_33') {
            setDiscountType('NONE');
        }
    }, [isMixedMode, paymentMethod, discountType]);

    const filteredMenuItems = productSearch.trim()
        ? categories.flatMap((c: any) => c.items as MenuItem[]).filter((i) =>
              i.name.toLowerCase().includes(productSearch.toLowerCase()) ||
              i.sku?.toLowerCase().includes(productSearch.toLowerCase())
          )
        : menuItems;

    const getCategoryIcon = (name: string): LucideIcon => {
        const n = name.toLowerCase();
        if (n.includes('tabla') || n.includes('combo')) return UtensilsCrossed;
        if (n.includes('queso')) return Pizza;
        if (n.includes('plato')) return Soup;
        if (n.includes('sandwich') || n.includes('wrap')) return Sandwich;
        if (n.includes('carne') || n.includes('proteína')) return Beef;
        if (n.includes('pan') || n.includes('bread')) return Wheat;
        if (n.includes('postre') || n.includes('dulce')) return Cookie;
        if (n.includes('bebida') || n.includes('trago')) return GlassWater;
        if (n.includes('ensalada')) return Salad;
        if (n.includes('entrada') || n.includes('aperitivo')) return Utensils;
        return Package;
    };

    const handleAddToCart = (item: MenuItem) => {
        setSelectedItemForModifier(item);
        setCurrentModifiers([]);
        setItemQuantity(1);
        setItemNotes('');
        setShowModifierModal(true);
    };

    const removeFromCart = (i: number) => {
        const nc = [...cart]; nc.splice(i, 1); setCart(nc);
    };

    // LOGICA ACTUALIZADA DE MODIFICADORES CON CANTIDAD
    const updateModifierQuantity = (group: ModifierGroup, modifier: ModifierOption, change: number) => {
        const currentInGroup = currentModifiers.filter(m => m.groupId === group.id);
        const totalSelectedInGroup = currentInGroup.reduce((s, m) => s + m.quantity, 0);
        const existingMod = currentModifiers.find(m => m.id === modifier.id && m.groupId === group.id);
        const currentQty = existingMod ? existingMod.quantity : 0;

        if (change > 0) {
            if (group.maxSelections > 1 && totalSelectedInGroup >= group.maxSelections) return;
            if (group.maxSelections === 1) {
                if (totalSelectedInGroup >= 1 && existingMod) return;
                if (totalSelectedInGroup >= 1 && !existingMod) {
                    const others = currentModifiers.filter(m => m.groupId !== group.id);
                    setCurrentModifiers([...others, {
                        groupId: group.id, groupName: group.name,
                        id: modifier.id, name: modifier.name,
                        priceAdjustment: modifier.priceAdjustment, quantity: 1
                    }]);
                    return;
                }
            }
        }

        const newQty = currentQty + change;
        if (newQty < 0) return;

        let newModifiers = [...currentModifiers];
        if (existingMod) {
            if (newQty === 0) newModifiers = newModifiers.filter(m => !(m.id === modifier.id && m.groupId === group.id));
            else newModifiers = newModifiers.map(m => (m.id === modifier.id && m.groupId === group.id) ? { ...m, quantity: newQty } : m);
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
        if (!selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup))) return;

        const modTotal = currentModifiers.reduce((s, m) => s + (m.priceAdjustment * m.quantity), 0);
        const lineTotal = (selectedItemForModifier.price + modTotal) * itemQuantity;

        const explodedModifiers = currentModifiers.flatMap(m => Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment }));

        setCart([...cart, {
            menuItemId: selectedItemForModifier.id, name: selectedItemForModifier.name, quantity: itemQuantity, unitPrice: selectedItemForModifier.price,
            modifiers: explodedModifiers, notes: itemNotes || undefined, lineTotal
        }]);
        setShowModifierModal(false); setSelectedItemForModifier(null);
    };

    const cartSubtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
    // Divisas methods: CASH, CASH_USD, CASH_EUR, ZELLE get 33.33% discount
    const roundToWhole = (amount: number, method: string): number =>
        (method === 'CASH_USD' || method === 'ZELLE' || method === 'CASH_BS') ? Math.round(amount) : amount;
    const isDivisasMethod = (m: string) => m === 'CASH' || m === 'CASH_USD' || m === 'CASH_EUR' || m === 'ZELLE';
    // Bs methods: user enters amount in Bs, needs conversion to USD
    const BS_SINGLE_METHODS = new Set(['PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG', 'CASH_BS']);
    const isBsPayMethod = BS_SINGLE_METHODS.has(paymentMethod);
    // isPagoDivisas: single mode → method must be CASH/CASH_USD/CASH_EUR/ZELLE; mixed → at least one divisas line
    const isPagoDivisas = isMixedMode
        ? mixedPayments.some(p => isDivisasMethod(p.method))
        : isDivisasMethod(paymentMethod);
    // In mixed mode, divisas discount only applies to the USD portion
    const divisasUsdAmount = isMixedMode
        ? mixedPayments.filter(p => isDivisasMethod(p.method)).reduce((s, p) => s + p.amountUSD, 0)
        : undefined; // undefined = full total gets -33%
    const cortesiaPercentNum = Math.min(100, Math.max(0, parseFloat(cortesiaPercent) || 0));
    const deliveryFee = discountType === 'DIVISAS_33' && isPagoDivisas ? DELIVERY_FEE_DIVISAS : DELIVERY_FEE_NORMAL;
    const itemsAfterDiscount = discountType === 'DIVISAS_33' && isPagoDivisas
        ? cartSubtotal - (isMixedMode ? (divisasUsdAmount ?? 0) / 3 : cartSubtotal / 3)
        : discountType === 'CORTESIA_100' ? 0
        : discountType === 'CORTESIA_PERCENT' ? cartSubtotal * (1 - cortesiaPercentNum / 100)
        : cartSubtotal;
    const finalTotal = roundToWhole(
        (discountType === 'CORTESIA_100') ? 0
        : discountType === 'CORTESIA_PERCENT' ? itemsAfterDiscount + (cortesiaPercentNum >= 100 ? 0 : deliveryFee)
        : itemsAfterDiscount + deliveryFee,
        paymentMethod
    );
    const totalMixedPaid = mixedPayments.reduce((s, p) => s + p.amountUSD, 0);

    const handleRecordTip = async () => {
        const amount = parseFloat(tipAmount);
        if (!amount || amount <= 0) return;
        setIsTipProcessing(true);
        try {
            const note = tipClientRef.trim()
                ? `Propina colectiva — Cliente: ${tipClientRef.trim()}`
                : 'Propina colectiva';
            const result = await recordCollectiveTipAction({ tipAmount: amount, paymentMethod: tipMethod, note });
            if (result.success) {
                toast.success(`Propina de $${amount.toFixed(2)} registrada`);
                setShowTipModal(false);
                setTipAmount('');
                setTipMethod('CASH_USD');
                setTipClientRef('');
            } else {
                toast.error(result.message || 'Error al registrar propina');
            }
        } finally {
            setIsTipProcessing(false);
        }
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);
        try {
            const result = await createSalesOrderAction({
                orderType: 'DELIVERY',
                customerName: customerName || 'Delivery',
                customerPhone, customerAddress: customerAddress || 'N/A',
                items: cart,
                ...(isMixedMode
                    ? { payments: mixedPayments.length > 0 ? mixedPayments : [{ method: 'TRANSFER', amountUSD: finalTotal }],
                        amountPaid: totalMixedPaid || finalTotal,
                        divisasUsdAmount: discountType === 'DIVISAS_33' ? divisasUsdAmount : undefined }
                    : (() => {
                        const rawAmt = parseFloat(amountReceived) || 0;
                        // PDV terminals always charge exact total — never need manual Bs entry
                        if (paymentMethod === 'PDV_SHANKLISH' || paymentMethod === 'PDV_SUPERFERRO') {
                            return { paymentMethod, amountPaid: finalTotal };
                        }
                        // MOVIL_NG: only do Bs→USD if rawAmt clearly looks like Bs (≥ 10× USD total)
                        // Protects against cashier entering USD amount in the Bs field
                        if (paymentMethod === 'MOVIL_NG') {
                            if (exchangeRate && rawAmt >= finalTotal * 10) {
                                const usdAmt = rawAmt / exchangeRate;
                                return { payments: [{ method: paymentMethod, amountUSD: usdAmt, amountBS: rawAmt, exchangeRate }], amountPaid: usdAmt };
                            }
                            return { paymentMethod, amountPaid: finalTotal };
                        }
                        // CASH_BS: standard Bs→USD conversion with actual bills received
                        if (isBsPayMethod && exchangeRate && rawAmt > 0) {
                            const usdAmt = rawAmt / exchangeRate;
                            return { payments: [{ method: paymentMethod, amountUSD: usdAmt, amountBS: rawAmt, exchangeRate }], amountPaid: usdAmt };
                        }
                        return { paymentMethod, amountPaid: rawAmt || finalTotal };
                    })()),
                discountType,
                discountPercent: discountType === 'CORTESIA_PERCENT' ? cortesiaPercentNum : undefined,
                authorizedById: authorizedManager?.id,
                notes: `Dirección: ${customerAddress}`
            });

            if (result.success && result.data) {
                const cfg = getPOSConfig();
                if (cfg.printComandaOnDelivery) {
                    printKitchenCommand({
                        orderNumber: result.data.orderNumber, orderType: 'DELIVERY',
                        customerName: `${customerName} (${customerPhone})`,
                        items: cart.map(i => ({ name: i.name, quantity: i.quantity, modifiers: i.modifiers.map(m => m.name), notes: i.notes })),
                        createdAt: new Date(), address: customerAddress
                    });
                }
                const receiptData = {
                    orderNumber: result.data.orderNumber,
                    orderType: 'DELIVERY' as const,
                    date: new Date(),
                    cashierName: 'Delivery',
                    customerName: customerName || undefined,
                    customerPhone: customerPhone || undefined,
                    customerAddress: customerAddress || undefined,
                    items: cart.map(i => ({
                        name: i.name,
                        quantity: i.quantity,
                        unitPrice: i.unitPrice,
                        total: i.lineTotal,
                        modifiers: i.modifiers.map(m => m.name)
                    })),
                    subtotal: cartSubtotal,
                    discount: (() => {
                        if (discountType === 'DIVISAS_33' && isPagoDivisas) {
                            const base = isMixedMode ? (divisasUsdAmount ?? cartSubtotal) : cartSubtotal;
                            return base / 3 + (DELIVERY_FEE_NORMAL - DELIVERY_FEE_DIVISAS);
                        }
                        if (discountType === 'CORTESIA_100') return cartSubtotal + DELIVERY_FEE_NORMAL;
                        if (discountType === 'CORTESIA_PERCENT') return (cartSubtotal * cortesiaPercentNum / 100);
                        return 0;
                    })(),
                    hideDiscount: discountType === 'DIVISAS_33',
                    discountReason: (() => {
                        if (discountType === 'CORTESIA_100') return 'Cortesía Autorizada (100%)';
                        if (discountType === 'CORTESIA_PERCENT') return `Cortesía Autorizada (${cortesiaPercentNum}%)`;
                        return undefined;
                    })(),
                    deliveryFee: discountType === 'CORTESIA_100' ? 0 : deliveryFee,
                    total: finalTotal
                };
                if (cfg.printReceiptOnDelivery) {
                    printReceipt(receiptData);
                }
                setCart([]); setCustomerName(''); setCustomerPhone(''); setCustomerAddress('');
                setPaymentMethod('PDV_SHANKLISH'); setAmountReceived('');
                setMixedPayments([]); setMixedPaymentsComplete(false); setIsMixedMode(false);
                setDiscountType('NONE'); setAuthorizedManager(null);
            } else toast.error(result.message ?? 'Error al procesar el pedido');
        } catch (e) { console.error(e); toast.error('Error al procesar el pedido'); } finally { setIsProcessing(false); }
    };

    const handleDiscountSelect = (t: string) => {
        if (t === 'CORTESIA_100') { setPinInput(''); setPinError(''); setCortesiaPercent('100'); setShowPinModal(true); }
        else { setDiscountType(t as any); setAuthorizedManager(null); }
    };
    const handlePinSubmit = async () => {
        const r = await validateManagerPinAction(pinInput);
        if (r.success && r.data) {
            setAuthorizedManager({ id: r.data.managerId, name: r.data.managerName });
            const pct = parseFloat(cortesiaPercent);
            setDiscountType(pct >= 100 ? 'CORTESIA_100' : 'CORTESIA_PERCENT');
            setShowPinModal(false);
        } else setPinError('PIN Inválido');
    };
    const handlePinKey = (k: string) => { if (k === 'clear') setPinInput(''); else if (k === 'back') setPinInput(p => p.slice(0, -1)); else setPinInput(p => p + k); };

    if (isLoading) return (
        <div className="flex min-h-screen items-center justify-center bg-capsula-ivory">
            <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-capsula-navy" strokeWidth={1.5} />
                <div className="text-[14px] font-medium text-capsula-ink">Cargando Delivery…</div>
            </div>
        </div>
    );

    return (
        <div className={cn(
            posFullscreen ? 'min-h-screen' : 'flex-1 -m-4 md:-m-6 h-[calc(100vh-4rem)]',
            'flex animate-in flex-col bg-capsula-ivory pb-16 font-sans text-capsula-ink duration-500 lg:pb-0',
        )}>
            <div className={cn(
                'flex h-16 items-center justify-between border-b border-capsula-line bg-capsula-ivory-surface px-3 md:h-24 md:px-6',
                posFullscreen ? 'fixed top-0 z-30 w-full' : 'relative z-[31] w-full',
            )}>
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-capsula-navy/20 bg-capsula-navy-soft md:h-14 md:w-14">
                        <Bike className="h-5 w-5 text-capsula-navy md:h-7 md:w-7" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="font-heading text-[20px] leading-none tracking-[-0.01em] text-capsula-navy-deep md:text-[28px]">
                            Shanklish <span className="text-capsula-coral">Delivery</span>
                        </h1>
                        <p className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-capsula-navy" />
                            Sistema de despacho táctil CÁPSULA
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-1.5">
                        <CurrencyCalculator totalUsd={finalTotal} hasServiceFee={false} onRateUpdated={setExchangeRate} />
                    </div>
                    <Button
                        variant={showWhatsAppParser ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setShowWhatsAppParser(!showWhatsAppParser)}
                    >
                        <MessageCircle className="h-4 w-4" strokeWidth={1.5} /> WhatsApp
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTipModal(true)}
                    >
                        <Coins className="h-4 w-4" strokeWidth={1.5} /> Propina
                    </Button>
                    <div className="rounded-full border border-capsula-line bg-capsula-ivory px-3 py-1.5 font-mono text-[11px] tabular-nums text-capsula-ink-soft">
                        {new Date().toLocaleDateString('es-VE')}
                    </div>
                </div>
            </div>

            <div className={cn(
                'flex overflow-hidden',
                posFullscreen ? 'h-screen pt-16 md:pt-24' : 'min-h-0 flex-1',
            )}>
                {/* ══════════════════════════════════════════════════════
                    PANEL IZQUIERDO — Datos del cliente + Menú
                    ══════════════════════════════════════════════════════ */}
                <div className={cn(
                    'flex-1 flex-col overflow-hidden bg-capsula-ivory lg:flex',
                    mobileView === 'menu' ? 'flex' : 'hidden',
                )}>
                    {/* ── Barra de datos del cliente ───────────────────── */}
                    <div className="shrink-0 border-b border-capsula-navy/10 bg-capsula-navy-soft/50 px-4 py-3">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-navy">
                                <Package className="h-3 w-3" strokeWidth={1.5} />
                                Datos del cliente
                            </span>
                            {(customerName || customerPhone || customerAddress) && (
                                <button
                                    onClick={() => { setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); }}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
                                >
                                    Limpiar <X className="h-3 w-3" strokeWidth={1.5} />
                                </button>
                            )}
                        </div>
                        <div className="mb-2 grid grid-cols-2 gap-2">
                            <div className="relative">
                                <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Nombre del cliente"
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface py-2 pl-8 pr-3 text-[13px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                                />
                            </div>
                            <div className="relative">
                                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    placeholder="Teléfono"
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface py-2 pl-8 pr-3 text-[13px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                                />
                            </div>
                        </div>
                        <div className="relative">
                            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                            <input
                                type="text"
                                value={customerAddress}
                                onChange={e => setCustomerAddress(e.target.value)}
                                placeholder="Dirección exacta de entrega…"
                                className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface py-2 pl-8 pr-3 text-[13px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                            />
                        </div>
                    </div>

                    {/* ── Buscador ─────────────────────────────────────── */}
                    <div className="shrink-0 border-b border-capsula-line bg-capsula-ivory px-4 py-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Buscar producto por nombre o SKU…"
                                className="w-full rounded-full border border-capsula-line bg-capsula-ivory-surface py-2.5 pl-11 pr-11 text-[14px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                            />
                            {productSearch && (
                                <button
                                    onClick={() => setProductSearch('')}
                                    className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                                >
                                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Categories */}
                    {!productSearch && (
                        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-capsula-line bg-capsula-ivory px-4 py-3">
                            {categories.map((cat: any) => {
                                const CategoryIcon = getCategoryIcon(cat.name);
                                const active = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                                            active
                                                ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
                                                : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-line-strong hover:text-capsula-ink',
                                        )}
                                    >
                                        <CategoryIcon className="h-3.5 w-3.5" strokeWidth={1.5} /> {cat.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6">
                        {productSearch && (
                            <p className="mb-4 text-[11px] uppercase tracking-[0.08em] text-capsula-ink-muted">
                                {filteredMenuItems.length} productos coinciden con tu búsqueda
                            </p>
                        )}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 tablet-land:grid-cols-4 xl:grid-cols-4">
                            {filteredMenuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToCart(item)}
                                    className="group flex h-32 flex-col justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 text-left shadow-cap-soft transition-all hover:-translate-y-px hover:border-capsula-navy-deep/40 hover:shadow-cap-raised md:h-40"
                                >
                                    <div className="text-[13px] font-medium leading-tight text-capsula-ink transition-colors group-hover:text-capsula-navy-deep md:text-[14px]">
                                        {item.name}
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div className="font-mono text-[18px] font-semibold text-capsula-navy-deep md:text-[20px]">
                                            <PriceDisplay usd={item.price} rate={exchangeRate} size="lg" showBs={false} />
                                        </div>
                                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-capsula-navy-soft text-capsula-navy-deep opacity-100 transition-all lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                                            <Plus className="h-4 w-4" strokeWidth={2} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {filteredMenuItems.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-16 text-capsula-ink-muted">
                                    <Search className="mb-3 h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
                                    <p className="text-[13px] font-medium">Sin resultados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════
                    PANEL DERECHO — Carrito + Cobro
                    ══════════════════════════════════════════════════════ */}
                <div className={cn(
                    'z-20 w-full flex-col border-l border-capsula-line bg-capsula-ivory-surface lg:flex lg:w-[420px] xl:w-[480px]',
                    mobileView === 'order' ? 'flex' : 'hidden',
                )}>
                    {/* ── Encabezado del carrito ────────────────────────── */}
                    <div className="flex shrink-0 items-center justify-between border-b border-capsula-line bg-capsula-ivory px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-capsula-ink">
                                <ShoppingBag className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
                                Pedido
                            </span>
                            {cart.length > 0 && (
                                <span className="rounded-full bg-capsula-navy-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-capsula-navy-deep">
                                    {cart.length} ítem{cart.length > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        {cart.length > 0 && (
                            <button
                                onClick={() => setCart([])}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
                            >
                                <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Vaciar
                            </button>
                        )}
                    </div>

                    {/* ── Resumen cliente ── */}
                    {(customerName || customerPhone || customerAddress) && (
                        <div className="shrink-0 border-b border-capsula-navy/10 bg-capsula-navy-soft/40 px-4 py-2">
                            <div className="truncate text-[11px] font-medium leading-snug text-capsula-navy-deep">
                                {[customerName, customerPhone, customerAddress].filter(Boolean).join(' · ')}
                            </div>
                        </div>
                    )}

                    {/* ── Lista del carrito ── */}
                    <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto bg-capsula-ivory p-3">
                        {cart.length === 0 && (
                            <div className="flex h-full flex-col items-center justify-center py-10 text-capsula-ink-muted">
                                <ShoppingBag className="mb-3 h-10 w-10 text-capsula-ink-faint" strokeWidth={1.5} />
                                <p className="text-[12px] font-medium uppercase tracking-[0.12em]">Carrito vacío</p>
                            </div>
                        )}
                        {cart.map((item, i) => (
                            <div key={i} className="flex items-start justify-between gap-2 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-1.5 text-[13px] font-medium text-capsula-ink">
                                        <span className="shrink-0 font-mono text-capsula-navy-deep">×{item.quantity}</span>
                                        <span className="truncate">{item.name}</span>
                                    </div>
                                    {item.modifiers.length > 0 && (
                                        <div className="mt-0.5 truncate pl-5 text-[10.5px] text-capsula-ink-muted">
                                            {item.modifiers.map(m => m.name).join(' · ')}
                                        </div>
                                    )}
                                    {item.notes && (
                                        <div className="mt-0.5 flex items-center gap-1 pl-5 text-[10.5px] italic text-capsula-navy">
                                            <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
                                            {item.notes}
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="font-mono text-[13px] font-semibold text-capsula-ink">${item.lineTotal.toFixed(2)}</span>
                                    <button
                                        onClick={() => removeFromCart(i)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                    >
                                        <X className="h-3 w-3" strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Sección de cobro ── */}
                    <div
                        className="shrink-0 space-y-3 overflow-y-auto border-t border-capsula-line bg-capsula-ivory-alt p-4"
                        style={{ maxHeight: '62%' }}
                    >
                        {/* Totales compactos */}
                        <div className="space-y-1.5 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-4 py-3">
                            <div className="flex items-baseline justify-between text-[12px]">
                                <span className="text-capsula-ink-muted">Subtotal</span>
                                <span className="font-mono text-capsula-ink">
                                    <PriceDisplay usd={cartSubtotal} rate={exchangeRate} size="sm" showBs={false} />
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[12px]">
                                <span className="inline-flex items-center gap-1.5 text-capsula-navy">
                                    <Bike className="h-3 w-3" strokeWidth={1.5} /> Delivery
                                </span>
                                <span className="font-mono text-capsula-navy">+${deliveryFee.toFixed(2)}</span>
                            </div>
                            {discountType === 'DIVISAS_33' && isPagoDivisas && (
                                <div className="flex items-center justify-between rounded bg-capsula-navy-soft px-2 py-1 text-[12px]">
                                    <span className="text-capsula-navy-deep">Dto. divisas</span>
                                    <span className="font-mono text-capsula-navy-deep">
                                        -${((divisasUsdAmount ?? cartSubtotal) / 3 + DELIVERY_FEE_NORMAL - DELIVERY_FEE_DIVISAS).toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-baseline justify-between border-t border-capsula-line pt-2">
                                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">Total</span>
                                <div className="font-mono text-[22px] font-semibold text-capsula-navy-deep">
                                    <PriceDisplay usd={finalTotal} rate={exchangeRate} size="lg" showBs={false} />
                                </div>
                            </div>
                            <div className="pt-1">
                                <CurrencyCalculator
                                    totalUsd={finalTotal}
                                    hasServiceFee={false}
                                    onRateUpdated={setExchangeRate}
                                    inline
                                    startCollapsed
                                />
                            </div>
                        </div>

                        {/* Descuentos + Método + Cobro */}
                        <div className="space-y-3">
                            {/* Descuentos */}
                            <div className="grid grid-cols-3 gap-1.5">
                                <button
                                    onClick={() => handleDiscountSelect('NONE')}
                                    className={cn(
                                        'rounded-full py-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors',
                                        discountType === 'NONE'
                                            ? 'border border-capsula-navy-deep bg-capsula-navy-soft text-capsula-navy-deep'
                                            : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:text-capsula-ink',
                                    )}
                                >
                                    Normal
                                </button>
                                <button
                                    onClick={() => handleDiscountSelect('DIVISAS_33')}
                                    className={cn(
                                        'rounded-full py-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors',
                                        discountType === 'DIVISAS_33'
                                            ? 'bg-capsula-navy-deep text-capsula-ivory'
                                            : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-navy hover:bg-capsula-navy-soft',
                                    )}
                                >
                                    Divisa −33%
                                </button>
                                <button
                                    onClick={() => handleDiscountSelect('CORTESIA_100')}
                                    className={cn(
                                        'inline-flex items-center justify-center gap-1 rounded-full py-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors',
                                        (discountType === 'CORTESIA_100' || discountType === 'CORTESIA_PERCENT')
                                            ? 'bg-capsula-coral text-white'
                                            : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-coral hover:bg-capsula-coral-subtle',
                                    )}
                                >
                                    <Gift className="h-3 w-3" strokeWidth={1.5} />
                                    {(discountType === 'CORTESIA_100' || discountType === 'CORTESIA_PERCENT')
                                        ? (discountType === 'CORTESIA_PERCENT' ? `${cortesiaPercentNum}%` : '100%')
                                        : 'Cortesía'}
                                </button>
                            </div>
                            {(discountType === 'CORTESIA_100' || discountType === 'CORTESIA_PERCENT') && authorizedManager && (
                                <div className="text-center text-[10.5px] font-medium text-capsula-coral">
                                    Auth: {authorizedManager.name}
                                </div>
                            )}

                            {/* Modo de pago */}
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => { setIsMixedMode(false); setMixedPayments([]); }}
                                    className={cn(
                                        'rounded-full py-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors',
                                        !isMixedMode
                                            ? 'bg-capsula-navy-deep text-capsula-ivory'
                                            : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:text-capsula-ink',
                                    )}
                                >
                                    Pago único
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsMixedMode(true); setAmountReceived(''); }}
                                    className={cn(
                                        'inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors',
                                        isMixedMode
                                            ? 'bg-capsula-navy-deep text-capsula-ivory'
                                            : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:text-capsula-ink',
                                    )}
                                >
                                    <Split className="h-3 w-3" strokeWidth={1.5} /> Pago mixto
                                </button>
                            </div>

                            {!isMixedMode ? (
                                /* ── Pago Único ── */
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {([
                                            { id: 'CASH_USD',       label: 'Cash $',      icon: Banknote },
                                            { id: 'CASH_EUR',       label: 'Cash €',      icon: Euro },
                                            { id: 'ZELLE',          label: 'Zelle',       icon: Zap },
                                            { id: 'PDV_SHANKLISH',  label: 'PDV Shan.',   icon: CreditCard },
                                            { id: 'PDV_SUPERFERRO', label: 'PDV Super.',  icon: CreditCard },
                                            { id: 'MOVIL_NG',       label: 'Móvil NG',    icon: Smartphone },
                                            { id: 'CASH_BS',        label: 'Efectivo Bs', icon: Banknote },
                                        ] as const).map(m => {
                                            const MIcon = m.icon;
                                            const active = paymentMethod === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => { setPaymentMethod(m.id); setAmountReceived(''); }}
                                                    className={cn(
                                                        'inline-flex items-center justify-center gap-1 rounded-[var(--radius)] py-2 text-[11px] font-medium transition-colors',
                                                        active
                                                            ? 'bg-capsula-navy-deep text-capsula-ivory'
                                                            : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:text-capsula-ink',
                                                    )}
                                                >
                                                    <MIcon className="h-3 w-3" strokeWidth={1.5} /> {m.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-1">
                                        <input
                                            type="number"
                                            value={amountReceived}
                                            onChange={e => setAmountReceived(e.target.value)}
                                            placeholder={isBsPayMethod && exchangeRate ? `Bs ${(finalTotal * exchangeRate).toFixed(0)}` : 'Monto recibido…'}
                                            className="flex-1 rounded border-none bg-transparent px-3 py-2 font-mono text-[16px] font-semibold text-capsula-ink outline-none placeholder:text-capsula-ink-faint"
                                        />
                                        <div className="pr-3 text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                            {isBsPayMethod ? 'Bs' : 'USD'}
                                        </div>
                                    </div>
                                    {isBsPayMethod && exchangeRate && (parseFloat(amountReceived) || 0) > 0 && (
                                        <div className="flex justify-between px-1 text-[11px]">
                                            <span className="text-capsula-ink-muted">Equiv. USD</span>
                                            <span className="font-mono font-medium text-[#2F6B4E]">
                                                ${((parseFloat(amountReceived) || 0) / exchangeRate).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    {paymentMethod === 'CASH_USD' && (parseFloat(amountReceived) || 0) > finalTotal + 0.001 && (
                                        <div className="flex justify-between px-1 text-[13px]">
                                            <span className="font-medium text-[#946A1C]">Vuelto</span>
                                            <span className="font-mono font-semibold text-[#946A1C]">
                                                ${Math.max(0, (parseFloat(amountReceived) || 0) - finalTotal).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Pago Mixto ── */
                                <div className="space-y-2">
                                    <MixedPaymentSelector
                                        key={`delivery-mixed-${isMixedMode}`}
                                        totalAmount={finalTotal}
                                        exchangeRate={exchangeRate}
                                        onChange={(lines, _paid, complete) => {
                                            setMixedPayments(lines);
                                            setMixedPaymentsComplete(complete);
                                        }}
                                        disabled={isProcessing}
                                    />
                                    {discountType === 'DIVISAS_33' && (divisasUsdAmount ?? 0) > 0 && (
                                        <div className="space-y-0.5 rounded-[var(--radius)] border border-capsula-navy/20 bg-capsula-navy-soft px-3 py-2 text-[12px] text-capsula-navy-deep">
                                            <div className="flex justify-between">
                                                <span>Divisas sobre ${(divisasUsdAmount ?? 0).toFixed(2)} USD</span>
                                                <span className="font-mono font-semibold">-${((divisasUsdAmount ?? 0) / 3).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between font-semibold">
                                                <span>Total a cobrar</span>
                                                <span className="font-mono">${finalTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button
                                variant="primary"
                                size="xl"
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isProcessing}
                                isLoading={isProcessing}
                                className="w-full"
                            >
                                {isProcessing ? 'PROCESANDO…' : 'CONFIRMAR ORDEN'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* WhatsApp Parser Modal */}
            {/* ── MODAL: WhatsApp ───────────────────────── */}
            {showWhatsAppParser && (
                <div className="fixed inset-0 z-[60] flex animate-in fade-in items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm duration-200">
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
                        <div className="flex shrink-0 items-center justify-between border-b border-capsula-line p-5">
                            <h3 className="inline-flex items-center gap-2 font-heading text-[20px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                <MessageCircle className="h-5 w-5 text-capsula-navy" strokeWidth={1.5} />
                                Pegar chat de WhatsApp
                            </h3>
                            <button
                                onClick={() => setShowWhatsAppParser(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                            >
                                <X className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                        </div>
                        <div className="no-scrollbar flex-1 overflow-y-auto p-5">
                            <WhatsAppOrderParser
                                onOrderReady={(items, name, phone, address) => {
                                    setCart(items);
                                    setCustomerName(name);
                                    setCustomerPhone(phone);
                                    setCustomerAddress(address);
                                    setShowWhatsAppParser(false);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: Modificadores ───────────────────────── */}
            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 z-[60] flex animate-in fade-in zoom-in items-end justify-center bg-capsula-navy-deep/40 p-0 backdrop-blur-sm duration-200 sm:items-center sm:p-4">
                    <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)] sm:max-h-[90vh] sm:rounded-[var(--radius)]">
                        <div className="flex items-start justify-between border-b border-capsula-line p-5">
                            <div>
                                <h3 className="font-heading text-[22px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                    {selectedItemForModifier.name}
                                </h3>
                                <div className="mt-1 font-mono text-[20px] font-semibold text-capsula-navy-deep">
                                    <PriceDisplay usd={selectedItemForModifier.price} rate={exchangeRate} size="lg" showBs={false} />
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModifierModal(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                            >
                                <X className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
                            {selectedItemForModifier.modifierGroups?.map((groupRel) => {
                                const group = groupRel.modifierGroup;
                                const totalSelector = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                                const isValid = !group.isRequired || totalSelector >= group.minSelections;
                                return (
                                    <div
                                        key={group.id}
                                        className={cn(
                                            'rounded-[var(--radius)] border p-4',
                                            isValid
                                                ? 'border-capsula-line bg-capsula-ivory-surface'
                                                : 'border-capsula-coral/40 bg-capsula-coral-subtle/30',
                                        )}
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="text-[12px] font-medium uppercase tracking-[0.08em] text-capsula-ink-soft">
                                                {group.name}
                                            </h4>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                                                    isValid
                                                        ? 'bg-capsula-navy-soft text-capsula-navy-deep'
                                                        : 'bg-capsula-coral text-white',
                                                )}
                                            >
                                                {totalSelector}/{group.maxSelections}{group.isRequired ? ' · Requerido' : ''}
                                            </span>
                                        </div>
                                        <div className="grid gap-2">
                                            {group.modifiers.map(mod => {
                                                const existing = currentModifiers.find(m => m.id === mod.id && m.groupId === group.id);
                                                const qty = existing ? existing.quantity : 0;
                                                const isMax = group.maxSelections > 1 && totalSelector >= group.maxSelections;
                                                const isRadio = group.maxSelections === 1;
                                                const selected = qty > 0;
                                                return (
                                                    <div
                                                        key={mod.id}
                                                        className={cn(
                                                            'flex items-center justify-between rounded-[var(--radius)] border px-4 py-3 transition-colors',
                                                            selected
                                                                ? 'border-capsula-navy-deep/40 bg-capsula-navy-soft'
                                                                : 'border-capsula-line bg-capsula-ivory',
                                                        )}
                                                    >
                                                        <div className="text-[13px] font-medium text-capsula-ink">{mod.name}</div>
                                                        {isRadio ? (
                                                            <button
                                                                onClick={() => updateModifierQuantity(group, mod, 1)}
                                                                className={cn(
                                                                    'inline-flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors',
                                                                    selected
                                                                        ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
                                                                        : 'border-capsula-line text-transparent',
                                                                )}
                                                            >
                                                                <Check className="h-3 w-3" strokeWidth={2} />
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-1 rounded-full border border-capsula-line bg-capsula-ivory-surface p-1">
                                                                <button
                                                                    onClick={() => updateModifierQuantity(group, mod, -1)}
                                                                    disabled={qty === 0}
                                                                    className={cn(
                                                                        'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                                                                        qty === 0
                                                                            ? 'text-capsula-ink-faint'
                                                                            : 'text-capsula-ink hover:bg-capsula-ivory-alt',
                                                                    )}
                                                                >
                                                                    <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                                                                </button>
                                                                <span className="inline-flex w-6 items-center justify-center font-mono text-[13px] font-semibold text-capsula-navy-deep">
                                                                    {qty}
                                                                </span>
                                                                <button
                                                                    onClick={() => updateModifierQuantity(group, mod, 1)}
                                                                    disabled={isMax}
                                                                    className={cn(
                                                                        'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                                                                        isMax
                                                                            ? 'text-capsula-ink-faint'
                                                                            : 'text-capsula-navy-deep hover:bg-capsula-navy-soft',
                                                                    )}
                                                                >
                                                                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4">
                                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Instrucciones especiales (opcional)
                                </label>
                                <textarea
                                    value={itemNotes}
                                    onChange={e => setItemNotes(e.target.value)}
                                    placeholder="Escribe aquí si el cliente tiene alguna petición…"
                                    className="h-20 w-full resize-none rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-3 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-4">
                                <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-capsula-ink">Cantidad</span>
                                <div className="flex items-center gap-1 rounded-full border border-capsula-line bg-capsula-ivory-surface p-1">
                                    <button
                                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                                    >
                                        <Minus className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                    <span className="inline-flex w-12 items-center justify-center font-mono text-[20px] font-semibold text-capsula-navy-deep">
                                        {itemQuantity}
                                    </span>
                                    <button
                                        onClick={() => setItemQuantity(itemQuantity + 1)}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-capsula-navy-deep text-capsula-ivory transition-colors hover:bg-capsula-navy"
                                    >
                                        <Plus className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 border-t border-capsula-line p-4">
                            <Button variant="ghost" onClick={() => setShowModifierModal(false)} className="flex-1">
                                CANCELAR
                            </Button>
                            <Button
                                variant="primary"
                                onClick={confirmAddToCart}
                                disabled={selectedItemForModifier?.modifierGroups.some(g => !isGroupValid(g.modifierGroup))}
                                className="flex-[2]"
                            >
                                AGREGAR AL CARRITO
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: PIN de gerencia (cortesía) ───────────────────────── */}
            {showPinModal && (
                <div className="fixed inset-0 z-[60] flex animate-in fade-in items-end justify-center bg-capsula-navy-deep/40 p-0 backdrop-blur-sm duration-200 sm:items-center sm:p-4">
                    <div className="w-full max-w-md rounded-t-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)] sm:rounded-[var(--radius)] md:p-8">
                        <div className="mb-6 text-center">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle">
                                <Gift className="h-6 w-6 text-capsula-coral" strokeWidth={1.5} />
                            </div>
                            <h3 className="font-heading text-[22px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                Autorizar cortesía
                            </h3>
                            <p className="mt-1 text-[12px] text-capsula-ink-muted">
                                Este descuento requiere validación de gerencia
                            </p>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="mb-2 block text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Selecciona el % de descuento
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['25', '50', '75', '100'].map(v => {
                                        const active = cortesiaPercent === v;
                                        return (
                                            <button
                                                key={v}
                                                onClick={() => setCortesiaPercent(v)}
                                                className={cn(
                                                    'rounded-[var(--radius)] py-2.5 text-[13px] font-medium transition-colors',
                                                    active
                                                        ? 'bg-capsula-coral text-white'
                                                        : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-coral/40 hover:text-capsula-coral',
                                                )}
                                            >
                                                {v}%
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="relative mt-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={cortesiaPercent}
                                        onChange={e => setCortesiaPercent(e.target.value)}
                                        className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory py-3 pr-10 text-center font-mono text-[18px] font-semibold text-capsula-ink outline-none focus:border-capsula-coral"
                                        placeholder="Valor %"
                                    />
                                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono font-semibold text-capsula-coral">%</span>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
                                    Introduce tu PIN de seguridad
                                </label>
                                <div className="mb-3 flex h-20 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory text-[28px] font-semibold tracking-[1em] text-capsula-navy-deep">
                                    {pinInput.length > 0
                                        ? pinInput.replace(/./g, '•')
                                        : <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-capsula-ink-faint">MODO PIN…</span>}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => handlePinKey(n.toString())}
                                            className="h-14 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface font-mono text-[20px] font-semibold text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => handlePinKey('clear')}
                                        className="h-14 rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle text-[13px] font-semibold uppercase tracking-[0.08em] text-capsula-coral transition-colors hover:bg-capsula-coral hover:text-white"
                                    >
                                        CLR
                                    </button>
                                    <button
                                        onClick={() => handlePinKey('0')}
                                        className="h-14 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface font-mono text-[20px] font-semibold text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                                    >
                                        0
                                    </button>
                                    <button
                                        onClick={() => handlePinKey('back')}
                                        className="inline-flex h-14 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                                        aria-label="Borrar"
                                    >
                                        <Delete className="h-5 w-5" strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>

                            {pinError && (
                                <div className="rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle px-3 py-2 text-center text-[12px] font-medium text-capsula-coral">
                                    {pinError}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => { setShowPinModal(false); setPinInput(''); }}
                                >
                                    Cerrar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handlePinSubmit}
                                    disabled={!pinInput}
                                >
                                    Validar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: Propina colectiva ───────────────────────── */}
            {showTipModal && (
                <div className="fixed inset-0 z-[60] flex animate-in fade-in items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm duration-200">
                    <div className="w-full max-w-sm space-y-4 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
                        <div className="flex items-center justify-between">
                            <h3 className="inline-flex items-center gap-2 font-heading text-[20px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                <Coins className="h-5 w-5 text-capsula-coral" strokeWidth={1.5} />
                                Propina colectiva
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowTipModal(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                            >
                                <X className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        <p className="text-[12px] text-capsula-ink-muted">
                            Propina recibida después del cobro. Indica el cliente para trazabilidad.
                        </p>

                        <input
                            type="text"
                            value={tipClientRef}
                            onChange={e => setTipClientRef(e.target.value)}
                            placeholder="Nombre del cliente (opcional)"
                            className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[13px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
                        />

                        <div className="grid grid-cols-3 gap-1.5">
                            {([
                                { id: 'CASH_USD',       label: 'Cash $',      icon: Banknote },
                                { id: 'CASH_EUR',       label: 'Cash €',      icon: Euro },
                                { id: 'ZELLE',          label: 'Zelle',       icon: Zap },
                                { id: 'PDV_SHANKLISH',  label: 'PDV Shan.',   icon: CreditCard },
                                { id: 'PDV_SUPERFERRO', label: 'PDV Super.',  icon: CreditCard },
                                { id: 'MOVIL_NG',       label: 'Móvil NG',    icon: Smartphone },
                                { id: 'CASH_BS',        label: 'Efectivo Bs', icon: Banknote },
                            ] as const).map(m => {
                                const MIcon = m.icon;
                                const active = tipMethod === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setTipMethod(m.id)}
                                        className={cn(
                                            'inline-flex items-center justify-center gap-1 rounded-[var(--radius)] py-2 text-[11px] font-medium transition-colors',
                                            active
                                                ? 'bg-capsula-coral text-white'
                                                : 'border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-coral/40 hover:text-capsula-coral',
                                        )}
                                    >
                                        <MIcon className="h-3 w-3" strokeWidth={1.5} /> {m.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-1">
                            <span className="pl-3 font-mono text-[13px] font-semibold text-capsula-ink-muted">
                                {['CASH_BS', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG'].includes(tipMethod) ? 'Bs' : '$'}
                            </span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={tipAmount}
                                onChange={e => setTipAmount(e.target.value)}
                                placeholder="0.00"
                                className="flex-1 border-none bg-transparent px-3 py-2 font-mono text-[20px] font-semibold text-capsula-ink outline-none placeholder:text-capsula-ink-faint"
                                autoFocus
                            />
                        </div>

                        {['CASH_BS', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG'].includes(tipMethod) && exchangeRate && (parseFloat(tipAmount) || 0) > 0 && (
                            <div className="flex justify-between px-1 text-[11px]">
                                <span className="text-capsula-ink-muted">Equivalente USD</span>
                                <span className="font-mono font-semibold text-[#2F6B4E]">
                                    ${((parseFloat(tipAmount) || 0) / exchangeRate).toFixed(2)}
                                </span>
                            </div>
                        )}

                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleRecordTip}
                            disabled={isTipProcessing || !(parseFloat(tipAmount) > 0)}
                            isLoading={isTipProcessing}
                            className="w-full"
                        >
                            {isTipProcessing ? 'Registrando…' : 'Registrar propina'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Navegación móvil delivery */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-capsula-line bg-capsula-ivory-surface lg:hidden">
                {[
                    { id: 'menu' as const, label: 'Menú', icon: UtensilsCrossed },
                    { id: 'order' as const, label: 'Orden', icon: ShoppingBag, badge: cart.length },
                ].map(tab => {
                    const TabIcon = tab.icon;
                    const active = mobileView === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setMobileView(tab.id)}
                            className={cn(
                                'relative flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors',
                                active
                                    ? 'bg-capsula-navy-soft text-capsula-navy-deep'
                                    : 'text-capsula-ink-muted',
                            )}
                        >
                            {active && <div className="absolute left-0 right-0 top-0 h-0.5 bg-capsula-navy-deep" />}
                            <TabIcon className="h-5 w-5" strokeWidth={1.5} />
                            {tab.label}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className="absolute right-6 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-capsula-coral px-1 font-mono text-[9px] font-semibold text-white">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
