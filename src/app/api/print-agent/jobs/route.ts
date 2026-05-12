/**
 * GET /api/print-agent/jobs?status=PENDING&limit=20
 *
 * Lista de jobs disponibles para el agent. El agent llama esto cada
 * ~1s, procesa cada job y reporta el resultado en endpoints aparte.
 *
 * Auth: Bearer <PRINT_AGENT_API_KEY> + X-Tenant-Id.
 *
 * Por defecto devuelve solo PENDING ordenados por `createdAt asc` (FIFO).
 * Límite por defecto 20 para evitar overload si la cola creció mucho
 * mientras el agent estaba caído.
 */

import { NextResponse } from 'next/server';
import prisma from '@/server/db';
import { authenticatePrintAgent } from '@/lib/print-agent-auth';
import type { PrintJobStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: PrintJobStatus[] = ['PENDING', 'PRINTING', 'COMPLETED', 'FAILED'];

export async function GET(req: Request) {
    const auth = authenticatePrintAgent(req);
    if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get('status') ?? 'PENDING') as PrintJobStatus;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);

    if (!VALID_STATUSES.includes(statusParam)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const jobs = await prisma.printJob.findMany({
        where: { tenantId: auth.tenantId, status: statusParam },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
            id: true,
            type: true,
            station: true,
            payload: true,
            retries: true,
            createdAt: true,
        },
    });

    return NextResponse.json({ jobs });
}
