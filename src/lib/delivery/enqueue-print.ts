/**
 * Encola la impresión de la comanda de delivery en la cola del Print Agent
 * (modelo `PrintJob`). Best-effort: NUNCA lanza — la impresión es accesoria,
 * no debe bloquear la transición de estado.
 *
 * Funciona con o sin sesión (`enqueuedById` opcional): la validación 1-clic
 * desde la UI pasa el id del usuario; la auto-validación máquina (n8n) lo deja
 * en null.
 *
 * La estación destino sale de `BranchDeliveryConfig.printerStation` de la sede
 * asignada → así cada sede imprime en su propia térmica (1 Print Agent por PC
 * de sede filtrando por `station`).
 */

import 'server-only';
import prisma from '@/server/db';
import { buildDeliveryKitchenPayload, type DeliveryOrderForPrint } from './print';

export async function enqueueDeliveryPrintJob(
    tenantId: string,
    order: DeliveryOrderForPrint & { branchId: string | null },
    enqueuedById?: string | null,
): Promise<string | null> {
    try {
        const cfg = order.branchId
            ? await prisma.branchDeliveryConfig.findUnique({
                  where: { branchId: order.branchId },
                  select: { printerStation: true },
              })
            : null;

        const payload = buildDeliveryKitchenPayload(order);

        const job = await prisma.printJob.create({
            data: {
                tenantId,
                type: 'KITCHEN',
                station: cfg?.printerStation ?? null,
                payload: payload as unknown as object,
                enqueuedById: enqueuedById ?? null,
            },
            select: { id: true },
        });
        return job.id;
    } catch (err) {
        console.error('[delivery] enqueueDeliveryPrintJob falló:', err);
        return null;
    }
}
