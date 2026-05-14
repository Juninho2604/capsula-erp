import prisma from '@/server/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import TenantDetailClient from './tenant-detail-client';

export const dynamic = 'force-dynamic';

const TENANT_ROOT_DOMAIN = 'kpsula.app';

/**
 * Detalle de un tenant para SUPER_ADMIN.
 *
 * Carga server-side: tenant + users + branches + últimas ventas + pagos.
 * El componente cliente maneja edición de nombre, reset password owner,
 * y registro/eliminación de pagos. Auth ya gated por layout.
 */
export default async function TenantDetailPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            users: {
                orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                },
            },
            branches: {
                orderBy: { createdAt: 'asc' },
                select: { id: true, name: true, code: true, isActive: true, createdAt: true },
            },
        },
    });

    if (!tenant) notFound();

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentSales, salesAgg30, payments] = await Promise.all([
        prisma.salesOrder.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                orderNumber: true,
                total: true,
                status: true,
                createdAt: true,
            },
        }),
        prisma.salesOrder.aggregate({
            where: { tenantId, createdAt: { gte: since30 } },
            _sum: { total: true },
            _count: { _all: true },
        }),
        prisma.tenantPayment.findMany({
            where: { tenantId },
            orderBy: { paidAt: 'desc' },
            include: {
                recordedBy: {
                    select: { firstName: true, lastName: true, email: true },
                },
            },
        }),
    ]);

    const owner = tenant.users.find((u) => u.role === 'OWNER') ?? null;
    const url = `https://${tenant.slug}.${TENANT_ROOT_DOMAIN}`;

    return (
        <div className="space-y-8">
            <div>
                <Link
                    href="/admin/tenants"
                    className="inline-flex items-center gap-1 text-sm text-capsula-ink-soft hover:text-capsula-coral"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Tenants
                </Link>
            </div>

            <TenantDetailClient
                tenant={{
                    id: tenant.id,
                    slug: tenant.slug,
                    name: tenant.name,
                    createdAt: tenant.createdAt.toISOString(),
                    url,
                }}
                owner={owner ? { id: owner.id, email: owner.email } : null}
                users={tenant.users.map((u) => ({
                    id: u.id,
                    email: u.email,
                    fullName: `${u.firstName} ${u.lastName}`.trim(),
                    role: u.role,
                    isActive: u.isActive,
                    createdAt: u.createdAt.toISOString(),
                }))}
                branches={tenant.branches.map((b) => ({
                    id: b.id,
                    name: b.name,
                    code: b.code,
                    isActive: b.isActive,
                    createdAt: b.createdAt.toISOString(),
                }))}
                recentSales={recentSales.map((s) => ({
                    id: s.id,
                    orderNumber: s.orderNumber,
                    total: s.total,
                    status: s.status,
                    createdAt: s.createdAt.toISOString(),
                }))}
                stats={{
                    salesCount30d: salesAgg30._count._all,
                    salesTotal30d: salesAgg30._sum.total ?? 0,
                }}
                payments={payments.map((p) => ({
                    id: p.id,
                    amount: p.amount,
                    currency: p.currency,
                    paidAt: p.paidAt.toISOString(),
                    method: p.method,
                    periodStart: p.periodStart?.toISOString() ?? null,
                    periodEnd: p.periodEnd?.toISOString() ?? null,
                    note: p.note,
                    recordedBy: `${p.recordedBy.firstName} ${p.recordedBy.lastName}`.trim() || p.recordedBy.email,
                }))}
            />

            <div className="rounded-3xl border border-capsula-line bg-capsula-ivory-surface p-5 text-xs text-capsula-ink-muted">
                <div className="mb-1 font-semibold uppercase tracking-[0.14em]">URL del tenant</div>
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-capsula-navy-deep hover:text-capsula-coral"
                >
                    {url}
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>
        </div>
    );
}
