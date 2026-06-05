/**
 * Motor de promociones — happy hour por horario.
 *
 * Función PURA: misma lógica en cliente (UX del POS) y servidor (validación
 * al crear la venta). Sin acceso a BD ni a `now()` implícito: el caller pasa
 * las promos ya cargadas y el instante a evaluar.
 *
 * Reglas:
 *  - Una promo aplica a un item si: está activa, el item entra en su alcance
 *    (categoría/item), y el instante cae dentro de su ventana (día + hora +
 *    rango de fechas), todo en timezone Caracas.
 *  - Si varias promos aplican al mismo item, NO se acumulan: gana la de mayor
 *    `priority`; a igual priority, la de mayor descuento efectivo.
 *  - El descuento nunca deja el precio por debajo de 0.
 */

export type PromotionDiscountType = 'PERCENT' | 'FIXED';

export interface PromotionRule {
    id: string;
    name: string;
    discountType: PromotionDiscountType;
    discountValue: number;
    maxDiscountPerUnit: number | null;
    /** ids de categoría; vacío = sin restricción por categoría */
    applicableCategoryIds: string[];
    /** ids de menu item; vacío = sin restricción por item */
    applicableItemIds: string[];
    /** 0-6 (0=domingo); vacío = todos los días */
    daysOfWeek: number[];
    /** "HH:MM" 24h o null = todo el día */
    startTime: string | null;
    endTime: string | null;
    startDate: Date | null;
    endDate: Date | null;
    priority: number;
    isActive: boolean;
}

export interface ItemForPricing {
    menuItemId: string;
    categoryId: string;
    /** Precio de lista (USD), sin modificadores. */
    basePrice: number;
}

export interface AppliedPromotion {
    promotionId: string;
    promotionName: string;
    /** Precio unitario ya con el descuento aplicado. */
    finalUnitPrice: number;
    /** Descuento por unidad (≥0). */
    discountPerUnit: number;
}

/** Partes de fecha/hora en timezone Caracas, sin librerías externas. */
function caracasParts(at: Date): { weekday: number; minutes: number; ymd: string } {
    // en-US con timeZone Caracas → extraemos componentes de forma estable.
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Caracas',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = fmt.formatToParts(at);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const weekdayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const weekday = weekdayMap[get('weekday')] ?? 0;
    let hour = parseInt(get('hour'), 10);
    if (hour === 24) hour = 0; // hour12:false puede dar "24" a medianoche en algunos motores
    const minute = parseInt(get('minute'), 10);
    const ymd = `${get('year')}-${get('month')}-${get('day')}`;
    return { weekday, minutes: hour * 60 + minute, ymd };
}

function parseHHMM(s: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
}

/** ¿El instante cae dentro de la ventana horaria? Soporta cruce de medianoche. */
function withinTimeWindow(nowMinutes: number, startTime: string | null, endTime: string | null): boolean {
    if (!startTime || !endTime) return true; // todo el día
    const start = parseHHMM(startTime);
    const end = parseHHMM(endTime);
    if (start === null || end === null) return true; // config inválida → no bloquea
    if (start === end) return true;
    if (start < end) {
        // ventana normal dentro del mismo día: [start, end)
        return nowMinutes >= start && nowMinutes < end;
    }
    // cruza medianoche: ej. 22:00–02:00 → [start, 24h) ∪ [0, end)
    return nowMinutes >= start || nowMinutes < end;
}

function withinDateRange(ymd: string, startDate: Date | null, endDate: Date | null): boolean {
    if (startDate) {
        const startYmd = caracasParts(startDate).ymd;
        if (ymd < startYmd) return false;
    }
    if (endDate) {
        const endYmd = caracasParts(endDate).ymd;
        if (ymd > endYmd) return false;
    }
    return true;
}

function scopeMatches(item: ItemForPricing, promo: PromotionRule): boolean {
    const noCat = promo.applicableCategoryIds.length === 0;
    const noItem = promo.applicableItemIds.length === 0;
    if (noCat && noItem) return true; // todo el menú
    if (!noItem && promo.applicableItemIds.includes(item.menuItemId)) return true;
    if (!noCat && promo.applicableCategoryIds.includes(item.categoryId)) return true;
    return false;
}

/** ¿Esta promo aplica a este item en este instante? */
export function promotionApplies(item: ItemForPricing, promo: PromotionRule, at: Date): boolean {
    if (!promo.isActive) return false;
    if (!scopeMatches(item, promo)) return false;
    const { weekday, minutes, ymd } = caracasParts(at);
    if (promo.daysOfWeek.length > 0 && !promo.daysOfWeek.includes(weekday)) return false;
    if (!withinTimeWindow(minutes, promo.startTime, promo.endTime)) return false;
    if (!withinDateRange(ymd, promo.startDate, promo.endDate)) return false;
    return true;
}

/** Descuento por unidad que produce una promo sobre un precio base. */
export function discountPerUnitFor(promo: PromotionRule, basePrice: number): number {
    let d: number;
    if (promo.discountType === 'PERCENT') {
        const pct = Math.max(0, Math.min(100, promo.discountValue));
        d = basePrice * (pct / 100);
        if (promo.maxDiscountPerUnit != null && promo.maxDiscountPerUnit >= 0) {
            d = Math.min(d, promo.maxDiscountPerUnit);
        }
    } else {
        d = Math.max(0, promo.discountValue);
    }
    // nunca por debajo de 0
    d = Math.min(d, basePrice);
    return Math.round(d * 100) / 100;
}

/**
 * Resuelve la mejor promo para un item en un instante dado.
 * Devuelve null si ninguna aplica.
 */
export function resolveBestPromotion(
    item: ItemForPricing,
    promos: PromotionRule[],
    at: Date,
): AppliedPromotion | null {
    let best: { promo: PromotionRule; discount: number } | null = null;
    for (const promo of promos) {
        if (!promotionApplies(item, promo, at)) continue;
        const discount = discountPerUnitFor(promo, item.basePrice);
        if (discount <= 0) continue;
        if (
            !best ||
            promo.priority > best.promo.priority ||
            (promo.priority === best.promo.priority && discount > best.discount)
        ) {
            best = { promo, discount };
        }
    }
    if (!best) return null;
    const finalUnitPrice = Math.round((item.basePrice - best.discount) * 100) / 100;
    return {
        promotionId: best.promo.id,
        promotionName: best.promo.name,
        finalUnitPrice,
        discountPerUnit: best.discount,
    };
}
