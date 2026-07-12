'use server';

/**
 * Server actions del POS para encolar print jobs que el Print Agent
 * (corriendo en una PC del restaurante) recogerá vía polling.
 *
 * Reemplaza progresivamente las llamadas directas a `printReceipt()` y
 * `printKitchenCommand()` de `src/lib/print-command.ts` — el browser
 * print sigue funcionando como fallback para PCs con kiosk, pero las
 * tablets ahora encolan jobs en vez de abrir window.print().
 *
 * El payload se valida superficialmente aquí (campos críticos) y se
 * almacena tal cual en `PrintJob.payload` (JSON). El agent lee, hace
 * render ESC/POS y reporta resultado vía endpoints /api/print-agent/*.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';
import type { PrintJobType, Prisma } from '@prisma/client';

export interface EnqueuePrintJobInput {
    type: PrintJobType;
    /** Estación lógica (ej. 'kitchen-1', 'cajera-1', 'bar'). Si no se
     *  provee, el agent usa la primera impresora configurada. */
    station?: string;
    /** Payload completo serializable. Ver `print-agent/src/printer-adapter.ts`
     *  para el shape esperado por tipo (ReceiptPayload, KitchenPayload). */
    payload: Record<string, unknown>;
    /** §104 — Pedido FUTURO: ISO datetime. El job no se entrega al agente
     *  hasta esa hora (la comanda se imprime sola al llegar). Omitir = ya. */
    scheduledFor?: string;
}

export interface EnqueuePrintJobResult {
    success: boolean;
    jobId?: string;
    message?: string;
}

export async function enqueuePrintJobAction(
    input: EnqueuePrintJobInput
): Promise<EnqueuePrintJobResult> {
    const session = await getSession();
    if (!session) {
        return { success: false, message: 'No autenticado' };
    }

    if (!input.type) {
        return { success: false, message: 'Falta tipo de print job' };
    }
    if (!input.payload || typeof input.payload !== 'object') {
        return { success: false, message: 'Payload inválido' };
    }

    const { tenantId } = await resolveTenantContext();

    const job = await prisma.printJob.create({
        data: {
            tenantId,
            type: input.type,
            station: input.station ?? null,
            payload: input.payload as Prisma.InputJsonValue,
            enqueuedById: session.id,
            // §104: impresión diferida — inválidas se ignoran (imprime ya).
            scheduledFor: input.scheduledFor && !Number.isNaN(Date.parse(input.scheduledFor))
                ? new Date(input.scheduledFor)
                : null,
        },
        select: { id: true },
    });

    return { success: true, jobId: job.id };
}

/**
 * Lista jobs recientes del tenant para una UI de monitoreo (manager view).
 * Útil para ver qué se imprimió, qué falló, qué está pendiente.
 */
export async function getRecentPrintJobsAction(opts?: {
    limit?: number;
    statusFilter?: Array<'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED'>;
}): Promise<{
    success: boolean;
    jobs?: Array<{
        id: string;
        type: string;
        station: string | null;
        status: string;
        retries: number;
        errorMessage: string | null;
        createdAt: Date;
        completedAt: Date | null;
    }>;
    message?: string;
}> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autenticado' };

    const { tenantId } = await resolveTenantContext();
    const limit = Math.min(opts?.limit ?? 50, 200);

    const jobs = await prisma.printJob.findMany({
        where: {
            tenantId,
            ...(opts?.statusFilter && opts.statusFilter.length > 0
                ? { status: { in: opts.statusFilter } }
                : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            type: true,
            station: true,
            status: true,
            retries: true,
            errorMessage: true,
            createdAt: true,
            completedAt: true,
        },
    });

    return { success: true, jobs };
}
