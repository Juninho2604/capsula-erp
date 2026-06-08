/**
 * Aplica una transición de estado a una orden de delivery: persiste el nuevo
 * estado, registra el `DeliveryOrderEvent` de auditoría y dispara los efectos
 * laterales de cada estado.
 *
 * Centralizado acá para que TODOS los caminos (validación 1-clic desde la UI,
 * PATCH desde n8n, auto-validación al subir comprobante) compartan la misma
 * regla: **al entrar a EN_COCINA se encola la impresión de la comanda**.
 *
 * El caller DEBE haber validado antes:
 *   - ownership (la orden pertenece al tenant) — via `withTenant().findFirst`
 *   - que la transición es legal — via `canTransition(from, to)`
 *
 * server-only: usa el cliente base + tenantId explícito (update no se filtra
 * por la extensión de tenant; la ownership ya se validó arriba).
 */

import 'server-only';
import prisma from '@/server/db';
import type { Prisma } from '@prisma/client';
import type { DeliveryState } from './state-machine';
import { enqueueDeliveryPrintJob } from './enqueue-print';
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
}): Promise<void> {
    const { tenantId, order, from, to, userId, cancelReason, note } = params;

    const data: Prisma.DeliveryOrderUpdateInput = {
        status: to,
        events: {
            create: {
                fromState: from,
                toState: to,
                userId: userId ?? null,
                note: note ?? (to === 'CANCELADA' ? cancelReason ?? null : null),
            },
        },
    };

    if (to === 'CANCELADA') {
        data.cancelReason = cancelReason ?? null;
    }
    // Validación de pago: PAGO_POR_VALIDAR → EN_COCINA deja traza de quién validó.
    if (to === 'EN_COCINA' && from === 'PAGO_POR_VALIDAR') {
        data.paymentValidatedById = userId ?? null;
        data.paymentValidatedAt = new Date();
    }

    await prisma.deliveryOrder.update({ where: { id: order.id }, data });

    // Efecto lateral: imprimir la comanda al pasar a cocina.
    if (to === 'EN_COCINA') {
        await enqueueDeliveryPrintJob(tenantId, order, userId ?? null);
    }
}
