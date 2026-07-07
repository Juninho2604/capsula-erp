/**
 * GET /api/v1/wa/conversations/:waId/control — consulta rápida BOT/HUMAN.
 * n8n la llama ANTES de invocar al AI Agent: si responde HUMAN, Fabiola
 * se queda callada. Cache in-memory de 5s por tenant+waId (control-cache.ts,
 * invalidado por takeover/release) para responder en <50ms.
 */
import { NextResponse } from 'next/server';
import prisma from '@/server/db';
import { authenticateWaApi } from '@/lib/wa/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { getControlCache, setControlCache } from '@/lib/wa/control-cache';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ waId: string }> },
) {
    const auth = authenticateWaApi(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await tenantFeatureEnabled(auth.tenantId, 'waConversations'))) {
        return NextResponse.json({ error: 'wa_conversations disabled' }, { status: 403 });
    }

    const { waId } = await params;
    if (!waId?.trim()) return NextResponse.json({ error: 'Falta waId' }, { status: 400 });

    const hit = getControlCache(auth.tenantId, waId.trim());
    if (hit) return NextResponse.json({ ...hit, cached: true });

    const conversation = await prisma.waConversation.findUnique({
        where: { tenantId_waId: { tenantId: auth.tenantId, waId: waId.trim() } },
        select: { id: true, status: true },
    });

    // Sin conversación registrada → el bot puede responder (BOT).
    const payload = {
        status: conversation?.status ?? 'BOT',
        conversationId: conversation?.id ?? null,
    };
    setControlCache(auth.tenantId, waId.trim(), payload);
    return NextResponse.json(payload);
}
