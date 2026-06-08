'use server';

/**
 * Server actions de configuración del módulo delivery (Fase 4/4.5):
 *   - Agotados (ItemAvailability)
 *   - Notas del gerente (ManagerNote)
 *   - Reglas de ruteo (RoutingRule)
 *   - Config del tenant (DeliveryTenantConfig)
 *   - Clientes (lectura del historial de DeliveryOrder por teléfono)
 *
 * Estas tres primeras alimentan GET /contexto (mueren las variables manuales
 * del prompt). Aislado del resto del ERP.
 */

import { withTenant } from '@/lib/prisma-tenant-client';
import { deliveryGuard } from '@/lib/delivery/guard';
import { revalidatePath } from 'next/cache';

async function branchesOf(tenantId: string): Promise<{ id: string; name: string }[]> {
    const db = withTenant(tenantId);
    const configs = await db.branchDeliveryConfig.findMany({
        where: { isActive: true },
        include: { branch: { select: { id: true, name: true, isActive: true } } },
    });
    return configs.filter(c => c.branch?.isActive).map(c => ({ id: c.branch!.id, name: c.branch!.name }));
}

// ─── Agotados ────────────────────────────────────────────────────────────────

export interface AgotadoRow {
    id: string;
    branchId: string;
    itemLabel: string;
    available: boolean;
}

export async function listItemAvailabilityAction(): Promise<{
    success: boolean;
    message?: string;
    items: AgotadoRow[];
    branches: { id: string; name: string }[];
}> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message, items: [], branches: [] };
    const db = withTenant(g.tenantId);
    const [items, branches] = await Promise.all([
        db.itemAvailability.findMany({ orderBy: [{ available: 'asc' }, { itemLabel: 'asc' }] }),
        branchesOf(g.tenantId),
    ]);
    return {
        success: true,
        items: items.map(i => ({ id: i.id, branchId: i.branchId, itemLabel: i.itemLabel, available: i.available })),
        branches,
    };
}

export async function upsertItemAvailabilityAction(input: {
    branchId: string;
    itemLabel: string;
    available: boolean;
}): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const itemLabel = input.itemLabel?.trim();
    if (!input.branchId || !itemLabel) {
        return { success: false, message: 'Sede e ítem son obligatorios.' };
    }
    const db = withTenant(g.tenantId);
    const existing = await db.itemAvailability.findFirst({
        where: { branchId: input.branchId, itemLabel },
        select: { id: true },
    });
    if (existing) {
        await db.itemAvailability.update({
            where: { id: existing.id },
            data: { available: input.available, updatedById: g.userId },
        });
    } else {
        await db.itemAvailability.create({
            data: {
                tenantId: g.tenantId,
                branchId: input.branchId,
                itemLabel,
                available: input.available,
                updatedById: g.userId,
            },
        });
    }
    revalidatePath('/dashboard/delivery/agotados');
    return { success: true };
}

export async function deleteItemAvailabilityAction(
    id: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const db = withTenant(g.tenantId);
    const existing = await db.itemAvailability.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, message: 'No encontrado.' };
    await db.itemAvailability.delete({ where: { id } });
    revalidatePath('/dashboard/delivery/agotados');
    return { success: true };
}

// ─── Notas del gerente ───────────────────────────────────────────────────────

export interface NoteRow {
    id: string;
    branchId: string | null;
    text: string;
    isActive: boolean;
    expiresAt: string | null;
}

export async function listManagerNotesAction(): Promise<{
    success: boolean;
    message?: string;
    notes: NoteRow[];
    branches: { id: string; name: string }[];
}> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message, notes: [], branches: [] };
    const db = withTenant(g.tenantId);
    const [notes, branches] = await Promise.all([
        db.managerNote.findMany({ orderBy: { createdAt: 'desc' } }),
        branchesOf(g.tenantId),
    ]);
    return {
        success: true,
        notes: notes.map(n => ({
            id: n.id,
            branchId: n.branchId,
            text: n.text,
            isActive: n.isActive,
            expiresAt: n.expiresAt ? n.expiresAt.toISOString() : null,
        })),
        branches,
    };
}

