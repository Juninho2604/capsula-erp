'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { formatNumber, formatCurrency, getStockStatus, cn } from '@/lib/utils';
import { InventoryItemType } from '@/types';
import { ItemEditDialog } from './edit-item-dialog';
import { deleteInventoryItemAction } from '@/app/actions/inventory.actions';
import {
    Trash2, Package, ClipboardList, FileDown, Calendar, History,
    Search, Warehouse, Layers, UtensilsCrossed, AlertTriangle,
    ChevronDown, ChevronUp, ChevronsUpDown, Loader2, Pencil, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';

type FilterType = 'ALL' | InventoryItemType;
type StockFilter = 'ALL' | 'LOW' | 'OK';

interface InventoryViewProps {
    initialItems: any[];
    initialAreas?: { id: string; name: string }[];
}

export default function InventoryView({ initialItems, initialAreas = [] }: InventoryViewProps) {
    const { canViewCosts, hasRole } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => {
        setShowCosts(canViewCosts());
    }, [canViewCosts]);

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
                window.location.reload();
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
            return <ChevronsUpDown className="ml-1 h-3 w-3 text-capsula-ink-faint opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.5} />;
        }
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="ml-1 h-3 w-3 text-capsula-coral" strokeWidth={2} />
            : <ChevronDown className="ml-1 h-3 w-3 text-capsula-coral" strokeWidth={2} />;
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

    const typeLabel = (type: string) => {
        if (type === 'RAW_MATERIAL') return 'Insumo';
        if (type === 'SUB_RECIPE') return 'Sub-receta';
        return 'Producto';
    };
    const typeBadgeVariant = (type: string): 'info' | 'coral' | 'ok' => {
        if (type === 'RAW_MATERIAL') return 'info';
        if (type === 'SUB_RECIPE') return 'coral';
        return 'ok';
    };
    const TypeIcon = ({ type }: { type: string }) => {
        const Icon = type === 'RAW_MATERIAL' ? Package : type === 'SUB_RECIPE' ? Layers : UtensilsCrossed;
        return <Icon className="h-4 w-4 text-capsula-ink-soft" strokeWidth={1.5} />;
    };

    return (
        <div className="mx-auto max-w-[1400px] animate-in">
            <PageHeader
                kicker="Inventario"
                title="Stock y movimientos"
                description={`${filteredItems.length} de ${stats.total} ítems — controla existencias por almacén en tiempo real.`}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Warehouse className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                            <select
                                value={selectedArea}
                                onChange={(e) => setSelectedArea(e.target.value)}
                                className="h-10 rounded-full border border-capsula-line bg-capsula-ivory-surface pl-9 pr-8 text-[13px] text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                            >
                                <option value="">Todos los Almacenes</option>
                                {initialAreas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                        </div>
                        <Button asChild variant="primary">
                            <Link href="/dashboard/inventario/entrada">
                                <Plus className="h-4 w-4" strokeWidth={2} /> Entrada
                            </Link>
                        </Button>
                    </div>
                }
            />

            {/* Acciones secundarias */}
            <div className="mb-8 flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/inventario/compras">
                        <ClipboardList className="h-4 w-4" strokeWidth={1.5} /> Compra rápida
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/inventario/importar">
                        <FileDown className="h-4 w-4" strokeWidth={1.5} /> Importar Excel
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/inventario/diario">
                        <Calendar className="h-4 w-4" strokeWidth={1.5} /> Cierre diario
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/inventario/historial">
                        <History className="h-4 w-4" strokeWidth={1.5} /> Historial
                    </Link>
                </Button>
            </div>

            {/* KPIs */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <KpiCard
                    label="Total ítems"
                    value={stats.total}
                    onClick={() => { setTypeFilter('ALL'); setStockFilter('ALL'); }}
                    className={cn(typeFilter === 'ALL' && stockFilter === 'ALL' && 'border-capsula-navy-deep')}
                />
                <KpiCard
                    label="Insumos"
                    value={stats.rawMaterials}
                    icon={Package}
                    onClick={() => { setTypeFilter('RAW_MATERIAL'); setStockFilter('ALL'); }}
                    className={cn(typeFilter === 'RAW_MATERIAL' && 'border-capsula-navy-deep')}
                />
                <KpiCard
                    label="Sub-recetas"
                    value={stats.subRecipes}
                    icon={Layers}
                    onClick={() => { setTypeFilter('SUB_RECIPE'); setStockFilter('ALL'); }}
                    className={cn(typeFilter === 'SUB_RECIPE' && 'border-capsula-navy-deep')}
                />
                <KpiCard
                    label="Productos"
                    value={stats.finished}
                    icon={UtensilsCrossed}
                    onClick={() => { setTypeFilter('FINISHED_GOOD'); setStockFilter('ALL'); }}
                    className={cn(typeFilter === 'FINISHED_GOOD' && 'border-capsula-navy-deep')}
                />
                <KpiCard
                    label="Stock bajo"
                    value={stats.lowStock}
                    icon={AlertTriangle}
                    hint="requieren reabastecer"
                    trend={stats.lowStock > 0 ? 'down' : 'flat'}
                    onClick={() => { setTypeFilter('ALL'); setStockFilter('LOW'); }}
                    className={cn(stockFilter === 'LOW' && 'border-capsula-coral')}
                />
            </div>

            {/* Búsqueda */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" strokeWidth={1.5} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, SKU o categoría…"
                        className="w-full rounded-full border border-capsula-line bg-capsula-ivory-surface py-2.5 pl-10 pr-4 text-[14px] text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                    />
                </div>
            </div>

            {/* Tabla */}
            <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface">
                <div className="max-h-[70vh] overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-capsula-line bg-capsula-ivory">
                                <th
                                    className="group cursor-pointer px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted hover:text-capsula-ink"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center">Ítem <SortIcon columnKey="name" /></div>
                                </th>
                                <th
                                    className="group cursor-pointer px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted hover:text-capsula-ink"
                                    onClick={() => handleSort('type')}
                                >
                                    <div className="flex items-center">Tipo <SortIcon columnKey="type" /></div>
                                </th>
                                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">
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
                                            className="ml-1 rounded border border-capsula-line bg-capsula-ivory-surface px-1 py-0.5 text-[11px] font-normal normal-case tracking-normal text-capsula-ink-soft focus:border-capsula-navy-deep focus:outline-none"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="ALL">Todas</option>
                                            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </th>
                                <th
                                    className="group cursor-pointer px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted hover:text-capsula-ink"
                                    onClick={() => handleSort('currentStock')}
                                >
                                    <div className="flex items-center justify-end">
                                        {selectedArea ? 'Stock local' : 'Stock global'} <SortIcon columnKey="currentStock" />
                                    </div>
                                </th>
                                <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Estado</th>
                                {showCosts && (
                                    <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Costo/Unidad</th>
                                )}
                                <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item) => {
                                const displayStock = selectedArea
                                    ? (item.stockByArea?.find((s: any) => s.areaId === selectedArea)?.quantity || 0)
                                    : item.currentStock;

                                const stockStatus = getStockStatus(displayStock, item.minimumStock, item.reorderPoint);
                                const statusVariant: 'danger' | 'warn' | 'ok' =
                                    stockStatus.status === 'critical' ? 'danger' :
                                    stockStatus.status === 'warning' ? 'warn' : 'ok';
                                return (
                                    <tr key={item.id} className="border-b border-capsula-line transition-colors last:border-b-0 hover:bg-capsula-ivory">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory">
                                                    <TypeIcon type={item.type} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-capsula-ink">{item.name}</p>
                                                    <p className="font-mono text-[11.5px] text-capsula-ink-muted">{item.sku}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <Badge variant={typeBadgeVariant(item.type)}>{typeLabel(item.type)}</Badge>
                                        </td>
                                        <td className="px-5 py-3 text-capsula-ink-soft">{item.category || '—'}</td>
                                        <td className="px-5 py-3 text-right">
                                            <div>
                                                <span className={cn(
                                                    'font-mono text-[13px] font-semibold',
                                                    displayStock === 0 ? 'text-capsula-ink-faint' : 'text-capsula-ink'
                                                )}>
                                                    {formatNumber(displayStock)}
                                                </span>
                                                <span className="ml-1 text-[11px] text-capsula-ink-muted">{item.baseUnit}</span>
                                            </div>
                                            <p className="text-[11px] text-capsula-ink-faint">
                                                Mín: {formatNumber(item.minimumStock)}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <Badge variant={statusVariant}>{stockStatus.label}</Badge>
                                        </td>
                                        {showCosts && (
                                            <td className="px-5 py-3 text-right font-mono text-[12.5px] text-capsula-ink">
                                                {item.costPerUnit ? formatCurrency(item.costPerUnit) : '—'}
                                            </td>
                                        )}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setEditingItem(item)}
                                                    className="rounded-md p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-ivory hover:text-capsula-navy"
                                                    title="Editar ítem"
                                                >
                                                    <Pencil className="h-4 w-4" strokeWidth={1.5} />
                                                </button>
                                                {hasRole(['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER']) && (
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        disabled={isDeleting === item.id}
                                                        className="rounded-md p-1.5 text-capsula-ink-muted transition-colors hover:bg-capsula-coral-subtle hover:text-capsula-coral disabled:opacity-50"
                                                        title="Eliminar ítem (Solo Gerentes)"
                                                    >
                                                        {isDeleting === item.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
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
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <Search className="h-8 w-8 text-capsula-ink-faint" strokeWidth={1.5} />
                        <p className="mt-3 font-medium text-capsula-ink">No se encontraron ítems</p>
                        <p className="text-[13px] text-capsula-ink-muted">Intenta con otros filtros</p>
                    </div>
                )}
            </div>

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
