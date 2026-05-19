'use client';

import { useState, useEffect } from 'react';
import {
    getFullMenuAction,
    updateMenuItemPriceAction,
    updateMenuItemNameAction,
    createMenuItemAction,
    toggleMenuItemStatusAction,
    ensureBasicCategoriesAction,
    getCategoriesAction,
    createRecipeStubForMenuItemAction,
    createResaleProductAction,
} from '@/app/actions/menu.actions';
import { getAreasAction } from '@/app/actions/areas.actions';
import { calcPedidosYaPrice } from '@/lib/pedidosya-price';

export default function MenuManagementPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Estado para Modal Nuevo Producto (plato preparado — el original)
    const [showModal, setShowModal] = useState(false);
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        categoryId: '',
        description: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // Estado para Modal "Producto de reventa rápido" (Pepsi, agua, etc.) —
    // crea MenuItem + InventoryItem + Recipe 1:1 + stock inicial en UN SOLO
    // formulario.
    const [showResaleModal, setShowResaleModal] = useState(false);
    const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
    const [resaleItem, setResaleItem] = useState({
        name: '',
        categoryId: '',
        salePrice: '',
        unitCost: '',
        initialStock: '',
        baseUnit: 'UNIT',
        areaId: '',
        description: '',
    });
    const [isSavingResale, setIsSavingResale] = useState(false);

    // Estado para edición inline de nombre
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState('');

    // Filtro sin receta
    const [showOnlyNoRecipe, setShowOnlyNoRecipe] = useState(false);
    const [creatingRecipeFor, setCreatingRecipeFor] = useState<string | null>(null);

    // Cargar datos
    const loadData = async () => {
        setIsLoading(true);
        // Intentar asegurar categorías primero
        await ensureBasicCategoriesAction();

        const result = await getFullMenuAction();
        if (result.success && result.data) {
            setCategories(result.data);
            // Pre-seleccionar primera categoría para el modal
            if (result.data.length > 0 && !newItem.categoryId) {
                setNewItem(prev => ({ ...prev, categoryId: result.data[0].id }));
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
        // Cargar áreas para el modal de producto de reventa
        (async () => {
            const res = await getAreasAction();
            if (res.success && res.data) {
                setAreas(res.data);
                if (res.data.length > 0) {
                    setResaleItem(prev => ({ ...prev, areaId: res.data![0].id }));
                }
            }
        })();
    }, []);

    // Manejadores
    const handlePriceChange = async (itemId: string, newPrice: string) => {
        const price = parseFloat(newPrice);
        if (isNaN(price)) return;

        // Actualización optimista
        const newCats = categories.map(cat => ({
            ...cat,
            items: cat.items.map((item: any) =>
                item.id === itemId ? { ...item, price } : item
            )
        }));
        setCategories(newCats); // Reflejar en UI inmediato

        // Persistir (debounce idealmente, pero directo por ahora)
        await updateMenuItemPriceAction(itemId, price);
    };

    const handleNameChange = async (itemId: string, newName: string) => {
        if (!newName.trim()) return;
        setEditingNameId(null);

        // Actualización optimista
        const newCats = categories.map(cat => ({
            ...cat,
            items: cat.items.map((item: any) =>
                item.id === itemId ? { ...item, name: newName.trim() } : item
            )
        }));
        setCategories(newCats);

        await updateMenuItemNameAction(itemId, newName.trim());
    };

    const handleCreateItem = async () => {
        if (!newItem.name || !newItem.price || !newItem.categoryId) {
            alert('Por favor completa nombre, precio y categoría');
            return;
        }

        setIsSaving(true);
        const result = await createMenuItemAction({
            name: newItem.name,
            price: parseFloat(newItem.price),
            categoryId: newItem.categoryId,
            description: newItem.description
        });

        if (result.success) {
            setShowModal(false);
            setNewItem({ name: '', price: '', categoryId: categories[0]?.id || '', description: '' });
            loadData(); // Recargar todo
        } else {
            alert('Error al crear producto');
        }
        setIsSaving(false);
    };

    // Crea producto de reventa en un solo paso (MenuItem + InventoryItem +
    // Recipe 1:1 + stock inicial). Para personas no técnicas.
    const handleCreateResaleProduct = async () => {
        if (!resaleItem.name.trim()) { alert('Falta el nombre del producto.'); return; }
        if (!resaleItem.categoryId) { alert('Falta la categoría del menú.'); return; }
        if (!resaleItem.areaId) { alert('Falta el área de stock.'); return; }
        const salePrice = parseFloat(resaleItem.salePrice);
        const unitCost = parseFloat(resaleItem.unitCost || '0');
        const initialStock = parseFloat(resaleItem.initialStock || '0');
        if (!(salePrice > 0)) { alert('El precio de venta debe ser mayor a 0.'); return; }
        if (unitCost < 0 || isNaN(unitCost)) { alert('Costo unitario inválido.'); return; }
        if (initialStock < 0 || isNaN(initialStock)) { alert('Stock inicial inválido.'); return; }

        setIsSavingResale(true);
        const result = await createResaleProductAction({
            name: resaleItem.name.trim(),
            categoryId: resaleItem.categoryId,
            salePrice,
            unitCost,
            initialStock,
            baseUnit: resaleItem.baseUnit,
            areaId: resaleItem.areaId,
            description: resaleItem.description.trim() || undefined,
        });
        if (result.success) {
            setShowResaleModal(false);
            setResaleItem({
                name: '',
                categoryId: categories[0]?.id || '',
                salePrice: '',
                unitCost: '',
                initialStock: '',
                baseUnit: 'UNIT',
                areaId: areas[0]?.id || '',
                description: '',
            });
            loadData();
            alert(result.message);
        } else {
            alert(result.message);
        }
        setIsSavingResale(false);
    };

    const handleToggleStatus = async (itemId: string, currentStatus: boolean) => {
        await toggleMenuItemStatusAction(itemId, !currentStatus);
        loadData();
    };

    const handleCreateRecipeStub = async (itemId: string) => {
        setCreatingRecipeFor(itemId);
        const result = await createRecipeStubForMenuItemAction(itemId);
        if (result.success) {
            loadData();
        } else {
            alert(result.message);
        }
        setCreatingRecipeFor(null);
    };

    // Helper: estado de receta 3 niveles
    const getRecipeStatus = (item: any): 'COMPLETE' | 'STUB' | 'NONE' => {
        if (!item.recipeId) return 'NONE';
        return (item._recipeIngredientCount ?? 0) > 0 ? 'COMPLETE' : 'STUB';
    };

    // Conteo de items sin receta completa (NONE + STUB)
    const itemsWithoutRecipe = categories.flatMap(c => c.items).filter((i: any) => getRecipeStatus(i) !== 'COMPLETE').length;

    // Filtrado de búsqueda + filtro sin receta
    const filteredCategories = categories.map(cat => ({
        ...cat,
        items: cat.items.filter((item: any) => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRecipeFilter = !showOnlyNoRecipe || getRecipeStatus(item) !== 'COMPLETE';
            return matchesSearch && matchesRecipeFilter;
        })
    })).filter(cat => cat.items.length > 0);

    if (isLoading) {
        return <div className="p-8 text-center text-white">Cargando menú...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Gestión de menú</h1>
                    <p className="mt-1 text-sm text-capsula-ink-soft">Administra precios, productos y disponibilidad</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => {
                            setResaleItem(prev => ({
                                ...prev,
                                categoryId: prev.categoryId || categories[0]?.id || '',
                                areaId: prev.areaId || areas[0]?.id || '',
                            }));
                            setShowResaleModal(true);
                        }}
                        className="bg-capsula-navy-deep hover:bg-capsula-navy text-capsula-cream px-5 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2"
                        title="Crear un producto que se compra y se revende tal cual (bebidas, snacks, etc). Carga inventario + menú + receta en un solo paso."
                    >
                        <span className="text-xl">+</span> Producto de reventa
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                        title="Crear un plato preparado (con receta multi-ingrediente que se completa después)"
                    >
                        <span className="text-xl">+</span> Plato preparado
                    </button>
                </div>
            </div>

            {/* Barra de búsqueda + filtros */}
            <div className="mb-6 flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <span className="absolute left-4 top-3 text-gray-500"></span>
                    <input
                        type="text"
                        placeholder="Buscar plato..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                </div>
                <button
                    onClick={() => setShowOnlyNoRecipe(!showOnlyNoRecipe)}
                    className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all border ${showOnlyNoRecipe ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-red-500/50'}`}
                >
                    ⚠️ Sin Receta
                    <span className={`px-2 py-0.5 rounded-full text-xs ${itemsWithoutRecipe > 0 ? 'bg-red-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                        {itemsWithoutRecipe}
                    </span>
                </button>
            </div>

            {/* Lista por Categorías */}
            <div className="space-y-8">
                {filteredCategories.map(category => (
                    <div key={category.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
                            <span className="text-2xl">{category.name.includes('Bebida') ? '' : ''}</span>
                            <h2 className="font-semibold text-xl tracking-[-0.02em] text-gray-200">{category.name}</h2>
                            <span className="text-gray-500 text-sm ml-auto">{category.items.length} items</span>
                        </div>

                        <div className="divide-y divide-gray-700">
                            {category.items.map((item: any) => (
                                <div key={item.id} className={`flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors ${!item.isActive ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {editingNameId === item.id ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editingNameValue}
                                                    onChange={e => setEditingNameValue(e.target.value)}
                                                    onBlur={() => handleNameChange(item.id, editingNameValue)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleNameChange(item.id, editingNameValue);
                                                        if (e.key === 'Escape') setEditingNameId(null);
                                                    }}
                                                    className="bg-gray-900 border border-amber-500 rounded px-2 py-1 text-lg font-semibold text-white focus:outline-none w-full max-w-md"
                                                />
                                            ) : (
                                                <>
                                                    <div className="font-semibold text-lg">{item.name}</div>
                                                    <button
                                                        onClick={() => {
                                                            setEditingNameId(item.id);
                                                            setEditingNameValue(item.name);
                                                        }}
                                                        className="text-gray-500 hover:text-amber-400 transition-colors text-sm"
                                                        title="Editar nombre"
                                                    >
                                                        ✏️
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-400">{item.description || 'Sin descripción'}</div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap justify-end">
                                        {/* Receta Status — 3 estados */}
                                        {(() => {
                                            const rs = getRecipeStatus(item);
                                            if (rs === 'COMPLETE') return (
                                                <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                                                    ✅ Receta lista
                                                </span>
                                            );
                                            if (rs === 'STUB') return (
                                                <a
                                                    href={`/dashboard/recetas`}
                                                    className="px-2 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                                                    title="Receta creada pero sin ingredientes — complétala en Recetas"
                                                >
                                                    🟡 Receta vacía
                                                </a>
                                            );
                                            return (
                                                <button
                                                    onClick={() => handleCreateRecipeStub(item.id)}
                                                    disabled={creatingRecipeFor === item.id}
                                                    className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    title="Sin receta — click para crear estructura vacía"
                                                >
                                                    {creatingRecipeFor === item.id ? '⏳' : '❌'} Sin receta
                                                </button>
                                            );
                                        })()}

                                        {/* Precio Editable */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-gray-900 rounded-lg border border-gray-600 px-3 py-1">
                                                <span className="text-amber-500 font-bold mr-1">$</span>
                                                <input
                                                    type="number"
                                                    defaultValue={item.price}
                                                    onBlur={(e) => handlePriceChange(item.id, e.target.value)}
                                                    className="bg-transparent w-20 text-white font-mono font-bold focus:outline-none"
                                                />
                                            </div>
                                            <div className="flex items-center bg-orange-500/10 rounded-lg border border-orange-500/30 px-2 py-1 gap-1" title="Precio PedidosYA (~-33%)">
                                                <span className="text-orange-400 text-xs">PYA</span>
                                                <span className="text-orange-500 font-mono font-bold text-xs">${(item.pedidosYaPrice ?? calcPedidosYaPrice(item.price)).toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Switch Activo/Inactivo */}
                                        <button
                                            onClick={() => handleToggleStatus(item.id, item.isActive)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${item.isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                                        >
                                            {item.isActive ? 'ACTIVO' : 'INACTIVO'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {category.items.length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    No hay productos en esta categoría
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Nuevo Producto */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6 border border-gray-700 shadow-2xl">
                        <h2 className="font-semibold text-2xl tracking-[-0.02em] mb-6">Nuevo Producto</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                                <input
                                    autoFocus
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-amber-500 focus:outline-none"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    placeholder="Ej. Shawarma Mixto"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Precio ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-amber-500 focus:outline-none font-mono"
                                        value={newItem.price}
                                        onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Categoría</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-amber-500 focus:outline-none"
                                        value={newItem.categoryId}
                                        onChange={e => setNewItem({ ...newItem, categoryId: e.target.value })}
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Descripción (Opcional)</label>
                                <textarea
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-amber-500 focus:outline-none resize-none h-24"
                                    value={newItem.description}
                                    onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                    placeholder="Ingredientes..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateItem}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 rounded-xl font-bold flex justify-center items-center"
                            >
                                {isSaving ? 'Guardando...' : 'Crear Plato'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Producto de Reventa Rápido */}
            {showResaleModal && (
                <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-capsula-ivory border border-capsula-line w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="border-b border-capsula-line p-5">
                            <h2 className="font-semibold text-xl tracking-[-0.02em] text-capsula-ink">
                                Producto de reventa
                            </h2>
                            <p className="text-xs text-capsula-ink-muted mt-1">
                                Para productos que se compran y se venden tal cual (bebidas, snacks, etc).
                                Carga menú + inventario + stock inicial en un solo paso.
                            </p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                    Nombre del producto *
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={resaleItem.name}
                                    onChange={e => setResaleItem({ ...resaleItem, name: e.target.value })}
                                    className="pos-input w-full"
                                    placeholder="Ej: Pepsi 355ml"
                                    maxLength={100}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                        Categoría del menú *
                                    </label>
                                    <select
                                        value={resaleItem.categoryId}
                                        onChange={e => setResaleItem({ ...resaleItem, categoryId: e.target.value })}
                                        className="pos-input w-full"
                                    >
                                        <option value="">— Elegir —</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                        Área de stock *
                                    </label>
                                    <select
                                        value={resaleItem.areaId}
                                        onChange={e => setResaleItem({ ...resaleItem, areaId: e.target.value })}
                                        className="pos-input w-full"
                                    >
                                        <option value="">— Elegir —</option>
                                        {areas.map(area => (
                                            <option key={area.id} value={area.id}>{area.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                        Precio de venta (USD) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={resaleItem.salePrice}
                                        onChange={e => setResaleItem({ ...resaleItem, salePrice: e.target.value })}
                                        className="pos-input w-full font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                        Costo unitario (USD)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={resaleItem.unitCost}
                                        onChange={e => setResaleItem({ ...resaleItem, unitCost: e.target.value })}
                                        className="pos-input w-full font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                        Stock inicial
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={resaleItem.initialStock}
                                        onChange={e => setResaleItem({ ...resaleItem, initialStock: e.target.value })}
                                        className="pos-input w-full font-mono"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                        Unidad
                                    </label>
                                    <select
                                        value={resaleItem.baseUnit}
                                        onChange={e => setResaleItem({ ...resaleItem, baseUnit: e.target.value })}
                                        className="pos-input w-full"
                                    >
                                        <option value="UNIT">Unidad</option>
                                        <option value="L">Litro</option>
                                        <option value="ML">Mililitro</option>
                                        <option value="KG">Kilogramo</option>
                                        <option value="G">Gramo</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                    Descripción (opcional)
                                </label>
                                <textarea
                                    value={resaleItem.description}
                                    onChange={e => setResaleItem({ ...resaleItem, description: e.target.value })}
                                    className="pos-input w-full h-16 resize-none"
                                    placeholder="Notas internas, marca, presentación..."
                                />
                            </div>

                            <div className="rounded-xl bg-[#E6ECF4] dark:bg-[#1A2636] text-[#2A4060] dark:text-[#D1DCE9] p-3 text-xs">
                                <strong>Qué se va a crear automáticamente:</strong>
                                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                    <li>Producto en el menú (visible en el POS)</li>
                                    <li>Insumo en el inventario con el stock indicado</li>
                                    <li>Receta 1:1 para descontar al vender</li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-t border-capsula-line p-4 flex gap-3">
                            <button
                                onClick={() => setShowResaleModal(false)}
                                disabled={isSavingResale}
                                className="pos-btn-secondary flex-1 py-3"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateResaleProduct}
                                disabled={isSavingResale || !resaleItem.name || !resaleItem.salePrice}
                                className="pos-btn flex-[2] py-3 disabled:opacity-50"
                            >
                                {isSavingResale ? 'Creando…' : 'Crear producto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
