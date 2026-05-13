import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { getModifierGroupsWithItemsAction, getMenuItemsForModifierLinkAction } from '@/app/actions/modifier.actions';
import ModifierManagerClient from './ModifierManagerClient';

export const dynamic = 'force-dynamic';

export default async function ModificadoresPage() {
    const [groupsRes, itemsRes] = await Promise.all([
        getModifierGroupsWithItemsAction(),
        getMenuItemsForModifierLinkAction()
    ]);

    const groups = groupsRes.success ? (groupsRes.data ?? []) : [];
    const menuItems = itemsRes.success ? (itemsRes.data ?? []) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Gestión de Modificadores</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Vincula cada opción de modificador a un plato del menú para que al vender se descarguen automáticamente los ingredientes correctos del inventario.
                        <br />
                        <span className="text-amber-500 font-medium">
                            Ej: Tabla con &quot;Tabule&quot; → al vender, descarga ingredientes de la receta de Tabule.
                        </span>
                    </p>
                </div>
                <Link
                    href="/dashboard/menu/modificadores/guia"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-capsula-line bg-capsula-ivory-surface hover:border-capsula-navy-deep/40 text-sm font-semibold text-capsula-ink shrink-0"
                >
                    <BookOpen className="h-4 w-4 text-capsula-coral" /> Ver guía visual
                </Link>
            </div>

            <ModifierManagerClient groups={groups as any} menuItems={menuItems as any} />
        </div>
    );
}
