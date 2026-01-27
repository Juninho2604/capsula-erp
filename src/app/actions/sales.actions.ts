'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

export interface SalesFilter {
    startDate?: Date;
    endDate?: Date;
    orderType?: string;
}

export interface ZReportData {
    period: string;
    totalOrders: number;
    grossTotal: number; // Subtotal
    totalDiscounts: number;
    discountBreakdown: {
        divisas: number;
        cortesias: number;
        other: number;
    };
    netTotal: number; // Total real cobrado
    paymentBreakdown: {
        cash: number;
        card: number;
        transfer: number;
        mobile: number;
        other: number;
    };
    ordersByStatus: Record<string, number>;
}

export async function getSalesHistoryAction(limit = 50) {
    try {
        const sales = await prisma.salesOrder.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                authorizedBy: {
                    select: { firstName: true, lastName: true }
                },
                createdBy: {
                    select: { firstName: true, lastName: true }
                }
            }
        });
        return { success: true, data: sales };
    } catch (error) {
        console.error('Error fetching sales:', error);
        return { success: false, message: 'Error cargando historial' };
    }
}

export async function getDailyZReportAction(): Promise<{ success: boolean; data?: ZReportData; message?: string }> {
    try {
        // Por defecto hoy
        const today = new Date();
        const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

        const todaysOrders = await prisma.salesOrder.findMany({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                status: { not: 'CANCELLED' }
            }
        });

        // Cálculos
        let grossTotal = 0;
        let totalDiscounts = 0;
        let discountDivisas = 0;
        let discountCortesias = 0;
        let paymentCash = 0;
        let paymentCard = 0;
        let paymentTransfer = 0;
        let paymentMobile = 0;

        for (const order of todaysOrders) {
            grossTotal += order.subtotal;
            totalDiscounts += order.discount;

            // Desglose Descuentos
            if (order.discountType === 'DIVISAS_33') discountDivisas += order.discount;
            else if (order.discountType === 'CORTESIA_100') discountCortesias += order.discount;

            // Desglose Pagos (Total cobrado)
            const paid = order.total; // Asumimos total de orden como pagado si no está cancelada

            // Normalizar paymentMethod
            const pm = order.paymentMethod?.toUpperCase() || 'UNKNOWN';

            if (pm === 'CASH') paymentCash += paid;
            else if (pm === 'CARD' || pm === 'DEBIT_CARD') paymentCard += paid;
            else if (pm === 'TRANSFER' || pm === 'BANK_TRANSFER') paymentTransfer += paid;
            else if (pm === 'MOBILE_PAY' || pm === 'PAGO_MOVIL') paymentMobile += paid;
            else paymentMobile += paid; // Fallback temporal si hay "MULTIPLE" o raros, lo metemos en otros o mobile
        }

        const netTotal = grossTotal - totalDiscounts;

        return {
            success: true,
            data: {
                period: today.toLocaleDateString(),
                totalOrders: todaysOrders.length,
                grossTotal,
                totalDiscounts,
                discountBreakdown: {
                    divisas: discountDivisas,
                    cortesias: discountCortesias,
                    other: totalDiscounts - discountDivisas - discountCortesias
                },
                netTotal,
                paymentBreakdown: {
                    cash: paymentCash,
                    card: paymentCard,
                    transfer: paymentTransfer,
                    mobile: paymentMobile,
                    other: 0
                },
                ordersByStatus: {}
            }
        };

    } catch (error) {
        console.error('Error generating Z report:', error);
        return { success: false, message: 'Error generando reporte Z' };
    }
}
