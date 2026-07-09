'use client';

import { useState, useEffect } from 'react';
import { Bike, MessageCircle, Plus as PlusIcon, User, Phone, MapPin, Search, X as XIcon, Lightbulb, ShoppingCart, MessageSquare, Gift, DollarSign, Euro, Zap, CreditCard, Smartphone, Banknote, CheckCircle2, Delete, Menu, ClipboardList, Clock, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { createSalesOrderAction, recordCollectiveTipAction, getMenuForPOSAction, validateManagerPinAction, type CartItem, type PaymentLine } from '@/app/actions/pos.actions';
import MixedPaymentSelector from '@/components/pos/MixedPaymentSelector';
import { PaymentConfirmationModal, type PaymentConfirmationLine } from '@/components/pos/PaymentConfirmationModal';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { printReceipt } from '@/lib/print-command';
import { useTenantBranding } from '@/lib/hooks/use-tenant-branding';
import { useTenantFeatureFlags } from '@/lib/hooks/use-feature-flags';
import { enqueueKitchenCommand, buildMenuItemCategoryMap, buildKitchenItems } from '@/lib/print-via-agent';
import { getPOSConfig } from '@/lib/pos-settings';
import { SinConToggle } from '@/components/pos/SinConToggle';
import ChildGroupSelector from '@/components/pos/ChildGroupSelector';
import { hasChildGroup, purgeChildSelections, childGroupsValid } from '@/lib/pos-child-group';
import { groupModifiersForSinCon, toggleStateFor, type IngredientToggle } from '@/lib/pos-modifier-grouping';
import { searchCustomersAction, type CustomerSummary } from '@/app/actions/customer.actions';
import toast from 'react-hot-toast';
import WhatsAppOrderParser from '@/components/whatsapp-order-parser';
import { PriceDisplay } from '@/components/pos/PriceDisplay';
import { CurrencyCalculator } from '@/components/pos/CurrencyCalculator';
import ComandasDelDiaModal from '@/components/pos/ComandasDelDiaModal';

const DELIVERY_FEE_NORMAL = 4.5;
const DELIVERY_FEE_DIVISAS = 3;


interface ModifierOption {
    id: string;
    name: string;
    priceAdjustment: number;
    isAvailable: boolean;
    /** Sub-grupo anidado (§82): se despliega al seleccionar esta opción. */
    childGroup?: ModifierGroup | null;
}

interface ModifierGroup {
    id: string;
    name: string;
    isActive?: boolean;
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
    const branding = useTenantBranding();
    // Feature flag `requirePaymentConfirmation`: cuando está activo, antes
    // de invocar createSalesOrderAction se muestra un modal con resumen.
    const featureFlags = useTenantFeatureFlags();
    const [paymentConfirmationPending, setPaymentConfirmationPending] = useState<{
        lines: PaymentConfirmationLine[];
        totalUSD: number;
        onConfirm: () => void;
    } | null>(null);
    const requestPaymentConfirmation = (
        lines: PaymentConfirmationLine[],
        totalUSD: number,
        onConfirm: () => void,
    ) => {
        if (!featureFlags.requirePaymentConfirmation) {
            onConfirm();
            return;
        }
        setPaymentConfirmationPending({ lines, totalUSD, onConfirm });
    };
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    // CRM: id de la ficha de cliente elegida del buscador. Se limpia si la
    // cajera edita nombre/teléfono a mano (para no vincular a otro cliente).
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    // Hora de entrega solicitada por el cliente. Formato 'HH:MM' (24h)
    // del input nativo type="time". Si queda vacío, la cocina lo trata
    // como "lo antes posible". Se persiste como DateTime en SalesOrder
    // (fecha = hoy) y se imprime en grande en la comanda.
    const [scheduledTime, setScheduledTime] = useState('');
    // Autocomplete de clientes recurrentes (Customer). El query es local
    // y dispara `searchCustomersAction` con debounce mínimo. Al seleccionar
    // un resultado se autollena nombre/teléfono/dirección.
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSummary[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
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
    // Promo "Delivery Gratis" — exonera SOLO el costo de envío ($4.50 / $3 en
    // divisas). Compatible con cualquier `discountType`. Default OFF: si no se
    // activa, la lógica de cálculo se comporta idéntico al previo.
    const [freeDelivery, setFreeDelivery] = useState(false);

    // PROPINA COLECTIVA
    const [showTipModal, setShowTipModal] = useState(false);
    // Modal de comandas del día (reimpresión)
    const [showComandasModal, setShowComandasModal] = useState(false);
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
                    getMenuForPOSAction({ channel: 'DELIVERY' }),
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
        // Auto-aplicar / quitar el descuento del 33% según el método de pago
        // (single mode). Regla de negocio: cash siempre tiene 33% off.
        // Sólo cambiamos cuando el discountType actual es NONE o DIVISAS_33;
        // si el cajero eligió CORTESIA, lo respetamos.
        if (isMixedMode) return; // mixed mode tiene su propia lógica
        if (discountType !== 'NONE' && discountType !== 'DIVISAS_33') return;
        if (isDivisasMethod(paymentMethod)) {
            if (discountType !== 'DIVISAS_33') setDiscountType('DIVISAS_33');
        } else {
            if (discountType === 'DIVISAS_33') setDiscountType('NONE');
        }
    }, [isMixedMode, paymentMethod, discountType]);

    // Debounce de búsqueda de clientes (300ms). Evita un fetch por
    // cada keystroke pero responde rápido al usuario.
    useEffect(() => {
        const q = customerSearch.trim();
        if (q.length < 2) {
            setCustomerSearchResults([]);
            return;
        }
        const handle = setTimeout(async () => {
            const res = await searchCustomersAction(q);
            if (res.success) setCustomerSearchResults(res.customers);
        }, 300);
        return () => clearTimeout(handle);
    }, [customerSearch]);

    function applyCustomer(c: CustomerSummary) {
        setCustomerName(c.fullName);
        setCustomerPhone(c.phone ?? '');
        setCustomerAddress(c.address ?? '');
        setSelectedCustomerId(c.id);
        setCustomerSearch('');
        setCustomerSearchResults([]);
        setShowCustomerDropdown(false);
    }

    const filteredMenuItems = productSearch.trim()
        ? categories.flatMap((c: any) => c.items as MenuItem[]).filter((i) =>
              i.name.toLowerCase().includes(productSearch.toLowerCase()) ||
              i.sku?.toLowerCase().includes(productSearch.toLowerCase())
          )
        : menuItems;

    const getCategoryIcon = (name: string) => {
        if (name.includes('Tabla') || name.includes('Combo')) return '🍱';
        if (name.includes('Queso')) return '🧀';
        if (name.includes('Platos')) return '🍛';
        // ... (resto igual)
        return '📦';
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
                    // purge §82: radio replace limpia el sub-grupo del anterior
                    setCurrentModifiers(purgeChildSelections([...others, {
                        groupId: group.id, groupName: group.name,
                        id: modifier.id, name: modifier.name,
                        priceAdjustment: modifier.priceAdjustment, quantity: 1
                    }], group));
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
        setCurrentModifiers(purgeChildSelections(newModifiers, group));
    };

    // Toggle SIN/CON/NEUTRAL agrupado por ingrediente (mutua exclusión).
    const setIngredientToggleState = (
        group: ModifierGroup,
        toggle: IngredientToggle,
        target: 'SIN' | 'CON' | 'NEUTRAL',
    ) => {
        const sinId = toggle.sin?.id;
        const conId = toggle.con?.id;
        let mods = currentModifiers.filter(m => {
            const isThisIngredient =
                m.groupId === group.id && ((sinId && m.id === sinId) || (conId && m.id === conId));
            return !isThisIngredient;
        });
        if (target === 'SIN' && toggle.sin) {
            mods.push({ groupId: group.id, groupName: group.name, id: toggle.sin.id, name: toggle.sin.name, priceAdjustment: toggle.sin.priceAdjustment, quantity: 1 });
        } else if (target === 'CON' && toggle.con) {
            mods.push({ groupId: group.id, groupName: group.name, id: toggle.con.id, name: toggle.con.name, priceAdjustment: toggle.con.priceAdjustment, quantity: 1 });
        }
        setCurrentModifiers(mods);
    };

    const isGroupValid = (group: ModifierGroup) => {
        if (!group.isRequired) return true;
        const count = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
        return count >= group.minSelections;
    };

    const confirmAddToCart = () => {
        if (!selectedItemForModifier) return;
        if (!selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup))) return;
        if (!childGroupsValid(currentModifiers, selectedItemForModifier.modifierGroups.map(g => g.modifierGroup))) return;

        const modTotal = currentModifiers.reduce((s, m) => s + (m.priceAdjustment * m.quantity), 0);
        const lineTotal = (selectedItemForModifier.price + modTotal) * itemQuantity;

        const explodedModifiers = currentModifiers.flatMap(m => Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment }));

        setCart([...cart, {
            menuItemId: selectedItemForModifier.id, name: selectedItemForModifier.name, quantity: itemQuantity, unitPrice: selectedItemForModifier.price,
            modifiers: explodedModifiers, notes: itemNotes || undefined, lineTotal
        }]);
        setShowModifierModal(false); setSelectedItemForModifier(null);
    };

    // Convierte 'HH:MM' (input nativo type=time) a un ISO string anclado a
    // HOY en la zona local del navegador. Si la hora ya pasó (ej. cajera
    // marcó 14:30 y son las 15:00), asumimos que es para MAÑANA — la
    // cocina necesita esa info para no priorizar mal.
    const scheduledTimeToISO = (hhmm: string): string | undefined => {
        if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
        const [h, m] = hhmm.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1);
        return d.toISOString();
    };

    const cartSubtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
    // Divisas methods: CASH, CASH_USD, CASH_EUR, ZELLE get 33.33% discount
    // Con el flag `exactCashSaleTip`: cash divisas redondea hacia ARRIBA (la venta
    // queda exacta en el servidor; la diferencia es propina). Sin flag: histórico.
    const roundToWhole = (amount: number, method: string): number => {
        if (featureFlags.exactCashSaleTip && (method === 'CASH_USD' || method === 'CASH_EUR' || method === 'ZELLE')) {
            return Math.ceil(amount);
        }
        return (method === 'CASH_USD' || method === 'ZELLE' || method === 'CASH_BS') ? Math.round(amount) : amount;
    };
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
    const deliveryFeeBase = discountType === 'DIVISAS_33' && isPagoDivisas ? DELIVERY_FEE_DIVISAS : DELIVERY_FEE_NORMAL;
    // Si freeDelivery está activo el fee efectivo es 0 (la promo lo waivea).
    const deliveryFee = freeDelivery ? 0 : deliveryFeeBase;
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
            const scheduledISO = scheduledTimeToISO(scheduledTime);
            const result = await createSalesOrderAction({
                orderType: 'DELIVERY',
                customerName: customerName || 'Delivery',
                customerPhone, customerAddress: customerAddress || 'N/A',
                customerId: selectedCustomerId ?? undefined,
                scheduledDeliveryTime: scheduledISO,
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
                freeDelivery,
                authorizedById: authorizedManager?.id,
                notes: `Dirección: ${customerAddress}`
            });

            if (result.success && result.data) {
                const cfg = getPOSConfig();
                // Comanda cocina/barra vía Print Agent (impresoras Ethernet
                // del local). Split por categoría: bebidas → barra, resto → cocina.
                const menuItemCategoryMap = buildMenuItemCategoryMap(categories);
                void enqueueKitchenCommand({
                    type: 'KITCHEN',
                    orderNumber: result.data.orderNumber,
                    dailyLabel: (result.data as { dailyLabel?: string | null }).dailyLabel ?? undefined,
                    orderType: 'DELIVERY',
                    orderTypeLabel: 'DELIVERY',
                    customerName: `${customerName} (${customerPhone})`,
                    customerAddress: customerAddress || null,
                    scheduledDeliveryTime: scheduledISO ?? null,
                    items: buildKitchenItems(cart, menuItemCategoryMap),
                    createdAt: new Date().toISOString(),
                });
                const receiptData = {
                    orderNumber: result.data.orderNumber,
                    dailyLabel: (result.data as { dailyLabel?: string | null }).dailyLabel ?? undefined,
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
                        // Sumar fee waiveado si la promo está activa (excepto cuando
                        // CORTESIA_100 ya descontó todo, o cuando NO había cargo previo)
                        const freeDeliveryDelta = freeDelivery && discountType !== 'CORTESIA_100'
                            ? (discountType === 'DIVISAS_33'
                                ? DELIVERY_FEE_DIVISAS
                                : discountType === 'CORTESIA_PERCENT'
                                    ? DELIVERY_FEE_NORMAL * (1 - cortesiaPercentNum / 100)
                                    : DELIVERY_FEE_NORMAL)
                            : 0;
                        if (discountType === 'DIVISAS_33' && isPagoDivisas) {
                            const base = isMixedMode ? (divisasUsdAmount ?? cartSubtotal) : cartSubtotal;
                            return base / 3 + (DELIVERY_FEE_NORMAL - DELIVERY_FEE_DIVISAS) + freeDeliveryDelta;
                        }
                        if (discountType === 'CORTESIA_100') return cartSubtotal + DELIVERY_FEE_NORMAL;
                        if (discountType === 'CORTESIA_PERCENT') return (cartSubtotal * cortesiaPercentNum / 100) + freeDeliveryDelta;
                        return 0 + freeDeliveryDelta;
                    })(),
                    hideDiscount: discountType === 'DIVISAS_33',
                    discountReason: (() => {
                        const base = discountType === 'CORTESIA_100' ? 'Cortesía Autorizada (100%)'
                            : discountType === 'CORTESIA_PERCENT' ? `Cortesía Autorizada (${cortesiaPercentNum}%)`
                            : undefined;
                        if (freeDelivery && discountType !== 'CORTESIA_100') {
                            return base ? `${base} + Delivery Gratis (Promo)` : 'Delivery Gratis (Promo)';
                        }
                        return base;
                    })(),
                    deliveryFee: (discountType === 'CORTESIA_100' || freeDelivery) ? 0 : deliveryFee,
                    total: finalTotal,
                    // Forma de pago en la nota de entrega (pedido de la cajera):
                    // método + punto de venta. Mixto → cada línea; simple → una.
                    payments: isMixedMode
                        ? (mixedPayments.length > 0
                            ? mixedPayments.map(p => ({ method: p.method, amountUSD: p.amountUSD, amountBS: p.amountBS }))
                            : [{ method: 'TRANSFER', amountUSD: finalTotal }])
                        : [{ method: paymentMethod, amountUSD: finalTotal }],
                };
                if (cfg.printReceiptOnDelivery) {
                    printReceipt({ ...receiptData, branding });
                }
                setCart([]); setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setSelectedCustomerId(null);
                setScheduledTime('');
                setPaymentMethod('PDV_SHANKLISH'); setAmountReceived('');
                setMixedPayments([]); setMixedPaymentsComplete(false); setIsMixedMode(false);
                setDiscountType('NONE'); setAuthorizedManager(null);
                setFreeDelivery(false);
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
            <div className="flex flex-col items-center gap-3 text-center">
                <Bike className="h-10 w-10 text-capsula-ink-muted" />
                <div className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">
                    Cargando Delivery…
                </div>
            </div>
        </div>
    );

    return (
        <div className={`${posFullscreen ? 'min-h-screen' : 'flex-1 -m-4 md:-m-6 h-[calc(100vh-4rem)]'} flex flex-col bg-capsula-ivory text-capsula-ink pb-16 lg:pb-0 animate-in fade-in duration-700`}>
            <div className={`${posFullscreen ? 'fixed top-0 z-30 w-full' : 'relative z-[31] w-full'} flex h-16 shrink-0 items-center justify-between border-b border-capsula-line bg-capsula-ivory-surface px-3 py-3 shadow-cap-soft md:h-24 md:px-6 md:py-4`}>
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-capsula-navy-soft text-capsula-ink md:h-14 md:w-14">
                        <Bike className="h-5 w-5 md:h-7 md:w-7" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink md:text-3xl">
                            {branding?.displayName ?? branding?.name ?? ''} <span className="text-capsula-coral">Delivery</span>
                        </h1>
                        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-capsula-coral" />
                            Sistema de despacho táctil CAPSULA
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-surface p-1">
                        <CurrencyCalculator totalUsd={finalTotal} hasServiceFee={false} onRateUpdated={setExchangeRate} />
                    </div>
                    <button
                        onClick={() => setShowWhatsAppParser(!showWhatsAppParser)}
                        className={`pos-btn !min-h-0 px-5 py-3 text-sm ${showWhatsAppParser ? '' : 'pos-btn-secondary'}`}
                    >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowComandasModal(true)}
                        title="Reimprimir comandas de cocina o recibos del día"
                        className="inline-flex items-center gap-1 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-capsula-ink transition-colors hover:bg-capsula-navy-soft"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Imprimir
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowTipModal(true)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#E8D9B8] bg-[#F3EAD6]/60 px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-[#946A1C] transition-colors hover:bg-[#F3EAD6]"
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Propina
                    </button>
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-xs font-medium tabular-nums text-capsula-ink-soft">
                        {new Date().toLocaleDateString('es-VE')}
                    </div>
                </div>
            </div>

            <div className={`flex ${posFullscreen ? 'h-screen pt-16 md:pt-24' : 'flex-1 min-h-0'} overflow-hidden`}>

                {/* ══════════════════════════════════════════════════════
                    PANEL IZQUIERDO — Datos del cliente + Menú
                    ══════════════════════════════════════════════════════ */}
                <div className={`flex-1 flex flex-col overflow-hidden bg-capsula-ivory ${mobileView === "menu" ? "flex" : "hidden"} lg:flex`}>

                    {/* ── Barra de datos del cliente ───────────────────── */}
                    <div className="shrink-0 border-b border-capsula-line bg-capsula-ivory-alt px-4 py-3">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="pos-kicker">Datos del cliente</span>
                            {(customerName || customerPhone || customerAddress || scheduledTime) && (
                                <button
                                    onClick={() => { setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setScheduledTime(''); }}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
                                >
                                    Limpiar
                                    <XIcon className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* Buscador de cliente recurrente */}
                        <div className="relative mb-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                type="text"
                                value={customerSearch}
                                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                                onFocus={() => setShowCustomerDropdown(true)}
                                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                                placeholder="Buscar cliente recurrente por cédula, nombre o teléfono…"
                                className="w-full rounded-xl border border-capsula-line bg-capsula-ivory py-2.5 pl-9 pr-3 text-sm font-medium text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                            />
                            {showCustomerDropdown && customerSearchResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-y-auto rounded-xl border border-capsula-line bg-capsula-ivory shadow-lg">
                                    {customerSearchResults.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); applyCustomer(c); }}
                                            className="w-full px-3 py-2 text-left hover:bg-capsula-navy-soft border-b border-capsula-line last:border-b-0"
                                        >
                                            <div className="font-semibold text-sm text-capsula-ink truncate">{c.fullName}</div>
                                            <div className="flex flex-wrap gap-x-2 text-[11px] text-capsula-ink-muted font-semibold mt-0.5">
                                                {c.idDocument && <span>{c.idDocument}</span>}
                                                {c.phone && <span>· {c.phone}</span>}
                                                {c.totalOrders > 0 && <span>· {c.totalOrders} órdenes</span>}
                                            </div>
                                            {c.address && (
                                                <div className="text-[11px] text-capsula-ink-soft truncate mt-0.5">{c.address}</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showCustomerDropdown && customerSearch.trim().length >= 2 && customerSearchResults.length === 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-capsula-line bg-capsula-ivory shadow-lg p-3 text-center">
                                    <p className="text-xs text-capsula-ink-muted font-semibold">Sin coincidencias. Llena los campos manualmente y se guardará al cobrar (próximamente).</p>
                                </div>
                            )}
                        </div>
                        <div className="mb-2 grid grid-cols-2 gap-2">
                            <div className="relative">
                                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => { setCustomerName(e.target.value); setSelectedCustomerId(null); }}
                                    placeholder="Nombre del cliente"
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory py-2.5 pl-9 pr-3 text-sm font-medium text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>
                            <div className="relative">
                                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={e => { setCustomerPhone(e.target.value); setSelectedCustomerId(null); }}
                                    placeholder="Teléfono"
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory py-2.5 pl-9 pr-3 text-sm font-medium text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr_140px] gap-2">
                            <div className="relative">
                                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                                <input
                                    type="text"
                                    value={customerAddress}
                                    onChange={e => setCustomerAddress(e.target.value)}
                                    placeholder="Dirección exacta de entrega…"
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory py-2.5 pl-9 pr-3 text-sm font-medium text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>
                            <div className="relative" title="Hora de entrega solicitada — opcional. Se imprime grande en la comanda de cocina/barra.">
                                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                                <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={e => setScheduledTime(e.target.value)}
                                    className="w-full rounded-xl border border-capsula-line bg-capsula-ivory py-2.5 pl-9 pr-2 text-sm font-semibold text-capsula-ink transition-colors focus:border-capsula-navy-deep focus:outline-none tabular-nums"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Buscador ─────────────────────────────────────── */}
                    <div className="shrink-0 border-b border-capsula-line bg-capsula-ivory px-4 py-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Buscar producto por nombre o SKU…"
                                className="w-full rounded-2xl border border-capsula-line bg-capsula-ivory-surface py-3 pl-12 pr-12 text-base font-medium text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                            />
                            {productSearch && (
                                <button
                                    onClick={() => setProductSearch('')}
                                    className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                                    aria-label="Limpiar búsqueda"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Categories */}
                    {!productSearch && (
                        <div className="no-scrollbar scroll-smooth flex gap-2 overflow-x-auto border-b border-capsula-line bg-capsula-ivory px-6 py-4">
                            {categories.map((cat: any) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`group inline-flex shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 ${
                                        selectedCategory === cat.id
                                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep hover:text-capsula-ink'
                                    }`}
                                >
                                    <span className="text-lg group-hover:rotate-12 transition-transform" aria-hidden>{getCategoryIcon(cat.name)}</span> {cat.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-6 pb-24 scroll-smooth">
                        {productSearch && (
                            <p className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                                <Lightbulb className="h-3.5 w-3.5" />
                                {filteredMenuItems.length} productos coinciden con tu búsqueda
                            </p>
                        )}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 tablet-land:grid-cols-4 xl:grid-cols-4">
                            {filteredMenuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToCart(item)}
                                    className="pos-tile group flex h-32 flex-col justify-between !p-3 text-left md:h-40 md:!p-5"
                                >
                                    <div className="text-base font-medium uppercase leading-tight tracking-[-0.01em] text-capsula-ink transition-colors group-hover:text-capsula-ink">
                                        {item.name}
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div className="font-semibold text-2xl tabular-nums tracking-[-0.02em] text-capsula-ink">
                                            <PriceDisplay usd={item.price} rate={exchangeRate} size="lg" showBs={false} />
                                        </div>
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-capsula-navy-deep text-capsula-cream opacity-100 transition-all lg:translate-y-4 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
                                            <PlusIcon className="h-4 w-4" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {filteredMenuItems.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center gap-3 py-20 text-capsula-ink-muted">
                                    <Search className="h-12 w-12 opacity-40" />
                                    <p className="text-[11px] font-medium uppercase tracking-[0.12em]">Sin resultados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════
                    PANEL DERECHO — Carrito + Cobro
                    ══════════════════════════════════════════════════════ */}
                <div className={`z-20 flex w-full flex-col border-l border-capsula-line bg-capsula-ivory-surface shadow-cap-soft lg:w-[420px] xl:w-[480px] ${mobileView === "order" ? "flex" : "hidden"} lg:flex`}>

                    {/* ── Encabezado del carrito ────────────────────────── */}
                    <div className="flex shrink-0 items-center justify-between border-b border-capsula-line bg-capsula-ivory-alt px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-capsula-ink">
                                <ShoppingCart className="h-4 w-4 text-capsula-ink-muted" />
                                Pedido
                            </span>
                            {cart.length > 0 && (
                                <span className="rounded-full border border-capsula-navy/10 bg-capsula-navy-soft px-2 py-0.5 text-[11px] font-medium tabular-nums text-capsula-ink">
                                    {cart.length} ítem{cart.length > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        {cart.length > 0 && (
                            <button
                                onClick={() => setCart([])}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-capsula-coral transition-colors hover:text-capsula-coral-hover"
                            >
                                Vaciar
                                <XIcon className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    {/* ── Resumen cliente (readonly, visible cuando hay datos) ── */}
                    {(customerName || customerPhone || customerAddress || scheduledTime) && (
                        <div className="shrink-0 border-b border-capsula-line bg-capsula-ivory-alt/60 px-4 py-2">
                            <div className="truncate text-[11px] font-medium leading-snug text-capsula-ink-soft">
                                {[customerName, customerPhone, customerAddress].filter(Boolean).join(' · ')}
                            </div>
                            {scheduledTime && (
                                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-capsula-coral">
                                    <Clock className="h-3 w-3" />
                                    Entregar {scheduledTime}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Lista del carrito ─────────────────────────────── */}
                    <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto bg-capsula-ivory p-3">
                        {cart.length === 0 && (
                            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-capsula-ink-muted">
                                <ShoppingCart className="h-10 w-10 opacity-40" />
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em]">Carrito vacío</p>
                            </div>
                        )}
                        {cart.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-start justify-between gap-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 transition-transform active:scale-[0.98]"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-1.5 text-sm font-medium text-capsula-ink">
                                        <span className="shrink-0 tabular-nums tracking-tight text-capsula-coral">×{item.quantity}</span>
                                        <span className="truncate">{item.name}</span>
                                    </div>
                                    {item.modifiers.length > 0 && (
                                        <div className="mt-0.5 truncate pl-5 text-[11px] text-capsula-ink-muted">
                                            {item.modifiers.map(m => m.name).join(' · ')}
                                        </div>
                                    )}
                                    {item.notes && (
                                        <div className="mt-0.5 inline-flex items-center gap-1 pl-5 text-[11px] italic text-capsula-coral">
                                            <MessageSquare className="h-3 w-3" />
                                            {item.notes}
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-sm font-medium tabular-nums text-capsula-ink">${item.lineTotal.toFixed(2)}</span>
                                    <button
                                        onClick={() => removeFromCart(i)}
                                        className="flex h-6 w-6 items-center justify-center rounded-lg text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral"
                                        aria-label="Quitar ítem"
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Sección de cobro (siempre visible, scroll interno) ── */}
                    <div className="shrink-0 space-y-3 overflow-y-auto border-t border-capsula-line bg-capsula-ivory-alt p-4" style={{ maxHeight: '62%' }}>

                        {/* Totales compactos */}
                        <div className="space-y-1.5 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-4 py-3">
                            <div className="flex justify-between text-xs font-medium text-capsula-ink-soft">
                                <span>Subtotal</span>
                                <PriceDisplay usd={cartSubtotal} rate={exchangeRate} size="sm" showBs={false} />
                            </div>
                            <div className="flex justify-between text-xs font-medium text-capsula-ink-soft">
                                <span className="inline-flex items-center gap-1">
                                    <Bike className="h-3 w-3" />
                                    Delivery
                                </span>
                                {freeDelivery ? (
                                    <span className="tabular-nums">
                                        <s className="text-capsula-ink-muted">+${deliveryFeeBase.toFixed(2)}</s>{' '}
                                        <span className="font-semibold text-[#2F6B4E]">GRATIS</span>
                                    </span>
                                ) : (
                                    <span className="tabular-nums text-capsula-ink">+${deliveryFee.toFixed(2)}</span>
                                )}
                            </div>
                            {discountType === 'DIVISAS_33' && isPagoDivisas && (
                                <div className="flex justify-between rounded-lg border border-[#D3E2D8] bg-[#E5EDE7]/40 px-2 py-1 text-xs font-medium text-[#2F6B4E]">
                                    <span>Dto. Divisas</span>
                                    <span className="tabular-nums">-${((divisasUsdAmount ?? cartSubtotal) / 3 + DELIVERY_FEE_NORMAL - DELIVERY_FEE_DIVISAS).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex items-baseline justify-between border-t border-capsula-line pt-2">
                                <span className="text-sm font-medium uppercase tracking-[0.1em] text-capsula-ink-soft">Total</span>
                                <div className="font-semibold text-2xl tabular-nums tracking-[-0.02em] text-capsula-ink">
                                    <PriceDisplay usd={finalTotal} rate={exchangeRate} size="lg" showBs={false} />
                                </div>
                            </div>
                            {/* Calculadora USD → Bs inline en el panel de cobro */}
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

                            {/* Descuentos — 3 botones compactos en una fila */}
                            <div className="grid grid-cols-3 gap-1.5">
                                <button
                                    onClick={() => handleDiscountSelect('NONE')}
                                    className={`rounded-xl border px-2 py-2.5 text-xs font-medium uppercase tracking-[0.04em] transition-colors ${
                                        discountType === 'NONE'
                                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep'
                                    }`}
                                >
                                    Normal
                                </button>
                                <button
                                    onClick={() => handleDiscountSelect('DIVISAS_33')}
                                    className={`rounded-xl border px-2 py-2.5 text-xs font-medium uppercase tracking-[0.04em] transition-colors ${
                                        discountType === 'DIVISAS_33'
                                            ? 'border-[#2F6B4E] bg-[#2F6B4E] text-white'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-[#2F6B4E] hover:bg-[#E5EDE7]/60'
                                    }`}
                                >
                                    Divisa -33%
                                </button>
                                <button
                                    onClick={() => handleDiscountSelect('CORTESIA_100')}
                                    className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium uppercase tracking-[0.04em] transition-colors ${
                                        (discountType === 'CORTESIA_100' || discountType === 'CORTESIA_PERCENT')
                                            ? 'border-capsula-coral bg-capsula-coral text-white'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-coral hover:bg-capsula-coral-subtle'
                                    }`}
                                >
                                    <Gift className="h-3.5 w-3.5" />
                                    {(discountType === 'CORTESIA_100' || discountType === 'CORTESIA_PERCENT')
                                        ? `${discountType === 'CORTESIA_PERCENT' ? cortesiaPercentNum + '%' : '100%'}`
                                        : 'Cortesía'}
                                </button>
                            </div>
                            {(discountType === 'CORTESIA_100' || discountType === 'CORTESIA_PERCENT') && authorizedManager && (
                                <div className="text-center text-[11px] font-medium text-capsula-coral">
                                    Auth: {authorizedManager.name}
                                </div>
                            )}

                            {/* Toggle promo "Delivery Gratis" */}
                            <button
                                type="button"
                                onClick={() => setFreeDelivery(v => !v)}
                                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.04em] transition-colors ${
                                    freeDelivery
                                        ? 'border-[#2F6B4E] bg-[#E5EDE7] text-[#2F6B4E]'
                                        : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-[#2F6B4E] hover:text-[#2F6B4E]'
                                }`}
                                aria-pressed={freeDelivery}
                            >
                                <Bike className="h-3.5 w-3.5" />
                                {freeDelivery ? 'Delivery GRATIS aplicado' : 'Aplicar Delivery Gratis (Promo)'}
                            </button>

                            {/* Modo de pago */}
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => { setIsMixedMode(false); setMixedPayments([]); }}
                                    className={`rounded-xl border px-2 py-2.5 text-xs font-medium uppercase tracking-[0.04em] transition-colors ${
                                        !isMixedMode
                                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep'
                                    }`}
                                >
                                    Pago único
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsMixedMode(true); setAmountReceived(''); }}
                                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium uppercase tracking-[0.04em] transition-colors ${
                                        isMixedMode
                                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep'
                                    }`}
                                >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    Pago mixto
                                </button>
                            </div>

                            {!isMixedMode ? (
                                /* ── Pago Único ── */
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {([
                                            { id: 'CASH_USD',       label: 'Cash $',       Icon: DollarSign },
                                            { id: 'CASH_EUR',       label: 'Cash €',       Icon: Euro },
                                            { id: 'ZELLE',          label: 'Zelle',        Icon: Zap },
                                            { id: 'PDV_SHANKLISH',  label: 'PDV Shan.',    Icon: CreditCard },
                                            { id: 'PDV_SUPERFERRO', label: 'PDV Super.',   Icon: CreditCard },
                                            { id: 'MOVIL_NG',       label: 'Móvil NG',     Icon: Smartphone },
                                            { id: 'CASH_BS',        label: 'Efectivo Bs',  Icon: Banknote },
                                        ] as const).map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => { setPaymentMethod(m.id); setAmountReceived(''); }}
                                                className={`inline-flex items-center justify-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] transition-colors active:scale-95 ${
                                                    paymentMethod === m.id
                                                        ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                                        : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep hover:text-capsula-ink'
                                                }`}
                                            >
                                                <m.Icon className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{m.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory p-1">
                                        <input
                                            type="number"
                                            value={amountReceived}
                                            onChange={e => setAmountReceived(e.target.value)}
                                            placeholder={isBsPayMethod && exchangeRate ? `Bs ${(finalTotal * exchangeRate).toFixed(0)}` : 'Monto recibido…'}
                                            className="flex-1 rounded-lg border-none bg-transparent px-3 py-2.5 text-lg font-medium tabular-nums text-capsula-ink placeholder:text-capsula-ink-muted focus:outline-none focus:ring-0"
                                        />
                                        <div className="pr-3 text-xs font-medium uppercase text-capsula-ink-muted">
                                            {isBsPayMethod ? 'Bs' : 'USD'}
                                        </div>
                                    </div>
                                    {isBsPayMethod && exchangeRate && (parseFloat(amountReceived) || 0) > 0 && (
                                        <div className="flex justify-between px-1 text-xs">
                                            <span className="text-capsula-ink-muted">Equiv. USD</span>
                                            <span className="font-medium tabular-nums text-[#2F6B4E]">
                                                ${((parseFloat(amountReceived) || 0) / exchangeRate).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    {paymentMethod === 'CASH_USD' && (parseFloat(amountReceived) || 0) > finalTotal + 0.001 && (
                                        <div className="flex justify-between px-1 text-sm font-medium">
                                            <span className="text-[#946A1C]">Vuelto</span>
                                            <span className="font-semibold tabular-nums tracking-[-0.01em] text-[#946A1C]">
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
                                        <div className="space-y-0.5 rounded-xl border border-capsula-navy/10 bg-capsula-navy-soft px-3 py-2 text-xs text-capsula-ink-soft">
                                            <div className="flex justify-between">
                                                <span>Divisas sobre ${(divisasUsdAmount ?? 0).toFixed(2)} USD</span>
                                                <span className="font-medium tabular-nums">-${((divisasUsdAmount ?? 0) / 3).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between font-medium text-capsula-ink">
                                                <span>Total a cobrar</span>
                                                <span className="tabular-nums">${finalTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    const linesForConfirmation: PaymentConfirmationLine[] = isMixedMode
                                        ? mixedPayments.map(p => ({ method: p.method, amountUSD: p.amountUSD, amountBS: p.amountBS }))
                                        : [{ method: paymentMethod, amountUSD: finalTotal }];
                                    requestPaymentConfirmation(linesForConfirmation, finalTotal, handleCheckout);
                                }}
                                disabled={cart.length === 0 || isProcessing}
                                className="pos-btn w-full !min-h-0 py-5 text-lg tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    'Procesando…'
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-5 w-5" />
                                        Confirmar orden
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* WhatsApp Parser Modal */}
            {showWhatsAppParser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-capsula-navy-deep/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-deep">
                        <div className="flex shrink-0 items-center justify-between border-b border-capsula-line p-5">
                            <h3 className="inline-flex items-center gap-2 font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                                <MessageCircle className="h-5 w-5 text-capsula-ink-muted" />
                                Pegar chat de WhatsApp
                            </h3>
                            <button
                                onClick={() => setShowWhatsAppParser(false)}
                                className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                                aria-label="Cerrar"
                            >
                                <XIcon className="h-5 w-5" />
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

            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-capsula-navy-deep/60 p-0 backdrop-blur-sm animate-in fade-in zoom-in duration-300 sm:items-center sm:p-4">
                    <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-deep sm:max-h-[90vh] sm:rounded-2xl">
                        <div className="flex items-center justify-between border-b border-capsula-line p-6">
                            <div>
                                <h3 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">{selectedItemForModifier.name}</h3>
                                <div className="mt-1 font-semibold text-2xl tabular-nums tracking-[-0.02em] text-capsula-ink">
                                    <PriceDisplay usd={selectedItemForModifier.price} rate={exchangeRate} size="lg" showBs={false} />
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModifierModal(false)}
                                className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                                aria-label="Cerrar"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
                            {selectedItemForModifier.modifierGroups?.map((groupRel) => {
                                const group = groupRel.modifierGroup;
                                const totalSelector = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                                const isValid = !group.isRequired || totalSelector >= group.minSelections;
                                return (
                                    <div
                                        key={group.id}
                                        className={`rounded-2xl border p-5 transition-colors ${
                                            isValid
                                                ? 'border-capsula-line bg-capsula-ivory-alt/60'
                                                : 'border-[#EFD2C8] bg-[#F7E3DB]/40'
                                        }`}
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <h4 className="text-[11px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                                                {group.name}
                                            </h4>
                                            <span
                                                className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] tabular-nums ${
                                                    isValid
                                                        ? 'border border-capsula-navy/10 bg-capsula-navy-soft text-capsula-ink'
                                                        : 'border border-[#EFD2C8] bg-[#F7E3DB] text-[#B04A2E]'
                                                }`}
                                            >
                                                {totalSelector}/{group.maxSelections}{group.isRequired ? ' · req.' : ''}
                                            </span>
                                        </div>
                                        <div className="grid gap-2">
                                            {(() => {
                                                const { toggles, passThrough } = groupModifiersForSinCon(group.modifiers as any);
                                                const selectedIdSet = new Set(
                                                    currentModifiers.filter(m => m.groupId === group.id).map(m => m.id),
                                                );
                                                return (
                                                    <>
                                                        {toggles.map(toggle => (
                                                            <SinConToggle
                                                                key={toggle.key}
                                                                toggle={toggle}
                                                                state={toggleStateFor(toggle, selectedIdSet)}
                                                                onChange={(target) => setIngredientToggleState(group, toggle, target)}
                                                            />
                                                        ))}
                                                        {passThrough.map(mod => {
                                                            const existing = currentModifiers.find(m => m.id === mod.id && m.groupId === group.id);
                                                            const qty = existing ? existing.quantity : 0;
                                                            const isMax = group.maxSelections > 1 && totalSelector >= group.maxSelections;
                                                            const isRadio = group.maxSelections === 1;
                                                            const modOption = mod as unknown as ModifierOption;
                                                            return (
                                                                <div key={mod.id}>
                                                                <div
                                                                    className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                                                                        qty > 0
                                                                            ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                                                                            : 'border-capsula-line bg-capsula-ivory'
                                                                    }`}
                                                                >
                                                                    <div>
                                                                        <div className="text-sm font-medium text-capsula-ink">{mod.name}</div>
                                                                        {mod.priceAdjustment !== 0 && (
                                                                            <div className="text-xs text-capsula-ink-muted tabular-nums">+${mod.priceAdjustment.toFixed(2)}</div>
                                                                        )}
                                                                    </div>
                                                                    {isRadio ? (
                                                                        <button
                                                                            onClick={() => updateModifierQuantity(group, mod as any, 1)}
                                                                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                                                                                qty > 0
                                                                                    ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-cream'
                                                                                    : 'border-capsula-line text-transparent hover:border-capsula-navy-deep'
                                                                            }`}
                                                                            aria-label="Seleccionar"
                                                                        >
                                                                            {qty > 0 && <CheckCircle2 className="h-4 w-4" />}
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface p-1">
                                                                            <button
                                                                                onClick={() => updateModifierQuantity(group, mod as any, -1)}
                                                                                disabled={qty === 0}
                                                                                className={`h-8 w-8 rounded-lg font-medium transition-colors ${
                                                                                    qty === 0
                                                                                        ? 'text-capsula-ink-faint'
                                                                                        : 'text-capsula-ink hover:bg-capsula-ivory-alt'
                                                                                }`}
                                                                            >
                                                                                −
                                                                            </button>
                                                                            <span className="w-6 text-center text-base font-medium tabular-nums text-capsula-ink">{qty}</span>
                                                                            <button
                                                                                onClick={() => updateModifierQuantity(group, mod as any, 1)}
                                                                                disabled={isMax}
                                                                                className={`h-8 w-8 rounded-lg font-medium transition-colors ${
                                                                                    isMax
                                                                                        ? 'text-capsula-ink-faint'
                                                                                        : 'bg-capsula-navy-deep text-capsula-cream hover:bg-capsula-navy'
                                                                                }`}
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Sub-grupo anidado (§82) */}
                                                                {qty > 0 && hasChildGroup(modOption) && (
                                                                    <ChildGroupSelector
                                                                        childGroup={modOption.childGroup}
                                                                        selections={currentModifiers}
                                                                        onSelect={(cg, child, change) => updateModifierQuantity(cg as ModifierGroup, child as ModifierOption, change)}
                                                                    />
                                                                )}
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-alt p-6">
                                <label className="pos-label mb-3">Instrucciones especiales (opcional)</label>
                                <textarea
                                    value={itemNotes}
                                    onChange={e => setItemNotes(e.target.value)}
                                    className="h-24 w-full resize-none rounded-xl border border-capsula-line bg-capsula-ivory p-4 text-sm text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                                    placeholder="Escribe aquí si el cliente tiene alguna petición…"
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-2xl border border-capsula-line bg-capsula-ivory-alt p-6">
                                <span className="text-sm font-medium uppercase tracking-[0.1em] text-capsula-ink-soft">Cantidad</span>
                                <div className="flex items-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory p-1.5">
                                    <button
                                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                                        className="h-12 w-12 rounded-lg text-2xl font-medium text-capsula-ink transition-colors hover:bg-capsula-ivory-alt active:scale-90"
                                    >
                                        −
                                    </button>
                                    <span className="w-14 text-center font-semibold text-3xl tabular-nums tracking-[-0.02em] text-capsula-ink">
                                        {itemQuantity}
                                    </span>
                                    <button
                                        onClick={() => setItemQuantity(itemQuantity + 1)}
                                        className="h-12 w-12 rounded-lg bg-capsula-navy-deep text-2xl font-medium text-capsula-cream transition-colors hover:bg-capsula-navy active:scale-95"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 border-t border-capsula-line p-6">
                            <button
                                onClick={() => setShowModifierModal(false)}
                                className="pos-btn pos-btn-secondary flex-1 !min-h-0 py-4 text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAddToCart}
                                disabled={
                                    selectedItemForModifier?.modifierGroups.some(g => !isGroupValid(g.modifierGroup)) ||
                                    !childGroupsValid(currentModifiers, selectedItemForModifier?.modifierGroups.map(g => g.modifierGroup) ?? [])
                                }
                                className="pos-btn flex-[2] !min-h-0 py-4 text-sm tracking-[0.04em] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Agregar al carrito
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPinModal && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-capsula-navy-deep/60 p-0 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center sm:p-4">
                    <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-capsula-coral/20 bg-capsula-ivory-surface p-6 shadow-cap-deep md:p-8 sm:rounded-2xl">
                        <div className="mb-6 text-center">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-capsula-coral-subtle text-capsula-coral">
                                <Gift className="h-6 w-6" />
                            </div>
                            <h3 className="font-semibold text-2xl tracking-[-0.02em] text-capsula-ink">Autorizar cortesía</h3>
                            <p className="mt-1 text-xs text-capsula-ink-soft">Este descuento requiere validación de gerencia</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="pos-label mb-3 text-center">Selecciona el % de descuento</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['25','50','75','100'].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setCortesiaPercent(v)}
                                            className={`rounded-xl border px-3 py-3 text-sm font-medium tabular-nums transition-colors active:scale-95 ${
                                                cortesiaPercent === v
                                                    ? 'border-capsula-coral bg-capsula-coral text-white'
                                                    : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-coral hover:text-capsula-coral'
                                            }`}
                                        >
                                            {v}%
                                        </button>
                                    ))}
                                </div>
                                <div className="relative mt-3">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={cortesiaPercent}
                                        onChange={e => setCortesiaPercent(e.target.value)}
                                        className="w-full rounded-xl border border-capsula-line bg-capsula-ivory py-4 text-center font-semibold text-xl tabular-nums tracking-[-0.02em] text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-coral focus:outline-none"
                                        placeholder="Valor %"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 font-medium text-capsula-coral">%</span>
                                </div>
                            </div>

                            <div>
                                <label className="pos-label mb-3 text-center">Introduce tu PIN de seguridad</label>
                                <div className="mb-4 flex h-20 items-center justify-center rounded-xl border border-capsula-line bg-capsula-ivory-alt p-6 font-semibold text-3xl tracking-[1.2em] text-capsula-ink">
                                    {pinInput.length > 0
                                        ? pinInput.replace(/./g, '•')
                                        : <span className="text-base font-medium tracking-normal text-capsula-ink-faint">MODO PIN…</span>
                                    }
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => handlePinKey(n.toString())}
                                            className="pos-btn pos-btn-secondary !min-h-[56px] text-xl"
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => handlePinKey('clear')}
                                        className="pos-btn pos-btn-secondary !min-h-[56px] text-sm text-capsula-coral"
                                    >
                                        CLR
                                    </button>
                                    <button
                                        key={0}
                                        onClick={() => handlePinKey('0')}
                                        className="pos-btn pos-btn-secondary !min-h-[56px] text-xl"
                                    >
                                        0
                                    </button>
                                    <button
                                        onClick={() => handlePinKey('back')}
                                        className="pos-btn pos-btn-secondary !min-h-[56px]"
                                        aria-label="Borrar"
                                    >
                                        <Delete className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {pinError && (
                                <div className="rounded-xl border border-[#EFD2C8] bg-[#F7E3DB]/60 py-3 text-center text-xs font-medium text-[#B04A2E]">
                                    {pinError}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => { setShowPinModal(false); setPinInput(''); }}
                                    className="pos-btn pos-btn-secondary !min-h-0 py-3.5 text-sm"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={handlePinSubmit}
                                    disabled={!pinInput}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border-b-4 border-capsula-coral-hover bg-capsula-coral px-5 py-3.5 text-sm font-medium text-white transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Validar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ── MODAL: COMANDAS DEL DÍA (reimpresión) ────────────────────────── */}
            <ComandasDelDiaModal
                isOpen={showComandasModal}
                onClose={() => setShowComandasModal(false)}
            />

            {/* ── MODAL: PROPINA COLECTIVA ─────────────────────────────────────── */}
            {showTipModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-capsula-navy-deep/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#E8D9B8] bg-capsula-ivory-surface p-6 shadow-cap-deep">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-xl tracking-[-0.02em] text-[#946A1C]">Propina colectiva</h3>
                            <button
                                type="button"
                                onClick={() => setShowTipModal(false)}
                                className="rounded-full p-1 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                                aria-label="Cerrar"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-capsula-ink-soft">
                            Propina recibida después del cobro. Indica el cliente para trazabilidad.
                        </p>
                        {/* Cliente / referencia */}
                        <input
                            type="text"
                            value={tipClientRef}
                            onChange={e => setTipClientRef(e.target.value)}
                            placeholder="Nombre del cliente (opcional)"
                            className="w-full rounded-xl border border-capsula-line bg-capsula-ivory px-4 py-3 text-sm font-medium text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-[#946A1C] focus:outline-none"
                        />
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                { id: 'CASH_USD',       label: 'Cash $',       Icon: DollarSign },
                                { id: 'CASH_EUR',       label: 'Cash €',       Icon: Euro },
                                { id: 'ZELLE',          label: 'Zelle',        Icon: Zap },
                                { id: 'PDV_SHANKLISH',  label: 'PDV Shan.',    Icon: CreditCard },
                                { id: 'PDV_SUPERFERRO', label: 'PDV Super.',   Icon: CreditCard },
                                { id: 'MOVIL_NG',       label: 'Móvil NG',     Icon: Smartphone },
                                { id: 'CASH_BS',        label: 'Efectivo Bs',  Icon: Banknote },
                            ] as const).map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setTipMethod(m.id)}
                                    className={`inline-flex items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium uppercase tracking-[0.04em] transition-colors ${
                                        tipMethod === m.id
                                            ? 'border-[#946A1C] bg-[#946A1C] text-white'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-[#946A1C] hover:text-[#946A1C]'
                                    }`}
                                >
                                    <m.Icon className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{m.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center rounded-xl border border-capsula-line bg-capsula-ivory p-1">
                            <span className="pl-4 text-sm font-medium text-capsula-ink-muted">
                                {['CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG'].includes(tipMethod) ? 'Bs' : '$'}
                            </span>
                            <input
                                type="number" min="0" step="0.01"
                                value={tipAmount}
                                onChange={e => setTipAmount(e.target.value)}
                                placeholder="0.00"
                                className="flex-1 border-none bg-transparent px-3 py-3 font-semibold text-2xl tabular-nums tracking-[-0.02em] text-capsula-ink placeholder:text-capsula-ink-muted focus:outline-none"
                                autoFocus
                            />
                        </div>
                        {['CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG'].includes(tipMethod) && exchangeRate && (parseFloat(tipAmount) || 0) > 0 && (
                            <div className="flex justify-between px-1 text-xs">
                                <span className="text-capsula-ink-muted">Equivalente USD</span>
                                <span className="font-medium tabular-nums text-[#2F6B4E]">
                                    ${((parseFloat(tipAmount) || 0) / exchangeRate).toFixed(2)}
                                </span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleRecordTip}
                            disabled={isTipProcessing || !(parseFloat(tipAmount) > 0)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-b-4 border-[#6B4E12] bg-[#946A1C] px-5 py-4 text-base font-medium text-white transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            {isTipProcessing ? 'Registrando…' : 'Registrar propina'}
                        </button>
                    </div>
                </div>
            )}

            {/* Navegación móvil delivery */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-capsula-line bg-capsula-ivory-surface shadow-cap-soft lg:hidden">
                <button
                    onClick={() => setMobileView("menu")}
                    className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
                        mobileView === "menu"
                            ? "bg-capsula-navy-soft text-capsula-ink"
                            : "text-capsula-ink-muted"
                    }`}
                >
                    {mobileView === "menu" && (
                        <div className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-capsula-navy-deep" />
                    )}
                    <Menu className="h-5 w-5" />
                    Menú
                </button>
                <button
                    onClick={() => setMobileView("order")}
                    className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
                        mobileView === "order"
                            ? "bg-capsula-navy-soft text-capsula-ink"
                            : "text-capsula-ink-muted"
                    }`}
                >
                    {mobileView === "order" && (
                        <div className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-capsula-navy-deep" />
                    )}
                    <ClipboardList className="h-5 w-5" />
                    Orden
                    {cart.length > 0 && (
                        <span className="absolute right-8 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-capsula-coral px-1 text-[9px] font-medium tabular-nums text-white">
                            {cart.length}
                        </span>
                    )}
                </button>
            </nav>

            {/* Modal de confirmación pre-cobro (flag requirePaymentConfirmation) */}
            <PaymentConfirmationModal
                open={paymentConfirmationPending !== null}
                totalUSD={paymentConfirmationPending?.totalUSD ?? 0}
                lines={paymentConfirmationPending?.lines ?? []}
                onCancel={() => setPaymentConfirmationPending(null)}
                onConfirm={() => {
                    const pending = paymentConfirmationPending;
                    setPaymentConfirmationPending(null);
                    pending?.onConfirm();
                }}
            />
        </div>
    );
}
