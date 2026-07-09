'use server';

/**
 * Listas de precios por canal (§86) — CRUD admin (gated por rol gerencial /
 * PERM.MANAGE_PRICE_LISTS) + lectura para gestión.
 *
 * La resolución de precio para el POS vive en `src/lib/pricing/*` (puro +
 * loader server). Escrituras multi-tenant usan `updateMany({ where: { id,
 * tenantId } })` por la limitación de prisma-tenant-client.
 */

import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import prisma from '@/server/db';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { revalidatePath } from 'next/cache';
import {
    PRICE_LIST_CHANNELS,
    isPriceListChannel,
    parseChannels,
    type PriceListChannel,
} from '@/lib/pricing/price-list';

const MANAGER_ROLES = new Set(['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER']);

function canManage(role: string | undefined): boolean {
    return !!role && MANAGER_ROLES.has(role);
}

export interface PriceListDTO {
    id: string;
    name: string;
    description: string | null;
    channels: PriceListChannel[];
    priority: number;
    isActive: boolean;
    itemCount: number;
    updatedAt: string;
}

export interface PriceListItemDTO {
    menuItemId: string;
    price: number;
}

interface Result<T = undefined> {
    success: boolean;
    message?: string;
    data?: T;
}

function sanitizeChannels(input: unknown): string {
    const arr = Array.isArray(input) ? input.filter(isPriceListChannel) : [];
    // dedupe conservando orden del catálogo
    const ordered = PRICE_LIST_CHANNELS.map(c => c.key).filter(k => arr.includes(k));
    return JSON.stringify(ordered);
}

export async function getPriceListsAction(): Promise<Result<PriceListDTO[]>> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const lists = await db.priceList.findMany({
            where: { deletedAt: null },
            orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
            select: {
                id: true, name: true, description: true, channels: true,
                priority: true, isActive: true, updatedAt: true,
                _count: { select: { items: true } },
            },
        });
        return {
            success: true,
            data: lists.map(l => ({
                id: l.id,
                name: l.name,
                description: l.description,
                channels: parseChannels(l.channels),
                priority: l.priority,
                isActive: l.isActive,
                itemCount: l._count.items,
                updatedAt: l.updatedAt.toISOString(),
            })),
        };
    } catch (e) {
        console.error('getPriceListsAction', e);
        return { success: false, message: 'Error cargando listas de precios' };
    }
}

/** Items (menuItemId → price) de una lista, para el editor. */
export async function getPriceListItemsAction(priceListId: string): Promise<Result<PriceListItemDTO[]>> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const list = await db.priceList.findFirst({
            where: { id: priceListId, deletedAt: null },
            select: { id: true, items: { select: { menuItemId: true, price: true } } },
        });
        if (!list) return { success: false, message: 'Lista no encontrada' };
        return { success: true, data: list.items };
    } catch (e) {
        console.error('getPriceListItemsAction', e);
        return { success: false, message: 'Error cargando precios de la lista' };
    }
}

export async function createPriceListAction(input: {
    name: string;
    description?: string;
    channels?: string[];
    priority?: number;
}): Promise<Result<{ id: string }>> {
    try {
        const session = await getSession();
        if (!canManage(session?.role)) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        if (!input.name?.trim()) return { success: false, message: 'El nombre es obligatorio' };
        const created = await db.priceList.create({
            data: {
                tenantId,
                name: input.name.trim(),
                description: input.description?.trim() || null,
                channels: sanitizeChannels(input.channels),
                priority: Number.isFinite(input.priority) ? Number(input.priority) : 0,
                isActive: true,
            },
            select: { id: true },
        });
        revalidatePath('/dashboard/menu/listas-precios');
        return { success: true, data: { id: created.id } };
    } catch (e) {
        console.error('createPriceListAction', e);
        return { success: false, message: 'Error creando la lista' };
    }
}

