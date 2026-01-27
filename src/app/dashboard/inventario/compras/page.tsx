import { getInventoryItemsForSelect, getAreasForSelect } from '@/app/actions/entrada.actions';
import CompraForm from './compra-form';

// Esta página es Server Component para cargar datos iniciales seguros
export const dynamic = 'force-dynamic';

export default async function ComprasPage() {
    // Cargar datos en paralelo para mejor rendimiento
    const [items, areas] = await Promise.all([
        getInventoryItemsForSelect(),
        getAreasForSelect()
    ]);

    return <CompraForm itemsList={items} areasList={areas} />;
}
