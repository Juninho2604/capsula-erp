/**
 * POST /api/print-agent/jobs/:id/complete
 *
 * El agent reporta que el job se imprimió correctamente.
 * Transiciona PRINTING → COMPLETED y marca `completedAt`.
 */

import { NextResponse } from 'next/server';
import prisma from '@/server/db';
import { authenticatePrintAgent } from '@/lib/print-agent-auth';

export const dynamic = 'force-dynamic';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = authenticatePrintAgent(req);
    if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const updated = await prisma.printJob.update({
            where: { id, tenantId: auth.tenantId },
            data: { status: 'COMPLETED', completedAt: new Date(), errorMessage: null },
            select: { id: true, status: true, completedAt: true },
        });
        return NextResponse.json({ job: updated });
    } catch {
        return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }
}
