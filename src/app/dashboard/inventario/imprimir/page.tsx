import { getInventoryForPrintAction } from '@/app/actions/inventory.actions';
import PrintListView from './print-list-view';

// Server Component que carga datos para la vista imprimible.
// Cero writes a BD; la action es 100% SELECT.
export const dynamic = 'force-dynamic';

export default async function ImprimirInventarioPage() {
    const { items, areas } = await getInventoryForPrintAction();
    return <PrintListView items={items} areas={areas} />;
}
