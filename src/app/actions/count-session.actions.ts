'use server';

/**
 * Sesiones de conteo de inventario (§138.2) — persistentes y auditables.
 *
 * Reemplaza el borrador en localStorage del Conteo Rápido: la sesión vive en
 * el servidor, cubre N almacenes, se retoma desde cualquier dispositivo (hoy o
 * mañana) y deja rastro de quién contó cada renglón y cuándo.
 *
 * Flujo: OPEN (contando) → REVIEW (revisar diferencias) → APPLIED (stock
 * ajustado). Cancelable en cualquier punto antes de aplicar.
 *
 * Modelos tenant-aware: Area, InventoryItem, InventoryCountSession.
 * NO tenant-aware (FK-scoped por la sesión): InventoryCountSessionArea,
 * InventoryCountEntry, InventoryCountEvent, InventoryLocation,
 * InventoryMovement.
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import {
    buildSessionCode,
    canTransition,
    transitionError,
    computeVariances,
    flagForReview,
    progressByArea,
    type CountSessionStatus,
    type CountEventType,
    type VarianceRow,
} from '@/lib/inventory/count-session';

// La matriz de permisos vive en un solo lugar (§150). Estaba duplicada acá,
// en el registro de módulos y en las dos páginas, y se desincronizaron.
import {
    COUNT_ROLES,
    APPLY_SESSION_ROLES,
    CANCEL_SESSION_ROLES,
} from '@/lib/inventory/count-permissions';

type Result<T = undefined> = {
    success: boolean;
    message: string;
    data?: T;
};

/** Registra un evento de la bitácora. Best-effort: nunca tumba la operación. */
async function logEvent(
    tx: typeof prisma | any,
    sessionId: string,
    type: CountEventType,
    userId: string,
    detail?: string,
): Promise<void> {
    try {
        await tx.inventoryCountEvent.create({
            data: { sessionId, type, userId, detail: detail ?? null },
        });
    } catch (e) {
        console.error('No se pudo registrar el evento de conteo:', e);
    }
}

/**
 * Carga la sesión validando que pertenezca al tenant del request.
 * Devuelve null si no existe o es de otro tenant.
 */
async function loadOwnedSession(sessionId: string) {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    return db.inventoryCountSession.findFirst({
        where: { id: sessionId },
        include: { areas: { orderBy: { sortOrder: 'asc' } } },
    });
}

// ============================================================================
// CREAR
// ============================================================================

