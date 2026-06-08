/**
 * Generación atómica del correlativo de orden de delivery (PP-00127).
 *
 * El contador vive en `DeliveryTenantConfig.nextCorrelative` (= próximo número
 * a asignar). Se incrementa atómicamente; el número asignado es el valor
 * PREVIO al incremento. Persistido en BD, sin huecos, por tenant (lección
 * §18.19 de la numeración PK).
 *
 * NO es función pura (toca BD). El formato sí: `formatCorrelative`.
 */

import prisma from '@/server/db';

export function formatCorrelative(prefix: string, n: number): string {
    return `${prefix}-${String(n).padStart(5, '0')}`;
}

/**
 * Reserva y devuelve el siguiente correlativo del tenant. Atómico: usa
 * `increment` (un solo UPDATE en Postgres) dentro de una transacción.
 *
 * Si el tenant aún no tiene config, la crea con el primer número = 1.
 */
export async function nextCorrelative(tenantId: string): Promise<string> {
    return prisma.$transaction(async tx => {
        const cfg = await tx.deliveryTenantConfig.upsert({
            where: { tenantId },
            // Primer uso: arranca el contador en 2 y asigna el 1.
            create: { tenantId, nextCorrelative: 2 },
            update: { nextCorrelative: { increment: 1 } },
            select: { correlativePrefix: true, nextCorrelative: true },
        });
        // upsert/increment devuelve el valor POST-incremento → el número
        // asignado es el anterior.
        const assigned = cfg.nextCorrelative - 1;
        return formatCorrelative(cfg.correlativePrefix, assigned);
    });
}
