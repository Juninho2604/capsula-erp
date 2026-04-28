'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Package,
    Layers,
    UtensilsCrossed,
    Pencil,
    FileText,
    ShoppingCart,
    Upload,
    Calendar,
    History,
    Search,
    ChevronsUpDown,
    ChevronUp,
    ChevronDown,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber, formatCurrency, getStockStatus, cn } from '@/lib/utils';
import { InventoryItemType } from '@/types';
import { ItemEditDialog } from './edit-item-dialog';
import { deleteInventoryItemAction } from '@/app/actions/inventory.actions';
import toast from 'react-hot-toast';

type FilterType = 'ALL' | InventoryItemType;
type StockFilter = 'ALL' | 'LOW' | 'OK';

interface InventoryViewProps {
    initialItems: any[];
    initialAreas?: { id: string; name: string }[];
}

const TYPE_META: Record<InventoryItemType, { label: string; Icon: typeof Package }> = {
    RAW_MATERIAL: { label: 'Insumo', Icon: Package },
    SUB_RECIPE: { label: 'Sub-receta', Icon: Layers },
    FINISHED_GOOD: { label: 'Producto', Icon: UtensilsCrossed },
};

const STATUS_TONE: Record<'critical' | 'warning' | 'ok', string> = {
    critical: 'bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]',
    warning: 'bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]',
    ok: 'bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]',
};

const STATUS_DOT: Record<'critical' | 'warning' | 'ok', string> = {
    critical: 'bg-[#B04A2E] dark:bg-[#EFD2C8]',
    warning: 'bg-[#946A1C] dark:bg-[#E8D9B8]',
    ok: 'bg-[#2F6B4E] dark:bg-[#6FB88F]',
};

