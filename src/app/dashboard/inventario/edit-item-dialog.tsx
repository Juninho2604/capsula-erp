'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Loader2, X as XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { updateInventoryItemAction } from '@/app/actions/inventory.actions';
import { toast } from 'react-hot-toast';

interface Props {
    item: any;
    isOpen: boolean;
    onClose: () => void;
}

export function ItemEditDialog({ item, isOpen, onClose }: Props) {
    const router = useRouter();
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
                router.refresh();
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
                <Dialog.Overlay className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <Dialog.Content className="fixed left-[50%] top-[50%] z-[60] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-3xl border border-capsula-line bg-capsula-ivory shadow-2xl focus:outline-none">
                    <div className="flex items-center justify-between border-b border-capsula-line p-5">
                        <div>
                            <Dialog.Title className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">
                                Editar {item.name}
                            </Dialog.Title>
                            <Dialog.Description className="mt-1 text-sm text-capsula-ink-muted">
                                Modifica los detalles principales del ítem de inventario.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <button
                                className="flex h-8 w-8 items-center justify-center rounded-full text-capsula-ink-muted transition-colors hover:bg-capsula-coral/10 hover:text-capsula-coral"
                                aria-label="Cerrar"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
                        <fieldset className="flex flex-col gap-1">
                            <label className="pos-label">Nombre</label>
                            <input
                                className="pos-input"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </fieldset>

                        <div className="grid grid-cols-2 gap-4">
                            <fieldset className="flex flex-col gap-1">
                                <label className="pos-label">SKU</label>
                                <input
                                    className="pos-input font-mono"
                                    value={formData.sku}
                                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                />
                            </fieldset>
                            <fieldset className="flex flex-col gap-1">
                                <label className="pos-label">Categoría</label>
                                <input
                                    className="pos-input"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                />
                            </fieldset>
                        </div>

                        <fieldset className="flex flex-col gap-1">
                            <label className="pos-label">Unidad de Medida</label>
                            <select
                                className="pos-input"
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
                            <fieldset className="flex flex-col gap-1">
                                <label className="pos-label">Stock Mínimo</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="pos-input tabular-nums"
                                    value={formData.minimumStock}
                                    onChange={e => setFormData({ ...formData, minimumStock: Number(e.target.value) })}
                                />
                            </fieldset>
                            <fieldset className="flex flex-col gap-1">
                                <label className="pos-label">Punto de Reorden</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="pos-input tabular-nums"
                                    value={formData.reorderPoint}
                                    onChange={e => setFormData({ ...formData, reorderPoint: Number(e.target.value) })}
                                />
                            </fieldset>
                        </div>

                        <div className="mt-2 flex gap-3 border-t border-capsula-line pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="pos-btn-secondary flex-1 py-3"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="pos-btn flex-[2] py-3 inline-flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" /> Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
