/**
 * Idempotencia de POST /ordenes: el bot a veces reenvía el mismo pedido
 * (reintentos de red, doble confirmación del cliente). Para no crear
 * duplicados —tipo el PP-00126 de las pruebas— calculamos un hash del
 * (canal + chatId + firma de la comanda) y, si llega otra orden con el mismo
 * hash dentro de una ventana corta, devolvemos la existente en vez de crear.
 *
 * Funciones PURAS (el lookup en BD lo hace el caller con el hash que devuelve
 * `computeItemsHash`).
 */

import { createHash } from 'crypto';
import { computeComandaSignature } from './comanda';

/** Ventana por defecto para considerar dos órdenes "la misma": 10 minutos. */
export const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

export function computeItemsHash(
    channel: string,
    chatId: string | null | undefined,
    comanda: unknown,
): string {
    const signature = computeComandaSignature(comanda);
    const basis = `${channel.toLowerCase()}::${chatId ?? ''}::${signature}`;
    return createHash('sha256').update(basis).digest('hex');
}

/**
 * ¿La orden existente (con el mismo hash) sigue dentro de la ventana de
 * dedupe respecto a `now`? Si sí, el caller debe devolverla en vez de crear.
 */
export function isWithinIdempotencyWindow(
    existingCreatedAt: Date,
    now: Date = new Date(),
    windowMs: number = IDEMPOTENCY_WINDOW_MS,
): boolean {
    const delta = now.getTime() - existingCreatedAt.getTime();
    return delta >= 0 && delta <= windowMs;
}