export default function InventoryView({ initialItems, initialAreas = [] }: InventoryViewProps) {
    const router = useRouter();
    const { canViewCosts, hasRole } = useAuthStore();
    // Defer showCosts to client-side to avoid hydration mismatch
    // (Zustand store has no user during SSR, so canViewCosts() returns false on server but true on client)
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => {
        setShowCosts(canViewCosts());
    }, [canViewCosts]);

    // Filtros
    const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (item: any) => {
        if (!confirm(`¿Estás seguro de eliminar el producto "${item.name}"? Esta acción no se puede deshacer.`)) return;

        setIsDeleting(item.id);
        try {
            const res = await deleteInventoryItemAction(item.id);
            if (res.success) {
                toast.success('Producto eliminado correctamente');
                router.refresh();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error('Error al eliminar el producto');
            console.error(error);
        } finally {
            setIsDeleting(null);
        }
    };

    const uniqueCategories = useMemo(() => {
        const cats = new Set(initialItems.map(i => i.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [initialItems]);

    const filteredItems = useMemo(() => {
        let items = initialItems.filter(item => {
            if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

            if (stockFilter !== 'ALL') {
                const stockToCheck = selectedArea
                    ? (item.stockByArea?.find((s: any) => s.areaId === selectedArea)?.quantity || 0)
                    : item.currentStock;

                const status = getStockStatus(stockToCheck, item.minimumStock, item.reorderPoint);
                if (stockFilter === 'LOW' && status.status === 'ok') return false;
                if (stockFilter === 'OK' && status.status !== 'ok') return false;
            }

            if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    item.name.toLowerCase().includes(query) ||
                    item.sku.toLowerCase().includes(query) ||
                    item.category?.toLowerCase().includes(query)
                );
            }

            return true;
        });

        if (sortConfig) {
            items.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'currentStock') {
                    aValue = selectedArea
                        ? (a.stockByArea?.find((s: any) => s.areaId === selectedArea)?.quantity || 0)
                        : a.currentStock;
                    bValue = selectedArea
                        ? (b.stockByArea?.find((s: any) => s.areaId === selectedArea)?.quantity || 0)
                        : b.currentStock;
                }

                if (aValue === bValue) return 0;
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return items;
    }, [initialItems, typeFilter, stockFilter, searchQuery, selectedArea, categoryFilter, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) {
            return <ChevronsUpDown className="ml-1 h-3 w-3 text-capsula-ink-faint opacity-0 transition-opacity group-hover:opacity-60" />;
        }
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="ml-1 h-3 w-3 text-capsula-coral" />
            : <ChevronDown className="ml-1 h-3 w-3 text-capsula-coral" />;
    };

    const stats = useMemo(() => ({
        total: initialItems.length,
        rawMaterials: initialItems.filter(i => i.type === 'RAW_MATERIAL').length,
        subRecipes: initialItems.filter(i => i.type === 'SUB_RECIPE').length,
        finished: initialItems.filter(i => i.type === 'FINISHED_GOOD').length,
        lowStock: initialItems.filter(i =>
            getStockStatus(i.currentStock, i.minimumStock, i.reorderPoint).status !== 'ok'
        ).length,
    }), [initialItems]);

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Inventario</h1>
                    <p className="text-capsula-ink-muted">
                        {filteredItems.length} de {stats.total} items
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <select
                            value={selectedArea}
                            onChange={(e) => setSelectedArea(e.target.value)}
                            className="pos-input min-w-[180px]"
                        >
                            <option value="">Todos los Almacenes</option>
                            {initialAreas.map(area => (
                                <option key={area.id} value={area.id}>{area.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/dashboard/inventario/entrada"
                            className="pos-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                        >
                            <FileText className="h-4 w-4" /> Entrada de Mercancía
                        </Link>
                        <Link
                            href="/dashboard/inventario/compras"
                            className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                        >
                            <ShoppingCart className="h-4 w-4" /> Compra Rápida
                        </Link>
                        <Link
                            href="/dashboard/inventario/importar"
                            className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                        >
                            <Upload className="h-4 w-4" /> Importar Excel
                        </Link>
                        <Link
                            href="/dashboard/inventario/diario"
                            className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                        >
                            <Calendar className="h-4 w-4" /> Cierre Diario
                        </Link>
                        <Link
                            href="/dashboard/inventario/historial"
                            className="pos-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                        >
                            <History className="h-4 w-4" /> Historial
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <button
                    onClick={() => { setTypeFilter('ALL'); setStockFilter('ALL'); }}
                    className={cn(
                        'rounded-lg border p-4 text-left transition-all',
                        typeFilter === 'ALL' && stockFilter === 'ALL'
                            ? 'border-capsula-navy bg-capsula-ivory-alt'
                            : 'border-capsula-line bg-capsula-ivory hover:border-capsula-line-strong'
                    )}
                >
                    <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink tabular-nums">{stats.total}</p>
                    <p className="text-sm text-capsula-ink-muted">Total Items</p>
                </button>

                <button
                    onClick={() => { setTypeFilter('RAW_MATERIAL'); setStockFilter('ALL'); }}
                    className={cn(
                        'rounded-lg border p-4 text-left transition-all',
                        typeFilter === 'RAW_MATERIAL'
                            ? 'border-capsula-navy bg-capsula-ivory-alt'
                            : 'border-capsula-line bg-capsula-ivory hover:border-capsula-line-strong'
                    )}
                >
                    <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink tabular-nums">{stats.rawMaterials}</p>
                    <p className="text-sm text-capsula-ink-muted">Insumos</p>
                </button>

                <button
                    onClick={() => { setTypeFilter('SUB_RECIPE'); setStockFilter('ALL'); }}
                    className={cn(
                        'rounded-lg border p-4 text-left transition-all',
                        typeFilter === 'SUB_RECIPE'
                            ? 'border-capsula-navy bg-capsula-ivory-alt'
                            : 'border-capsula-line bg-capsula-ivory hover:border-capsula-line-strong'
                    )}
                >
                    <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink tabular-nums">{stats.subRecipes}</p>
                    <p className="text-sm text-capsula-ink-muted">Sub-recetas</p>
                </button>

                <button
                    onClick={() => { setTypeFilter('FINISHED_GOOD'); setStockFilter('ALL'); }}
                    className={cn(
                        'rounded-lg border p-4 text-left transition-all',
                        typeFilter === 'FINISHED_GOOD'
                            ? 'border-capsula-navy bg-capsula-ivory-alt'
                            : 'border-capsula-line bg-capsula-ivory hover:border-capsula-line-strong'
                    )}
                >
                    <p className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink tabular-nums">{stats.finished}</p>
                    <p className="text-sm text-capsula-ink-muted">Productos</p>
                </button>

                <button
                    onClick={() => { setTypeFilter('ALL'); setStockFilter('LOW'); }}
                    className={cn(
                        'rounded-lg border p-4 text-left transition-all',
                        stockFilter === 'LOW'
                            ? 'border-capsula-coral bg-capsula-coral/10'
                            : 'border-capsula-line bg-capsula-ivory hover:border-capsula-line-strong'
                    )}
                >
                    <p className="font-semibold text-2xl tracking-[-0.02em] text-capsula-coral tabular-nums">{stats.lowStock}</p>
                    <p className="text-sm text-capsula-ink-muted">Stock Bajo</p>
                </button>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, SKU o categoría..."
                        className="pos-input w-full pl-10"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-capsula-line bg-capsula-ivory shadow-sm">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="w-full relative">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            <tr className="border-b border-capsula-line bg-capsula-ivory-alt">
                                <th
                                    className="group cursor-pointer px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted hover:bg-capsula-ivory-surface"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center">
                                        Item <SortIcon columnKey="name" />
                                    </div>
                                </th>
                                <th
                                    className="group cursor-pointer px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted hover:bg-capsula-ivory-surface"
                                    onClick={() => handleSort('type')}
                                >
                                    <div className="flex items-center">
                                        Tipo <SortIcon columnKey="type" />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="group flex cursor-pointer items-center hover:text-capsula-ink"
                                            onClick={() => handleSort('category')}
                                        >
                                            Categoría <SortIcon columnKey="category" />
                                        </div>
                                        <select
                                            value={categoryFilter}
                                            onChange={(e) => setCategoryFilter(e.target.value)}
                                            className="ml-1 rounded border border-capsula-line bg-capsula-ivory px-1 py-0.5 text-xs font-normal text-capsula-ink-soft focus:border-capsula-navy focus:outline-none"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="ALL">Todas</option>
                                            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </th>
                                <th
                                    className="group cursor-pointer px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted hover:bg-capsula-ivory-surface"
                                    onClick={() => handleSort('currentStock')}
                                >
                                    <div className="flex items-center justify-end">
                                        {selectedArea ? 'Stock Local' : 'Stock Global'} <SortIcon columnKey="currentStock" />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Estado
                                </th>
                                {showCosts && (
                                    <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                        Costo/Unidad
                                    </th>
                                )}
                                <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-capsula-line">
                            {filteredItems.map((item) => {
                                const displayStock = selectedArea
                                    ? (item.stockByArea?.find((s: any) => s.areaId === selectedArea)?.quantity || 0)
                                    : item.currentStock;

                                const stockStatus = getStockStatus(displayStock, item.minimumStock, item.reorderPoint);
                                const TypeIcon = TYPE_META[item.type as InventoryItemType]?.Icon ?? Package;
                                const typeLabel = TYPE_META[item.type as InventoryItemType]?.label ?? item.type;
                                const tone = (stockStatus.status as 'critical' | 'warning' | 'ok') ?? 'ok';

                                return (
                                    <tr key={item.id} className="transition-colors hover:bg-capsula-ivory-surface">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-capsula-ivory-alt text-capsula-ink-soft">
                                                    <TypeIcon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-capsula-ink">{item.name}</p>
                                                    <p className="text-xs text-capsula-ink-muted font-mono">{item.sku}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-capsula-ivory-alt px-2.5 py-0.5 text-xs font-medium text-capsula-ink-soft">
                                                <TypeIcon className="h-3 w-3" />
                                                {typeLabel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-capsula-ink-muted">
                                            {item.category || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div>
                                                <span className={cn(
                                                    "font-mono text-sm font-semibold tabular-nums",
                                                    displayStock === 0 ? "text-capsula-ink-faint" : "text-capsula-ink"
                                                )}>
                                                    {formatNumber(displayStock)}
                                                </span>
                                                <span className="ml-1 text-xs text-capsula-ink-muted">{item.baseUnit}</span>
                                            </div>
                                            <p className="text-xs text-capsula-ink-faint">
                                                Mín: {formatNumber(item.minimumStock)}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={cn(
                                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                STATUS_TONE[tone]
                                            )}>
                                                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[tone])} />
                                                {stockStatus.label}
                                            </span>
                                        </td>
                                        {showCosts && (
                                            <td className="px-6 py-4 text-right font-mono text-sm text-capsula-ink tabular-nums">
                                                {item.costPerUnit ? formatCurrency(item.costPerUnit) : '-'}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex items-center gap-1">
                                                <button
                                                    onClick={() => setEditingItem(item)}
                                                    className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink"
                                                    title="Editar ítem"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                {hasRole(['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER']) && (
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        disabled={isDeleting === item.id}
                                                        className="rounded-lg p-2 text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral disabled:opacity-50"
                                                        title="Eliminar ítem (Solo Gerentes)"
                                                    >
                                                        {isDeleting === item.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Package className="h-10 w-10 text-capsula-ink-faint" />
                        <p className="mt-2 font-medium text-capsula-ink">
                            No se encontraron items
                        </p>
                        <p className="text-sm text-capsula-ink-muted">
                            Intenta con otros filtros
                        </p>
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            {editingItem && (
                <ItemEditDialog
                    item={editingItem}
                    isOpen={!!editingItem}
                    onClose={() => setEditingItem(null)}
                />
            )}
        </div>
    );
}
