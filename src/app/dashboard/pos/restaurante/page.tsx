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
    id: string; // modifierId
    name: string;
    priceAdjustment: number;
}

export default function POSRestaurantPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // lastOrder actualizado
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
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY'>('CASH');
    const [amountReceived, setAmountReceived] = useState('');

    // DISCOUNT STATE
    const [discountType, setDiscountType] = useState<'NONE' | 'DIVISAS_33' | 'CORTESIA_100'>('NONE');
    const [authorizedManager, setAuthorizedManager] = useState<{ id: string, name: string } | null>(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');

    // RESPONSIVE STATE
    const [showMobileCart, setShowMobileCart] = useState(false);

    useEffect(() => {
        async function loadMenu() {
            try {
                const result = await getMenuForPOSAction();
                if (result.success && result.data) {
                    setCategories(result.data);
                    if (result.data.length > 0) {
                        setSelectedCategory(result.data[0].id);
                    }
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
            if (category) {
                setMenuItems(category.items);
            }
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
        return '🍽️';
    };

    // Agregar item al carrito (Abrir Modal)
    const handleAddToCart = (item: MenuItem) => {
        setSelectedItemForModifier(item);
        setCurrentModifiers([]);
        setItemQuantity(1);
        setItemNotes('');
        setShowModifierModal(true);
    };

    // Lógica para seleccionar/deseleccionar modificadores
    const toggleModifier = (group: ModifierGroup, modifier: ModifierOption) => {
        const alreadySelected = currentModifiers.find(m => m.id === modifier.id && m.groupId === group.id);
        const selectedInGroup = currentModifiers.filter(m => m.groupId === group.id);

        if (alreadySelected) {
            // Deseleccionar
            setCurrentModifiers(currentModifiers.filter(m => m !== alreadySelected));
        } else {
            // Seleccionar
            // Verificar Máximos
            if (group.maxSelections === 1 && selectedInGroup.length > 0) {
                // Radio button behavior: Reemplazar
                const otherModifiers = currentModifiers.filter(m => m.groupId !== group.id);
                setCurrentModifiers([...otherModifiers, {
                    groupId: group.id,
                    groupName: group.name,
                    id: modifier.id,
                    name: modifier.name,
                    priceAdjustment: modifier.priceAdjustment
                }]);
            } else if (selectedInGroup.length < group.maxSelections) {
                // Checkbox behavior: Agregar si hay cupo
                setCurrentModifiers([...currentModifiers, {
                    groupId: group.id,
                    groupName: group.name,
                    id: modifier.id,
                    name: modifier.name,
                    priceAdjustment: modifier.priceAdjustment
                }]);
            } else {
                // Lleno: No hacer nada o avisar (opcional)
                // Podríamos hacer un efecto de "vibrar" para indicar error
            }
        }
    };

    // Verificar si el grupo está completo (validez)
    const isGroupValid = (group: ModifierGroup) => {
        if (!group.isRequired) return true;
        const count = currentModifiers.filter(m => m.groupId === group.id).length;
        return count >= group.minSelections;
    };

    const confirmAddToCart = () => {
        if (!selectedItemForModifier) return;

        // Validar todos los grupos requeridos
        const allGroupsValid = selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup));
        if (!allGroupsValid) return;

        const modifierTotal = currentModifiers.reduce((sum, m) => sum + m.priceAdjustment, 0);
        const lineTotal = (selectedItemForModifier.price + modifierTotal) * itemQuantity;

        const newItem: CartItem = {
            menuItemId: selectedItemForModifier.id,
            name: selectedItemForModifier.name,
            quantity: itemQuantity,
            unitPrice: selectedItemForModifier.price,
            modifiers: currentModifiers.map(m => ({
                modifierId: m.id,
                name: m.name,
                priceAdjustment: m.priceAdjustment,
            })),
            notes: itemNotes || undefined,
            lineTotal,
        };

        setCart([...cart, newItem]);
        setShowModifierModal(false);
        setSelectedItemForModifier(null);
    };

    // Calcular totales Carrito y Pagos
    const cartTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const discountAmount = discountType === 'DIVISAS_33' ? cartTotal * 0.33 : (discountType === 'CORTESIA_100' ? cartTotal : 0);
    const finalTotal = cartTotal - discountAmount;
    const paidAmount = parseFloat(amountReceived) || 0;
    const changeAmount = paidAmount - finalTotal;

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);
        try {
            const result = await createSalesOrderAction({
                orderType: 'RESTAURANT',
                customerName: customerName || 'Cliente Restaurante',
                items: cart,
                paymentMethod,
                amountPaid: paidAmount || finalTotal,
                discountType,
                authorizedById: authorizedManager?.id,
                notes: undefined
            });

            if (result.success && result.data) {
                // IMPRIMIR COMANDA
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
                setDiscountType('NONE');
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

    // Handle Descuentos / PIN
    const handleDiscountSelect = (type: string) => {
        if (type === 'CORTESIA_100') {
            setPinInput(''); setPinError(''); setShowPinModal(true);
        } else {
            setDiscountType(type as any); setAuthorizedManager(null);
        }
    };
    const handlePinSubmit = async () => {
        const res = await validateManagerPinAction(pinInput);
        if (res.success && res.data) {
            setAuthorizedManager({ id: res.data.managerId, name: res.data.managerName });
            setDiscountType('CORTESIA_100'); setShowPinModal(false);
        } else setPinError('PIN inválido');
    };
    const handlePinKey = (k: string) => {
        if (k === 'back') setPinInput(p => p.slice(0, -1));
        else if (k === 'clear') setPinInput('');
        else setPinInput(p => p + k);
    };

    if (isLoading) return <div className="text-white p-10">Cargando menú...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white relative">
            {/* Header */}
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
                {/* Menú Scrollable */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex gap-2 p-4 bg-gray-800 border-b border-gray-700 overflow-x-auto whitespace-nowrap snap-x">
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex-shrink-0 px-5 py-3 rounded-xl font-bold text-lg transition-all flex items-center gap-2 snap-start ${selectedCategory === cat.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-gray-700 text-gray-300'}`}>
                                <span>{getCategoryIcon(cat.name)}</span> {cat.name}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto pb-24">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {menuItems.map(item => (
                                <button key={item.id} onClick={() => handleAddToCart(item)} className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-amber-500/50 rounded-2xl p-5 text-left transition-all hover:scale-[1.01] h-40 flex flex-col justify-between shadow-lg">
                                    <div className="font-bold text-lg leading-tight line-clamp-2">{item.name}</div>
                                    <div className="text-3xl font-black text-amber-500">${item.price.toFixed(2)}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Carrito Responsive */}
                <div className={`fixed inset-0 z-40 bg-gray-900 flex flex-col transition-transform duration-300 lg:static lg:bg-gray-800 lg:w-96 lg:translate-x-0 lg:border-l lg:border-gray-700 ${showMobileCart ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="lg:hidden p-4 border-b border-gray-700 flex justify-between bg-gray-800">
                        <h2 className="font-bold text-xl">Carrito Actual</h2>
                        <button onClick={() => setShowMobileCart(false)}>✕</button>
                    </div>

                    <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Cliente / Mesa" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-amber-500 outline-none" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="text-center text-gray-500 mt-10">Tu carrito está vacío 🛒</div>
                        ) : (
                            cart.map((item, i) => (
                                <div key={i} className="bg-gray-700 p-3 rounded-lg border border-gray-600 relative group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 font-bold"><span className="bg-amber-500 text-black w-5 h-5 flex items-center justify-center rounded-full text-xs">{item.quantity}</span> {item.name}</div>
                                            {item.modifiers.length > 0 && <div className="text-xs text-gray-400 mt-1 pl-7">{item.modifiers.map(m => m.name).join(', ')}</div>}
                                            {item.notes && <div className="text-xs text-amber-300 mt-1 pl-7 italic">"{item.notes}"</div>}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-amber-400">${item.lineTotal.toFixed(2)}</div>
                                            <button onClick={() => removeFromCart(i)} className="text-red-400 text-xs hover:underline mt-1">Quitar</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-gray-800 border-t border-gray-700 space-y-3">
                        {/* Descuentos */}
                        <div className="flex gap-2">
                            <button onClick={() => handleDiscountSelect('NONE')} className={`flex-1 py-2 text-xs font-bold rounded ${discountType === 'NONE' ? 'bg-gray-500 text-white' : 'bg-gray-700'}`}>Normal</button>
                            <button onClick={() => handleDiscountSelect('DIVISAS_33')} className={`flex-1 py-2 text-xs font-bold rounded ${discountType === 'DIVISAS_33' ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>-33% Divisa</button>
                            <button onClick={() => handleDiscountSelect('CORTESIA_100')} className={`flex-1 py-2 text-xs font-bold rounded ${discountType === 'CORTESIA_100' ? 'bg-purple-600 text-white' : 'bg-gray-700'}`}>Cortesía</button>
                        </div>

                        {/* Métodos Pago */}
                        <div className="grid grid-cols-4 gap-2">
                            {['CASH', 'CARD', 'MOBILE_PAY', 'TRANSFER'].map(m => (
                                <button key={m} onClick={() => setPaymentMethod(m as any)} className={`py-2 rounded text-xs font-bold ${paymentMethod === m ? 'bg-amber-500 text-black' : 'bg-gray-700'}`}>
                                    {m === 'CASH' ? '💵' : m === 'CARD' ? '💳' : m === 'MOBILE_PAY' ? '📱' : '🏦'}
                                </button>
                            ))}
                        </div>

                        {/* Totales */}
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-700">
                            {paymentMethod === 'CASH' && (
                                <div className="mb-2 border-b border-gray-700 pb-2">
                                    <label className="text-xs text-gray-400">Recibido:</label>
                                    <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-1 text-right text-white font-bold" />
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold"><span>Total</span> <span>${finalTotal.toFixed(2)}</span></div>
                            {paymentMethod === 'CASH' && changeAmount > 0 && <div className="flex justify-between text-green-400 text-sm"><span>Cambio</span> <span>${changeAmount.toFixed(2)}</span></div>}
                        </div>

                        <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-black text-xl shadow-lg disabled:opacity-50">
                            {isProcessing ? '...' : `COBRAR $${finalTotal.toFixed(2)}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal FLOTANTE Móvil */}
            {!showMobileCart && cart.length > 0 && (
                <button onClick={() => setShowMobileCart(true)} className="lg:hidden fixed bottom-6 right-6 bg-amber-500 text-black px-6 py-4 rounded-full font-bold shadow-2xl z-50 animate-bounce">
                    🛒 ${cartTotal.toFixed(2)}
                </button>
            )}

            {/* MODAL MODIFICADORES MEJORADO */}
            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] shadow-2xl border border-gray-700">
                        {/* Header Modal */}
                        <div className="p-5 border-b border-gray-700 flex justify-between items-start bg-gray-850">
                            <div>
                                <h3 className="text-2xl font-bold text-white leading-none">{selectedItemForModifier.name}</h3>
                                <p className="text-amber-500 font-bold text-xl mt-1">${selectedItemForModifier.price.toFixed(2)}</p>
                            </div>
                            <button onClick={() => setShowModifierModal(false)} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                        </div>

                        {/* Body Scrollable */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {selectedItemForModifier.modifierGroups?.map((groupRel, idx) => {
                                const group = groupRel.modifierGroup;
                                const currentCount = currentModifiers.filter(m => m.groupId === group.id).length;
                                const isValid = !group.isRequired || currentCount >= group.minSelections;

                                return (
                                    <div key={group.id} className={`p-4 rounded-xl border-2 ${isValid ? 'border-gray-700 bg-gray-750' : 'border-red-500/50 bg-red-900/10'}`}>
                                        <div className="flex justify-between mb-3">
                                            <h4 className="font-bold text-lg text-amber-100">{group.name}</h4>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${isValid ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                {currentCount} / {group.maxSelections}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {group.modifiers.map(mod => {
                                                const isSelected = currentModifiers.some(m => m.id === mod.id && m.groupId === group.id);
                                                return (
                                                    <button
                                                        key={mod.id}
                                                        onClick={() => toggleModifier(group, mod)}
                                                        className={`flex justify-between items-center p-3 rounded-lg border transition-all ${isSelected ? 'bg-amber-500 text-black border-amber-500 font-bold' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                                                    >
                                                        <span>{mod.name}</span>
                                                        {isSelected && <span>✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {group.minSelections > 0 && currentCount < group.minSelections && (
                                            <p className="text-red-400 text-xs mt-2 text-right">Selecciona al menos {group.minSelections}</p>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Notas y Cantidad */}
                            <div className="bg-gray-750 p-4 rounded-xl border border-gray-700">
                                <label className="text-sm text-gray-400 uppercase font-bold block mb-2">Notas de Cocina</label>
                                <textarea value={itemNotes} onChange={e => setItemNotes(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white h-20 resize-none focus:border-amber-500 outline-none" placeholder="Sin cebolla, extra picante..." />
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

                        {/* Footer Actions */}
                        <div className="p-5 border-t border-gray-700 bg-gray-850 flex gap-3">
                            <button onClick={() => setShowModifierModal(false)} className="flex-1 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600">Cancelar</button>
                            <button
                                onClick={confirmAddToCart}
                                disabled={selectedItemForModifier?.modifierGroups.some(g => !isGroupValid(g.modifierGroup))}
                                className="flex-[2] py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black rounded-xl font-black text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                AGREGAR AL CARRITO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal PIN (Simplificado visualmente para ahorrar espacio código, funcionalmente igual) */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
                    <div className="bg-gray-800 p-6 rounded-2xl w-80">
                        <h3 className="text-center font-bold text-xl mb-4">PIN Gerente</h3>
                        <div className="bg-black p-4 rounded text-center text-3xl tracking-widest mb-4">{pinInput.replace(/./g, '*')}</div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => <button key={n} onClick={() => handlePinKey(n.toString())} className="bg-gray-700 p-4 rounded font-bold text-xl">{n}</button>)}
                            <button onClick={() => handlePinKey('clear')} className="bg-red-900 text-red-200 rounded font-bold">C</button>
                            <button onClick={() => handlePinKey('back')} className="bg-gray-600 rounded font-bold">⌫</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowPinModal(false)} className="flex-1 py-3 bg-gray-700 rounded">Cancelar</button>
                            <button onClick={handlePinSubmit} className="flex-1 py-3 bg-amber-500 text-black rounded font-bold">OK</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
