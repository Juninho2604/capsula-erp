import { getInventoryItemsForSelect, getAreasForSelect } from '@/app/actions/entrada.actions';
import EntradaMercanciaForm from './entrada-form';

// Esta página es Server Component para cargar datos iniciales seguros
export const dynamic = 'force-dynamic';

export default async function EntradaMercanciaPage() {
    // Cargar datos en paralelo para mejor rendimiento
    const [items, areas] = await Promise.all([
        getInventoryItemsForSelect(),
        getAreasForSelect()
    ]);

    return <EntradaMercanciaForm itemsList={items} areasList={areas} />;
}
