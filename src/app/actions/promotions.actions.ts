'use server';

/**
 * Promociones — happy hour por horario (multitenant).
 *
 * CRUD admin (gated por rol gerencial) + lectura ligera para el POS.
 * El cálculo de precios vive en `src/lib/promotions/engine.ts` (puro).
 *
 * Para `update`/`delete({ where: { id } })` usamos `updateMany({ where: { id,
 * tenantId } })` por la limitación documentada en `prisma-tenant-client.ts`.
 */

import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { revalidatePath } from 'next/cache';
import type { PromotionRule, PromotionDiscountType } from '@/lib/promotions/engine';

const MANAGER_ROLES = new Set(['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER']);

function canManagePromotions(role: string | undefined): boolean {
    return !!role && MANAGER_ROLES.has(role);
}

export interface PromotionDTO {
    id: string;
    name: string;
    description: string | null;
    discountType: PromotionDiscountType;
    discountValue: number;
    maxDiscountPerUnit: number | null;
    applicableCategoryIds: string[];
    applicableItemIds: string[];
    daysOfWeek: number[];
    startTime: string | null;
    endTime: string | null;
    startDate: string | null; // ISO o null
    endDate: string | null;
    priority: number;
    isActive: boolean;
}

export interface PromotionInput {
    name: string;
    description?: string | null;
    discountType: PromotionDiscountType;
    discountValue: number;
    maxDiscountPerUnit?: number | null;
    applicableCategoryIds?: string[];
    applicableItemIds?: string[];
    daysOfWeek?: number[];
    startTime?: string | null;
    endTime?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    priority?: number;
    isActive?: boolean;
}

function parseJsonArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.map(String) : [];
    } catch {
        return [];
    }
}

function parseNumArray(raw: string | null | undefined): number[] {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.map(Number).filter(n => Number.isFinite(n)) : [];
    } catch {
        return [];
    }
}

type PromoRow = {
    id: string;
    name: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    maxDiscountPerUnit: number | null;
    applicableCategoryIds: string | null;
    applicableItemIds: string | null;
    daysOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    startDate: Date | null;
    endDate: Date | null;
    priority: number;
    isActive: boolean;
};

function rowToDTO(p: PromoRow): PromotionDTO {
    return {
        id: p.id,
        name: p.name,
        description: p.description,
        discountType: p.discountType === 'FIXED' ? 'FIXED' : 'PERCENT',
        discountValue: p.discountValue,
        maxDiscountPerUnit: p.maxDiscountPerUnit,
        applicableCategoryIds: parseJsonArray(p.applicableCategoryIds),
        applicableItemIds: parseJsonArray(p.applicableItemIds),
        daysOfWeek: parseNumArray(p.daysOfWeek),
        startTime: p.startTime,
        endTime: p.endTime,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        endDate: p.endDate ? p.endDate.toISOString() : null,
        priority: p.priority,
        isActive: p.isActive,
    };
}

function validateInput(input: PromotionInput): string | null {
    if (!input.name?.trim()) return 'El nombre es obligatorio.';
    if (input.discountType !== 'PERCENT' && input.discountType !== 'FIXED') return 'Tipo de descuento inválido.';
    if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) return 'El descuento debe ser mayor a 0.';
    if (input.discountType === 'PERCENT' && input.discountValue > 100) return 'El porcentaje no puede superar 100%.';
    if (input.maxDiscountPerUnit != null && (!Number.isFinite(input.maxDiscountPerUnit) || input.maxDiscountPerUnit < 0)) {
        return 'El tope de descuento debe ser un número ≥ 0.';
    }
    const re = /^(\d{1,2}):(\d{2})$/;
    if (input.startTime && !re.test(input.startTime)) return 'Hora de inicio inválida (HH:MM).';
    if (input.endTime && !re.test(input.endTime)) return 'Hora de fin inválida (HH:MM).';
    if ((input.startTime && !input.endTime) || (!input.startTime && input.endTime)) {
        return 'Indicá hora de inicio Y fin, o ninguna (todo el día).';
    }
    // Días de la semana válidos (0-6, 0=domingo).
    if (input.daysOfWeek && input.daysOfWeek.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
        return 'Días de la semana inválidos.';
    }
    // Rango de fechas coherente — sin esto la promo "muere" en silencio.
    if (input.startDate && input.endDate) {
        const s = new Date(input.startDate).getTime();
        const e = new Date(input.endDate).getTime();
        if (Number.isFinite(s) && Number.isFinite(e) && s > e) {
            return 'La fecha de inicio no puede ser posterior a la de fin.';
        }
    }
    return null;
}

