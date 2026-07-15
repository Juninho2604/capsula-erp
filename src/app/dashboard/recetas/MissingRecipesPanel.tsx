'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Loader2, Search } from 'lucide-react';
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
    const [searchQuery, setSearchQuery] = useState('');

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

    // Buscador client-side (§119): el panel puede listar decenas de platos
    // desde el fix §117 — filtrar por nombre o categoría, sin tocar servidor.
    const visibleItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return pendingItems;
        return pendingItems.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.category?.name ?? '').toLowerCase().includes(q)
        );
    }, [pendingItems, searchQuery]);

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
                <div className="border-t border-[#E8D9B8]/60 dark:border-[#5a4a22]/60">
                    {/* Buscador (§119) */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E8D9B8]/40 dark:border-[#5a4a22]/40">
                        <div className="relative flex-1 max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-capsula-ink-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar plato o categoría..."
                                className="pos-input w-full pl-10"
                            />
                        </div>
                        <span className="text-sm text-capsula-ink-muted tabular-nums shrink-0">
                            {visibleItems.length} de {pendingItems.length}
                        </span>
                    </div>

                    {visibleItems.length === 0 && (
                        <div className="px-5 py-6 text-center text-sm text-capsula-ink-muted">
                            Ningún plato coincide con &quot;{searchQuery}&quot;
                        </div>
                    )}

                    <div className="divide-y divide-[#E8D9B8]/40 dark:divide-[#5a4a22]/40 max-h-[50vh] overflow-y-auto">
                    {visibleItems.map(item => (
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
                </div>
            )}
        </div>
    );
}
