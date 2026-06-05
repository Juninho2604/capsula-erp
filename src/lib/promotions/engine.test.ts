import { describe, it, expect } from 'vitest';
import {
    promotionApplies,
    discountPerUnitFor,
    resolveBestPromotion,
    type PromotionRule,
    type ItemForPricing,
} from './engine';

function promo(overrides: Partial<PromotionRule> = {}): PromotionRule {
    return {
        id: 'p1',
        name: 'Happy Hour',
        discountType: 'PERCENT',
        discountValue: 20,
        maxDiscountPerUnit: null,
        applicableCategoryIds: [],
        applicableItemIds: [],
        daysOfWeek: [],
        startTime: null,
        endTime: null,
        startDate: null,
        endDate: null,
        priority: 0,
        isActive: true,
        ...overrides,
    };
}

function item(overrides: Partial<ItemForPricing> = {}): ItemForPricing {
    return { menuItemId: 'm1', categoryId: 'c1', basePrice: 10, ...overrides };
}

// Helper: construye un Date que en Caracas (UTC-4) sea el día/hora dados.
// Caracas no tiene DST, siempre UTC-4. Ej: 18:00 Caracas = 22:00 UTC.
function caracas(dateYmd: string, hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(`${dateYmd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-04:00`);
}

describe('discountPerUnitFor', () => {
    it('PERCENT calcula porcentaje sobre el precio base', () => {
        expect(discountPerUnitFor(promo({ discountType: 'PERCENT', discountValue: 20 }), 10)).toBe(2);
        expect(discountPerUnitFor(promo({ discountType: 'PERCENT', discountValue: 50 }), 8)).toBe(4);
    });

    it('PERCENT respeta el tope maxDiscountPerUnit', () => {
        expect(discountPerUnitFor(promo({ discountType: 'PERCENT', discountValue: 50, maxDiscountPerUnit: 3 }), 20)).toBe(3);
    });

    it('FIXED descuenta monto fijo por unidad', () => {
        expect(discountPerUnitFor(promo({ discountType: 'FIXED', discountValue: 1.5 }), 10)).toBe(1.5);
    });

    it('nunca descuenta más que el precio base', () => {
        expect(discountPerUnitFor(promo({ discountType: 'FIXED', discountValue: 999 }), 10)).toBe(10);
        expect(discountPerUnitFor(promo({ discountType: 'PERCENT', discountValue: 100 }), 10)).toBe(10);
    });

    it('redondea a centavos', () => {
        expect(discountPerUnitFor(promo({ discountType: 'PERCENT', discountValue: 33.33 }), 10)).toBe(3.33);
    });
});

describe('promotionApplies — alcance', () => {
    it('sin restricciones aplica a todo el menú', () => {
        expect(promotionApplies(item(), promo(), caracas('2026-06-05', '12:00'))).toBe(true);
    });

    it('por categoría aplica solo a items de esa categoría', () => {
        const p = promo({ applicableCategoryIds: ['c1'] });
        expect(promotionApplies(item({ categoryId: 'c1' }), p, caracas('2026-06-05', '12:00'))).toBe(true);
        expect(promotionApplies(item({ categoryId: 'c2' }), p, caracas('2026-06-05', '12:00'))).toBe(false);
    });

    it('por item aplica solo a esos items', () => {
        const p = promo({ applicableItemIds: ['m1'] });
        expect(promotionApplies(item({ menuItemId: 'm1' }), p, caracas('2026-06-05', '12:00'))).toBe(true);
        expect(promotionApplies(item({ menuItemId: 'm9' }), p, caracas('2026-06-05', '12:00'))).toBe(false);
    });

    it('item OR categoría (unión)', () => {
        const p = promo({ applicableCategoryIds: ['cX'], applicableItemIds: ['m1'] });
        expect(promotionApplies(item({ menuItemId: 'm1', categoryId: 'c1' }), p, caracas('2026-06-05', '12:00'))).toBe(true);
        expect(promotionApplies(item({ menuItemId: 'm9', categoryId: 'cX' }), p, caracas('2026-06-05', '12:00'))).toBe(true);
        expect(promotionApplies(item({ menuItemId: 'm9', categoryId: 'c9' }), p, caracas('2026-06-05', '12:00'))).toBe(false);
    });

    it('promo inactiva nunca aplica', () => {
        expect(promotionApplies(item(), promo({ isActive: false }), caracas('2026-06-05', '12:00'))).toBe(false);
    });
});

