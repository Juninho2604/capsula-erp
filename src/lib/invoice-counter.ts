import prisma from '@/server/db';
import { FALLBACK_TENANT_ID } from '@/lib/tenant-context';

export type InvoiceChannel =
  | 'DELIVERY'
  | 'PICKUP'
  | 'RESTAURANT'
  | 'PEDIDOS_YA'
  | 'OPEN_TAB'
  | 'GAME_SESSION';

// Prefijos del correlativo por canal. El prefijo aparece en el ticket
// de comanda y permite al cocinero distinguir el tipo de pedido:
//   - TAB-####  → tabCode de mesa abierta (OpenTab.tabCode)
//   - REST-#### → SalesOrder de mesa abierta o pickup desde caja
//   - DEL-####  → SalesOrder de Delivery
//   - PYA-####  → SalesOrder de PedidosYa
//
// NOTA: el intento previo de diferenciar SalesOrder de mesa (TAB) vs
// pickup (REST) generó un Unique constraint failed en
// `(tenantId, orderNumber)` porque el contador RESTAURANT tenía
// lastValue alineado con los REST-XXXX existentes en BD y al cambiar
// a prefijo TAB el sistema seguía generando números del mismo rango
// donde ya existían tabCodes TAB-XXXX desde la era OPEN_TAB.
// Por ahora ambas (mesa y pickup) comparten prefijo REST en SalesOrder
// y el TAB se queda solo para OpenTab.tabCode. La distinción mesa vs
// pickup se hace por orderType/notes del SalesOrder, no por prefijo.
const PREFIX: Record<InvoiceChannel, string> = {
  DELIVERY:     'DEL',
  PICKUP:       'REST',
  RESTAURANT:   'REST',
  PEDIDOS_YA:   'PYA',
  OPEN_TAB:     'TAB',
  GAME_SESSION: 'GSN',
};

/**
 * Retorna el siguiente correlativo por (tenant, canal). Usa una transacción
 * atómica (upsert + increment) sobre el unique compuesto (tenantId, channel)
 * para garantizar unicidad sin reseteo diario.
 *
 * Ejemplos: REST-0101, DEL-0042, PYA-0007
 *
 * Mientras Fase 3 no esté activa, usa FALLBACK_TENANT_ID (Shanklish). Cuando
 * el middleware esté activo se le pasará el tenantId explícito desde el
 * contexto de la sesión.
 */
export async function getNextCorrelativo(
  channel: InvoiceChannel,
  tenantId: string = FALLBACK_TENANT_ID,
): Promise<string> {
  const counter = await prisma.$transaction(async (tx) => {
    return tx.invoiceCounter.upsert({
      where:  { tenantId_channel: { tenantId, channel } },
      update: { lastValue: { increment: 1 } },
      create: { tenantId, channel, lastValue: 101 },
    });
  });
  const prefix = PREFIX[channel];
  return `${prefix}-${String(counter.lastValue).padStart(4, '0')}`;
}
