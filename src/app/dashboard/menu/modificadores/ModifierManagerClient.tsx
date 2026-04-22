'use client';

import { useState, useTransition } from 'react';
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
} from '@/app/actions/modifier.actions';

interface MenuItem {
    id: string;
    name: string;
    recipeId: string | null;
    category: { name: string };
}

interface Modifier {
    id: string;
    name: string;
    priceAdjustment: number;
    isAvailable: boolean;
    linkedMenuItemId: string | null;
    linkedMenuItem: { id: string; name: string } | null;
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
}

export default function ModifierManagerClient({ groups, menuItems }: Props) {
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
                        ? { ...m, linkedMenuItemId: menuItemId, linkedMenuItem: linkedItem ? { id: linkedItem.id, name: linkedItem.name } : null }
                        : m
                )
            };
            return next;
        });
        setSavingModifier(modifierId);
        startTransition(async () => {
            const res = await linkModifierToMenuItemAction(modifierId, menuItemId);
            setSavingModifier(null);
            if (res.success) showToast(`✅ "${localGroups[groupIdx].modifiers[modIdx].name}" ${menuItemId ? 'vinculado' : 'desvinculado'}`);
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
            setLocalGroups(prev => [...prev, res.data as ModifierGroup]);
            setExpandedGroup(res.data.id);
            setShowNewGroupForm(false);
            setNewGroupName(''); setNewGroupDesc(''); setNewGroupRequired(false); setNewGroupMin(0); setNewGroupMax(1);
            showToast(`✅ Grupo "${res.data.name}" creado`);
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
            showToast('✅ Grupo actualizado');
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
            showToast('✅ Grupo eliminado');
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
            showToast(`✅ Modificador "${res.data.name}" agregado`);
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
            showToast('✅ Modificador eliminado');
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
                showToast(`✅ Grupo "${group.name}" vinculado a "${item.name}"`);
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
            showToast(`✅ Desvinculado de "${menuItemName}"`);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toast */}
            {successMsg && (
                <div className="fixed bottom-6 right-6 z-50 bg-[#2F6B4E] text-capsula-ivory-surface px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4">
                    {successMsg}
                </div>
            )}

            {/* Leyenda */}
            <div className="rounded-xl border border-capsula-navy/30 bg-capsula-navy/5 p-4 text-sm text-capsula-navy">
                <strong>¿Cómo funciona?</strong> Crea grupos de modificadores y vincúlalos a los platos del menú (columna &quot;Aplica a platos del POS&quot;). Cada modificador puede vincularse a otro plato para descargar su receta del inventario.
            </div>

            {/* Botón Nuevo Grupo */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowNewGroupForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-capsula-navy-deep hover:bg-capsula-navy-ink text-capsula-ivory-surface text-sm font-bold"
                >
                    + Nuevo Grupo de Modificadores
                </button>
            </div>

            {/* Formulario nuevo grupo */}
            {showNewGroupForm && (
                <div className="rounded-xl border border-[#946A1C]/30 bg-[#F3EAD6]/40 p-5 space-y-3">
                    <h3 className="font-bold text-[#946A1C]">Crear Grupo de Modificadores</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-capsula-ink-soft mb-1">Nombre del grupo *</label>
                            <input
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                placeholder="Ej: Acompañante, Salsa, Extras..."
                                className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-capsula-ink-soft mb-1">Descripción (opcional)</label>
                            <input
                                value={newGroupDesc}
                                onChange={e => setNewGroupDesc(e.target.value)}
                                placeholder="Descripción breve..."
                                className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-sm"
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
                                <label className="block text-xs font-semibold text-capsula-ink-soft mb-1">Mín.</label>
                                <input type="number" min={0} value={newGroupMin} onChange={e => setNewGroupMin(parseInt(e.target.value) || 0)} className="w-20 rounded-lg border border-capsula-line bg-capsula-ivory-surface px-2 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-capsula-ink-soft mb-1">Máx. (99=sin límite)</label>
                                <input type="number" min={1} value={newGroupMax} onChange={e => setNewGroupMax(parseInt(e.target.value) || 1)} className="w-24 rounded-lg border border-capsula-line bg-capsula-ivory-surface px-2 py-2 text-sm" />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || savingGroup} className="px-4 py-2 rounded-lg bg-capsula-navy-deep hover:bg-capsula-navy-ink text-capsula-ivory-surface text-sm font-bold disabled:opacity-50">
                            {savingGroup ? 'Guardando...' : 'Crear Grupo'}
                        </button>
                        <button onClick={() => setShowNewGroupForm(false)} className="px-4 py-2 rounded-lg bg-capsula-ivory-alt text-sm font-bold">Cancelar</button>
                    </div>
                </div>
            )}

            {localGroups.length === 0 && !showNewGroupForm && (
                <div className="rounded-xl border border-capsula-line p-12 text-center text-capsula-ink-soft">
                    <p className="text-4xl mb-3">🔧</p>
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
                            <span className="text-lg">{expandedGroup === group.id ? '▼' : '▶'}</span>
                            {editingGroupId === group.id ? (
                                <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                    <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} className="rounded border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-sm font-bold w-40" />
                                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                                        <input type="checkbox" checked={editGroupRequired} onChange={e => setEditGroupRequired(e.target.checked)} />
                                        Req.
                                    </label>
                                    <input type="number" min={0} value={editGroupMin} onChange={e => setEditGroupMin(parseInt(e.target.value)||0)} className="w-14 rounded border border-capsula-line bg-capsula-ivory-surface px-1 py-1 text-xs" placeholder="mín" />
                                    <input type="number" min={1} value={editGroupMax} onChange={e => setEditGroupMax(parseInt(e.target.value)||1)} className="w-16 rounded border border-capsula-line bg-capsula-ivory-surface px-1 py-1 text-xs" placeholder="máx" />
                                    <button onClick={() => handleSaveGroupEdit(group.id)} className="px-2 py-1 bg-[#2F6B4E] text-capsula-ivory-surface rounded text-xs font-bold">Guardar</button>
                                    <button onClick={() => setEditingGroupId(null)} className="px-2 py-1 bg-capsula-ink-muted text-capsula-ivory-surface rounded text-xs">✕</button>
                                </div>
                            ) : (
                                <div className="min-w-0">
                                    <h3 className="font-bold text-capsula-navy-deep truncate">{group.name}</h3>
                                    <p className="text-xs text-capsula-ink-soft mt-0.5">
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
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.modifiers.some(m => m.linkedMenuItemId) ? 'bg-[#E5EDE7]/60 text-[#2F6B4E] border border-[#2F6B4E]/30' : 'bg-capsula-ivory-alt text-capsula-ink-soft border border-capsula-line'}`}>
                                    {group.modifiers.filter(m => m.linkedMenuItemId).length}/{group.modifiers.length} vinculados
                                </span>
                                <button onClick={() => startEditGroup(group)} title="Editar grupo" className="p-1 text-capsula-ink-muted hover:text-capsula-navy rounded text-sm">✏️</button>
                                <button onClick={() => handleDeleteGroup(group.id, group.name)} title="Eliminar grupo" className="p-1 text-capsula-ink-muted hover:text-capsula-coral rounded text-sm">🗑️</button>
                            </div>
                        )}
                    </div>

                    {expandedGroup === group.id && (
                        <div>
                            {/* Sección: Aplica a estos platos del POS */}
                            <div className="px-5 py-3 bg-capsula-navy/5 border-b border-capsula-line">
                                <p className="text-xs font-bold text-capsula-navy mb-2">Aplica a platos del POS (vincula para que aparezca al vender):</p>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {group.menuItems.map(rel => (
                                        <span key={rel.menuItem.id} className="flex items-center gap-1 px-2 py-1 bg-capsula-navy/10 text-capsula-navy border border-capsula-navy/30 text-xs rounded-full font-medium">
                                            {rel.menuItem.name}
                                            <button onClick={() => handleUnlinkGroupFromItem(groupIdx, rel.menuItem.id, rel.menuItem.name)} className="text-capsula-navy hover:text-capsula-coral ml-1 font-bold leading-none">×</button>
                                        </span>
                                    ))}
                                    <select
                                        defaultValue=""
                                        onChange={e => { if (e.target.value) handleLinkGroupToItem(groupIdx, e.target.value); e.target.value = ''; }}
                                        className="rounded-lg border border-capsula-line bg-capsula-ivory-surface px-2 py-1 text-xs"
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
                            <div className="divide-y divide-capsula-line">
                                {group.modifiers.map((modifier, modIdx) => {
                                    const linkedItem = menuItems.find(i => i.id === modifier.linkedMenuItemId);
                                    const linkedHasRecipe = linkedItem?.recipeId != null;
                                    const isSaving = savingModifier === modifier.id;
                                    return (
                                        <div
                                            key={modifier.id}
                                            className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 ${!modifier.isAvailable ? 'opacity-50' : ''}`}
                                        >
                                            {/* Toggle + Nombre */}
                                            <div className="flex items-center gap-3 min-w-0 sm:w-56 sm:shrink-0">
                                                <button
                                                    onClick={() => handleToggleAvailability(groupIdx, modIdx)}
                                                    title={modifier.isAvailable ? 'Desactivar' : 'Activar'}
                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${modifier.isAvailable ? 'bg-[#2F6B4E] border-[#2F6B4E] text-capsula-ivory-surface' : 'border-capsula-line'}`}
                                                >
                                                    {modifier.isAvailable && <span className="text-[10px] font-bold leading-none">✓</span>}
                                                </button>
                                                <span className="font-medium text-capsula-navy-deep truncate">{modifier.name}</span>
                                                {modifier.priceAdjustment !== 0 && (
                                                    <span className={`text-xs font-mono shrink-0 ${modifier.priceAdjustment > 0 ? 'text-[#2F6B4E]' : 'text-capsula-coral'}`}>
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
                                                        className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-sm text-capsula-navy-deep focus:border-capsula-navy-deep focus:outline-none disabled:opacity-50"
                                                    >
                                                        <option value="">— Sin vínculo (solo precio) —</option>
                                                        {Object.entries(itemsByCategory).map(([cat, items]) => (
                                                            <optgroup key={cat} label={cat}>
                                                                {items.map(item => (
                                                                    <option key={item.id} value={item.id}>
                                                                        {item.name}{!item.recipeId ? ' ⚠️ sin receta' : ''}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Estado + Eliminar */}
                                            <div className="shrink-0 flex items-center gap-2">
                                                <span className="w-24 text-right text-xs font-medium">
                                                    {isSaving ? (
                                                        <span className="text-capsula-ink-muted">Guardando...</span>
                                                    ) : modifier.linkedMenuItemId ? (
                                                        <span className={linkedHasRecipe ? 'text-[#2F6B4E]' : 'text-[#946A1C]'}>
                                                            {linkedHasRecipe ? '✅ Con receta' : '⚠️ Sin receta'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-capsula-ink-muted">Sin vínculo</span>
                                                    )}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteModifier(groupIdx, modIdx)}
                                                    title="Eliminar modificador"
                                                    className="text-capsula-ink-muted hover:text-capsula-coral text-xs p-1"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Formulario agregar modificador */}
                            {addingModifierToGroup === group.id ? (
                                <div className="px-5 py-3 bg-capsula-ivory-alt/60 border-t border-capsula-line space-y-2">
                                    <p className="text-xs font-bold text-capsula-ink-soft">Nuevo Modificador</p>
                                    <div className="flex flex-wrap gap-2 items-end">
                                        <div>
                                            <label className="block text-xs text-capsula-ink-soft mb-0.5">Nombre *</label>
                                            <input
                                                value={newModName}
                                                onChange={e => setNewModName(e.target.value)}
                                                placeholder="Ej: Tabule, Extra queso..."
                                                className="rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-sm w-44"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-capsula-ink-soft mb-0.5">Precio (+/-$)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newModPrice}
                                                onChange={e => setNewModPrice(e.target.value)}
                                                className="rounded-lg border border-capsula-line bg-capsula-ivory-surface px-3 py-1.5 text-sm w-24"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-capsula-ink-soft mb-0.5">Descarga inventario de:</label>
                                            <select
                                                value={newModLinkedItem}
                                                onChange={e => setNewModLinkedItem(e.target.value)}
                                                className="rounded-lg border border-capsula-line bg-capsula-ivory-surface px-2 py-1.5 text-sm"
                                            >
                                                <option value="">— Sin vínculo —</option>
                                                {Object.entries(itemsByCategory).map(([cat, items]) => (
                                                    <optgroup key={cat} label={cat}>
                                                        {items.map(item => (
                                                            <option key={item.id} value={item.id}>{item.name}{!item.recipeId ? ' ⚠️' : ''}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => handleAddModifier(group.id, groupIdx)}
                                            disabled={!newModName.trim()}
                                            className="px-3 py-1.5 bg-[#2F6B4E] hover:bg-[#2F6B4E]/90 text-capsula-ivory-surface rounded-lg text-sm font-bold disabled:opacity-50"
                                        >
                                            Agregar
                                        </button>
                                        <button
                                            onClick={() => { setAddingModifierToGroup(null); setNewModName(''); setNewModPrice('0'); setNewModLinkedItem(''); }}
                                            className="px-3 py-1.5 bg-capsula-ink-muted hover:bg-capsula-ink-soft text-capsula-ivory-surface rounded-lg text-sm font-bold"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-5 py-2 border-t border-capsula-line">
                                    <button
                                        onClick={() => { setAddingModifierToGroup(group.id); setNewModName(''); setNewModPrice('0'); setNewModLinkedItem(''); }}
                                        className="text-sm text-capsula-navy hover:underline font-medium"
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
                <div className="rounded-xl border border-[#946A1C]/30 bg-[#F3EAD6]/40 p-4 text-sm text-[#946A1C]">
                    <strong>⚠️ Modificadores vinculados sin receta</strong> no descontarán inventario. Asegúrate de que el plato vinculado tenga su receta completa en el módulo de Recetas.
                </div>
            )}
        </div>
    );
}
