import prisma from '@/server/db';
import { FALLBACK_TENANT_ID } from '@/lib/tenant-context';

export type InvoiceChannel =
  | 'DELIVERY'
  | 'PICKUP'
  | 'RESTAURANT'
  | 'PEDIDOS_YA'
  | 'OPEN_TAB'
  | 'GAME_SESSION';

// Prefijos del correlativo por canal. Revertidos a la versión original
// después de incidente productivo: PICKUP y RESTAURANT con el mismo
// prefijo 'REST' compartían rango de números y generaban conflictos
// de unique constraint en (tenantId, orderNumber) entre tablas.
//
//   - TAB-####  → tabCode del OpenTab (mesa abierta)
//   - REST-#### → SalesOrder (RESTAURANT channel)
//   - PKP-#### → Pickup directo desde caja (PICKUP channel)
//   - DEL-####  → SalesOrder de Delivery
//   - PYA-####  → SalesOrder de PedidosYa
const PREFIX: Record<InvoiceChannel, string> = {
  DELIVERY:     'DEL',
  PICKUP:       'PKP',
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
