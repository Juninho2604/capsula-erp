'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

    // Estado del formulario
    const [selectedItem, setSelectedItem] = useState('');
    const [quantity, setQuantity] = useState<number>(0);
    const [unit, setUnit] = useState('UNIT');
    const [unitCost, setUnitCost] = useState<number>(0);
    const [areaId, setAreaId] = useState(areasList[0]?.id || '');
    const [notes, setNotes] = useState('');

    // Estado de UI
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [recentPurchases, setRecentPurchases] = useState<{
        item: string;
        quantity: number;
        unit: string;
        cost: number;
        timestamp: Date;
    }[]>([]);

    // Obtener item seleccionado
    const selectedItemData = itemsList.find(i => i.id === selectedItem);

    // Manejar envío
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || quantity <= 0) return;

        setIsSubmitting(true);
        setResult(null);

        try {
            // Usamos la misma action que Entrada de Mercancía, porque ambos son InventoryMovement type PURCHASE
            const response = await registrarEntradaMercancia({
                inventoryItemId: selectedItem,
                quantity,
                unit,
                unitCost,
                areaId,
                notes,
                userId: user?.id || 'cmkvq94uo0000ua0ns6g844yr', // Fallback ID desarrollo
            });

            if (response.success) {
                setResult({ success: true, message: response.message });

                // Agregar a compras recientes localmente
                setRecentPurchases(prev => [{
                    item: selectedItemData?.name || selectedItem,
                    quantity,
                    unit,
                    cost: quantity * unitCost,
                    timestamp: new Date(),
                }, ...prev.slice(0, 4)]);

                // Limpiar formulario
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-capsula-line text-capsula-ink-soft transition-colors hover:bg-capsula-ivory-alt"
                    >
                        ←
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-capsula-navy-deep">
                            Compra Rápida
                        </h1>
                        <p className="text-capsula-ink-soft">
                            Ingreso simple sin nota de entrega
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Formulario */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-2xl text-white shadow-lg">
                                📦
                            </div>
                            <div>
                                <h2 className="font-semibold text-capsula-navy-deep">
                                    Nueva Entrada de Inventario
                                </h2>
                                <p className="text-sm text-capsula-ink-soft">
                                    Registrado por: {user?.firstName || 'Usuario'}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Insumo */}
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink">
                                    Insumo *
                                </label>
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

                            {/* Cantidad */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink">
                                    Cantidad *
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={quantity || ''}
                                        onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        required
                                        placeholder="0"
                                        className="w-24 rounded-lg border border-capsula-line bg-capsula-ivory-surface px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                    />
                                    <select
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        className="flex-1 rounded-lg border border-capsula-line bg-capsula-ivory-surface px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                    >
                                        <option value={selectedItemData?.baseUnit || 'UNIT'}>
                                            {selectedItemData?.baseUnit || 'UNIT'}
                                        </option>
                                    </select>
                                </div>
                            </div>

                            {/* Costo Unitario */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink">
                                    Costo por Unidad (USD) *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-capsula-ink-muted">$</span>
                                    <input
                                        type="number"
                                        value={unitCost || ''}
                                        onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        required
                                        placeholder="0.00"
                                        className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface py-2.5 pl-8 pr-4 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Área destino */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink">
                                    Área de Almacenamiento
                                </label>
                                <select
                                    value={areaId}
                                    onChange={(e) => setAreaId(e.target.value)}
                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-4 py-2.5 text-capsula-ink focus:border-capsula-navy-deep focus:outline-none"
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
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink">
                                    Costo Total
                                </label>
                                <div className="flex items-center rounded-lg border border-capsula-line bg-capsula-ivory-alt px-4 py-2.5">
                                    <span className="text-lg font-bold text-capsula-navy-deep">
                                        {formatCurrency(quantity * unitCost)}
                                    </span>
                                </div>
                            </div>

                            {/* Notas */}
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-sm font-medium text-capsula-ink">
                                    Notas (opcional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ej: Compra de emergencia en mercado local"
                                    rows={2}
                                    className="w-full rounded-lg border border-capsula-line bg-capsula-ivory-surface px-4 py-2.5 text-capsula-ink placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Resultado */}
                        {result && (
                            <div className={cn(
                                'mt-4 rounded-lg p-4',
                                result.success
                                    ? 'bg-[#E5EDE7]/60 text-[#2F6B4E] border border-[#2F6B4E]/30'
                                    : 'bg-capsula-coral/10 text-capsula-coral border border-capsula-coral/30'
                            )}>
                                <div className="flex items-center gap-2">
                                    <span>{result.success ? '✅' : '❌'}</span>
                                    <p className="font-medium">{result.message}</p>
                                </div>
                            </div>
                        )}

                        {/* Botón */}
                        <div className="mt-6 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedItem || quantity <= 0}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="animate-spin">⏳</span>
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        📦 Registrar Entrada
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Panel lateral - Compras recientes */}
                <div className="space-y-4">
                    <div className="rounded-xl border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                        <h3 className="mb-4 flex items-center gap-2 font-semibold text-capsula-navy-deep">
                            <span>🕐</span> Compras Recientes
                        </h3>

                        {recentPurchases.length === 0 ? (
                            <p className="text-center text-sm text-capsula-ink-soft">
                                Las compras registradas en esta sesión aparecerán aquí
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentPurchases.map((purchase, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-lg bg-capsula-ivory-alt/50 p-3"
                                    >
                                        <p className="font-medium text-capsula-navy-deep">
                                            {purchase.item}
                                        </p>
                                        <div className="mt-1 flex items-center justify-between text-sm">
                                            <span className="text-capsula-ink-soft">
                                                +{formatNumber(purchase.quantity)} {purchase.unit}
                                            </span>
                                            {showCosts && (
                                                <span className="font-mono text-[#2F6B4E]">
                                                    {formatCurrency(purchase.cost)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-capsula-ink-muted">
                                            {purchase.timestamp.toLocaleTimeString('es-VE')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info de conversión */}
                    <div className="rounded-xl border border-capsula-navy/30 bg-capsula-navy/5 p-4">
                        <h4 className="mb-2 flex items-center gap-2 font-medium text-capsula-navy">
                            💡 Conversiones Automáticas
                        </h4>
                        <ul className="space-y-1 text-sm text-capsula-navy/80">
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
