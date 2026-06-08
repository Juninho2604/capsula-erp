/**
 * Builder PURO de la comanda térmica de una orden de delivery.
 *
 * Reutiliza el tipo `KITCHEN` del Print Agent existente (§39): su renderer ya
 * imprime header con `orderNumber` grande, label `[ DELIVERY ]`, nombre +
 * dirección del cliente e ítems con modificadores. Así NO hace falta un tipo
 * de PrintJob nuevo (evita `ALTER TYPE` peligroso, §44).
 *
 * El shape devuelto es compatible con `KitchenPayload` de
 * `print-agent/src/printer-adapter.ts`.
 */

import { parseComandaItems } from './comanda';

export interface DeliveryKitchenPayload {
    type: 'KITCHEN';
    orderNumber: string;
    orderType: 'DELIVERY';
    orderTypeLabel: 'DELIVERY';
    customerName: string | null;
    customerAddress: string | null;
    items: Array<{ name: string; quantity: number; modifiers: string[] }>;
    createdAt: string; // ISO
}

export interface DeliveryOrderForPrint {
    correlative: string;
    customerName?: string | null;
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    deliveryRef?: string | null;
    comanda: unknown;
    createdAt: string; // ISO
}

export function buildDeliveryKitchenPayload(
    order: DeliveryOrderForPrint,
): DeliveryKitchenPayload {
    const items = parseComandaItems(order.comanda).map(i => ({
        name: i.name || 'Ítem',
        quantity: i.qty,
        modifiers: i.modifiers,
    }));

    // El renderer KITCHEN imprime customerName y customerAddress en líneas
    // separadas. Metemos teléfono + referencia en la línea de dirección para
    // que el motorizado/cocina las vea (KitchenPayload no tiene campos aparte).
    const addressParts = [
        order.deliveryAddress?.trim(),
        order.deliveryRef ? `Ref: ${order.deliveryRef.trim()}` : null,
        order.customerPhone ? `Tel: ${order.customerPhone.trim()}` : null,
    ].filter(Boolean) as string[];

    return {
        type: 'KITCHEN',
        orderNumber: order.correlative,
        orderType: 'DELIVERY',
        orderTypeLabel: 'DELIVERY',
        customerName: order.customerName?.trim() || null,
        customerAddress: addressParts.length > 0 ? addressParts.join(' · ') : null,
        items,
        createdAt: order.createdAt,
    };
}
