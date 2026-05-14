import Link from 'next/link';
import { getLoansAction } from '@/app/actions/loan.actions';
import LoanList from './LoanList';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export const dynamic = 'force-dynamic';

export default async function PrestamosPage() {
    const loans = await getLoansAction();
    // CRÍTICO: filtrar áreas por tenant — sin extension el findMany leakea
    // áreas de todos los tenants. withTenant inyecta tenantId en la query.
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const areas = await db.area.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-semibold text-3xl tracking-[-0.02em] text-capsula-ink">Préstamos de Insumos</h1>
                    <p className="text-gray-500">
                        Gestiona préstamos a restaurantes vecinos
                    </p>
                </div>
                <Link
                    href="/dashboard/prestamos/nuevo"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:from-blue-700 hover:to-indigo-700"
                >
                    ✨ Nuevo Préstamo
                </Link>
            </div>

            <LoanList loans={loans} areas={areas} />
        </div>
    );
}
