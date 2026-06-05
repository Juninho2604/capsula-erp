/**
 * Blindaje cajera (#259): elimina TODO rastro del método de pago de las filas
 * del historial de ventas antes de enviarlas al cliente, incluyendo los
 * objetos `SalesOrder` crudos anidados en `orders[]` (que de otro modo
 * filtrarían el método vía DevTools aunque la UI no lo renderice).
 *
 * Función PURA y mutante sobre las filas que recibe (las filas ya son copias
 * construidas por el action). Idempotente.
 */

function scrubOrder(o: any): void {
    if (!o || typeof o !== 'object') return;
    o.paymentMethod = null;
    if (Array.isArray(o.orderPayments)) o.orderPayments = [];
    if (o.openTab && typeof o.openTab === 'object') {
        if (Array.isArray(o.openTab.paymentSplits)) {
            o.openTab.paymentSplits = o.openTab.paymentSplits.map((s: any) => ({ ...s, paymentMethod: null }));
        }
        if (Array.isArray(o.openTab.subAccounts)) {
            o.openTab.subAccounts = o.openTab.subAccounts.map((s: any) => ({ ...s, paymentMethod: null }));
        }
    }
}

export function scrubPaymentMethodFromHistory(rows: any[]): void {
    for (const r of rows) {
        if (!r || typeof r !== 'object') continue;
        r.paymentMethod = null;
        r.paymentBreakdown = [];
        if (Array.isArray(r.orderPayments)) r.orderPayments = [];
        if (Array.isArray(r.orders)) r.orders.forEach(scrubOrder);
    }
}
