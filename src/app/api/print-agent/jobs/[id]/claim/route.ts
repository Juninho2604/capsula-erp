/**
 * POST /api/print-agent/jobs/:id/claim
 *
 * El agent reclama un job — atómicamente transiciona PENDING → PRINTING.
 *
 * Usa `update` con `where: { id, status: 'PENDING' }` para evitar race
 * conditions: si dos agents corren simultáneamente (no debería pasar
 * pero por defecto), solo uno logra el claim. El otro recibe 409.
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
            where: { id, tenantId: auth.tenantId, status: 'PENDING' },
            data: { status: 'PRINTING', claimedAt: new Date() },
            select: {
                id: true,
                type: true,
                station: true,
                payload: true,
                retries: true,
            },
        });
        return NextResponse.json({ job: updated });
    } catch {
        // Prisma P2025: el registro no existe o no matchea el where
        // (ya fue tomado por otro agent o no es PENDING).
        return NextResponse.json({ error: 'Conflict — job ya no está PENDING' }, { status: 409 });
    }
}
