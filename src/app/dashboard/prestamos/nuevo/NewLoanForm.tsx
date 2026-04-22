'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { createLoanAction } from '@/app/actions/loan.actions';
import { toast } from 'react-hot-toast';
import { UNIT_INFO } from '@/lib/constants/units';
import { UnitOfMeasure } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { ArrowLeft, Package, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ItemOption {
    id: string;
    name: string;
    sku: string;
    unit: string;
    type: string;
    estimatedCost: number;
}

interface NewLoanFormProps {
    items: ItemOption[];
    areas: { id: string; name: string }[];
}

const inputClass =
    'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 text-[14px] text-capsula-ink outline-none transition-colors placeholder:text-capsula-ink-muted focus:border-capsula-navy-deep';
const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';

export default function NewLoanForm({ items, areas }: NewLoanFormProps) {
    const router = useRouter();
    const { user } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [loaneeName, setLoaneeName] = useState('');
    const [selectedItemId, setSelectedItemId] = useState('');
    const [fromAreaId, setFromAreaId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState<UnitOfMeasure>('KG');
    const [type, setType] = useState<'REPLACEMENT' | 'PAYMENT'>('REPLACEMENT');
    const [agreedPrice, setAgreedPrice] = useState<number>(0);
    const [notes, setNotes] = useState('');

    const selectedItem = items.find(i => i.id === selectedItemId);

    const handleItemChange = (itemId: string) => {
        const item = items.find(i => i.id === itemId);
        setSelectedItemId(itemId);
        if (item) {
            setUnit(item.unit as UnitOfMeasure || 'KG');
            setAgreedPrice(item.estimatedCost);
        }
    };

    const handleSubmit = async () => {
        if (!user || !selectedItemId || !loaneeName) return;

        try {
            setIsSubmitting(true);
            const result = await createLoanAction({
                inventoryItemId: selectedItemId,
                loaneeName,
                quantity,
                unit,
                type,
                agreedPrice: type === 'PAYMENT' ? agreedPrice : undefined,
                notes,
                userId: user.id,
                areaId: fromAreaId,
            });

            if (result.success) {
                toast.success('Préstamo creado con éxito');
                router.push('/dashboard/prestamos');
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error('Error al crear préstamo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl animate-in space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-capsula-line pb-6">
                <Link
                    href="/dashboard/prestamos"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink"
                >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                </Link>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Préstamos</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Registrar préstamo</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">Salida de insumos a terceros.</p>
                </div>
            </div>

            <div className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-cap-soft">
                <div className="grid gap-5">
                    {/* Prestado A */}
                    <div>
                        <label className={labelClass}>Prestado a (restaurante / persona) *</label>
                        <input
                            type="text"
                            value={loaneeName}
                            onChange={(e) => setLoaneeName(e.target.value)}
                            placeholder="Ej: Restaurant Vecino A"
                            className={inputClass}
                        />
                    </div>

                    {/* Origen */}
                    <div>
                        <label className={labelClass}>Sale de (almacén) *</label>
                        <select
                            value={fromAreaId}
                            onChange={(e) => setFromAreaId(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Seleccionar almacén…</option>
                            {areas.map(area => (
                                <option key={area.id} value={area.id}>{area.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Item Selection */}
                    <div>
                        <label className={labelClass}>Insumo / producto *</label>
                        <Combobox
                            items={items.map(item => ({
                                value: item.id,
                                label: `${item.name} (${item.unit})`,
                            }))}
                            value={selectedItemId || ''}
                            onChange={(val) => handleItemChange(val)}
                            placeholder="Seleccionar producto…"
                            searchPlaceholder="Buscar producto…"
                            emptyMessage="No se encontró el producto."
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Cantidad */}
                        <div>
                            <label className={labelClass}>Cantidad *</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                                    min="0"
                                    step="0.01"
                                    className="w-24 rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2.5 font-mono text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                />
                                <select
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
                                    className="rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[13px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                >
                                    {Object.entries(UNIT_INFO).map(([key, info]) => (
                                        <option key={key} value={key}>
                                            {info.symbol} ({info.labelEs})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Modalidad */}
                        <div>
                            <label className={labelClass}>Modalidad *</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as any)}
                                className={inputClass}
                            >
                                <option value="REPLACEMENT">Reposición (devuelven producto)</option>
                                <option value="PAYMENT">Pago (compran producto)</option>
                            </select>
                        </div>
                    </div>

                    {/* Price if Payment */}
                    {type === 'PAYMENT' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className={labelClass}>Precio acordado (por unidad)</label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-capsula-ink-muted">$</div>
                                <input
                                    type="number"
                                    value={agreedPrice}
                                    onChange={(e) => setAgreedPrice(parseFloat(e.target.value) || 0)}
                                    min="0"
                                    step="0.01"
                                    className="w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface py-2.5 pl-8 pr-4 font-mono text-[14px] text-capsula-ink outline-none focus:border-capsula-navy-deep"
                                />
                            </div>
                            <p className="mt-1 text-[11px] text-capsula-ink-muted">
                                Costo actual estimado: <span className="font-mono text-capsula-ink-soft">{formatCurrency(selectedItem?.estimatedCost || 0)}</span>
                            </p>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className={labelClass}>Notas (opcional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className={inputClass}
                        />
                    </div>

                    <div className="pt-2">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !loaneeName || !selectedItemId || !fromAreaId || quantity <= 0}
                            isLoading={isSubmitting}
                            className="w-full"
                        >
                            {type === 'PAYMENT' ? <Coins className="h-4 w-4" strokeWidth={1.5} /> : <Package className="h-4 w-4" strokeWidth={1.5} />}
                            {isSubmitting ? 'Registrando…' : 'Registrar préstamo'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
