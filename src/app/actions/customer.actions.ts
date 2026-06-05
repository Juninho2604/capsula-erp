'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { getSession } from '@/lib/auth';

/**
 * Gestión de clientes recurrentes (Customer). Usado por:
 *   - /dashboard/clientes (UI gestor: lista + crear + editar + borrar suave).
 *   - POS Delivery (autocomplete por cédula o nombre al ingresar pedido).
 *
 * Borrado lógico (isActive=false) en vez de DELETE físico — preservamos
 * historial de SalesOrders que referencian al cliente por nombre.
 */

const idDocumentSchema = z.string().trim().min(3).max(20).regex(
    /^(V|E|J|G|P)-?\d+$/i,
    'Cédula inválida. Formato: V-12345678, E-..., J-..., G-..., P-...'
);

const customerInputSchema = z.object({
    fullName: z.string().trim().min(2, 'Nombre muy corto').max(120),
    idDocument: z.union([idDocumentSchema, z.literal('').transform(() => undefined)]).optional(),
    phone: z.string().trim().max(30).optional().or(z.literal('').transform(() => undefined)),
    email: z.union([
        z.string().trim().email('Email inválido'),
        z.literal('').transform(() => undefined),
    ]).optional(),
    address: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
    notes: z.string().trim().max(1000).optional().or(z.literal('').transform(() => undefined)),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export interface CustomerSummary {
    id: string;
    fullName: string;
    idDocument: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: Date | null;
    isActive: boolean;
    createdAt: Date;
}

function normalizeIdDocument(raw?: string): string | undefined {
    if (!raw) return undefined;
    // Normaliza "v12345678" → "V-12345678" (mayúscula, guion forzado).
    const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
    const m = cleaned.match(/^(V|E|J|G|P)-?(\d+)$/);
    if (!m) return cleaned; // dejarlo pasar para que zod lance error
    return `${m[1]}-${m[2]}`;
}

/**
 * Busca clientes por cédula o nombre. Devuelve hasta 10 resultados
 * ordenados por relevancia: cédula exacta primero, luego nombre que
 * empieza con el query, luego nombre que contiene el query.
 */
export async function searchCustomersAction(query: string): Promise<{
    success: boolean;
    customers: CustomerSummary[];
    message?: string;
}> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const q = query.trim();
        if (q.length < 2) {
            return { success: true, customers: [] };
        }

        const customers = await db.customer.findMany({
            where: {
                isActive: true,
                OR: [
                    { idDocument: { contains: q, mode: 'insensitive' } },
                    { fullName: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q, mode: 'insensitive' } },
                ],
            },
            orderBy: [
                { lastOrderAt: 'desc' },
                { fullName: 'asc' },
            ],
            take: 10,
        });

        return {
            success: true,
            customers: customers.map((c) => ({
                id: c.id,
                fullName: c.fullName,
                idDocument: c.idDocument,
                phone: c.phone,
                email: c.email,
                address: c.address,
                notes: c.notes,
                totalOrders: c.totalOrders,
                totalSpent: c.totalSpent,
                lastOrderAt: c.lastOrderAt,
                isActive: c.isActive,
                createdAt: c.createdAt,
            })),
        };
    } catch (err) {
        console.error('searchCustomersAction error', err);
        return { success: false, customers: [], message: 'Error buscando clientes' };
    }
}

export async function listCustomersAction(opts?: { includeInactive?: boolean }): Promise<{
    success: boolean;
    customers: CustomerSummary[];
}> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const customers = await db.customer.findMany({
            where: opts?.includeInactive ? {} : { isActive: true },
            orderBy: [{ lastOrderAt: 'desc' }, { fullName: 'asc' }],
            take: 500,
        });
        return {
            success: true,
            customers: customers.map((c) => ({
                id: c.id,
                fullName: c.fullName,
                idDocument: c.idDocument,
                phone: c.phone,
                email: c.email,
                address: c.address,
                notes: c.notes,
                totalOrders: c.totalOrders,
                totalSpent: c.totalSpent,
                lastOrderAt: c.lastOrderAt,
                isActive: c.isActive,
                createdAt: c.createdAt,
            })),
        };
    } catch (err) {
        console.error('listCustomersAction error', err);
        return { success: false, customers: [] };
    }
}

