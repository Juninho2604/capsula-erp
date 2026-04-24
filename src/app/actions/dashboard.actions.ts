'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { getStockStatus } from '@/lib/utils'; // Assuming this is safe to use on server
import { InventoryItemType } from '@/types';
import { getCaracasDayRange } from '@/lib/datetime';
import { revenueWhere, propinasWhere, cancelledWhere } from '@/lib/sales-where';

export async function getDashboardStatsAction() {
    try {
        const session = await getSession();
        const isAdmin = session && ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD', 'AUDITOR'].includes(session.role);

        const { start: todayStart, end: todayEnd } = getCaracasDayRange();
        const { start: yesterdayStart, end: yesterdayEnd } = getCaracasDayRange(new Date(Date.now() - 86400000));

        const [items, todaySalesAgg, yesterdaySalesAgg, openTabsAgg, propinasHoyAgg, canceladasHoyAgg] = await Promise.all([
            prisma.inventoryItem.findMany({
                where: { isActive: true },
                include: {
                    stockLevels: true,
                    costHistory: {
                        orderBy: { effectiveFrom: 'desc' },
                        take: 1
                    }
                }
            }),
            // Today's sales
            isAdmin ? prisma.salesOrder.aggregate({
                where: revenueWhere(todayStart, todayEnd),
                _sum: { total: true },
                _count: { id: true },
            }) : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
            // Yesterday comparison
            isAdmin ? prisma.salesOrder.aggregate({
                where: revenueWhere(yesterdayStart, yesterdayEnd),
                _sum: { total: true },
                _count: { id: true },
            }) : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
            // Open tabs
            isAdmin ? prisma.openTab.aggregate({
                where: { status: 'OPEN' },
                _count: { id: true },
                _sum: { balanceDue: true },
            }) : Promise.resolve({ _count: { id: 0 }, _sum: { balanceDue: null } }),
            // Propinas colectivas hoy
            isAdmin ? prisma.salesOrder.aggregate({
                where: propinasWhere(todayStart, todayEnd),
                _sum: { total: true },
                _count: { id: true },
            }) : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
            // Órdenes canceladas hoy (auditoría)
            isAdmin ? prisma.salesOrder.aggregate({
                where: cancelledWhere(todayStart, todayEnd),
                _sum: { total: true },
                _count: { id: true },
            }) : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
        ]);

        // Process items to calculate stock and status
        const processedItems = items.map(item => {
            const currentStock = item.stockLevels.reduce((acc, level) => acc + Number(level.currentStock || 0), 0);
            const costPerUnit = Number(item.costHistory[0]?.costPerUnit || 0);
            const stockStatus = getStockStatus(currentStock, Number(item.minimumStock), Number(item.reorderPoint));
            return { ...item, currentStock, costPerUnit, stockStatus };
        });

        const totalItems = processedItems.length;
        const subRecipes = processedItems.filter(i => i.type === 'SUB_RECIPE').length;
        const finishedGoods = processedItems.filter(i => i.type === 'FINISHED_GOOD').length;
        const lowStockItems = processedItems.filter(i => i.stockStatus.status !== 'ok');

        const todayRevenue = Number(todaySalesAgg._sum.total || 0);
        const todayOrders = todaySalesAgg._count.id;
        const yesterdayRevenue = Number(yesterdaySalesAgg._sum.total || 0);

        return {
            stats: {
                totalItems,
                lowStockCount: lowStockItems.length,
                subRecipes,
                finishedGoods,
            },
            salesKPIs: isAdmin ? {
                todayRevenue,
                todayOrders,
                avgTicket: todayOrders > 0 ? todayRevenue / todayOrders : 0,
                yesterdayRevenue,
                yesterdayOrders: yesterdaySalesAgg._count.id,
                revenueChange: yesterdayRevenue > 0
                    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
                    : null,
                openTabs: openTabsAgg._count.id,
                openTabsExposed: Number(openTabsAgg._sum.balanceDue || 0),
                propinasHoy: {
                    total: Number(propinasHoyAgg._sum.total || 0),
                    count: propinasHoyAgg._count.id,
                },
                canceladasHoy: {
                    count: canceladasHoyAgg._count.id,
                    total: Number(canceladasHoyAgg._sum.total || 0),
                },
            } : null,
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
