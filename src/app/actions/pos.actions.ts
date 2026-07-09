'use server';

/**
 * SHANKLISH CARACAS ERP - POS Actions
 * 
 * Server Actions para el Sistema de Punto de Venta
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { withTenant, type TenantPrismaClient } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

/**
 * Devuelve el cliente Prisma con isolación por tenant + el tenantId resuelto.
 *
 * Por qué entregamos el tenantId al caller (y no solo el db extendido):
 * la extension `withTenant` inyecta tenantId en operaciones DIRECTAS al cliente
 * (db.openTab.create), pero hay incertidumbre sobre propagación dentro de
 * `db.$transaction(async (tx) => ...)` en Prisma 5.x. Para defensa en
 * profundidad, los callers pasan tenantId explícito a creates sobre modelos
 * tenant-aware dentro de transacciones.
 */
async function getTenantCtx(): Promise<{ db: TenantPrismaClient; tenantId: string }> {
    const { tenantId } = await resolveTenantContext();
    return { db: withTenant(tenantId), tenantId };
}

/**
 * Wrapper retrocompatible: devuelve solo el db extendido. Para call sites que
 * no necesitan el tenantId.
 */
async function getTenantDb(): Promise<TenantPrismaClient> {
    const { db } = await getTenantCtx();
    return db;
}
import { getSession } from '@/lib/auth';
import { registerSale } from '@/server/services/inventory.service';
import { getCaracasDateStamp, getCaracasDayRange } from '@/lib/datetime';
import { getNextCorrelativo } from '@/lib/invoice-counter';
import { nextDailyNumber } from '@/lib/sales/daily-order-number';
import { DIVISAS_DISCOUNT_CONFIG_KEY, divisasDiscountRate, parseDivisasPercent, MIN_DELIVERY_FEE_DIVISAS } from '@/lib/sales/divisas-config';
import { getStockValidationEnabled } from '@/app/actions/system-config.actions';
import { createReorderBroadcastsAction } from '@/app/actions/purchase.actions';
import { pbkdf2Hex, hashPin } from '@/app/actions/user.actions';
import { updateSessionCashier } from '@/lib/auth';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { loadActivePromotionRules, priceItemWithPromotions, applyPromotionsToCart } from '@/lib/promotions/server';
import { loadChannelPriceMap } from '@/lib/pricing/server';
import type { PriceListChannel } from '@/lib/pricing/price-list';
import { resolveCustomerForOrder, bumpCustomerStats } from '@/lib/customers/link';
import { suggestedTipAmount } from '@/lib/sales/tip-calculation';
import { embedTabCode } from '@/lib/sales/collective-tip-ref';
import { buildMenuItemCostMap, costSnapshotFields } from '@/lib/sales/menu-item-cost';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { tenantFeatureEnabled } from '@/lib/feature-flags';

/**
 * Métodos de pago cuyo dinero entra en BOLÍVARES (el monto Bs y la tasa
 * histórica deben persistirse en la línea de pago / split — BUG #3 del
 * DIAGNOSTICO_REPORTES). Espejo de BS_METHODS de MixedPaymentSelector.
 */
const BS_PAYMENT_METHODS = new Set([
    'CASH_BS', 'PDV_SHANKLISH', 'PDV_SUPERFERRO', 'MOVIL_NG',
    'MOBILE_PAY', 'CARD', 'TRANSFER',
]);

// ============================================================================
// TIPOS
// ============================================================================

export interface CartItem {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifiers: {
        modifierId: string;
        name: string;
        priceAdjustment: number;
    }[];
    notes?: string;
    lineTotal: number;
    takeaway?: boolean; // Item para llevar dentro de una mesa
}

export type POSOrderType = 'RESTAURANT' | 'DELIVERY' | 'PICKUP';
export type POSPaymentMethod = 'CASH' | 'CASH_USD' | 'CASH_EUR' | 'CASH_BS' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY' | 'MOVIL_NG' | 'PDV_SHANKLISH' | 'PDV_SUPERFERRO' | 'MULTIPLE' | 'ZELLE' | 'CORTESIA';

export interface PaymentLine {
    method: string;          // CASH | ZELLE | CARD | MOBILE_PAY | TRANSFER | CORTESIA
    amountUSD: number;
    amountBS?: number;
    exchangeRate?: number;
    reference?: string;
}

export interface CreateOrderData {
    orderType: POSOrderType;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    /** CRM: id de la ficha de cliente elegida en el POS (delivery). Opcional. */
    customerId?: string;
    items: CartItem[];
    // Legacy single-method fields (kept for backwards compat)
    paymentMethod?: POSPaymentMethod;
    amountPaid?: number;
    keepChangeAsTip?: boolean;
    tipAtCheckout?: number; // explicit tip amount — reduces stored change accordingly
    // New: multi-method payments
    payments?: PaymentLine[];
    // USD amount eligible for the -33% divisas discount (only used in pago mixto)
    // If not set, the full subtotal gets the -33% when discountType === 'DIVISAS_33'
    divisasUsdAmount?: number;
    notes?: string;
    discountType?: string; // 'DIVISAS_33', 'CORTESIA_100', 'CORTESIA_PERCENT', 'NONE'
    discountPercent?: number;
    authorizedById?: string;
    /**
     * Promo "Delivery Gratis" — exonera el costo de envío sin afectar el precio
     * de los productos. Solo aplica a orderType = DELIVERY. Compatible con
     * cualquier `discountType` existente: si hay otro descuento activo, el fee
     * remanente se waivea por encima. El monto exonerado se suma a `discount`
     * y se anota en `discountReason` para trazabilidad. Default `false`/
     * `undefined` → comportamiento idéntico al previo.
     */
    freeDelivery?: boolean;
    // Hora de entrega solicitada (PICKUP/DELIVERY). ISO string desde el
    // cliente; la action la persiste como DateTime y la encola a la
    // comanda de cocina vía `enqueueKitchenCommand` cuando esté seteada.
    scheduledDeliveryTime?: string;
}

export interface OpenTabInput {
    tableOrStationId: string;
    customerLabel?: string;
    customerPhone?: string;
    guestCount?: number;
    assignedWaiterId?: string;
    waiterLabel?: string;
    waiterProfileId?: string; // Mesonero identificado por PIN (Waiter.id)
    notes?: string;
}

export interface AddItemsToOpenTabInput {
    openTabId: string;
    items: CartItem[];
    waiterProfileId?: string; // Mesonero identificado por PIN (Waiter.id)
    notes?: string;
    // Si se provee, los items recién creados se asignan automáticamente a esta
    // subcuenta (TabSubAccount). Permite al mesero tomar pedidos directos a una
    // subcuenta concreta cuando la cuenta ya está dividida.
    targetSubAccountId?: string;
}

export interface RegisterOpenTabPaymentInput {
    openTabId: string;
    amount: number;
    paymentMethod: POSPaymentMethod;
    splitLabel?: string;
    notes?: string;
    discountAmount?: number;
    discountType?: string;   // 'DIVISAS_33', 'CORTESIA_100', 'CORTESIA_PERCENT', 'NONE'
    discountReason?: string; // texto auditable: "Pago en Divisas (33.33%)", etc.
    serviceFeeIncluded?: boolean; // Si el cliente pagó el cargo de servicio (sala principal). Default: true para TABLE_SERVICE.
    serviceFeePercent?: number; // % de servicio editable al cobro (§85). Default 10 si serviceFeeIncluded y no se pasa.
    /**
     * Dinero realmente entregado por el cliente, a registrar como `paidAmount`
     * del split. Se usa cuando `amount` lleva el NETO de ítems aplicado (no el
     * bruto recibido) — caso del cobro en divisas proporcional, donde el neto y
     * el dinero entregado difieren. Si se omite, `paidAmount = amount` (igual que
     * siempre para el resto de los cobros).
     */
    paidAmountOverride?: number;
    /**
     * PIN de capitán o gerente necesario para EXIMIR del 10% servicio
     * (cuando serviceFeeIncluded === false en una mesa TABLE_SERVICE).
     */
    skipServiceFeeAuthPin?: string;
}

export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
}

class POSActionError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
        this.name = 'POSActionError';
    }
}

async function ensureBaseSalesArea() {
    const { db, tenantId } = await getTenantCtx();
    const whereActive = { isActive: true };

    // 1. Área preferida: SHANKLISH SERVICIO (nombre histórico que Shanklish
    //    creó manualmente). Se sigue buscando por compatibilidad — si existe
    //    para algún tenant (caso: Shanklish), se prioriza.
    let area = await db.area.findFirst({
        where: { ...whereActive, name: { contains: 'SHANKLISH SERVICIO', mode: 'insensitive' } },
    });
    if (area) return area;

    // 2. Restaurante
    area = await db.area.findFirst({
        where: { ...whereActive, name: { contains: 'Restaurante', mode: 'insensitive' } },
    });
    if (area) return area;

    // 3. Barra (incluye BARRA, DEPOSITO BARRA)
    area = await db.area.findFirst({
        where: { ...whereActive, name: { contains: 'Barra', mode: 'insensitive' } },
    });
    if (area) return area;

    // 4. Oficina
    area = await db.area.findFirst({
        where: { ...whereActive, name: { contains: 'Oficina', mode: 'insensitive' } },
    });
    if (area) return area;

    // 5. Cualquier área activa
    area = await db.area.findFirst({ where: whereActive });
    if (area) return area;

    // 6. Último recurso: cualquier área (incluso inactiva)
    area = await db.area.findFirst();
    if (area) return area;

    // 7. Crear área de servicio por defecto con nombre genérico.
    //    ANTES: se creaba 'SHANKLISH SERVICIO' para cualquier tenant nuevo
    //    que llegara a este fallback → leak de branding directo en BD.
    //    Para Shanklish este paso 7 nunca corre (siempre encuentra una en
    //    los pasos 1-6 porque ya tiene 9 áreas). Para tenants nuevos sin
    //    áreas previas, se crea con nombre neutral.
    return db.area.create({
        data: { tenantId, name: 'Servicio General', isActive: true }
    });
}

const RESTAURANT_ZONES = [
    { code: 'SALON_PPAL', name: 'Salón Principal', zoneType: 'DINING',   sortOrder: 1, prefix: 'SP', tableCount: 30 },
] as const;

async function ensureRestaurantSetup() {
    const { db, tenantId } = await getTenantCtx();
    // Ensure branch
    let branch = await db.branch.findFirst();
    if (!branch) {
        // Fallback: si el tenant no tiene Branch, creamos uno con el nombre
        // del propio tenant (NO el de Shanklish). ANTES estaba hardcoded
        // 'Shanklish Caracas' / 'SHK-CCS' / 'Shanklish Caracas, C.A.' — leak
        // crítico de branding fiscal en tenants nuevos.
        //
        // Para Shanklish este fallback nunca corre — ya tiene su Branch
        // SHK-CCS creado hace meses, findFirst() lo retorna y skip al create.
        // Para tenants creados con scripts/create-tenant.ts o desde el panel
        // admin, ya viene su Branch MAIN, así que este create también se
        // skipea. El path acá solo se ejecuta si alguien borra todos los
        // branches del tenant (escenario muy raro).
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true, legalName: true },
        });
        const tenantName = tenant?.name ?? 'Sucursal Principal';
        branch = await db.branch.create({
            data: {
                tenantId,
                code: 'MAIN',
                name: tenantName,
                legalName: tenant?.legalName ?? null,
            },
        });
    }

    // Ensure sales area for inventory
    const hasArea = await db.area.findFirst({ where: { branchId: branch.id, name: { contains: 'Salón', mode: 'insensitive' } } });
    if (!hasArea) {
        await db.area.create({
            data: { tenantId, branchId: branch.id, name: 'Salón Principal', description: 'Área de descarga POS Restaurante' }
        });
    }

    // Upsert each zone with tables
    for (const zConf of RESTAURANT_ZONES) {
        let zone = await db.serviceZone.findFirst({ where: { branchId: branch.id, code: zConf.code } });
        if (!zone) {
            zone = await db.serviceZone.findFirst({ where: { branchId: branch.id, name: zConf.name } });
        }
        if (!zone) {
            zone = await db.serviceZone.create({
                data: { tenantId, branchId: branch.id, code: zConf.code, name: zConf.name, zoneType: zConf.zoneType, sortOrder: zConf.sortOrder }
            });
        } else {
            zone = await db.serviceZone.update({
                where: { id: zone.id },
                data: { code: zConf.code, zoneType: zConf.zoneType, sortOrder: zConf.sortOrder }
            });
        }
        const existingCodes = await db.tableOrStation.findMany({
            where: { serviceZoneId: zone.id },
            select: { code: true }
        });
        const codeSet = new Set(existingCodes.map(t => t.code));
        const toCreate: { tenantId: string; branchId: string; serviceZoneId: string; code: string; name: string; stationType: string; capacity: number }[] = [];
        for (let i = 1; i <= zConf.tableCount; i++) {
            const tCode = `${zConf.prefix}-${String(i).padStart(2, '0')}`;
            if (!codeSet.has(tCode)) {
                toCreate.push({ tenantId, branchId: branch.id, serviceZoneId: zone.id, code: tCode, name: `Mesa ${tCode}`, stationType: 'TABLE', capacity: 4 });
            }
        }
        if (toCreate.length > 0) {
            await db.tableOrStation.createMany({ data: toCreate, skipDuplicates: true });
        }
    }

    // Return full layout with traceability — filter by name (reliable even if code was null before)
    return db.branch.findFirstOrThrow({
        where: { id: branch.id },
        include: {
            serviceZones: {
                where: { name: { in: RESTAURANT_ZONES.map(z => z.name) } },
                include: {
                    tablesOrStations: {
                        where: { isActive: true },
                        include: {
                            openTabs: {
                                where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
                                include: {
                                    openedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                                    closedBy: { select: { id: true, firstName: true, lastName: true } },
                                    paymentSplits: true,
                                    orders: {
                                        include: {
                                            items: {
                                                where: { voidedAt: null },
                                                include: { modifiers: true },
                                            },
                                            createdBy: { select: { firstName: true, lastName: true } }
                                        },
                                        orderBy: { createdAt: 'desc' }
                                    }
                                },
                                orderBy: { openedAt: 'desc' }
                            }
                        },
                        orderBy: { name: 'asc' }
                    }
                },
                orderBy: { sortOrder: 'asc' }
            }
        }
    });
}

async function resolveSalesAreaForBranch(branchId?: string) {
    const db = await getTenantDb();
    if (branchId) {
        const branchArea = await db.area.findFirst({
            where: {
                branchId,
                OR: [
                    { name: { contains: 'SHANKLISH SERVICIO', mode: 'insensitive' } },
                    { name: { contains: 'Barra', mode: 'insensitive' } },
                    { name: { contains: 'Restaurante', mode: 'insensitive' } },
                    { name: { contains: 'Oficina', mode: 'insensitive' } },
                ]
            }
        });

        if (branchArea) return branchArea;
    }

    return ensureBaseSalesArea();
}

const DELIVERY_FEE_NORMAL = 4.5;
// PISO del fee de delivery en divisas (§87): SIEMPRE $3 mínimo — se le paga al
// motorizado sí o sí. El descuento por divisas (editable) aplica SOLO a los
// ítems, nunca al fee. Por eso el fee en divisas es un swap fijo NORMAL→$3, no
// un %; el Math.max lo blinda ante un cambio accidental del constante.
const DELIVERY_FEE_DIVISAS = Math.max(MIN_DELIVERY_FEE_DIVISAS, 3);

/** Redondea a 2 decimales. */
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** % de servicio editable (§85) → fracción segura. Default 10%. Clamp 0–100. */
function normalizeServiceRate(percent: number | undefined | null): number {
    if (percent == null || !Number.isFinite(percent)) return 0.10;
    return Math.min(100, Math.max(0, percent)) / 100;
}

/** Fracción de descuento por divisas (§87), leída de SystemConfig. Default 1/3. */
async function loadDivisasDiscountRate(db: TenantPrismaClient): Promise<number> {
    try {
        const cfg = await db.systemConfig.findFirst({ where: { key: DIVISAS_DISCOUNT_CONFIG_KEY } });
        return divisasDiscountRate(parseDivisasPercent(cfg?.value));
    } catch {
        return divisasDiscountRate(null);
    }
}

