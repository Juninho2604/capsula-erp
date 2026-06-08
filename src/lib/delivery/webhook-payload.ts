/**
 * Builder PURO del body de un webhook saliente. Forma:
 *   { evento, orden: { ...resumen... } }
 *
 * El bot (n8n) usa esto para avisarle al cliente ("¡Tu pedido va en camino!")
 * y para disparar el flujo de motorizados.
 */

export interface WebhookOrderInput {
    id: string;
    correlative: string;
    status: string;
    channel: string;
    chatId: string | null;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    totalUsd: number | null;
    branch: { id: string; name: string } | null;
    driver: { id: string; name: string; phone: string } | null;
}

export interface WebhookBody {
    evento: string;
    orden: {
        id: string;
        correlativo: string;
        estado: string;
        canal: string;
        chat_id: string | null;
        cliente: { nombre: string | null; telefono: string | null };
        direccion: string | null;
        total_usd: number | null;
        sede: { id: string; nombre: string } | null;
        motorizado: { id: string; nombre: string; telefono: string } | null;
    };
}

export function buildWebhookPayload(event: string, order: WebhookOrderInput): WebhookBody {
    return {
        evento: event,
        orden: {
            id: order.id,
            correlativo: order.correlative,
            estado: order.status,
            canal: order.channel,
            chat_id: order.chatId,
            cliente: { nombre: order.customerName, telefono: order.customerPhone },
            direccion: order.deliveryAddress,
            total_usd: order.totalUsd,
            sede: order.branch ? { id: order.branch.id, nombre: order.branch.name } : null,
            motorizado: order.driver
                ? { id: order.driver.id, nombre: order.driver.name, telefono: order.driver.phone }
                : null,
        },
    };
}
