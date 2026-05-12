/**
 * POST /api/print-agent/jobs/:id/fail
 *
 * El agent reporta que el job falló. Body: `{ errorMessage: string,
 * retryable?: boolean }`. Si `retryable` y `retries < MAX_RETRIES`, el
 * job vuelve a PENDING para reintento. Si no, queda FAILED final.
 *
 * Política de retries en el ERP (no en el agent) para que sea fácil
 * de cambiar sin redespliegue del agent.
 */

import { NextResponse } from 'next/server';
import prisma from '@/server/db';
import { authenticatePrintAgent } from '@/lib/print-agent-auth';

export const dynamic = 'force-dynamic';

const MAX_RETRIES = 3;

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = authenticatePrintAgent(req);
    if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let body: { errorMessage?: string; retryable?: boolean } = {};
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    const errorMessage = body.errorMessage ?? 'Sin detalle';
    const retryable = body.retryable !== false;

    const job = await prisma.printJob.findUnique({
        where: { id, tenantId: auth.tenantId },
        select: { retries: true },
    });
    if (!job) {
        return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    const nextRetries = job.retries + 1;
    const shouldRetry = retryable && nextRetries < MAX_RETRIES;

    const updated = await prisma.printJob.update({
        where: { id, tenantId: auth.tenantId },
        data: {
            status: shouldRetry ? 'PENDING' : 'FAILED',
            retries: nextRetries,
            errorMessage,
            claimedAt: null, // libera para que vuelva al pool
            completedAt: shouldRetry ? null : new Date(),
        },
        select: { id: true, status: true, retries: true },
    });
    return NextResponse.json({ job: updated, willRetry: shouldRetry });
}