/** Redondea a 2 decimales: ≥0.5 sube, <0.5 baja. Aplica antes de guardar en BD. */
function roundCents(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Regla de negocio — redondeo por método de pago:
 *
 *  DIVISAS efectivo (CASH_USD, CASH_EUR, ZELLE):
 *    Aplicar 33% de descuento → Math.round() al resultado FINAL.
 *    El descuento se calcula como roundCents(base / 3) y LUEGO se redondea el neto.
 *    Ejemplo: $26.75 → descuento $8.92 → neto $17.83 → Math.round → $18.
 *
 *  BOLÍVARES (CASH_BS, PDV_SHANKLISH, PDV_SUPERFERRO, MOVIL_NG):
 *    SIN redondeo. El monto USD exacto × tasa BCV = Bs exactos.
 *    NO aplicar Math.round() ni al base ni al total en Bs.
 *
 * Debe aplicarse como ÚLTIMO paso, después de descuentos y service charge.
 * NUNCA al precio base ni al monto en Bs.
 */
function isCashDivisaMethod(method?: string): boolean {
    return method === 'CASH_USD' || method === 'CASH_EUR' || method === 'ZELLE';
}

/**
 * @param exactTotal Cuando true (feature flag `exactCashSaleTip`): la VENTA no
 *   se redondea — registra el monto exacto. El redondeo al dólar (hacia arriba)
 *   pasa a ser una sugerencia de cobro en el frontend y la diferencia va a
 *   propina. Cuando false (histórico): cash divisas se redondea al entero.
 */
function roundToWhole(amount: number, paymentMethod?: string, exactTotal = false): number {
    if (exactTotal) return roundCents(amount);
    if (isCashDivisaMethod(paymentMethod)) {
        return Math.round(amount);
    }
    return amount;
}

function calculateCartTotals(
    data: Pick<CreateOrderData, 'orderType' | 'items' | 'discountType' | 'discountPercent' | 'amountPaid' | 'divisasUsdAmount' | 'paymentMethod' | 'freeDelivery'>,
    exactTotal = false,
    // Fracción de descuento por divisas (§87). Default 1/3 (33,33% histórico).
    // Aplica SOLO a los ítems; el fee de delivery mantiene su piso de $3.
    divisasRate: number = 1 / 3,
) {
    const itemsSubtotal = data.items.reduce((sum, item) => sum + item.lineTotal, 0);

    // DELIVERY: $4.5 fee normal, $3 en divisas. Sin 10% servicio.
    if (data.orderType === 'DELIVERY') {
        let subtotal: number;
        let discount: number;
        let total: number;
        let discountReason = '';

        if (data.discountType === 'DIVISAS_33') {
            // Divisas parcial: solo la porción en USD recibe el descuento. El
            // descuento aplica a los ÍTEMS; el fee de delivery baja de NORMAL a
            // DIVISAS ($3) y ahí queda su piso (nunca menos — se le paga al
            // motorizado sí o sí). El % es editable (§87) pero NO toca el fee.
            const divisasBase = data.divisasUsdAmount ?? itemsSubtotal;
            const pctLabel = Math.round(divisasRate * 10000) / 100;
            subtotal = itemsSubtotal + DELIVERY_FEE_NORMAL;
            discount = roundCents(divisasBase * divisasRate + (DELIVERY_FEE_NORMAL - DELIVERY_FEE_DIVISAS));
            total = subtotal - discount;
            discountReason = divisasBase < itemsSubtotal - 0.01
                ? `Pago Mixto Divisas (${pctLabel}% sobre $${divisasBase.toFixed(2)}) - Delivery $${DELIVERY_FEE_DIVISAS}`
                : `Pago en Divisas (${pctLabel}%) - Delivery $${DELIVERY_FEE_DIVISAS}`;
        } else if (data.discountType === 'CORTESIA_100') {
            subtotal = itemsSubtotal + DELIVERY_FEE_NORMAL;
            discount = subtotal;
            total = 0;
            discountReason = 'Cortesía Autorizada (100%)';
        } else if (data.discountType === 'CORTESIA_PERCENT' && data.discountPercent != null) {
            const pct = Math.min(100, Math.max(0, data.discountPercent)) / 100;
            subtotal = itemsSubtotal + DELIVERY_FEE_NORMAL;
            discount = roundCents(subtotal * pct);
            total = subtotal - discount;
            discountReason = `Cortesía Autorizada (${data.discountPercent}%)`;
        } else {
            subtotal = itemsSubtotal + DELIVERY_FEE_NORMAL;
            discount = 0;
            total = subtotal;
        }

        // ──────────────────────────────────────────────────────────────────
        // PROMO "Delivery Gratis" — aditivo. Calcula el fee REMANENTE después
        // de aplicar el descuento previo, y lo waivea sumándolo a `discount`.
        // El `subtotal` se mantiene (sigue incluyendo el fee bruto, para no
        // distorsionar reportes de "precio de lista"). Solo se mueve el
        // `discount`, `total` y `discountReason`. Si freeDelivery está
        // off/undefined, este bloque es no-op total.
        if (data.freeDelivery === true) {
            const pct = data.discountType === 'CORTESIA_PERCENT' && data.discountPercent != null
                ? Math.min(100, Math.max(0, data.discountPercent)) / 100
                : null;
            const remainingFee =
                data.discountType === 'CORTESIA_100' ? 0                                  // ya está todo descontado
                : data.discountType === 'DIVISAS_33' ? DELIVERY_FEE_DIVISAS                // queda el fee divisas
                : pct !== null ? roundCents(DELIVERY_FEE_NORMAL * (1 - pct))               // queda lo no descontado
                : DELIVERY_FEE_NORMAL;                                                     // sin descuento previo

            if (remainingFee > 0) {
                discount = roundCents(discount + remainingFee);
                total = roundCents(total - remainingFee);
                if (total < 0) total = 0;
                discountReason = discountReason
                    ? `${discountReason} + Delivery Gratis (Promo)`
                    : 'Delivery Gratis (Promo)';
            }
        }

        total = roundToWhole(total, data.paymentMethod, exactTotal);
        const change = (data.amountPaid || 0) - total;
        return { subtotal, discount, total, change: change > 0 ? change : 0, discountReason };
    }

    // RESTAURANT / PICKUP: sin delivery fee, lógica original
    const subtotal = itemsSubtotal;
    let discount = 0;
    let discountReason = '';

    if (data.discountType === 'DIVISAS_33') {
        const divisasBase = data.divisasUsdAmount ?? subtotal;
        const pctLabel = Math.round(divisasRate * 10000) / 100;
        discount = roundCents(divisasBase * divisasRate);
        discountReason = divisasBase < subtotal - 0.01
            ? `Pago Mixto Divisas (${pctLabel}% sobre $${divisasBase.toFixed(2)})`
            : `Pago en Divisas (${pctLabel}%)`;
    } else if (data.discountType === 'CORTESIA_100') {
        discount = subtotal;
        discountReason = 'Cortesía Autorizada (100%)';
    } else if (data.discountType === 'CORTESIA_PERCENT' && data.discountPercent != null) {
        const pct = Math.min(100, Math.max(0, data.discountPercent)) / 100;
        discount = roundCents(subtotal * pct);
        discountReason = `Cortesía Autorizada (${data.discountPercent}%)`;
    }

    if (discount > subtotal) discount = subtotal;

    const total = roundToWhole(subtotal - discount, data.paymentMethod, exactTotal);
    const change = (data.amountPaid || 0) - total;

    return {
        subtotal,
        discount,
        total,
        change: change > 0 ? change : 0,
        discountReason
    };
}

async function generateTabCode(): Promise<string> {
    return getNextCorrelativo('OPEN_TAB');
}

async function getMenuItemMetadata(menuItemIds: string[]) {
    const db = await getTenantDb();
    return db.menuItem.findMany({
        where: { id: { in: menuItemIds } }
    });
}

function requiresKitchenRouting(menuItem: any) {
    if (menuItem?.kitchenRouting === 'NONE') return false;
    // AUTO o cualquier otro valor → siempre va a cocina/barra sin excepción
    // La segmentación cocina/barra se hace en el API por categoría, no aquí
    return true;
}

function requiresStockValidation(menuItem: any) {
    if (menuItem?.stockTrackingMode === 'DISPLAY_ONLY') return false;
    if (menuItem?.serviceCategory === 'BUCKET' || menuItem?.serviceCategory === 'COCKTAIL') return true;
    if (menuItem?.stockTrackingMode === 'COMPOUND' || menuItem?.stockTrackingMode === 'RECIPE') return true;
    return Boolean(menuItem?.recipeId);
}

async function validateComponentStockAvailability(params: {
    items: CartItem[];
    areaId: string;
    menuMap: Map<string, any>;
}) {
    const db = await getTenantDb();
    const shortages: string[] = [];

    // Acumulador de stock requerido por inventoryItemId — necesario para
    // validar correctamente cuando varios cartItems o modificadores comparten
    // ingrediente (ej. dos Tablas con + Falafel: cada uno suma su receta).
    type StockReq = { qty: number; unit: string; sourceLabel: string };
    const required = new Map<string, StockReq>();

    function addRequirement(itemId: string, qty: number, unit: string, label: string) {
        const cur = required.get(itemId);
        if (cur) {
            cur.qty += qty;
        } else {
            required.set(itemId, { qty, unit, sourceLabel: label });
        }
    }

    // Cache de recetas dentro de la validación (un mismo modificador puede
    // aparecer en varias líneas y cada findUnique cuesta un round-trip).
    const recipeCache = new Map<string, { isActive: boolean; ingredients: { ingredientItemId: string; quantity: number; unit: string }[] } | null>();
    async function loadRecipeForValidation(recipeId: string) {
        const db = await getTenantDb();
        if (recipeCache.has(recipeId)) return recipeCache.get(recipeId)!;
        const recipe = await db.recipe.findUnique({
            where: { id: recipeId },
            include: { ingredients: { select: { ingredientItemId: true, quantity: true, unit: true } } },
        });
        const cached = recipe
            ? { isActive: recipe.isActive, ingredients: recipe.ingredients }
            : null;
        recipeCache.set(recipeId, cached);
        return cached;
    }

    for (const cartItem of params.items) {
        const menuItem = params.menuMap.get(cartItem.menuItemId);
        if (menuItem && requiresStockValidation(menuItem) && menuItem.recipe) {
            for (const ingredient of menuItem.recipe.ingredients) {
                addRequirement(
                    ingredient.ingredientItemId,
                    ingredient.quantity * cartItem.quantity,
                    ingredient.unit ?? '',
                    menuItem.name,
                );
            }
        }

        // Modificadores: receta PROPIA (ingredientes directos, §80) tiene
        // prioridad; si no tiene, cae al linkedMenuItem.recipe. Su consumo
        // también debe validarse antes de aceptar la venta.
        for (const cartMod of cartItem.modifiers ?? []) {
            if (!cartMod.modifierId) continue;
            const menuModifier = await db.menuModifier.findUnique({
                where: { id: cartMod.modifierId },
                select: {
                    ingredients: { select: { ingredientItemId: true, quantity: true, unit: true } },
                    linkedMenuItem: { select: { name: true, recipeId: true } },
                },
            });
            const sourceLabel = `${menuItem?.name ?? cartItem.name} (${cartMod.name})`;
            if (menuModifier?.ingredients?.length) {
                for (const ingredient of menuModifier.ingredients) {
                    addRequirement(
                        ingredient.ingredientItemId,
                        ingredient.quantity * cartItem.quantity,
                        ingredient.unit ?? '',
                        sourceLabel,
                    );
                }
                continue;
            }
            const linkedRecipeId = menuModifier?.linkedMenuItem?.recipeId;
            if (!linkedRecipeId) continue;
            const recipe = await loadRecipeForValidation(linkedRecipeId);
            if (!recipe?.isActive) continue;
            for (const ingredient of recipe.ingredients) {
                addRequirement(
                    ingredient.ingredientItemId,
                    ingredient.quantity * cartItem.quantity,
                    ingredient.unit ?? '',
                    sourceLabel,
                );
            }
        }
    }

    for (const [itemId, req] of Array.from(required.entries())) {
        const stock = await prisma.inventoryLocation.findUnique({
            where: {
                inventoryItemId_areaId: {
                    inventoryItemId: itemId,
                    areaId: params.areaId
                }
            },
            include: {
                inventoryItem: { select: { name: true, baseUnit: true } }
            }
        });

        const available = stock?.currentStock || 0;
        if (available < req.qty) {
            const ingredientName = stock?.inventoryItem?.name ?? itemId;
            const unit = stock?.inventoryItem?.baseUnit || req.unit;
            shortages.push(
                `${req.sourceLabel}: falta ${ingredientName} (${req.qty.toFixed(2)} ${unit} requeridos, ${available.toFixed(2)} ${unit} disponibles)`
            );
        }
    }

    if (shortages.length > 0) {
        throw new POSActionError(
            'INSUFFICIENT_COMPONENT_STOCK',
            `Stock insuficiente para preparar el consumo solicitado: ${shortages.join(' | ')}`
        );
    }
}

async function assertOpenTabVersionUpdate(params: {
    tx: any;
    openTabId: string;
    expectedVersion: number;
    data: Parameters<typeof prisma.openTab.updateMany>[0]['data'];
}) {
    const result = await params.tx.openTab.updateMany({
        where: {
            id: params.openTabId,
            version: params.expectedVersion
        },
        data: {
            ...params.data,
            version: {
                increment: 1
            }
        }
    });

    if (result.count !== 1) {
        throw new POSActionError(
            'OPEN_TAB_CONFLICT',
            'La cuenta fue modificada por otro usuario. Recarga la cuenta antes de continuar.'
        );
    }
}

/**
 * Descarga de inventario por ingredientes de receta.
 *
 * ATOMICIDAD: Todos los decrementos se ejecutan en UNA sola transacción Prisma.
 * Si cualquier operación falla, NINGÚN ingrediente queda descontado (rollback automático).
 * Esto elimina el problema de deducción parcial donde algunos ingredientes bajaban
 * y otros no al producirse un error a mitad del proceso.
 */

/**
 * Registra un fallo de descargo de inventario en la tabla outbox
 * `InventoryDeductionRetry` para que un cron/worker posterior pueda
 * reintentar el descargo automáticamente.
 *
 * **No falla nunca** desde el punto de vista del caller: si el insert al
 * outbox a su vez falla, se loggea y se ignora (best-effort), garantizando
 * que el flujo de venta del POS no se rompa por un fallo de telemetría.
 *
 * El payload guarda los items del cart (con menuItemId, quantity, etc.)
 * + areaId + userId, suficiente para que el worker re-arme la llamada a
 * `registerInventoryForCartItems`.
 *
 * Política de reintento por default: 5 intentos con backoff de 5 minutos.
 */
async function recordDeductionFailure(params: {
    items: CartItem[];
    areaId: string;
    orderId: string;
    userId: string;
    error: unknown;
}): Promise<void> {
    try {
        const errMessage = params.error instanceof Error
            ? `${params.error.name}: ${params.error.message}`
            : String(params.error ?? 'unknown error');
        await prisma.inventoryDeductionRetry.create({
            data: {
                salesOrderId: params.orderId,
                payload: JSON.stringify({
                    items: params.items,
                    areaId: params.areaId,
                    userId: params.userId,
                }),
                status: 'PENDING',
                attempts: 0,
                maxAttempts: 5,
                lastError: errMessage.slice(0, 2000), // safety limit por si hay stack largo
                nextRetryAt: new Date(Date.now() + 5 * 60_000), // primer reintento en 5 min
            },
        });
    } catch (outboxErr) {
        // Best-effort: si el outbox a su vez falla (ej. tabla no existe en
        // un entorno de desarrollo, error transitorio de red), no rompemos
        // el flujo de venta. Solo loggeamos.
        console.error('[OUTBOX] No se pudo registrar fallo de descargo:', outboxErr);
    }
}

async function registerInventoryForCartItems(params: {
    items: CartItem[];
    areaId: string;
    orderId: string;
    userId: string;
    /**
     * Tenant explícito para callers sin sesión HTTP (cron, workers). Si se
     * pasa, se usa directamente y NO se consulta resolveTenantContext.
     * Si se omite, el tenant se resuelve del contexto del request (POS).
     */
    tenantId?: string;
}): Promise<void> {
    const db = params.tenantId ? withTenant(params.tenantId) : await getTenantDb();
    // ── FASE 1: Lecturas (sin escrituras) ────────────────────────────────────
    // Recopilar todas las operaciones de descuento necesarias antes de escribir.
    type DeductOp = {
        inventoryItemId: string;
        quantity: number;
        unit: string;
        label: string; // Para el campo reason del movimiento
    };

    const ops: DeductOp[] = [];

    // Cache para no consultar la misma receta dos veces dentro de una venta.
    // `loadRecipe` reutiliza el `db` outer (closure) — antes hacía una
    // llamada extra a `getTenantDb()` que rompía el path cross-tenant
    // del cron (re-resolvía contexto y caía al fallback Shanklish).
    const recipeCache = new Map<string, { isActive: boolean; ingredients: { ingredientItemId: string; quantity: number; unit: string }[] }>();
    async function loadRecipe(recipeId: string) {
        if (recipeCache.has(recipeId)) return recipeCache.get(recipeId)!;
        const recipe = await db.recipe.findUnique({
            where: { id: recipeId },
            include: { ingredients: { select: { ingredientItemId: true, quantity: true, unit: true } } },
        });
        const cached = {
            isActive: Boolean(recipe?.isActive),
            ingredients: recipe?.ingredients ?? [],
        };
        recipeCache.set(recipeId, cached);
        return cached;
    }

    for (const cartItem of params.items) {
        const menuItem = await db.menuItem.findUnique({
            where: { id: cartItem.menuItemId },
            select: { name: true, recipeId: true },
        });
        if (menuItem?.recipeId) {
            const recipe = await loadRecipe(menuItem.recipeId);
            if (recipe.isActive) {
                for (const ing of recipe.ingredients) {
                    ops.push({
                        inventoryItemId: ing.ingredientItemId,
                        quantity: ing.quantity * cartItem.quantity,
                        unit: ing.unit,
                        label: `Venta POS: ${cartItem.quantity}x ${menuItem.name}`,
                    });
                }
            }
        }

        // Modificadores — descargo simétrico al que hace voidSalesOrderAction.
        // Prioridad (§80): receta PROPIA del modificador (ingredientes
        // directos, sin MenuItem placeholder); si no tiene, linkedMenuItem
        // (recetas). Cada entrada en cartItem.modifiers es UNA selección
        // (el modal "explota" la cantidad seleccionada → 1 entrada por
        // unidad), y se aplica a CADA línea (× cartItem.quantity).
        for (const cartMod of cartItem.modifiers ?? []) {
            if (!cartMod.modifierId) continue;
            const menuModifier = await db.menuModifier.findUnique({
                where: { id: cartMod.modifierId },
                select: {
                    ingredients: { select: { ingredientItemId: true, quantity: true, unit: true } },
                    linkedMenuItem: { select: { name: true, recipeId: true } },
                },
            });
            const label = `Venta POS: modificador ${cartMod.name} (${menuItem?.name ?? cartItem.name})`;
            if (menuModifier?.ingredients?.length) {
                for (const ing of menuModifier.ingredients) {
                    ops.push({
                        inventoryItemId: ing.ingredientItemId,
                        quantity: ing.quantity * cartItem.quantity,
                        unit: ing.unit,
                        label,
                    });
                }
                continue;
            }
            const linkedRecipeId = menuModifier?.linkedMenuItem?.recipeId;
            if (!linkedRecipeId) continue;
            const recipe = await loadRecipe(linkedRecipeId);
            if (!recipe.isActive) continue;
            for (const ing of recipe.ingredients) {
                ops.push({
                    inventoryItemId: ing.ingredientItemId,
                    quantity: ing.quantity * cartItem.quantity,
                    unit: ing.unit,
                    label,
                });
            }
        }
    }

    if (ops.length === 0) return; // Ningún ítem tiene receta activa — nada que descontar

    // ── FASE 2: Escrituras atómicas ───────────────────────────────────────────
    // UNA sola transacción para todos los ingredientes.
    // Si cualquier operación lanza, Prisma hace rollback de TODAS las anteriores.
    await db.$transaction(async (tx) => {
        for (const op of ops) {
            // Registrar movimiento de inventario (trazabilidad)
            await tx.inventoryMovement.create({
                data: {
                    inventoryItemId: op.inventoryItemId,
                    movementType: 'SALE',
                    quantity: op.quantity,
                    unit: op.unit,
                    reason: `Venta — Orden: ${params.orderId}`,
                    notes: op.label,
                    salesOrderId: params.orderId,
                    createdById: params.userId,
                },
            });

            // Decrementar stock (upsert por si el registro de ubicación no existe aún)
            await tx.inventoryLocation.upsert({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: op.inventoryItemId,
                        areaId: params.areaId,
                    },
                },
                create: {
                    inventoryItemId: op.inventoryItemId,
                    areaId: params.areaId,
                    currentStock: -op.quantity, // Negativo intencional — allowNegative
                },
                update: {
                    currentStock: { decrement: op.quantity },
                },
            });
        }
    });

    // Fire-and-forget: detectar items bajo reorden y crear BroadcastMessages.
    // No bloqueamos la venta si esto falla.
    void createReorderBroadcastsAction().catch(err =>
        console.error('[pos] reorder broadcast check failed:', err)
    );
}

