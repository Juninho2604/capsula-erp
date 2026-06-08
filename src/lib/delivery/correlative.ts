/**
 * Generación atómica del correlativo de orden de delivery (PP-00127).
 *
 * El contador vive en `DeliveryTenantConfig.nextCorrelative` (= próximo número
 * a asignar). Se incrementa atómicamente; el número asignado es el valor
 * PREVIO al incremento. Persistido en BD, por tenant.
 *
 * Para que el correlativo quede SIN HUECOS (lección §18.19), `reserveCorrelative`
 * recibe un `tx` y debe usarse en la MISMA transacción que crea la orden: si
 * la creación falla, el rollback revierte también el incremento del contador.
 *
 * NO son funciones puras (tocan BD). El formato sí: `formatCorrelative`.
 */

import type { Prisma } from '@prisma/client';
import prisma from '@/server/db';

export function formatCorrelative(prefix: string, n: number): string {
    return `${prefix}-${String(n).padStart(5, '0')}`;
}

/**
 * Reserva el siguiente correlativo dentro de una transacción dada. Atómico
 * (un solo UPDATE con increment). Si el tenant no tiene config, la crea con
 * el primer número = 1.
 *
 * Debe llamarse dentro del mismo `prisma.$transaction` que crea la orden para
 * que un fallo posterior revierta el incremento (sin huecos).
 */
export async function reserveCorrelative(
    tx: Prisma.TransactionClient,
    tenantId: string,
): Promise<string> {
    const cfg = await tx.deliveryTenantConfig.upsert({
        where: { tenantId },
        // Primer uso: arranca el contador en 2 y asigna el 1.
        create: { tenantId, nextCorrelative: 2 },
        update: { nextCorrelative: { increment: 1 } },
        select: { correlativePrefix: true, nextCorrelative: true },
    });
    // upsert/increment devuelve el valor POST-incremento → el número asignado
    // es el anterior.
    return formatCorrelative(cfg.correlativePrefix, cfg.nextCorrelative - 1);
}

/**
 * Variante standalone (abre su propia transacción). Útil cuando no se crea la
 * orden en el mismo paso; si se crea, preferir `reserveCorrelative(tx, ...)`.
 */
export async function nextCorrelative(tenantId: string): Promise<string> {
    return prisma.$transaction(tx => reserveCorrelative(tx, tenantId));
}
