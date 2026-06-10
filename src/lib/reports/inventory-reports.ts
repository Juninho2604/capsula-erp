/**
 * Servicio de reportes de INVENTARIO (familia D del catálogo).
 *
 * Existencias valorizadas ya viven en `reports.actions.ts:
 * getInventoryReportAction` (§51.C) y Variación semanal en §51.B — este
 * servicio agrega el KARDEX por rango de fechas (antes solo existía el
 * historial mensual fijo).
 *
 * Nota multi-tenant: InventoryMovement NO tiene tenantId — el aislamiento
 * va vía la relación `inventoryItem.tenantId` (regla del DIAGNOSTICO §1.3).
 */

import { Prisma } from '@prisma/client';
import prisma from '@/server/db';
import type { ReportFilters } from './types';

export interface KardexFilters extends ReportFilters {
    inventoryItemId?: string;
    areaId?: string;
    movementType?: string;
    /** Paginación server-side. */
    page?: number;
    pageSize?: number;
}

export interface KardexRow {
    id: string;
    createdAt: string;
    movementType: string;
    sku: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitCost: number | null;
    totalCost: number | null;
    areaName: string | null;
    reason: string | null;
    reference: string | null;   // orden de venta / OC / requisición vinculada
    createdBy: string;
}

export interface KardexSummaryRow {
    movementType: string;
    count: number;
    quantity: number;
    totalCost: number;
}

export interface KardexReport {
    rows: KardexRow[];
    summary: KardexSummaryRow[];
    total: number;
    page: number;
    pageSize: number;
}

export async function getKardex(f: KardexFilters): Promise<KardexReport> {
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(200, Math.max(10, f.pageSize ?? 50));

    const where = {
        createdAt: { gte: f.from, lte: f.to },
        // Aislamiento tenant vía relación (InventoryMovement no tiene tenantId)
        inventoryItem: { tenantId: f.tenantId },
        ...(f.inventoryItemId ? { inventoryItemId: f.inventoryItemId } : {}),
        ...(f.areaId ? { areaId: f.areaId } : {}),
        ...(f.movementType ? { movementType: f.movementType } : {}),
    } as const;

    const [rows, total, summaryRaw] = await Promise.all([
        prisma.inventoryMovement.findMany({
            where,
            select: {
                id: true, createdAt: true, movementType: true, quantity: true, unit: true,
                unitCost: true, totalCost: true, reason: true,
                referenceNumber: true, salesOrderId: true, purchaseOrderId: true, requisitionId: true,
                inventoryItem: { select: { sku: true, name: true } },
                area: { select: { name: true } },
                createdBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.inventoryMovement.count({ where }),
        // Resumen por tipo del rango completo (no de la página)
        prisma.$queryRaw<Array<{ movementType: string; count: number; quantity: number; totalCost: number }>>(Prisma.sql`
            SELECT mv."movementType" AS "movementType",
                   COUNT(*)::float AS count,
                   COALESCE(SUM(mv."quantity"), 0)::float AS quantity,
                   COALESCE(SUM(COALESCE(mv."totalCost", 0)), 0)::float AS "totalCost"
            FROM "InventoryMovement" mv
            JOIN "InventoryItem" it ON it."id" = mv."inventoryItemId"
            WHERE it."tenantId" = ${f.tenantId}
              AND mv."createdAt" >= ${f.from} AND mv."createdAt" <= ${f.to}
              ${f.inventoryItemId ? Prisma.sql`AND mv."inventoryItemId" = ${f.inventoryItemId}` : Prisma.empty}
              ${f.areaId ? Prisma.sql`AND mv."areaId" = ${f.areaId}` : Prisma.empty}
              ${f.movementType ? Prisma.sql`AND mv."movementType" = ${f.movementType}` : Prisma.empty}
            GROUP BY mv."movementType"
            ORDER BY count DESC
        `),
    ]);

    return {
        rows: rows.map(m => ({
            id: m.id,
            createdAt: m.createdAt.toISOString(),
            movementType: m.movementType,
            sku: m.inventoryItem.sku,
            itemName: m.inventoryItem.name,
            quantity: m.quantity,
            unit: m.unit,
            unitCost: m.unitCost,
            totalCost: m.totalCost,
            areaName: m.area?.name ?? null,
            reason: m.reason,
            reference: m.referenceNumber
                ?? (m.salesOrderId ? `Venta ${m.salesOrderId.slice(-6)}` : null)
                ?? (m.purchaseOrderId ? `OC ${m.purchaseOrderId.slice(-6)}` : null)
                ?? (m.requisitionId ? `Req ${m.requisitionId.slice(-6)}` : null),
            createdBy: `${m.createdBy.firstName} ${m.createdBy.lastName}`.trim(),
        })),
        summary: summaryRaw.map(s => ({
            movementType: s.movementType,
            count: Number(s.count),
            quantity: Number(s.quantity),
            totalCost: Number(s.totalCost),
        })),
        total,
        page,
        pageSize,
    };
}

/** Items/áreas para los selectores del kardex (livianos). */
export async function getKardexFilterOptions(tenantId: string) {
    const [items, areas] = await Promise.all([
        prisma.inventoryItem.findMany({
            where: { tenantId, isActive: true, deletedAt: null },
            select: { id: true, sku: true, name: true },
            orderBy: { name: 'asc' },
        }),
        prisma.area.findMany({
            where: { tenantId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);
    return { items, areas };
}