// ============================================================================
// HELPERS DE REINTENTO DE OUTBOX (Fase 2.C)
// ============================================================================

/**
 * Backoff exponencial para reintentos del outbox de descargos.
 * `attempts` es el número de intentos ya realizados (>= 1 cuando entra aquí).
 *  1 → +15 min
 *  2 → +1 h
 *  3 → +4 h
 *  4 → +24 h
 *  >=5 → +24 h (cap)
 */
function computeNextRetryAt(attempts: number): Date {
    const minutes = attempts >= 4 ? 24 * 60
        : attempts === 3 ? 4 * 60
        : attempts === 2 ? 60
        : 15;
    return new Date(Date.now() + minutes * 60_000);
}

/**
 * Toma un registro del outbox `InventoryDeductionRetry` y reintenta el
 * descargo de inventario asociado. Diseñada para ser invocada desde el
 * cron `/api/cron/retry-inventory-deductions` o desde la UI de manager
 * (debug / forzar reintento manual).
 *
 * Multi-tenant: el tenant del retry se deriva de `row.salesOrder.tenantId`
 * (InventoryDeductionRetry no tiene columna tenantId directa, hereda por
 * FK al SalesOrder). El caller indica su `source`:
 *
 *  - `source: 'cron'`     → cron sin sesión HTTP. Se confía en el tenant
 *                           del retry y se ejecuta la deducción contra
 *                           ese tenant. Permite procesar el outbox
 *                           cross-tenant en un único lote.
 *  - `source: 'authenticated'` (default) → caller con sesión. Validamos
 *                           que el tenantId del contexto coincida con el
 *                           del retry — anti cross-tenant manual desde
 *                           UI. Si no coincide, se devuelve a PENDING y
 *                           SKIPPED para que el cron lo tome después.
 *
 * Flujo:
 *  1. **Claim optimista**: `updateMany` con WHERE id+status=PENDING. Si
 *     0 filas afectadas, otro worker ya tomó este registro → return.
 *  2. Cargar el retry + `salesOrder.tenantId` (source of truth).
 *  3. Si source=authenticated, validar contexto coincide con retry.
 *  4. Validación del SalesOrder asociado (si fue cancelado → CANCELLED).
 *  5. Llamada a `registerInventoryForCartItems` pasando el `tenantId`
 *     explícito (no resolveTenantContext interno).
 *  6. Update final: COMPLETED si OK, PENDING (con nextRetryAt) o FAILED
 *     según attempts vs maxAttempts.
 *
 * **Nunca lanza** — siempre retorna un objeto resultado para que el cron
 * pueda procesar el lote completo sin romperse.
 */
export async function retryInventoryDeductionFromOutbox(
    retryId: string,
    opts: { source?: 'cron' | 'authenticated' } = {},
): Promise<{
    id: string;
    status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
    error?: string;
}> {
    const source = opts.source ?? 'authenticated';

    // 1. CLAIM optimista: solo si todavía está PENDING y nextRetryAt <= NOW
    const claim = await prisma.inventoryDeductionRetry.updateMany({
        where: {
            id: retryId,
            status: 'PENDING',
            nextRetryAt: { lte: new Date() },
        },
        data: {
            status: 'IN_PROGRESS',
            lastAttemptAt: new Date(),
            attempts: { increment: 1 },
        },
    });

    if (claim.count === 0) {
        return { id: retryId, status: 'SKIPPED' };
    }

    // 2. Cargar el registro ya claimeado para conocer attempts/maxAttempts/payload
    // y derivar el tenantId vía salesOrder.tenantId (source of truth).
    const row = await prisma.inventoryDeductionRetry.findUnique({
        where: { id: retryId },
        select: {
            id: true,
            salesOrderId: true,
            payload: true,
            attempts: true,
            maxAttempts: true,
            salesOrder: { select: { tenantId: true, status: true } },
        },
    });

    if (!row) {
        // Race extremo: lo borraron entre updateMany y findUnique. Nada que hacer.
        return { id: retryId, status: 'SKIPPED' };
    }

    // 2.b Sin salesOrder no tenemos forma de derivar tenant — registros
    // huérfanos no pueden reintentarse de forma segura. Marcar FAILED.
    if (!row.salesOrder) {
        await prisma.inventoryDeductionRetry.update({
            where: { id: row.id },
            data: {
                status: 'FAILED',
                lastError: 'Retry huérfano: salesOrder no existe, no se puede derivar tenant',
            },
        });
        return { id: row.id, status: 'FAILED', error: 'orphan retry' };
    }

    const retryTenantId = row.salesOrder.tenantId;

    // 2.c Anti cross-tenant manual: si el caller tiene sesión y su tenant
    // del contexto NO coincide con el del retry, devolvemos a PENDING para
    // que el cron lo procese y respondemos SKIPPED. Esto previene que un
    // user de tenant A triggeree retries de tenant B vía UI/debug.
    if (source === 'authenticated') {
        const ctxTenantId = (await resolveTenantContext()).tenantId;
        if (ctxTenantId !== retryTenantId) {
            await prisma.inventoryDeductionRetry.update({
                where: { id: row.id },
                data: { status: 'PENDING' },
            });
            return { id: row.id, status: 'SKIPPED' };
        }
    }

    // 3. Validación: si el SalesOrder fue cancelado, no descargar. La
    // existencia ya está garantizada por el guard 2.b arriba (sin
    // salesOrder no hay tenant, return FAILED).
    if (row.salesOrder.status === 'CANCELLED') {
        await prisma.inventoryDeductionRetry.update({
            where: { id: row.id },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                notes: 'SalesOrder cancelado antes del reintento',
            },
        });
        return { id: row.id, status: 'CANCELLED' };
    }

    // 4. Parse del payload + ejecutar deducción
    let parsed: { items: CartItem[]; areaId: string; userId: string };
    try {
        parsed = JSON.parse(row.payload);
        if (!parsed.items || !Array.isArray(parsed.items) || !parsed.areaId || !parsed.userId) {
            throw new Error('Payload incompleto');
        }
    } catch (parseErr) {
        // Payload corrupto → marcar FAILED inmediatamente, no tiene sentido reintentar
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        await prisma.inventoryDeductionRetry.update({
            where: { id: row.id },
            data: {
                status: 'FAILED',
                lastError: `Payload inválido: ${msg}`.slice(0, 2000),
            },
        });
        return { id: row.id, status: 'FAILED', error: msg };
    }

    try {
        await registerInventoryForCartItems({
            items: parsed.items,
            areaId: parsed.areaId,
            orderId: row.salesOrderId ?? '',
            userId: parsed.userId,
            tenantId: retryTenantId,
        });

        await prisma.inventoryDeductionRetry.update({
            where: { id: row.id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                lastError: null,
            },
        });
        return { id: row.id, status: 'COMPLETED' };
    } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        const attemptsDone = row.attempts; // ya fue incrementado por el claim
        const exhausted = attemptsDone >= row.maxAttempts;

        await prisma.inventoryDeductionRetry.update({
            where: { id: row.id },
            data: {
                status: exhausted ? 'FAILED' : 'PENDING',
                lastError: msg.slice(0, 2000),
                nextRetryAt: exhausted ? new Date() : computeNextRetryAt(attemptsDone),
            },
        });

        return { id: row.id, status: exhausted ? 'FAILED' : 'PENDING', error: msg };
    }
}

// ============================================================================
// LECTURA DE MENÚ PARA POS
// ============================================================================

