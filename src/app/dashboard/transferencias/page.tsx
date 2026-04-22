import { getInventoryItemsForSelect, getAreasForSelect } from '@/app/actions/entrada.actions';
import { getRequisitions } from '@/app/actions/requisition.actions';
import { ArrowLeftRight } from 'lucide-react';
import TransferenciasView from './transferencias-view';
import BulkTransferPanel from './BulkTransferPanel';

// Esta página es Server Component para cargar datos iniciales seguros
export const dynamic = 'force-dynamic';

export default async function TransferenciasPage() {
    // Cargar datos en paralelo para mejor rendimiento
    const [items, areas, requisitions] = await Promise.all([
        getInventoryItemsForSelect(),
        getAreasForSelect(),
        getRequisitions('ALL') // Cargamos todas para filtrar en cliente
    ]);

    // Adaptar requisitions para el componente cliente (fechas string vs Date)
    // Prisma devuelve Date, pero Next.js prefiere serializables si pasan por boundary.
    // Sin embargo, en Server Components -> Client Components directos, Date es permitido en ultimas versiones.
    // Si falla, convertiremos a string. Por ahora lo paso directo.

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <ArrowLeftRight className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Operación</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Transferencias de inventario</h1>
                    <p className="mt-1 text-[13px] text-capsula-ink-soft">Solicitud y despacho de insumos entre áreas (Almacén Central → Cocina, Barra, etc.).</p>
                </div>
            </div>

            <BulkTransferPanel areasList={areas} />

            <TransferenciasView
                itemsList={items}
                areasList={areas}
                initialRequisitions={requisitions.data as any}
            />
        </div>
    );
}

