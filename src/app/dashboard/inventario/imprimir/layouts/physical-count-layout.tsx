import { formatNumber } from '@/lib/utils';

export interface PrintItem {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    baseUnit: string;
    totalStock: number;
    minimumStock: number;
    stockByArea: Array<{ areaId: string; areaName: string; quantity: number }>;
}

interface Props {
    items: PrintItem[];
    /** Area filtrada (undefined = todas). Si está, mostramos solo el stock de esa área */
    selectedAreaId?: string;
    selectedAreaName?: string;
    /** Subtítulo que va debajo del título principal — fecha, sucursal, etc. */
    subtitle?: string;
    /** Si true, muestra columna "Mínimo" para que el operador vea la referencia */
    showMinimumColumn?: boolean;
}

/**
 * Layout de "Conteo físico" — A4 portrait.
 *
 * Pensado para imprimir, llevarlo a la bodega y anotar a mano el conteo
 * físico en las dos columnas finales ("Contado" y "Varianza"). Los items
 * vienen del filtro elegido en print-list-view; este componente solo
 * pinta la tabla.
 *
 * Las columnas son intencionalmente generosas (col Contado y Varianza
 * de 90px cada una) para que el operador escriba con bolígrafo.
 *
 * Uso desde print-list-view (envuelto en un div ref={printRef} que
 * react-to-print imprime).
 */
export default function PhysicalCountLayout({
    items,
    selectedAreaName,
    subtitle,
    showMinimumColumn = true,
}: Props) {
    const today = new Date().toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

    // Agrupar por categoría para mejor lectura física
    const byCategory = items.reduce<Record<string, PrintItem[]>>((acc, item) => {
        const cat = item.category || 'Sin categoría';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});
    const sortedCats = Object.keys(byCategory).sort();

    return (
        <div className="print-page mx-auto bg-white p-8 text-black">
            {/* Header */}
            <header className="mb-6 border-b-2 border-black pb-3">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Conteo físico de inventario</h1>
                        {subtitle && <p className="mt-1 text-sm">{subtitle}</p>}
                        {selectedAreaName && (
                            <p className="mt-1 text-sm">
                                <strong>Área:</strong> {selectedAreaName}
                            </p>
                        )}
                    </div>
                    <div className="text-right text-sm">
                        <p><strong>Fecha:</strong> {today}</p>
                        <p><strong>Items:</strong> {items.length}</p>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <span className="font-semibold">Contado por:</span>
                        <span className="ml-2 inline-block w-48 border-b border-black">&nbsp;</span>
                    </div>
                    <div>
                        <span className="font-semibold">Verificado por:</span>
                        <span className="ml-2 inline-block w-48 border-b border-black">&nbsp;</span>
                    </div>
                </div>
            </header>

            {/* Tabla — agrupada por categoría */}
            {sortedCats.map(cat => (
                <section key={cat} className="mb-4 break-inside-avoid">
                    <h2 className="mb-1 border-b border-black bg-black/5 px-2 py-1 text-xs font-bold uppercase tracking-wide">
                        {cat} ({byCategory[cat].length})
                    </h2>
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-black">
                                <th className="w-[80px] px-2 py-1 text-left font-bold">SKU</th>
                                <th className="px-2 py-1 text-left font-bold">Producto</th>
                                <th className="w-[60px] px-2 py-1 text-center font-bold">Unidad</th>
                                <th className="w-[70px] px-2 py-1 text-right font-bold">Sistema</th>
                                {showMinimumColumn && (
                                    <th className="w-[60px] px-2 py-1 text-right font-bold">Mín.</th>
                                )}
                                <th className="w-[90px] border-l border-black px-2 py-1 text-center font-bold">Contado</th>
                                <th className="w-[90px] border-l border-black px-2 py-1 text-center font-bold">Varianza</th>
                            </tr>
                        </thead>
                        <tbody>
                            {byCategory[cat].map(item => (
                                <tr key={item.id} className="border-b border-black/30">
                                    <td className="px-2 py-1.5 font-mono text-[10px]">{item.sku}</td>
                                    <td className="px-2 py-1.5">{item.name}</td>
                                    <td className="px-2 py-1.5 text-center text-[10px]">{item.baseUnit}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(item.totalStock)}</td>
                                    {showMinimumColumn && (
                                        <td className="px-2 py-1.5 text-right tabular-nums text-black/60">{formatNumber(item.minimumStock)}</td>
                                    )}
                                    <td className="border-l border-black px-2 py-1.5">&nbsp;</td>
                                    <td className="border-l border-black px-2 py-1.5">&nbsp;</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            ))}

            {items.length === 0 && (
                <div className="my-12 text-center text-sm">
                    Sin items que coincidan con los filtros actuales.
                </div>
            )}

            {/* Pie de firma */}
            <footer className="mt-12 grid grid-cols-3 gap-8 text-xs">
                <div className="text-center">
                    <div className="border-t border-black pt-1">Firma del contador</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-black pt-1">Firma del verificador</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-black pt-1">Firma del gerente</div>
                </div>
            </footer>
        </div>
    );
}
