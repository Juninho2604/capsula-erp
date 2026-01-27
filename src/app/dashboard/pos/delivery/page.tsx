'use client';

import { useState, useEffect } from 'react';
import { createSalesOrderAction, getMenuForPOSAction, validateManagerPinAction, type CartItem } from '@/app/actions/pos.actions';
import { printReceipt, printKitchenCommand } from '@/lib/print-command';

// ============================================================================
// INTERFACE TYPES
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
}

export default function POSDeliveryPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [cart, setCart] = useState<CartItem[]>([]);

    // CAMPOS DELIVERY
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');

    const [isProcessing, setIsProcessing] = useState(false);

    // lastOrder
    const [lastOrder, setLastOrder] = useState<{
        orderNumber: string;
        total: number;
        subtotal: number;
        discount: number;
        itemsSnapshot: any[];
    } | null>(null);

    // MODAL STATE
    const [showModifierModal, setShowModifierModal] = useState(false);
    const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
    const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemNotes, setItemNotes] = useState('');

    // PAYMENT STATE
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY'>('TRANSFER');
    const [amountReceived, setAmountReceived] = useState('');

    // DISCOUNT STATE
    const [discountType, setDiscountType] = useState<'NONE' | 'DIVISAS_33' | 'CORTESIA_100'>('NONE');
    const [authorizedManager, setAuthorizedManager] = useState<{ id: string, name: string } | null>(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');

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
        return '📦';
    };

    // Agregar/Modificar Item
    const handleAddToCart = (item: MenuItem) => {
        setSelectedItemForModifier(item);
        setCurrentModifiers([]);
        setItemQuantity(1);
        setItemNotes('');
        setShowModifierModal(true);
    };

    const toggleModifier = (group: ModifierGroup, modifier: ModifierOption) => {
        const selectedInGroup = currentModifiers.filter(m => m.groupId === group.id);
        const alreadySelected = selectedInGroup.find(m => m.id === modifier.id);

        if (alreadySelected) {
            setCurrentModifiers(currentModifiers.filter(m => m !== alreadySelected));
        } else {
            if (group.maxSelections === 1 && selectedInGroup.length > 0) {
                // Radio replace
                const others = currentModifiers.filter(m => m.groupId !== group.id);
                setCurrentModifiers([...others, { groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment }]);
            } else if (selectedInGroup.length < group.maxSelections) {
                // Check add
                setCurrentModifiers([...currentModifiers, { groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment }]);
            }
        }
    };

    const isGroupValid = (group: ModifierGroup) => {
        if (!group.isRequired) return true;
        const count = currentModifiers.filter(m => m.groupId === group.id).length;
        return count >= group.minSelections;
    };

    const confirmAddToCart = () => {
        if (!selectedItemForModifier) return;
        if (!selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup))) return;

        const modTotal = currentModifiers.reduce((s, m) => s + m.priceAdjustment, 0);
        const lineTotal = (selectedItemForModifier.price + modTotal) * itemQuantity;

        setCart([...cart, {
            menuItemId: selectedItemForModifier.id,
            name: selectedItemForModifier.name,
            quantity: itemQuantity,
            unitPrice: selectedItemForModifier.price,
            modifiers: currentModifiers.map(m => ({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment })),
            notes: itemNotes || undefined,
            lineTotal
        }]);
        setShowModifierModal(false);
        setSelectedItemForModifier(null);
    };

    const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));

    // Totales
    const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0);
    const discountAmount = discountType === 'DIVISAS_33' ? cartTotal * 0.33 : (discountType === 'CORTESIA_100' ? cartTotal : 0);
    const finalTotal = cartTotal - discountAmount;
    const paidAmount = parseFloat(amountReceived) || 0;
    const changeAmount = paidAmount - finalTotal;

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);
        try {
            const result = await createSalesOrderAction({
                orderType: 'DELIVERY',
                customerName: customerName || 'Cliente Delivery',
                customerPhone,
                customerAddress,
                items: cart,
                paymentMethod,
                amountPaid: paidAmount || finalTotal,
                discountType,
                authorizedById: authorizedManager?.id,
                notes: `Delivery: ${customerAddress}`
            });

            if (result.success && result.data) {
                printKitchenCommand({
                    orderNumber: result.data.orderNumber,
                    orderType: 'DELIVERY',
                    customerName: `${customerName} (Cel: ${customerPhone})`,
                    items: cart.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        modifiers: item.modifiers.map(m => m.name),
                        notes: item.notes,
                    })),
                    createdAt: new Date(),
                    address: customerAddress // Importante para delivery
                });

                setLastOrder({
                    orderNumber: result.data.orderNumber,
                    total: finalTotal,
                    subtotal: cartTotal,
                    discount: discountAmount,
                    itemsSnapshot: cart.map(i => ({ sku: 'DEL', name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.lineTotal, modifiers: i.modifiers.map(m => m.name) }))
                });

                setCart([]); setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setAmountReceived('');
                setDiscountType('NONE'); setAuthorizedManager(null);
            } else {
                alert(result.message);
            }
        } catch (e) {
            console.error(e); alert('Error procesando venta');
        } finally {
            setIsProcessing(false);
        }
    };

    // PIN & Discount Handlers
    const handleDiscountSelect = (t: string) => { if (t === 'CORTESIA_100') { setPinInput(''); setPinError(''); setShowPinModal(true); } else { setDiscountType(t as any); setAuthorizedManager(null); } };
    const handlePinSubmit = async () => { const r = await validateManagerPinAction(pinInput); if (r.success && r.data) { setAuthorizedManager({ id: r.data.managerId, name: r.data.managerName }); setDiscountType('CORTESIA_100'); setShowPinModal(false); } else setPinError('PIN Inválido'); };
    const handlePinKey = (k: string) => { if (k === 'clear') setPinInput(''); else if (k === 'back') setPinInput(p => p.slice(0, -1)); else setPinInput(p => p + k); };

    if (isLoading) return <div className="text-white p-10">Cargando Delivery...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white relative flex flex-col font-sans">
            {/* Header Delivery (Azul) */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 fixed top-0 w-full z-30 shadow-xl flex justify-between items-center h-20">
                <div className="flex items-center gap-3">
                    <span className="text-4xl">🛵</span>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Shanklish Delivery</h1>
                        <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">Sistema de Despacho</p>
                    </div>
                </div>
                <div><p className="font-mono text-xl">{new Date().toLocaleDateString('es-VE')}</p></div>
            </div>

            <div className="flex h-screen pt-20 overflow-hidden">
                {/* Menú */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
                    <div className="flex gap-2 p-3 bg-gray-800 border-b border-gray-700 overflow-x-auto whitespace-nowrap">
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-5 py-3 rounded-lg font-bold transition-all flex items-center gap-2 ${selectedCategory === cat.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                <span>{getCategoryIcon(cat.name)}</span> {cat.name}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto pb-24">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {menuItems.map(item => (
                                <button key={item.id} onClick={() => handleAddToCart(item)} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-xl p-4 text-left transition-all hover:scale-[1.02] h-36 flex flex-col justify-between shadow-md group">
                                    <div className="font-bold text-lg leading-tight group-hover:text-blue-300">{item.name}</div>
                                    <div className="text-2xl font-black text-blue-400 group-hover:text-blue-300">${item.price.toFixed(2)}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Carrito Delivery */}
                <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl z-20">
                    <div className="p-4 bg-gray-800 border-b border-gray-700">
                        <h2 className="font-black text-xl mb-3 flex items-center gap-2">📦 Datos de Entrega</h2>
                        <div className="space-y-2">
                            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre Cliente" className="w-full bg-gray-700 border-none rounded p-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500" />
                            <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Teléfono" className="w-full bg-gray-700 border-none rounded p-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500" />
                            <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Dirección exacta..." className="w-full bg-gray-700 border-none rounded p-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 h-20 resize-none text-sm" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-900/50">
                        {cart.map((item, i) => (
                            <div key={i} className="bg-gray-800 p-3 rounded border border-gray-700 flex justify-between group">
                                <div>
                                    <div className="font-bold text-sm flex gap-2"><span className="text-blue-400">x{item.quantity}</span> {item.name}</div>
                                    <div className="text-xs text-gray-400 pl-6">{item.modifiers.map(m => m.name).join(', ')}</div>
                                    {item.notes && <div className="text-xs text-blue-300 pl-6 italic">"{item.notes}"</div>}
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-sm">${item.lineTotal.toFixed(2)}</div>
                                    <button onClick={() => removeFromCart(i)} className="text-red-500 text-xs hover:underline opacity-0 group-hover:opacity-100 transition-opacity">Borrar</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-gray-800 border-t border-gray-700 space-y-3">
                        {/* Descuentos Small */}
                        <div className="flex gap-1">
                            <button onClick={() => handleDiscountSelect('NONE')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${discountType === 'NONE' ? 'bg-blue-900 text-blue-200 ring-1 ring-blue-500' : 'bg-gray-700 text-gray-500'}`}>Normal</button>
                            <button onClick={() => handleDiscountSelect('DIVISAS_33')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${discountType === 'DIVISAS_33' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'}`}>Divisa -33%</button>
                            <button onClick={() => handleDiscountSelect('CORTESIA_100')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${discountType === 'CORTESIA_100' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-500'}`}>Cortesía</button>
                        </div>

                        <div className="grid grid-cols-4 gap-1">
                            {['TRANSFER', 'MOBILE_PAY', 'CASH', 'CARD'].map(m => (
                                <button key={m} onClick={() => setPaymentMethod(m as any)} className={`py-2 text-xs font-bold rounded ${paymentMethod === m ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                                    {m === 'TRANSFER' ? 'Transf' : m === 'MOBILE_PAY' ? 'P.Móvil' : m === 'CASH' ? 'Efectivo' : 'Punto'}
                                </button>
                            ))}
                        </div>

                        <div className="bg-gray-900 p-3 rounded flex justify-between items-center border border-gray-700">
                            <span className="text-gray-400">TOTAL A PAGAR</span>
                            <span className="text-2xl font-black text-blue-400">${finalTotal.toFixed(2)}</span>
                        </div>

                        <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xl shadow-lg shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR DELIVERY 🚀'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal Modificadores (Estilo Azul) */}
            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] shadow-2xl border border-gray-700">
                        <div className="p-5 border-b border-gray-700 flex justify-between bg-gray-850">
                            <div><h3 className="text-2xl font-bold">{selectedItemForModifier.name}</h3><p className="text-blue-400 font-bold text-xl">${selectedItemForModifier.price.toFixed(2)}</p></div>
                            <button onClick={() => setShowModifierModal(false)} className="text-4xl leading-none hover:text-red-500">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {selectedItemForModifier.modifierGroups?.map((groupRel) => {
                                const group = groupRel.modifierGroup;
                                const count = currentModifiers.filter(m => m.groupId === group.id).length;
                                const isValid = !group.isRequired || count >= group.minSelections;
                                return (
                                    <div key={group.id} className={`p-4 rounded-xl border ${isValid ? 'border-gray-600 bg-gray-750' : 'border-red-500 bg-red-900/10'}`}>
                                        <div className="flex justify-between mb-2">
                                            <h4 className="font-bold text-blue-100">{group.name}</h4>
                                            <span className={`text-xs px-2 py-0.5 rounded ${isValid ? 'bg-blue-900 text-blue-300' : 'bg-red-800 text-red-200'}`}>{count}/{group.maxSelections}</span>
                                        </div>
                                        <div className="grid gap-2">
                                            {group.modifiers.map(mod => {
                                                const selected = currentModifiers.some(m => m.id === mod.id && m.groupId === group.id);
                                                return (
                                                    <button key={mod.id} onClick={() => toggleModifier(group, mod)} className={`text-left p-2 rounded border transition-all flex justify-between ${selected ? 'bg-blue-600 border-blue-500 text-white font-bold' : 'bg-gray-800 border-gray-600 text-gray-300'}`}>
                                                        <span>{mod.name}</span>{selected && '✓'}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}

                            <div className="bg-gray-750 p-4 rounded-xl border border-gray-600">
                                <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">Notas Delivery</label>
                                <textarea value={itemNotes} onChange={e => setItemNotes(e.target.value)} className="w-full bg-gray-900 rounded p-3 h-20 text-white border-none focus:ring-2 focus:ring-blue-500" placeholder="Instrucciones especiales..." />
                            </div>

                            <div className="flex items-center justify-between bg-gray-750 p-4 rounded-xl border border-gray-600">
                                <span className="font-bold">Cantidad</span>
                                <div className="flex bg-gray-900 rounded-lg">
                                    <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="w-12 h-10 hover:bg-gray-700 font-bold">-</button>
                                    <span className="w-10 h-10 flex items-center justify-center font-bold">{itemQuantity}</span>
                                    <button onClick={() => setItemQuantity(itemQuantity + 1)} className="w-12 h-10 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-r-lg">+</button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-700 flex gap-3">
                            <button onClick={() => setShowModifierModal(false)} className="flex-1 py-3 bg-gray-700 rounded-lg font-bold">Cancelar</button>
                            <button onClick={confirmAddToCart} disabled={selectedItemForModifier?.modifierGroups.some(g => !isGroupValid(g.modifierGroup))} className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold shadow-lg disabled:opacity-50">AGREGAR ITEM</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal PIN */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
                    <div className="bg-gray-800 p-6 rounded-2xl w-80 text-center">
                        <h3 className="font-bold text-xl mb-4">Autorización</h3>
                        <div className="bg-black p-4 rounded text-2xl tracking-widest mb-4 font-mono">{pinInput.replace(/./g, '*')}</div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => <button key={n} onClick={() => handlePinKey(n.toString())} className="bg-gray-700 p-3 rounded font-bold text-xl">{n}</button>)}
                            <button onClick={() => handlePinKey('clear')} className="bg-red-800 rounded font-bold text-red-200">C</button>
                            <button onClick={() => handlePinKey('back')} className="bg-gray-600 rounded font-bold">⌫</button>
                        </div>
                        <div className="flex gap-2"><button onClick={() => setShowPinModal(false)} className="flex-1 bg-gray-600 py-2 rounded">Cancelar</button><button onClick={handlePinSubmit} className="flex-1 bg-blue-600 py-2 rounded font-bold">OK</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