export async function createCustomerAction(input: CustomerInput): Promise<{
    success: boolean;
    message?: string;
    customer?: CustomerSummary;
}> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const normalized: CustomerInput = {
            ...input,
            idDocument: normalizeIdDocument(input.idDocument),
        };
        const parsed = customerInputSchema.safeParse(normalized);
        if (!parsed.success) {
            return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
        }

        // Si trae cédula, verificar que no exista ya (incluyendo inactivos
        // para evitar duplicados invisibles que romperían el unique).
        if (parsed.data.idDocument) {
            const existing = await db.customer.findFirst({
                where: { idDocument: parsed.data.idDocument },
            });
            if (existing) {
                return {
                    success: false,
                    message: `Ya existe un cliente con cédula ${parsed.data.idDocument}: ${existing.fullName}`,
                };
            }
        }

        const c = await db.customer.create({
            data: {
                tenantId,
                fullName: parsed.data.fullName,
                idDocument: parsed.data.idDocument ?? null,
                phone: parsed.data.phone ?? null,
                email: parsed.data.email ?? null,
                address: parsed.data.address ?? null,
                notes: parsed.data.notes ?? null,
                createdById: session.id,
            },
        });

        revalidatePath('/dashboard/clientes');

        return {
            success: true,
            customer: {
                id: c.id,
                fullName: c.fullName,
                idDocument: c.idDocument,
                phone: c.phone,
                email: c.email,
                address: c.address,
                notes: c.notes,
                totalOrders: c.totalOrders,
                totalSpent: c.totalSpent,
                lastOrderAt: c.lastOrderAt,
                isActive: c.isActive,
                createdAt: c.createdAt,
            },
        };
    } catch (err) {
        console.error('createCustomerAction error', err);
        return { success: false, message: 'Error creando cliente' };
    }
}

export async function updateCustomerAction(id: string, input: CustomerInput): Promise<{
    success: boolean;
    message?: string;
}> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const normalized: CustomerInput = {
            ...input,
            idDocument: normalizeIdDocument(input.idDocument),
        };
        const parsed = customerInputSchema.safeParse(normalized);
        if (!parsed.success) {
            return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
        }

        const current = await db.customer.findUnique({ where: { id } });
        if (!current) return { success: false, message: 'Cliente no encontrado' };

        // Si cambia la cédula, verificar que no choque con otro registro.
        if (parsed.data.idDocument && parsed.data.idDocument !== current.idDocument) {
            const conflict = await db.customer.findFirst({
                where: { idDocument: parsed.data.idDocument, NOT: { id } },
            });
            if (conflict) {
                return {
                    success: false,
                    message: `Otro cliente ya usa la cédula ${parsed.data.idDocument}: ${conflict.fullName}`,
                };
            }
        }

        await db.customer.update({
            where: { id },
            data: {
                fullName: parsed.data.fullName,
                idDocument: parsed.data.idDocument ?? null,
                phone: parsed.data.phone ?? null,
                email: parsed.data.email ?? null,
                address: parsed.data.address ?? null,
                notes: parsed.data.notes ?? null,
            },
        });

        revalidatePath('/dashboard/clientes');
        return { success: true };
    } catch (err) {
        console.error('updateCustomerAction error', err);
        return { success: false, message: 'Error actualizando cliente' };
    }
}

/**
 * Borrado lógico: marca isActive=false. El cliente desaparece de
 * autocomplete y listas pero los SalesOrders que lo referencien por
 * nombre/teléfono no se rompen.
 */
export async function deactivateCustomerAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        await db.customer.update({
            where: { id },
            data: { isActive: false },
        });
        revalidatePath('/dashboard/clientes');
        return { success: true };
    } catch (err) {
        console.error('deactivateCustomerAction error', err);
        return { success: false, message: 'Error desactivando cliente' };
    }
}

