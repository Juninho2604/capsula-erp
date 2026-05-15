'use server';

/**
 * Cierre diario de inventario — multitenant (Lote 4.e — Fase 3 Paso D.b).
 *
 * Modelos tenant-aware: DailyInventory, MenuItem, Recipe, InventoryItem,
 *                       SalesOrder, Area, Requisition, ProteinProcessing.
 * Modelos NO tenant-aware (FK-scoped): DailyInventoryItem (FK a DailyInventory),
 *                       AreaCriticalItem (FK a Area + InventoryItem).
 *
 * Validaciones nuevas:
 *   - getDailyInventoryAction / save / close / reopen: ownership de dailyId
 *     o areaId vía findFirst en db tenant-aware.
 *   - saveDailyInventoryCountsAction: updates de DailyInventoryItem usan
 *     `where: { id, dailyInventoryId: dailyId }` para que un id de otro
 *     daily no matchee.
 *   - toggleItemCriticalStatusAction: ownership de areaId + inventoryItemId.
 */

import prisma from '@/server/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { PERM } from '@/lib/constants/permissions-registry';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

// ============================================================================
// OBTENER INVENTARIO DIARIO (Sincronizado con Transferencias y Producciones)
// ============================================================================
/**
 * Filtros sumables para definir qué SKUs aparecen como "críticos" en el
 * inventario físico del día. Cuando al menos uno está activo, la unión de
 * todos los resultados reemplaza la lista manual (AreaCriticalItem).
 * Si todos vienen vacíos/undefined → fallback al comportamiento histórico
 * (lista manual).
 */
export interface CriticalFilters {
    /** Top N items por costo unitario (desc). null = filtro inactivo. */
    byCost?: { topN: number } | null;
    /** Items cuyo `category` está en la lista. Vacío = filtro inactivo. */
    byCategory?: { values: string[] } | null;
    /** Items con data completa: category != null && description != null && cost > 0 */
    completos?: boolean | null;
    /** Todos los items del catálogo (override de los demás). */
    todos?: boolean | null;
}

function hasActiveFilters(f?: CriticalFilters | null): boolean {
    if (!f) return false;
    return (
        !!f.todos ||
        !!f.completos ||
        (!!f.byCost && f.byCost.topN > 0) ||
        (!!f.byCategory && f.byCategory.values.length > 0)
    );
}