export async function getMenuForPOSAction(opts?: { applyPromotions?: boolean; channel?: PriceListChannel }) {
    const { db, tenantId } = await getTenantCtx();
    try {
        const categories = await db.menuCategory.findMany({
            where: { deletedAt: null, isActive: true },
            include: {
                items: {
                    where: { isActive: true, deletedAt: null },
                    orderBy: { name: 'asc' },
                    include: {
                        modifierGroups: {
                            where: {
                                modifierGroup: { isActive: true }
                            },
                            include: {
                                modifierGroup: {
                                    include: {
                                        modifiers: {
                                            where: { isAvailable: true, deletedAt: null },
                                            orderBy: { sortOrder: 'asc' },
                                            include: {
                                                // Sub-grupo anidado (§82): un nivel.
                                                // isActive se filtra en la UI
                                                // (include to-one no acepta where).
                                                childGroup: {
                                                    include: {
                                                        modifiers: {
                                                            where: { isAvailable: true, deletedAt: null },
                                                            orderBy: { sortOrder: 'asc' }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });

        // Listas de precios por canal (§86): antes de promociones. La lista
        // activa del canal define el precio base del item para ESTE canal; el
        // POS lo consume por el mismo campo que hoy (price, o winkPrice/
        // pedidosYaPrice según el canal). Gated por flag priceListsEnabled.
        if (opts?.channel) {
            const priceMap = await loadChannelPriceMap(db, tenantId, opts.channel);
            if (priceMap.size > 0) {
                for (const cat of categories) {
                    for (const item of cat.items as any[]) {
                        const override = priceMap.get(item.id);
                        if (override == null) continue;
                        item.listPriceBase = item.price; // precio base original
                        item.priceListApplied = true;
                        if (opts.channel === 'WINK') item.winkPrice = override;
                        else if (opts.channel === 'PEDIDOSYA') item.pedidosYaPrice = override;
                        else item.price = override;
                    }
                }
            }
        }

        // Promociones (happy hour): aplican al precio mostrado/cobrado en el
        // POS. Opt-out para PedidosYA (usa su propio pricing). Gated por flag.
        const applyPromos = opts?.applyPromotions !== false;
        if (applyPromos) {
            const rules = await loadActivePromotionRules(db, tenantId);
            if (rules.length > 0) {
                const now = new Date();
                for (const cat of categories) {
                    for (const item of cat.items as any[]) {
                        const priced = priceItemWithPromotions(item.price, item.id, cat.id, rules, now);
                        if (priced.appliedPromotionId) {
                            item.listPrice = item.price;          // precio original (para mostrar tachado)
                            item.price = priced.unitPrice;        // precio con descuento (lo usa el carrito)
                            item.appliedPromotion = {
                                id: priced.appliedPromotionId,
                                name: priced.appliedPromotionName,
                                discountPerUnit: priced.discountPerUnit,
                            };
                        }
                    }
                }
            }
        }

        return { success: true, data: categories };
    } catch (error) {
        console.error('Error fetching menu for POS:', error);
        return { success: false, message: 'Error cargando menú' };
    }
}

// ============================================================================
// HELPERS DE HASHING DE PIN  (implementación en user.actions.ts)
// pbkdf2Hex y hashPin se importan desde user.actions.ts
// ============================================================================

async function verifyPin(pin: string, stored: string): Promise<boolean> {
    try {
        if (stored.includes(':')) {
            // Formato hasheado: "saltHex:hashHex"
            const colonIdx = stored.indexOf(':');
            const saltHex = stored.slice(0, colonIdx);
            const storedHash = stored.slice(colonIdx + 1);
            if (!saltHex || !storedHash) return false;
            const derived = await pbkdf2Hex(pin, saltHex);
            return derived === storedHash;
        }
        // Legado: PIN en texto plano (período de transición)
        return pin === stored;
    } catch {
        return false;
    }
}

// ============================================================================
// VALIDACIÓN DE PIN DE GERENTE
// ============================================================================

export async function validateManagerPinAction(pinRaw: string): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        // trim defensivo — alinea con resolveVoidAuthPin/updateUserPin (que ya
        // trimean). Un espacio/nueva-línea pegado rompía el match del hash.
        const pin = (pinRaw ?? '').trim();
        if (!pin || pin.length < 4) {
            return { success: false, message: 'PIN debe tener al menos 4 dígitos' };
        }

        // Rate limit: 15 intentos por IP cada 5 min. Cubre brute-force del
        // PIN de manager sin bloquear errores legítimos al teclear.
        try {
            const ip = await getClientIp();
            const rl = await consumeRateLimit({
                key: `pin-manager:${ip}`,
                max: 15,
                windowSeconds: 300,
            });
            if (!rl.allowed) {
                return {
                    success: false,
                    message: `Demasiados intentos. Intenta en ${rl.retryAfterSeconds}s.`,
                };
            }
        } catch (err) {
            console.error('[rate-limit] manager pin failed:', err);
        }

        const candidates = await db.user.findMany({
            where: {
                role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] },
                isActive: true,
                pin: { not: null },
            },
            select: { id: true, firstName: true, lastName: true, role: true, pin: true },
        });

        for (const candidate of candidates) {
            if (candidate.pin && await verifyPin(pin, candidate.pin)) {
                return {
                    success: true,
                    message: 'Autorización exitosa',
                    data: {
                        managerId: candidate.id,
                        managerName: `${candidate.firstName} ${candidate.lastName}`,
                        role: candidate.role,
                    },
                };
            }
        }

        return { success: false, message: 'PIN inválido o permisos insuficientes' };

    } catch (error) {
        console.error('Error validando PIN:', error);
        return { success: false, message: 'Error interno de validación' };
    }
}

// ============================================================================
// VALIDACIÓN DE PIN DE CAJERA
// Exclusivamente para trazabilidad de sesión de caja (updateSessionCashier).
// NO autoriza anulaciones, cortesías ni descuentos — esos flujos usan
// validateManagerPinAction (roles OWNER / ADMIN_MANAGER / OPS_MANAGER).
// ============================================================================

export async function validateCashierPinAction(pin: string): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        if (!pin || pin.length < 4) {
            return { success: false, message: 'PIN debe tener al menos 4 dígitos' };
        }

        // Rate limit: 15 intentos por IP cada 5 min.
        try {
            const ip = await getClientIp();
            const rl = await consumeRateLimit({
                key: `pin-cashier:${ip}`,
                max: 15,
                windowSeconds: 300,
            });
            if (!rl.allowed) {
                return {
                    success: false,
                    message: `Demasiados intentos. Intenta en ${rl.retryAfterSeconds}s.`,
                };
            }
        } catch (err) {
            console.error('[rate-limit] cashier pin failed:', err);
        }

        const candidates = await db.user.findMany({
            where: {
                role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] },
                isActive: true,
                pin: { not: null },
            },
            select: { id: true, firstName: true, lastName: true, role: true, pin: true },
        });

        for (const candidate of candidates) {
            if (candidate.pin && await verifyPin(pin, candidate.pin)) {
                await updateSessionCashier(candidate.id);
                return {
                    success: true,
                    message: 'Autorización exitosa',
                    data: {
                        managerId: candidate.id,
                        managerName: `${candidate.firstName} ${candidate.lastName}`,
                        role: candidate.role,
                    },
                };
            }
        }

        return { success: false, message: 'PIN inválido o sin permisos para esta operación' };

    } catch (error) {
        console.error('Error validando PIN cajera:', error);
        return { success: false, message: 'Error interno de validación' };
    }
}

// ============================================================================
// GENERAR CORRELATIVO ÚNICO
// ============================================================================

async function generateOrderNumber(orderType: POSOrderType, opts?: { notes?: string }): Promise<string> {
    // Pickup desde caja (Venta Directa Pickup) llega como orderType='RESTAURANT'
    // porque se mete en flujo de salón, pero conceptualmente es pickup → debe
    // usar el correlativo PICKUP (prefijo REST) en lugar del RESTAURANT (TAB).
    // Distinguimos por la `notes` que el POS Restaurante setea explícitamente.
    const isPickupFromCaja =
        orderType === 'RESTAURANT' && (opts?.notes ?? '').startsWith('Venta Directa Pickup');

    const channel = isPickupFromCaja ? 'PICKUP'
        : orderType === 'RESTAURANT' ? 'RESTAURANT'
        : orderType === 'PICKUP' ? 'PICKUP'
        : 'DELIVERY';
    return getNextCorrelativo(channel);
}

function isOrderNumberUniqueError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('Unique constraint failed') && msg.includes('orderNumber');
}

// NOTA: el upsert de cliente por teléfono vivía acá (`upsertCustomerFromOrder`).
// Se eliminó en la auditoría 2026-06-05: coexistía con el nuevo camino CRM
// (`resolveCustomerForOrder` + `bumpCustomerStats` en src/lib/customers/link.ts)
// y ambos incrementaban las stats → doble-conteo. Ahora hay UN solo camino,
// invocado tras crear la orden. Ver §6.0.1 de OPUS_CONTEXT.

// ============================================================================
// ACTION: CREAR ORDEN DE VENTA
// ============================================================================

export async function createSalesOrderAction(
    data: CreateOrderData
): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const salesArea = await ensureBaseSalesArea();
        const areaId = salesArea.id;

        // Promociones: re-aplicación autoritativa desde el precio base de BD
        // (o de la lista de precios del canal §86, si aplica). PedidosYA usa su
        // propia action. Muta data.items y devuelve auditoría por índice.
        const promoAudit = await applyPromotionsToCart(
            db, tenantId, data.items as any, new Date(),
            data.orderType === 'DELIVERY' ? 'DELIVERY' : 'RESTAURANT',
        );

        // Flag: venta exacta + redondeo de efectivo divisas a propina.
        const exactCashTip = await tenantFeatureEnabled(tenantId, 'exactCashSaleTip').catch(() => false);
        // Descuento divisas configurable (§87), leído del server (autoritativo).
        const divisasRate = await loadDivisasDiscountRate(db);
        const { subtotal, discount, total, change, discountReason } = calculateCartTotals(data, exactCashTip, divisasRate);
        // Con el flag, en efectivo divisas el excedente (redondeo hacia arriba)
        // es PROPINA, no vuelto: forzamos change=0 salvo que la cajera pida
        // dar vuelto explícito (keepChangeAsTip=false + tipAtCheckout marcado).
        const routeDeltaToTip = exactCashTip && isCashDivisaMethod(data.paymentMethod)
            && !data.payments?.length && data.keepChangeAsTip !== false;

        let finalNotes = data.notes || '';
        if (discountReason) {
            finalNotes = finalNotes ? `${finalNotes} | ${discountReason}` : discountReason;
        }

        // ── Contexto de reportería (DIAGNOSTICO_REPORTES A0.1/A0.3) ─────────
        // · costMap: snapshot de costo por MenuItem (COGS — antes quedaba en 0)
        // · branchId: las ventas directas quedaban con branch NULL (BUG #5)
        // · tasa BCV del momento: exchangeRateValue/totalBs nunca se poblaban
        // · caja abierta: vincula la venta al turno (Reporte X — FASE B)
        // Todo best-effort: si algo falla, la venta sale igual (campos null).
        const [costMap, currentRate, activeBranch, openRegister] = await Promise.all([
            buildMenuItemCostMap(db, data.items.map(i => i.menuItemId)),
            getExchangeRateValue().catch(() => null),
            db.branch.findFirst({ where: { isActive: true }, select: { id: true } }).catch(() => null),
            db.cashRegister.findFirst({
                where: { status: 'OPEN' },
                orderBy: { openedAt: 'desc' },
                select: { id: true },
            }).catch(() => null),
        ]);
        const orderBranchId = salesArea.branchId ?? activeBranch?.id ?? null;

        // Número de orden del día (§84). Pickup queda afuera: mantiene su PK
        // propio (marcador en notes). Se calcula UNA vez, fuera del retry loop,
        // para no consumir números en reintentos por colisión de orderNumber.
        const isPickupDirect = data.orderType === 'RESTAURANT'
            && (finalNotes ?? '').startsWith('Venta Directa Pickup');
        const dailyOrder = isPickupDirect
            ? null
            : await nextDailyNumber(db, tenantId, data.orderType === 'DELIVERY' ? 'DELIVERY' : 'RESTAURANT');

        let newOrder;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, Math.random() * 80 + 20));
                }
                const orderNumber = await generateOrderNumber(data.orderType, { notes: finalNotes });
                newOrder = await db.salesOrder.create({
                    data: {
                        tenantId,
                        orderNumber,
                        orderType: data.orderType,
                        customerName: data.customerName,
                        customerPhone: data.customerPhone,
                        customerAddress: data.customerAddress,
                        status: 'CONFIRMED',
                        serviceFlow: 'DIRECT_SALE',
                        sourceChannel: data.orderType === 'DELIVERY' ? 'POS_DELIVERY' : 'POS_RESTAURANT',
                        paymentStatus: 'PAID',
                        paymentMethod: data.payments && data.payments.length > 0
                            ? (data.payments.length === 1 ? data.payments[0].method : 'MULTIPLE')
                            : (data.paymentMethod || 'CASH'),
                        kitchenStatus: 'SENT',
                        sentToKitchenAt: new Date(),
                        scheduledDeliveryTime: data.scheduledDeliveryTime ? new Date(data.scheduledDeliveryTime) : undefined,

                        subtotal,
                        discount,
                        total,
                        amountPaid: data.payments && data.payments.length > 0
                            ? data.payments.reduce((s, p) => s + p.amountUSD, 0)
                            : (data.amountPaid || total),
                        change: routeDeltaToTip ? 0
                            : data.keepChangeAsTip ? 0
                            : (data.tipAtCheckout && data.tipAtCheckout > 0)
                                ? Math.max(0, change - data.tipAtCheckout)
                                : (change > 0 ? change : 0),

                        discountType: data.discountType,
                        discountReason: discountReason,
                        authorizedById: data.authorizedById && data.authorizedById !== 'demo-master-id' ? data.authorizedById : undefined,

                        notes: finalNotes,
                        dailyNumber: dailyOrder?.dailyNumber ?? null,
                        dailyLabel: dailyOrder?.dailyLabel ?? null,

                        createdById: session.activeCashierId ?? session.id,
                        areaId: areaId,
                        branchId: orderBranchId,
                        cashRegisterId: openRegister?.id ?? null,
                        // Snapshot dual-currency de la orden (tasa del momento)
                        exchangeRateValue: currentRate ?? null,
                        totalBs: currentRate ? round2(total * currentRate) : null,

                        items: {
                            create: data.items.map((item, idx) => ({
                                tenantId,
                                menuItemId: item.menuItemId,
                                itemName: item.name,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                lineTotal: item.lineTotal,
                                notes: item.notes,
                                // Snapshot de costo/margen (COGS — A0.1)
                                ...costSnapshotFields(item.unitPrice, item.quantity, costMap.get(item.menuItemId) ?? 0),
                                appliedPromotionId: promoAudit[idx]?.appliedPromotionId ?? null,
                                appliedPromotionName: promoAudit[idx]?.appliedPromotionName ?? null,
                                originalUnitPrice: promoAudit[idx]?.originalUnitPrice ?? null,
                                promotionDiscount: promoAudit[idx]?.promotionDiscount ?? null,
                                modifiers: {
                                    create: item.modifiers?.map(m => ({
                                        name: m.name,
                                        priceAdjustment: m.priceAdjustment,
                                        modifierId: m.modifierId
                                    }))
                                }
                            }))
                        }
                    },
                    include: { items: { include: { modifiers: true } } }
                });
                break;
            } catch (err) {
                if (isOrderNumberUniqueError(err) && attempt < 9) continue;
                throw err;
            }
        }

        if (!newOrder) throw new Error('No se pudo crear la orden tras reintentos');

        // ====================================================================
        // REGISTRAR LÍNEAS DE PAGO MIXTO
        // ====================================================================
        // NOTA: SalesOrderPayment NO tiene columna `tenantId` en el schema.
        // La aislación tenant se hereda de la FK `salesOrderId` → SalesOrder
        // (que sí tiene tenantId). PR #181 añadió `tenantId` por error aquí
        // creyendo que el modelo lo tenía; eso causaba el error en producción:
        //   "Unknown argument `tenantId`. Available options are marked with ?"
        // bloqueando todos los cobros con pagos registrados.
        if (data.payments && data.payments.length > 0) {
            await prisma.salesOrderPayment.createMany({
                data: data.payments.map(p => ({
                    salesOrderId: newOrder!.id,
                    method: p.method,
                    amountUSD: p.amountUSD,
                    amountBS: p.amountBS,
                    exchangeRate: p.exchangeRate ?? currentRate ?? undefined,
                    reference: p.reference,
                })),
            });
        } else if (total > 0) {
            // A0.3 (BUG #3 parcial): pago único sin desglose del cliente
            // (ej. delivery con PDV/MOVIL sin monto tipeado) antes NO creaba
            // línea de pago → ni Bs ni tasa persistidos. Sintetizamos UNA
            // línea con el total cobrado y la tasa del momento para que
            // "ventas por método" cuadre y la tasa histórica quede grabada.
            try {
                const method = data.paymentMethod || 'CASH';
                const isBsMethod = BS_PAYMENT_METHODS.has(method);
                await prisma.salesOrderPayment.create({
                    data: {
                        salesOrderId: newOrder.id,
                        method,
                        amountUSD: total,
                        amountBS: isBsMethod && currentRate ? round2(total * currentRate) : null,
                        exchangeRate: currentRate ?? null,
                    },
                });
            } catch (payErr) {
                console.error('[PAYMENTS] No se pudo sintetizar línea de pago:', payErr);
            }
        }

        // ====================================================================
        // GESTIÓN DE INVENTARIO (Descargo de Recetas — atómico)
        // ====================================================================
        try {
            await registerInventoryForCartItems({
                items: data.items,
                areaId,
                orderId: newOrder.id,
                userId: session.id
            });
        } catch (invError) {
            // La venta ocurrió — no revertimos la orden.
            // Pero marcamos la orden con un flag visible para auditoría
            // para que el gerente pueda aplicar el descuento manualmente.
            console.error('[INVENTORY] Descargo falló para orden', newOrder.id, invError);

            // 1. Outbox estructurado para reintento automático posterior (Fase 2.A)
            await recordDeductionFailure({
                items: data.items,
                areaId,
                orderId: newOrder.id,
                userId: session.id,
                error: invError,
            });

            // 2. Flag visible en notas (compat histórica para reportes existentes)
            try {
                await db.salesOrder.update({
                    where: { id: newOrder.id },
                    data: {
                        notes: `[DESCARGO INVENTARIO PENDIENTE — Revisar manualmente]${newOrder.notes ? ' | ' + newOrder.notes : ''}`,
                    },
                });
            } catch { /* best effort */ }
        }

        // CRM: vincular la venta a la ficha de cliente + actualizar stats.
        // Se hace DESPUÉS de que la orden existe (evita clientes huérfanos si
        // la creación fallaba) y por UN SOLO camino (resolveCustomerForOrder),
        // para no doble-contar las stats. Vincula por id explícito (buscador
        // del POS) o, en delivery/pickup, upsert por teléfono. No bloquea.
        try {
            const linkedCustomerId = await resolveCustomerForOrder(db, tenantId, {
                explicitCustomerId: data.customerId,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                customerAddress: data.customerAddress,
                orderType: data.orderType,
                createdById: session.activeCashierId ?? session.id,
            });
            if (linkedCustomerId) {
                await db.salesOrder.updateMany({
                    where: { id: newOrder.id, tenantId },
                    data: { customerId: linkedCustomerId },
                });
                await bumpCustomerStats(db, tenantId, linkedCustomerId, newOrder.total, newOrder.createdAt);
            }
        } catch (custErr) {
            console.error('[CRM] vínculo de cliente no crítico:', custErr);
        }

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');
        revalidatePath('/dashboard/clientes');
        revalidatePath('/dashboard/sales');
        revalidatePath('/dashboard/inventory');

        return { success: true, message: 'Orden creada exitosamente', data: newOrder };

    } catch (error) {
        console.error('Error creando orden:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: errMsg.includes('area') || errMsg.includes('Area')
                ? `Error de áreas: ${errMsg}. Verifique que existan áreas activas (BARRA, OFICINA, etc.) en Administración → Almacenes.`
                : `Error al crear la orden: ${errMsg}`
        };
    }
}

// ============================================================================
// ACTION: REGISTRAR PROPINA COLECTIVA
// ============================================================================

/**
 * Lista las mesas CERRADAS de hoy (Caracas) para el selector de propina
 * colectiva — la propina posterior se vincula a una de estas mesas para
 * trazabilidad (de qué mesa fue + correlativo). Tenant-scoped.
 */
export async function getClosedTabsTodayAction(): Promise<ActionResult> {
    const { db } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { start, end } = getCaracasDayRange(new Date());
        const tabs = await db.openTab.findMany({
            where: { status: 'CLOSED', closedAt: { gte: start, lte: end } },
            select: {
                id: true,
                tabCode: true,
                customerLabel: true,
                runningTotal: true,
                totalServiceCharge: true,
                closedAt: true,
                tableOrStation: { select: { name: true } },
            },
            orderBy: { closedAt: 'desc' },
            take: 80,
        });

        return {
            success: true,
            message: 'ok',
            data: tabs.map(t => ({
                id: t.id,
                tabCode: t.tabCode,
                label: t.customerLabel || t.tableOrStation?.name || t.tabCode,
                tableName: t.tableOrStation?.name ?? null,
                total: (t.runningTotal ?? 0) + (t.totalServiceCharge ?? 0),
                closedAt: t.closedAt,
            })),
        };
    } catch (error) {
        console.error('[getClosedTabsTodayAction]', error);
        return { success: false, message: 'Error cargando mesas cerradas' };
    }
}

/**
 * Records a collective (post-payment) tip as a zero-total sales order.
 * total=0, amountPaid=tipAmount → Z report picks it up as tip correctly.
 *
 * `relatedTabCode` vincula la propina a la mesa cerrada de la que provino
 * (trazabilidad). Se persiste dentro de `notes` con un marcador estable
 * `[tab:<code>]` que el historial parsea para mostrar el correlativo (sin
 * necesidad de columna nueva).
 */
export async function recordCollectiveTipAction(data: {
    tipAmount: number;
    paymentMethod: string;
    note?: string;
    relatedTabCode?: string;
}): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const salesArea = await ensureBaseSalesArea();

        // Nota con marcador estable [tab:<code>] para que el historial muestre
        // el correlativo vinculado sin parsear texto libre.
        const finalNote = embedTabCode(data.note?.trim() || 'Propina colectiva', data.relatedTabCode);

        let order;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                if (attempt > 0) await new Promise(r => setTimeout(r, Math.random() * 80 + 20));
                // Correlativo propio PROP-#### (canal COLLECTIVE_TIP): la propina
                // colectiva ya NO toma el código de pickup, para poder conciliar
                // el arqueo sin confundirla con ventas. orderType sigue siendo
                // 'PICKUP' por compatibilidad con el historial (el filtro
                // Mesa/Pickup y los reportes la identifican por customerName).
                const orderNumber = await getNextCorrelativo('COLLECTIVE_TIP');
                order = await db.salesOrder.create({
                    data: {
                        tenantId,
                        orderNumber,
                        orderType: 'PICKUP',
                        customerName: 'PROPINA COLECTIVA',
                        status: 'CONFIRMED',
                        serviceFlow: 'DIRECT_SALE',
                        sourceChannel: 'POS_RESTAURANT',
                        paymentStatus: 'PAID',
                        paymentMethod: data.paymentMethod,
                        kitchenStatus: 'SENT',
                        sentToKitchenAt: new Date(),
                        subtotal: 0,
                        discount: 0,
                        total: 0,
                        amountPaid: data.tipAmount,
                        change: 0,
                        notes: finalNote,
                        createdById: session.activeCashierId ?? session.id,
                        areaId: salesArea.id,
                    },
                });
                break;
            } catch (err) {
                if (isOrderNumberUniqueError(err) && attempt < 9) continue;
                throw err;
            }
        }

        if (!order) throw new Error('No se pudo registrar la propina');

        revalidatePath('/dashboard/sales');
        return { success: true, message: 'Propina registrada', data: order };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

// ============================================================================
// POS RESTAURANTE - CUENTAS ABIERTAS
// ============================================================================

export async function getRestaurantLayoutAction(): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const branch = await ensureRestaurantSetup();

        return {
            success: true,
            message: 'Layout restaurante cargado',
            data: branch
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error loading restaurant layout:', error);
        return { success: false, message: `Error cargando layout restaurante: ${errorMessage}` };
    }
}