export async function createCountSessionAction(input: {
    areaIds: string[];
    name?: string | null;
    blindMode?: boolean;
    notes?: string | null;
}): Promise<Result<{ id: string; code: string }>> {
    const session = await getSession();
    if (!session?.id || !COUNT_ROLES.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }
    const areaIds = Array.from(new Set(input.areaIds.filter(Boolean)));
    if (areaIds.length === 0) {
        return { success: false, message: 'Seleccioná al menos un almacén' };
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // Ownership de todas las áreas antes de crear nada.
    const ownedAreas = await db.area.findMany({
        where: { id: { in: areaIds }, isActive: true },
        select: { id: true },
    });
    if (ownedAreas.length !== areaIds.length) {
        return { success: false, message: 'Uno o más almacenes no existen o están inactivos' };
    }

    try {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const existingThisMonth = await db.inventoryCountSession.count({
            where: { createdAt: { gte: monthStart } },
        });
        const code = buildSessionCode(now, existingThisMonth);

        const created = await db.inventoryCountSession.create({
            data: {
                // La extensión multi-tenant lo inyecta en runtime, pero el tipo
                // generado lo exige — se pasa explícito, igual que WeeklyCount.
                tenantId,
                code,
                name: input.name?.trim() || null,
                status: 'OPEN',
                blindMode: input.blindMode ?? false,
                notes: input.notes?.trim() || null,
                createdById: session.id,
                lastActivityAt: now,
                areas: {
                    create: areaIds.map((areaId, i) => ({ areaId, sortOrder: i })),
                },
            },
            select: { id: true, code: true },
        });

        await logEvent(
            prisma,
            created.id,
            'CREATED',
            session.id,
            `${areaIds.length} almacén(es)${input.blindMode ? ' · a ciegas' : ''}`,
        );

        revalidatePath('/dashboard/inventario/conteo-rapido');
        return { success: true, message: `Conteo ${created.code} abierto`, data: created };
    } catch (e) {
        console.error('Error creando sesión de conteo:', e);
        return { success: false, message: 'Error al abrir el conteo' };
    }
}

// ============================================================================
// LISTAR (para retomar)
// ============================================================================

export type CountSessionListRow = {
    id: string;
    code: string;
    name: string | null;
    status: string;
    blindMode: boolean;
    areaNames: string[];
    createdByName: string;
    createdAt: Date;
    lastActivityAt: Date;
    entryCount: number;
};

export async function listCountSessionsAction(
    includeClosed = false,
): Promise<Result<CountSessionListRow[]>> {
    const session = await getSession();
    if (!session?.id || !COUNT_ROLES.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    try {
        const rows = await db.inventoryCountSession.findMany({
            where: includeClosed ? {} : { status: { in: ['OPEN', 'REVIEW'] } },
            orderBy: { lastActivityAt: 'desc' },
            take: includeClosed ? 50 : 20,
            include: {
                areas: { include: { area: { select: { name: true } } }, orderBy: { sortOrder: 'asc' } },
                createdBy: { select: { firstName: true, lastName: true } },
                _count: { select: { entries: true } },
            },
        });

        return {
            success: true,
            message: 'OK',
            data: rows.map(r => ({
                id: r.id,
                code: r.code,
                name: r.name,
                status: r.status,
                blindMode: r.blindMode,
                areaNames: r.areas.map(a => a.area.name),
                createdByName: `${r.createdBy.firstName} ${r.createdBy.lastName}`.trim(),
                createdAt: r.createdAt,
                lastActivityAt: r.lastActivityAt,
                entryCount: r._count.entries,
            })),
        };
    } catch (e) {
        console.error('Error listando sesiones de conteo:', e);
        return { success: false, message: 'Error cargando los conteos' };
    }
}

// ============================================================================
// ABRIR / RETOMAR
// ============================================================================

export type CountSessionItemRow = {
    inventoryItemId: string;
    sku: string;
    name: string;
    category: string;
    baseUnit: string;
    /** Stock del sistema por área. En modo a ciegas llega vacío. */
    stockByArea: Record<string, number>;
    /** Cantidades ya contadas, por areaId. */
    countedByArea: Record<string, number>;
};

export type CountSessionDetail = {
    id: string;
    code: string;
    name: string | null;
    status: string;
    blindMode: boolean;
    notes: string | null;
    areas: { id: string; name: string }[];
    items: CountSessionItemRow[];
    progress: { areaId: string; counted: number; total: number; pct: number }[];
    /** true si el usuario actual puede aplicar (solo gerencia). */
    canApply: boolean;
    events: { type: string; at: Date; userName: string; detail: string | null }[];
};

export async function getCountSessionAction(
    sessionId: string,
): Promise<Result<CountSessionDetail>> {
    const session = await getSession();
    if (!session?.id || !COUNT_ROLES.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    try {
        const s = await db.inventoryCountSession.findFirst({
            where: { id: sessionId },
            include: {
                areas: { include: { area: { select: { id: true, name: true } } }, orderBy: { sortOrder: 'asc' } },
                events: {
                    orderBy: { at: 'desc' },
                    take: 50,
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
            },
        });
        if (!s) return { success: false, message: 'Conteo no encontrado' };

        const areaIds = s.areas.map(a => a.areaId);

        // Catálogo activo — mismo orden que la hoja impresa.
        const items = await db.inventoryItem.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true, sku: true, name: true, category: true, baseUnit: true },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
        const itemIds = items.map(i => i.id);

        // Stock actual por (item, área). En modo a ciegas NO se envía al
        // cliente: el que cuenta no debe poder "cuadrar" el número.
        const locations = s.blindMode
            ? []
            : await prisma.inventoryLocation.findMany({
                where: { inventoryItemId: { in: itemIds }, areaId: { in: areaIds } },
                select: { inventoryItemId: true, areaId: true, currentStock: true },
            });
        const stockMap = new Map<string, number>();
        for (const l of locations) {
            stockMap.set(`${l.inventoryItemId}::${l.areaId}`, Number(l.currentStock));
        }

        const entries = await prisma.inventoryCountEntry.findMany({
            where: { sessionId },
            select: { inventoryItemId: true, areaId: true, qtyCounted: true },
        });
        const entryMap = new Map<string, number>();
        for (const e of entries) {
            entryMap.set(`${e.inventoryItemId}::${e.areaId}`, e.qtyCounted);
        }

        const rows: CountSessionItemRow[] = items.map(i => {
            const stockByArea: Record<string, number> = {};
            const countedByArea: Record<string, number> = {};
            for (const areaId of areaIds) {
                const k = `${i.id}::${areaId}`;
                if (!s.blindMode) stockByArea[areaId] = stockMap.get(k) ?? 0;
                const counted = entryMap.get(k);
                if (counted !== undefined) countedByArea[areaId] = counted;
            }
            return {
                inventoryItemId: i.id,
                sku: i.sku,
                name: i.name,
                category: i.category || 'Sin categoría',
                baseUnit: i.baseUnit,
                stockByArea,
                countedByArea,
            };
        });

        // Retomar: si alguien abre una sesión que ya tuvo actividad en otro
        // momento, queda registrado. Es la respuesta a "¿quién siguió el conteo?"
        const isResume =
            s.status === 'OPEN' &&
            entries.length > 0 &&
            Date.now() - new Date(s.lastActivityAt).getTime() > 5 * 60 * 1000;
        if (isResume) {
            await logEvent(prisma, sessionId, 'RESUMED', session.id);
            await db.inventoryCountSession.updateMany({
                where: { id: sessionId },
                data: { lastActivityAt: new Date() },
            });
        }

        return {
            success: true,
            message: 'OK',
            data: {
                id: s.id,
                code: s.code,
                name: s.name,
                status: s.status,
                blindMode: s.blindMode,
                notes: s.notes,
                areas: s.areas.map(a => ({ id: a.area.id, name: a.area.name })),
                items: rows,
                progress: progressByArea(entries, areaIds, items.length),
                canApply: APPLY_SESSION_ROLES.includes(session.role),
                events: s.events.map(e => ({
                    type: e.type,
                    at: e.at,
                    userName: `${e.user.firstName} ${e.user.lastName}`.trim(),
                    detail: e.detail,
                })),
            },
        };
    } catch (e) {
        console.error('Error cargando sesión de conteo:', e);
        return { success: false, message: 'Error cargando el conteo' };
    }
}

// ============================================================================
// GUARDAR CANTIDADES
// ============================================================================

/**
 * Guarda (o borra) cantidades contadas. Se llama con lo que cambió, no con
 * todo el catálogo: el cliente manda tandas chicas mientras se tipea.
 *
 * `qty: null` borra la entrada (el operador vació la casilla).
 */
export async function saveCountEntriesAction(input: {
    sessionId: string;
    entries: { inventoryItemId: string; areaId: string; qty: number | null }[];
}): Promise<Result<{ saved: number }>> {
    const session = await getSession();
    if (!session?.id || !COUNT_ROLES.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }
    if (input.entries.length === 0) {
        return { success: true, message: 'Nada que guardar', data: { saved: 0 } };
    }

    const s = await loadOwnedSession(input.sessionId);
    if (!s) return { success: false, message: 'Conteo no encontrado' };
    if (s.status !== 'OPEN') {
        return {
            success: false,
            message: s.status === 'APPLIED'
                ? 'Este conteo ya fue aplicado — no admite cambios.'
                : s.status === 'CANCELLED'
                    ? 'Este conteo fue cancelado.'
                    : 'Este conteo está en revisión. Volvé a abrirlo para seguir contando.',
        };
    }

    const sessionAreaIds = new Set(s.areas.map(a => a.areaId));
    const invalid = input.entries.find(e => !sessionAreaIds.has(e.areaId));
    if (invalid) {
        return { success: false, message: 'Ese almacén no pertenece a este conteo' };
    }

    // Ownership de los items.
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const itemIds = Array.from(new Set(input.entries.map(e => e.inventoryItemId)));
    const owned = await db.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true },
    });
    if (owned.length !== itemIds.length) {
        return { success: false, message: 'Uno o más productos no pertenecen a este tenant' };
    }

    try {
        // Stock del momento — se guarda junto a la cantidad para poder mostrar
        // la diferencia real aunque después haya movimientos.
        const locs = await prisma.inventoryLocation.findMany({
            where: {
                inventoryItemId: { in: itemIds },
                areaId: { in: Array.from(sessionAreaIds) },
            },
            select: { inventoryItemId: true, areaId: true, currentStock: true },
        });
        const stockMap = new Map<string, number>();
        for (const l of locs) {
            stockMap.set(`${l.inventoryItemId}::${l.areaId}`, Number(l.currentStock));
        }

        let saved = 0;
        await prisma.$transaction(async tx => {
            for (const e of input.entries) {
                if (e.qty === null || Number.isNaN(e.qty)) {
                    await tx.inventoryCountEntry.deleteMany({
                        where: {
                            sessionId: input.sessionId,
                            inventoryItemId: e.inventoryItemId,
                            areaId: e.areaId,
                        },
                    });
                    continue;
                }
                const qty = Math.max(0, e.qty);
                const stockAtEntry = stockMap.get(`${e.inventoryItemId}::${e.areaId}`) ?? 0;
                await tx.inventoryCountEntry.upsert({
                    where: {
                        sessionId_inventoryItemId_areaId: {
                            sessionId: input.sessionId,
                            inventoryItemId: e.inventoryItemId,
                            areaId: e.areaId,
                        },
                    },
                    create: {
                        sessionId: input.sessionId,
                        inventoryItemId: e.inventoryItemId,
                        areaId: e.areaId,
                        qtyCounted: qty,
                        stockAtEntry,
                        countedById: session.id,
                    },
                    update: {
                        qtyCounted: qty,
                        stockAtEntry,
                        // Quien corrige queda como autor de la cantidad vigente.
                        countedById: session.id,
                        countedAt: new Date(),
                    },
                });
                saved++;
            }
            await tx.inventoryCountSession.updateMany({
                where: { id: input.sessionId },
                data: { lastActivityAt: new Date() },
            });
        }, { timeout: 30000 });

        return { success: true, message: 'Guardado', data: { saved } };
    } catch (e) {
        console.error('Error guardando cantidades:', e);
        return { success: false, message: 'Error al guardar las cantidades' };
    }
}

