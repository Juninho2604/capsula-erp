/**
 * Helpers server-side de promociones para el POS.
 *
 * Carga las promos activas del tenant (respetando el flag `promotionsEnabled`)
 * y las aplica:
 *   - en `getMenuForPOSAction` → para que el menú muestre y cobre el precio
 *     con descuento (la cajera ve y cobra el monto correcto).
 *   - en `createSalesOrderAction` / `addItemsToOpenTabAction` → re-aplicación
 *     AUTORITATIVA sobre el precio base de BD al momento del cobro (fuente de
 *     verdad; corrige cualquier desfase de horario y bloquea manipulación).
 *
 * El cálculo en sí vive en `engine.ts` (puro, testeado).
 */

import type { TenantPrismaClient } from '@/lib/prisma-tenant-client';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { resolveBestPromotion, type PromotionRule, type ItemForPricing } from './engine';
import { loadChannelPriceMap } from '@/lib/pricing/server';
import type { PriceListChannel } from '@/lib/pricing/price-list';

type PromoRow = {
    id: string; name: string; discountType: string; discountValue: number;
    maxDiscountPerUnit: number | null; applicableCategoryIds: string | null;
    applicableItemIds: string | null; daysOfWeek: string | null;
    startTime: string | null; endTime: string | null;
    startDate: Date | null; endDate: Date | null; priority: number; isActive: boolean;
};

function parseStrArr(raw: string | null): string[] {
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
function parseNumArr(raw: string | null): number[] {
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []; } catch { return []; }
}

function rowToRule(p: PromoRow): PromotionRule {
    return {
        id: p.id,
        name: p.name,
        discountType: p.discountType === 'FIXED' ? 'FIXED' : 'PERCENT',
        discountValue: p.discountValue,
        maxDiscountPerUnit: p.maxDiscountPerUnit,
        applicableCategoryIds: parseStrArr(p.applicableCategoryIds),
        applicableItemIds: parseStrArr(p.applicableItemIds),
        daysOfWeek: parseNumArr(p.daysOfWeek),
        startTime: p.startTime,
        endTime: p.endTime,
        startDate: p.startDate,
        endDate: p.endDate,
        priority: p.priority,
        isActive: p.isActive,
    };
}

/**
 * Carga las reglas de promoción activas para un tenant, o [] si el flag
 * `promotionsEnabled` está apagado.
 */
export async function loadActivePromotionRules(
    db: TenantPrismaClient,
    tenantId: string,
): Promise<PromotionRule[]> {
    const enabled = await tenantFeatureEnabled(tenantId, 'promotionsEnabled');
    if (!enabled) return [];
    const rows = await db.promotion.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { priority: 'desc' },
    });
    return rows.map(r => rowToRule(r as PromoRow));
}

export interface CartItemLike {
    menuItemId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    modifiers?: { priceAdjustment: number }[];
}

export interface PromoAudit {
    appliedPromotionId: string;
    appliedPromotionName: string | null;
    originalUnitPrice: number;
    /** Descuento total de la línea (≥0). */
    promotionDiscount: number;
}

/**
 * Re-aplica promociones de forma AUTORITATIVA sobre los items del carrito,
 * usando el precio base de lista de BD (no el precio que mandó el cliente).
 * Muta `unitPrice` y `lineTotal` de cada item con promo, y devuelve un array
 * de auditoría alineado por índice (null = sin promo, item intacto).
 *
 * Si el flag `promotionsEnabled` está apagado, no toca nada y devuelve nulls.
 */
export async function applyPromotionsToCart(
    db: TenantPrismaClient,
    tenantId: string,
    items: CartItemLike[],
    at: Date = new Date(),
    channel?: PriceListChannel,
): Promise<(PromoAudit | null)[]> {
    const result: (PromoAudit | null)[] = items.map(() => null);
    const rules = await loadActivePromotionRules(db, tenantId);
    if (rules.length === 0) return result;

    const ids = Array.from(new Set(items.map(i => i.menuItemId)));
    const menuItems = await db.menuItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true, categoryId: true },
    });
    const menuMap = new Map(menuItems.map(m => [m.id, m]));
    // §86: si hay lista de precios activa para el canal, la promo se calcula
    // sobre el precio de lista (no el base) → display y cobro coinciden.
    const listPrices = channel ? await loadChannelPriceMap(db, tenantId, channel) : null;

    items.forEach((item, idx) => {
        const mi = menuMap.get(item.menuItemId);
        if (!mi) return; // item desconocido → no tocar (defensivo)
        const base = listPrices?.get(item.menuItemId) ?? mi.price;
        const priced = priceItemWithPromotions(base, mi.id, mi.categoryId, rules, at);
        if (!priced.appliedPromotionId || priced.originalUnitPrice == null) return;
        const modSum = (item.modifiers ?? []).reduce((s, m) => s + (m.priceAdjustment || 0), 0);
        item.unitPrice = priced.unitPrice;
        item.lineTotal = Math.round((priced.unitPrice + modSum) * item.quantity * 100) / 100;
        result[idx] = {
            appliedPromotionId: priced.appliedPromotionId,
            appliedPromotionName: priced.appliedPromotionName,
            originalUnitPrice: priced.originalUnitPrice,
            promotionDiscount: Math.round(priced.discountPerUnit * item.quantity * 100) / 100,
        };
    });

    return result;
}

export interface PromoPricedItem {
    /** Precio unitario a usar (con descuento si aplica). */
    unitPrice: number;
    /** Precio de lista original (solo si hubo promo). */
    originalUnitPrice: number | null;
    appliedPromotionId: string | null;
    appliedPromotionName: string | null;
    /** Descuento por unidad (≥0); 0 si no hubo promo. */
    discountPerUnit: number;
}

/**
 * Resuelve el precio de un item dado su precio base de lista. Si ninguna
 * promo aplica, devuelve el precio base sin marcas.
 */
export function priceItemWithPromotions(
    basePrice: number,
    menuItemId: string,
    categoryId: string,
    rules: PromotionRule[],
    at: Date = new Date(),
): PromoPricedItem {
    if (rules.length === 0) {
        return { unitPrice: basePrice, originalUnitPrice: null, appliedPromotionId: null, appliedPromotionName: null, discountPerUnit: 0 };
    }
    const item: ItemForPricing = { menuItemId, categoryId, basePrice };
    const applied = resolveBestPromotion(item, rules, at);
    if (!applied) {
        return { unitPrice: basePrice, originalUnitPrice: null, appliedPromotionId: null, appliedPromotionName: null, discountPerUnit: 0 };
    }
    return {
        unitPrice: applied.finalUnitPrice,
        originalUnitPrice: basePrice,
        appliedPromotionId: applied.promotionId,
        appliedPromotionName: applied.promotionName,
        discountPerUnit: applied.discountPerUnit,
    };
}
