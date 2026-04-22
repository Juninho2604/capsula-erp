'use client';

import { useState, useEffect } from 'react';
import { getMenuItemsWithRecipesAction, processManualSalesAction } from '@/app/actions/inventory-daily.actions';
import { toast } from 'react-hot-toast';

interface Props {
    dailyId: string;
    onClose: () => void;
    onUpdate: () => void;
}

export default function SalesEntryModal({ dailyId, onClose, onUpdate }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [sales, setSales] = useState<Record<string, number>>({});

    useEffect(() => {
        loadMenuItems();
    }, []);

    async function loadMenuItems() {
        const res = await getMenuItemsWithRecipesAction();
        if (res.success) {
            setMenuItems(res.data);
        }
        setLoading(false);
    }

    const handleChange = (id: string, qty: string) => {
        const val = parseInt(qty) || 0;
        setSales(prev => ({ ...prev, [id]: val }));
    };

    const handleSave = async () => {
        setSaving(true);
        const data = Object.entries(sales).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

        const res = await processManualSalesAction(dailyId, data);
        if (res.success) {
            toast.success('Ventas cargadas y consumo teórico actualizado');
            onUpdate();
            onClose();
        } else {
            toast.error(res.message);
        }
        setSaving(false);
    };

    // Agrupar por categoría
    const categories = menuItems.reduce((acc: any, item: any) => {
        const cat = item.category?.name || 'Varios';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-capsula-ivory-surface rounded-[var(--radius)] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-capsula-line">
                <div className="p-6 border-b border-capsula-line bg-capsula-navy-deep text-capsula-ivory-surface flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">➕ Sumar Ventas POS</h2>
                        <p className="text-capsula-ivory-surface/80 text-sm">Ingrese cantidades para <b>SUMAR</b> a sus ventas del día. (Use negativos para restar errores)</p>
                    </div>
                    <button onClick={onClose} className="text-capsula-ivory-surface hover:text-capsula-ivory-alt text-2xl">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? (
                        <div className="text-center py-10 text-capsula-ink-soft">Cargando menú...</div>
                    ) : (
                        Object.entries(categories).map(([cat, items]: any) => (
                            <div key={cat} className="space-y-3">
                                <h3 className="text-sm font-bold text-capsula-navy uppercase tracking-wider border-b border-capsula-navy/20 pb-1">{cat}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {items.map((item: any) => (
                                        <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-capsula-ivory-alt/60 hover:bg-capsula-ivory-surface border border-transparent hover:border-capsula-navy/30 transition shadow-sm">
                                            <div className="flex-1 mr-4">
                                                <p className="font-semibold text-capsula-ink text-sm leading-tight">{item.name}</p>
                                                <p className="text-[10px] text-capsula-ink-soft font-mono mt-1">{item.sku}</p>
                                            </div>
                                            <input
                                                type="number"
                                                value={sales[item.id] || ''}
                                                placeholder="0"
                                                onChange={e => handleChange(item.id, e.target.value)}
                                                className="w-20 text-center bg-capsula-ivory-surface border border-capsula-line rounded-[var(--radius)] py-2 focus:ring-2 focus:ring-capsula-navy-deep font-bold"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-capsula-line bg-capsula-ivory-alt/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-capsula-ink-soft font-medium hover:bg-capsula-ivory-alt rounded-xl transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-10 py-2.5 bg-capsula-navy-deep text-capsula-ivory-surface rounded-[var(--radius)] font-medium hover:bg-capsula-navy-ink transition shadow-cap-soft disabled:opacity-50"
                    >
                        {saving ? 'Procesando...' : '➕ Sumar al Inventario'}
                    </button>
                </div>
            </div>
        </div>
    );
}
