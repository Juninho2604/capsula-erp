'use client';

import { useState, useEffect } from 'react';
import { Search, X as XIcon, ShoppingBag, Bike, Printer } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { getMenuForPOSAction, type CartItem } from '@/app/actions/pos.actions';
import { createPedidosYAOrderAction } from '@/app/actions/pedidosya.actions';
import { calcPedidosYaPrice } from '@/lib/pedidosya-price';
import { printKitchenCommand } from '@/lib/print-command';
import { getPOSConfig } from '@/lib/pos-settings';
import toast from 'react-hot-toast';

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
            unitPrice: pyaBase, modifiers: exploded, notes: itemNotes || undefined, lineTotal
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
                // Comanda cocina
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
            <div className="flex flex-col items-center gap-3 text-center">
                <Bike className="h-10 w-10 text-capsula-coral" />
                <div className="font-heading text-xl tracking-[-0.02em] text-capsula-navy-deep">
                    Cargando PedidosYA…
                </div>
            </div>
        </div>
    );

    return (
        <div className={`${posFullscreen ? 'min-h-screen' : 'flex-1 -m-4 md:-m-6 h-[calc(100vh-4rem)]'} flex flex-col bg-capsula-ivory text-capsula-ink`}>
            {/* Header */}
            <div className={`${posFullscreen ? 'fixed top-0 z-30 w-full' : 'relative z-[31] w-full'} flex h-16 shrink-0 items-center justify-between border-b border-capsula-line bg-capsula-ivory-surface px-3 py-3 shadow-cap-soft md:h-20 md:px-6 md:py-4`}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-capsula-coral-subtle text-capsula-coral md:h-12 md:w-12">
                        <Bike className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div>
                        <h1 className="font-heading text-lg tracking-[-0.02em] text-capsula-navy-deep md:text-2xl">
                            POS <span className="text-capsula-coral">PedidosYA</span>
                        </h1>
                        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-capsula-ink-muted">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-capsula-coral" />
                            Registro de pedidos externos
                        </p>
                    </div>
                </div>
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-xs font-medium tabular-nums text-capsula-ink-soft">
                    {new Date().toLocaleDateString('es-VE')}
                </div>
            </div>

            <div className={`flex ${posFullscreen ? 'h-screen pt-16 md:pt-20' : 'min-h-0 flex-1'} overflow-hidden`}>
                {/* Menú izquierda */}
                <div className="flex flex-1 flex-col overflow-hidden bg-capsula-ivory">
                    {/* Búsqueda */}
                    <div className="border-b border-capsula-line bg-capsula-ivory px-4 py-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                type="text"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                placeholder="Buscar producto por nombre o SKU…"
                                className="w-full rounded-2xl border border-capsula-line bg-capsula-ivory-surface py-3 pl-12 pr-12 text-sm font-medium text-capsula-ink transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
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
                    {/* Categorías */}
                    {!productSearch && (
                        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-capsula-line bg-capsula-ivory px-4 py-3">
                            {categories.map((cat: any) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`shrink-0 rounded-full border px-5 py-2 text-sm font-medium transition-colors active:scale-95 ${
                                        selectedCategory === cat.id
                                            ? 'border-capsula-navy-deep bg-capsula-navy-deep text-capsula-ivory'
                                            : 'border-capsula-line bg-capsula-ivory-surface text-capsula-ink-soft hover:border-capsula-navy-deep hover:text-capsula-ink'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {/* Productos */}
                    <div className="flex-1 overflow-y-auto p-4 pb-24">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 tablet-land:grid-cols-4 xl:grid-cols-4">
                            {filteredMenuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToCart(item)}
                                    className="pos-tile group flex h-32 flex-col justify-between !p-4 text-left"
                                >
                                    <div className="text-sm font-medium uppercase leading-tight tracking-[-0.01em] text-capsula-ink transition-colors group-hover:text-capsula-navy-deep">
                                        {item.name}
                                    </div>
                                    <div>
                                        <div className="font-heading text-2xl tabular-nums tracking-[-0.02em] text-capsula-coral">
                                            ${getPYAPrice(item).toFixed(2)}
                                        </div>
                                        <div className="text-xs tabular-nums text-capsula-ink-muted line-through">
                                            ${item.price.toFixed(2)}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Panel derecho */}
                <div className="z-20 flex w-80 flex-col border-l border-capsula-line bg-capsula-ivory-surface shadow-cap-soft tablet-land:w-96 xl:w-96">
                    {/* Datos del pedido */}
                    <div className="space-y-2 border-b border-capsula-line bg-capsula-ivory-surface p-4">
                        <h2 className="inline-flex items-center gap-2 font-heading text-base tracking-[-0.01em] text-capsula-navy-deep">
                            <ShoppingBag className="h-4 w-4 text-capsula-ink-muted" />
                            Datos del pedido
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={externalOrderId}
                                onChange={e => setExternalOrderId(e.target.value)}
                                placeholder="# PedidosYA"
                                className="col-span-2 rounded-xl border border-capsula-coral/40 bg-capsula-coral-subtle p-2 font-mono text-sm text-capsula-coral placeholder:text-capsula-coral/50 focus:border-capsula-coral focus:outline-none"
                            />
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Nombre cliente"
                                className="rounded-xl border border-capsula-line bg-capsula-ivory p-2 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                            />
                            <input
                                type="text"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="Teléfono"
                                className="rounded-xl border border-capsula-line bg-capsula-ivory p-2 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                            />
                        </div>
                        <textarea
                            value={customerAddress}
                            onChange={e => setCustomerAddress(e.target.value)}
                            placeholder="Dirección…"
                            className="h-16 w-full resize-none rounded-xl border border-capsula-line bg-capsula-ivory p-2 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                        />
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Notas adicionales…"
                            className="w-full rounded-xl border border-capsula-line bg-capsula-ivory p-2 text-sm text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                        />
                    </div>

                    {/* Carrito */}
                    <div className="flex-1 space-y-2 overflow-y-auto p-4">
                        {cart.length === 0 && (
                            <div className="py-8 text-center text-sm text-capsula-ink-muted">
                                <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-capsula-ink-faint" />
                                <p>Agrega productos del menú</p>
                            </div>
                        )}
                        {cart.map((item, i) => (
                            <div
                                key={i}
                                className="group flex justify-between rounded-2xl border border-capsula-line bg-capsula-ivory-alt/60 p-4"
                            >
                                <div>
                                    <div className="flex gap-2 text-sm font-medium text-capsula-ink">
                                        <span className="tabular-nums text-capsula-coral">×{item.quantity}</span>
                                        {item.name}
                                    </div>
                                    {item.modifiers.length > 0 && (
                                        <div className="pl-6 text-xs text-capsula-ink-muted">
                                            {item.modifiers.map(m => m.name).join(', ')}
                                        </div>
                                    )}
                                    {item.notes && (
                                        <div className="pl-6 text-xs italic text-capsula-coral">
                                            &ldquo;{item.notes}&rdquo;
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="font-medium tabular-nums text-capsula-navy-deep">
                                        ${item.lineTotal.toFixed(2)}
                                    </div>
                                    <button
                                        onClick={() => removeFromCart(i)}
                                        className="text-xs text-capsula-coral opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                                    >
                                        Borrar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer: total + botones */}
                    <div className="space-y-3 border-t border-capsula-line bg-capsula-ivory-surface p-4">
                        <div className="flex justify-between rounded-lg border border-capsula-line bg-capsula-ivory-alt px-3 py-2 text-sm text-capsula-ink-soft">
                            <span>Total estimado</span>
                            <span className="font-heading tabular-nums tracking-[-0.01em] text-capsula-navy-deep">
                                ${cartSubtotal.toFixed(2)}
                            </span>
                        </div>
                        <div className="rounded-xl border border-capsula-coral/30 bg-capsula-coral-subtle px-3 py-2 text-xs text-capsula-coral">
                            <strong>PedidosYA gestiona el cobro.</strong> Este registro es solo para inventario y cocina. No se genera cobranza interna.
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={cart.length === 0 || isProcessing}
                            className="pos-btn w-full !min-h-[56px] text-base tracking-[0.04em] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isProcessing ? 'Registrando…' : 'Registrar pedido'}
                        </button>
                        {lastOrder && (
                            <button
                                onClick={handleReprintComanda}
                                className="pos-btn pos-btn-secondary w-full !min-h-0 py-3 text-sm"
                            >
                                <Printer className="h-4 w-4" />
                                Reimprimir comanda {lastOrder.orderNumber}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal modificadores */}
            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-card w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] shadow-2xl border border-border">
                        <div className="p-5 border-b border-border flex justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-foreground">{selectedItemForModifier.name}</h3>
                                <p className="text-orange-500 font-black text-xl">
                                    ${getPYAPrice(selectedItemForModifier).toFixed(2)}
                                    <span className="text-sm text-muted-foreground line-through ml-2">${selectedItemForModifier.price.toFixed(2)}</span>
                                </p>
                            </div>
                            <button onClick={() => setShowModifierModal(false)} className="text-4xl leading-none text-muted-foreground hover:text-destructive transition-colors">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {selectedItemForModifier.modifierGroups?.map(groupRel => {
                                const group = groupRel.modifierGroup;
                                const totalSelected = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                                const isValid = !group.isRequired || totalSelected >= group.minSelections;
                                return (
                                    <div key={group.id} className={`p-4 rounded-xl border ${isValid ? 'border-border' : 'border-destructive bg-destructive/5'}`}>
                                        <div className="flex justify-between mb-2">
                                            <h4 className="font-bold text-foreground">{group.name}</h4>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${isValid ? 'bg-orange-500/10 text-orange-500' : 'bg-destructive/10 text-destructive'}`}>{totalSelected}/{group.maxSelections}</span>
                                        </div>
                                        <div className="grid gap-2">
                                            {group.modifiers.filter(m => m.isAvailable).map(mod => {
                                                const existing = currentModifiers.find(m => m.id === mod.id && m.groupId === group.id);
                                                const qty = existing ? existing.quantity : 0;
                                                const isMax = group.maxSelections > 1 && totalSelected >= group.maxSelections;
                                                const isRadio = group.maxSelections === 1;
                                                return (
                                                    <div key={mod.id} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${qty > 0 ? 'bg-orange-500/10 border-orange-500/50' : 'bg-secondary/30 border-border'}`}>
                                                        <span className="text-sm text-foreground">{mod.name}{mod.priceAdjustment !== 0 && <span className="text-xs text-orange-500 ml-1">{mod.priceAdjustment > 0 ? '+' : ''}${mod.priceAdjustment.toFixed(2)}</span>}</span>
                                                        {isRadio ? (
                                                            <button onClick={() => updateModifierQuantity(group, mod, 1)} className={`w-6 h-6 rounded-full border-2 flex justify-center items-center text-xs transition-colors ${qty > 0 ? 'bg-orange-500 border-orange-500 text-white' : 'border-border text-transparent'}`}>✓</button>
                                                        ) : (
                                                            <div className="flex gap-1 bg-background border border-border p-1 rounded-lg">
                                                                <button onClick={() => updateModifierQuantity(group, mod, -1)} disabled={qty === 0} className={`w-7 h-7 rounded-lg font-bold text-base transition-colors ${qty === 0 ? 'text-muted-foreground/30' : 'text-foreground hover:bg-secondary'}`}>−</button>
                                                                <span className="font-bold text-orange-500 w-5 text-center text-sm flex items-center justify-center">{qty}</span>
                                                                <button onClick={() => updateModifierQuantity(group, mod, 1)} disabled={isMax} className={`w-7 h-7 rounded-lg font-bold text-base transition-colors ${isMax ? 'text-muted-foreground/30' : 'text-orange-500 hover:bg-orange-500/10'}`}>+</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="p-4 rounded-xl border border-border bg-secondary/20">
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">Notas</label>
                                <textarea value={itemNotes} onChange={e => setItemNotes(e.target.value)} className="w-full bg-background border border-border rounded-xl p-3 h-16 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Instrucciones especiales..." />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/20">
                                <span className="font-bold text-foreground">Cantidad</span>
                                <div className="flex bg-background border border-border rounded-xl overflow-hidden">
                                    <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="w-12 h-10 font-bold text-foreground hover:bg-secondary transition-colors">−</button>
                                    <span className="w-10 h-10 flex items-center justify-center font-black text-foreground">{itemQuantity}</span>
                                    <button onClick={() => setItemQuantity(itemQuantity + 1)} className="w-12 h-10 bg-orange-500 hover:bg-orange-400 font-bold text-white transition-colors">+</button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex gap-3">
                            <button onClick={() => setShowModifierModal(false)} className="flex-1 py-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl font-bold transition-colors">Cancelar</button>
                            <button
                                onClick={confirmAddToCart}
                                disabled={selectedItemForModifier?.modifierGroups.some(g => !isGroupValid(g.modifierGroup))}
                                className="flex-[2] py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
