/**
 * Servicio de reportes de COMPRAS (familia C del catálogo).
 *  - Compras por proveedor en el período (monto, # órdenes, estado).
 *  - Detalle OC vs recepción (diferencias pedido/recibido por orden).
 * La variación de precios de insumos ya existe en
 * /dashboard/compras/proveedor (SupplierItemPriceHistory) — se enlaza.
 */

import { Prisma } from '@prisma/client';
import prisma from '@/server/db';
import type { ReportFilters } from './types';

export interface PurchasesBySupplierRow {
    supplierId: string | null;
    supplierName: string;
    ordersCount: number;
    receivedCount: number;
    totalAmount: number;
}

export interface PurchaseOrderDiffRow {
    orderNumber: string;
    orderName: string | null;
    supplierName: string;
    status: string;
    orderDate: string;
    receivedDate: string | null;
    totalAmount: number;
    itemsOrdered: number;
    itemsReceived: number;
    /** unidades pedidas − recibidas (positivo = faltó por recibir). */
    unitsDiff: number;
}

export interface PurchasesReport {
    bySupplier: PurchasesBySupplierRow[];
    orders: PurchaseOrderDiffRow[];
    totals: { ordersCount: number; totalAmount: number };
}

export async function getPurchasesReport(f: ReportFilters): Promise<PurchasesReport> {
    const [bySupplier, orders] = await Promise.all([
        prisma.$queryRaw<Array<{
            supplierId: string | null; supplierName: string;
            ordersCount: number; receivedCount: number; totalAmount: number;
        }>>(Prisma.sql`
            SELECT s."id" AS "supplierId",
                   COALESCE(s."name", 'Sin proveedor') AS "supplierName",
                   COUNT(*)::float AS "ordersCount",
                   COUNT(*) FILTER (WHERE po."status" = 'RECEIVED')::float AS "receivedCount",
                   COALESCE(SUM(po."totalAmount"), 0)::float AS "totalAmount"
            FROM "PurchaseOrder" po
            LEFT JOIN "Supplier" s ON s."id" = po."supplierId"
            WHERE po."tenantId" = ${f.tenantId}
              AND po."orderDate" >= ${f.from} AND po."orderDate" <= ${f.to}
              AND po."status" <> 'CANCELLED'
              AND po."deletedAt" IS NULL
            GROUP BY s."id", COALESCE(s."name", 'Sin proveedor')
            ORDER BY "totalAmount" DESC
        `),
        prisma.purchaseOrder.findMany({
            where: {
                tenantId: f.tenantId,
                orderDate: { gte: f.from, lte: f.to },
                status: { not: 'CANCELLED' },
                deletedAt: null,
            },
            select: {
                orderNumber: true, orderName: true, status: true, orderDate: true,
                receivedDate: true, totalAmount: true,
                supplier: { select: { name: true } },
                items: { select: { quantityOrdered: true, quantityReceived: true } },
            },
            orderBy: { orderDate: 'desc' },
            take: 300,
        }),
    ]);

    const orderRows: PurchaseOrderDiffRow[] = orders.map(o => {
        const ordered = o.items.reduce((s, i) => s + i.quantityOrdered, 0);
        const received = o.items.reduce((s, i) => s + i.quantityReceived, 0);
        return {
            orderNumber: o.orderNumber,
            orderName: o.orderName,
            supplierName: o.supplier?.name ?? 'Sin proveedor',
            status: o.status,
            orderDate: o.orderDate.toISOString(),
            receivedDate: o.receivedDate?.toISOString() ?? null,
            totalAmount: o.totalAmount,
            itemsOrdered: ordered,
            itemsReceived: received,
            unitsDiff: ordered - received,
        };
    });

    return {
        bySupplier: bySupplier.map(r => ({
            supplierId: r.supplierId,
            supplierName: r.supplierName,
            ordersCount: Number(r.ordersCount),
            receivedCount: Number(r.receivedCount),
            totalAmount: Number(r.totalAmount),
        })),
        orders: orderRows,
        totals: {
            ordersCount: orderRows.length,
            totalAmount: orderRows.reduce((s, r) => s + r.totalAmount, 0),
        },
    };
}
