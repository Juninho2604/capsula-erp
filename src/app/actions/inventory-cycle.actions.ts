'use server';

/**
 * INVENTORY CYCLE ACTIONS — multitenant (Lote 4.a — Fase 3 Paso D.b).
 *
 * Conteo Físico Semanal / Mensual de inventario.
 *
 * Modelos tenant-aware: InventoryCycle, InventoryItem.
 * Modelos NO tenant-aware: InventoryCycleSnapshot, InventoryLocation,
 * InventoryMovement — su scope viene de FKs a Cycle / Item / Area.
 * Por eso validamos ownership de los IDs upstream antes de tocar pivotes.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CycleWithSnapshots = Awaited<ReturnType<typeof getCycleById>>;

export type SnapshotInput = {
    inventoryItemId: string;
    areaId: string;
    countedStock: number;
    systemStock: number;
    unit: string;
    costSnapshot?: number;
    notes?: string;
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getCycles(filters?: { status?: string; cycleType?: string }) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    return db.inventoryCycle.findMany({
        where: {
            ...(filters?.status    && { status: filters.status }),
            ...(filters?.cycleType && { cycleType: filters.cycleType }),
        },
        include: { _count: { select: { snapshots: true } } },
        orderBy: { startedAt: 'desc' },
    });
}

export async function getCycleById(id: string) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    // findUnique no se filtra por la extension; findFirst con db aplica el filtro.
    return db.inventoryCycle.findFirst({
        where: { id },
        include: {
            snapshots: {
                include: { inventoryItem: { select: { id: true, sku: true, name: true, baseUnit: true } } },
            },
        },
    });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function openCycle(data: {
    name: string;
    cycleType?: string;
    areaIds: string[];
    notes?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) {
        throw new Error('Sin permiso para abrir un ciclo de conteo');
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    const count = await db.inventoryCycle.count();
    const year  = new Date().getFullYear();
    const week  = Math.ceil((new Date().getDate()) / 7); // rough week number
    const code  = `CYCLE-${year}-W${String(week).padStart(2, '0')}-${count + 1}`;

    const cycle = await db.inventoryCycle.create({
        data: {
            tenantId,
            code,
            name: data.name,
            cycleType: data.cycleType ?? 'WEEKLY',
            areaIds: JSON.stringify(data.areaIds),
            status: 'OPEN',
            notes: data.notes,
            createdById: session.id,
        },
    });

    revalidatePath('/dashboard/inventario/conteo-semanal');
    return { ok: true, cycle };
}

export async function saveSnapshots(cycleId: string, snapshots: SnapshotInput[]) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // Validar ownership del ciclo antes de tocar snapshots.
    const ownedCycle = await db.inventoryCycle.findFirst({
        where: { id: cycleId },
        select: { id: true },
    });
    if (!ownedCycle) throw new Error('Ciclo no encontrado');

    // Validar que cada inventoryItemId pertenece al tenant.
    const itemIds = Array.from(new Set(snapshots.map(s => s.inventoryItemId)));
    const ownedItems = await db.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true },
    });
    if (ownedItems.length !== itemIds.length) {
        throw new Error('Uno o más items no pertenecen a este tenant');
    }

    // Validar ownership de cada areaId.
    const areaIds = Array.from(new Set(snapshots.map(s => s.areaId)));
    const ownedAreas = await db.area.findMany({
        where: { id: { in: areaIds } },
        select: { id: true },
    });
    if (ownedAreas.length !== areaIds.length) {
        throw new Error('Una o más áreas no pertenecen a este tenant');
    }

    // Upsert each snapshot (InventoryCycleSnapshot no es tenant-aware; FK valida).
    await Promise.all(
        snapshots.map(s =>
            prisma.inventoryCycleSnapshot.upsert({
                where: {
                    cycleId_inventoryItemId_areaId: {
                        cycleId,
                        inventoryItemId: s.inventoryItemId,
                        areaId: s.areaId,
                    },
                },
                create: {
                    cycleId,
                    ...s,
                    difference: s.countedStock - s.systemStock,
                    countedById: session.id,
                },
                update: {
                    countedStock: s.countedStock,
                    systemStock: s.systemStock,
                    difference: s.countedStock - s.systemStock,
                    notes: s.notes,
                    countedById: session.id,
                    countedAt: new Date(),
                },
            })
        )
    );

    // Mark cycle as IN_PROGRESS if it was OPEN
    await db.inventoryCycle.updateMany({
        where: { id: cycleId, status: 'OPEN' },
        data: { status: 'IN_PROGRESS' },
    });

    revalidatePath('/dashboard/inventario/conteo-semanal');
    return { ok: true };
}

export async function closeCycle(id: string) {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');
    if (!['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'].includes(session.role)) {
        throw new Error('Sin permiso para cerrar un ciclo de conteo');
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // findUniqueOrThrow no se filtra por la extension; findFirst + throw manual.
    const cycle = await db.inventoryCycle.findFirst({
        where: { id },
        include: {
            snapshots: {
                include: { inventoryItem: true },
            },
        },
    });
    if (!cycle) throw new Error('Ciclo no encontrado');

    if (cycle.status === 'CLOSED') {
        throw new Error('El ciclo ya está cerrado');
    }

    // Generar InventoryMovements de ajuste por cada snapshot con diferencia ≠ 0
    // Se ejecuta todo en una transacción para garantizar atomicidad.
    // InventoryLocation y InventoryMovement no son tenant-aware; el scope viene
    // de inventoryItemId / areaId, que ya pertenecen al cycle (tenant-owned).
    await prisma.$transaction(async tx => {
        const adjustments: Array<{
            inventoryItemId: string;
            movementType: string;
            quantity: number;
            unit: string;
            reason: string;
            areaId: string;
            createdById: string;
        }> = [];

        for (const snap of cycle.snapshots) {
            if (Math.abs(snap.difference) < 0.001) continue; // sin diferencia significativa

            const movementType = snap.difference > 0
                ? 'ADJUSTMENT_IN'
                : 'ADJUSTMENT_OUT';

            adjustments.push({
                inventoryItemId: snap.inventoryItemId,
                movementType,
                quantity: Math.abs(snap.difference),
                unit: snap.unit,
                reason: `Ajuste ciclo conteo ${cycle.code} — ${snap.inventoryItem.name} (contado: ${snap.countedStock}, sistema: ${snap.systemStock})`,
                areaId: snap.areaId,
                createdById: session.id,
            });

            // Actualizar stock en InventoryLocation
            await tx.inventoryLocation.upsert({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: snap.inventoryItemId,
                        areaId: snap.areaId,
                    },
                },
                update: { currentStock: snap.countedStock, lastCountDate: new Date() },
                create: {
                    inventoryItemId: snap.inventoryItemId,
                    areaId: snap.areaId,
                    currentStock: snap.countedStock,
                    lastCountDate: new Date(),
                },
            });
        }

        // Crear todos los movimientos de ajuste
        if (adjustments.length > 0) {
            await tx.inventoryMovement.createMany({
                data: adjustments.map(a => ({
                    ...a,
                    createdAt: new Date(),
                    notes: `Ciclo: ${cycle.code}`,
                })),
            });
        }

        // Cerrar el ciclo (updateMany para que el tenantId filtre).
        await tx.inventoryCycle.updateMany({
            where: { id, tenantId },
            data: { status: 'CLOSED', closedAt: new Date(), closedById: session.id },
        });
    });

    revalidatePath('/dashboard/inventario/conteo-semanal');
    revalidatePath('/dashboard/inventario');
    return { ok: true, adjustmentsGenerated: cycle.snapshots.filter(s => Math.abs(s.difference) >= 0.001).length };
}