export async function getDailyInventoryAction(
    dateStr: string,
    areaId: string,
    filters?: CriticalFilters | null,
) {
    try {
        const date = new Date(dateStr);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);

        // Validar ownership del areaId (lo usaremos como filtro en muchas queries)
        const ownedArea = await db.area.findFirst({
            where: { id: areaId },
            select: { id: true },
        });
        if (!ownedArea) {
            return { success: false, message: 'Área no encontrada' };
        }

        // 1. Buscar inventario diario existente (findUnique → findFirst con tenant filter)
        let daily = await db.dailyInventory.findFirst({
            where: { date: startOfDay, areaId },
            include: {
                area: true,
                items: {
                    include: { inventoryItem: true },
                    orderBy: { inventoryItem: { name: 'asc' } }
                }
            }
        });

        // 2. Obtener ITEMS CRÍTICOS — dos modos:
        //    a) filtros activos → unión de los 4 filtros (por costo, categoría, completos, todos)
        //    b) sin filtros → lista manual histórica (AreaCriticalItem)
        let criticalItems: Array<{ id: string; name: string; sku: string; baseUnit: string; isActive: boolean }> = [];

        if (hasActiveFilters(filters)) {
            const f = filters!;
            const matchedIds = new Set<string>();

            // "Todos" domina: incluye todos los items activos del catálogo.
            if (f.todos) {
                const all = await db.inventoryItem.findMany({
                    where: { isActive: true },
                    select: { id: true, name: true, sku: true, baseUnit: true, isActive: true },
                });
                for (const it of all) matchedIds.add(it.id);
            }

            // "Por categoría": items cuya category está en values.
            if (f.byCategory && f.byCategory.values.length > 0) {
                const byCat = await db.inventoryItem.findMany({
                    where: { isActive: true, category: { in: f.byCategory.values } },
                    select: { id: true },
                });
                for (const it of byCat) matchedIds.add(it.id);
            }

            // "Completos": tienen category, description y al menos un CostHistory > 0.
            if (f.completos) {
                const candidates = await db.inventoryItem.findMany({
                    where: {
                        isActive: true,
                        category: { not: null },
                        description: { not: null },
                    },
                    select: { id: true, costHistory: { take: 1, orderBy: { effectiveFrom: 'desc' }, select: { costPerUnit: true } } },
                });
                for (const it of candidates) {
                    const cost = it.costHistory[0]?.costPerUnit ?? 0;
                    if (cost > 0) matchedIds.add(it.id);
                }
            }

            // "Por costo": top N por costo unitario actual (desc).
            if (f.byCost && f.byCost.topN > 0) {
                const all = await db.inventoryItem.findMany({
                    where: { isActive: true },
                    select: { id: true, costHistory: { take: 1, orderBy: { effectiveFrom: 'desc' }, select: { costPerUnit: true } } },
                });
                const ranked = all
                    .map((it: { id: string; costHistory: { costPerUnit: number }[] }) => ({ id: it.id, cost: it.costHistory[0]?.costPerUnit ?? 0 }))
                    .filter((x: { id: string; cost: number }) => x.cost > 0)
                    .sort((a: { id: string; cost: number }, b: { id: string; cost: number }) => b.cost - a.cost)
                    .slice(0, f.byCost.topN);
                for (const x of ranked) matchedIds.add(x.id);
            }

            // Cargar info de los items matched (con datos para el flujo posterior).
            if (matchedIds.size > 0) {
                const items = await db.inventoryItem.findMany({
                    where: { id: { in: Array.from(matchedIds) }, isActive: true },
                    select: { id: true, name: true, sku: true, baseUnit: true, isActive: true },
                });
                criticalItems = items;
            }
        } else {
            // Fallback: lista manual por área (comportamiento histórico).
            // AreaCriticalItem no es tenant-aware; el areaId ya validado upstream.
            const areaCriticals = await prisma.areaCriticalItem.findMany({
                where: { areaId },
                include: { inventoryItem: true }
            });
            criticalItems = areaCriticals
                .map(ac => ac.inventoryItem)
                .filter((i: { isActive: boolean }) => i.isActive);
        }

        // 3. CALCULAR ENTRADAS Y SALIDAS AUTOMÁTICAS SEGÚN EL ÁREA
        const transferDateFilter = {
            OR: [
                { processedAt: { gte: startOfDay, lte: endOfDay } },
                { AND: [{ processedAt: null }, { createdAt: { gte: startOfDay, lte: endOfDay } }] }
            ]
        };

        // ── Transferencias donde ESTA ÁREA es DESTINO (entradas) ──
        const inboundRequisitions = await db.requisition.findMany({
            where: {
                targetAreaId: areaId,
                status: 'COMPLETED',
                ...transferDateFilter
            },
            include: { items: true }
        });
        const entriesFromTransfers = new Map<string, number>();
        for (const req of inboundRequisitions) {
            for (const item of req.items) {
                const current = entriesFromTransfers.get(item.inventoryItemId) || 0;
                const qty = item.dispatchedQuantity ?? item.sentQuantity ?? item.quantity ?? 0;
                entriesFromTransfers.set(item.inventoryItemId, current + qty);
            }
        }

        // ── Transferencias donde ESTA ÁREA es ORIGEN (salidas) ──
        const outboundRequisitions = await db.requisition.findMany({
            where: {
                sourceAreaId: areaId,
                status: 'COMPLETED',
                ...transferDateFilter
            },
            include: { items: true }
        });
        const salesFromTransfers = new Map<string, number>();
        for (const req of outboundRequisitions) {
            for (const item of req.items) {
                const current = salesFromTransfers.get(item.inventoryItemId) || 0;
                const qty = item.dispatchedQuantity ?? item.sentQuantity ?? item.quantity ?? 0;
                salesFromTransfers.set(item.inventoryItemId, current + qty);
            }
        }

        // ── Producciones completadas hoy (entradas para Centro de Producción) ──
        const completedProductions = await db.proteinProcessing.findMany({
            where: {
                areaId: areaId,
                status: 'COMPLETED',
                completedAt: { gte: startOfDay, lte: endOfDay }
            },
            include: { subProducts: true }
        });
        const entriesFromProduction = new Map<string, number>();
        for (const proc of completedProductions) {
            for (const sub of proc.subProducts) {
                if (sub.outputItemId) {
                    const current = entriesFromProduction.get(sub.outputItemId) || 0;
                    entriesFromProduction.set(sub.outputItemId, current + sub.weight);
                }
            }
        }

        // ── Combinar entradas/salidas ──
        const autoEntries = new Map<string, number>();
        for (const [id, qty] of Array.from(entriesFromTransfers.entries())) {
            autoEntries.set(id, (autoEntries.get(id) || 0) + qty);
        }
        for (const [id, qty] of Array.from(entriesFromProduction.entries())) {
            autoEntries.set(id, (autoEntries.get(id) || 0) + qty);
        }

        const autoSales = new Map<string, number>();
        for (const [id, qty] of Array.from(salesFromTransfers.entries())) {
            autoSales.set(id, (autoSales.get(id) || 0) + qty);
        }

        // 4. CREAR O SINCRONIZAR
        if (!daily) {
            // Buscar día anterior para arrastre automático
            const yesterday = new Date(startOfDay);
            yesterday.setDate(yesterday.getDate() - 1);
            const prevDaily = await db.dailyInventory.findFirst({
                where: { date: yesterday, areaId },
                include: { items: true }
            });
            const prevMap = new Map(prevDaily?.items.map((i: any) => [i.inventoryItemId, i.finalCount]) || []);

            daily = await db.dailyInventory.create({
                data: {
                    tenantId,
                    date: startOfDay,
                    areaId,
                    status: 'DRAFT',
                    items: {
                        create: criticalItems.map((item: any) => ({
                            inventoryItemId: item.id,
                            unit: item.baseUnit,
                            initialCount: prevMap.get(item.id) || 0,
                            finalCount: 0,
                            entries: autoEntries.get(item.id) || 0,
                            sales: autoSales.get(item.id) || 0,
                            waste: 0,
                            theoreticalStock: 0,
                            variance: 0
                        }))
                    }
                },
                include: { area: true, items: { include: { inventoryItem: true } } }
            });
        } else if (daily.status !== 'CLOSED') {
            // ── SYNC 1: Agregar items críticos nuevos que no están en el reporte ──
            const existingItemIds = new Set(daily.items.map((i: any) => i.inventoryItemId));
            const missingCriticals = criticalItems.filter((ci: any) => !existingItemIds.has(ci.id));

            if (missingCriticals.length > 0) {
                // DailyInventoryItem no es tenant-aware; FK al daily ya validado.
                await prisma.dailyInventoryItem.createMany({
                    data: missingCriticals.map((item: any) => ({
                        dailyInventoryId: daily!.id,
                        inventoryItemId: item.id,
                        unit: item.baseUnit,
                        initialCount: 0,
                        finalCount: 0,
                        entries: autoEntries.get(item.id) || 0,
                        sales: autoSales.get(item.id) || 0,
                        waste: 0,
                        theoreticalStock: 0,
                        variance: 0
                    }))
                });
            }

            // ── SYNC 2: Remover items que YA NO son críticos para esta área ──
            const criticalIds = new Set(criticalItems.map((ci: any) => ci.id));
            const nonCriticalDailyItems = daily.items.filter((i: any) => !criticalIds.has(i.inventoryItemId));

            if (nonCriticalDailyItems.length > 0) {
                await prisma.dailyInventoryItem.deleteMany({
                    where: { id: { in: nonCriticalDailyItems.map((i: any) => i.id) } }
                });
            }

            // ── SYNC 3: Releer daily con datos actualizados ──
            daily = await db.dailyInventory.findFirst({
                where: { id: daily.id },
                include: {
                    area: true,
                    items: {
                        include: { inventoryItem: true },
                        orderBy: { inventoryItem: { name: 'asc' } }
                    }
                }
            });
        }

        // Calcular las sugerencias automáticas para enviar a la UI
        const autoSuggestions: Record<string, { autoEntries: number; autoSales: number }> = {};
        if (daily) {
            for (const item of daily.items) {
                autoSuggestions[item.inventoryItemId] = {
                    autoEntries: autoEntries.get(item.inventoryItemId) || 0,
                    autoSales: autoSales.get(item.inventoryItemId) || 0,
                };
            }
        }

        return { success: true, data: daily, autoSuggestions };

    } catch (error) {
        console.error('Error getting daily inventory:', error);
        return { success: false, message: 'Error cargando inventario diario' };
    }
}

