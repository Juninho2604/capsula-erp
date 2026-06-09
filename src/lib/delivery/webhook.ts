/**
 * Encola un webhook saliente en el outbox (`DeliveryWebhookOutbox`). La entrega
 * real (POST firmado a n8n con reintentos) la hace el cron
 * /api/cron/deliver-webhooks — acá solo persistimos el evento (patrón outbox
 * §18.40/41: no fire-and-forget).
 *
 * Re-fetcha la orden con sede + motorizado para que el payload salga completo
 * y fresco (el caller solo tiene un snapshot parcial). Best-effort: NUNCA lanza.
 */

import 'server-only';
import prisma from '@/server/db';
import { buildWebhookPayload } from './webhook-payload';

export async function enqueueDeliveryWebhook(
    tenantId: string,
    event: string,
    orderId: string,
): Promise<void> {
    try {
        const order = await prisma.deliveryOrder.findFirst({
            where: { id: orderId, tenantId },
            select: {
                id: true,
                correlative: true,
                status: true,
                channel: true,
                chatId: true,
                customerName: true,
                customerPhone: true,
                deliveryAddress: true,
                totalUsd: true,
                branch: { select: { id: true, name: true } },
                driver: { select: { id: true, name: true, phone: true } },
            },
        });
        if (!order) return;

        const payload = buildWebhookPayload(event, order);
        await prisma.deliveryWebhookOutbox.create({
            data: { tenantId, event, payload: payload as unknown as object },
        });
    } catch (err) {
        console.error('[delivery] enqueueDeliveryWebhook falló:', err);
    }
}