export async function openTabAction(data: OpenTabInput): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const table = await db.tableOrStation.findUnique({
            where: { id: data.tableOrStationId },
            include: {
                openTabs: {
                    where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
                    orderBy: { openedAt: 'desc' },
                    include: {
                        paymentSplits: true,
                        orders: {
                            include: { items: true },
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!table) {
            return { success: false, message: 'Mesa o estación no encontrada' };
        }

        if (table.openTabs.length > 0) {
            return {
                success: true,
                message: 'La mesa ya tiene una cuenta abierta',
                data: table.openTabs[0]
            };
        }

        const tabCode = await generateTabCode();

        const tab = await db.$transaction(async (tx) => {
            // Número de orden del día de la mesa (§84): se asigna al abrir la
            // cuenta y todas las comandas de la mesa lo heredan (MS-14).
            const daily = await nextDailyNumber(tx, tenantId, 'RESTAURANT');
            const createdTab = await tx.openTab.create({
                data: {
                    tenantId,
                    branchId: table.branchId,
                    serviceZoneId: table.serviceZoneId,
                    tableOrStationId: table.id,
                    tabCode,
                    customerLabel: data.customerLabel || table.name,
                    customerPhone: data.customerPhone,
                    guestCount: data.guestCount || 1,
                    notes: data.notes,
                    openedById: session.id,
                    waiterLabel: data.waiterLabel || null, // Guardar label del mesonero (ej: "Mesonero 1")
                    waiterProfileId: data.waiterProfileId || null,
                    dailyNumber: daily.dailyNumber,
                    dailyLabel: daily.dailyLabel,
                },
                include: {
                    openedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                    paymentSplits: true,
                    orders: {
                        include: { items: true },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            await tx.tableOrStation.update({
                where: { id: table.id },
                data: { currentStatus: 'OCCUPIED' }
            });

            return createdTab;
        });

        revalidatePath('/dashboard/pos/restaurante');

        return {
            success: true,
            message: 'Cuenta abierta correctamente',
            data: tab
        };
    } catch (error) {
        console.error('Error opening tab:', error);
        return { success: false, message: 'Error al abrir la cuenta' };
    }
}

export async function addItemsToOpenTabAction(data: AddItemsToOpenTabInput): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        if (!data.items.length) {
            return { success: false, message: 'No hay items para agregar' };
        }

        const openTab = await db.openTab.findUnique({
            where: { id: data.openTabId },
            include: {
                tableOrStation: true,
                serviceZone: true
            }
        });

        if (!openTab || !['OPEN', 'PARTIALLY_PAID'].includes(openTab.status)) {
            return { success: false, message: 'La cuenta no está disponible para consumir' };
        }

        // Validar subcuenta destino si se solicitó: debe pertenecer a la cuenta
        // y estar OPEN. Si está PAID/VOID no se puede agregar más consumo ahí.
        if (data.targetSubAccountId) {
            const targetSub = await prisma.tabSubAccount.findUnique({
                where: { id: data.targetSubAccountId },
                select: { id: true, openTabId: true, status: true },
            });
            if (!targetSub || targetSub.openTabId !== openTab.id) {
                return { success: false, message: 'Subcuenta destino no pertenece a esta cuenta' };
            }
            if (targetSub.status !== 'OPEN') {
                return { success: false, message: 'La subcuenta destino no está abierta' };
            }
        }

        const salesArea = await resolveSalesAreaForBranch(openTab.branchId);

        // Promociones: re-aplicación autoritativa desde el precio base de BD
        // (o lista de precios del canal RESTAURANT §86). Muta data.items.
        const promoAudit = await applyPromotionsToCart(db, tenantId, data.items as any, new Date(), 'RESTAURANT');

        const { subtotal, total } = calculateCartTotals({
            orderType: 'RESTAURANT',
            items: data.items,
            amountPaid: 0,
            discountType: undefined
        });

        const menuItemIds = Array.from(new Set(data.items.map(item => item.menuItemId)));
        const menuItems = await getMenuItemMetadata(menuItemIds);
        const menuMap = new Map(menuItems.map(item => [item.id, item]));

        // Snapshot de costo por MenuItem (COGS — DIAGNOSTICO A0.1, BUG #1)
        const costMap = await buildMenuItemCostMap(db, menuItemIds);

        // Stock validation — controlled via SystemConfig 'pos_stock_validation_enabled'
        const stockValidation = await getStockValidationEnabled();
        if (stockValidation) {
            await validateComponentStockAvailability({
                items: data.items,
                areaId: salesArea.id,
                menuMap,
            });
        }

        const shouldSendToKitchen = data.items.some(item => {
            const menuItem = menuMap.get(item.menuItemId);
            if (!menuItem) return false;
            return requiresKitchenRouting(menuItem);
        });

        let createdOrder;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, Math.random() * 80 + 20));
                }
                const orderNumber = await generateOrderNumber('RESTAURANT');
                createdOrder = await db.$transaction(async (tx) => {
            await assertOpenTabVersionUpdate({
                tx,
                openTabId: openTab.id,
                expectedVersion: openTab.version,
                data: {
                    runningSubtotal: { increment: subtotal },
                    runningTotal: { increment: total },
                    balanceDue: { increment: total },
                    status: 'OPEN'
                }
            });

            const order = await tx.salesOrder.create({
                data: {
                    tenantId,
                    orderNumber,
                    orderType: 'RESTAURANT',
                    serviceFlow: 'OPEN_TAB',
                    sourceChannel: 'POS_SPORTBAR',
                    customerName: openTab.customerLabel || openTab.tableOrStation?.name || 'Cuenta abierta',
                    status: shouldSendToKitchen ? 'CONFIRMED' : 'READY',
                    kitchenStatus: shouldSendToKitchen ? 'SENT' : 'NOT_REQUIRED',
                    sentToKitchenAt: shouldSendToKitchen ? new Date() : null,
                    paymentStatus: 'PENDING',
                    subtotal,
                    total,
                    amountPaid: 0,
                    areaId: salesArea.id,
                    branchId: openTab.branchId,
                    serviceZoneId: openTab.serviceZoneId,
                    tableOrStationId: openTab.tableOrStationId,
                    openTabId: openTab.id,
                    waiterProfileId: data.waiterProfileId || openTab.waiterProfileId || null,
                    notes: data.notes,
                    // §84: la comanda hereda el número del día de la mesa
                    dailyNumber: openTab.dailyNumber,
                    dailyLabel: openTab.dailyLabel,
                    createdById: session.activeCashierId ?? session.id,
                    items: {
                        create: data.items.map((item, idx) => ({
                            tenantId,
                            menuItemId: item.menuItemId,
                            itemName: item.name,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            lineTotal: item.lineTotal,
                            notes: item.notes,
                            // Snapshot de costo/margen (COGS — A0.1)
                            ...costSnapshotFields(item.unitPrice, item.quantity, costMap.get(item.menuItemId) ?? 0),
                            appliedPromotionId: promoAudit[idx]?.appliedPromotionId ?? null,
                            appliedPromotionName: promoAudit[idx]?.appliedPromotionName ?? null,
                            originalUnitPrice: promoAudit[idx]?.originalUnitPrice ?? null,
                            promotionDiscount: promoAudit[idx]?.promotionDiscount ?? null,
                            modifiers: {
                                create: item.modifiers?.map(modifier => ({
                                    modifierId: modifier.modifierId,
                                    name: modifier.name,
                                    priceAdjustment: modifier.priceAdjustment
                                }))
                            }
                        }))
                    }
                },
                include: {
                    items: {
                        include: {
                            modifiers: true
                        }
                    }
                }
            });

            await tx.openTabOrder.create({
                data: {
                    openTabId: openTab.id,
                    salesOrderId: order.id
                }
            });

            // Asignación directa a subcuenta — si el mesero tecleó productos
            // mientras tenía una subcuenta seleccionada, los SalesOrderItem
            // recién creados se vinculan a esa subcuenta vía SubAccountItem
            // con la cantidad completa, y se recalculan los totales.
            if (data.targetSubAccountId) {
                for (const sItem of order.items) {
                    await tx.subAccountItem.create({
                        data: {
                            subAccountId: data.targetSubAccountId,
                            salesOrderItemId: sItem.id,
                            quantity: sItem.quantity,
                            lineTotal: sItem.lineTotal,
                        },
                    });
                }
                await recalcSubAccountTotals(tx, data.targetSubAccountId);
            }

            return order;
                });
                break;
            } catch (err) {
                if (isOrderNumberUniqueError(err) && attempt < 9) continue;
                throw err;
            }
        }

        if (!createdOrder) throw new Error('No se pudo agregar el consumo tras reintentos');

        try {
            await registerInventoryForCartItems({
                items: data.items,
                areaId: salesArea.id,
                orderId: createdOrder.id,
                userId: session.id
            });
        } catch (invError) {
            console.error('[INVENTORY] Descargo falló para tab order', createdOrder.id, invError);

            // 1. Outbox estructurado para reintento automático posterior (Fase 2.A)
            await recordDeductionFailure({
                items: data.items,
                areaId: salesArea.id,
                orderId: createdOrder.id,
                userId: session.id,
                error: invError,
            });

            // 2. Flag visible en notas (compat histórica)
            try {
                await db.salesOrder.update({
                    where: { id: createdOrder.id },
                    data: {
                        notes: `[DESCARGO INVENTARIO PENDIENTE — Revisar manualmente]${createdOrder.notes ? ' | ' + createdOrder.notes : ''}`,
                    },
                });
            } catch { /* best effort */ }
        }

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        revalidatePath('/dashboard/sales');
        revalidatePath('/dashboard/inventory');
        revalidatePath('/kitchen');

        return {
            success: true,
            message: 'Consumo agregado a la cuenta',
            data: createdOrder
        };
    } catch (error) {
        console.error('Error adding items to open tab:', error);
        if (error instanceof POSActionError) {
            return { success: false, message: error.message };
        }
        return { success: false, message: 'Error agregando consumo a la cuenta' };
    }
}

