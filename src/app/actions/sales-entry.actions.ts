'use server';

/**
 * Carga manual de ventas — multitenant (Lote 5.g — Fase 3 Paso D.b).
 *
 * Para gerentes que registran comandas de WhatsApp/históricas del día.
 *
 * Modelos tenant-aware: MenuItem, MenuCategory, SalesOrder, User, Area,
 *                       Recipe.
 * Modelos NO tenant-aware: InventoryMovement (vía registerSale service).
 *
 * Validaciones:
 *   - createSalesEntryAction: ownership de areaId y de cada menuItemId.
 *   - voidSalesOrderAction: update → updateMany con tenant filter.
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { registerSale } from '@/server/services/inventory.service';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

// ============================================================================
// TIPOS
// ============================================================================

export interface SalesEntryItem {
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
}

export interface CreateSalesEntryInput {
    orderType: 'RESTAURANT' | 'DELIVERY' | 'TAKEOUT';
    areaId: string;
    items: SalesEntryItem[];
    paymentMethod: string;
    discountType?: string;
    discountAmount?: number;
    notes?: string;
    orderTime?: Date;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
}

// ============================================================================
// ACTION: OBTENER ITEMS DEL MENÚ PARA VENTAS
// ============================================================================

export async function getMenuItemsForSalesAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const menuItems = await db.menuItem.findMany({
            where: {
                isActive: true,
                isAvailable: true
            },
            include: {
                category: true
            },
            orderBy: { name: 'asc' }
        });

        return menuItems.map(item => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            price: item.price,
            categoryId: item.categoryId,
            categoryName: item.category.name
        }));
    } catch (error) {
        console.error('Error en getMenuItemsForSalesAction:', error);
        return [];
    }
}

// ============================================================================
// ACTION: OBTENER CATEGORÍAS DEL MENÚ
// ============================================================================

export async function getMenuCategoriesAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const categories = await db.menuCategory.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
        });

        return categories.map(cat => ({
            id: cat.id,
            name: cat.name
        }));
    } catch (error) {
        console.error('Error en getMenuCategoriesAction:', error);
        return [];
    }
}

// ============================================================================
// ACTION: CREAR VENTA MANUAL
// ============================================================================

export async function createSalesEntryAction(
    input: CreateSalesEntryInput
): Promise<{ success: boolean; message: string; orderId?: string; orderNumber?: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { success: false, message: 'No autorizado' };
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // Verificar rol (solo gerentes o superior)
    const user = await db.user.findFirst({
        where: { id: session.id },
        select: { role: true }
    });

    const allowedRoles = ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'];
    if (!user || !allowedRoles.includes(user.role)) {
        return { success: false, message: 'No tienes permisos para registrar ventas manualmente' };
    }

    // Validar ownership de areaId
    const ownedArea = await db.area.findFirst({
        where: { id: input.areaId },
        select: { id: true },
    });
    if (!ownedArea) return { success: false, message: 'Área no encontrada' };

    // Validar ownership de cada menuItemId
    const menuItemIds = Array.from(new Set(input.items.map(i => i.menuItemId)));
    const ownedMenuItems = await db.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true },
    });
    if (ownedMenuItems.length !== menuItemIds.length) {
        return { success: false, message: 'Uno o más items del menú no pertenecen a este tenant' };
    }

    try {
        // Generar número de orden
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await db.salesOrder.count({
            where: {
                orderNumber: { startsWith: `VTA-${today}` }
            }
        });
        const orderNumber = `VTA-${today}-${String(count + 1).padStart(4, '0')}`;

        const subtotal = input.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const discount = input.discountAmount || 0;
        const total = Math.max(0, subtotal - discount);

        const result = await db.$transaction(async (tx) => {
            const salesOrder = await tx.salesOrder.create({
                data: {
                    orderNumber,
                    orderType: input.orderType,
                    status: 'COMPLETED',
                    subtotal,
                    discount,
                    total,
                    discountType: input.discountType,
                    discountReason: input.discountType ? 'Descuento aplicado en carga manual' : undefined,
                    paymentMethod: input.paymentMethod,
                    paymentStatus: 'PAID',
                    amountPaid: total,
                    createdById: session.id,
                    areaId: input.areaId,
                    notes: input.notes,
                    customerName: input.customerName,
                    customerPhone: input.customerPhone,
                    customerAddress: input.customerAddress,
                    items: {
                        create: input.items.map(item => ({
                            menuItemId: item.menuItemId,
                            itemName: item.menuItemName,
                            unitPrice: item.unitPrice,
                            quantity: item.quantity,
                            lineTotal: item.unitPrice * item.quantity,
                            notes: item.notes
                        }))
                    }
                }
            });

            return salesOrder;
        }, { timeout: 60000 });

        console.log('VENTA REGISTRADA:', {
            orden: result.orderNumber,
            tipo: input.orderType,
            items: input.items.length,
            total: total
        });

        // ====================================================================
        // GESTIÓN DE INVENTARIO (Descargo de Recetas)
        // ====================================================================
        try {
            for (const item of input.items) {
                const menuItem = await db.menuItem.findFirst({
                    where: { id: item.menuItemId },
                    select: {
                        name: true,
                        recipeId: true
                    }
                });

                if (menuItem?.recipeId) {
                    const recipe = await db.recipe.findFirst({
                        where: { id: menuItem.recipeId },
                        include: {
                            ingredients: {
                                include: { ingredientItem: true }
                            }
                        }
                    });

                    if (recipe && recipe.isActive) {
                        for (const ingredient of recipe.ingredients) {
                            const totalQty = ingredient.quantity * item.quantity;

                            await registerSale({
                                inventoryItemId: ingredient.ingredientItemId,
                                quantity: totalQty,
                                unit: ingredient.unit as any,
                                areaId: input.areaId,
                                orderId: result.id,
                                userId: session.id,
                                notes: `Carga Manual: ${item.quantity}x ${menuItem.name}`,
                                allowNegative: true
                            });
                        }
                    }
                }
            }
        } catch (invError) {
            console.error('Error descontando inventario de carga manual:', invError);
        }

        revalidatePath('/dashboard/ventas');
        revalidatePath('/dashboard/pos');
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/inventario');

        return {
            success: true,
            message: `Venta ${orderNumber} registrada exitosamente`,
            orderId: result.id,
            orderNumber: result.orderNumber
        };
    } catch (error) {
        console.error('Error en createSalesEntryAction:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error al registrar venta'
        };
    }
}

// ============================================================================
// ACTION: OBTENER VENTAS DEL DÍA
// ============================================================================

export async function getTodaySalesAction() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const sales = await db.salesOrder.findMany({
            where: {
                createdAt: {
                    gte: today,
                    lt: tomorrow
                }
            },
            include: {
                createdBy: {
                    select: { firstName: true, lastName: true }
                },
                items: true,
                _count: {
                    select: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
        const byType = {
            RESTAURANT: sales.filter(s => s.orderType === 'RESTAURANT').length,
            DELIVERY: sales.filter(s => s.orderType === 'DELIVERY').length,
            TAKEOUT: sales.filter(s => s.orderType === 'TAKEOUT').length
        };

        return {
            sales: sales.map(s => ({
                id: s.id,
                orderNumber: s.orderNumber,
                orderType: s.orderType,
                status: s.status,
                total: s.total,
                paymentMethod: s.paymentMethod,
                createdAt: s.createdAt,
                createdBy: `${s.createdBy.firstName} ${s.createdBy.lastName}`,
                itemCount: s._count.items,
                customerName: s.customerName
            })),
            summary: {
                totalSales,
                totalRevenue,
                byType
            }
        };
    } catch (error) {
        console.error('Error en getTodaySalesAction:', error);
        return {
            sales: [],
            summary: { totalSales: 0, totalRevenue: 0, byType: { RESTAURANT: 0, DELIVERY: 0, TAKEOUT: 0 } }
        };
    }
}

// ============================================================================
// ACTION: OBTENER ÁREAS PARA VENTAS
// ============================================================================

export async function getSalesAreasAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const areas = await db.area.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });

        return areas;
    } catch (error) {
        console.error('Error en getSalesAreasAction:', error);
        return [];
    }
}

// ============================================================================
// ACTION: ANULAR VENTA (Solo gerentes)
// ============================================================================

export async function voidSalesOrderAction(
    orderId: string,
    reason: string
): Promise<{ success: boolean; message: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { success: false, message: 'No autorizado' };
    }

    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);

    // Verificar rol
    const user = await db.user.findFirst({
        where: { id: session.id },
        select: { role: true }
    });

    const allowedRoles = ['OWNER', 'AUDITOR', 'ADMIN_MANAGER'];
    if (!user || !allowedRoles.includes(user.role)) {
        return { success: false, message: 'No tienes permisos para anular ventas' };
    }

    try {
        const res = await db.salesOrder.updateMany({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                notes: `ANULADA: ${reason}`
            }
        });
        if (res.count === 0) return { success: false, message: 'Venta no encontrada' };

        revalidatePath('/dashboard/ventas');
        return { success: true, message: 'Venta anulada' };
    } catch (error) {
        console.error('Error en voidSalesOrderAction:', error);
        return { success: false, message: 'Error al anular venta' };
    }
}

// ============================================================================
// ACTION: OBTENER RESUMEN DE VENTAS POR PERÍODO
// ============================================================================

export async function getSalesSummaryAction(startDate: Date, endDate: Date) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const sales = await db.salesOrder.findMany({
            where: {
                status: { not: 'CANCELLED' },
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                total: true,
                orderType: true,
                paymentMethod: true,
                createdAt: true
            }
        });

        const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

        const byOrderType = sales.reduce((acc, s) => {
            acc[s.orderType] = (acc[s.orderType] || 0) + s.total;
            return acc;
        }, {} as Record<string, number>);

        const byPaymentMethod = sales.reduce((acc, s) => {
            const method = s.paymentMethod || 'NO_ESPECIFICADO';
            acc[method] = (acc[method] || 0) + s.total;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalOrders: sales.length,
            totalRevenue,
            byOrderType,
            byPaymentMethod
        };
    } catch (error) {
        console.error('Error en getSalesSummaryAction:', error);
        return {
            totalOrders: 0,
            totalRevenue: 0,
            byOrderType: {},
            byPaymentMethod: {}
        };
    }
}
