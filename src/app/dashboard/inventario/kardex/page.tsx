import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getInventoryItemsForSelect, getAreasForSelect } from '@/app/actions/entrada.actions';
import KardexView from './kardex-view';

export const dynamic = 'force-dynamic';

const ALLOWED = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'];

export default async function KardexPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ALLOWED.includes(session.role)) redirect('/dashboard/inventario');

    // El Kardex cubre TODO el catálogo: materia prima, sub-recetas y
    // productos terminados (el descuadre puede estar en cualquiera).
    const [items, areas] = await Promise.all([
        getInventoryItemsForSelect({ types: ['RAW_MATERIAL', 'SUB_RECIPE', 'FINISHED_GOOD'] }),
        getAreasForSelect(),
    ]);

    return (
        <KardexView
            items={items.map((i: { id: string; name: string; sku: string }) => ({ id: i.id, name: i.name, sku: i.sku }))}
            areas={areas.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }))}
        />
    );
}