// ============================================================================
// GUARDAR CONTEOS Y CALCULAR VARIACIÓN
// ============================================================================
export async function saveDailyInventoryCountsAction(dailyId: string, itemsData: any[]) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        // Validar ownership del daily inventory
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const ownedDaily = await db.dailyInventory.findFirst({
            where: { id: dailyId },
            select: { id: true },
        });
        if (!ownedDaily) return { success: false, message: 'Inventario no encontrado' };

        for (const item of itemsData) {
            const initial = parseFloat(item.initialCount) || 0;
            const entries = parseFloat(item.entries) || 0;
            const finalCount = parseFloat(item.finalCount) || 0;
            const sales = parseFloat(item.sales) || 0;
            const waste = parseFloat(item.waste) || 0;

            // Teórico = Apertura + Entradas - Salidas - Merma
            const theoretical = initial + entries - sales - waste;
            // Variación = Cierre real - Teórico
            const variance = finalCount - theoretical;

            // Update con `dailyInventoryId` explícito para que un id de un
            // DailyInventoryItem de otro daily no matchee.
            await prisma.dailyInventoryItem.updateMany({
                where: { id: item.id, dailyInventoryId: dailyId },
                data: {
                    initialCount: initial,
                    entries: entries,
                    finalCount: finalCount,
                    sales: sales,
                    waste: waste,
                    theoreticalStock: theoretical,
                    variance: variance,
                    notes: item.notes
                }
            });
        }

        revalidatePath('/dashboard/inventario/diario');
        return { success: true, message: 'Guardado correctamente' };
    } catch (error) {
        console.error('Error saving counts:', error);
        return { success: false, message: 'Error al guardar conteo' };
    }
}

