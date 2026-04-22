import { getModifierGroupsWithItemsAction, getMenuItemsForModifierLinkAction } from '@/app/actions/modifier.actions';
import ModifierManagerClient from './ModifierManagerClient';
import { Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ModificadoresPage() {
    const [groupsRes, itemsRes] = await Promise.all([
        getModifierGroupsWithItemsAction(),
        getMenuItemsForModifierLinkAction()
    ]);

    const groups = groupsRes.success ? (groupsRes.data ?? []) : [];
    const menuItems = itemsRes.success ? (itemsRes.data ?? []) : [];

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <Settings className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Catálogo</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Modificadores</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">
                        Vincula cada opción de modificador a un plato del menú para que al vender se descarguen automáticamente los ingredientes correctos del inventario.
                    </p>
                    <p className="mt-1 text-[12px] text-[#946A1C]">
                        Ej: Tabla con &quot;Tabule&quot; → al vender, descarga ingredientes de la receta de Tabule.
                    </p>
                </div>
            </div>

            <ModifierManagerClient groups={groups as any} menuItems={menuItems as any} />
        </div>
    );
}
