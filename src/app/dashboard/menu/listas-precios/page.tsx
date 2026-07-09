import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getPriceListsAction } from '@/app/actions/price-lists.actions';
import { getFullMenuAction } from '@/app/actions/menu.actions';
import { getActiveFeatureFlagsAction } from '@/app/actions/feature-flags.actions';
import PriceListsView, { type MenuItemLite, type MenuCategoryLite } from './price-lists-view';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Listas de precios | KPSULA',
    description: 'Precios por canal: crear, activar y editar listas de precios.',
};

export default async function ListasPreciosPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        redirect('/dashboard');
    }

    const [listsRes, menuRes, flagsRes] = await Promise.all([
        getPriceListsAction(),
        getFullMenuAction(),
        getActiveFeatureFlagsAction(),
    ]);

    const categories: MenuCategoryLite[] = [];
    const items: MenuItemLite[] = [];
    if (menuRes.success && menuRes.data) {
        for (const cat of menuRes.data as any[]) {
            categories.push({ id: cat.id, name: cat.name });
            for (const it of cat.items ?? []) {
                items.push({ id: it.id, name: it.name, categoryId: cat.id, categoryName: cat.name, basePrice: it.price });
            }
        }
    }

    const enabled = flagsRes.success ? Boolean(flagsRes.data?.priceListsEnabled) : false;

    return (
        <PriceListsView
            initialLists={listsRes.data ?? []}
            categories={categories}
            items={items}
            priceListsEnabled={enabled}
            canToggleFlag={session.role === 'OWNER'}
        />
    );
}
