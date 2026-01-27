'use server';

import prisma from '@/server/db';
import { getStockStatus } from '@/lib/utils'; // Assuming this is safe to use on server
import { InventoryItemType } from '@/types';

export async function getDashboardStatsAction() {
    try {
        const items = await prisma.inventoryItem.findMany({
            where: { isActive: true },
            include: {
                stockLevels: true,
                costHistory: {
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1
                }
            }
        });

        // Process items to calculate stock and status
        const processedItems = items.map(item => {
            const currentStock = item.stockLevels.reduce((acc, level) => acc + Number(level.currentStock || 0), 0);

            // Decimal to Number conversion for safety if Prisma returns Decimals (though schema showed Float, sometimes safe to be sure)
            // Schema says Float, so it should be number. But we saw previous issues. 
            // We will treat them as numbers.

            const costPerUnit = Number(item.costHistory[0]?.costPerUnit || 0);
            const stockStatus = getStockStatus(currentStock, Number(item.minimumStock), Number(item.reorderPoint));

            return {
                ...item,
                currentStock,
                costPerUnit,
                stockStatus
            };
        });

        const totalItems = processedItems.length;
        const subRecipes = processedItems.filter(i => i.type === 'SUB_RECIPE').length;
        const finishedGoods = processedItems.filter(i => i.type === 'FINISHED_GOOD').length;

        // Filter low stock items
        const lowStockItems = processedItems.filter(i => i.stockStatus.status !== 'ok');

        return {
            stats: {
                totalItems,
                lowStockCount: lowStockItems.length,
                subRecipes,
                finishedGoods
            },
            lowStockItems: lowStockItems.map(item => ({
                id: item.id,
                name: item.name,
                sku: item.sku,
                type: item.type,
                category: item.category,
                currentStock: Number(item.currentStock),
                minimumStock: Number(item.minimumStock),
                reorderPoint: Number(item.reorderPoint),
                baseUnit: item.baseUnit,
                costPerUnit: Number(item.costPerUnit),
                status: item.stockStatus
            }))
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        throw new Error('Failed to fetch dashboard stats');
    }
}
