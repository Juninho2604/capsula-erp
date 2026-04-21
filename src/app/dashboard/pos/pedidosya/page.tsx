'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { getMenuForPOSAction, type CartItem } from '@/app/actions/pos.actions';
import { createPedidosYAOrderAction } from '@/app/actions/pedidosya.actions';
import { calcPedidosYaPrice } from '@/lib/pedidosya-price';
import { printKitchenCommand } from '@/lib/print-command';
import { getPOSConfig } from '@/lib/pos-settings';
import toast from 'react-hot-toast';
import {
    Search, X, Package, Info, Loader2, Printer, Check, Plus, Minus, Pizza, ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    pedidosYaPrice?: number | null;
    pedidosYaEnabled?: boolean;
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

const inputClass =
    'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[14px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep';

export default function POSPedidosYAPage() {
    const { posFullscreen } = useUIStore();
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [externalOrderId, setExternalOrderId] = useState('');
    const [notes, setNotes] = useState('');
    const [productSearch, setProductSearch] = useState('');

    // MODIFIER MODAL
    const [showModifierModal, setShowModifierModal] = useState(false);
    const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
    const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemNotes, setItemNotes] = useState('');

    // Last order for reprint
    const [lastOrder, setLastOrder] = useState<{ orderNumber: string; items: CartItem[]; customerName: string } | null>(null);

    useEffect(() => {
        getMenuForPOSAction().then(res => {
            if (res.success && res.data) {
                setCategories(res.data);
                if (res.data.length > 0) setSelectedCategory(res.data[0].id);
            }
        }).finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (selectedCategory) {
            const cat = categories.find((c: any) => c.id === selectedCategory);
            if (cat) setMenuItems(cat.items);
        }
    }, [selectedCategory, categories]);

    const filteredMenuItems = productSearch.trim()
        ? categories.flatMap((c: any) => c.items as MenuItem[]).filter(i =>
            i.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            i.sku?.toLowerCase().includes(productSearch.toLowerCase())
        )
        : menuItems;

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

    const updateModifierQuantity = (group: ModifierGroup, modifier: ModifierOption, change: number) => {
        const currentInGroup = currentModifiers.filter(m => m.groupId === group.id);
        const totalSelected = currentInGroup.reduce((s, m) => s + m.quantity, 0);
        const existing = currentModifiers.find(m => m.id === modifier.id && m.groupId === group.id);
        const currentQty = existing ? existing.quantity : 0;

        if (change > 0) {
            if (group.maxSelections > 1 && totalSelected >= group.maxSelections) return;
            if (group.maxSelections === 1) {
                const others = currentModifiers.filter(m => m.groupId !== group.id);
                setCurrentModifiers([...others, { groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: 1 }]);
                return;
            }
        }

        const newQty = currentQty + change;
        if (newQty < 0) return;
        let mods = [...currentModifiers];
        if (existing) {
            mods = newQty === 0 ? mods.filter(m => !(m.id === modifier.id && m.groupId === group.id)) : mods.map(m => (m.id === modifier.id && m.groupId === group.id ? { ...m, quantity: newQty } : m));
        } else if (newQty > 0) {
            mods.push({ groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: newQty });
        }
        setCurrentModifiers(mods);
    };

    const isGroupValid = (group: ModifierGroup) => {
        if (!group.isRequired) return true;
        return currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0) >= group.minSelections;
    };

    const getPYAPrice = (item: MenuItem) =>
        item.pedidosYaPrice ?? calcPedidosYaPrice(item.price);

    const confirmAddToCart = () => {
        if (!selectedItemForModifier) return;
        if (!selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup))) return;
        const modTotal = currentModifiers.reduce((s, m) => s + m.priceAdjustment * m.quantity, 0);
        const pyaBase = getPYAPrice(selectedItemForModifier);
        const lineTotal = (pyaBase + modTotal) * itemQuantity;
        const exploded = currentModifiers.flatMap(m => Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment }));
        setCart([...cart, {
            menuItemId: selectedItemForModifier.id, name: selectedItemForModifier.name, quantity: itemQuantity,
            unitPrice: pyaBase, modifiers: exploded, notes: itemNotes || undefined, lineTotal,
        }]);
        setShowModifierModal(false);
    };

    const cartSubtotal = cart.reduce((s, i) => s + i.lineTotal, 0);

    const handleSubmit = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);
        try {
            const result = await createPedidosYAOrderAction({
                customerName: customerName || 'PedidosYA',
                customerPhone,
                customerAddress,
                externalOrderId,
                items: cart,
                notes,
            });

            if (result.success && result.data) {
                const cfg = getPOSConfig();
                if (cfg.printComandaOnDelivery) {
                    printKitchenCommand({
                        orderNumber: result.data.orderNumber,
                        orderType: 'DELIVERY',
                        customerName: customerName || 'PedidosYA',
                        items: cart.map(i => ({ name: i.name, quantity: i.quantity, modifiers: i.modifiers.map(m => m.name), notes: i.notes })),
                        createdAt: new Date(),
                        address: customerAddress,
                    });
                }
                setLastOrder({ orderNumber: result.data.orderNumber, items: [...cart], customerName: customerName || 'PedidosYA' });
                setCart([]);
                setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setExternalOrderId(''); setNotes('');
                toast.success(`Pedido registrado: ${result.data.orderNumber}`);
            } else {
                toast.error(result.message || 'Error al registrar');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error al registrar pedido');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReprintComanda = () => {
        if (!lastOrder) return;
        printKitchenCommand({
            orderNumber: lastOrder.orderNumber,
            orderType: 'DELIVERY',
            customerName: lastOrder.customerName,
            items: lastOrder.items.map(i => ({ name: i.name, quantity: i.quantity, modifiers: i.modifiers.map(m => m.name), notes: i.notes })),
            createdAt: new Date(),
        });
    };

    if (isLoading) return (
        <div className="flex min-h-screen items-center justify-center bg-capsula-ivory">
            <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-capsula-coral" strokeWidth={1.5} />
                <div className="text-[14px] font-medium text-capsula-ink">Cargando PedidosYA…</div>
            </div>
        </div>
    );

    return (
        <div className={cn(
            posFullscreen ? 'min-h-screen' : 'flex-1 -m-4 md:-m-6 h-[calc(100vh-4rem)]',
            'flex flex-col bg-capsula-ivory font-sans text-capsula-ink',
        )}>
            {/* Header */}
            <div className={cn(
                'flex h-16 items-center justify-between border-b border-capsula-line bg-capsula-ivory-surface px-3 md:h-20 md:px-6',
                posFullscreen ? 'fixed top-0 z-30 w-full' : 'relative z-[31] w-full',
            )}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle md:h-12 md:w-12">
                        <Pizza className="h-5 w-5 text-capsula-coral md:h-6 md:w-6" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="font-heading text-[18px] leading-none tracking-[-0.01em] text-capsula-navy-deep md:text-[24px]">
                            POS <span className="text-capsula-coral">PedidosYA</span>
                        </h1>
                        <p className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-capsula-ink-muted">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-capsula-coral" />
                            Registro de pedidos externos
                        </p>
                    </div>
                </div>
                <div className="rounded-full border border-capsula-line bg-capsula-ivory px-3 py-1.5 font-mono text-[11px] tabular-nums text-capsula-ink-soft">
                    {new Date().toLocaleDateString('es-VE')}
                </div>
            </div>

            <div className={cn(
                'flex overflow-hidden',
                posFullscreen ? 'h-screen pt-16 md:pt-20' : 'min-h-0 flex-1',
            )}>
                {/* Menú izquierda */}
                <div className="flex flex-1 flex-col overflow-hidden bg-capsula-ivory">
                    {/* Búsqueda */}
                    <div className="border-b border-capsula-line bg-capsula-ivory-surface px-4 py-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                            <input
                                type="text"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                placeholder="Buscar producto por nombre o SKU…"
                                className="w-full rounded-full border border-capsula-line bg-capsula-ivory py-2.5 pl-11 pr-11 text-[14px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep"
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

                    {/* Categorías */}
                    {!productSearch && (
                        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-capsula-line bg-capsula-ivory-surface px-4 py-3">
                            {categories.map((cat: any) => {
                                const active = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            'shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                                            active
                                                ? 'border-capsula-coral bg-capsula-coral text-white'
                                                : 'border-capsula-line bg-capsula-ivory text-capsula-ink-soft hover:border-capsula-line-strong hover:text-capsula-ink',
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Productos */}
                    <div className="flex-1 overflow-y-auto p-4 pb-24">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 tablet-land:grid-cols-4 xl:grid-cols-4">
                            {filteredMenuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToCart(item)}
                                    className="group flex h-32 flex-col justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-4 text-left shadow-cap-soft transition-all hover:-translate-y-px hover:border-capsula-coral/40 hover:shadow-cap-raised active:translate-y-0"
                                >
                                    <div className="text-[13px] font-medium leading-tight text-capsula-ink transition-colors group-hover:text-capsula-coral">
                                        {item.name}
                                    </div>
                                    <div>
                                        <div className="font-mono text-[20px] font-semibold text-capsula-coral">
                                            ${getPYAPrice(item).toFixed(2)}
                                        </div>
                                        <div className="font-mono text-[11px] text-capsula-ink-muted line-through">
                                            ${item.price.toFixed(2)}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Panel derecho */}
                <div className="z-20 flex w-80 flex-col border-l border-capsula-line bg-capsula-ivory-surface tablet-land:w-96 xl:w-96">
                    {/* Datos del pedido */}
                    <div className="space-y-2 border-b border-capsula-line bg-capsula-ivory-surface p-4">
                        <h2 className="flex items-center gap-2 text-[14px] font-medium text-capsula-ink">
                            <Package className="h-4 w-4 text-capsula-navy" strokeWidth={1.5} />
                            Datos del pedido
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={externalOrderId}
                                onChange={e => setExternalOrderId(e.target.value)}
                                placeholder="# PedidosYA"
                                className="col-span-2 rounded-[var(--radius)] border border-capsula-coral/30 bg-capsula-coral-subtle/40 px-3 py-2 font-mono text-[13px] text-capsula-ink outline-none placeholder:text-capsula-coral/50 focus:border-capsula-coral"
                            />
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Nombre cliente"
                                className={inputClass}
                            />
                            <input
                                type="text"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="Teléfono"
                                className={inputClass}
                            />
                        </div>
                        <textarea
                            value={customerAddress}
                            onChange={e => setCustomerAddress(e.target.value)}
                            placeholder="Dirección…"
                            className={cn(inputClass, 'h-16 resize-none')}
                        />
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Notas adicionales…"
                            className={inputClass}
                        />
                    </div>

                    {/* Carrito */}
                    <div className="flex-1 space-y-2 overflow-y-auto p-4">
                        {cart.length === 0 && (
                            <div className="py-8 text-center text-[13px] text-capsula-ink-muted">
                                <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-capsula-ink-faint" strokeWidth={1.5} />
                                <p>Agrega productos del menú</p>
                            </div>
                        )}
                        {cart.map((item, i) => (
                            <div key={i} className="group flex justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2 text-[13px] font-medium text-capsula-ink">
                                        <span className="font-mono text-capsula-coral">×{item.quantity}</span>
                                        <span className="truncate">{item.name}</span>
                                    </div>
                                    {item.modifiers.length > 0 && (
                                        <div className="pl-7 text-[11px] text-capsula-ink-muted">
                                            {item.modifiers.map(m => m.name).join(', ')}
                                        </div>
                                    )}
                                    {item.notes && (
                                        <div className="pl-7 text-[11px] italic text-capsula-coral">
                                            "{item.notes}"
                                        </div>
                                    )}
                                </div>
                                <div className="ml-2 text-right">
                                    <div className="font-mono text-[13px] font-semibold text-capsula-ink">
                                        ${item.lineTotal.toFixed(2)}
                                    </div>
                                    <button
                                        onClick={() => removeFromCart(i)}
                                        className="text-[11px] text-capsula-coral opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                                    >
                                        Borrar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer: total + botones */}
                    <div className="space-y-3 border-t border-capsula-line bg-capsula-ivory-surface p-4">
                        <div className="flex items-baseline justify-between rounded-[var(--radius)] bg-capsula-ivory px-3 py-2">
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Total estimado</span>
                            <span className="font-mono text-[15px] font-semibold text-capsula-ink">${cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-capsula-coral/20 bg-capsula-coral-subtle/40 px-3 py-2 text-[11px] text-capsula-coral">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                            <span>
                                <strong>PedidosYA gestiona el cobro.</strong> Este registro es solo para inventario y cocina. No se genera cobranza interna.
                            </span>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={cart.length === 0 || isProcessing}
                            className="w-full rounded-full bg-capsula-coral py-3 text-[14px] font-semibold text-white transition-colors hover:bg-capsula-coral-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isProcessing ? 'REGISTRANDO…' : 'REGISTRAR PEDIDO'}
                        </button>
                        {lastOrder && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReprintComanda}
                                className="w-full"
                            >
                                <Printer className="h-4 w-4" strokeWidth={1.5} />
                                Reimprimir comanda {lastOrder.orderNumber}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal modificadores */}
            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 z-[60] flex animate-in fade-in zoom-in items-center justify-center bg-capsula-navy-deep/40 p-4 backdrop-blur-sm duration-200">
                    <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)]">
                        <div className="flex items-start justify-between border-b border-capsula-line p-5">
                            <div>
                                <h3 className="font-heading text-[20px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                                    {selectedItemForModifier.name}
                                </h3>
                                <p className="flex items-baseline gap-2">
                                    <span className="font-mono text-[20px] font-semibold text-capsula-coral">
                                        ${getPYAPrice(selectedItemForModifier).toFixed(2)}
                                    </span>
                                    <span className="font-mono text-[12px] text-capsula-ink-muted line-through">
                                        ${selectedItemForModifier.price.toFixed(2)}
                                    </span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModifierModal(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                            >
                                <X className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto p-5">
                            {selectedItemForModifier.modifierGroups?.map(groupRel => {
                                const group = groupRel.modifierGroup;
                                const totalSelected = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                                const isValid = !group.isRequired || totalSelected >= group.minSelections;
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
                                        <div className="mb-2 flex justify-between">
                                            <h4 className="text-[13px] font-medium text-capsula-ink">{group.name}</h4>
                                            <span className={cn(
                                                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                isValid
                                                    ? 'bg-capsula-coral-subtle text-capsula-coral'
                                                    : 'bg-[#F7E3DB] text-[#B04A2E]',
                                            )}>
                                                {totalSelected}/{group.maxSelections}
                                            </span>
                                        </div>
                                        <div className="grid gap-2">
                                            {group.modifiers.filter(m => m.isAvailable).map(mod => {
                                                const existing = currentModifiers.find(m => m.id === mod.id && m.groupId === group.id);
                                                const qty = existing ? existing.quantity : 0;
                                                const isMax = group.maxSelections > 1 && totalSelected >= group.maxSelections;
                                                const isRadio = group.maxSelections === 1;
                                                const selected = qty > 0;
                                                return (
                                                    <div
                                                        key={mod.id}
                                                        className={cn(
                                                            'flex items-center justify-between rounded-[var(--radius)] border px-3 py-2 transition-colors',
                                                            selected
                                                                ? 'border-capsula-coral/40 bg-capsula-coral-subtle/50'
                                                                : 'border-capsula-line bg-capsula-ivory',
                                                        )}
                                                    >
                                                        <span className="text-[13px] text-capsula-ink">
                                                            {mod.name}
                                                            {mod.priceAdjustment !== 0 && (
                                                                <span className="ml-1 font-mono text-[11px] text-capsula-coral">
                                                                    {mod.priceAdjustment > 0 ? '+' : ''}${mod.priceAdjustment.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </span>
                                                        {isRadio ? (
                                                            <button
                                                                onClick={() => updateModifierQuantity(group, mod, 1)}
                                                                className={cn(
                                                                    'inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                                                                    selected
                                                                        ? 'border-capsula-coral bg-capsula-coral text-white'
                                                                        : 'border-capsula-line text-transparent',
                                                                )}
                                                            >
                                                                <Check className="h-3 w-3" strokeWidth={2} />
                                                            </button>
                                                        ) : (
                                                            <div className="flex gap-1 rounded-full border border-capsula-line bg-capsula-ivory-surface p-1">
                                                                <button
                                                                    onClick={() => updateModifierQuantity(group, mod, -1)}
                                                                    disabled={qty === 0}
                                                                    className={cn(
                                                                        'inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                                                                        qty === 0
                                                                            ? 'text-capsula-ink-faint'
                                                                            : 'text-capsula-ink hover:bg-capsula-ivory-alt',
                                                                    )}
                                                                >
                                                                    <Minus className="h-3 w-3" strokeWidth={2} />
                                                                </button>
                                                                <span className="inline-flex w-5 items-center justify-center font-mono text-[12px] font-semibold text-capsula-coral">
                                                                    {qty}
                                                                </span>
                                                                <button
                                                                    onClick={() => updateModifierQuantity(group, mod, 1)}
                                                                    disabled={isMax}
                                                                    className={cn(
                                                                        'inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                                                                        isMax
                                                                            ? 'text-capsula-ink-faint'
                                                                            : 'text-capsula-coral hover:bg-capsula-coral-subtle',
                                                                    )}
                                                                >
                                                                    <Plus className="h-3 w-3" strokeWidth={2} />
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
                                    Notas
                                </label>
                                <textarea
                                    value={itemNotes}
                                    onChange={e => setItemNotes(e.target.value)}
                                    className="h-16 w-full resize-none rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                    placeholder="Instrucciones especiales…"
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory p-3">
                                <span className="text-[13px] font-medium text-capsula-ink">Cantidad</span>
                                <div className="flex overflow-hidden rounded-full border border-capsula-line bg-capsula-ivory-surface">
                                    <button
                                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                                        className="inline-flex h-9 w-10 items-center justify-center text-capsula-ink transition-colors hover:bg-capsula-ivory-alt"
                                    >
                                        <Minus className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                    <span className="inline-flex h-9 w-10 items-center justify-center font-mono text-[14px] font-semibold text-capsula-ink">
                                        {itemQuantity}
                                    </span>
                                    <button
                                        onClick={() => setItemQuantity(itemQuantity + 1)}
                                        className="inline-flex h-9 w-10 items-center justify-center bg-capsula-coral text-white transition-colors hover:bg-capsula-coral-hover"
                                    >
                                        <Plus className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 border-t border-capsula-line p-4">
                            <Button
                                variant="ghost"
                                onClick={() => setShowModifierModal(false)}
                                className="flex-1"
                            >
                                Cancelar
                            </Button>
                            <button
                                onClick={confirmAddToCart}
                                disabled={selectedItemForModifier?.modifierGroups.some(g => !isGroupValid(g.modifierGroup))}
                                className="flex-[2] rounded-full bg-capsula-coral py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-capsula-coral-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                AGREGAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