describe('promotionApplies — ventana de tiempo', () => {
    it('ventana horaria normal [17:00, 19:00)', () => {
        const p = promo({ startTime: '17:00', endTime: '19:00' });
        expect(promotionApplies(item(), p, caracas('2026-06-05', '16:59'))).toBe(false);
        expect(promotionApplies(item(), p, caracas('2026-06-05', '17:00'))).toBe(true);
        expect(promotionApplies(item(), p, caracas('2026-06-05', '18:30'))).toBe(true);
        expect(promotionApplies(item(), p, caracas('2026-06-05', '19:00'))).toBe(false);
    });

    it('ventana que cruza medianoche [22:00, 02:00)', () => {
        const p = promo({ startTime: '22:00', endTime: '02:00' });
        expect(promotionApplies(item(), p, caracas('2026-06-05', '23:30'))).toBe(true);
        expect(promotionApplies(item(), p, caracas('2026-06-05', '01:00'))).toBe(true);
        expect(promotionApplies(item(), p, caracas('2026-06-05', '03:00'))).toBe(false);
        expect(promotionApplies(item(), p, caracas('2026-06-05', '21:00'))).toBe(false);
    });

    it('día de la semana: 2026-06-05 es viernes (5)', () => {
        const fri = promo({ daysOfWeek: [5] });
        expect(promotionApplies(item(), fri, caracas('2026-06-05', '12:00'))).toBe(true);
        const mon = promo({ daysOfWeek: [1] });
        expect(promotionApplies(item(), mon, caracas('2026-06-05', '12:00'))).toBe(false);
    });

    it('rango de fechas', () => {
        const p = promo({ startDate: caracas('2026-06-01', '00:00'), endDate: caracas('2026-06-10', '00:00') });
        expect(promotionApplies(item(), p, caracas('2026-06-05', '12:00'))).toBe(true);
        expect(promotionApplies(item(), p, caracas('2026-05-30', '12:00'))).toBe(false);
        expect(promotionApplies(item(), p, caracas('2026-06-15', '12:00'))).toBe(false);
    });
});

describe('resolveBestPromotion', () => {
    it('devuelve null si ninguna aplica', () => {
        const p = promo({ daysOfWeek: [1] }); // lunes
        expect(resolveBestPromotion(item(), [p], caracas('2026-06-05', '12:00'))).toBeNull();
    });

    it('aplica la única promo vigente', () => {
        const r = resolveBestPromotion(item({ basePrice: 10 }), [promo({ discountValue: 20 })], caracas('2026-06-05', '12:00'));
        expect(r).not.toBeNull();
        expect(r!.finalUnitPrice).toBe(8);
        expect(r!.discountPerUnit).toBe(2);
        expect(r!.promotionId).toBe('p1');
    });

    it('a mayor priority gana, aunque descuente menos', () => {
        const lowPriBig = promo({ id: 'big', priority: 0, discountType: 'PERCENT', discountValue: 50 });
        const highPriSmall = promo({ id: 'small', priority: 10, discountType: 'PERCENT', discountValue: 10 });
        const r = resolveBestPromotion(item({ basePrice: 10 }), [lowPriBig, highPriSmall], caracas('2026-06-05', '12:00'));
        expect(r!.promotionId).toBe('small');
        expect(r!.finalUnitPrice).toBe(9);
    });

    it('a igual priority gana el mayor descuento', () => {
        const a = promo({ id: 'a', priority: 5, discountValue: 10 });
        const b = promo({ id: 'b', priority: 5, discountValue: 30 });
        const r = resolveBestPromotion(item({ basePrice: 10 }), [a, b], caracas('2026-06-05', '12:00'));
        expect(r!.promotionId).toBe('b');
        expect(r!.finalUnitPrice).toBe(7);
    });

    it('no acumula descuentos (solo aplica una)', () => {
        const a = promo({ id: 'a', priority: 5, discountValue: 10 });
        const b = promo({ id: 'b', priority: 5, discountValue: 20 });
        const r = resolveBestPromotion(item({ basePrice: 10 }), [a, b], caracas('2026-06-05', '12:00'));
        // 10 - max(1,2) = 8, NO 10 - 1 - 2 = 7
        expect(r!.finalUnitPrice).toBe(8);
    });
});
