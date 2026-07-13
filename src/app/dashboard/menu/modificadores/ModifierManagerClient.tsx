'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, AlertTriangle, Trash2, FlaskConical, ChevronDown, ChevronRight, Plus, X as XIcon, ListTree } from 'lucide-react';
import {
    linkModifierToMenuItemAction,
    toggleModifierAvailabilityAction,
    createModifierGroupAction,
    updateModifierGroupAction,
    deleteModifierGroupAction,
    addModifierAction,
    deleteModifierAction,
    updateModifierNamePriceAction,
    linkGroupToMenuItemAction,
    unlinkGroupFromMenuItemAction,
    setModifierIngredientsAction,
    setModifierChildGroupAction,
} from '@/app/actions/modifier.actions';

interface MenuItem {
    id: string;
    name: string;
    recipeId: string | null;
    category: { name: string };
}

/** Insumo activo para el picker de receta propia (§80). */
interface InventoryItemOption {
    id: string;
    name: string;
    sku: string;
    baseUnit: string;
    type: string;
}

/** Ingrediente directo (receta propia) de un modificador (§80). */
interface ModifierIngredient {
    ingredientItemId: string;
    quantity: number;
    unit: string;
    ingredientItem: { name: string };
}

/** Auditoría de descargo calculada por getModifierGroupsWithItemsAction (§ punto 3 Christian). */
interface ModifierDeduction {
    status: 'OK' | 'NO_LINK' | 'NO_RECIPE' | 'RECIPE_INACTIVE';
    /** OWN = receta propia del modificador (prioridad); LINKED = receta del item vinculado. */
    source?: 'OWN' | 'LINKED';
    recipeName: string | null;
    ingredients: { name: string; quantity: number; unit: string }[];
}

interface Modifier {
    id: string;
    name: string;
    priceAdjustment: number;
    isAvailable: boolean;
    linkedMenuItemId: string | null;
    linkedMenuItem: { id: string; name: string } | null;
    ingredients?: ModifierIngredient[];
    /** Sub-grupo anidado (§82): se despliega en el POS al elegir esta opción. */
    childGroup?: { id: string; name: string; isActive: boolean } | null;
    deduction?: ModifierDeduction;
}

interface ModifierGroup {
    id: string;
    name: string;
    description: string | null;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    modifiers: Modifier[];
    menuItems: { menuItem: { id: string; name: string } }[];
}

interface Props {
    groups: ModifierGroup[];
    menuItems: MenuItem[];
    inventoryItems: InventoryItemOption[];
}

const RECIPE_UNITS = ['KG', 'G', 'L', 'ML', 'UNIT', 'PORTION'] as const;

