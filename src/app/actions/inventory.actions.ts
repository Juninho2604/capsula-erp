'use server';
import { getSession } from '@/lib/auth';

/**
 * SHANKLISH CARACAS ERP - Inventory Actions
 * 
 * Server Actions para gestión de inventario desde el frontend
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { Prisma } from '@prisma/client';

// ============================================================================
// TIPOS
// ============================================================================

export interface PurchaseFormData {
    inventoryItemId: string;
    quantity: number;
    unit: string;
    unitCost: number;
    supplierId?: string;
    areaId: string;
    notes?: string;
}

export interface SaleFormData {
    inventoryItemId: string;
    quantity: number;
    unit: string;
    areaId: string;
    orderId?: string;
    notes?: string;
}

export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
}

// ============================================================================
// LOGICA REAL IMPLEMENTADA CON PRISMA
// ============================================================================
// ACTION: REGISTRAR COMPRA
// ============================================================================

export async function registerPurchaseAction(
    formData: PurchaseFormData
): Promise<ActionResult> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };
    const userId = session.id;

    try {
        const { inventoryItemId, quantity, unit, unitCost, areaId, notes } = formData;

        if (quantity <= 0) return { success: false, message: 'La cantidad debe ser positiva' };
        if (unitCost < 0) return { success: false, message: 'El costo no puede ser negativo' };

        const result = await prisma.$transaction(async (tx) => {
            // Fetch item to get base unit and current cost
            const item = await tx.inventoryItem.findUnique({
                where: { id: inventoryItemId },
                include: {
                    costHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
                    stockLevels: { where: { areaId } }
                }
            });

            if (!item) throw new Error('Ítem no encontrado');

            // 2. Register Movement
            const movement = await tx.inventoryMovement.create({
                data: {
                    inventoryItemId,
                    movementType: 'PURCHASE',
                    quantity,
                    unit,
                    unitCost,
                    totalCost: quantity * unitCost,
                    createdById: userId,
                    reason: 'Compra registrada manualmente',
                    notes
                }
            });

            // 3. Update Stock
            const currentLoc = item.stockLevels[0];
            const oldStock = currentLoc?.currentStock || 0;
            const newStock = oldStock + quantity;

            await tx.inventoryLocation.upsert({
                where: { inventoryItemId_areaId: { inventoryItemId, areaId } },
                create: { inventoryItemId, areaId, currentStock: quantity },
                update: { currentStock: newStock }
            });

            // 4. Update Cost (Weighted Average)
            const oldCost = item.costHistory[0]?.costPerUnit || 0;
            let newWeightedCost = oldCost;

            // Formula: (OldTotalValue + NewValue) / TotalStock
            // Value = Stock * Cost
            // Only if total stock > 0
            if (newStock > 0) {
                const oldValue = oldStock * oldCost;
                const newValue = quantity * unitCost;
                newWeightedCost = (oldValue + newValue) / newStock;
            }

            // Record new cost
            await tx.costHistory.create({
                data: {
                    inventoryItemId,
                    costPerUnit: newWeightedCost,
                    effectiveFrom: new Date(),
                    reason: 'Actualización por Compra',
                    createdById: userId
                }
            });

            return { newStock, newWeightedCost };
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/inventario');

        return {
            success: true,
            message: `Compra registrada correctamente.`,
            data: {
                newStock: result.newStock,
                newCostPerUnit: result.newWeightedCost
            },
        };

    } catch (error) {
        console.error('Error en registerPurchaseAction:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al registrar compra',
        };
    }
}

// ============================================================================
// ACTION: REGISTRAR VENTA (Para integración futura con Wink)
// ============================================================================

export async function registerSaleAction(
    formData: SaleFormData
): Promise<ActionResult> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };
    const userId = session.id;

    try {
        const { inventoryItemId, quantity, areaId, orderId } = formData;

        if (quantity <= 0) return { success: false, message: 'La cantidad debe ser positiva' };

        const result = await prisma.$transaction(async (tx) => {
            // 1. Check Stock
            const location = await tx.inventoryLocation.findUnique({
                where: { inventoryItemId_areaId: { inventoryItemId, areaId } }
            });

            const currentStock = location?.currentStock || 0;
            if (currentStock < quantity) {
                throw new Error(`Stock insuficiente. Disponible: ${currentStock}`);
            }

            // 2. Register Movement
            await tx.inventoryMovement.create({
                data: {
                    inventoryItemId,
                    movementType: 'SALE',
                    quantity: quantity,
                    unit: 'UNIT', // Should optimally fetch item unit
                    createdById: userId,
                    salesOrderId: orderId,
                    reason: 'Venta registrada manualmente'
                }
            });

            // 3. Update Stock
            const newStock = currentStock - quantity;
            await tx.inventoryLocation.update({
                where: { inventoryItemId_areaId: { inventoryItemId, areaId } },
                data: { currentStock: newStock }
            });

            return newStock;
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/inventario');

        return {
            success: true,
            message: `Venta registrada. Nuevo stock: ${result.toFixed(2)}`,
            data: { newStock: result },
        };

    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al registrar venta',
        };
    }
}

// ============================================================================
// ACTION: PROCESAR VENTA DESDE WINK/WEB (Endpoint preparado)
// ============================================================================

export interface WinkOrderItem {
    productSku: string;
    quantity: number;
}

export interface WinkOrder {
    orderId: string;
    items: WinkOrderItem[];
    customerName?: string;
    createdAt: string;
}

/**
 * Procesa una orden de Wink/Web
 * Descuenta ingredientes del inventario según las recetas
 */
