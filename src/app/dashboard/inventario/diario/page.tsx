import DailyInventoryManager from './daily-manager';
import { getAreasAction } from '@/app/actions/inventory.actions';
import { CalendarDays, ListChecks } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DailyInventoryPage() {
    const areas = await getAreasAction();

    return (
        <div className="container mx-auto space-y-6 p-4 animate-in">
            <div className="flex items-center gap-3 border-b border-capsula-line pb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-capsula-line bg-capsula-ivory-surface text-capsula-navy-deep">
                    <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-capsula-ink-muted">Inventario</div>
                    <h1 className="font-heading text-[28px] leading-tight tracking-[-0.01em] text-capsula-navy-deep">Inventario diario de alimentos</h1>
                </div>
            </div>

            <div className="rounded-[var(--radius)] border border-capsula-line bg-[#F3EAD6]/40 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#946A1C]">
                    <ListChecks className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Orden recomendado para el cierre
                </h3>
                <ol className="list-inside list-decimal space-y-1 text-[13px] text-capsula-ink">
                    <li><strong className="text-capsula-navy-deep">Transferencias</strong> → Marcar como completadas las del día (o de la semana si acumulaste)</li>
                    <li><strong className="text-capsula-navy-deep">Ventas</strong> → &quot;Importar desde Cargar Ventas&quot; (si usaste POS/Cargar Ventas) o &quot;Cargar Ventas Manual&quot;</li>
                    <li><strong className="text-capsula-navy-deep">Conteos</strong> → Revisar apertura, entradas, cierre físico y guardar</li>
                    <li><strong className="text-capsula-navy-deep">Variaciones</strong> → Revisar diferencias y cerrar el día</li>
                </ol>
            </div>

            <DailyInventoryManager initialAreas={areas} />
        </div>
    );
}
