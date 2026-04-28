import DailyInventoryManager from './daily-manager';
import { getAreasAction } from '@/app/actions/inventory.actions';

export const dynamic = 'force-dynamic';

export default async function DailyInventoryPage() {
    // Cargar áreas disponibles para el selector
    const areas = await getAreasAction();

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Inventario diario de alimentos</h1>
            </div>

            {/* Orden recomendado de operaciones */}
            <div className="rounded-xl border border-[#E8D9B8] bg-[#F3EAD6]/60 p-4 dark:border-[#5a4a22] dark:bg-[#3B2F15]/40">
                <h3 className="mb-2 text-sm font-semibold tracking-[-0.01em] text-[#946A1C] dark:text-[#E8D9B8]">Orden recomendado para el cierre</h3>
                <ol className="list-inside list-decimal space-y-1 text-sm text-[#946A1C]/90 dark:text-[#E8D9B8]/90">
                    <li><strong>Transferencias</strong> → Marcar como completadas las del día (o de la semana si acumulaste)</li>
                    <li><strong>Ventas</strong> → &quot;Importar desde Cargar Ventas&quot; (si usaste POS/Cargar Ventas) o &quot;Cargar Ventas Manual&quot;</li>
                    <li><strong>Conteos</strong> → Revisar apertura, entradas, cierre físico y guardar</li>
                    <li><strong>Variaciones</strong> → Revisar diferencias y cerrar el día</li>
                </ol>
            </div>

            <DailyInventoryManager initialAreas={areas} />
        </div>
    );
}