// ============================================================================
// REVISIÓN
// ============================================================================

export type ReviewRow = VarianceRow & {
    sku: string;
    name: string;
    baseUnit: string;
    areaName: string;
};

/** Diferencias de la sesión, para la pantalla de revisión previa a aplicar. */
export async function getCountVariancesAction(
    sessionId: string,
): Promise<Result<{ flagged: ReviewRow[]; totalWithVariance: number; totalEntries: number }>> {
    const session = await getSession();
    if (!session?.id || !COUNT_ROLES.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }
    const s = await loadOwnedSession(sessionId);
    if (!s) return { success: false, message: 'Conteo no encontrado' };

    try {
        const entries = await prisma.inventoryCountEntry.findMany({
            where: { sessionId },
            include: {
                inventoryItem: { select: { sku: true, name: true, baseUnit: true } },
            },
        });
        const areaIds = s.areas.map(a => a.areaId);
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const areas = await db.area.findMany({
            where: { id: { in: areaIds } },
            select: { id: true, name: true },
        });
        const areaName = new Map(areas.map(a => [a.id, a.name]));

        // Stock ACTUAL (no el del momento de escribir): es contra esto que se
        // va a ajustar, así que es lo que hay que revisar.
        const locs = await prisma.inventoryLocation.findMany({
            where: {
                inventoryItemId: { in: entries.map(e => e.inventoryItemId) },
                areaId: { in: areaIds },
            },
            select: { inventoryItemId: true, areaId: true, currentStock: true },
        });

        const variances = computeVariances(
            entries.map(e => ({
                inventoryItemId: e.inventoryItemId,
                areaId: e.areaId,
                qtyCounted: e.qtyCounted,
            })),
            locs.map(l => ({
                inventoryItemId: l.inventoryItemId,
                areaId: l.areaId,
                currentStock: Number(l.currentStock),
            })),
        );

        const metaById = new Map(entries.map(e => [e.inventoryItemId, e.inventoryItem]));
        const decorate = (v: VarianceRow): ReviewRow => ({
            ...v,
            sku: metaById.get(v.inventoryItemId)?.sku ?? '',
            name: metaById.get(v.inventoryItemId)?.name ?? '',
            baseUnit: metaById.get(v.inventoryItemId)?.baseUnit ?? '',
            areaName: areaName.get(v.areaId) ?? '—',
        });

        return {
            success: true,
            message: 'OK',
            data: {
                flagged: flagForReview(variances).map(decorate),
                totalWithVariance: variances.filter(v => v.variance !== 0).length,
                totalEntries: variances.length,
            },
        };
    } catch (e) {
        console.error('Error calculando diferencias:', e);
        return { success: false, message: 'Error calculando las diferencias' };
    }
}