export async function registerOpenTabPaymentAction(data: RegisterOpenTabPaymentInput): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        if (data.amount <= 0) {
            return { success: false, message: 'El monto debe ser mayor a cero' };
        }

        const openTab = await db.openTab.findUnique({
            where: { id: data.openTabId },
            include: {
                orders: true,
                paymentSplits: true
            }
        });

        if (!openTab || !['OPEN', 'PARTIALLY_PAID'].includes(openTab.status)) {
            return { success: false, message: 'La cuenta no está disponible para pago' };
        }

        // SAFEGUARD: el descuento DIVISAS_33 (33%) sólo aplica si el pago es
        // realmente en divisas (CASH/CASH_USD/CASH_EUR/ZELLE). Si el caller
        // pasa discountType='DIVISAS_33' pero paymentMethod es Bs (CASH_BS),
        // ignoramos el descuento. Bug reportado: cuenta en Bs cobrada con -33%.
        const isDivisasPay =
            data.paymentMethod === 'CASH' ||
            data.paymentMethod === 'CASH_USD' ||
            data.paymentMethod === 'CASH_EUR' ||
            data.paymentMethod === 'ZELLE';
        const blockDivisasDiscount = data.discountType === 'DIVISAS_33' && !isDivisasPay;
        const discountAmount = blockDivisasDiscount ? 0 : (data.discountAmount || 0);
        const newRunningDiscount = openTab.runningDiscount + discountAmount;
        const newRunningTotal = Math.max(0, openTab.runningTotal - discountAmount);
        const effectiveBalance = Math.max(0, openTab.balanceDue - discountAmount);
        const appliedAmount = Math.min(data.amount, effectiveBalance);
        const newBalance = Math.max(0, effectiveBalance - appliedAmount);
        const nextTabStatus = newBalance === 0 ? 'CLOSED' : 'PARTIALLY_PAID';
        const nextOrderPaymentStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';
        const nextPaymentMethod = openTab.paymentSplits.length > 0 ? 'MULTIPLE' : data.paymentMethod;

        // Cargo de servicio: default ON para TABLE_SERVICE; eximir requiere
        // PIN de capitán/gerente. El % es editable al cobro (§85), default 10.
        const isTableService = openTab.serviceType === 'TABLE_SERVICE';
        const wantsSkipServiceFee = isTableService && data.serviceFeeIncluded === false;
        const serviceRate = normalizeServiceRate(data.serviceFeePercent);
        let serviceCharge = isTableService ? appliedAmount * serviceRate : 0;

        // Tasa BCV del momento del cobro — se persiste en el split (BUG #3:
        // los cobros de mesa no guardaban tasa ni Bs → dual-currency
        // irrecuperable). Best-effort: si falla, el split queda sin tasa.
        const splitRate = await getExchangeRateValue().catch(() => null);
        const isBsTabPayment = BS_PAYMENT_METHODS.has(data.paymentMethod);

        if (wantsSkipServiceFee) {
            const pin = (data.skipServiceFeeAuthPin || '').trim();
            if (pin.length < 4) {
                return { success: false, message: 'Para quitar el 10% servicio se requiere PIN de capitán o gerente.' };
            }
            const auth = await resolveVoidAuthPin(pin, openTab.branchId);
            if (!auth) {
                return { success: false, message: 'PIN de capitán o gerente incorrecto.' };
            }
            serviceCharge = 0;
        }

        const updatedTab = await db.$transaction(async (tx) => {
            await assertOpenTabVersionUpdate({
                tx,
                openTabId: openTab.id,
                expectedVersion: openTab.version,
                data: {
                    balanceDue: newBalance,
                    runningDiscount: newRunningDiscount,
                    runningTotal: newRunningTotal,
                    status: nextTabStatus,
                    closedAt: newBalance === 0 ? new Date() : null,
                    totalServiceCharge: openTab.totalServiceCharge + serviceCharge,
                }
            });

            const baseLabel = data.splitLabel || `Pago ${openTab.paymentSplits.length + 1}`;
            const splitLabel = isTableService ? `${baseLabel} | +10% serv` : baseLabel;
            // PaymentSplit conserva el desglose completo del cobro para auditoría +
            // reimpresión correcta del recibo desde sales-history.
            //  · subtotal       = monto de items aplicados (post-descuento)
            //  · discount       = monto descontado en este cobro (ej. 33% divisas)
            //  · serviceCharge  = 10% sobre el subtotal post-descuento (si aplica)
            //  · total          = subtotal + serviceCharge (lo que el cliente pagó)
            //  · paidAmount     = efectivo entregado (puede ser mayor; cambio aparte)
            const splitNotes = data.notes
                ? `${data.notes}${data.discountReason ? ` | ${data.discountReason}` : ''}`
                : data.discountReason;
            await tx.paymentSplit.create({
                data: {
                    openTabId: openTab.id,
                    splitLabel,
                    splitType: 'CUSTOM',
                    paymentMethod: data.paymentMethod,
                    status: 'PAID',
                    subtotal: appliedAmount,
                    discount: discountAmount,
                    serviceChargeAmount: serviceCharge,
                    total: appliedAmount + serviceCharge,
                    // En el cobro divisas proporcional, `amount` es el NETO aplicado;
                    // el dinero realmente entregado viene en paidAmountOverride.
                    paidAmount: data.paidAmountOverride ?? data.amount,
                    // Dual currency (FASE B): Bs equivalente del total cobrado
                    // + tasa histórica. Null si no hay tasa configurada.
                    amountBs: isBsTabPayment && splitRate
                        ? round2((appliedAmount + serviceCharge) * splitRate)
                        : null,
                    exchangeRate: splitRate ?? null,
                    paidAt: new Date(),
                    notes: splitNotes,
                }
            });

            // Actualizar SalesOrder(s) con el descuento + razón aplicados al cobro.
            // Esto garantiza que la reimpresión desde sales-history (que lee
            // sale.discount, sale.discountReason) muestre los mismos valores que
            // el recibo original.
            await tx.salesOrder.updateMany({
                where: { openTabId: openTab.id },
                data: {
                    paymentStatus: nextOrderPaymentStatus,
                    paymentMethod: nextPaymentMethod,
                    amountPaid: newBalance === 0 ? newRunningTotal : undefined,
                    closedAt: newBalance === 0 ? new Date() : undefined,
                    // Si el safeguard divisas bloqueó el descuento, no
                    // contaminamos SalesOrder con un discountType/Reason
                    // que no aplica.
                    discount: discountAmount > 0
                        ? { increment: discountAmount }
                        : undefined,
                    discountType: !blockDivisasDiscount && data.discountType ? data.discountType : undefined,
                    discountReason: !blockDivisasDiscount && data.discountReason ? data.discountReason : undefined,
                }
            });

            const tab = await tx.openTab.findUniqueOrThrow({
                where: { id: openTab.id },
                include: {
                    paymentSplits: true,
                    orders: {
                        include: { items: true },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (newBalance === 0 && openTab.tableOrStationId) {
                await tx.tableOrStation.update({
                    where: { id: openTab.tableOrStationId },
                    data: { currentStatus: 'AVAILABLE' }
                });
            }

            return tab;
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/sales');

        return {
            success: true,
            message: newBalance === 0 ? 'Cuenta cerrada y pagada' : 'Pago parcial registrado',
            data: updatedTab
        };
    } catch (error) {
        console.error('Error registering tab payment:', error);
        if (error instanceof POSActionError) {
            return { success: false, message: error.message };
        }
        return { success: false, message: 'Error registrando pago de la cuenta' };
    }
}

const VALID_TIP_PERCENTS = [0, 10, 15, 20];

export async function setOpenTabTipAction(data: { openTabId: string; tipPercent: number }): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        if (!VALID_TIP_PERCENTS.includes(data.tipPercent)) {
            return { success: false, message: 'Porcentaje de propina no válido' };
        }

        const openTab = await db.openTab.findUnique({ where: { id: data.openTabId } });
        if (!openTab || !['OPEN', 'PARTIALLY_PAID'].includes(openTab.status)) {
            return { success: false, message: 'Cuenta no disponible' };
        }

        // Propina sugerida = tipPercent sobre el TOTAL NETO (post-descuento),
        // NO sobre el subtotal bruto. Con descuentos de mesa (DIVISAS_33,
        // CORTESIA_*) runningSubtotal ≠ runningTotal; usar el bruto inflaba la
        // propina en proporción al descuento (bug TAB-2433 §46). El 10% sobre
        // $48 neto debe dar $4.80, no $7.20 sobre $72 bruto.
        const tipAmount = suggestedTipAmount(openTab.runningTotal, data.tipPercent);

        const updated = await db.openTab.update({
            where: { id: data.openTabId },
            data: { tipPercent: data.tipPercent, tipAmount },
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');

        return { success: true, message: 'Propina guardada', data: { tipPercent: updated.tipPercent, tipAmount: updated.tipAmount } };
    } catch (error) {
        console.error('Error setting tip:', error);
        return { success: false, message: 'Error guardando propina' };
    }
}

export async function closeOpenTabAction(openTabId: string): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const openTab = await db.openTab.findUnique({
            where: { id: openTabId }
        });

        if (!openTab) {
            return { success: false, message: 'Cuenta no encontrada' };
        }

        // Permitir cerrar cuando no hay consumo (saldo 0) o ya se cobró (tolerancia por decimales)
        const balance = Number(openTab.balanceDue ?? 0);
        if (balance > 0.01) {
            return { success: false, message: 'La cuenta aún tiene saldo pendiente' };
        }

        await db.$transaction(async (tx) => {
            await assertOpenTabVersionUpdate({
                tx,
                openTabId,
                expectedVersion: openTab.version,
                data: {
                    status: 'CLOSED',
                    closedAt: openTab.closedAt || new Date(),
                    balanceDue: 0,
                    closedById: session.id
                }
            });

            await tx.salesOrder.updateMany({
                where: { openTabId },
                data: {
                    closedAt: new Date(),
                    paymentStatus: 'PAID'
                }
            });

            if (openTab.tableOrStationId) {
                await tx.tableOrStation.update({
                    where: { id: openTab.tableOrStationId },
                    data: { currentStatus: 'AVAILABLE' }
                });
            }
        });

        revalidatePath('/dashboard/pos/restaurante');

        return {
            success: true,
            message: 'Cuenta cerrada correctamente'
        };
    } catch (error) {
        console.error('Error closing open tab:', error);
        if (error instanceof POSActionError) {
            return { success: false, message: error.message };
        }
        return { success: false, message: 'Error cerrando la cuenta' };
    }
}

// ============================================================================
// AUTORIZACIÓN DUAL: WAITER CAPITÁN  O  USER GERENTE
// Resuelve el PIN ingresado contra ambos pools. Devuelve quién autorizó.
// ============================================================================

type VoidAuth =
    | { type: 'CAPTAIN'; name: string; waiterId: string; userId: null }
    | { type: 'MANAGER'; name: string; waiterId: null; userId: string };

async function resolveVoidAuthPin(pin: string, branchId: string): Promise<VoidAuth | null> {
    const db = await getTenantDb();
    const trimmed = pin.trim();

    // Pool 1 — Waiter capitán activo en la sucursal
    const captains = await db.waiter.findMany({
        where: { branchId, isActive: true, isCaptain: true, pin: { not: null } },
        select: { id: true, firstName: true, lastName: true, pin: true },
    });
    for (const c of captains) {
        if (c.pin && await verifyPin(trimmed, c.pin)) {
            return { type: 'CAPTAIN', name: `${c.firstName} ${c.lastName}`, waiterId: c.id, userId: null };
        }
    }

    // Pool 2 — User gerente / dueño activo
    const managers = await db.user.findMany({
        where: { role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD'] }, isActive: true, pin: { not: null } },
        select: { id: true, firstName: true, lastName: true, pin: true },
    });
    for (const m of managers) {
        if (m.pin && await verifyPin(trimmed, m.pin)) {
            return { type: 'MANAGER', name: `${m.firstName} ${m.lastName}`, waiterId: null, userId: m.id };
        }
    }
    return null;
}

// ============================================================================
// VOID INTERNO COMPARTIDO
// Marca el item como void en la transacción y ajusta totales del tab/orden.
// NO hace commit — debe llamarse dentro de db.$transaction.
// ============================================================================

/**
 * Reversión/descargo de inventario para modificaciones de ítems de mesa
 * (BUG #2 del DIAGNOSTICO_REPORTES). Antes, anular/ajustar/reemplazar un
 * ítem enviado NO tocaba inventario → stock real vs teórico desincronizado.
 *
 * `direction: 'RESTORE'` crea ADJUSTMENT_IN + increment (espejo de
 * voidSalesOrderAction); `direction: 'DEDUCT'` crea SALE + decrement
 * (espejo de registerInventoryForCartItems). Cubre la receta del MenuItem
 * y las recetas de modificadores con linkedMenuItemId.
 */
async function applyItemInventoryInTx(tx: any, params: {
    direction: 'RESTORE' | 'DEDUCT';
    menuItemId: string;
    quantity: number;
    modifierIds: (string | null | undefined)[];
    areaId: string;
    orderId: string;
    createdById: string;
    label: string; // itemName para las notas del movimiento
}) {
    const { direction, quantity } = params;
    type Op = { inventoryItemId: string; quantity: number; unit: string; note: string };
    const ops: Op[] = [];

    const collectRecipe = async (recipeId: string | null | undefined, note: string) => {
        if (!recipeId) return;
        const recipe = await tx.recipe.findUnique({
            where: { id: recipeId },
            include: { ingredients: { select: { ingredientItemId: true, quantity: true, unit: true } } },
        });
        if (!recipe?.isActive) return;
        for (const ing of recipe.ingredients) {
            ops.push({
                inventoryItemId: ing.ingredientItemId,
                quantity: ing.quantity * quantity,
                unit: ing.unit,
                note,
            });
        }
    };

    const menuItem = await tx.menuItem.findUnique({
        where: { id: params.menuItemId },
        select: { name: true, recipeId: true },
    });
    await collectRecipe(menuItem?.recipeId, `${params.label}`);

    for (const modifierId of params.modifierIds) {
        if (!modifierId) continue;
        const menuModifier = await tx.menuModifier.findUnique({
            where: { id: modifierId },
            select: {
                name: true,
                ingredients: { select: { ingredientItemId: true, quantity: true, unit: true } },
                linkedMenuItem: { select: { recipeId: true } },
            },
        });
        const note = `${params.label} (mod: ${menuModifier?.name ?? modifierId})`;
        // Receta propia del modificador (§80) tiene prioridad — espejo del descargo.
        if (menuModifier?.ingredients?.length) {
            for (const ing of menuModifier.ingredients) {
                ops.push({
                    inventoryItemId: ing.ingredientItemId,
                    quantity: ing.quantity * quantity,
                    unit: ing.unit,
                    note,
                });
            }
            continue;
        }
        await collectRecipe(menuModifier?.linkedMenuItem?.recipeId, note);
    }

    for (const op of ops) {
        await tx.inventoryMovement.create({
            data: {
                inventoryItemId: op.inventoryItemId,
                movementType: direction === 'RESTORE' ? 'ADJUSTMENT_IN' : 'SALE',
                quantity: op.quantity,
                unit: op.unit,
                reason: direction === 'RESTORE'
                    ? `Reversión por anulación de ítem — Orden: ${params.orderId}`
                    : `Venta — Orden: ${params.orderId}`,
                notes: direction === 'RESTORE'
                    ? `Anulación ítem: ${op.note}`
                    : `Reemplazo/ajuste ítem: ${op.note}`,
                salesOrderId: params.orderId,
                createdById: params.createdById,
            },
        });
        await tx.inventoryLocation.upsert({
            where: { inventoryItemId_areaId: { inventoryItemId: op.inventoryItemId, areaId: params.areaId } },
            create: {
                inventoryItemId: op.inventoryItemId,
                areaId: params.areaId,
                currentStock: direction === 'RESTORE' ? op.quantity : -op.quantity,
            },
            update: {
                currentStock: direction === 'RESTORE'
                    ? { increment: op.quantity }
                    : { decrement: op.quantity },
            },
        });
    }
}

async function voidItemInTx(
    // Acepta tx tanto del cliente original como del extendido (withTenant).
    tx: any,
    item: {
        id: string; orderId: string; itemName: string; menuItemId: string;
        quantity: number; lineTotal: number;
        modifiers: { modifierId: string | null }[];
        order: { areaId: string; createdById: string };
    },
    openTabId: string,
    reason: string,
    auth: VoidAuth,
) {
    // Soft delete: marcar como void
    await tx.salesOrderItem.update({
        where: { id: item.id },
        data: {
            voidedAt: new Date(),
            voidReason: reason.trim(),
            voidedByWaiterId: auth.type === 'CAPTAIN' ? auth.waiterId : null,
            voidedByUserId:   auth.type === 'MANAGER' ? auth.userId   : null,
        },
    });

    // Limpiar asignaciones de subcuenta
    await tx.subAccountItem.deleteMany({ where: { salesOrderItemId: item.id } });

    // Recalcular total de la orden (solo ítems NO void)
    const remaining = await tx.salesOrderItem.findMany({
        where: { orderId: item.orderId, voidedAt: null },
    });
    const newOrderTotal = remaining.reduce((s: number, i: { lineTotal: number }) => s + i.lineTotal, 0);
    await tx.salesOrder.update({
        where: { id: item.orderId },
        data: { subtotal: newOrderTotal, total: newOrderTotal },
    });

    // Recalcular totales del tab
    const tab = await tx.openTab.findUniqueOrThrow({ where: { id: openTabId } });
    const noteEntry = `[VOID: ${item.itemName} x${item.quantity} $${item.lineTotal.toFixed(2)} | ${reason.trim()} | Auth: ${auth.name}]`;
    await tx.openTab.update({
        where: { id: openTabId },
        data: {
            runningSubtotal: Math.max(0, tab.runningSubtotal - item.lineTotal),
            runningTotal:    Math.max(0, tab.runningTotal    - item.lineTotal),
            balanceDue:      Math.max(0, tab.balanceDue      - item.lineTotal),
            notes:           ((tab.notes || '') + ' ' + noteEntry).trim().slice(0, 1000),
            version:         { increment: 1 },
        },
    });

    // Revertir el descargo de inventario del ítem anulado (BUG #2).
    // El descargo original ocurrió en addItemsToOpenTabAction al enviarlo;
    // sin esta reversión el stock quedaba descontado para siempre.
    await applyItemInventoryInTx(tx, {
        direction: 'RESTORE',
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        modifierIds: item.modifiers.map(m => m.modifierId),
        areaId: item.order.areaId,
        orderId: item.orderId,
        createdById: item.order.createdById,
        label: item.itemName,
    });
}

// ============================================================================
// ELIMINAR ITEM DE CUENTA ABIERTA — soft delete, dual PIN
// Mantenido por compatibilidad. PASO 3 usará modifyTabItemAction.
// ============================================================================

export async function removeItemFromOpenTabAction({
    openTabId,
    orderId,
    itemId,
    cashierPin,
    justification,
    waiterProfileId,
}: {
    openTabId: string;
    orderId: string;
    itemId: string;
    cashierPin: string;
    justification: string;
    waiterProfileId?: string;
}): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        if (!justification?.trim()) return { success: false, message: 'La justificación es obligatoria' };
        if (!cashierPin || cashierPin.trim().length < 4) return { success: false, message: 'PIN inválido' };

        const branch = await db.branch.findFirst({ where: { isActive: true } });
        if (!branch) return { success: false, message: 'Sin sucursal activa' };

        const auth = await resolveVoidAuthPin(cashierPin, branch.id);
        if (!auth) return { success: false, message: 'PIN incorrecto o sin permisos' };

        const item = await db.salesOrderItem.findUnique({
            where: { id: itemId },
            include: {
                order: { include: { tableOrStation: true } },
                modifiers: true,
            },
        });
        if (!item) return { success: false, message: 'Ítem no encontrado' };
        if (item.voidedAt) return { success: false, message: 'El ítem ya fue anulado' };
        if (item.order.openTabId !== openTabId) return { success: false, message: 'El ítem no pertenece a esta cuenta' };

        // Mesonero solicitante para el log
        let requesterLabel = '';
        if (waiterProfileId) {
            const w = await db.waiter.findUnique({ where: { id: waiterProfileId }, select: { firstName: true, lastName: true } });
            if (w) requesterLabel = ` | Mesonero: ${w.firstName} ${w.lastName}`;
        }
        const reasonFull = justification.trim() + requesterLabel;

        await db.$transaction(async (tx) => {
            await voidItemInTx(tx, item, openTabId, reasonFull, auth);
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        return {
            success: true,
            message: `"${item.itemName}" anulado. Autorizó: ${auth.name}`,
            data: {
                authorizerName: auth.name,
                removedAmount: item.lineTotal,
                kitchenPrintData: {
                    orderNumber: item.order.orderNumber,
                    tableName: item.order.tableOrStation?.name ?? '',
                    waiterLabel: waiterProfileId ? requesterLabel.replace(' | Mesonero: ', '') : undefined,
                    modificationType: 'VOID' as const,
                    voidedItem: {
                        name: item.itemName,
                        quantity: item.quantity,
                        modifiers: item.modifiers.map(m => m.name),
                    },
                },
            },
        };
    } catch (error) {
        console.error('removeItemFromOpenTabAction error:', error);
        return { success: false, message: 'Error anulando el ítem' };
    }
}

// ============================================================================
// MODIFICAR ÍTEM DE CUENTA ABIERTA
// Soporta: VOID (anular), ADJUST_QTY (ajustar cantidad), REPLACE (cambiar ítem).
// Dual PIN: capitán Waiter O gerente User.
// ============================================================================

export type ModifyTabItemModification =
    | { type: 'VOID' }
    | { type: 'ADJUST_QTY'; newQuantity: number }
    | { type: 'REPLACE'; newMenuItemId: string; newQuantity?: number };

export async function modifyTabItemAction({
    openTabId,
    orderId,
    itemId,
    captainPin,
    reason,
    modification,
}: {
    openTabId: string;
    orderId: string;
    itemId: string;
    captainPin: string;
    reason: string;
    modification: ModifyTabItemModification;
}): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        if (!reason?.trim()) return { success: false, message: 'El motivo es obligatorio' };
        if (!captainPin || captainPin.trim().length < 4) return { success: false, message: 'PIN inválido' };

        const branch = await db.branch.findFirst({ where: { isActive: true } });
        if (!branch) return { success: false, message: 'Sin sucursal activa' };

        const auth = await resolveVoidAuthPin(captainPin, branch.id);
        if (!auth) return { success: false, message: 'PIN de capitán o gerente incorrecto' };

        // Cargar el ítem original con sus relaciones. Incluimos
        // menuItem.category para que el cliente pueda decidir a qué
        // estación enviar la anulación (barra vs cocina) al encolar
        // el VOID_KITCHEN job.
        const item = await db.salesOrderItem.findUnique({
            where: { id: itemId },
            include: {
                order: {
                    include: {
                        tableOrStation: { select: { name: true } },
                        waiterProfile:  { select: { firstName: true, lastName: true } },
                    },
                },
                modifiers: true,
                menuItem: { include: { category: { select: { name: true } } } },
            },
        });
        if (!item) return { success: false, message: 'Ítem no encontrado' };
        if (item.voidedAt) return { success: false, message: 'El ítem ya fue anulado' };
        if (item.orderId !== orderId) return { success: false, message: 'El ítem no pertenece a esta orden' };
        if (item.order.openTabId !== openTabId) return { success: false, message: 'El ítem no pertenece a esta cuenta' };

        if (modification.type === 'ADJUST_QTY') {
            const { newQuantity } = modification;
            if (!Number.isInteger(newQuantity) || newQuantity < 1) {
                return { success: false, message: 'La cantidad debe ser al menos 1' };
            }
            if (newQuantity >= item.quantity) {
                return { success: false, message: `La cantidad nueva (${newQuantity}) debe ser menor a la actual (${item.quantity})` };
            }
        }

        // Construir el label del autor para la comanda. Prioriza el
        // mesero del order si existe; si no (caso pickup/caja sin
        // mesero), cae al nombre del supervisor que autorizó. Evita
        // que se imprima "Autor: undefined" en el ticket.
        const waiterLabel = item.order.waiterProfile
            ? `${item.order.waiterProfile.firstName} ${item.order.waiterProfile.lastName}`
            : auth.name;

        let newItemForPrint: { name: string; quantity: number; modifiers: string[] } | undefined;

        await db.$transaction(async (tx) => {
            if (modification.type === 'VOID') {
                await voidItemInTx(tx, item, openTabId, reason, auth);
            }

            else if (modification.type === 'ADJUST_QTY') {
                const { newQuantity } = modification;
                const newLineTotal = round2(item.unitPrice * newQuantity);
                const deltaAmount  = item.lineTotal - newLineTotal; // cuánto se reduce

                // Void original
                await voidItemInTx(tx, item, openTabId, reason, auth);

                // Crear ítem de reemplazo con cantidad reducida
                const newItem = await tx.salesOrderItem.create({
                    data: {
                        tenantId,
                        orderId:   item.orderId,
                        menuItemId: item.menuItemId,
                        itemName:  item.itemName,
                        unitPrice: item.unitPrice,
                        quantity:  newQuantity,
                        lineTotal: newLineTotal,
                        notes:     item.notes,
                        // Hereda el snapshot de costo del ítem original (A0.1)
                        ...costSnapshotFields(item.unitPrice, newQuantity, item.costPerUnit ?? 0),
                        modifiers: {
                            create: item.modifiers.map(m => ({
                                name: m.name,
                                priceAdjustment: m.priceAdjustment,
                                modifierId: m.modifierId,
                            })),
                        },
                    },
                });

                // Re-descargar inventario por la cantidad nueva (BUG #2):
                // voidItemInTx restauró la cantidad completa del original.
                await applyItemInventoryInTx(tx, {
                    direction: 'DEDUCT',
                    menuItemId: item.menuItemId,
                    quantity: newQuantity,
                    modifierIds: item.modifiers.map(m => m.modifierId),
                    areaId: item.order.areaId,
                    orderId: item.orderId,
                    createdById: item.order.createdById,
                    label: item.itemName,
                });

                // Marcar el original como reemplazado por el nuevo
                await tx.salesOrderItem.update({
                    where: { id: item.id },
                    data: { replacedByItemId: newItem.id },
                });

                // voidItemInTx ya ajustó totales; pero creamos un ítem nuevo que suma,
                // así que necesitamos corregir sumando el newLineTotal
                const orderAfterVoid = await tx.salesOrderItem.findMany({
                    where: { orderId: item.orderId, voidedAt: null },
                });
                const correctedOrderTotal = orderAfterVoid.reduce((s, i) => s + i.lineTotal, 0);
                await tx.salesOrder.update({
                    where: { id: item.orderId },
                    data: { subtotal: correctedOrderTotal, total: correctedOrderTotal },
                });

                const tab = await tx.openTab.findUniqueOrThrow({ where: { id: openTabId } });
                await tx.openTab.update({
                    where: { id: openTabId },
                    data: {
                        runningSubtotal: Math.max(0, tab.runningSubtotal + newLineTotal),
                        runningTotal:    Math.max(0, tab.runningTotal    + newLineTotal),
                        balanceDue:      Math.max(0, tab.balanceDue      + newLineTotal),
                    },
                });

                newItemForPrint = {
                    name: newItem.itemName,
                    quantity: newItem.quantity,
                    modifiers: item.modifiers.map(m => m.name),
                };
                void deltaAmount; // used implicitly via voidItemInTx + correction above
            }

            else if (modification.type === 'REPLACE') {
                const { newMenuItemId, newQuantity = 1 } = modification;

                // Cargar el nuevo MenuItem — validando ownership del tenant:
                // newMenuItemId viene del cliente y findUnique no filtra tenant
                // dentro del tx (defensa anti cross-tenant, patrón §43.3).
                const newMenuItem = await tx.menuItem.findUnique({
                    where: { id: newMenuItemId },
                    select: { id: true, name: true, price: true, tenantId: true },
                });
                if (!newMenuItem || newMenuItem.tenantId !== tenantId) {
                    throw new Error('Producto de reemplazo no encontrado');
                }

                const newLineTotal = round2(newMenuItem.price * newQuantity);

                // Void original
                await voidItemInTx(tx, item, openTabId, reason, auth);

                // Crear ítem de reemplazo
                const replacementCostMap = await buildMenuItemCostMap(tx, [newMenuItem.id]);
                const newItem = await tx.salesOrderItem.create({
                    data: {
                        tenantId,
                        orderId:   item.orderId,
                        menuItemId: newMenuItem.id,
                        itemName:  newMenuItem.name,
                        unitPrice: newMenuItem.price,
                        quantity:  newQuantity,
                        lineTotal: newLineTotal,
                        // Snapshot de costo del producto nuevo (A0.1)
                        ...costSnapshotFields(newMenuItem.price, newQuantity, replacementCostMap.get(newMenuItem.id) ?? 0),
                    },
                });

                // Descargar inventario del producto nuevo (BUG #2):
                // voidItemInTx restauró el original; el reemplazo consume.
                await applyItemInventoryInTx(tx, {
                    direction: 'DEDUCT',
                    menuItemId: newMenuItem.id,
                    quantity: newQuantity,
                    modifierIds: [],
                    areaId: item.order.areaId,
                    orderId: item.orderId,
                    createdById: item.order.createdById,
                    label: newMenuItem.name,
                });

                // Marcar el original como reemplazado
                await tx.salesOrderItem.update({
                    where: { id: item.id },
                    data: { replacedByItemId: newItem.id },
                });

                // Corregir totales (void restó, nuevo suma)
                const orderItems = await tx.salesOrderItem.findMany({
                    where: { orderId: item.orderId, voidedAt: null },
                });
                const newOrderTotal = orderItems.reduce((s, i) => s + i.lineTotal, 0);
                await tx.salesOrder.update({
                    where: { id: item.orderId },
                    data: { subtotal: newOrderTotal, total: newOrderTotal },
                });

                const tab = await tx.openTab.findUniqueOrThrow({ where: { id: openTabId } });
                await tx.openTab.update({
                    where: { id: openTabId },
                    data: {
                        runningSubtotal: Math.max(0, tab.runningSubtotal + newLineTotal),
                        runningTotal:    Math.max(0, tab.runningTotal    + newLineTotal),
                        balanceDue:      Math.max(0, tab.balanceDue      + newLineTotal),
                    },
                });

                newItemForPrint = { name: newMenuItem.name, quantity: newQuantity, modifiers: [] };
            }
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');

        const modLabel = modification.type === 'VOID' ? 'Anulado'
            : modification.type === 'ADJUST_QTY' ? 'Cantidad ajustada'
            : 'Reemplazado';

        return {
            success: true,
            message: `${modLabel}: "${item.itemName}". Autorizó: ${auth.name}`,
            data: {
                modificationType: modification.type,
                authorizerName: auth.name,
                kitchenPrintData: {
                    orderNumber: item.order.orderNumber,
                    tableName:   item.order.tableOrStation?.name ?? '',
                    waiterLabel,
                    authorizerName: auth.name,
                    modificationType: modification.type,
                    // categoryName del item anulado → permite al cliente
                    // enrutar el VOID_KITCHEN a la estación correcta
                    // (barra si es bebida, cocina si es plato).
                    categoryName: item.menuItem?.category?.name ?? null,
                    voidedItem: {
                        name: item.itemName,
                        quantity: item.quantity,
                        modifiers: item.modifiers.map(m => m.name),
                    },
                    newItem: newItemForPrint,
                },
            },
        };
    } catch (error) {
        console.error('modifyTabItemAction error:', error);
        const msg = error instanceof Error ? error.message : 'Error modificando el ítem';
        return { success: false, message: msg };
    }
}

// ============================================================================
// ANULAR COMANDA COMPLETA — void de TODOS los ítems activos de una orden
// en una sola autorización (dual PIN capitán/gerente). Evita anular ítem
// por ítem cuando la comanda entera se marchó a la mesa equivocada.
// Reintegra inventario de cada ítem (recetas + modificadores linkeados).
// ============================================================================

export async function voidEntireTabOrderAction({
    openTabId,
    orderId,
    captainPin,
    reason,
    waiterProfileId,
}: {
    openTabId: string;
    orderId: string;
    captainPin: string;
    reason: string;
    waiterProfileId?: string;
}): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        if (!reason?.trim()) return { success: false, message: 'El motivo es obligatorio' };
        if (!captainPin || captainPin.trim().length < 4) return { success: false, message: 'PIN inválido' };

        const branch = await db.branch.findFirst({ where: { isActive: true } });
        if (!branch) return { success: false, message: 'Sin sucursal activa' };

        const auth = await resolveVoidAuthPin(captainPin, branch.id);
        if (!auth) return { success: false, message: 'PIN de capitán o gerente incorrecto' };

        // Cargar la orden con sus ítems activos (tenant-scoped vía db)
        const order = await db.salesOrder.findFirst({
            where: { id: orderId, openTabId },
            include: {
                tableOrStation: { select: { name: true } },
                waiterProfile:  { select: { firstName: true, lastName: true } },
                items: {
                    where: { voidedAt: null },
                    include: {
                        modifiers: true,
                        menuItem: { include: { category: { select: { name: true } } } },
                    },
                },
            },
        });
        if (!order) return { success: false, message: 'Comanda no encontrada en esta cuenta' };
        if (order.items.length === 0) {
            return { success: false, message: 'La comanda no tiene ítems activos para anular' };
        }

        // Mesonero solicitante para el log
        let requesterLabel = '';
        if (waiterProfileId) {
            const w = await db.waiter.findUnique({ where: { id: waiterProfileId }, select: { firstName: true, lastName: true } });
            if (w) requesterLabel = ` | Mesonero: ${w.firstName} ${w.lastName}`;
        }
        const reasonFull = `${reason.trim()} [Comanda completa]${requesterLabel}`;

        const voidedTotal = order.items.reduce((s, i) => s + i.lineTotal, 0);

        // Una sola transacción: si falla un ítem, ninguno queda anulado.
        // Timeout ampliado: cada void hace varias escrituras (item, totales,
        // inventario) y una comanda grande supera el default de 5s.
        await db.$transaction(async (tx) => {
            for (const item of order.items) {
                await voidItemInTx(
                    tx,
                    { ...item, order: { areaId: order.areaId, createdById: order.createdById } },
                    openTabId,
                    reasonFull,
                    auth,
                );
            }
        }, { timeout: 30_000 });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');

        const waiterLabel = order.waiterProfile
            ? `${order.waiterProfile.firstName} ${order.waiterProfile.lastName}`
            : auth.name;

        return {
            success: true,
            message: `Comanda anulada completa: ${order.items.length} ítem(s) por $${voidedTotal.toFixed(2)}. Autorizó: ${auth.name}`,
            data: {
                authorizerName: auth.name,
                voidedCount: order.items.length,
                voidedAmount: voidedTotal,
                // Un VOID_KITCHEN por ítem para que cada anulación se enrute
                // a su estación correcta (barra vs cocina) según categoría.
                kitchenPrintItems: order.items.map(i => ({
                    orderNumber: order.orderNumber,
                    tableName: order.tableOrStation?.name ?? '',
                    waiterLabel,
                    authorizerName: auth.name,
                    modificationType: 'VOID' as const,
                    categoryName: i.menuItem?.category?.name ?? null,
                    voidedItem: {
                        name: i.itemName,
                        quantity: i.quantity,
                        modifiers: i.modifiers.map(m => m.name),
                    },
                })),
            },
        };
    } catch (error) {
        console.error('voidEntireTabOrderAction error:', error);
        const msg = error instanceof Error ? error.message : 'Error anulando la comanda';
        return { success: false, message: msg };
    }
}

// ============================================================================
// USUARIOS DISPONIBLES PARA MESONERO / CAJERA
// ============================================================================

export async function getUsersForTabAction(): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        const branch = await db.branch.findFirst({ where: { isActive: true } });
        if (!branch) return { success: false, message: 'Sin sucursal', data: [] };
        const waiters = await db.waiter.findMany({
            where: { branchId: branch.id, isActive: true },
            orderBy: { firstName: 'asc' },
            select: { id: true, firstName: true, lastName: true },
        });
        return { success: true, message: 'Mesoneros cargados', data: waiters };
    } catch {
        return { success: false, message: 'Error cargando mesoneros', data: [] };
    }
}

