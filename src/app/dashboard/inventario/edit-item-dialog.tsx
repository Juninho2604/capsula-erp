'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { updateInventoryItemAction } from '@/app/actions/inventory.actions';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    item: any;
    isOpen: boolean;
    onClose: () => void;
}

const inputClass =
    'w-full rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface px-3 py-2 text-[14px] leading-none text-capsula-ink outline-none transition-colors focus:border-capsula-navy-deep';
const labelClass = 'text-[12px] font-medium uppercase tracking-[0.08em] text-capsula-ink-muted';

export function ItemEditDialog({ item, isOpen, onClose }: Props) {
    const [formData, setFormData] = useState({
        name: item.name,
        sku: item.sku,
        category: item.category || '',
        baseUnit: item.baseUnit || 'UNI',
        minimumStock: item.minimumStock,
        reorderPoint: item.reorderPoint || 0,
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await updateInventoryItemAction(item.id, {
                ...formData,
                minimumStock: Number(formData.minimumStock),
                reorderPoint: Number(formData.reorderPoint),
                baseUnit: formData.baseUnit,
            });

            if (res.success) {
                toast.success('Ítem actualizado correctamente');
                onClose();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error('Error al guardar cambios');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-capsula-navy-deep/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-[var(--radius)] border border-capsula-line bg-capsula-ivory-surface p-6 shadow-[0_20px_60px_-20px_rgba(11,23,39,0.35)] focus:outline-none">
                    <Dialog.Title className="font-heading text-[22px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">
                        Editar {item.name}
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 mb-5 text-[13px] leading-relaxed text-capsula-ink-muted">
                        Modifica los detalles principales del ítem de inventario.
                    </Dialog.Description>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <fieldset className="flex flex-col gap-1.5">
                            <label className={labelClass}>Nombre</label>
                            <input
                                className={inputClass}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </fieldset>

                        <div className="grid grid-cols-2 gap-4">
                            <fieldset className="flex flex-col gap-1.5">
                                <label className={labelClass}>SKU</label>
                                <input
                                    className={inputClass + ' font-mono text-[13px]'}
                                    value={formData.sku}
                                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                />
                            </fieldset>
                            <fieldset className="flex flex-col gap-1.5">
                                <label className={labelClass}>Categoría</label>
                                <input
                                    className={inputClass}
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                />
                            </fieldset>
                        </div>

                        <fieldset className="flex flex-col gap-1.5">
                            <label className={labelClass}>Unidad de Medida</label>
                            <select
                                className={inputClass}
                                value={formData.baseUnit}
                                onChange={e => setFormData({ ...formData, baseUnit: e.target.value })}
                            >
                                <option value="KG">KG - Kilogramos</option>
                                <option value="UNI">UNI - Unidades</option>
                                <option value="LT">LT - Litros</option>
                                <option value="GR">GR - Gramos</option>
                                <option value="ML">ML - Mililitros</option>
                                <option value="PAQUETE">PAQUETE</option>
                                <option value="CAJA">CAJA</option>
                                <option value="BOLSA">BOLSA</option>
                                <option value="BOTELLA">BOTELLA</option>
                                <option value="GALON">GALON</option>
                            </select>
                        </fieldset>

                        <div className="grid grid-cols-2 gap-4">
                            <fieldset className="flex flex-col gap-1.5">
                                <label className={labelClass}>Stock Mínimo</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={inputClass + ' font-mono'}
                                    value={formData.minimumStock}
                                    onChange={e => setFormData({ ...formData, minimumStock: Number(e.target.value) })}
                                />
                            </fieldset>
                            <fieldset className="flex flex-col gap-1.5">
                                <label className={labelClass}>Punto de Reorden</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={inputClass + ' font-mono'}
                                    value={formData.reorderPoint}
                                    onChange={e => setFormData({ ...formData, reorderPoint: Number(e.target.value) })}
                                />
                            </fieldset>
                        </div>

                        <div className="mt-2 flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button type="submit" variant="primary" isLoading={isSaving}>
                                {isSaving ? 'Guardando…' : 'Guardar cambios'}
                            </Button>
                        </div>
                    </form>
                    <Dialog.Close asChild>
                        <button
                            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-ivory-alt hover:text-capsula-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-capsula-navy-deep"
                            aria-label="Cerrar"
                        >
                            <X className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