/** Cambia el estado de la sesión validando la transición. */
async function transition(
    sessionId: string,
    to: CountSessionStatus,
    eventType: CountEventType,
    allowedRoles: string[],
    detail?: string,
): Promise<Result> {
    const session = await getSession();
    if (!session?.id || !allowedRoles.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }
    const s = await loadOwnedSession(sessionId);
    if (!s) return { success: false, message: 'Conteo no encontrado' };

    const from = s.status as CountSessionStatus;
    if (!canTransition(from, to)) {
        return { success: false, message: transitionError(from, to) };
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const now = new Date();
    await db.inventoryCountSession.updateMany({
        where: { id: sessionId, status: from }, // guardia optimista contra doble clic
        data: {
            status: to,
            lastActivityAt: now,
            ...(to === 'CANCELLED' ? { cancelledById: session.id, cancelledAt: now } : {}),
        },
    });
    await logEvent(prisma, sessionId, eventType, session.id, detail);
    revalidatePath('/dashboard/inventario/conteo-rapido');
    return { success: true, message: 'OK' };
}

export async function sendCountToReviewAction(sessionId: string): Promise<Result> {
    const res = await transition(sessionId, 'REVIEW', 'REVIEW', COUNT_ROLES);
    return res.success ? { ...res, message: 'Conteo listo para revisión' } : res;
}

export async function reopenCountSessionAction(sessionId: string): Promise<Result> {
    const res = await transition(sessionId, 'OPEN', 'REOPENED', COUNT_ROLES);
    return res.success ? { ...res, message: 'Conteo reabierto — podés seguir contando' } : res;
}

export async function cancelCountSessionAction(
    sessionId: string,
    reason?: string,
): Promise<Result> {
    const res = await transition(sessionId, 'CANCELLED', 'CANCELLED', CANCEL_SESSION_ROLES, reason);
    return res.success ? { ...res, message: 'Conteo cancelado' } : res;
}

// ============================================================================
// APLICAR
// ============================================================================

/**
 * Ajusta el stock real y cierra la sesión. Solo gerencia.
 *
 * Genera además el WeeklyCount de siempre (snapshot inmutable) para que el
 * reporte de Variación Semanal siga funcionando sin cambios. Ese modelo solo
 * tiene dos áreas (principal/producción), así que se mapean los dos primeros
 * almacenes; el detalle completo de los N queda en las entradas de la sesión,
 * que son permanentes.
 */
export async function applyCountSessionAction(
    sessionId: string,
): Promise<Result<{ applied: number; weeklyCountNumber: string }>> {
    const session = await getSession();
    if (!session?.id || !APPLY_SESSION_ROLES.includes(session.role)) {
        return {
            success: false,
            message: 'Solo gerencia puede aplicar un conteo y ajustar el inventario.',
        };
    }

    const s = await loadOwnedSession(sessionId);
    if (!s) return { success: false, message: 'Conteo no encontrado' };
    const from = s.status as CountSessionStatus;
    if (!canTransition(from, 'APPLIED')) {
        return { success: false, message: transitionError(from, 'APPLIED') };
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    const areaIds = s.areas.map(a => a.areaId);

    const entries = await prisma.inventoryCountEntry.findMany({
        where: { sessionId },
        select: { inventoryItemId: true, areaId: true, qtyCounted: true },
    });
    if (entries.length === 0) {
        return { success: false, message: 'El conteo no tiene cantidades cargadas' };
    }

    const userId = session.id;
    const reason = `Conteo físico ${s.code}`;

    try {
        let applied = 0;
        let weeklyCountNumber = '';

        await prisma.$transaction(async tx => {
            // Guardia contra doble aplicación: si otro ya lo aplicó entre el
            // chequeo y acá, este update afecta 0 filas y abortamos.
            const claimed = await tx.inventoryCountSession.updateMany({
                where: { id: sessionId, status: from },
                data: { status: 'APPLIED', appliedById: userId, appliedAt: new Date(), lastActivityAt: new Date() },
            });
            if (claimed.count === 0) {
                throw new Error('El conteo ya fue aplicado por otra persona');
            }

            const itemIds = Array.from(new Set(entries.map(e => e.inventoryItemId)));
            const metas = await tx.inventoryItem.findMany({
                where: { id: { in: itemIds } },
                select: { id: true, sku: true, name: true, category: true, baseUnit: true },
            });
            const metaById = new Map(metas.map(m => [m.id, m]));

            const locs = await tx.inventoryLocation.findMany({
                where: { inventoryItemId: { in: itemIds }, areaId: { in: areaIds } },
                select: { inventoryItemId: true, areaId: true, currentStock: true },
            });
            const stockBefore = new Map<string, number>();
            for (const l of locs) {
                stockBefore.set(`${l.inventoryItemId}::${l.areaId}`, Number(l.currentStock));
            }

            // ── Snapshot legacy (WeeklyCount) — mantiene vivos los reportes.
            const now = new Date();
            weeklyCountNumber = await generateWeeklyCountNumberForSession(tx, tenantId, now);
            const principalAreaId = areaIds[0];
            const productionAreaId = areaIds[1] ?? null;
            const qtyOf = (itemId: string, areaId: string | null) =>
                areaId === null
                    ? null
                    : entries.find(e => e.inventoryItemId === itemId && e.areaId === areaId)?.qtyCounted ?? 0;

            const wc = await tx.weeklyCount.create({
                data: {
                    countNumber: weeklyCountNumber,
                    countDate: now,
                    principalAreaId,
                    productionAreaId,
                    status: 'APPLIED',
                    notes: s.notes ?? `Sesión ${s.code}`,
                    createdById: userId,
                    appliedAt: now,
                    tenantId,
                    items: {
                        create: itemIds.map(itemId => {
                            const meta = metaById.get(itemId);
                            const beforeP = stockBefore.get(`${itemId}::${principalAreaId}`) ?? 0;
                            const qtyP = qtyOf(itemId, principalAreaId) ?? 0;
                            const beforeProd = productionAreaId
                                ? stockBefore.get(`${itemId}::${productionAreaId}`) ?? 0
                                : null;
                            const qtyProd = qtyOf(itemId, productionAreaId);
                            return {
                                inventoryItemId: itemId,
                                sku: meta?.sku ?? '',
                                name: meta?.name ?? '',
                                category: meta?.category ?? null,
                                baseUnit: meta?.baseUnit ?? 'UNIT',
                                stockBeforePrincipal: beforeP,
                                qtyCountedPrincipal: qtyP,
                                variancePrincipal: qtyP - beforeP,
                                stockBeforeProduction: beforeProd,
                                qtyCountedProduction: qtyProd,
                                varianceProduction:
                                    beforeProd !== null && qtyProd !== null ? qtyProd - beforeProd : null,
                            };
                        }),
                    },
                },
                select: { id: true },
            });

            await tx.inventoryCountSession.updateMany({
                where: { id: sessionId },
                data: { weeklyCountId: wc.id },
            });

            // ── Ajuste real del stock, para los N almacenes.
            for (const e of entries) {
                const old = stockBefore.get(`${e.inventoryItemId}::${e.areaId}`) ?? 0;
                const target = Math.max(0, e.qtyCounted);
                const delta = target - old;

                if (Math.abs(delta) > 0.000001) {
                    await tx.inventoryMovement.create({
                        data: {
                            inventoryItemId: e.inventoryItemId,
                            movementType: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                            quantity: Math.abs(delta),
                            unit: 'UNIT',
                            reason: `${reason} (${weeklyCountNumber})`,
                            notes: `Ajuste a conteo físico. Anterior: ${old.toFixed(4)} → ${target.toFixed(4)}`,
                            createdById: userId,
                            areaId: e.areaId,
                        },
                    });
                }

                await tx.inventoryLocation.upsert({
                    where: {
                        inventoryItemId_areaId: {
                            inventoryItemId: e.inventoryItemId,
                            areaId: e.areaId,
                        },
                    },
                    create: {
                        inventoryItemId: e.inventoryItemId,
                        areaId: e.areaId,
                        currentStock: target,
                        lastCountDate: now,
                    },
                    update: { currentStock: target, lastCountDate: now },
                });
                applied++;
            }
        }, { timeout: 120000 });

        await logEvent(prisma, sessionId, 'APPLIED', userId, `${applied} ubicaciones · ${weeklyCountNumber}`);

        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/inventario/conteo-rapido');
        revalidatePath('/dashboard/reportes/variacion-semanal');
        revalidatePath('/dashboard');

        return {
            success: true,
            message: `Stock actualizado (${applied} ubicaciones). Conteo ${weeklyCountNumber} registrado.`,
            data: { applied, weeklyCountNumber },
        };
    } catch (e) {
        console.error('Error aplicando conteo:', e);
        return {
            success: false,
            message: e instanceof Error ? e.message : 'Error al aplicar el conteo',
        };
    }
}

/** Correlativo ISO-week del WeeklyCount, igual que el flujo legacy. */
async function generateWeeklyCountNumberForSession(
    tx: any,
    tenantId: string,
    countDate: Date,
): Promise<string> {
    const d = new Date(Date.UTC(countDate.getFullYear(), countDate.getMonth(), countDate.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const prefix = `INV-${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}-`;

    const last = await tx.weeklyCount.findFirst({
        where: { tenantId, countNumber: { startsWith: prefix } },
        orderBy: { countNumber: 'desc' },
        select: { countNumber: true },
    });
    let seq = 1;
    if (last?.countNumber) {
        const tail = parseInt(last.countNumber.slice(prefix.length), 10);
        if (Number.isFinite(tail)) seq = tail + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
}