// ============================================================================
// SUBCUENTAS — División de cuenta por persona / grupo
// ============================================================================

/** Helper interno: recalcula subtotal, serviceCharge y total de una subcuenta
 *  sumando los SubAccountItems que tiene asignados. */
async function recalcSubAccountTotals(tx: any, subAccountId: string) {
    const items = await tx.subAccountItem.findMany({ where: { subAccountId } });
    const subtotal = Math.round(items.reduce((s: number, i: any) => s + i.lineTotal, 0) * 100) / 100;
    const serviceCharge = Math.round(subtotal * 0.10 * 100) / 100;
    const total = Math.round((subtotal + serviceCharge) * 100) / 100;
    await tx.tabSubAccount.update({
        where: { id: subAccountId },
        data: { subtotal, serviceCharge, total },
    });
    return { subtotal, serviceCharge, total };
}

/**
 * Crea N subcuentas vacías para una mesa abierta.
 * labels.length determina cuántas se crean. Máximo 25 por mesa.
 */
export async function createSubAccountsAction(data: {
    openTabId: string;
    labels: string[];
}): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const tab = await db.openTab.findUnique({
            where: { id: data.openTabId },
            include: { subAccounts: true },
        });
        if (!tab || !['OPEN', 'PARTIALLY_PAID'].includes(tab.status)) {
            return { success: false, message: 'Cuenta no disponible' };
        }

        const existing = tab.subAccounts.length;
        if (existing + data.labels.length > 25) {
            return {
                success: false,
                message: `Máximo 25 subcuentas por mesa (ya hay ${existing})`,
            };
        }

        const created = await db.$transaction(
            data.labels.map((label, i) =>
                prisma.tabSubAccount.create({
                    data: {
                        openTabId: data.openTabId,
                        label: label.trim() || `Cuenta ${existing + i + 1}`,
                        sortOrder: existing + i,
                    },
                })
            )
        );

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        return { success: true, message: `${created.length} subcuenta(s) creada(s)`, data: created };
    } catch (error) {
        console.error('Error creating sub accounts:', error);
        return { success: false, message: 'Error creando subcuentas' };
    }
}

/**
 * Renombra la etiqueta de una subcuenta (ej: "Cuenta 1" → "Carlos").
 */
export async function renameSubAccountAction(
    subAccountId: string,
    label: string,
): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();

        const trimmed = label.trim();
        if (!trimmed) return { success: false, message: 'El nombre no puede estar vacío' };

        // updateMany con filtro de tenant evita IDOR cross-tenant.
        const result = await prisma.tabSubAccount.updateMany({
            where: { id: subAccountId, openTab: { tenantId } },
            data: { label: trimmed },
        });
        if (result.count === 0) {
            return { success: false, message: 'Subcuenta no encontrada' };
        }

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        return { success: true, message: 'Subcuenta renombrada' };
    } catch (error) {
        console.error('Error renaming sub account:', error);
        return { success: false, message: 'Error renombrando subcuenta' };
    }
}

/**
 * Elimina una subcuenta OPEN. Los ítems asignados vuelven al pool (cascade borra SubAccountItems).
 * No se puede eliminar una subcuenta ya cobrada (PAID).
 */
export async function deleteSubAccountAction(subAccountId: string): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        const { tenantId } = await resolveTenantContext();

        // findFirst con join al openTab.tenantId: si la sub pertenece a otro
        // tenant, devuelve null igual que si no existiera.
        const sub = await prisma.tabSubAccount.findFirst({
            where: { id: subAccountId, openTab: { tenantId } },
        });
        if (!sub) return { success: false, message: 'Subcuenta no encontrada' };
        if (sub.status === 'PAID') {
            return { success: false, message: 'No se puede eliminar una subcuenta ya cobrada' };
        }

        // deleteMany con filtro de tenant — cierra la race condition entre
        // el findFirst y el delete (si el id fuera de otro tenant entre las
        // dos llamadas, no se borraría nada).
        const del = await prisma.tabSubAccount.deleteMany({
            where: { id: subAccountId, openTab: { tenantId } },
        });
        if (del.count === 0) {
            return { success: false, message: 'Subcuenta no encontrada' };
        }

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        return { success: true, message: 'Subcuenta eliminada. Los ítems vuelven al pool.' };
    } catch (error) {
        console.error('Error deleting sub account:', error);
        return { success: false, message: 'Error eliminando subcuenta' };
    }
}

/**
 * Asigna una cantidad de un SalesOrderItem a una subcuenta.
 * Si ya había una asignación previa del mismo item a la misma subcuenta, la reemplaza.
 * La cantidad disponible = item.quantity − ya asignado en OTRAS subcuentas.
 */
export async function assignItemToSubAccountAction(data: {
    salesOrderItemId: string;
    subAccountId: string;
    quantity: number;
}): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const item = await db.salesOrderItem.findUnique({
            where: { id: data.salesOrderItemId },
            include: { order: true, subAccountItems: true },
        });
        if (!item) return { success: false, message: 'Item no encontrado' };

        const sub = await prisma.tabSubAccount.findFirst({
            where: { id: data.subAccountId, openTab: { tenantId } },
        });
        if (!sub || sub.status !== 'OPEN') {
            return { success: false, message: 'Subcuenta no disponible' };
        }

        if (item.order.openTabId !== sub.openTabId) {
            return { success: false, message: 'El item no pertenece a la misma mesa' };
        }

        // Qty available = item total minus what's already in OTHER subcuentas
        const assignedElsewhere = item.subAccountItems
            .filter((si) => si.subAccountId !== data.subAccountId)
            .reduce((s, si) => s + si.quantity, 0);
        const available = item.quantity - assignedElsewhere;

        if (data.quantity <= 0 || data.quantity > available) {
            return {
                success: false,
                message: `Cantidad inválida. Disponible: ${available}`,
            };
        }

        // Effective unit price includes modifier adjustments spread across quantity
        const unitLineTotal = item.lineTotal / item.quantity;
        const newLineTotal = Math.round(unitLineTotal * data.quantity * 100) / 100;

        await db.$transaction(async (tx) => {
            // Replace any existing assignment of this item to this subcuenta
            await tx.subAccountItem.deleteMany({
                where: { salesOrderItemId: data.salesOrderItemId, subAccountId: data.subAccountId },
            });
            await tx.subAccountItem.create({
                data: {
                    subAccountId: data.subAccountId,
                    salesOrderItemId: data.salesOrderItemId,
                    quantity: data.quantity,
                    lineTotal: newLineTotal,
                },
            });
            await recalcSubAccountTotals(tx, data.subAccountId);
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        return { success: true, message: 'Ítem asignado a la subcuenta' };
    } catch (error) {
        console.error('Error assigning item to sub account:', error);
        return { success: false, message: 'Error asignando ítem' };
    }
}

/**
 * Desvincula un item de una subcuenta — el item vuelve al pool sin asignar.
 */
export async function unassignItemFromSubAccountAction(data: {
    salesOrderItemId: string;
    subAccountId: string;
}): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const sub = await prisma.tabSubAccount.findFirst({
            where: { id: data.subAccountId, openTab: { tenantId } },
        });
        if (!sub || sub.status === 'PAID') {
            return { success: false, message: 'No se puede modificar una subcuenta cobrada' };
        }

        await db.$transaction(async (tx) => {
            await tx.subAccountItem.deleteMany({
                where: {
                    salesOrderItemId: data.salesOrderItemId,
                    subAccountId: data.subAccountId,
                },
            });
            await recalcSubAccountTotals(tx, data.subAccountId);
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        return { success: true, message: 'Ítem devuelto al pool' };
    } catch (error) {
        console.error('Error unassigning item:', error);
        return { success: false, message: 'Error removiendo ítem de subcuenta' };
    }
}

/**
 * División automática igualitaria: distribuye TODOS los ítems de la mesa
 * en `count` subcuentas usando round-robin por cantidad.
 * Si no hay suficientes subcuentas OPEN, las crea.
 * Resetea las asignaciones previas de ítems del pool (no afecta subcuentas ya PAID).
 */
