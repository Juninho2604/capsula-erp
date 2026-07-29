import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CostImporter } from './CostImporter';
import { CurrentCostsTable } from './CurrentCostsTable';
import { getCurrentCostsAction } from '@/app/actions/cost.actions';

// §143 — mismos roles que valida updateItemCostAction en el server.
const COST_EDIT_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF'];

export const dynamic = 'force-dynamic';

export default async function CostosPage() {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    // Get current costs for summary
    const costsResult = await getCurrentCostsAction();
    const items = costsResult.items || [];

    const withCost = items.filter(i => i.currentCost !== null).length;
    const withoutCost = items.filter(i => i.currentCost === null).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Módulo de Costos</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Gestión de precios de compra y cálculo de COGS
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Card 1: Materias Primas con Costo */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-2xl dark:bg-green-900/30">
                            ✅
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Con Costo</h3>
                            <p className="text-sm text-gray-500">
                                Materias primas
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 font-semibold text-3xl tracking-[-0.02em] text-green-600">
                        {withCost}
                    </div>
                    <p className="text-xs text-gray-400">Ítems con precio registrado</p>
                </div>

                {/* Card 2: Sin Costo */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-2xl dark:bg-amber-900/30">
                            ⚠️
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Sin Costo</h3>
                            <p className="text-sm text-gray-500">
                                Pendientes de precio
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 font-semibold text-3xl tracking-[-0.02em] text-amber-600">
                        {withoutCost}
                    </div>
                    <p className="text-xs text-gray-400">Requieren actualización</p>
                </div>

                {/* Card 3: Total */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-2xl dark:bg-blue-900/30">
                            📦
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg tracking-[-0.01em] text-capsula-ink">Total Items</h3>
                            <p className="text-sm text-gray-500">
                                Materias primas
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 font-semibold text-3xl tracking-[-0.02em] text-blue-600">
                        {items.length}
                    </div>
                    <p className="text-xs text-gray-400">En el inventario</p>
                </div>
            </div>

            {/* Cost Importer */}
            <CostImporter />

            {/* Costos actuales — con edición manual por ítem (§143) */}
            {items.length > 0 && (
                <CurrentCostsTable
                    items={items}
                    canEdit={COST_EDIT_ROLES.includes(session.role)}
                />
            )}
        </div>
    );
}
