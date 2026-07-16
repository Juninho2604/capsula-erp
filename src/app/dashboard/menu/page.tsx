'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus as PlusIcon,
    Search,
    AlertTriangle,
    Check,
    X as XIcon,
    Pencil,
    RefreshCw,
    Tag as TagIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
    createMenuCategoryAction,
    updateMenuCategoryAction,
    deleteMenuCategoryAction,
} from '@/app/actions/menu.actions';
import { getAreasAction } from '@/app/actions/areas.actions';
import { calcPedidosYaPrice } from '@/lib/pedidosya-price';
import { updateMenuItemPedidosYaPriceAction } from '@/app/actions/pedidosya.actions';
import { updateMenuItemWinkPriceAction, canEditWinkPriceAction } from '@/app/actions/wink.actions';
import toast from 'react-hot-toast';

export default function MenuManagementPage() {
    const router = useRouter();
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

    // ── Gestión de categorías (§89 — configurables por el comercio) ──
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [savingCategory, setSavingCategory] = useState(false);
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editingCatName, setEditingCatName] = useState('');

    const handleCreateCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        setSavingCategory(true);
        const res = await createMenuCategoryAction({ name });
        setSavingCategory(false);
        if (res.success && res.data) {
            setCategories((prev) => [...prev, { ...(res.data as any), items: [] }]);
            setNewCategoryName('');
            toast.success(`Categoría "${name}" creada`);
        } else {
            toast.error(res.message || 'Error creando categoría');
        }
    };

    const handleRenameCategory = async (id: string) => {
        const name = editingCatName.trim();
        if (!name) return;
        const res = await updateMenuCategoryAction(id, { name });
        if (res.success) {
            setCategories((prev) => prev.map((c: any) => (c.id === id ? { ...c, name } : c)));
            setEditingCatId(null);
            toast.success('Categoría actualizada');
        } else {
            toast.error(res.message || 'Error actualizando');
        }
    };

    const handleDeleteCategory = async (id: string, name: string, itemCount: number) => {
        if (itemCount > 0) {
            toast.error(`"${name}" tiene ${itemCount} producto(s). Movelos o eliminalos antes de borrar la categoría.`);
            return;
        }
        if (!confirm(`¿Eliminar la categoría "${name}"?`)) return;
        const res = await deleteMenuCategoryAction(id);
        if (res.success) {
            setCategories((prev) => prev.filter((c: any) => c.id !== id));
            toast.success('Categoría eliminada');
        } else {
            toast.error(res.message || 'Error eliminando');
        }
    };

    // Estado para edición inline de nombre
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState('');

    // Filtro sin receta
    const [showOnlyNoRecipe, setShowOnlyNoRecipe] = useState(false);
    const [creatingRecipeFor, setCreatingRecipeFor] = useState<string | null>(null);

    // ¿Puede editar precios WINK? (solo gerentes — EDIT_WINK_PRICE)
    const [canEditWink, setCanEditWink] = useState(false);
    useEffect(() => {
        canEditWinkPriceAction().then(setCanEditWink).catch(() => setCanEditWink(false));
    }, []);

    const handlePedidosYaPriceChange = async (itemId: string, raw: string) => {
        const trimmed = raw.trim();
        const value = trimmed === '' ? null : parseFloat(trimmed);
        if (value !== null && (isNaN(value) || value < 0)) return;

        // Optimista
        setCategories(prev => prev.map(cat => ({
            ...cat,
            items: cat.items.map((item: any) =>
                item.id === itemId ? { ...item, pedidosYaPrice: value } : item
            ),
        })));

        const res = await updateMenuItemPedidosYaPriceAction(itemId, value);
        if (!res.success) {
            toast.error(res.message || 'No se pudo actualizar el precio PedidosYA');
            loadData(); // revertir desde el servidor
        }
    };

    const handleWinkPriceChange = async (itemId: string, raw: string) => {
        const trimmed = raw.trim();
        const value = trimmed === '' ? null : parseFloat(trimmed);
        if (value !== null && (isNaN(value) || value < 0)) return;

        // Optimista
        setCategories(prev => prev.map(cat => ({
            ...cat,
            items: cat.items.map((item: any) =>
                item.id === itemId ? { ...item, winkPrice: value } : item
            ),
        })));

        const res = await updateMenuItemWinkPriceAction(itemId, value);
        if (!res.success) {
            toast.error(res.message || 'No se pudo actualizar el precio WINK');
            loadData(); // revertir desde el servidor
        }
    };

    // Cargar datos
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Intentar asegurar categorías primero. Si falla, seguimos
            // igual — el usuario verá el menú vacío con opción de crear
            // categorías manualmente en lugar de loading infinito.
            await ensureBasicCategoriesAction();

            const result = await getFullMenuAction();
            if (result.success && result.data) {
                setCategories(result.data);
                // Pre-seleccionar primera categoría para el modal
                if (result.data.length > 0 && !newItem.categoryId) {
                    setNewItem(prev => ({ ...prev, categoryId: result.data[0].id }));
                }
            }
        } catch (err) {
            console.error('[menu/page] loadData failed:', err);
        } finally {
            setIsLoading(false);
        }
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
            // §120: llevar directo al editor de la receta recién creada para
            // completar los ingredientes "ahí mismo" (pedido del gerente),
            // en vez de dejar al usuario buscándola en el módulo Recetas.
            const newRecipeId = (result.data as any)?.recipeId;
            if (newRecipeId) {
                router.push(`/dashboard/recetas/${newRecipeId}/editar`);
                return;
            }
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
        return (
            <div className="p-8 text-center text-capsula-ink-muted">
                Cargando menú...
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Gestión de menú</h1>
                    <p className="mt-1 text-sm text-capsula-ink-soft">Administra precios, productos y disponibilidad</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="pos-btn-secondary px-5 py-3 text-sm inline-flex items-center gap-2"
                        title="Crear, renombrar y eliminar categorías del menú"
                    >
                        <Pencil className="h-4 w-4" /> Categorías
                    </button>
                    <a
                        href="/dashboard/menu/listas-precios"
                        className="pos-btn-secondary px-5 py-3 text-sm inline-flex items-center gap-2"
                        title="Precios por canal: delivery, wink, restaurante"
                    >
                        <TagIcon className="h-4 w-4" /> Listas de precios
                    </a>
                    <button
                        onClick={() => {
                            setResaleItem(prev => ({
                                ...prev,
                                categoryId: prev.categoryId || categories[0]?.id || '',
                                areaId: prev.areaId || areas[0]?.id || '',
                            }));
                            setShowResaleModal(true);
                        }}
                        className="pos-btn-secondary px-5 py-3 text-sm inline-flex items-center gap-2"
                        title="Crear un producto que se compra y se revende tal cual (bebidas, snacks, etc). Carga inventario + menú + receta en un solo paso."
                    >
                        <PlusIcon className="h-4 w-4" /> Producto de reventa
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="pos-btn px-5 py-3 text-sm inline-flex items-center gap-2"
                        title="Crear un plato preparado (con receta multi-ingrediente que se completa después)"
                    >
                        <PlusIcon className="h-4 w-4" /> Plato preparado
                    </button>
                </div>
            </div>

            {/* Barra de búsqueda + filtros */}
            <div className="mb-6 flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-capsula-ink-muted pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar plato..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pos-input w-full pl-10"
                    />
                </div>
                <button
                    onClick={() => setShowOnlyNoRecipe(!showOnlyNoRecipe)}
                    className={cn(
                        "px-4 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-all border",
                        showOnlyNoRecipe
                            ? "bg-[#F7E3DB] text-[#B04A2E] border-[#EFD2C8] dark:bg-[#3B1F14] dark:text-[#EFD2C8] dark:border-[#5A2E1F]"
                            : "bg-capsula-ivory-surface border-capsula-line text-capsula-ink-muted hover:border-capsula-coral/40"
                    )}
                >
                    <AlertTriangle className="h-4 w-4" />
                    Sin Receta
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums",
                        itemsWithoutRecipe > 0
                            ? "bg-capsula-coral text-capsula-cream"
                            : "bg-capsula-navy-soft text-capsula-ink-muted"
                    )}>
                        {itemsWithoutRecipe}
                    </span>
                </button>
            </div>

            {/* Lista por Categorías */}
            <div className="space-y-6">
                {filteredCategories.map(category => (
                    <div key={category.id} className="bg-capsula-ivory-surface border border-capsula-line rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 bg-capsula-ivory-alt border-b border-capsula-line flex items-center gap-3">
                            <h2 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">{category.name}</h2>
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted ml-auto tabular-nums">
                                {category.items.length} {category.items.length === 1 ? 'item' : 'items'}
                            </span>
                        </div>

                        <div className="divide-y divide-capsula-line">
                            {category.items.map((item: any) => (
                                <div key={item.id} className={cn(
                                    "flex items-center justify-between p-4 transition-colors hover:bg-capsula-ivory-alt",
                                    !item.isActive && "opacity-50"
                                )}>
                                    <div className="flex-1 min-w-0">
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
                                                    className="bg-capsula-ivory border border-capsula-coral rounded-lg px-2 py-1 text-base font-semibold text-capsula-ink focus:outline-none w-full max-w-md"
                                                />
                                            ) : (
                                                <>
                                                    <div className="font-semibold text-base text-capsula-ink truncate">{item.name}</div>
                                                    <button
                                                        onClick={() => {
                                                            setEditingNameId(item.id);
                                                            setEditingNameValue(item.name);
                                                        }}
                                                        className="text-capsula-ink-muted hover:text-capsula-coral transition-colors p-1 rounded-full hover:bg-capsula-coral/10"
                                                        title="Editar nombre"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-xs text-capsula-ink-muted mt-0.5 truncate">
                                            {item.description || 'Sin descripción'}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap justify-end shrink-0">
                                        {/* Receta Status — 3 estados */}
                                        {(() => {
                                            const rs = getRecipeStatus(item);
                                            // §120: reventa 1:1 (Pepsi, agua…) — su receta es técnica
                                            // (descuenta 1 unidad de stock por venta). NO se ofrece
                                            // edición: editarla dañaría el descargo de inventario.
                                            const isResale = item._recipeOutputType === 'RAW_MATERIAL';
                                            if (rs === 'COMPLETE' && isResale) return (
                                                <span
                                                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]"
                                                    title="Producto de reventa — vender 1 descuenta 1 del stock automáticamente. Sin receta que completar."
                                                >
                                                    <Check className="h-3 w-3" /> Reventa 1:1
                                                </span>
                                            );
                                            if (rs === 'COMPLETE') return (
                                                <a
                                                    href={`/dashboard/recetas/${item.recipeId}`}
                                                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 transition-colors bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F] hover:opacity-80"
                                                    title="Ver / editar la receta de este plato"
                                                >
                                                    <Check className="h-3 w-3" /> Receta lista
                                                </a>
                                            );
                                            if (rs === 'STUB') return (
                                                <a
                                                    href={`/dashboard/recetas/${item.recipeId}/editar`}
                                                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 transition-colors bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8] hover:opacity-80"
                                                    title="Receta creada pero sin ingredientes — click para completarla"
                                                >
                                                    <AlertTriangle className="h-3 w-3" /> Receta vacía
                                                </a>
                                            );
                                            return (
                                                <button
                                                    onClick={() => handleCreateRecipeStub(item.id)}
                                                    disabled={creatingRecipeFor === item.id}
                                                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 transition-colors bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8] hover:opacity-80 disabled:opacity-50"
                                                    title="Sin receta — click para crearla y completar sus ingredientes"
                                                >
                                                    {creatingRecipeFor === item.id ? (
                                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <XIcon className="h-3 w-3" />
                                                    )}
                                                    Sin receta
                                                </button>
                                            );
                                        })()}

                                        {/* Precio Editable */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-capsula-ivory rounded-lg border border-capsula-line px-3 py-1">
                                                <span className="text-capsula-coral font-semibold mr-1">$</span>
                                                <input
                                                    type="number"
                                                    defaultValue={item.price}
                                                    onBlur={(e) => handlePriceChange(item.id, e.target.value)}
                                                    className="bg-transparent w-20 text-capsula-ink font-mono font-semibold focus:outline-none tabular-nums"
                                                />
                                            </div>
                                            {/* PYA: editable solo por gerente (mismo permiso que WINK). null = precio base. */}
                                            {canEditWink ? (
                                                <div
                                                    className="flex items-center bg-capsula-ivory rounded-lg border border-capsula-coral/40 px-2 py-1 gap-1"
                                                    title="Precio PedidosYA — vacío usa el precio del restaurante. Solo gerentes."
                                                >
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-capsula-coral">PYA $</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        defaultValue={item.pedidosYaPrice ?? ''}
                                                        placeholder={item.price.toFixed(2)}
                                                        onBlur={(e) => handlePedidosYaPriceChange(item.id, e.target.value)}
                                                        className="bg-transparent w-16 text-capsula-ink font-mono font-semibold text-xs focus:outline-none tabular-nums placeholder:text-capsula-ink-muted placeholder:font-normal"
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center bg-capsula-ivory-alt rounded-lg border border-capsula-line px-2 py-1 gap-1"
                                                    title="Precio PedidosYA"
                                                >
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-capsula-ink-muted">PYA</span>
                                                    <span className="text-capsula-ink-soft font-mono font-semibold text-xs tabular-nums">
                                                        ${(item.pedidosYaPrice ?? calcPedidosYaPrice(item.price)).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            {/* WINK: editable solo por gerente (EDIT_WINK_PRICE). null = usa precio base. */}
                                            {canEditWink ? (
                                                <div
                                                    className="flex items-center bg-capsula-ivory rounded-lg border border-capsula-coral/40 px-2 py-1 gap-1"
                                                    title="Precio WINK — vacío usa el precio base. Solo gerentes."
                                                >
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-capsula-coral">WINK $</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        defaultValue={item.winkPrice ?? ''}
                                                        placeholder={item.price.toFixed(2)}
                                                        onBlur={(e) => handleWinkPriceChange(item.id, e.target.value)}
                                                        className="bg-transparent w-16 text-capsula-ink font-mono font-semibold text-xs focus:outline-none tabular-nums placeholder:text-capsula-ink-muted placeholder:font-normal"
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center bg-capsula-ivory-alt rounded-lg border border-capsula-line px-2 py-1 gap-1"
                                                    title="Precio WINK"
                                                >
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-capsula-ink-muted">WINK</span>
                                                    <span className="text-capsula-ink-soft font-mono font-semibold text-xs tabular-nums">
                                                        ${(item.winkPrice ?? item.price).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Switch Activo/Inactivo */}
                                        <button
                                            onClick={() => handleToggleStatus(item.id, item.isActive)}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors",
                                                item.isActive
                                                    ? "bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]"
                                                    : "bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]"
                                            )}
                                        >
                                            {item.isActive ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {category.items.length === 0 && (
                                <div className="p-8 text-center text-sm text-capsula-ink-muted">
                                    No hay productos en esta categoría
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Nuevo Producto */}
            {showModal && (
                <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
                        <div className="border-b border-capsula-line p-5 flex items-center justify-between">
                            <h2 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Nuevo plato preparado</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center transition"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                    Nombre
                                </label>
                                <input
                                    autoFocus
                                    className="pos-input w-full"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    placeholder="Ej. Shawarma Mixto"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                        Precio ($)
                                    </label>
                                    <input
                                        type="number"
                                        className="pos-input w-full font-mono"
                                        value={newItem.price}
                                        onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                            Categoría
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowCategoryModal(true)}
                                            className="text-[10px] font-semibold text-capsula-coral hover:underline inline-flex items-center gap-0.5"
                                        >
                                            <PlusIcon className="h-3 w-3" /> Nueva
                                        </button>
                                    </div>
                                    <select
                                        className="pos-input w-full"
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
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">
                                    Descripción (opcional)
                                </label>
                                <textarea
                                    className="pos-input w-full h-20 resize-none"
                                    value={newItem.description}
                                    onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                    placeholder="Ingredientes..."
                                />
                            </div>
                        </div>

                        <div className="border-t border-capsula-line p-4 flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                disabled={isSaving}
                                className="pos-btn-secondary flex-1 py-3"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateItem}
                                disabled={isSaving || !newItem.name || !newItem.price}
                                className="pos-btn flex-[2] py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Crear plato
                                    </>
                                )}
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
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                            Categoría del menú *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowCategoryModal(true)}
                                            className="text-[10px] font-semibold text-capsula-coral hover:underline inline-flex items-center gap-0.5"
                                        >
                                            <PlusIcon className="h-3 w-3" /> Nueva
                                        </button>
                                    </div>
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

            {/* Modal Gestión de Categorías (§89) */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="border-b border-capsula-line p-5 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Categorías del menú</h3>
                                <p className="text-xs text-capsula-ink-muted mt-0.5">Crea, renombra y elimina las categorías de tu carta.</p>
                            </div>
                            <button
                                onClick={() => { setShowCategoryModal(false); setEditingCatId(null); }}
                                className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center shrink-0"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-2 overflow-y-auto">
                            {categories.length === 0 && (
                                <p className="text-sm text-capsula-ink-muted text-center py-4">Aún no hay categorías. Crea la primera abajo.</p>
                            )}
                            {categories.map((cat: any) => {
                                const itemCount = (cat.items ?? []).length;
                                return (
                                    <div key={cat.id} className="flex items-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2">
                                        {editingCatId === cat.id ? (
                                            <>
                                                <input
                                                    value={editingCatName}
                                                    onChange={(e) => setEditingCatName(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(cat.id); }}
                                                    autoFocus
                                                    className="flex-1 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-1.5 text-sm"
                                                />
                                                <button onClick={() => handleRenameCategory(cat.id)} className="p-1.5 rounded-lg text-[#2F6B4E] dark:text-[#6FB88F] hover:bg-capsula-navy-soft" title="Guardar">
                                                    <Check className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => setEditingCatId(null)} className="p-1.5 rounded-lg text-capsula-ink-muted hover:bg-capsula-ivory-alt" title="Cancelar">
                                                    <XIcon className="h-4 w-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-capsula-ink truncate">{cat.name}</p>
                                                    <p className="text-[10px] text-capsula-ink-faint">{itemCount} producto(s)</p>
                                                </div>
                                                <button
                                                    onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                                                    className="p-1.5 rounded-lg text-capsula-ink-muted hover:text-capsula-navy-deep hover:bg-capsula-navy-soft"
                                                    title="Renombrar"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCategory(cat.id, cat.name, itemCount)}
                                                    className={`p-1.5 rounded-lg ${itemCount > 0 ? 'text-capsula-ink-faint cursor-not-allowed' : 'text-capsula-ink-muted hover:text-capsula-coral hover:bg-capsula-coral/10'}`}
                                                    title={itemCount > 0 ? 'Tiene productos: movelos primero' : 'Eliminar'}
                                                >
                                                    <XIcon className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="border-t border-capsula-line p-4 shrink-0">
                            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Nueva categoría</label>
                            <div className="flex gap-2">
                                <input
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); }}
                                    placeholder="Ej: Entradas, Cócteles, Postres…"
                                    className="flex-1 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-3 py-2 text-sm"
                                />
                                <button
                                    onClick={handleCreateCategory}
                                    disabled={!newCategoryName.trim() || savingCategory}
                                    className="pos-btn px-4 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <PlusIcon className="h-4 w-4" /> {savingCategory ? '…' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
