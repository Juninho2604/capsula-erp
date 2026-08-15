import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAreasForSelect, getInventoryItemsForSelect } from '@/app/actions/entrada.actions';
import { getMenuItemsForDischargeAction } from '@/app/actions/manual-discharge.actions';
import { canCount } from '@/lib/inventory/count-permissions';
import DescargoView from './descargo-view';

export const dynamic = 'force-dynamic';

// §156 — Descargo manual de consumo. Mismo gate que el conteo: registrar
// consumo es un acto operativo, como contar o producir.
export default async function DescargoPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!canCount(session.role)) redirect('/dashboard/inventario');

    const [areas, items, menuItems] = await Promise.all([
        getAreasForSelect(),
        // Todos los tipos: un descargo puede llevarse materia prima, una
        // sub-receta (el kibe ya formado) o un producto terminado.
        getInventoryItemsForSelect({ types: ['RAW_MATERIAL', 'SUB_RECIPE', 'FINISHED_GOOD'] }),
        getMenuItemsForDischargeAction(),
    ]);

    return <DescargoView areas={areas} items={items} menuItems={menuItems} />;
}