export async function reactivateCustomerAction(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        await db.customer.update({
            where: { id },
            data: { isActive: true },
        });
        revalidatePath('/dashboard/clientes');
        return { success: true };
    } catch (err) {
        console.error('reactivateCustomerAction error', err);
        return { success: false, message: 'Error reactivando cliente' };
    }
}

// ── CRM: ficha de cliente con historial y agregados exactos ───────────────────

export interface CustomerOrderRow {
    id: string;
    orderNumber: string;
    createdAt: Date;
    orderType: string | null;
    status: string;
    total: number;
    itemCount: number;
}

export interface CustomerDetail {
    id: string;
    fullName: string;
    idDocument: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    // Agregados EXACTOS (calculados desde las ventas vinculadas, no el cache).
    orderCount: number;
    totalSpent: number;
    avgTicket: number;
    firstOrderAt: Date | null;
    lastOrderAt: Date | null;
    orders: CustomerOrderRow[];
}

/**
 * Ficha completa de un cliente: datos + agregados exactos calculados desde
 * las SalesOrder vinculadas (excluye anuladas y propinas colectivas) +
 * historial de las últimas órdenes.
 */
export async function getCustomerDetailAction(id: string): Promise<{ success: boolean; data?: CustomerDetail; message?: string }> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const customer = await db.customer.findFirst({ where: { id } });
        if (!customer) return { success: false, message: 'Cliente no encontrado' };

        const where = {
            customerId: id,
            status: { not: 'CANCELLED' },
            customerName: { not: 'PROPINA COLECTIVA' },
        } as const;

        // Agregados EXACTOS sobre TODAS las ventas (no capadas). La lista de
        // historial sí se limita a 100 para no traer demasiadas filas.
        const [agg, firstOrder, orders] = await Promise.all([
            db.salesOrder.aggregate({ where, _count: { _all: true }, _sum: { total: true } }),
            db.salesOrder.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
            db.salesOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, orderNumber: true, createdAt: true, orderType: true,
                    status: true, total: true,
                    _count: { select: { items: true } },
                },
                take: 100,
            }),
        ]);

        const orderCount = agg._count._all;
        const totalSpent = agg._sum.total ?? 0;
        const avgTicket = orderCount > 0 ? totalSpent / orderCount : 0;
        const lastOrderAt = orders.length ? orders[0].createdAt : null;
        const firstOrderAt = firstOrder?.createdAt ?? null;

        return {
            success: true,
            data: {
                id: customer.id,
                fullName: customer.fullName,
                idDocument: customer.idDocument,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                notes: customer.notes,
                isActive: customer.isActive,
                createdAt: customer.createdAt,
                orderCount,
                totalSpent: Math.round(totalSpent * 100) / 100,
                avgTicket: Math.round(avgTicket * 100) / 100,
                firstOrderAt,
                lastOrderAt,
                orders: orders.map(o => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    createdAt: o.createdAt,
                    orderType: o.orderType,
                    status: o.status,
                    total: o.total || 0,
                    itemCount: o._count.items,
                })),
            },
        };
    } catch (err) {
        console.error('getCustomerDetailAction error', err);
        return { success: false, message: 'Error cargando la ficha del cliente' };
    }
}

export interface TopCustomerRow {
    id: string;
    fullName: string;
    phone: string | null;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: Date | null;
}

/**
 * Top clientes por gasto acumulado (cache). Para el panel de análisis.
 */
export async function getTopCustomersAction(limit = 10): Promise<{ success: boolean; data?: TopCustomerRow[] }> {
    try {
        const session = await getSession();
        if (!session) return { success: false };
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const rows = await db.customer.findMany({
            where: { isActive: true, totalSpent: { gt: 0 } },
            orderBy: { totalSpent: 'desc' },
            take: Math.min(50, Math.max(1, limit)),
            select: { id: true, fullName: true, phone: true, totalOrders: true, totalSpent: true, lastOrderAt: true },
        });
        return { success: true, data: rows };
    } catch (err) {
        console.error('getTopCustomersAction error', err);
        return { success: false };
    }
}
