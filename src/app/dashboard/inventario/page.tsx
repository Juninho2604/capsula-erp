import { getInventoryListAction, getAreasAction } from '@/app/actions/inventory.actions';
import InventoryView from './inventory-view';
import PendingDeductionBanner from './pending-deduction-banner';
import OrphanRecipesBanner from './orphan-recipes-banner';

// Esta página ahora es un Server Component
export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
    // 1. Obtener datos REALES de la base de datos
    const [items, areas] = await Promise.all([
        getInventoryListAction(),
        getAreasAction()
    ]);

    // 2. Renderizar la vista interactiva (Client Component).
    //    Los banners son Server Components que se renderizan solo si hay
    //    hallazgos — telemetría gerencial read-only. Aparecen juntos porque
    //    "descargo pendiente" suele tener como causa raíz una receta huérfana.
    return (
        <div className="space-y-4">
            <PendingDeductionBanner />
            <OrphanRecipesBanner />
            <InventoryView initialItems={items} initialAreas={areas} />
        </div>
    );
}