export default function ModifierManagerClient({ groups, menuItems, inventoryItems }: Props) {
    const [isPending, startTransition] = useTransition();
    const [localGroups, setLocalGroups] = useState<ModifierGroup[]>(groups);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(groups[0]?.id || null);
    const [savingModifier, setSavingModifier] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // --- Nuevo grupo ---
    const [showNewGroupForm, setShowNewGroupForm] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [newGroupRequired, setNewGroupRequired] = useState(false);
    const [newGroupMin, setNewGroupMin] = useState(0);
    const [newGroupMax, setNewGroupMax] = useState(1);
    const [savingGroup, setSavingGroup] = useState(false);

    // --- Nuevo modificador por grupo ---
    const [addingModifierToGroup, setAddingModifierToGroup] = useState<string | null>(null);
    const [newModName, setNewModName] = useState('');
    const [newModPrice, setNewModPrice] = useState('0');
    const [newModLinkedItem, setNewModLinkedItem] = useState('');

    // --- Receta propia del modificador (§80) ---
    const [recipeEditor, setRecipeEditor] = useState<{ groupIdx: number; modIdx: number } | null>(null);
    const [recipeRows, setRecipeRows] = useState<Array<{ ingredientItemId: string; quantity: string; unit: string }>>([]);
    const [recipeSearch, setRecipeSearch] = useState('');
    const [savingRecipe, setSavingRecipe] = useState(false);
    const [recipeError, setRecipeError] = useState<string | null>(null);

    // --- Editar grupo ---
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupMin, setEditGroupMin] = useState(0);
    const [editGroupMax, setEditGroupMax] = useState(1);
    const [editGroupRequired, setEditGroupRequired] = useState(false);

    const showToast = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    // Agrupar menuItems por categoría para el selector
    const itemsByCategory = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
        const cat = item.category.name;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    // =========================================================================
    // LINK MODIFIER → MENU ITEM (inventario)
    // =========================================================================
    const handleLink = (groupIdx: number, modIdx: number, menuItemId: string | null) => {
        const modifierId = localGroups[groupIdx].modifiers[modIdx].id;
        const linkedItem = menuItemId ? menuItems.find(i => i.id === menuItemId) : null;
        setLocalGroups(prev => {
            const next = [...prev];
            next[groupIdx] = {
                ...next[groupIdx],
                modifiers: next[groupIdx].modifiers.map((m, idx) =>
                    idx === modIdx
                        // deduction: undefined → la fila cae al heurístico local
                        // (recipeId del item) hasta el próximo reload del server.
                        // Con receta propia (OWN) el vínculo no afecta el descargo.
                        ? { ...m, linkedMenuItemId: menuItemId, linkedMenuItem: linkedItem ? { id: linkedItem.id, name: linkedItem.name } : null, deduction: m.deduction?.source === 'OWN' ? m.deduction : undefined }
                        : m
                )
            };
            return next;
        });
        setSavingModifier(modifierId);
        startTransition(async () => {
            const res = await linkModifierToMenuItemAction(modifierId, menuItemId);
            setSavingModifier(null);
            if (res.success) showToast(`"${localGroups[groupIdx].modifiers[modIdx].name}" ${menuItemId ? 'vinculado' : 'desvinculado'}`);
        });
    };

    const handleToggleAvailability = (groupIdx: number, modIdx: number) => {
        const modifier = localGroups[groupIdx].modifiers[modIdx];
        const newVal = !modifier.isAvailable;
        setLocalGroups(prev => {
            const next = [...prev];
            next[groupIdx] = {
                ...next[groupIdx],
                modifiers: next[groupIdx].modifiers.map((m, idx) => idx === modIdx ? { ...m, isAvailable: newVal } : m)
            };
            return next;
        });
        startTransition(async () => {
            await toggleModifierAvailabilityAction(modifier.id, newVal);
        });
    };

    // =========================================================================
    // SUB-GRUPO ANIDADO (§82)
    // =========================================================================
    const handleSetChildGroup = (groupIdx: number, modIdx: number, childGroupId: string | null) => {
        const mod = localGroups[groupIdx].modifiers[modIdx];
        const child = childGroupId ? localGroups.find(g => g.id === childGroupId) : null;
        setLocalGroups(prev => {
            const next = [...prev];
            next[groupIdx] = {
                ...next[groupIdx],
                modifiers: next[groupIdx].modifiers.map((m, idx) => idx === modIdx
                    ? { ...m, childGroup: child ? { id: child.id, name: child.name, isActive: true } : null }
                    : m),
            };
            return next;
        });
        startTransition(async () => {
            const res = await setModifierChildGroupAction(mod.id, childGroupId);
            if (res.success) {
                showToast(childGroupId
                    ? `"${mod.name}" ahora despliega "${child?.name}"`
                    : `"${mod.name}" ya no despliega sub-grupo`);
            } else if (res.message) {
                showToast(res.message);
            }
        });
    };

    // =========================================================================
    // RECETA PROPIA DEL MODIFICADOR (§80)
    // =========================================================================
    const inventoryById = useMemo(
        () => new Map(inventoryItems.map(i => [i.id, i])),
        [inventoryItems],
    );

    const openRecipeEditor = (groupIdx: number, modIdx: number) => {
        const mod = localGroups[groupIdx].modifiers[modIdx];
        setRecipeRows((mod.ingredients ?? []).map(ing => ({
            ingredientItemId: ing.ingredientItemId,
            quantity: String(ing.quantity),
            unit: ing.unit,
        })));
        setRecipeSearch('');
        setRecipeError(null);
        setRecipeEditor({ groupIdx, modIdx });
    };

    const addRecipeRow = (item: InventoryItemOption) => {
        setRecipeRows(prev => prev.some(r => r.ingredientItemId === item.id)
            ? prev
            : [...prev, { ingredientItemId: item.id, quantity: '', unit: RECIPE_UNITS.includes(item.baseUnit as typeof RECIPE_UNITS[number]) ? item.baseUnit : 'UNIT' }]);
        setRecipeSearch('');
    };

    const handleSaveRecipe = async () => {
        if (!recipeEditor) return;
        const { groupIdx, modIdx } = recipeEditor;
        const mod = localGroups[groupIdx].modifiers[modIdx];

        const parsed: Array<{ ingredientItemId: string; quantity: number; unit: string }> = [];
        for (const row of recipeRows) {
            const qty = parseFloat(row.quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
                setRecipeError(`Cantidad inválida para "${inventoryById.get(row.ingredientItemId)?.name ?? 'insumo'}"`);
                return;
            }
            parsed.push({ ingredientItemId: row.ingredientItemId, quantity: qty, unit: row.unit });
        }

        setSavingRecipe(true);
        setRecipeError(null);
        const res = await setModifierIngredientsAction(mod.id, parsed);
        setSavingRecipe(false);
        if (!res.success) {
            setRecipeError(res.message ?? 'Error guardando');
            return;
        }
        const newIngredients: ModifierIngredient[] = parsed.map(p => ({
            ...p,
            ingredientItem: { name: inventoryById.get(p.ingredientItemId)?.name ?? '' },
        }));
        setLocalGroups(prev => {
            const next = [...prev];
            next[groupIdx] = {
                ...next[groupIdx],
                modifiers: next[groupIdx].modifiers.map((m, idx) => idx === modIdx
                    ? {
                        ...m,
                        ingredients: newIngredients,
                        deduction: newIngredients.length > 0
                            ? {
                                status: 'OK',
                                source: 'OWN',
                                recipeName: null,
                                ingredients: newIngredients.map(ing => ({
                                    name: ing.ingredientItem.name,
                                    quantity: ing.quantity,
                                    unit: ing.unit,
                                })),
                            }
                            // sin receta propia → cae al heurístico local del
                            // vínculo hasta el próximo reload del server.
                            : undefined,
                    }
                    : m),
            };
            return next;
        });
        setRecipeEditor(null);
        showToast(newIngredients.length > 0
            ? `Receta propia de "${mod.name}" guardada`
            : `Receta propia de "${mod.name}" eliminada`);
    };

    // =========================================================================
    // CREAR NUEVO GRUPO
    // =========================================================================
    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        setSavingGroup(true);
        const res = await createModifierGroupAction({
            name: newGroupName,
            description: newGroupDesc || undefined,
            isRequired: newGroupRequired,
            minSelections: newGroupMin,
            maxSelections: newGroupMax,
        });
        setSavingGroup(false);
        if (res.success && res.data) {
            setLocalGroups(prev => [...prev, res.data as unknown as ModifierGroup]);
            setExpandedGroup(res.data.id);
            setShowNewGroupForm(false);
            setNewGroupName(''); setNewGroupDesc(''); setNewGroupRequired(false); setNewGroupMin(0); setNewGroupMax(1);
            showToast(`Grupo "${res.data.name}" creado`);
        }
    };

    // =========================================================================
    // EDITAR GRUPO
    // =========================================================================
    const startEditGroup = (group: ModifierGroup) => {
        setEditingGroupId(group.id);
        setEditGroupName(group.name);
        setEditGroupMin(group.minSelections);
        setEditGroupMax(group.maxSelections);
        setEditGroupRequired(group.isRequired);
    };

    const handleSaveGroupEdit = async (groupId: string) => {
        const res = await updateModifierGroupAction(groupId, {
            name: editGroupName,
            isRequired: editGroupRequired,
            minSelections: editGroupMin,
            maxSelections: editGroupMax,
        });
        if (res.success) {
            setLocalGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: editGroupName, isRequired: editGroupRequired, minSelections: editGroupMin, maxSelections: editGroupMax } : g));
            setEditingGroupId(null);
            showToast('Grupo actualizado');
        }
    };

    // =========================================================================
    // ELIMINAR GRUPO
    // =========================================================================
    const handleDeleteGroup = async (groupId: string, groupName: string) => {
        if (!confirm(`¿Eliminar grupo "${groupName}"? Se eliminan todos sus modificadores.`)) return;
        const res = await deleteModifierGroupAction(groupId);
        if (res.success) {
            setLocalGroups(prev => prev.filter(g => g.id !== groupId));
            showToast('Grupo eliminado');
        }
    };

    // =========================================================================
    // AGREGAR MODIFICADOR A GRUPO
    // =========================================================================
    const handleAddModifier = async (groupId: string, groupIdx: number) => {
        if (!newModName.trim()) return;
        const res = await addModifierAction({
            groupId,
            name: newModName,
            priceAdjustment: parseFloat(newModPrice) || 0,
            linkedMenuItemId: newModLinkedItem || null,
        });
        if (res.success && res.data) {
            const linkedItem = newModLinkedItem ? menuItems.find(i => i.id === newModLinkedItem) : null;
            const newMod: Modifier = {
                id: res.data.id,
                name: res.data.name,
                priceAdjustment: Number(res.data.priceAdjustment),
                isAvailable: true,
                linkedMenuItemId: newModLinkedItem || null,
                linkedMenuItem: linkedItem ? { id: linkedItem.id, name: linkedItem.name } : null,
            };
            setLocalGroups(prev => {
                const next = [...prev];
                next[groupIdx] = { ...next[groupIdx], modifiers: [...next[groupIdx].modifiers, newMod] };
                return next;
            });
            setAddingModifierToGroup(null);
            setNewModName(''); setNewModPrice('0'); setNewModLinkedItem('');
            showToast(`Modificador "${res.data.name}" agregado`);
        }
    };

    // =========================================================================
    // ELIMINAR MODIFICADOR
    // =========================================================================
    const handleDeleteModifier = async (groupIdx: number, modIdx: number) => {
        const mod = localGroups[groupIdx].modifiers[modIdx];
        if (!confirm(`¿Eliminar modificador "${mod.name}"?`)) return;
        const res = await deleteModifierAction(mod.id);
        if (res.success) {
            setLocalGroups(prev => {
                const next = [...prev];
                next[groupIdx] = { ...next[groupIdx], modifiers: next[groupIdx].modifiers.filter((_, i) => i !== modIdx) };
                return next;
            });
            showToast('Modificador eliminado');
        }
    };

    // =========================================================================
    // VINCULAR GRUPO A PLATO DEL MENÚ (para POS)
    // =========================================================================
    const handleLinkGroupToItem = async (groupIdx: number, menuItemId: string) => {
        if (!menuItemId) return;
        const group = localGroups[groupIdx];
        const alreadyLinked = group.menuItems.some(m => m.menuItem.id === menuItemId);
        if (alreadyLinked) return;
        const res = await linkGroupToMenuItemAction(group.id, menuItemId);
        if (res.success) {
            const item = menuItems.find(i => i.id === menuItemId);
            if (item) {
                setLocalGroups(prev => {
                    const next = [...prev];
                    next[groupIdx] = { ...next[groupIdx], menuItems: [...next[groupIdx].menuItems, { menuItem: { id: item.id, name: item.name } }] };
                    return next;
                });
                showToast(`Grupo "${group.name}" vinculado a "${item.name}"`);
            }
        }
    };

    const handleUnlinkGroupFromItem = async (groupIdx: number, menuItemId: string, menuItemName: string) => {
        const group = localGroups[groupIdx];
        const res = await unlinkGroupFromMenuItemAction(group.id, menuItemId);
        if (res.success) {
            setLocalGroups(prev => {
                const next = [...prev];
                next[groupIdx] = { ...next[groupIdx], menuItems: next[groupIdx].menuItems.filter(m => m.menuItem.id !== menuItemId) };
                return next;
            });
            showToast(`Desvinculado de "${menuItemName}"`);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toast */}
            {successMsg && (
                <div className="fixed bottom-6 right-6 z-50 bg-[#2F6B4E] text-capsula-cream px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4">
                    {successMsg}
                </div>
            )}

            {/* Leyenda */}
            <div className="rounded-xl border border-capsula-line bg-[#E6ECF4] dark:bg-[#1A2636] p-4 text-sm text-[#2A4060] dark:text-[#D1DCE9]">
                <strong>¿Cómo funciona?</strong> Crea grupos de modificadores y vincúlalos a los platos del menú (columna &quot;Aplica a platos del POS&quot;). Cada modificador puede vincularse a otro plato para descargar su receta del inventario.
            </div>

            {/* Botón Nuevo Grupo */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowNewGroupForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-capsula-navy-deep hover:bg-capsula-navy text-capsula-cream text-sm font-semibold"
                >
                    + Nuevo Grupo de Modificadores
                </button>
            </div>

            {/* Formulario nuevo grupo */}
            {showNewGroupForm && (
                <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-5 space-y-3">
                    <h3 className="font-semibold text-capsula-ink">Crear Grupo de Modificadores</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Nombre del grupo *</label>
                            <input
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                placeholder="Ej: Acompañante, Salsa, Extras..."
                                className="w-full rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Descripción (opcional)</label>
                            <input
                                value={newGroupDesc}
                                onChange={e => setNewGroupDesc(e.target.value)}
                                placeholder="Descripción breve..."
                                className="w-full rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex gap-4 items-center">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={newGroupRequired} onChange={e => setNewGroupRequired(e.target.checked)} className="rounded" />
                                Selección obligatoria
                            </label>
                        </div>
                        <div className="flex gap-3 items-center">
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Mín.</label>
                                <input type="number" min={0} value={newGroupMin} onChange={e => setNewGroupMin(parseInt(e.target.value) || 0)} className="w-20 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Máx. (99=sin límite)</label>
                                <input type="number" min={1} value={newGroupMax} onChange={e => setNewGroupMax(parseInt(e.target.value) || 1)} className="w-24 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-2 text-sm" />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || savingGroup} className="px-4 py-2 rounded-lg bg-capsula-navy-deep hover:bg-capsula-navy text-capsula-cream text-sm font-semibold disabled:opacity-50">
                            {savingGroup ? 'Guardando...' : 'Crear Grupo'}
                        </button>
                        <button onClick={() => setShowNewGroupForm(false)} className="px-4 py-2 rounded-lg bg-capsula-ivory-alt text-sm font-semibold">Cancelar</button>
                    </div>
                </div>
            )}

            {localGroups.length === 0 && !showNewGroupForm && (
                <div className="rounded-xl border border-capsula-line p-12 text-center text-capsula-ink-muted">
                    <p className="text-4xl mb-3"></p>
                    <p className="font-medium">No hay grupos de modificadores. Crea uno con el botón de arriba.</p>
                </div>
            )}

            {/* Lista de grupos */}
            {localGroups.map((group, groupIdx) => (
                <div key={group.id} className="rounded-xl border border-capsula-line overflow-hidden">
                    {/* Header del grupo */}
                    <div className="flex items-center justify-between px-5 py-3 bg-capsula-ivory-alt">
                        <button
                            onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        >
                            {expandedGroup === group.id
                                ? <ChevronDown className="h-4 w-4 text-capsula-ink-muted" />
                                : <ChevronRight className="h-4 w-4 text-capsula-ink-muted" />}
                            {editingGroupId === group.id ? (
                                <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                    <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} className="rounded border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-1 text-sm font-semibold w-40" />
                                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                                        <input type="checkbox" checked={editGroupRequired} onChange={e => setEditGroupRequired(e.target.checked)} />
                                        Req.
                                    </label>
                                    <input type="number" min={0} value={editGroupMin} onChange={e => setEditGroupMin(parseInt(e.target.value)||0)} className="w-14 rounded border border-capsula-line bg-capsula-ivory text-capsula-ink px-1 py-1 text-xs" placeholder="mín" />
                                    <input type="number" min={1} value={editGroupMax} onChange={e => setEditGroupMax(parseInt(e.target.value)||1)} className="w-16 rounded border border-capsula-line bg-capsula-ivory text-capsula-ink px-1 py-1 text-xs" placeholder="máx" />
                                    <button onClick={() => handleSaveGroupEdit(group.id)} className="px-2 py-1 bg-[#2F6B4E] text-capsula-cream rounded text-xs font-semibold">Guardar</button>
                                    <button onClick={() => setEditingGroupId(null)} className="px-2 py-1 bg-capsula-ink-muted text-capsula-cream rounded text-xs"></button>
                                </div>
                            ) : (
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink truncate">{group.name}</h3>
                                    <p className="text-xs text-capsula-ink-muted mt-0.5">
                                        {group.modifiers.length} opciones
                                        {group.isRequired && ' • Requerido'}
                                        {group.maxSelections < 99 && ` • máx. ${group.maxSelections}`}
                                        {group.menuItems.length > 0 && ` • en: ${group.menuItems.map(m => m.menuItem.name).join(', ')}`}
                                    </p>
                                </div>
                            )}
                        </button>
                        {editingGroupId !== group.id && (
                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.modifiers.some(m => m.linkedMenuItemId) ? 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' : 'bg-capsula-ivory-alt text-capsula-ink-muted'}`}>
                                    {group.modifiers.filter(m => m.linkedMenuItemId).length}/{group.modifiers.length} vinculados
                                </span>
                                <button onClick={() => startEditGroup(group)} title="Editar grupo" className="p-1 text-capsula-ink-muted hover:text-capsula-navy-deep rounded text-sm"></button>
                                <button onClick={() => handleDeleteGroup(group.id, group.name)} title="Eliminar grupo" className="p-1 text-capsula-ink-muted hover:text-capsula-coral rounded text-sm"></button>
                            </div>
                        )}
                    </div>

                    {expandedGroup === group.id && (
                        <div>
                            {/* Sección: Aplica a estos platos del POS */}
                            <div className="px-5 py-3 bg-[#E6ECF4] dark:bg-[#1A2636] border-b border-capsula-line">
                                <p className="text-xs font-semibold text-[#2A4060] dark:text-[#D1DCE9] mb-2">Aplica a platos del POS (vincula para que aparezca al vender):</p>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {group.menuItems.map(rel => (
                                        <span key={rel.menuItem.id} className="flex items-center gap-1 px-2 py-1 bg-capsula-navy-soft text-capsula-ink text-xs rounded-full font-medium">
                                            {rel.menuItem.name}
                                            <button onClick={() => handleUnlinkGroupFromItem(groupIdx, rel.menuItem.id, rel.menuItem.name)} className="text-capsula-ink-muted hover:text-capsula-coral ml-1 font-semibold leading-none">×</button>
                                        </span>
                                    ))}
                                    <select
                                        defaultValue=""
                                        onChange={e => { if (e.target.value) handleLinkGroupToItem(groupIdx, e.target.value); e.target.value = ''; }}
                                        className="rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-1 text-xs"
                                    >
                                        <option value="">+ Vincular a plato...</option>
                                        {Object.entries(itemsByCategory).map(([cat, items]) => (
                                            <optgroup key={cat} label={cat}>
                                                {items.filter(i => !group.menuItems.some(m => m.menuItem.id === i.id)).map(item => (
                                                    <option key={item.id} value={item.id}>{item.name}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Modificadores */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {group.modifiers.map((modifier, modIdx) => {
                                    const linkedItem = menuItems.find(i => i.id === modifier.linkedMenuItemId);
                                    const linkedHasRecipe = linkedItem?.recipeId != null;
                                    const isSaving = savingModifier === modifier.id;
                                    // Auditoría de descargo del server; tras un cambio local
                                    // de vínculo cae al heurístico (linkedHasRecipe).
                                    const ded = modifier.deduction;
                                    return (
                                        <div
                                            key={modifier.id}
                                            className={`flex flex-col gap-2 px-5 py-3 ${!modifier.isAvailable ? 'opacity-50' : ''}`}
                                        >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            {/* Toggle + Nombre */}
                                            <div className="flex items-center gap-3 min-w-0 sm:w-56 sm:shrink-0">
                                                <button
                                                    onClick={() => handleToggleAvailability(groupIdx, modIdx)}
                                                    title={modifier.isAvailable ? 'Desactivar' : 'Activar'}
                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${modifier.isAvailable ? 'bg-[#2F6B4E] border-[#2F6B4E] text-capsula-cream' : 'border-capsula-line-strong'}`}
                                                >
                                                    {modifier.isAvailable && <span className="text-[10px] font-semibold leading-none"></span>}
                                                </button>
                                                <span className="font-medium text-capsula-ink truncate">{modifier.name}</span>
                                                {modifier.priceAdjustment !== 0 && (
                                                    <span className={`text-xs font-mono shrink-0 ${modifier.priceAdjustment > 0 ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral'}`}>
                                                        {modifier.priceAdjustment > 0 ? '+' : ''}${Number(modifier.priceAdjustment).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Selector descargo inventario */}
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-capsula-ink-muted text-xs shrink-0">→ Descargo inventario de:</span>
                                                <div className="flex-1 min-w-0">
                                                    <select
                                                        value={modifier.linkedMenuItemId || ''}
                                                        onChange={e => handleLink(groupIdx, modIdx, e.target.value || null)}
                                                        disabled={isSaving || isPending}
                                                        className="w-full rounded-lg border border-capsula-line bg-capsula-ivory px-3 py-1.5 text-sm text-capsula-ink focus:border-capsula-navy-deep focus:outline-none disabled:opacity-50"
                                                    >
                                                        <option value="">— Sin vínculo (solo precio) —</option>
                                                        {Object.entries(itemsByCategory).map(([cat, items]) => (
                                                            <optgroup key={cat} label={cat}>
                                                                {items.map(item => (
                                                                    <option key={item.id} value={item.id}>
                                                                        {item.name}{!item.recipeId ? ' (sin receta)' : ''}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Estado + Eliminar */}
                                            <div className="shrink-0 flex items-center gap-2">
                                                <span className="w-28 text-right text-xs font-medium">
                                                    {isSaving ? (
                                                        <span className="text-capsula-ink-muted">Guardando...</span>
                                                    ) : ded ? (
                                                        ded.status === 'OK' ? (
                                                            <span className="inline-flex items-center gap-1 text-[#2F6B4E] dark:text-[#6FB88F]"><Check className="h-3 w-3" /> Descuenta</span>
                                                        ) : ded.status === 'RECIPE_INACTIVE' ? (
                                                            <span className="inline-flex items-center gap-1 text-capsula-coral"><AlertTriangle className="h-3 w-3" /> Receta inactiva</span>
                                                        ) : ded.status === 'NO_RECIPE' ? (
                                                            <span className="inline-flex items-center gap-1 text-capsula-coral"><AlertTriangle className="h-3 w-3" /> Sin receta</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-capsula-coral"><AlertTriangle className="h-3 w-3" /> No descuenta</span>
                                                        )
                                                    ) : modifier.linkedMenuItemId ? (
                                                        <span className={linkedHasRecipe ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-coral'}>
                                                            {linkedHasRecipe ? 'Con receta' : 'Sin receta'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-capsula-coral"><AlertTriangle className="h-3 w-3" /> No descuenta</span>
                                                    )}
                                                </span>
                                                <button
                                                    onClick={() => openRecipeEditor(groupIdx, modIdx)}
                                                    title={(modifier.ingredients?.length ?? 0) > 0 ? 'Editar receta propia' : 'Definir receta propia (insumos directos)'}
                                                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors ${(modifier.ingredients?.length ?? 0) > 0 ? 'border-[#A8C8B0] bg-[#E5EDE7] text-[#2F6B4E] dark:border-[#2A4D38] dark:bg-[#1E3B2C] dark:text-[#6FB88F]' : 'border-capsula-line text-capsula-ink-muted hover:border-capsula-navy-deep hover:text-capsula-ink'}`}
                                                >
                                                    <FlaskConical className="h-3.5 w-3.5" />
                                                    {(modifier.ingredients?.length ?? 0) > 0 ? 'Receta propia' : 'Crear receta'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteModifier(groupIdx, modIdx)}
                                                    title="Eliminar modificador"
                                                    className="text-capsula-ink-muted hover:text-capsula-coral p-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Detalle de descargo: qué y cuánto descuenta por cada unidad del plato */}
                                        {ded?.status === 'OK' && ded.ingredients.length > 0 && (
                                            <p className="flex items-start gap-1.5 pl-7 text-[11px] text-capsula-ink-muted">
                                                <FlaskConical className="h-3 w-3 mt-0.5 shrink-0" />
                                                <span>
                                                    <span className="font-semibold">Descuenta por unidad</span>
                                                    {ded.source === 'OWN'
                                                        ? ' (receta propia)'
                                                        : ded.recipeName ? ` (receta "${ded.recipeName}")` : ''}:{' '}
                                                    {ded.ingredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`).join(' · ')}
                                                    {ded.source === 'OWN' && modifier.linkedMenuItemId && (
                                                        <span className="text-capsula-ink-faint"> — el vínculo a plato queda ignorado</span>
                                                    )}
                                                </span>
                                            </p>
                                        )}

                                        {/* Sub-grupo anidado (§82): se despliega en el POS al elegir la opción */}
                                        <div className="flex items-center gap-2 pl-7">
                                            <ListTree className={`h-3 w-3 shrink-0 ${modifier.childGroup ? 'text-[#2F6B4E] dark:text-[#6FB88F]' : 'text-capsula-ink-faint'}`} />
                                            <span className="text-[11px] text-capsula-ink-muted shrink-0">Al elegir despliega:</span>
                                            <select
                                                value={modifier.childGroup?.id ?? ''}
                                                onChange={e => handleSetChildGroup(groupIdx, modIdx, e.target.value || null)}
                                                disabled={isPending}
                                                className="rounded-lg border border-capsula-line bg-capsula-ivory px-2 py-1 text-[11px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none disabled:opacity-50"
                                            >
                                                <option value="">— Nada (opción simple) —</option>
                                                {localGroups.filter(g => g.id !== group.id).map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Formulario agregar modificador */}
                            {addingModifierToGroup === group.id ? (
                                <div className="px-5 py-3 bg-capsula-ivory-alt border-t border-capsula-line space-y-2">
                                    <p className="text-xs font-semibold text-capsula-ink-muted">Nuevo Modificador</p>
                                    <div className="flex flex-wrap gap-2 items-end">
                                        <div>
                                            <label className="block text-xs text-capsula-ink-muted mb-0.5">Nombre *</label>
                                            <input
                                                value={newModName}
                                                onChange={e => setNewModName(e.target.value)}
                                                placeholder="Ej: Tabule, Extra queso..."
                                                className="rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-3 py-1.5 text-sm w-44"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-capsula-ink-muted mb-0.5">Precio (+/-$)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newModPrice}
                                                onChange={e => setNewModPrice(e.target.value)}
                                                className="rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-3 py-1.5 text-sm w-24"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-capsula-ink-muted mb-0.5">Descarga inventario de:</label>
                                            <select
                                                value={newModLinkedItem}
                                                onChange={e => setNewModLinkedItem(e.target.value)}
                                                className="rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-1.5 text-sm"
                                            >
                                                <option value="">— Sin vínculo —</option>
                                                {Object.entries(itemsByCategory).map(([cat, items]) => (
                                                    <optgroup key={cat} label={cat}>
                                                        {items.map(item => (
                                                            <option key={item.id} value={item.id}>{item.name}{!item.recipeId ? ' ' : ''}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => handleAddModifier(group.id, groupIdx)}
                                            disabled={!newModName.trim()}
                                            className="px-3 py-1.5 bg-capsula-navy-deep hover:bg-capsula-navy text-capsula-cream rounded-lg text-sm font-semibold disabled:opacity-50"
                                        >
                                            Agregar
                                        </button>
                                        <button
                                            onClick={() => { setAddingModifierToGroup(null); setNewModName(''); setNewModPrice('0'); setNewModLinkedItem(''); }}
                                            className="px-3 py-1.5 bg-capsula-ivory-alt hover:bg-capsula-navy-soft text-capsula-ink border border-capsula-line rounded-lg text-sm font-semibold"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-5 py-2 border-t border-capsula-line">
                                    <button
                                        onClick={() => { setAddingModifierToGroup(group.id); setNewModName(''); setNewModPrice('0'); setNewModLinkedItem(''); }}
                                        className="text-sm text-capsula-coral hover:underline font-semibold"
                                    >
                                        + Agregar opción de modificador
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Nota sobre recetas */}
            {localGroups.length > 0 && (
                <div className="rounded-xl border border-capsula-line bg-[#F3EAD6] dark:bg-[#3B2F15] p-4 text-sm text-[#946A1C] dark:text-[#E8D9B8]">
                    <strong>Modificadores vinculados sin receta</strong> no descontarán inventario. Asegúrate de que el plato vinculado tenga su receta completa en el módulo de Recetas, o define una <strong>receta propia</strong> (icono de matraz) con insumos directos — esta tiene prioridad sobre el vínculo.
                </div>
            )}

            {/* Modal: receta propia del modificador (§80) */}
            {recipeEditor && (() => {
                const mod = localGroups[recipeEditor.groupIdx]?.modifiers[recipeEditor.modIdx];
                if (!mod) return null;
                const search = recipeSearch.trim().toLowerCase();
                const matches = search.length >= 2
                    ? inventoryItems
                        .filter(i => !recipeRows.some(r => r.ingredientItemId === i.id))
                        .filter(i => i.name.toLowerCase().includes(search) || i.sku.toLowerCase().includes(search))
                        .slice(0, 8)
                    : [];
                return (
                    <div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <div className="bg-capsula-ivory border border-capsula-line w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
                            <div className="border-b border-capsula-line p-5 flex items-center justify-between shrink-0">
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink truncate">Receta propia — {mod.name}</h3>
                                    <p className="text-xs text-capsula-ink-muted mt-0.5">Insumos que descuenta cada unidad. Tiene prioridad sobre el plato vinculado.</p>
                                </div>
                                <button
                                    onClick={() => setRecipeEditor(null)}
                                    className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center shrink-0"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4 overflow-y-auto">
                                {/* Filas actuales */}
                                {recipeRows.length === 0 ? (
                                    <p className="text-sm text-capsula-ink-muted">Sin insumos. Busca abajo para agregar el primero.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {recipeRows.map((row, rowIdx) => {
                                            const item = inventoryById.get(row.ingredientItemId);
                                            return (
                                                <div key={row.ingredientItemId} className="flex items-center gap-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface px-3 py-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-capsula-ink truncate">{item?.name ?? row.ingredientItemId}</p>
                                                        {item?.sku && <p className="text-[10px] text-capsula-ink-faint">{item.sku}</p>}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min={0}
                                                        value={row.quantity}
                                                        onChange={e => setRecipeRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, quantity: e.target.value } : r))}
                                                        placeholder="Cant."
                                                        className="w-24 rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-1.5 text-sm tabular-nums text-right"
                                                    />
                                                    <select
                                                        value={row.unit}
                                                        onChange={e => setRecipeRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, unit: e.target.value } : r))}
                                                        className="rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-2 py-1.5 text-sm"
                                                    >
                                                        {RECIPE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={() => setRecipeRows(prev => prev.filter((_, i) => i !== rowIdx))}
                                                        title="Quitar insumo"
                                                        className="text-capsula-ink-muted hover:text-capsula-coral p-1 shrink-0"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Buscador de insumos */}
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted mb-1">Agregar insumo</label>
                                    <input
                                        value={recipeSearch}
                                        onChange={e => setRecipeSearch(e.target.value)}
                                        placeholder="Buscar por nombre o SKU (mín. 2 letras)..."
                                        className="w-full rounded-lg border border-capsula-line bg-capsula-ivory text-capsula-ink px-3 py-2 text-sm"
                                    />
                                    {matches.length > 0 && (
                                        <div className="mt-1 rounded-xl border border-capsula-line bg-capsula-ivory-surface divide-y divide-capsula-line overflow-hidden">
                                            {matches.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => addRecipeRow(item)}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-capsula-navy-soft"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block text-sm text-capsula-ink truncate">{item.name}</span>
                                                        <span className="block text-[10px] text-capsula-ink-faint">{item.sku} · {item.baseUnit}</span>
                                                    </span>
                                                    <Plus className="h-4 w-4 text-capsula-ink-muted shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {search.length >= 2 && matches.length === 0 && (
                                        <p className="mt-1 text-xs text-capsula-ink-muted">Sin resultados para &quot;{recipeSearch.trim()}&quot;.</p>
                                    )}
                                </div>

                                {recipeError && (
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#B04A2E] dark:text-[#EFD2C8]">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {recipeError}
                                    </p>
                                )}
                            </div>
                            <div className="border-t border-capsula-line p-4 flex gap-3 shrink-0">
                                <button onClick={() => setRecipeEditor(null)} className="pos-btn-secondary flex-1 py-3" disabled={savingRecipe}>Cancelar</button>
                                <button
                                    onClick={handleSaveRecipe}
                                    disabled={savingRecipe}
                                    className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    <Check className="h-4 w-4" /> {savingRecipe ? 'Guardando...' : recipeRows.length === 0 && (mod.ingredients?.length ?? 0) > 0 ? 'Quitar receta propia' : 'Guardar receta'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
