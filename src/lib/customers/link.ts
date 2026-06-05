/**
 * CRM — vínculo de ventas a clientes + actualización de stats cacheadas.
 *
 * Lo usa `createSalesOrderAction` al cobrar:
 *   - Si llega `customerId` explícito (la cajera eligió un cliente del
 *     buscador), se vincula a ese.
 *   - Si no, pero hay teléfono y el tipo de orden es de cliente real
 *     (delivery/pickup), se hace upsert por teléfono: se busca un cliente
 *     activo con ese teléfono y, si no existe, se crea uno liviano. Así la
 *     cartera se va llenando sola con cada delivery.
 *   - Mesas (RESTAURANT sin customerId) NO auto-crean cliente: `customerName`
 *     suele ser la etiqueta de la mesa, no una persona.
 *
 * Las stats (`totalOrders`, `totalSpent`, `lastOrderAt`) se incrementan acá.
 * Son un cache para ordenar/listar; el historial real y los agregados exactos
 * se leen desde las SalesOrder vinculadas (que no sufren drift por anulaciones).
 */

import type { TenantPrismaClient } from '@/lib/prisma-tenant-client';

/** Normaliza teléfono a solo dígitos para matchear con tolerancia a formato. */
function normalizePhone(raw?: string | null): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D+/g, '');
    return digits.length >= 7 ? digits : null;
}

const REAL_CUSTOMER_ORDER_TYPES = new Set(['DELIVERY', 'PICKUP']);
const PLACEHOLDER_NAMES = new Set(['', 'cliente en caja', 'cliente', 'consumidor final', 'propina colectiva', 'delivery']);

export interface ResolveCustomerArgs {
    explicitCustomerId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    orderType: string;
    createdById?: string | null;
}

/**
 * Devuelve el customerId a guardar en la orden (o null si no corresponde
 * vincular). Crea el cliente si hace falta. NO lanza: ante cualquier error
 * devuelve null para no bloquear el cobro (la venta es lo crítico).
 */
export async function resolveCustomerForOrder(
    db: TenantPrismaClient,
    tenantId: string,
    args: ResolveCustomerArgs,
): Promise<string | null> {
    try {
        // 1. Vínculo explícito — validar que pertenece al tenant.
        if (args.explicitCustomerId) {
            const found = await db.customer.findFirst({
                where: { id: args.explicitCustomerId, isActive: true },
                select: { id: true },
            });
            if (found) return found.id;
        }

        // 2. Solo auto-vinculamos en órdenes de cliente real (delivery/pickup).
        if (!REAL_CUSTOMER_ORDER_TYPES.has((args.orderType || '').toUpperCase())) return null;

        const phone = normalizePhone(args.customerPhone);
        const name = (args.customerName || '').trim();
        const nameIsPlaceholder = PLACEHOLDER_NAMES.has(name.toLowerCase());

        // Requerimos teléfono para auto-vincular/crear: es la única clave de
        // deduplicación. Sin teléfono no podemos evitar duplicados (cada orden
        // crearía una ficha nueva), así que no creamos nada. (Igual criterio
        // que el upsert histórico, que exigía customerPhone.)
        if (!phone) return null;

        // 3. Buscar por teléfono. Para no traer toda la tabla (el take:200 viejo
        //    perdía clientes y duplicaba cuando había >200), narrowamos por los
        //    últimos 7 dígitos vía `contains` y confirmamos con match normalizado.
        //    Como los teléfonos se guardan ya normalizados (solo dígitos, abajo),
        //    el `contains` es confiable.
        const tail = phone.slice(-7);
        const candidates = await db.customer.findMany({
            where: { isActive: true, phone: { contains: tail } },
            select: { id: true, phone: true },
            take: 50,
        });
        const match = candidates.find(c => normalizePhone(c.phone) === phone);
        if (match) return match.id;

        // 4. Crear cliente liviano. Guardamos el teléfono NORMALIZADO (solo
        //    dígitos) para que el match por `contains` funcione siempre y no se
        //    generen duplicados por formato.
        const created = await db.customer.create({
            data: {
                tenantId,
                fullName: nameIsPlaceholder ? `Cliente ${phone}` : name,
                phone,
                address: args.customerAddress?.trim() || null,
                createdById: args.createdById ?? null,
            },
            select: { id: true },
        });
        return created.id;
    } catch (err) {
        console.error('[customers] resolveCustomerForOrder:', err);
        return null;
    }
}

/**
 * Incrementa las stats cacheadas del cliente tras una venta. No lanza.
 * @param amount  monto de la venta a sumar a totalSpent (USD).
 * @param at      fecha de la venta (para lastOrderAt).
 */
export async function bumpCustomerStats(
    db: TenantPrismaClient,
    tenantId: string,
    customerId: string,
    amount: number,
    at: Date,
): Promise<void> {
    try {
        await db.customer.updateMany({
            where: { id: customerId, tenantId },
            data: {
                totalOrders: { increment: 1 },
                totalSpent: { increment: Math.max(0, amount) },
                lastOrderAt: at,
            },
        });
    } catch (err) {
        console.error('[customers] bumpCustomerStats:', err);
    }
}
