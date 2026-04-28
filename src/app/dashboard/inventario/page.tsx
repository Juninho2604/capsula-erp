import { getInventoryListAction, getAreasAction } from '@/app/actions/inventory.actions';
import InventoryView from './inventory-view';
import PendingDeductionBanner from './pending-deduction-banner';

// Esta página ahora es un Server Component
export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
    // 1. Obtener datos REALES de la base de datos
    const [items, areas] = await Promise.all([
        getInventoryListAction(),
        getAreasAction()
    ]);

    // 2. Renderizar la vista interactiva (Client Component)
    //    El PendingDeductionBanner es un Server Component que se renderiza solo
    //    si hay ventas con descargo pendiente — telemetría gerencial read-only.
    return (
        <div className="space-y-4">
            <PendingDeductionBanner />
            <InventoryView initialItems={items} initialAreas={areas} />
        </div>
    );
}
