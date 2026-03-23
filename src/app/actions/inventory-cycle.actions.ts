'use server';

/**
 * INVENTORY CYCLE ACTIONS (Conteo Físico Semanal / Mensual)
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión de ciclos de conteo físico de inventario.
 *
 * TODO: Copiar/adaptar la lógica de Table-Pong repo si existía,
 *       o implementar desde cero basándose en los modelos:
 *         InventoryCycle, InventoryCycleSnapshot
 *
 * Funciones a implementar:
 *   getCycles(filters)             — listar ciclos con paginación
 *   getCycleById(id)               — detalle de un ciclo + snapshots
 *   openCycle(data)                — abrir nuevo ciclo de conteo
 *   saveSnapshot(cycleId, items)   — guardar conteo parcial o final
 *   closeCycle(id)                 — cerrar ciclo y generar ajustes de inventario
 *   cancelCycle(id)                — cancelar ciclo sin aplicar cambios
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

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

    return prisma.inventoryCycle.findMany({
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

    return prisma.inventoryCycle.findUnique({
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

    const count = await prisma.inventoryCycle.count();
    const year  = new Date().getFullYear();
    const week  = Math.ceil((new Date().getDate()) / 7); // rough week number
    const code  = `CYCLE-${year}-W${String(week).padStart(2, '0')}-${count + 1}`;

    const cycle = await prisma.inventoryCycle.create({
        data: {
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

    // Upsert each snapshot
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
    await prisma.inventoryCycle.updateMany({
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

    const cycle = await prisma.inventoryCycle.findUniqueOrThrow({
        where: { id },
        include: {
            snapshots: {
                include: { inventoryItem: true },
            },
        },
    });

    if (cycle.status === 'CLOSED') {
        throw new Error('El ciclo ya está cerrado');
    }

    // Generar InventoryMovements de ajuste por cada snapshot con diferencia ≠ 0
    // Se ejecuta todo en una transacción para garantizar atomicidad
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

        // Cerrar el ciclo
        await tx.inventoryCycle.update({
            where: { id },
            data: { status: 'CLOSED', closedAt: new Date(), closedById: session.id },
        });
    });

    revalidatePath('/dashboard/inventario/conteo-semanal');
    revalidatePath('/dashboard/inventario');
    return { ok: true, adjustmentsGenerated: cycle.snapshots.filter(s => Math.abs(s.difference) >= 0.001).length };
}
