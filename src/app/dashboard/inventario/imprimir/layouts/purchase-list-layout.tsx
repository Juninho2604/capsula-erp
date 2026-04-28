import { formatNumber, formatCurrency } from '@/lib/utils';

export interface PurchaseItem {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    baseUnit: string;
    totalStock: number;
    minimumStock: number;
    reorderPoint: number;
    preferredSupplier: { id: string; name: string; code: string | null } | null;
    preferredUnitPrice: number | null;
}

interface Props {
    items: PurchaseItem[];
    subtitle?: string;
    /** Si true, muestra columna de costo unitario y total estimado */
    showCosts?: boolean;
}

/**
 * Layout "Lista de compras" — A4 portrait.
 *
 * Pensado para imprimir y mandar al área de compras / proveedores. Agrupa
 * por proveedor preferido para que el comprador pueda atacarlos en orden.
 * La cantidad sugerida = max(minimumStock, reorderPoint) - totalStock.
 *
 * Items SIN proveedor preferido aparecen en un grupo "(Sin proveedor)" al
 * final, para que alguien decida qué proveedor usar.
 */
export default function PurchaseListLayout({ items, subtitle, showCosts = true }: Props) {
    const today = new Date().toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

    // Calcular qty sugerida y agrupar por proveedor
    type Row = PurchaseItem & { suggestedQty: number; estimatedCost: number };
    const enriched: Row[] = items.map(item => {
        const target = Math.max(item.minimumStock, item.reorderPoint);
        const suggestedQty = Math.max(0, target - item.totalStock);
        const estimatedCost = item.preferredUnitPrice ? suggestedQty * item.preferredUnitPrice : 0;
        return { ...item, suggestedQty, estimatedCost };
    });

    const bySupplier = enriched.reduce<Record<string, { name: string; rows: Row[] }>>((acc, row) => {
        const key = row.preferredSupplier?.id ?? '__none__';
        const name = row.preferredSupplier?.name ?? '(Sin proveedor preferido)';
        if (!acc[key]) acc[key] = { name, rows: [] };
        acc[key].rows.push(row);
        return acc;
    }, {});
    // El grupo sin proveedor va al final
    const supplierKeys = Object.keys(bySupplier).sort((a, b) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return bySupplier[a].name.localeCompare(bySupplier[b].name);
    });

    const grandTotal = enriched.reduce((sum, r) => sum + r.estimatedCost, 0);
    const totalItems = enriched.length;

    return (
        <div className="print-page mx-auto bg-white p-8 text-black">
            {/* Header */}
            <header className="mb-6 border-b-2 border-black pb-3">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Lista de compras sugerida</h1>
                        {subtitle && <p className="mt-1 text-sm">{subtitle}</p>}
                        <p className="mt-1 text-xs italic">
                            Cantidad sugerida = max(stock mínimo, punto de reorden) − stock actual
                        </p>
                    </div>
                    <div className="text-right text-sm">
                        <p><strong>Fecha:</strong> {today}</p>
                        <p><strong>Items:</strong> {totalItems}</p>
                        <p><strong>Proveedores:</strong> {Object.keys(bySupplier).filter(k => k !== '__none__').length}</p>
                    </div>
                </div>
            </header>

            {/* Tabla por proveedor */}
            {supplierKeys.map(key => {
                const group = bySupplier[key];
                const subtotal = group.rows.reduce((s, r) => s + r.estimatedCost, 0);
                return (
                    <section key={key} className="mb-5 break-inside-avoid">
                        <h2 className="mb-1 flex items-baseline justify-between border-b border-black bg-black/5 px-2 py-1 text-xs font-bold uppercase tracking-wide">
                            <span>{group.name} ({group.rows.length})</span>
                            {showCosts && subtotal > 0 && (
                                <span className="text-right">Subtotal: <span className="tabular-nums">{formatCurrency(subtotal)}</span></span>
                            )}
                        </h2>
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-black">
                                    <th className="w-[80px] px-2 py-1 text-left font-bold">SKU</th>
                                    <th className="px-2 py-1 text-left font-bold">Producto</th>
                                    <th className="w-[55px] px-2 py-1 text-center font-bold">Unidad</th>
                                    <th className="w-[60px] px-2 py-1 text-right font-bold">Stock</th>
                                    <th className="w-[55px] px-2 py-1 text-right font-bold">Mín.</th>
                                    <th className="w-[60px] px-2 py-1 text-right font-bold">Sug.</th>
                                    {showCosts && (
                                        <>
                                            <th className="w-[70px] px-2 py-1 text-right font-bold">Precio</th>
                                            <th className="w-[80px] px-2 py-1 text-right font-bold">Estimado</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {group.rows.map(row => (
                                    <tr key={row.id} className="border-b border-black/30">
                                        <td className="px-2 py-1.5 font-mono text-[10px]">{row.sku}</td>
                                        <td className="px-2 py-1.5">{row.name}</td>
                                        <td className="px-2 py-1.5 text-center text-[10px]">{row.baseUnit}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(row.totalStock)}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums text-black/60">{formatNumber(row.minimumStock)}</td>
                                        <td className="px-2 py-1.5 text-right font-bold tabular-nums">{formatNumber(row.suggestedQty)}</td>
                                        {showCosts && (
                                            <>
                                                <td className="px-2 py-1.5 text-right tabular-nums">
                                                    {row.preferredUnitPrice ? formatCurrency(row.preferredUnitPrice) : '—'}
                                                </td>
                                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                                                    {row.estimatedCost > 0 ? formatCurrency(row.estimatedCost) : '—'}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                );
            })}

            {items.length === 0 && (
                <div className="my-12 text-center text-sm">
                    Sin items que coincidan con los filtros actuales.
                </div>
            )}

            {/* Total general */}
            {showCosts && grandTotal > 0 && (
                <div className="mt-6 border-t-2 border-black pt-2 text-right text-sm font-bold">
                    Total estimado: <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
                </div>
            )}

            {/* Pie de firma */}
            <footer className="mt-10 grid grid-cols-2 gap-8 text-xs">
                <div className="text-center">
                    <div className="border-t border-black pt-1">Solicitado por</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-black pt-1">Aprobado por</div>
                </div>
            </footer>
        </div>
    );
}