export async function processWinkOrderAction(
    order: WinkOrder
): Promise<ActionResult> {
    try {
        console.log('🛒 PROCESANDO ORDEN WINK:', order.orderId);

        const results: { sku: string; success: boolean; message: string }[] = [];

        for (const item of order.items) {
            // En producción:
            // 1. Buscar producto por SKU
            // 2. Obtener receta del producto
            // 3. Calcular ingredientes necesarios × cantidad
            // 4. Decrementar cada ingrediente del inventario

            // Mock: Solo registrar
            console.log(`  - ${item.quantity}x ${item.productSku}`);
            results.push({
                sku: item.productSku,
                success: true,
                message: `Procesado ${item.quantity} unidades`,
            });
        }

        revalidatePath('/dashboard');

        return {
            success: true,
            message: `Orden ${order.orderId} procesada: ${order.items.length} productos`,
            data: { results },
        };

    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error procesando orden',
        };
    }
}

// ============================================================================
// ACTION: OBTENER STOCK ACTUAL (Para UI)
// ============================================================================

export async function getStockAction(
    inventoryItemId: string
): Promise<ActionResult> {
    try {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: inventoryItemId },
            include: {
                stockLevels: true,
                costHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
            }
        });

        if (!item) return { success: false, message: 'Item no encontrado' };

        // Sum stock default
        const currentStock = item.stockLevels.reduce((acc, loc) => acc + loc.currentStock, 0);
        const costPerUnit = item.costHistory[0]?.costPerUnit || 0;

        return {
            success: true,
            message: 'Stock obtenido',
            data: {
                currentStock,
                costPerUnit,
            },
        };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Error obteniendo stock' };
    }
}

// ============================================================================
// ACTION: OBTENER LISTA DE INVENTARIO (REAL)
// ============================================================================

export async function getInventoryListAction() {
    try {
        const items = await prisma.inventoryItem.findMany({
            where: { isActive: true },
            include: {
                stockLevels: {
                    include: {
                        area: true
                    }
                },
                costHistory: {
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1
                }
            },
            orderBy: { name: 'asc' }
        });

        // Mapear al formato que espera la UI
        return items.map(item => {
            const currentStock = item.stockLevels.reduce((acc, sl) => acc + Number(sl.currentStock), 0);
            const costPerUnit = item.costHistory[0]?.costPerUnit || 0;

            return {
                id: item.id,
                sku: item.sku,
                name: item.name,
                type: item.type,
                category: item.category || 'GENERAL',
                baseUnit: item.baseUnit,
                currentStock: currentStock,
                stockByArea: item.stockLevels.map(sl => ({
                    areaId: sl.areaId,
                    areaName: sl.area.name,
                    quantity: Number(sl.currentStock)
                })),
                minimumStock: Number(item.minimumStock),
                reorderPoint: item.reorderPoint ? Number(item.reorderPoint) : 0,
                costPerUnit: Number(costPerUnit),
                lastUpdated: item.updatedAt.toISOString(),
            };
        });
    } catch (error) {
        console.error('Error obteniendo inventario:', error);
        return [];
    }
}

export async function getAreasAction() {
    try {
        const areas = await prisma.area.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return areas;
    } catch (error) {
        console.error('Error fetching areas:', error);
        return [];
    }
}

export async function updateInventoryItemAction(
    id: string,
    data: {
        name?: string;
        sku?: string;
        category?: string;
        minimumStock?: number;
        reorderPoint?: number;
    }
): Promise<{ success: boolean; message: string }> {
    try {
        await prisma.inventoryItem.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        });

        revalidatePath('/dashboard/inventario');
        return { success: true, message: 'Ítem actualizado exitosamente' };
    } catch (error) {
        console.error('Error updating inventory item:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al actualizar el ítem'
        };
    }
}