export async function updatePriceListAction(id: string, input: {
    name?: string;
    description?: string | null;
    channels?: string[];
    priority?: number;
}): Promise<Result> {
    try {
        const session = await getSession();
        if (!canManage(session?.role)) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).priceList.updateMany({
            where: { id, deletedAt: null },
            data: {
                ...(input.name !== undefined && { name: input.name.trim() }),
                ...(input.description !== undefined && { description: input.description?.trim() || null }),
                ...(input.channels !== undefined && { channels: sanitizeChannels(input.channels) }),
                ...(input.priority !== undefined && Number.isFinite(input.priority) && { priority: Number(input.priority) }),
            },
        });
        if (res.count === 0) return { success: false, message: 'Lista no encontrada' };
        revalidatePath('/dashboard/menu/listas-precios');
        return { success: true };
    } catch (e) {
        console.error('updatePriceListAction', e);
        return { success: false, message: 'Error actualizando la lista' };
    }
}

export async function togglePriceListAction(id: string, isActive: boolean): Promise<Result> {
    try {
        const session = await getSession();
        if (!canManage(session?.role)) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).priceList.updateMany({
            where: { id, deletedAt: null },
            data: { isActive },
        });
        if (res.count === 0) return { success: false, message: 'Lista no encontrada' };
        revalidatePath('/dashboard/menu/listas-precios');
        return { success: true };
    } catch (e) {
        console.error('togglePriceListAction', e);
        return { success: false, message: 'Error cambiando el estado' };
    }
}

export async function deletePriceListAction(id: string): Promise<Result> {
    try {
        const session = await getSession();
        if (!canManage(session?.role)) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).priceList.updateMany({
            where: { id, deletedAt: null },
            data: { isActive: false, deletedAt: new Date() },
        });
        if (res.count === 0) return { success: false, message: 'Lista no encontrada' };
        revalidatePath('/dashboard/menu/listas-precios');
        return { success: true };
    } catch (e) {
        console.error('deletePriceListAction', e);
        return { success: false, message: 'Error eliminando la lista' };
    }
}

/**
 * Reemplaza (replace-all) los precios de una lista. Cada fila con precio > 0
 * es un override; filas con precio null/≤0 se quitan (item vuelve al base).
 * Valida ownership del tenant sobre la lista y sobre cada MenuItem.
 */
export async function setPriceListItemsAction(
    priceListId: string,
    items: Array<{ menuItemId: string; price: number | null }>,
): Promise<Result> {
    try {
        const session = await getSession();
        if (!canManage(session?.role)) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const list = await db.priceList.findFirst({ where: { id: priceListId, deletedAt: null }, select: { id: true } });
        if (!list) return { success: false, message: 'Lista no encontrada' };

        // Solo overrides válidos (precio > 0). Dedupe por menuItemId (último gana).
        const valid = new Map<string, number>();
        for (const it of items) {
            if (!it.menuItemId) continue;
            if (it.price == null || !Number.isFinite(it.price) || it.price <= 0) continue;
            valid.set(it.menuItemId, it.price);
        }

        // Ownership de los MenuItems referenciados.
        if (valid.size > 0) {
            const ids = Array.from(valid.keys());
            const owned = await db.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true } });
            if (owned.length !== ids.length) {
                return { success: false, message: 'Uno o más productos no existen' };
            }
        }

        await prisma.$transaction([
            prisma.priceListItem.deleteMany({ where: { priceListId } }),
            ...(valid.size > 0
                ? [prisma.priceListItem.createMany({
                    data: Array.from(valid.entries()).map(([menuItemId, price]) => ({ priceListId, menuItemId, price })),
                })]
                : []),
            prisma.priceList.update({ where: { id: priceListId }, data: { updatedAt: new Date() } }),
        ]);

        revalidatePath('/dashboard/menu/listas-precios');
        return { success: true };
    } catch (e) {
        console.error('setPriceListItemsAction', e);
        return { success: false, message: 'Error guardando los precios' };
    }
}
