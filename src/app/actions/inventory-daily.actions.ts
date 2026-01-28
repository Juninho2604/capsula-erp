'use server';

import prisma from '@/server/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

// ============================================================================
// OBTENER INVENTARIO DIARIO (Sincronizado)
// ============================================================================
export async function getDailyInventoryAction(dateStr: string, areaId: string) {
    try {
        const date = new Date(dateStr);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        // 1. Obtener Stock Real Actual para Theoretical Snapshot
        const locations = await prisma.inventoryLocation.findMany({
            where: { areaId },
            select: { inventoryItemId: true, currentStock: true }
        });
        const stockMap = new Map(locations.map(l => [l.inventoryItemId, l.currentStock]));

        // 2. Buscar Inventario Diario
        let daily = await prisma.dailyInventory.findUnique({
            where: { date_areaId: { date: startOfDay, areaId: areaId } },
            include: {
                items: {
                    include: { inventoryItem: true },
                    orderBy: { inventoryItem: { name: 'asc' } }
                }
            }
        });

        // 3. Obtener ITEMS CRÍTICOS ACTIVOS
        const criticalItems = await prisma.inventoryItem.findMany({
            where: {
                isActive: true,
                isCritical: true // Solo items marcados como críticos
            },
            orderBy: { name: 'asc' }
        });

        if (!daily) {
            console.log('Creando nuevo DailyInventory...');

            // Buscar día anterior para arrastre
            const yesterday = new Date(startOfDay);
            yesterday.setDate(yesterday.getDate() - 1);

            const prevDaily = await prisma.dailyInventory.findUnique({
                where: { date_areaId: { date: yesterday, areaId } },
                include: { items: true }
            });
            const prevMap = new Map(prevDaily?.items.map(i => [i.inventoryItemId, i.finalCount]) || []);

            daily = await prisma.dailyInventory.create({
                data: {
                    date: startOfDay,
                    areaId,
                    status: 'DRAFT',
                    items: {
                        create: criticalItems.map(item => ({
                            inventoryItemId: item.id,
                            unit: item.baseUnit,
                            initialCount: prevMap.get(item.id) || 0,
                            finalCount: 0,
                            theoreticalStock: stockMap.get(item.id) || 0,
                            variance: 0
                        }))
                    }
                },
                include: { items: { include: { inventoryItem: true } } }
            });

        } else if (daily.status !== 'CLOSED') {
            // 4. SYNC: Verificar si hay items críticos nuevos que no están en el daily
            const existingItemIds = new Set(daily.items.map(i => i.inventoryItemId));
            const missingCriticals = criticalItems.filter(ci => !existingItemIds.has(ci.id));

            if (missingCriticals.length > 0) {
                console.log(`Sync: Agregando ${missingCriticals.length} items críticos nuevos al reporte.`);
                await prisma.dailyInventoryItem.createMany({
                    data: missingCriticals.map(item => ({
                        dailyInventoryId: daily!.id,
                        inventoryItemId: item.id,
                        unit: item.baseUnit,
                        initialCount: 0,
                        finalCount: 0,
                        theoreticalStock: stockMap.get(item.id) || 0,
                        variance: 0
                    }))
                });

                // Recargar daily completo
                daily = await prisma.dailyInventory.findUnique({
                    where: { id: daily.id },
                    include: {
                        items: {
                            include: { inventoryItem: true },
                            orderBy: { inventoryItem: { name: 'asc' } }
                        }
                    }
                });
            }

            if (daily) {
                daily.items = daily.items.map(item => ({
                    ...item,
                    theoreticalStock: stockMap.get(item.inventoryItemId) ?? item.theoreticalStock
                }));
            }

            // 5. CLEAN: Remover items que YA NO son críticos del reporte
            // Esto soluciona reportes creados antes de activar el filtro de críticos
            const nonCriticalIds = daily?.items
                .filter(i => !i.inventoryItem.isCritical)
                .map(i => i.id) || [];

            if (nonCriticalIds.length > 0) {
                console.log(`Clean: Removiendo ${nonCriticalIds.length} items no críticos del reporte.`);
                await prisma.dailyInventoryItem.deleteMany({
                    where: { id: { in: nonCriticalIds } }
                });

                // Recarga final limpia
                daily = await prisma.dailyInventory.findUnique({
                    where: { id: daily!.id },
                    include: {
                        items: {
                            include: { inventoryItem: true },
                            orderBy: { inventoryItem: { name: 'asc' } }
                        }
                    }
                });

                // Re-aplicar map teórico si recargamos
                if (daily) {
                    daily.items = daily.items.map(item => ({
                        ...item,
                        theoreticalStock: stockMap.get(item.inventoryItemId) ?? item.theoreticalStock
                    }));
                }
            }
        }

        return { success: true, data: daily };

    } catch (error) {
        console.error('Error getting daily inventory:', error);
        return { success: false, message: 'Error cargando inventario diario' };
    }
}

// ============================================================================
// GUARDAR CONTEOS
// ============================================================================
export async function saveDailyInventoryCountsAction(dailyId: string, itemsData: any[]) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        await prisma.$transaction(
            itemsData.map(item =>
                prisma.dailyInventoryItem.update({
                    where: { id: item.id },
                    data: {
                        initialCount: parseFloat(item.initialCount) || 0,
                        finalCount: parseFloat(item.finalCount) || 0,
                        theoreticalStock: item.theoreticalStock,
                        variance: (parseFloat(item.finalCount) || 0) - (item.theoreticalStock || 0),
                        notes: item.notes
                    }
                })
            )
        );

        revalidatePath('/dashboard/inventario/diario');
        return { success: true, message: 'Guardado correctamente' };
    } catch (error) {
        console.error('Error saving counts:', error);
        return { success: false, message: 'Error al guardar conteo' };
    }
}

// ============================================================================
// CERRAR DÍA
// ============================================================================
export async function closeDailyInventoryAction(dailyId: string) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        await prisma.dailyInventory.update({
            where: { id: dailyId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: session.id
            }
        });

        revalidatePath('/dashboard/inventario/diario');
        return { success: true, message: 'Inventario cerrado exitosamente' };
    } catch (error) {
        console.error('Error closing inventory:', error);
        return { success: false, message: 'Error al cerrar inventario' };
    }
}

// ============================================================================
// GESTIONAR LISTA DE CRÍTICOS
// ============================================================================
export async function searchItemsForCriticalListAction(query: string) {
    try {
        const items = await prisma.inventoryItem.findMany({
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
        return { success: true, data: items };
    } catch (e) {
        return { success: false, data: [] };
    }
}

export async function toggleItemCriticalStatusAction(itemId: string, isCritical: boolean) {
    try {
        const session = await getSession();
        // Verificar rol (simplificado)
        if (!session || !['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
            return { success: false, message: 'Permisos insuficientes' };
        }

        await prisma.inventoryItem.update({
            where: { id: itemId },
            data: { isCritical }
        });

        // Revalidamos para que el getDailyInventory detecte el cambio en el próximo refresh
        revalidatePath('/dashboard/inventario/diario');
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Error actualizando item' };
    }
}
