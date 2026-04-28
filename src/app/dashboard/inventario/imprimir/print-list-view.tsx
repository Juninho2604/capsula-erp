'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
    ArrowLeft,
    Printer,
    Search,
    ClipboardList,
    ShoppingCart,
} from 'lucide-react';
import { fuzzySearch } from '@/lib/fuzzy-search';
import { cn } from '@/lib/utils';
import PhysicalCountLayout from './layouts/physical-count-layout';
import PurchaseListLayout from './layouts/purchase-list-layout';

type Layout = 'count' | 'purchase';
type StockFilter = 'ALL' | 'BELOW_MIN' | 'BELOW_REORDER' | 'NONE' | 'OK';

interface PrintItem {
    id: string;
    sku: string;
    name: string;
    type: string;
    category: string | null;
    baseUnit: string;
    minimumStock: number;
    reorderPoint: number;
    isCritical: boolean;
    isBeverage: boolean;
    family: { id: string; code: string; name: string } | null;
    currentCost: number;
    totalStock: number;
    stockByArea: Array<{ areaId: string; areaName: string; quantity: number }>;
    criticalAreaIds: string[];
    preferredSupplier: { id: string; name: string; code: string | null } | null;
    preferredUnitPrice: number | null;
}

interface Area {
    id: string;
    name: string;
}

interface Props {
    items: PrintItem[];
    areas: Area[];
}

/**
 * Vista de impresión de inventario. Cliente con filtros + selector de
 * layout + react-to-print. La región imprimible está envuelta en un div
 * con ref que el hook usa.
 *
 * Filtros (todos opcionales y combinables):
 * - Tipo (RAW_MATERIAL / SUB_RECIPE / FINISHED_GOOD)
 * - Categoría
 * - Área (cuando se selecciona, el stock mostrado es el de esa área)
 * - Estado de stock (todos / bajo mínimo / bajo reorder / sin stock / OK)
 * - Solo críticos
 * - Solo bebidas
 * - Búsqueda fuzzy (nombre / SKU / categoría)
 *
 * Layouts disponibles:
 * - "count": conteo físico con casillas vacías para anotar a mano.
 * - "purchase": lista de compras agrupada por proveedor preferido,
 *   filtra automáticamente items donde stock < reorderPoint.
 */