function inputToData(input: PromotionInput) {
    return {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxDiscountPerUnit: input.maxDiscountPerUnit ?? null,
        applicableCategoryIds: JSON.stringify(input.applicableCategoryIds ?? []),
        applicableItemIds: JSON.stringify(input.applicableItemIds ?? []),
        daysOfWeek: JSON.stringify(input.daysOfWeek ?? []),
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        priority: input.priority ?? 0,
        isActive: input.isActive ?? true,
    };
}

// ── LECTURA (admin) ───────────────────────────────────────────────────────────

export async function getPromotionsAction(): Promise<{ success: boolean; data?: PromotionDTO[]; message?: string }> {
    const session = await getSession();
    if (!canManagePromotions(session?.role)) return { success: false, message: 'Sin permisos para ver promociones.' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const promos = await db.promotion.findMany({
            where: { deletedAt: null },
            orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
        });
        return { success: true, data: promos.map(p => rowToDTO(p as PromoRow)) };
    } catch (error) {
        console.error('[promotions] getPromotionsAction:', error);
        return { success: false, message: 'Error al cargar promociones.' };
    }
}

// ── LECTURA (POS, ligera) ──────────────────────────────────────────────────────

/**
 * Promos activas para el POS. Devuelve `enabled` según el flag tenant
 * `promotionsEnabled`: si está apagado, el POS no aplica nada. Las reglas
 * vienen en el shape exacto que consume el motor (PromotionRule), pero con
 * fechas serializadas (el cliente las rehidrata).
 */
export async function getActivePromotionsForPOSAction(): Promise<{
    enabled: boolean;
    promotions: PromotionDTO[];
}> {
    const session = await getSession();
    if (!session) return { enabled: false, promotions: [] };
    const { tenantId } = await resolveTenantContext();
    const enabled = await tenantFeatureEnabled(tenantId, 'promotionsEnabled');
    if (!enabled) return { enabled: false, promotions: [] };
    const db = withTenant(tenantId);
    const promos = await db.promotion.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { priority: 'desc' },
    });
    return { enabled: true, promotions: promos.map(p => rowToDTO(p as PromoRow)) };
}

// ── ESCRITURA (admin) ──────────────────────────────────────────────────────────

export async function createPromotionAction(input: PromotionInput): Promise<{ success: boolean; message?: string; id?: string }> {
    const session = await getSession();
    if (!canManagePromotions(session?.role)) return { success: false, message: 'Sin permisos.' };
    const err = validateInput(input);
    if (err) return { success: false, message: err };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const created = await db.promotion.create({ data: { tenantId, ...inputToData(input) } });
        revalidatePath('/dashboard/promociones');
        return { success: true, id: created.id };
    } catch (error) {
        console.error('[promotions] createPromotionAction:', error);
        return { success: false, message: 'Error al crear la promoción.' };
    }
}

export async function updatePromotionAction(id: string, input: PromotionInput): Promise<{ success: boolean; message?: string }> {
    const session = await getSession();
    if (!canManagePromotions(session?.role)) return { success: false, message: 'Sin permisos.' };
    const err = validateInput(input);
    if (err) return { success: false, message: err };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const res = await db.promotion.updateMany({ where: { id, tenantId }, data: inputToData(input) });
        if (res.count === 0) return { success: false, message: 'Promoción no encontrada.' };
        revalidatePath('/dashboard/promociones');
        return { success: true };
    } catch (error) {
        console.error('[promotions] updatePromotionAction:', error);
        return { success: false, message: 'Error al actualizar la promoción.' };
    }
}

export async function togglePromotionAction(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
    const session = await getSession();
    if (!canManagePromotions(session?.role)) return { success: false, message: 'Sin permisos.' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const res = await db.promotion.updateMany({ where: { id, tenantId }, data: { isActive } });
        if (res.count === 0) return { success: false, message: 'Promoción no encontrada.' };
        revalidatePath('/dashboard/promociones');
        return { success: true };
    } catch (error) {
        console.error('[promotions] togglePromotionAction:', error);
        return { success: false, message: 'Error al cambiar el estado.' };
    }
}

export async function deletePromotionAction(id: string): Promise<{ success: boolean; message?: string }> {
    const session = await getSession();
    if (!canManagePromotions(session?.role)) return { success: false, message: 'Sin permisos.' };
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const res = await db.promotion.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date(), isActive: false } });
        if (res.count === 0) return { success: false, message: 'Promoción no encontrada.' };
        revalidatePath('/dashboard/promociones');
        return { success: true };
    } catch (error) {
        console.error('[promotions] deletePromotionAction:', error);
        return { success: false, message: 'Error al eliminar la promoción.' };
    }
}
