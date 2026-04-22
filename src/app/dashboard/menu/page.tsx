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
    createRecipeStubForMenuItemAction
} from '@/app/actions/menu.actions';
import { calcPedidosYaPrice } from '@/lib/pedidosya-price';

export default function MenuManagementPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Estado para Modal Nuevo Producto
    const [showModal, setShowModal] = useState(false);
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        categoryId: '',
        description: ''
    });
    const [isSaving, setIsSaving] = useState(false);

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
        return <div className="p-8 text-center text-capsula-ivory-surface">Cargando menú...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto text-capsula-ivory-surface">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                        Gestión de Menú
                    </h1>
                    <p className="text-capsula-ink-muted">Administra precios, productos y disponibilidad</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-capsula-navy-deep hover:bg-capsula-navy-ink text-capsula-ivory-surface px-6 py-3 rounded-xl font-medium shadow-cap-soft transition-all flex items-center gap-2"
                >
                    <span className="text-xl">+</span> Nuevo Plato
                </button>
            </div>

            {/* Barra de búsqueda + filtros */}
            <div className="mb-6 flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <span className="absolute left-4 top-3 text-capsula-ink-soft">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar plato..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-capsula-ivory-surface border border-capsula-line rounded-xl py-3 pl-12 pr-4 text-capsula-ivory-surface focus:outline-none focus:border-capsula-navy-deep transition-colors"
                    />
                </div>
                <button
                    onClick={() => setShowOnlyNoRecipe(!showOnlyNoRecipe)}
                    className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all border ${showOnlyNoRecipe ? 'bg-capsula-coral/10 border-capsula-coral text-capsula-coral' : 'bg-capsula-ivory-surface border-capsula-line text-capsula-ink-muted hover:border-capsula-coral/50'}`}
                >
                    ⚠️ Sin Receta
                    <span className={`px-2 py-0.5 rounded-full text-xs ${itemsWithoutRecipe > 0 ? 'bg-capsula-coral text-capsula-ivory-surface' : 'bg-capsula-ivory-alt text-capsula-ink-soft'}`}>
                        {itemsWithoutRecipe}
                    </span>
                </button>
            </div>

            {/* Lista por Categorías */}
            <div className="space-y-8">
                {filteredCategories.map(category => (
                    <div key={category.id} className="bg-capsula-ivory-surface border border-capsula-line rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 bg-capsula-ivory-surface border-b border-capsula-line flex items-center gap-3">
                            <span className="text-2xl">{category.name.includes('Bebida') ? '🥤' : '🍽️'}</span>
                            <h2 className="text-xl font-bold text-capsula-navy-deep">{category.name}</h2>
                            <span className="text-capsula-ink-soft text-sm ml-auto">{category.items.length} items</span>
                        </div>

                        <div className="divide-y divide-gray-700">
                            {category.items.map((item: any) => (
                                <div key={item.id} className={`flex items-center justify-between p-4 hover:bg-capsula-ivory-alt/60/60 transition-colors ${!item.isActive ? 'opacity-50 grayscale' : ''}`}>
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
                                                    className="bg-capsula-ivory-alt border border-capsula-navy-deep rounded px-2 py-1 text-lg font-semibold text-capsula-ivory-surface focus:outline-none w-full max-w-md"
                                                />
                                            ) : (
                                                <>
                                                    <div className="font-semibold text-lg">{item.name}</div>
                                                    <button
                                                        onClick={() => {
                                                            setEditingNameId(item.id);
                                                            setEditingNameValue(item.name);
                                                        }}
                                                        className="text-capsula-ink-soft hover:text-[#946A1C] transition-colors text-sm"
                                                        title="Editar nombre"
                                                    >
                                                        ✏️
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-sm text-capsula-ink-muted">{item.description || 'Sin descripción'}</div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap justify-end">
                                        {/* Receta Status — 3 estados */}
                                        {(() => {
                                            const rs = getRecipeStatus(item);
                                            if (rs === 'COMPLETE') return (
                                                <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#E5EDE7]/60 text-[#2F6B4E] border border-[#2F6B4E]/30 flex items-center gap-1">
                                                    ✅ Receta lista
                                                </span>
                                            );
                                            if (rs === 'STUB') return (
                                                <a
                                                    href={`/dashboard/recetas`}
                                                    className="px-2 py-1 rounded-full text-xs font-bold bg-[#F3EAD6]/60 text-[#946A1C] border border-[#946A1C]/30 hover:bg-[#F3EAD6]/80 transition-colors flex items-center gap-1"
                                                    title="Receta creada pero sin ingredientes — complétala en Recetas"
                                                >
                                                    🟡 Receta vacía
                                                </a>
                                            );
                                            return (
                                                <button
                                                    onClick={() => handleCreateRecipeStub(item.id)}
                                                    disabled={creatingRecipeFor === item.id}
                                                    className="px-2 py-1 rounded-full text-xs font-bold bg-capsula-coral/10 text-capsula-coral border border-capsula-coral/30 hover:bg-capsula-coral/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    title="Sin receta — click para crear estructura vacía"
                                                >
                                                    {creatingRecipeFor === item.id ? '⏳' : '❌'} Sin receta
                                                </button>
                                            );
                                        })()}

                                        {/* Precio Editable */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-capsula-ivory-alt rounded-lg border border-capsula-line px-3 py-1">
                                                <span className="text-[#946A1C] font-bold mr-1">$</span>
                                                <input
                                                    type="number"
                                                    defaultValue={item.price}
                                                    onBlur={(e) => handlePriceChange(item.id, e.target.value)}
                                                    className="bg-transparent w-20 text-capsula-ivory-surface font-mono font-bold focus:outline-none"
                                                />
                                            </div>
                                            <div className="flex items-center bg-capsula-coral/5 rounded-lg border border-capsula-coral/30 px-2 py-1 gap-1" title="Precio PedidosYA (~-33%)">
                                                <span className="text-capsula-coral text-xs">PYA</span>
                                                <span className="text-capsula-coral font-mono font-bold text-xs">${(item.pedidosYaPrice ?? calcPedidosYaPrice(item.price)).toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Switch Activo/Inactivo */}
                                        <button
                                            onClick={() => handleToggleStatus(item.id, item.isActive)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${item.isActive ? 'bg-[#E5EDE7]/60 text-[#2F6B4E] border border-[#2F6B4E]/30' : 'bg-capsula-coral/10 text-capsula-coral border border-capsula-coral/30'}`}
                                        >
                                            {item.isActive ? 'ACTIVO' : 'INACTIVO'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {category.items.length === 0 && (
                                <div className="p-8 text-center text-capsula-ink-soft">
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
                    <div className="bg-capsula-ivory-surface rounded-2xl w-full max-w-md p-6 border border-capsula-line shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Nuevo Producto</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-capsula-ink-muted mb-1">Nombre</label>
                                <input
                                    autoFocus
                                    className="w-full bg-capsula-ivory-alt border border-capsula-line rounded-lg p-3 focus:border-capsula-navy-deep focus:outline-none"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    placeholder="Ej. Shawarma Mixto"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-capsula-ink-muted mb-1">Precio ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-capsula-ivory-alt border border-capsula-line rounded-lg p-3 focus:border-capsula-navy-deep focus:outline-none font-mono"
                                        value={newItem.price}
                                        onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-capsula-ink-muted mb-1">Categoría</label>
                                    <select
                                        className="w-full bg-capsula-ivory-alt border border-capsula-line rounded-lg p-3 focus:border-capsula-navy-deep focus:outline-none"
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
                                <label className="block text-sm text-capsula-ink-muted mb-1">Descripción (Opcional)</label>
                                <textarea
                                    className="w-full bg-capsula-ivory-alt border border-capsula-line rounded-lg p-3 focus:border-capsula-navy-deep focus:outline-none resize-none h-24"
                                    value={newItem.description}
                                    onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                    placeholder="Ingredientes..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 bg-capsula-ivory-alt hover:bg-capsula-ivory-alt rounded-xl font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateItem}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-capsula-navy-deep hover:bg-capsula-navy-ink rounded-xl font-bold flex justify-center items-center"
                            >
                                {isSaving ? 'Guardando...' : 'Crear Plato'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
