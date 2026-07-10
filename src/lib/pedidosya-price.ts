/**
 * Precio PedidosYA.
 *
 * Histórico: aplicaba −33.33% sobre el precio base (redondeado a $0.50).
 * Decisión del negocio (10/07/2026): PedidosYA usa EL MISMO precio del
 * restaurante — sin descuento. El override manual por producto
 * (`MenuItem.pedidosYaPrice`) sigue teniendo prioridad si está seteado;
 * para limpiarlos en masa: scripts/reset-pedidosya-prices.ts.
 */
export function calcPedidosYaPrice(basePrice: number): number {
  return basePrice;
}