export async function createManagerNoteAction(input: {
    text: string;
    branchId?: string | null;
    expiresAt?: string | null;
}): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const text = input.text?.trim();
    if (!text) return { success: false, message: 'El texto de la nota es obligatorio.' };
    const db = withTenant(g.tenantId);
    await db.managerNote.create({
        data: {
            tenantId: g.tenantId,
            text,
            branchId: input.branchId || null,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            createdById: g.userId,
        },
    });
    revalidatePath('/dashboard/delivery/instrucciones');
    return { success: true };
}

export async function updateManagerNoteAction(
    id: string,
    patch: { text?: string; branchId?: string | null; isActive?: boolean; expiresAt?: string | null },
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const db = withTenant(g.tenantId);
    const existing = await db.managerNote.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, message: 'Nota no encontrada.' };
    const data: Record<string, unknown> = {};
    if (patch.text !== undefined) data.text = patch.text.trim();
    if (patch.branchId !== undefined) data.branchId = patch.branchId || null;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
    await db.managerNote.update({ where: { id }, data });
    revalidatePath('/dashboard/delivery/instrucciones');
    return { success: true };
}

export async function deleteManagerNoteAction(
    id: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const db = withTenant(g.tenantId);
    const existing = await db.managerNote.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, message: 'Nota no encontrada.' };
    await db.managerNote.delete({ where: { id } });
    revalidatePath('/dashboard/delivery/instrucciones');
    return { success: true };
}

// ─── Reglas de ruteo ─────────────────────────────────────────────────────────

export interface RuleRow {
    id: string;
    matchProduct: string;
    branchId: string;
    priority: number;
    isActive: boolean;
}

export async function listRoutingRulesAction(): Promise<{
    success: boolean;
    message?: string;
    rules: RuleRow[];
    branches: { id: string; name: string }[];
}> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message, rules: [], branches: [] };
    const db = withTenant(g.tenantId);
    const [rules, branches] = await Promise.all([
        db.routingRule.findMany({ orderBy: [{ priority: 'desc' }, { matchProduct: 'asc' }] }),
        branchesOf(g.tenantId),
    ]);
    return {
        success: true,
        rules: rules.map(r => ({
            id: r.id,
            matchProduct: r.matchProduct,
            branchId: r.branchId,
            priority: r.priority,
            isActive: r.isActive,
        })),
        branches,
    };
}

export async function createRoutingRuleAction(input: {
    matchProduct: string;
    branchId: string;
    priority?: number;
}): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const matchProduct = input.matchProduct?.trim();
    if (!matchProduct || !input.branchId) {
        return { success: false, message: 'Producto y sede son obligatorios.' };
    }
    const db = withTenant(g.tenantId);
    await db.routingRule.create({
        data: {
            tenantId: g.tenantId,
            matchProduct,
            branchId: input.branchId,
            priority: input.priority ?? 0,
        },
    });
    revalidatePath('/dashboard/delivery/instrucciones');
    return { success: true };
}

export async function updateRoutingRuleAction(
    id: string,
    patch: { matchProduct?: string; branchId?: string; priority?: number; isActive?: boolean },
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const db = withTenant(g.tenantId);
    const existing = await db.routingRule.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, message: 'Regla no encontrada.' };
    const data: Record<string, unknown> = {};
    if (patch.matchProduct !== undefined) data.matchProduct = patch.matchProduct.trim();
    if (patch.branchId !== undefined) data.branchId = patch.branchId;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    await db.routingRule.update({ where: { id }, data });
    revalidatePath('/dashboard/delivery/instrucciones');
    return { success: true };
}

export async function deleteRoutingRuleAction(
    id: string,
): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    const db = withTenant(g.tenantId);
    const existing = await db.routingRule.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, message: 'Regla no encontrada.' };
    await db.routingRule.delete({ where: { id } });
    revalidatePath('/dashboard/delivery/instrucciones');
    return { success: true };
}

