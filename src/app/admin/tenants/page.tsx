import prisma from '@/server/db';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import TenantsTable, { type TenantRow } from './tenants-table-client';

export const dynamic = 'force-dynamic';

/**
 * Listado de tenants para SUPER_ADMIN.
 *
 * Stats por tenant: count de users (activos / totales), branches, ventas
 * de los últimos 30 días. El acceso ya quedó gated por middleware + layout;
 * acá no repetimos el check porque cualquier intento de bypass al server
 * component falla en el layout.
 */
export default async function TenantsAdminPage() {
    const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            slug: true,
            name: true,
            createdAt: true,
            _count: {
                select: { users: true, branches: true },
            },
        },
    });

    // Suspendido = todos los users de ese tenant tienen `isActive: false`.
    // Un solo activo basta para considerarlo "live".
    const activeUserCounts = await prisma.user.groupBy({
        by: ['tenantId'],
        where: { isActive: true },
        _count: { _all: true },
    });
    const activeByTenant = new Map<string, number>(
        activeUserCounts.map((g) => [g.tenantId, g._count._all]),
    );

    // Ventas últimos 30 días por tenant
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSales = await prisma.salesOrder.groupBy({
        by: ['tenantId'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
    });
    const salesByTenant = new Map<string, number>(
        recentSales.map((g) => [g.tenantId, g._count._all]),
    );

    const rows: TenantRow[] = tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        createdAt: t.createdAt.toISOString(),
        userCount: t._count.users,
        activeUserCount: activeByTenant.get(t.id) ?? 0,
        branchCount: t._count.branches,
        sales30d: salesByTenant.get(t.id) ?? 0,
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-[-0.02em] text-capsula-ink">
                        Tenants
                    </h1>
                    <p className="mt-1 text-sm text-capsula-ink-soft">
                        {rows.length} tenant{rows.length === 1 ? '' : 's'} registrado{rows.length === 1 ? '' : 's'}.
                    </p>
                </div>
                <Link
                    href="/admin/tenants/new"
                    className="pos-btn inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                    <Plus className="h-4 w-4" />
                    Nuevo tenant
                </Link>
            </div>
            <TenantsTable rows={rows} />
        </div>
    );
}