// ============================================================================
// CARGAR VENTAS MANUALES Y EXPLOTAR RECETAS (SOLO RESTAURANTE)
// ============================================================================
export async function getMenuItemsWithRecipesAction() {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const items = await db.menuItem.findMany({
            where: { isActive: true },
            include: { category: true },
            orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
        });
        return { success: true, data: items };
    } catch (error) {
        return { success: false, data: [] };
    }
}

export async function processManualSalesAction(dailyId: string, salesData: { menuItemId: string, quantity: number }[]) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const daily = await db.dailyInventory.findFirst({
            where: { id: dailyId },
            include: { items: true }
        });
        if (!daily) return { success: false, message: 'Inventario no encontrado' };

        // 1. Mapear consumo de ingredientes por cada plato vendido
        const totalConsumption = new Map<string, number>();

        for (const sale of salesData) {
            if (sale.quantity <= 0) continue;

            const menuItem = await db.menuItem.findFirst({
                where: { id: sale.menuItemId }
            });

            if (menuItem?.recipeId) {
                const recipe = await db.recipe.findFirst({
                    where: { id: menuItem.recipeId },
                    include: { ingredients: true }
                });

                if (recipe) {
                    for (const ing of recipe.ingredients) {
                        const qty = ing.quantity * sale.quantity;
                        const current = totalConsumption.get(ing.ingredientItemId) || 0;
                        totalConsumption.set(ing.ingredientItemId, current + qty);
                    }
                }
            }
        }

        // 2. Acumular los campos 'sales' de cada item en el inventario diario
        const consumptionEntries = Array.from(totalConsumption.entries());
        for (const [itemId, qty] of consumptionEntries) {
            const dailyItem = daily.items.find((i: any) => i.inventoryItemId === itemId);
            if (dailyItem) {
                await prisma.dailyInventoryItem.updateMany({
                    where: { id: dailyItem.id, dailyInventoryId: dailyId },
                    data: { sales: { increment: qty } }
                });
            }
        }

        revalidatePath('/dashboard/inventario/diario');
        return { success: true, message: 'Ventas procesadas y consumo calculado' };
    } catch (error) {
        console.error('Error al procesar ventas manuales:', error);
        return { success: false, message: 'Error procesando ventas' };
    }
}