// ─── Config del tenant ───────────────────────────────────────────────────────

export interface DeliveryConfigData {
    correlativePrefix: string;
    validationMode: string;
    webhookUrl: string | null;
    nextCorrelative: number;
}

export async function getDeliveryConfigAction(): Promise<{
    success: boolean;
    message?: string;
    config: DeliveryConfigData;
}> {
    const DEFAULTS: DeliveryConfigData = {
        correlativePrefix: 'PP',
        validationMode: 'MANUAL',
        webhookUrl: null,
        nextCorrelative: 1,
    };
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message, config: DEFAULTS };
    const db = withTenant(g.tenantId);
    const cfg = await db.deliveryTenantConfig.findFirst();
    return {
        success: true,
        config: cfg
            ? {
                  correlativePrefix: cfg.correlativePrefix,
                  validationMode: cfg.validationMode,
                  webhookUrl: cfg.webhookUrl,
                  nextCorrelative: cfg.nextCorrelative,
              }
            : DEFAULTS,
    };
}

export async function updateDeliveryConfigAction(patch: {
    correlativePrefix?: string;
    validationMode?: string;
    webhookUrl?: string | null;
}): Promise<{ success: boolean; message?: string }> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message };
    if (patch.validationMode && !['MANUAL', 'AUTO'].includes(patch.validationMode)) {
        return { success: false, message: 'Modo de validación inválido.' };
    }
    const db = withTenant(g.tenantId);
    const data: Record<string, unknown> = {};
    if (patch.correlativePrefix !== undefined) {
        const p = patch.correlativePrefix.trim().toUpperCase();
        if (!p) return { success: false, message: 'El prefijo no puede quedar vacío.' };
        data.correlativePrefix = p;
    }
    if (patch.validationMode !== undefined) data.validationMode = patch.validationMode;
    if (patch.webhookUrl !== undefined) data.webhookUrl = patch.webhookUrl?.trim() || null;

    const existing = await db.deliveryTenantConfig.findFirst({ select: { id: true } });
    if (existing) {
        await db.deliveryTenantConfig.update({ where: { id: existing.id }, data });
    } else {
        await db.deliveryTenantConfig.create({
            data: { tenantId: g.tenantId, ...(data as { correlativePrefix?: string }) },
        });
    }
    revalidatePath('/dashboard/delivery/config');
    return { success: true };
}

// ─── Clientes (lectura del historial de delivery por teléfono) ───────────────

export interface DeliveryCustomerRow {
    phone: string;
    name: string | null;
    orders: number;
    totalUsd: number;
    lastOrderAt: string;
}

export async function listDeliveryCustomersAction(): Promise<{
    success: boolean;
    message?: string;
    customers: DeliveryCustomerRow[];
}> {
    const g = await deliveryGuard();
    if (!g.ok) return { success: false, message: g.message, customers: [] };
    const db = withTenant(g.tenantId);
    const rows = await db.deliveryOrder.findMany({
        where: { customerPhone: { not: null }, status: { not: 'CANCELADA' } },
        select: { customerPhone: true, customerName: true, totalUsd: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3000,
    });
    const byPhone = new Map<string, DeliveryCustomerRow>();
    for (const r of rows) {
        const phone = r.customerPhone!;
        const cur = byPhone.get(phone);
        if (cur) {
            cur.orders += 1;
            cur.totalUsd += r.totalUsd ?? 0;
            if (!cur.name && r.customerName) cur.name = r.customerName;
        } else {
            byPhone.set(phone, {
                phone,
                name: r.customerName,
                orders: 1,
                totalUsd: r.totalUsd ?? 0,
                lastOrderAt: r.createdAt.toISOString(), // primer row = más reciente (desc)
            });
        }
    }
    const customers = Array.from(byPhone.values()).sort(
        (a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt),
    );
    return { success: true, customers };
}
