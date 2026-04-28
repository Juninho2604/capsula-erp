'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createRecipeStubForMenuItemAction } from '@/app/actions/menu.actions';

interface MissingItem {
    id: string;
    name: string;
    price: number;
    recipeId: string | null;
    category: { name: string };
}

interface MissingRecipesPanelProps {
    items: MissingItem[];
}

export default function MissingRecipesPanel({ items }: MissingRecipesPanelProps) {
    const router = useRouter();
    const [creating, setCreating] = useState<string | null>(null);
    const [created, setCreated] = useState<Set<string>>(new Set());
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleCreateStub = async (itemId: string) => {
        setCreating(itemId);
        try {
            const result = await createRecipeStubForMenuItemAction(itemId);
            if (result.success) {
                setCreated(prev => { const next = new Set(prev); next.add(itemId); return next; });
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } finally {
            setCreating(null);
        }
    };

    const pendingItems = items.filter(i => !created.has(i.id));

    if (pendingItems.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-xl border border-[#E8D9B8] bg-[#F3EAD6]/40 dark:border-[#5a4a22] dark:bg-[#3B2F15]/30">
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-[#F3EAD6]/60 dark:hover:bg-[#3B2F15]/50"
            >
                <div className="flex items-center gap-3 text-left">
                    <AlertTriangle className="h-5 w-5 text-[#946A1C] dark:text-[#E8D9B8]" />
                    <div>
                        <h3 className="font-semibold text-[#946A1C] dark:text-[#E8D9B8]">
                            {pendingItems.length} Platos del Menú sin Receta
                        </h3>
                        <p className="text-sm text-[#946A1C]/80 dark:text-[#E8D9B8]/80">
                            Sin receta no se puede descontar el inventario al vender. Crea la receta vacía y luego completa los ingredientes.
                        </p>
                    </div>
                </div>
                {isCollapsed
                    ? <ChevronDown className="h-5 w-5 text-[#946A1C] dark:text-[#E8D9B8]" />
                    : <ChevronUp className="h-5 w-5 text-[#946A1C] dark:text-[#E8D9B8]" />
                }
            </button>

            {!isCollapsed && (
                <div className="border-t border-[#E8D9B8]/60 divide-y divide-[#E8D9B8]/40 dark:border-[#5a4a22]/60 dark:divide-[#5a4a22]/40">
                    {pendingItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F3EAD6]/40 dark:hover:bg-[#3B2F15]/40">
                            <div>
                                <span className="font-medium text-capsula-ink">{item.name}</span>
                                <span className="ml-2 text-xs text-capsula-ink-muted">{item.category.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-sm tabular-nums text-capsula-ink-soft">${item.price.toFixed(2)}</span>
                                <button
                                    onClick={() => handleCreateStub(item.id)}
                                    disabled={creating === item.id}
                                    className="pos-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                                >
                                    {creating === item.id
                                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Creando...</>
                                        : <><ClipboardList className="h-3 w-3" /> Crear Receta Vacía</>
                                    }
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
