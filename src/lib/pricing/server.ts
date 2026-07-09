import 'server-only';
import type { TenantPrismaClient } from '@/lib/prisma-tenant-client';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import {
    channelPriceMap,
    parseChannels,
    type PriceListChannel,
    type PriceListForResolve,
} from './price-list';

/**
 * Listas de precios (§86) — carga server-side. Gateado por el flag
 * `priceListsEnabled`: sin flag devuelve mapa vacío (todos los canales usan
 * precio base), aunque existan listas cargadas.
 */
export async function loadActivePriceLists(
    db: TenantPrismaClient,
    tenantId: string,
): Promise<PriceListForResolve[]> {
    if (!(await tenantFeatureEnabled(tenantId, 'priceListsEnabled'))) return [];
    const lists = await db.priceList.findMany({
        where: { isActive: true, deletedAt: null },
        select: {
            id: true,
            channels: true,
            priority: true,
            updatedAt: true,
            items: { select: { menuItemId: true, price: true } },
        },
    });
    return lists.map(l => ({
        id: l.id,
        channels: parseChannels(l.channels),
        priority: l.priority,
        updatedAtMs: l.updatedAt.getTime(),
        items: l.items,
    }));
}

/**
 * Mapa menuItemId → precio override para un canal (lista ganadora). Vacío si
 * el flag está off o ninguna lista cubre el canal.
 */
export async function loadChannelPriceMap(
    db: TenantPrismaClient,
    tenantId: string,
    channel: PriceListChannel,
): Promise<Map<string, number>> {
    const lists = await loadActivePriceLists(db, tenantId);
    return channelPriceMap(lists, channel);
}