// ============================================================================
// PROCESAR VENTAS DESDE WHATSAPP PARA INVENTARIO DIARIO
// ============================================================================
export async function processWhatsAppSalesForDailyAction(
    dailyId: string,
    parsedProducts: {
        productName: string;
        quantity: number;
        proteinBreakdown: { inventoryItemId: string; grams: number }[];
    }[]
) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const daily = await db.dailyInventory.findFirst({
            where: { id: dailyId },
            include: { items: true }
        });
        if (!daily) return { success: false, message: 'Inventario no encontrado' };
        if (daily.status === 'CLOSED') return { success: false, message: 'El inventario de este día ya fue cerrado' };

        // Acumular consumo por inventoryItemId
        const totalConsumption = new Map<string, number>();

        for (const product of parsedProducts) {
            if (product.quantity <= 0) continue;

            for (const breakdown of product.proteinBreakdown) {
                const current = totalConsumption.get(breakdown.inventoryItemId) || 0;
                totalConsumption.set(breakdown.inventoryItemId, current + (breakdown.grams * product.quantity));
            }
        }

        // Acumular en el campo 'sales' de cada item del inventario diario
        let updatedCount = 0;
        for (const [itemId, totalGrams] of Array.from(totalConsumption.entries())) {
            const dailyItem = daily.items.find((i: any) => i.inventoryItemId === itemId);
            if (dailyItem) {
                const unit = dailyItem.unit?.toUpperCase() || '';
                const valueToAdd = unit === 'KG' ? totalGrams / 1000 : totalGrams;

                await prisma.dailyInventoryItem.updateMany({
                    where: { id: dailyItem.id, dailyInventoryId: dailyId },
                    data: { sales: { increment: valueToAdd } }
                });
                updatedCount++;
            }
        }

        revalidatePath('/dashboard/inventario/diario');
        return {
            success: true,
            message: `Consumo procesado: ${updatedCount} productos actualizados`,
            updatedCount
        };
    } catch (error) {
        console.error('Error procesando ventas WhatsApp:', error);
        return { success: false, message: 'Error procesando ventas de WhatsApp' };
    }
}

// ============================================================================
// SINCRONIZAR VENTAS DESDE CARGAR VENTAS / POS (SalesOrder)
// ============================================================================
export async function syncSalesFromOrdersAction(dailyId: string): Promise<{ success: boolean; message: string; orderCount?: number }> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const daily = await db.dailyInventory.findFirst({
            where: { id: dailyId },
            include: { items: true }
        });
        if (!daily) return { success: false, message: 'Inventario no encontrado' };

        const startOfDay = new Date(daily.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(daily.date);
        endOfDay.setHours(23, 59, 59, 999);

        const orders = await db.salesOrder.findMany({
            where: {
                areaId: daily.areaId,
                status: 'COMPLETED',
                createdAt: { gte: startOfDay, lte: endOfDay }
            },
            include: {
                items: { include: { menuItem: true } }
            }
        });

        const totalConsumption = new Map<string, number>();

        for (const order of orders) {
            for (const item of order.items) {
                if (item.quantity <= 0) continue;

                const menuItem = item.menuItem;
                if (menuItem?.recipeId) {
                    const recipe = await db.recipe.findFirst({
                        where: { id: menuItem.recipeId },
                        include: { ingredients: true }
                    });
                    if (recipe) {
                        for (const ing of recipe.ingredients) {
                            const qty = ing.quantity * item.quantity;
                            const current = totalConsumption.get(ing.ingredientItemId) || 0;
                            totalConsumption.set(ing.ingredientItemId, current + qty);
                        }
                    }
                }
            }
        }

        const itemsWithConsumption = Array.from(totalConsumption.entries());
        for (const [itemId, consumption] of itemsWithConsumption) {
            const dailyItem = daily.items.find((i: any) => i.inventoryItemId === itemId);
            if (dailyItem) {
                await prisma.dailyInventoryItem.updateMany({
                    where: { id: dailyItem.id, dailyInventoryId: dailyId },
                    data: { sales: consumption }
                });
            }
        }

        revalidatePath('/dashboard/inventario/diario');
        return {
            success: true,
            message: `Ventas sincronizadas: ${orders.length} órdenes importadas`,
            orderCount: orders.length
        };
    } catch (error) {
        console.error('Error sincronizando ventas:', error);
        return { success: false, message: 'Error al sincronizar ventas' };
    }
}