export default function PrintListView({ items, areas }: Props) {
    const [layout, setLayout] = useState<Layout>('count');
    const [typeFilter, setTypeFilter] = useState<'ALL' | string>('ALL');
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
    const [areaId, setAreaId] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<'ALL' | string>('ALL');
    const [criticalOnly, setCriticalOnly] = useState(false);
    const [beveragesOnly, setBeveragesOnly] = useState<'ALL' | 'BEV' | 'NON'>('ALL');
    const [search, setSearch] = useState('');

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: layout === 'count' ? 'Conteo físico de inventario' : 'Lista de compras',
        pageStyle: `
            @page { size: A4 portrait; margin: 12mm; }
            @media print {
                body { background: white !important; color: black !important; }
                .print-page { box-shadow: none !important; max-width: none !important; }
            }
        `,
    });

    const uniqueCategories = useMemo(
        () => Array.from(new Set(items.map(i => i.category).filter((c): c is string => !!c))).sort(),
        [items],
    );

    const filtered = useMemo(() => {
        let result = items.filter(item => {
            if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
            if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
            if (beveragesOnly === 'BEV' && !item.isBeverage) return false;
            if (beveragesOnly === 'NON' && item.isBeverage) return false;

            if (criticalOnly) {
                // Si hay área seleccionada → crítico para esa área específicamente.
                // Sin área → cualquier marcador (isCritical global o lista por área).
                if (areaId) {
                    if (!item.criticalAreaIds.includes(areaId)) return false;
                } else if (!item.isCritical && item.criticalAreaIds.length === 0) {
                    return false;
                }
            }

            // Stock para evaluación
            const stock = areaId
                ? (item.stockByArea.find(s => s.areaId === areaId)?.quantity ?? 0)
                : item.totalStock;

            if (stockFilter === 'BELOW_MIN' && stock >= item.minimumStock) return false;
            if (stockFilter === 'BELOW_REORDER' && stock >= item.reorderPoint) return false;
            if (stockFilter === 'NONE' && stock !== 0) return false;
            if (stockFilter === 'OK' && stock < item.minimumStock) return false;

            return true;
        });

        if (search.trim()) {
            result = fuzzySearch(result, search, { keys: ['name', 'sku', 'category'] });
        }

        // Para purchase layout: solo dejar items donde la sugerencia de compra > 0
        if (layout === 'purchase') {
            result = result.filter(item => {
                const stock = areaId
                    ? (item.stockByArea.find(s => s.areaId === areaId)?.quantity ?? 0)
                    : item.totalStock;
                const target = Math.max(item.minimumStock, item.reorderPoint);
                return stock < target;
            });
        }

        return result;
    }, [items, typeFilter, categoryFilter, beveragesOnly, criticalOnly, areaId, stockFilter, search, layout]);

    // Para physical-count layout, si hay área seleccionada, el stock mostrado es el de esa área.
    const itemsForLayout = useMemo(() => {
        if (!areaId) return filtered;
        return filtered.map(item => ({
            ...item,
            totalStock: item.stockByArea.find(s => s.areaId === areaId)?.quantity ?? 0,
        }));
    }, [filtered, areaId]);

    const selectedAreaName = areaId ? areas.find(a => a.id === areaId)?.name : undefined;
    const subtitle = selectedAreaName ? `Solo área: ${selectedAreaName}` : 'Todas las áreas';

    return (
        <div className="space-y-6 animate-in">
            {/* Header — oculto al imprimir */}
            <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/inventario"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-capsula-line text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                        aria-label="Volver a Inventario"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">
                            Imprimir lista de inventario
                        </h1>
                        <p className="text-capsula-ink-muted">
                            {filtered.length} de {items.length} items con los filtros actuales
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => handlePrint()}
                    disabled={filtered.length === 0}
                    className="pos-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Printer className="h-4 w-4" /> Imprimir
                </button>
            </div>

            {/* Selector de layout — oculto al imprimir */}
            <div className="grid gap-2 print:hidden sm:grid-cols-2">
                <button
                    onClick={() => setLayout('count')}
                    className={cn(
                        'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                        layout === 'count'
                            ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                            : 'border-capsula-line bg-capsula-ivory hover:border-capsula-line-strong',
                    )}
                >
                    <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-capsula-ink-soft" />
                    <div>
                        <p className="font-semibold text-capsula-ink">Conteo físico</p>
                        <p className="mt-0.5 text-xs text-capsula-ink-muted">
                            Tabla A4 con casillas vacías para anotar el conteo manual y la varianza.
                        </p>
                    </div>
                </button>
                <button
                    onClick={() => setLayout('purchase')}
                    className={cn(
                        'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                        layout === 'purchase'
                            ? 'border-capsula-navy-deep bg-capsula-navy-soft'
                            : 'border-capsula-line bg-capsula-ivory hover:border-capsula-line-strong',
                    )}
                >
                    <ShoppingCart className="mt-0.5 h-5 w-5 shrink-0 text-capsula-ink-soft" />
                    <div>
                        <p className="font-semibold text-capsula-ink">Lista de compras</p>
                        <p className="mt-0.5 text-xs text-capsula-ink-muted">
                            Solo items bajo punto de reorden, agrupados por proveedor preferido,
                            con cantidad sugerida y costo estimado.
                        </p>
                    </div>
                </button>
            </div>

            {/* Filtros — ocultos al imprimir */}
            <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-5 shadow-sm print:hidden">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label className="pos-label">Tipo</label>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}
                            className="pos-input mt-1 w-full"
                        >
                            <option value="ALL">Todos los tipos</option>
                            <option value="RAW_MATERIAL">Insumos</option>
                            <option value="SUB_RECIPE">Sub-recetas</option>
                            <option value="FINISHED_GOOD">Productos finales</option>
                        </select>
                    </div>
                    <div>
                        <label className="pos-label">Categoría</label>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="pos-input mt-1 w-full"
                        >
                            <option value="ALL">Todas</option>
                            {uniqueCategories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="pos-label">Área</label>
                        <select
                            value={areaId}
                            onChange={e => setAreaId(e.target.value)}
                            className="pos-input mt-1 w-full"
                        >
                            <option value="">Todas las áreas</option>
                            {areas.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="pos-label">Estado de stock</label>
                        <select
                            value={stockFilter}
                            onChange={e => setStockFilter(e.target.value as StockFilter)}
                            className="pos-input mt-1 w-full"
                        >
                            <option value="ALL">Todos</option>
                            <option value="BELOW_MIN">Bajo mínimo</option>
                            <option value="BELOW_REORDER">Bajo punto de reorden</option>
                            <option value="NONE">Sin stock</option>
                            <option value="OK">OK (≥ mínimo)</option>
                        </select>
                    </div>
                    <div>
                        <label className="pos-label">Bebidas</label>
                        <select
                            value={beveragesOnly}
                            onChange={e => setBeveragesOnly(e.target.value as 'ALL' | 'BEV' | 'NON')}
                            className="pos-input mt-1 w-full"
                        >
                            <option value="ALL">Bebidas + no-bebidas</option>
                            <option value="BEV">Solo bebidas</option>
                            <option value="NON">Solo no-bebidas</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-capsula-line bg-capsula-ivory-alt px-3 py-2.5">
                            <input
                                type="checkbox"
                                checked={criticalOnly}
                                onChange={e => setCriticalOnly(e.target.checked)}
                                className="h-4 w-4 rounded border-capsula-line accent-capsula-navy-deep"
                            />
                            <span className="text-sm text-capsula-ink">Solo críticos</span>
                        </label>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="pos-label">Búsqueda</label>
                        <div className="relative mt-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por nombre, SKU o categoría..."
                                className="pos-input w-full pl-10"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Vista previa imprimible */}
            <div className="overflow-x-auto rounded-xl border border-capsula-line bg-capsula-ivory-alt p-4 print:m-0 print:overflow-visible print:rounded-none print:border-0 print:bg-white print:p-0">
                <div ref={printRef} className="mx-auto" style={{ width: '210mm', maxWidth: '100%' }}>
                    {layout === 'count' ? (
                        <PhysicalCountLayout
                            items={itemsForLayout}
                            selectedAreaName={selectedAreaName}
                            subtitle={subtitle}
                        />
                    ) : (
                        <PurchaseListLayout
                            items={itemsForLayout}
                            subtitle={subtitle}
                            showCosts
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
