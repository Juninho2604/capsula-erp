import prisma from '@/server/db';
import { FALLBACK_TENANT_ID } from '@/lib/tenant-context';

export type InvoiceChannel =
  | 'DELIVERY'
  | 'PICKUP'
  | 'RESTAURANT'
  | 'PEDIDOS_YA'
  | 'OPEN_TAB'
  | 'GAME_SESSION';

// Prefijos del correlativo por canal. El prefijo aparece en el ticket de
// comanda y permite al cocinero distinguir el tipo de pedido al instante:
//   - TAB-####  → SalesOrder generada desde una mesa abierta (OpenTab)
//   - REST-#### → Pickup directo desde caja (Venta Directa)
//   - DEL-####  → Delivery propio
//   - PYA-####  → PedidosYa
//
// OPEN_TAB usa el mismo prefijo 'TAB' que RESTAURANT — el tabCode de
// la mesa abierta y el orderNumber de la SalesOrder generada al enviar
// a cocina son secuencias independientes (counters distintos) pero
// comparten visualmente el prefijo, lo cual es deseable: ambos
// representan la misma mesa lógica.
const PREFIX: Record<InvoiceChannel, string> = {
  DELIVERY:     'DEL',
  PICKUP:       'REST',
  RESTAURANT:   'TAB',
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
