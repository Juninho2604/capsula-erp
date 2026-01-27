import { getInventoryListAction, getAreasAction } from '@/app/actions/inventory.actions';
import InventoryView from './inventory-view';

// Esta página ahora es un Server Component
export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
    // 1. Obtener datos REALES de la base de datos
    const [items, areas] = await Promise.all([
        getInventoryListAction(),
        getAreasAction()
    ]);

    // 2. Renderizar la vista interactiva (Client Component)
    return <InventoryView initialItems={items} initialAreas={areas} />;
}