export async function autoSplitEqualAction(data: {
    openTabId: string;
    count: number;
}): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        if (data.count < 2 || data.count > 25) {
            return { success: false, message: 'El número de divisiones debe estar entre 2 y 25' };
        }

        const tab = await db.openTab.findUnique({
            where: { id: data.openTabId },
            include: {
                orders: { include: { items: true } },
                subAccounts: { orderBy: { sortOrder: 'asc' } },
            },
        });
        if (!tab || !['OPEN', 'PARTIALLY_PAID'].includes(tab.status)) {
            return { success: false, message: 'Cuenta no disponible' };
        }

        await db.$transaction(async (tx) => {
            // Ensure exactly `count` OPEN subcuentas exist
            const openSubs = tab.subAccounts.filter((s) => s.status === 'OPEN');
            let subIds: string[] = openSubs.map((s) => s.id);

            if (subIds.length < data.count) {
                const toCreate = data.count - subIds.length;
                const base = tab.subAccounts.length;
                for (let i = 0; i < toCreate; i++) {
                    const created = await tx.tabSubAccount.create({
                        data: {
                            openTabId: data.openTabId,
                            label: `Cuenta ${base + i + 1}`,
                            sortOrder: base + i,
                        },
                    });
                    subIds.push(created.id);
                }
            } else if (subIds.length > data.count) {
                subIds = subIds.slice(0, data.count);
            }

            // Gather all items from all orders
            const allItems = tab.orders.flatMap((o) => o.items);
            const allItemIds = allItems.map((i) => i.id);

            // Clear existing assignments for items in this tab (only for open subcuentas)
            if (allItemIds.length > 0) {
                await tx.subAccountItem.deleteMany({
                    where: {
                        salesOrderItemId: { in: allItemIds },
                        subAccountId: { in: subIds },
                    },
                });
            }

            // Distribute quantities round-robin across subIds
            for (const item of allItems) {
                const n = data.count;
                const unitLine = item.lineTotal / item.quantity;
                const base = Math.floor(item.quantity / n);
                const remainder = item.quantity % n;

                for (let idx = 0; idx < n; idx++) {
                    const qty = base + (idx < remainder ? 1 : 0);
                    if (qty === 0) continue;
                    const lineTotal = Math.round(unitLine * qty * 100) / 100;
                    await tx.subAccountItem.create({
                        data: {
                            subAccountId: subIds[idx],
                            salesOrderItemId: item.id,
                            quantity: qty,
                            lineTotal,
                        },
                    });
                }
            }

            // Recalculate totals for all involved subcuentas
            for (const subId of subIds) {
                await recalcSubAccountTotals(tx, subId);
            }
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        return { success: true, message: `Cuenta dividida en ${data.count} partes iguales` };
    } catch (error) {
        console.error('Error auto-splitting:', error);
        return { success: false, message: 'Error dividiendo la cuenta' };
    }
}

/**
 * Cobra una subcuenta individual.
 * Crea un PaymentSplit con subAccountId. Descuenta de balanceDue del OpenTab.
 * Si todas las subcuentas quedan PAID y balanceDue llega a 0 → cierra el OpenTab.
 * Los ítems del pool sin asignar se cobran por separado con registerOpenTabPaymentAction.
 */
export async function paySubAccountAction(data: {
    subAccountId: string;
    paymentMethod: POSPaymentMethod;
    amount: number;
    serviceFeeIncluded?: boolean;
    serviceFeePercent?: number; // % de servicio editable al cobro (§85)
    splitLabel?: string;
    /**
     * Tipo de descuento aplicado a la subcuenta. Default: NONE.
     * - 'DIVISAS_33': descuento 33% sobre el subtotal (regla de negocio
     *   para pagos en cash USD/EUR/Zelle). Se aplica automáticamente
     *   desde el frontend cuando el método es divisas.
     */
    discountType?: 'NONE' | 'DIVISAS_33';
}): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        if (data.amount <= 0) return { success: false, message: 'El monto debe ser mayor a cero' };

        const sub = await prisma.tabSubAccount.findFirst({
            where: { id: data.subAccountId, openTab: { tenantId } },
            include: {
                openTab: {
                    include: { subAccounts: true },
                },
            },
        });
        if (!sub) return { success: false, message: 'Subcuenta no encontrada' };
        if (sub.status !== 'OPEN') {
            return { success: false, message: 'Esta subcuenta ya fue cobrada' };
        }

        const openTab = sub.openTab;
        if (!['OPEN', 'PARTIALLY_PAID'].includes(openTab.status)) {
            return { success: false, message: 'La mesa no está disponible para cobro' };
        }

        // TABLE_SERVICE tabs always include 10% service charge
        const isTableService = openTab.serviceType === 'TABLE_SERVICE';
        const applyServiceFee = isTableService || (data.serviceFeeIncluded ?? false);
        // Discount: 33% off subtotal cuando se paga en divisas (cash USD/EUR/Zelle).
        // SAFEGUARD: validar que el método realmente sea divisas. Sin esto,
        // un DIVISAS_33 "fantasma" en el frontend (por race condition al
        // cambiar de USD a Bs rápido) aplicaría 33% a un pago en Bs.
        // Bug reportado: cuenta en Bs cobrada con -33%.
        const isDivisasPayment =
            data.paymentMethod === 'CASH' ||
            data.paymentMethod === 'CASH_USD' ||
            data.paymentMethod === 'CASH_EUR' ||
            data.paymentMethod === 'ZELLE';
        const discountType = (data.discountType === 'DIVISAS_33' && isDivisasPayment)
            ? 'DIVISAS_33'
            : 'NONE';
        const subDivisasRate = await loadDivisasDiscountRate(db);
        const discountAmount = discountType === 'DIVISAS_33'
            ? sub.subtotal * subDivisasRate
            : 0;
        const subtotalAfterDiscount = sub.subtotal - discountAmount;
        const subServiceRate = normalizeServiceRate(data.serviceFeePercent);
        const serviceChargeApplied = applyServiceFee
            ? subtotalAfterDiscount * subServiceRate
            : 0;
        const totalApplied = subtotalAfterDiscount + serviceChargeApplied;
        const baseLabel = data.splitLabel || sub.label;
        const labelParts: string[] = [baseLabel];
        if (discountType === 'DIVISAS_33') labelParts.push('-33% divisas');
        if (applyServiceFee) labelParts.push(`+${Math.round(subServiceRate * 100)}% serv`);
        const splitLabel = labelParts.join(' | ');

        // Tasa BCV del momento del cobro (dual currency — BUG #3, FASE B)
        const splitRate = await getExchangeRateValue().catch(() => null);
        const isBsSubPayment = BS_PAYMENT_METHODS.has(data.paymentMethod);

        const updatedTab = await db.$transaction(async (tx) => {
            // Mark subcuenta as PAID
            await tx.tabSubAccount.update({
                where: { id: data.subAccountId },
                data: {
                    status: 'PAID',
                    paidAmount: data.amount,
                    paymentMethod: data.paymentMethod,
                    paidAt: new Date(),
                },
            });

            // Create PaymentSplit for this subcuenta
            await tx.paymentSplit.create({
                data: {
                    openTabId: openTab.id,
                    subAccountId: data.subAccountId,
                    splitLabel,
                    splitType: 'CUSTOM',
                    paymentMethod: data.paymentMethod,
                    status: 'PAID',
                    subtotal: sub.subtotal,
                    discount: discountAmount,
                    serviceChargeAmount: serviceChargeApplied,
                    total: totalApplied,
                    paidAmount: data.amount,
                    // Dual currency (FASE B): Bs del total cobrado + tasa histórica
                    amountBs: isBsSubPayment && splitRate ? round2(totalApplied * splitRate) : null,
                    exchangeRate: splitRate ?? null,
                    paidAt: new Date(),
                    notes: discountType === 'DIVISAS_33' ? `Pago en Divisas (${Math.round(subDivisasRate * 10000) / 100}%)` : undefined,
                },
            });

            // Update OpenTab: deduct from balanceDue.
            // balanceDue tracks food items only (no service charge) — see addItemsToOpenTabAction.
            // sub.total includes serviceCharge, which would over-deduct; use sub.subtotal instead.
            const newBalance = Math.max(0, openTab.balanceDue - sub.subtotal);

            // Tab closes when all subcuentas are PAID AND balance is 0
            const allSubsPaid = openTab.subAccounts.every(
                (s) => s.id === data.subAccountId || s.status === 'PAID'
            );
            const tabClosed = newBalance <= 0.01 && allSubsPaid;

            await tx.openTab.update({
                where: { id: openTab.id },
                data: {
                    balanceDue: newBalance,
                    status: tabClosed ? 'CLOSED' : 'PARTIALLY_PAID',
                    closedAt: tabClosed ? new Date() : undefined,
                    closedById: tabClosed ? session.id : undefined,
                    // Service charge cobrado se acumula con el realmente aplicado
                    // (sobre el subtotal post-descuento), no el pre-computado.
                    totalServiceCharge: openTab.totalServiceCharge + serviceChargeApplied,
                    version: { increment: 1 },
                },
            });

            if (tabClosed && openTab.tableOrStationId) {
                await tx.tableOrStation.update({
                    where: { id: openTab.tableOrStationId },
                    data: { currentStatus: 'AVAILABLE' },
                });
                await tx.salesOrder.updateMany({
                    where: { openTabId: openTab.id },
                    data: { paymentStatus: 'PAID', closedAt: new Date() },
                });
            }

            return await tx.openTab.findUniqueOrThrow({
                where: { id: openTab.id },
                include: {
                    subAccounts: {
                        orderBy: { sortOrder: 'asc' },
                        include: { items: { include: { salesOrderItem: { include: { modifiers: true } } } } },
                    },
                    paymentSplits: { orderBy: { createdAt: 'asc' } },
                    orders: { include: { items: { include: { modifiers: true, subAccountItems: true } } } },
                },
            });
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/sales');
        return {
            success: true,
            message: `${sub.label} cobrada correctamente`,
            data: updatedTab,
        };
    } catch (error) {
        console.error('Error paying sub account:', error);
        return { success: false, message: 'Error procesando pago de subcuenta' };
    }
}

/**
 * Anula una subcuenta (OPEN o PAID).
 *
 * - Si está OPEN: marca status=VOID. Sus SubAccountItem permanecen
 *   referenciados pero por la lógica de "qty disponible" los ítems
 *   vuelven a estar disponibles para reasignar (ya que filtramos por
 *   subcuentas activas en el cómputo de pool).
 * - Si está PAID: además devuelve el monto al balanceDue del OpenTab,
 *   marca el PaymentSplit asociado como VOID con notes que contiene
 *   la razón, descuenta el service charge cobrado del totalServiceCharge,
 *   y reabre la mesa si ya estaba CLOSED.
 *
 * Requiere autorización de gerente: el caller debe haber validado
 * el PIN antes de invocar esta action y pasar authorizedById/Name.
 */
export async function voidSubAccountAction(params: {
    subAccountId: string;
    voidReason: string;
    authorizedById: string;
    authorizedByName: string;
}): Promise<ActionResult> {
    const { db, tenantId } = await getTenantCtx();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        if (!params.voidReason?.trim()) {
            return { success: false, message: 'Debes indicar el motivo de anulación' };
        }

        const sub = await prisma.tabSubAccount.findFirst({
            where: { id: params.subAccountId, openTab: { tenantId } },
            include: {
                openTab: { include: { subAccounts: true } },
                paymentSplits: true,
            },
        });
        if (!sub) return { success: false, message: 'Subcuenta no encontrada' };
        if (sub.status === 'VOID') {
            return { success: false, message: 'Esta subcuenta ya está anulada' };
        }

        const wasPaid = sub.status === 'PAID';
        const auditNote = `[${params.authorizedByName}] ${params.voidReason}`;

        const updatedTab = await db.$transaction(async (tx) => {
            // 1. Marcar la subcuenta como VOID. Limpia paidAt/paidAmount/method
            //    para que la UI muestre claramente que no está pagada.
            await tx.tabSubAccount.update({
                where: { id: params.subAccountId },
                data: {
                    status: 'VOID',
                    paidAmount: 0,
                    paymentMethod: null,
                    paidAt: null,
                },
            });

            if (wasPaid) {
                // 2. Anular los PaymentSplits asociados (preserva el registro
                //    para auditoría con notes que indica quién y por qué).
                let totalServiceChargeReversed = 0;
                for (const ps of sub.paymentSplits) {
                    if (ps.status === 'VOID') continue;
                    totalServiceChargeReversed += ps.serviceChargeAmount ?? 0;
                    await tx.paymentSplit.update({
                        where: { id: ps.id },
                        data: {
                            status: 'VOID',
                            notes: ps.notes
                                ? `${ps.notes} | ANULADO ${auditNote}`
                                : `ANULADO ${auditNote}`,
                        },
                    });
                }

                // 3. Restaurar balanceDue del OpenTab y descontar el service
                //    charge ya acumulado.
                const tab = sub.openTab;
                const newBalance = tab.balanceDue + sub.subtotal;
                const newTotalService = Math.max(0, tab.totalServiceCharge - totalServiceChargeReversed);

                // 4. Si la mesa estaba CLOSED por este pago, reabrirla.
                const newStatus = tab.status === 'CLOSED' ? 'PARTIALLY_PAID' : tab.status;

                await tx.openTab.update({
                    where: { id: tab.id },
                    data: {
                        balanceDue: newBalance,
                        totalServiceCharge: newTotalService,
                        status: newStatus,
                        closedAt: tab.status === 'CLOSED' ? null : tab.closedAt,
                        closedById: tab.status === 'CLOSED' ? null : tab.closedById,
                        version: { increment: 1 },
                    },
                });

                // 5. Si la mesa se reabre, liberar la TableOrStation si estaba AVAILABLE.
                if (tab.status === 'CLOSED' && tab.tableOrStationId) {
                    await tx.tableOrStation.update({
                        where: { id: tab.tableOrStationId },
                        data: { currentStatus: 'OCCUPIED' },
                    });
                    await tx.salesOrder.updateMany({
                        where: { openTabId: tab.id },
                        data: { paymentStatus: 'PARTIAL', closedAt: null },
                    });
                }
            }

            return await tx.openTab.findUniqueOrThrow({
                where: { id: sub.openTabId },
                include: {
                    subAccounts: {
                        orderBy: { sortOrder: 'asc' },
                        include: { items: { include: { salesOrderItem: { include: { modifiers: true } } } } },
                    },
                    paymentSplits: { orderBy: { createdAt: 'asc' } },
                    orders: { include: { items: { include: { modifiers: true, subAccountItems: true } } } },
                },
            });
        });

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/mesero');
        revalidatePath('/dashboard/sales');
        return {
            success: true,
            message: wasPaid
                ? `Subcuenta "${sub.label}" anulada. Saldo restaurado.`
                : `Subcuenta "${sub.label}" anulada. Los ítems vuelven al pool.`,
            data: updatedTab,
        };
    } catch (error) {
        console.error('Error voiding sub account:', error);
        return { success: false, message: 'Error anulando la subcuenta' };
    }
}

/**
 * Carga una mesa completa con todas sus subcuentas, ítems y splits.
 * Usado para sincronizar el estado del panel de subcuentas en el frontend.
 */
export async function getOpenTabWithSubAccountsAction(openTabId: string): Promise<ActionResult> {
    const db = await getTenantDb();
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const tab = await db.openTab.findUnique({
            where: { id: openTabId },
            include: {
                subAccounts: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        items: {
                            include: {
                                salesOrderItem: { include: { modifiers: true } },
                            },
                        },
                        paymentSplits: true,
                    },
                },
                orders: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        items: {
                            include: {
                                modifiers: true,
                                subAccountItems: true,
                            },
                        },
                    },
                },
                paymentSplits: { orderBy: { createdAt: 'asc' } },
            },
        });

        if (!tab) return { success: false, message: 'Cuenta no encontrada' };
        return { success: true, message: 'OK', data: tab };
    } catch (error) {
        console.error('Error loading tab with sub accounts:', error);
        return { success: false, message: 'Error cargando la cuenta' };
    }
}

// ============================================================================
// ACTION: CONTADOR DIARIO DE PICKUPS
// ============================================================================

/**
 * Retorna el primer número de pickup disponible del día (PK-01, PK-02…).
 *
 * Reglas:
 * - Solo cuenta órdenes con status != 'CANCELLED' (los anulados liberan su número).
 * - Combina los PK de la BD con los de los tabs abiertos en memoria (openTabNumbers).
 * - Busca el menor entero positivo que no esté en uso → devuelve el primer "hueco".
 *   Ej: usados = {1, 3} → siguiente = 2 (no 4).
 *
 * El PK number se persiste en el campo notes de la orden como "…| PK-NN" al
 * momento de hacer checkout, lo que permite recuperarlo aquí.
 *
 * @param openTabNumbers  Números PK de los tabs actualmente abiertos en memoria
 *                        (p.ej. ["PK-01", "PK-03"]) — pasados desde el cliente.
 */
export async function getDailyPickupCountAction(
    openTabNumbers: string[] = [],
): Promise<{ success: boolean; nextNumber: string }> {
    const db = await getTenantDb();
    try {
        const { start, end } = getCaracasDayRange();

        // Consultar órdenes de pickup del día (no canceladas).
        // Las ventas directas/pickup se crean con orderType='RESTAURANT' y
        // llevan "Venta Directa Pickup" en notes. (orderType='PICKUP' solo lo
        // usan las propinas colectivas registradas via recordCollectiveTipAction.)
        const orders = await db.salesOrder.findMany({
            where: {
                orderType: 'RESTAURANT',
                sourceChannel: 'POS_RESTAURANT',
                status: { not: 'CANCELLED' },
                notes: { contains: 'Venta Directa Pickup' },
                createdAt: { gte: start, lte: end },
            },
            select: { notes: true },
        });

        // DEBUG: Log incoming tab numbers from memory
        console.log('[PK] openTabNumbers recibidos:', openTabNumbers);
        console.log('[PK] Órdenes en BD encontradas:', orders.map(o => o.notes));

        // Extraer números PK de los notes (patrón "PK-NN")
        const usedNums = new Set<number>();
        for (const o of orders) {
            const m = o.notes?.match(/PK-(\d+)/);
            if (m) usedNums.add(parseInt(m[1], 10));
        }

        // Agregar los tabs abiertos en memoria
        for (const pk of openTabNumbers) {
            const m = pk.match(/PK-(\d+)/);
            if (m) usedNums.add(parseInt(m[1], 10));
        }

        // DEBUG: Log combined set before gap search
        console.log('[PK] usedNums (BD + memoria):', Array.from(usedNums).sort((a, b) => a - b));

        // Encontrar el menor entero positivo no usado (primer hueco)
        let next = 1;
        while (usedNums.has(next)) next++;

        console.log('[PK] nextNumber calculado:', `PK-${next.toString().padStart(2, '0')}`);
        return { success: true, nextNumber: `PK-${next.toString().padStart(2, '0')}` };
    } catch (error) {
        console.error('Error buscando siguiente número PK del día:', error);
        return { success: false, nextNumber: 'PK-01' };
    }
}
