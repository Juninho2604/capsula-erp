/**
 * Aplica una transición de estado a una orden de delivery: persiste el nuevo
 * estado, registra el `DeliveryOrderEvent` de auditoría y dispara los efectos
 * laterales de cada estado.
 *
 * Centralizado acá para que TODOS los caminos (validación 1-clic desde la UI,
 * PATCH desde n8n, auto-validación al subir comprobante, asignación de
 * motorizado) compartan la misma regla:
 *   - al entrar a EN_COCINA se encola la impresión de la comanda;
 *   - cada estado observable por el bot encola un webhook saliente (outbox).
 *
 * Concurrencia: el update es GUARDADO por `status = from` (+ tenantId). Si otra
 * request ya movió la orden (retry de n8n, doble clic, modo AUTO), el
 * updateMany afecta 0 filas y se omiten evento + efectos → idempotente, sin
 * doble impresión ni doble webhook. Devuelve `false` en ese caso.
 *
 * El caller DEBE haber validado antes que la transición es legal
 * (`canTransition(from, to)`).
 *
 * server-only: usa el cliente base con tenantId explícito en el `where`.
 */

import 'server-only';
import prisma from '@/server/db';
import type { Prisma } from '@prisma/client';
import { STATE_WEBHOOK_EVENT, type DeliveryState } from './state-machine';
import { enqueueDeliveryPrintJob } from './enqueue-print';
import { enqueueDeliveryWebhook } from './webhook';
import type { DeliveryOrderForPrint } from './print';

export interface TransitionOrder extends DeliveryOrderForPrint {
    id: string;
    branchId: string | null;
}

export async function applyDeliveryTransition(params: {
    tenantId: string;
    order: TransitionOrder;
    from: DeliveryState;
    to: DeliveryState;
    userId?: string | null;
    cancelReason?: string | null;
    note?: string | null;
    /** Campos escalares extra a setear en el mismo update guardado (ej.
     *  driverId/assignedAt al asignar motorizado). */
    extraData?: Prisma.DeliveryOrderUncheckedUpdateManyInput;
}): Promise<boolean> {
    const { tenantId, order, from, to, userId, cancelReason, note, extraData } = params;

    const data: Prisma.DeliveryOrderUncheckedUpdateManyInput = {
        ...(extraData ?? {}),
        status: to,
    };
    if (to === 'CANCELADA') {
        data.cancelReason = cancelReason ?? null;
    }
    // Validación de pago: PAGO_POR_VALIDAR → EN_COCINA deja traza de quién validó.
    if (to === 'EN_COCINA' && from === 'PAGO_POR_VALIDAR') {
        data.paymentValidatedById = userId ?? null;
        data.paymentValidatedAt = new Date();
    }

    // Update guardado por estado actual (concurrencia optimista) + tenant.
    const res = await prisma.deliveryOrder.updateMany({
        where: { id: order.id, tenantId, status: from },
        data,
    });
    if (res.count === 0) {
        // Otra request ya transicionó (retry / carrera) → no-op idempotente.
        return false;
    }

    await prisma.deliveryOrderEvent.create({
        data: {
            orderId: order.id,
            fromState: from,
            toState: to,
            userId: userId ?? null,
            note: note ?? (to === 'CANCELADA' ? cancelReason ?? null : null),
        },
    });

    // Efecto lateral 1: imprimir la comanda al pasar a cocina.
    if (to === 'EN_COCINA') {
        await enqueueDeliveryPrintJob(tenantId, order, userId ?? null);
    }
    // Efecto lateral 2: webhook saliente para estados observables por el bot.
    if (STATE_WEBHOOK_EVENT[to]) {
        await enqueueDeliveryWebhook(tenantId, STATE_WEBHOOK_EVENT[to]!, order.id);
    }

    return true;
}
