'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Package,
    Loader2,
    Check,
    AlertTriangle,
    History,
    Lightbulb,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { registrarEntradaMercancia } from '@/app/actions/entrada.actions';
import { Combobox } from '@/components/ui/combobox';

interface Props {
    itemsList: any[];
    areasList: any[];
}

export default function CompraForm({ itemsList, areasList }: Props) {
    const { user, canViewCosts } = useAuthStore();
    const [showCosts, setShowCosts] = useState(false);
    useEffect(() => { setShowCosts(canViewCosts()); }, [canViewCosts]);

    const [selectedItem, setSelectedItem] = useState('');
    const [quantity, setQuantity] = useState<number>(0);
    const [unit, setUnit] = useState('UNIT');
    const [unitCost, setUnitCost] = useState<number>(0);
    const [areaId, setAreaId] = useState(areasList[0]?.id || '');
    const [notes, setNotes] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [recentPurchases, setRecentPurchases] = useState<{
        item: string;
        quantity: number;
        unit: string;
        cost: number;
        timestamp: Date;
    }[]>([]);

    const selectedItemData = itemsList.find(i => i.id === selectedItem);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || quantity <= 0) return;

        setIsSubmitting(true);
        setResult(null);

        try {
            const response = await registrarEntradaMercancia({
                inventoryItemId: selectedItem,
                quantity,
                unit,
                unitCost,
                areaId,
                notes,
                userId: user?.id || 'cmkvq94uo0000ua0ns6g844yr',
            });

            if (response.success) {
                setResult({ success: true, message: response.message });

                setRecentPurchases(prev => [{
                    item: selectedItemData?.name || selectedItem,
                    quantity,
                    unit,
                    cost: quantity * unitCost,
                    timestamp: new Date(),
                }, ...prev.slice(0, 4)]);

                setSelectedItem('');
                setQuantity(0);
                setUnitCost(0);
                setNotes('');
            } else {
                setResult({ success: false, message: response.message });
            }
        } catch (error) {
            setResult({ success: false, message: 'Error al procesar la compra' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/inventario"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-capsula-line text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                        aria-label="Volver a Inventario"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Compra Rápida</h1>
                        <p className="text-capsula-ink-muted">
                            Ingreso simple sin nota de entrega
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Formulario */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="rounded-xl border border-capsula-line bg-capsula-ivory p-6 shadow-sm">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-capsula-navy-deep text-capsula-ivory shadow-cap-soft">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Nueva Entrada de Inventario</h2>
                                <p className="text-sm text-capsula-ink-muted">
                                    Registrado por: {user?.firstName || 'Usuario'}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Insumo */}
                            <div className="sm:col-span-2">
                                <label className="pos-label">Insumo *</label>
                                <div className="mt-1">
                                    <Combobox
                                        items={itemsList.map(item => ({
                                            value: item.id,
                                            label: `${item.name} (${item.baseUnit})`
                                        }))}
                                        value={selectedItem || ''}
                                        onChange={(val) => {
                                            setSelectedItem(val);
                                            const item = itemsList.find(i => i.id === val);
                                            if (item) {
                                                setUnit(item.baseUnit);
                                                setUnitCost(item.currentCost || 0);
                                            }
                                        }}
                                        placeholder="Seleccionar insumo..."
                                        searchPlaceholder="Buscar insumo..."
                                        emptyMessage="No se encontró el insumo."
                                    />
                                </div>
                            </div>

                            {/* Cantidad */}
                            <div>
                                <label className="pos-label">Cantidad *</label>
                                <div className="mt-1 flex gap-2">
                                    <input
                                        type="number"
                                        value={quantity || ''}
                                        onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        required
                                        placeholder="0"
                                        className="pos-input w-24 tabular-nums"
                                    />
                                    <select
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        className="pos-input flex-1"
                                    >
                                        <option value={selectedItemData?.baseUnit || 'UNIT'}>
                                            {selectedItemData?.baseUnit || 'UNIT'}
                                        </option>
                                    </select>
                                </div>
                            </div>

                            {/* Costo Unitario */}
                            <div>
                                <label className="pos-label">Costo por Unidad (USD) *</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-capsula-ink-muted">$</span>
                                    <input
                                        type="number"
                                        value={unitCost || ''}
                                        onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        required
                                        placeholder="0.00"
                                        className="pos-input w-full py-2.5 pl-8 pr-4 tabular-nums"
                                    />
                                </div>
                            </div>

                            {/* Área destino */}
                            <div>
                                <label className="pos-label">Área de Almacenamiento</label>
                                <select
                                    value={areaId}
                                    onChange={(e) => setAreaId(e.target.value)}
                                    className="pos-input mt-1 w-full"
                                >
                                    {areasList.map(area => (
                                        <option key={area.id} value={area.id}>
                                            {area.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Costo Total */}
                            <div>
                                <label className="pos-label">Costo Total</label>
                                <div className="mt-1 flex items-center rounded-lg border border-capsula-line bg-capsula-ivory-alt px-4 py-2.5">
                                    <span className="font-semibold text-lg tracking-[-0.01em] tabular-nums text-capsula-ink">
                                        {formatCurrency(quantity * unitCost)}
                                    </span>
                                </div>
                            </div>

                            {/* Notas */}
                            <div className="sm:col-span-2">
                                <label className="pos-label">Notas (opcional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ej: Compra de emergencia en mercado local"
                                    rows={2}
                                    className="pos-input mt-1 w-full"
                                />
                            </div>
                        </div>

                        {/* Resultado */}
                        {result && (
                            <div className={cn(
                                'mt-4 rounded-lg border p-4',
                                result.success
                                    ? 'border-[#D3E2D8] bg-[#E5EDE7]/40 dark:border-[#3a5b48] dark:bg-[#1E3B2C]/40'
                                    : 'border-[#E8C2B7] bg-[#F7E3DB]/40 dark:border-[#5b3328] dark:bg-[#3B1F14]/40'
                            )}>
                                <div className="flex items-center gap-2">
                                    {result.success
                                        ? <Check className="h-4 w-4 text-[#2F6B4E] dark:text-[#6FB88F]" />
                                        : <AlertTriangle className="h-4 w-4 text-[#B04A2E] dark:text-[#EFD2C8]" />}
                                    <p className={cn(
                                        'font-medium',
                                        result.success
                                            ? 'text-[#2F6B4E] dark:text-[#6FB88F]'
                                            : 'text-[#B04A2E] dark:text-[#EFD2C8]'
                                    )}>
                                        {result.message}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Botón */}
                        <div className="mt-6 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedItem || quantity <= 0}
                                className="pos-btn inline-flex items-center gap-2 px-6 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
                                    </>
                                ) : (
                                    <>
                                        <Package className="h-4 w-4" /> Registrar Entrada
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Panel lateral - Compras recientes */}
                <div className="space-y-4">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory p-6 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 font-semibold text-lg tracking-[-0.01em] text-capsula-ink">
                            <History className="h-5 w-5 text-capsula-ink-soft" /> Compras Recientes
                        </h3>

                        {recentPurchases.length === 0 ? (
                            <p className="text-center text-sm text-capsula-ink-muted">
                                Las compras registradas en esta sesión aparecerán aquí
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentPurchases.map((purchase, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-lg bg-capsula-ivory-alt p-3"
                                    >
                                        <p className="font-medium text-capsula-ink">
                                            {purchase.item}
                                        </p>
                                        <div className="mt-1 flex items-center justify-between text-sm">
                                            <span className="text-capsula-ink-muted tabular-nums">
                                                +{formatNumber(purchase.quantity)} {purchase.unit}
                                            </span>
                                            {showCosts && (
                                                <span className="font-mono text-capsula-ink tabular-nums">
                                                    {formatCurrency(purchase.cost)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-capsula-ink-faint">
                                            {purchase.timestamp.toLocaleTimeString('es-VE')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info de conversión */}
                    <div className="rounded-xl border border-[#D1DCE9] bg-[#E6ECF4] p-4 dark:border-[#2a3a52] dark:bg-[#1A2636]">
                        <h4 className="mb-2 flex items-center gap-2 font-medium text-[#2A4060] dark:text-[#D1DCE9]">
                            <Lightbulb className="h-4 w-4" /> Conversiones Automáticas
                        </h4>
                        <ul className="space-y-1 text-sm text-[#2A4060]/85 dark:text-[#D1DCE9]/85">
                            <li>• Leche: 1 saco = 20 litros</li>
                            <li>• El sistema convierte a unidad base</li>
                            <li>• Costo promedio ponderado</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