// ============================================================================
// CERRAR DÍA
// ============================================================================
export async function closeDailyInventoryAction(dailyId: string) {
    const guard = await checkActionPermission(PERM.CLOSE_DAILY_INV);
    if (!guard.ok) return { success: false, message: guard.message };

    try {
        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).dailyInventory.updateMany({
            where: { id: dailyId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: guard.user.id
            }
        });
        if (res.count === 0) return { success: false, message: 'Inventario no encontrado' };

        revalidatePath('/dashboard/inventario/diario');
        return { success: true, message: 'Inventario diario finalizado exitosamente' };
    } catch (error) {
        console.error('Error closing inventory:', error);
        return { success: false, message: 'Error al finalizar' };
    }
}

// ============================================================================
// REABRIR DÍA (Solo OWNER/AUDITOR)
// ============================================================================
export async function reopenDailyInventoryAction(dailyId: string) {
    try {
        const session = await getSession();
        if (!session || !['OWNER', 'AUDITOR'].includes(session.role)) {
            return { success: false, message: 'Solo el propietario o auditor puede reabrir un día cerrado' };
        }

        const { tenantId } = await resolveTenantContext();
        const res = await withTenant(tenantId).dailyInventory.updateMany({
            where: { id: dailyId },
            data: {
                status: 'DRAFT',
                closedAt: null,
                closedById: null
            }
        });
        if (res.count === 0) return { success: false, message: 'Inventario no encontrado' };

        revalidatePath('/dashboard/inventario/diario');
        return { success: true, message: 'Día reabierto exitosamente' };
    } catch (error) {
        console.error('Error reopening inventory:', error);
        return { success: false, message: 'Error al reabrir' };
    }
}

// ============================================================================
// RESUMEN POR RANGO DE FECHAS (REEMPLAZA EL ANTERIOR SEMANAL)
// ============================================================================
export async function getInventorySummaryByRangeAction(
    areaId: string,
    startDateStr: string,
    endDateStr: string
) {
    try {
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const dailies = await db.dailyInventory.findMany({
            where: {
                areaId,
                date: { gte: startDate, lte: endDate }
            },
            include: {
                items: {
                    include: { inventoryItem: true }
                },
                area: true
            },
            orderBy: { date: 'asc' }
        });

        const summary = dailies.map(d => {
            const totalVariance = d.items.reduce((sum, i) => sum + (i.variance || 0), 0);
            const negativeCount = d.items.filter(i => (i.variance || 0) < -0.01).length;
            const totalWaste = d.items.reduce((sum, i) => sum + (i.waste || 0), 0);
            return {
                id: d.id,
                date: d.date,
                status: d.status,
                itemCount: d.items.length,
                totalVariance,
                negativeCount,
                totalWaste,
                closedAt: d.closedAt,
                items: d.items.map(item => ({
                    name: item.inventoryItem.name,
                    unit: item.unit,
                    initialCount: item.initialCount || 0,
                    entries: item.entries || 0,
                    sales: item.sales || 0,
                    waste: item.waste || 0,
                    theoreticalStock: item.theoreticalStock || 0,
                    finalCount: item.finalCount || 0,
                    variance: item.variance || 0,
                }))
            };
        });

        return { success: true, data: summary };
    } catch (error) {
        console.error('Error getting range summary:', error);
        return { success: false, data: [] };
    }
}

// Mantener compat con el anterior
export async function getWeeklyInventorySummaryAction(areaId: string, endDateStr?: string) {
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    return getInventorySummaryByRangeAction(areaId, startDate.toISOString(), endDate.toISOString());
}

// ============================================================================
// ESTADO DE DÍAS EN RANGO (para el mini-calendario)
// ============================================================================
export async function getDaysStatusAction(areaId: string, startDateStr: string, endDateStr: string) {
    try {
        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const dailies = await db.dailyInventory.findMany({
            where: {
                areaId,
                date: { gte: startDate, lte: endDate }
            },
            select: {
                date: true,
                status: true,
                closedAt: true
            },
            orderBy: { date: 'asc' }
        });

        const daysMap: Record<string, { status: string; closedAt: string | null }> = {};
        for (const d of dailies) {
            const dateKey = d.date.toISOString().split('T')[0];
            daysMap[dateKey] = {
                status: d.status,
                closedAt: d.closedAt?.toISOString() || null
            };
        }

        return { success: true, data: daysMap };
    } catch (error) {
        console.error('Error getting days status:', error);
        return { success: false, data: {} };
    }
}

