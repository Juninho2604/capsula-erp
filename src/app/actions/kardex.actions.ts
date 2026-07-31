'use server';

/**
 * Kardex por producto (§145) — solo lectura.
 *
 * Responde el reclamo del chef ("cargué 39 de masa filo y aparecen 42"):
 * muestra cada movimiento con su saldo corrido, y CONCILIA la suma de toda
 * la historia de movimientos contra el stock actual — si no cuadran, el
 * descuadre se muestra explícito en vez de dejarlo a la adivinanza.
 *
 * Modelos tenant-aware: InventoryItem, Area. NO tenant-aware (FK-scoped):
 * InventoryMovement, InventoryLocation.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import {
    computeRunningBalances,
    movementDelta,
    reconcile,
    round4,
} from '@/lib/inventory/kardex';

const KARDEX_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'];

export interface KardexMovementRow {
    id: string;
    createdAt: Date;
    movementType: string;
    direction: 'IN' | 'OUT' | 'UNKNOWN';
    qtyIn: number;
    qtyOut: number;
    balanceAfter: number;
    unit: string;
    areaName: string | null;
    /** Referencia legible: orden de venta, razón o nota del movimiento. */
    reference: string;
    createdByName: string;
}

export interface KardexResult {
    item: { id: string; name: string; sku: string; baseUnit: string };
    /** Stock vigente por almacén + total. */
    stockByArea: { areaId: string; areaName: string; currentStock: number }[];
    totalStock: number;
    /** Ámbito del saldo corrido: nombre del almacén o null (global). */
    scopeAreaName: string | null;
    rows: KardexMovementRow[];
    /** Saldo antes del movimiento más antiguo mostrado. */
    openingBalance: number;
    /** Movimientos del rango sin almacén asignado (solo aviso en modo por-almacén). */
    excludedNoArea: number;
    /** Conciliación de TODA la historia contra el stock actual del ámbito. */
    reconciliation: {
        totalMovements: number;
        sumAllDeltas: number;
        unexplained: number;
        hasDiscrepancy: boolean;
    };
}

export async function getItemKardexAction(input: {
    inventoryItemId: string;
    /** Almacén específico, o null/undefined = global (todas las áreas). */
    areaId?: string | null;
    /** Días hacia atrás a mostrar (default 30, máx 365). */
    days?: number;
}): Promise<{ success: boolean; message?: string; data?: KardexResult }> {
    const session = await getSession();
    if (!session?.id || !KARDEX_ROLES.includes(session.role)) {
        return { success: false, message: 'No autorizado' };
    }

    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        const item = await db.inventoryItem.findFirst({
            where: { id: input.inventoryItemId },
            select: { id: true, name: true, sku: true, baseUnit: true },
        });
        if (!item) return { success: false, message: 'Producto no encontrado' };

        // Ownership del área si se filtra por una.
        const areaId = input.areaId || null;
        if (areaId) {
            const owned = await db.area.findFirst({ where: { id: areaId }, select: { id: true } });
            if (!owned) return { success: false, message: 'Almacén no encontrado' };
        }

        const days = Math.min(Math.max(input.days ?? 30, 1), 365);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Stock vigente por almacén (con nombre) — el encabezado del Kardex.
        const locations = await prisma.inventoryLocation.findMany({
            where: { inventoryItemId: item.id },
            include: { area: { select: { id: true, name: true } } },
        });
        const stockByArea = locations
            .map(l => ({
                areaId: l.area.id,
                areaName: l.area.name,
                currentStock: round4(Number(l.currentStock)),
            }))
            .sort((a, b) => a.areaName.localeCompare(b.areaName));
        const totalStock = round4(stockByArea.reduce((s, a) => s + a.currentStock, 0));

        // Ámbito del saldo corrido: un almacén o el global.
        const scopeStock = areaId
            ? stockByArea.find(a => a.areaId === areaId)?.currentStock ?? 0
            : totalStock;
        const scopeAreaName = areaId
            ? stockByArea.find(a => a.areaId === areaId)?.areaName ?? '—'
            : null;

        // Movimientos del rango, del más nuevo al más viejo (orden del Kardex).
        // En modo por-almacén los movimientos sin areaId no se pueden atribuir
        // → quedan fuera y se AVISA cuántos son (el saldo corrido pierde
        // exactitud si hay muchos; el modo global no sufre esto).
        const movements = await prisma.inventoryMovement.findMany({
            where: {
                inventoryItemId: item.id,
                createdAt: { gte: since },
                ...(areaId ? { areaId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
            include: {
                area: { select: { name: true } },
                createdBy: { select: { firstName: true, lastName: true } },
                salesOrder: { select: { orderNumber: true } },
            },
        });

        let excludedNoArea = 0;
        if (areaId) {
            excludedNoArea = await prisma.inventoryMovement.count({
                where: { inventoryItemId: item.id, createdAt: { gte: since }, areaId: null },
            });
        }

        const { rows: balRows, openingBalance } = computeRunningBalances(
            movements.map(m => ({
                id: m.id,
                movementType: m.movementType,
                quantity: Number(m.quantity),
                createdAt: m.createdAt,
            })),
            scopeStock,
        );
        const byId = new Map(movements.map(m => [m.id, m]));

        const rows: KardexMovementRow[] = balRows.map(r => {
            const m = byId.get(r.movement.id)!;
            const refParts = [
                m.salesOrder?.orderNumber,
                m.referenceNumber,
                m.reason,
                m.notes,
            ].filter(Boolean);
            return {
                id: m.id,
                createdAt: m.createdAt,
                movementType: m.movementType,
                direction: r.direction,
                qtyIn: r.qtyIn,
                qtyOut: r.qtyOut,
                balanceAfter: r.balanceAfter,
                unit: m.unit,
                areaName: m.area?.name ?? null,
                reference: refParts.join(' · ').slice(0, 220),
                createdByName: `${m.createdBy.firstName} ${m.createdBy.lastName}`.trim(),
            };
        });

        // Conciliación de TODA la historia (no solo el rango): trae tipo y
        // cantidad de todos los movimientos del ámbito y suma los deltas.
        const allMovs = await prisma.inventoryMovement.findMany({
            where: { inventoryItemId: item.id, ...(areaId ? { areaId } : {}) },
            select: { movementType: true, quantity: true },
        });
        const sumAllDeltas = round4(
            allMovs.reduce((s, m) => s + movementDelta(m.movementType, Number(m.quantity)), 0),
        );
        const rec = reconcile(scopeStock, sumAllDeltas);

        return {
            success: true,
            data: {
                item,
                stockByArea,
                totalStock,
                scopeAreaName,
                rows,
                openingBalance,
                excludedNoArea,
                reconciliation: {
                    totalMovements: allMovs.length,
                    sumAllDeltas,
                    unexplained: rec.unexplained,
                    hasDiscrepancy: rec.hasDiscrepancy,
                },
            },
        };
    } catch (e) {
        console.error('Error generando kardex:', e);
        return { success: false, message: 'Error generando el kardex' };
    }
}
