import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getPromotionsAction } from '@/app/actions/promotions.actions';
import { getFullMenuAction } from '@/app/actions/menu.actions';
import { getActiveFeatureFlagsAction } from '@/app/actions/feature-flags.actions';
import { PromocionesView, type MenuCategoryLite, type MenuItemLite } from './promociones-view';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Promociones | KPSULA',
    description: 'Happy hour y descuentos automáticos por día/horario.',
};

export default async function PromocionesPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        redirect('/dashboard');
    }

    const [promosRes, menuRes, flagsRes] = await Promise.all([
        getPromotionsAction(),
        getFullMenuAction(),
        getActiveFeatureFlagsAction(),
    ]);

    const categories: MenuCategoryLite[] = [];
    const items: MenuItemLite[] = [];
    if (menuRes.success && menuRes.data) {
        for (const cat of menuRes.data as any[]) {
            categories.push({ id: cat.id, name: cat.name });
            for (const it of cat.items ?? []) {
                items.push({ id: it.id, name: it.name, categoryId: cat.id, price: it.price });
            }
        }
    }

    const promotionsEnabled = flagsRes.success ? Boolean(flagsRes.data?.promotionsEnabled) : false;

    return (
        <PromocionesView
            initialPromotions={promosRes.data ?? []}
            categories={categories}
            items={items}
            promotionsEnabled={promotionsEnabled}
            canToggleFlag={session.role === 'OWNER'}
        />
    );
}
