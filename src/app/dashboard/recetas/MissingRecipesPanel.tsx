'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRecipeStubForMenuItemAction } from '@/app/actions/menu.actions';
import { AlertTriangle, ChevronDown, ChevronUp, FilePlus2, Loader2 } from 'lucide-react';

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

    const handleCreateStub = async (itemId: string, itemName: string) => {
        setCreating(itemId);
        try {
            const result = await createRecipeStubForMenuItemAction(itemId);
            if (result.success) {
                setCreated(prev => { const next = new Set(prev); next.add(itemId); return next; });
                router.refresh();
            } else {
                alert(result.message);
            }
        } finally {
            setCreating(null);
        }
    };

    const pendingItems = items.filter(i => !created.has(i.id));

    if (pendingItems.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-[var(--radius)] border border-capsula-coral/40 bg-capsula-coral/5">
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-capsula-coral/10"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-capsula-coral/10 text-capsula-coral">
                        <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-heading text-[15px] text-capsula-coral">
                            {pendingItems.length} platos del menú sin receta
                        </h3>
                        <p className="mt-0.5 text-[12px] text-capsula-ink-soft">
                            Sin receta no se puede descontar el inventario al vender. Crea la receta vacía y luego completa los ingredientes.
                        </p>
                    </div>
                </div>
                {isCollapsed
                    ? <ChevronDown className="h-4 w-4 text-capsula-coral" strokeWidth={1.5} />
                    : <ChevronUp className="h-4 w-4 text-capsula-coral" strokeWidth={1.5} />
                }
            </button>

            {!isCollapsed && (
                <div className="divide-y divide-capsula-coral/20 border-t border-capsula-coral/20">
                    {pendingItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-capsula-coral/5">
                            <div>
                                <span className="text-[13px] font-medium text-capsula-ink">{item.name}</span>
                                <span className="ml-2 text-[11px] text-capsula-ink-muted">{item.category.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-[13px] text-capsula-navy-deep">${item.price.toFixed(2)}</span>
                                <button
                                    onClick={() => handleCreateStub(item.id, item.name)}
                                    disabled={creating === item.id}
                                    className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-capsula-coral px-3 py-1.5 text-[12px] font-medium text-capsula-ivory-surface transition-colors hover:bg-capsula-coral/90 disabled:opacity-50"
                                >
                                    {creating === item.id ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                                            Creando…
                                        </>
                                    ) : (
                                        <>
                                            <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                            Crear receta vacía
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
