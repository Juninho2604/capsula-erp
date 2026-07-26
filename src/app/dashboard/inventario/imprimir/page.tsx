import { getInventoryForPrintAction } from '@/app/actions/inventory.actions';
import PrintListView from './print-list-view';

// Server Component que carga datos para la vista imprimible.
// Cero writes a BD; la action es 100% SELECT.
export const dynamic = 'force-dynamic';

export default async function ImprimirInventarioPage({
    searchParams,
}: {
    searchParams?: { layout?: string; areas?: string };
}) {
    const { items, areas } = await getInventoryForPrintAction();

    // Conteo Rápido abre esta pantalla con ?layout=count&areas=id1,id2,… para
    // que la hoja impresa traiga exactamente los almacenes seleccionados allá.
    // Se resuelven contra las áreas reales del tenant: un id inválido se ignora.
    const requested = (searchParams?.areas ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    const countAreas = requested
        .map(id => areas.find(a => a.id === id))
        .filter((a): a is { id: string; name: string } => !!a);

    return (
        <PrintListView
            items={items}
            areas={areas}
            initialLayout={searchParams?.layout === 'purchase' ? 'purchase' : 'count'}
            countAreas={countAreas}
        />
    );
}