// ============================================================================
// GESTIONAR LISTA DE CRÍTICOS POR ÁREA
// ============================================================================
export async function searchItemsForCriticalListAction(query: string, areaId: string) {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const items = await db.inventoryItem.findMany({
            where: {
                isActive: true,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { sku: { contains: query, mode: 'insensitive' } }
                ]
            },
            orderBy: { name: 'asc' },
            take: 50
        });

        // AreaCriticalItem no es tenant-aware; el areaId ya está validado
        // (los items ya están filtrados por tenant arriba, así que el cruce
        // es seguro).
        const areaCriticals = await prisma.areaCriticalItem.findMany({
            where: { areaId },
            select: { inventoryItemId: true }
        });
        const criticalSet = new Set(areaCriticals.map(ac => ac.inventoryItemId));

        const itemsWithCritical = items.map(item => ({
            ...item,
            isCriticalForArea: criticalSet.has(item.id)
        }));

        return { success: true, data: itemsWithCritical };
    } catch (e) {
        console.error('Error searching items:', e);
        return { success: false, data: [] };
    }
}

export async function toggleItemCriticalStatusAction(itemId: string, isCritical: boolean, areaId: string) {
    try {
        const session = await getSession();
        if (!session || !['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
            return { success: false, message: 'Permisos insuficientes' };
        }

        // Validar ownership de areaId + itemId antes de tocar el pivot.
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const [ownedArea, ownedItem] = await Promise.all([
            db.area.findFirst({ where: { id: areaId }, select: { id: true } }),
            db.inventoryItem.findFirst({ where: { id: itemId }, select: { id: true } }),
        ]);
        if (!ownedArea || !ownedItem) {
            return { success: false, message: 'Área o item no encontrados' };
        }

        if (isCritical) {
            await prisma.areaCriticalItem.upsert({
                where: { areaId_inventoryItemId: { areaId, inventoryItemId: itemId } },
                create: { areaId, inventoryItemId: itemId },
                update: {}
            });
        } else {
            await prisma.areaCriticalItem.deleteMany({
                where: { areaId, inventoryItemId: itemId }
            });
        }

        revalidatePath('/dashboard/inventario/diario');
        return { success: true };
    } catch (e) {
        console.error('Error toggling critical status:', e);
        return { success: false, message: 'Error actualizando item' };
    }
}

// ============================================================================
// OBTENER PROTEÍNAS CRÍTICAS PARA MAPEO DE WHATSAPP
// ============================================================================
export async function getCriticalProteinItemsAction(areaId: string) {
    try {
        // areaCriticalItem.findMany filtrando por areaId; los inventoryItem
        // adjuntos vienen vía FK. Para tenant-safety, validamos area upstream.
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const ownedArea = await db.area.findFirst({
            where: { id: areaId },
            select: { id: true },
        });
        if (!ownedArea) return { success: false, data: [] };

        const areaCriticals = await prisma.areaCriticalItem.findMany({
            where: { areaId },
            include: {
                inventoryItem: true
            }
        });

        const items = areaCriticals
            .map(ac => ac.inventoryItem)
            .filter(i => i.isActive)
            .map(i => ({
                id: i.id,
                name: i.name,
                sku: i.sku,
                baseUnit: i.baseUnit,
                category: i.category
            }));

        return { success: true, data: items };
    } catch (error) {
        console.error('Error getting critical protein items:', error);
        return { success: false, data: [] };
    }
}

/**
 * Devuelve la lista de categorías distintas (no null) del catálogo de items
 * para alimentar el selector del filtro "Por categoría" del inventario físico.
 */
export async function getInventoryCategoriesAction(): Promise<{ success: boolean; data: string[] }> {
    try {
        const { tenantId } = await resolveTenantContext();
        const db = withTenant(tenantId);
        const rows = await db.inventoryItem.findMany({
            where: { isActive: true, category: { not: null } },
            select: { category: true },
            distinct: ['category'],
            orderBy: { category: 'asc' },
        });
        const values = rows
            .map((r: { category: string | null }) => r.category)
            .filter((c: string | null): c is string => !!c && c.trim().length > 0);
        return { success: true, data: values };
    } catch (error) {
        console.error('Error fetching inventory categories:', error);
        return { success: false, data: [] };
    }
}
