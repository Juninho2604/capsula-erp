/**
 * POST /api/v1/wa/outbound/bot — n8n reporta lo que Fabiola respondió
 * (opción A del contrato §6.1: n8n ya lo envió a Meta por su cuenta).
 * Registra el WaMessage OUTBOUND/BOT con su wamid para que la bandeja lo
 * muestre y los webhooks de estado lo actualicen.
 *
 * Body: { waId | conversationId, kind?, body?, templateName?, wamid?, mediaUrl? }
 */
import { NextResponse } from 'next/server';
import prisma from '@/server/db';
import { authenticateWaApi } from '@/lib/wa/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { computeWindow } from '@/lib/wa/compliance';

export const dynamic = 'force-dynamic';

interface OutboundBotBody {
    waId?: string;
    conversationId?: string;
    kind?: string;
    body?: string;
    templateName?: string;
    wamid?: string;
    mediaUrl?: string;
}

const VALID_KINDS = new Set(['TEXT', 'IMAGE', 'DOCUMENT', 'TEMPLATE', 'AUDIO', 'LOCATION', 'UNSUPPORTED']);

export async function POST(req: Request) {
    const auth = authenticateWaApi(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await tenantFeatureEnabled(auth.tenantId, 'waConversations'))) {
        return NextResponse.json({ error: 'wa_conversations disabled' }, { status: 403 });
    }

    let body: OutboundBotBody;
    try {
        body = (await req.json()) as OutboundBotBody;
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }

    const waId = typeof body.waId === 'string' ? body.waId.trim() : '';
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
    if (!waId && !conversationId) {
        return NextResponse.json({ error: 'Falta "waId" o "conversationId"' }, { status: 400 });
    }

    try {
        // Resolver conversación (por id o por waId; upsert defensivo por si el
        // bot respondió a una conversación que /inbound aún no registró).
        let conversation = conversationId
            ? await prisma.waConversation.findFirst({ where: { id: conversationId, tenantId: auth.tenantId } })
            : await prisma.waConversation.findUnique({
                where: { tenantId_waId: { tenantId: auth.tenantId, waId } },
            });
        if (!conversation && waId) {
            const w = computeWindow(new Date());
            conversation = await prisma.waConversation.create({
                data: {
                    tenantId: auth.tenantId,
                    waId,
                    customerPhone: waId,
                    status: 'BOT',
                    lastCustomerMsgAt: w.lastCustomerMsgAt,
                    windowExpiresAt: w.windowExpiresAt,
                },
            });
        }
        if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });

        // Dedupe por wamid — SCOPED al tenant: wamid es @unique GLOBAL, un
        // findUnique sin tenantId filtraría/leakearía mensajes de otro tenant.
        if (typeof body.wamid === 'string' && body.wamid) {
            const dup = await prisma.waMessage.findFirst({
                where: { wamid: body.wamid, tenantId: auth.tenantId },
                select: { id: true },
            });
            if (dup) return NextResponse.json({ ok: true, messageId: dup.id, duplicated: true });
        }

        const kindRaw = typeof body.kind === 'string' ? body.kind.toUpperCase() : '';
        const kind = VALID_KINDS.has(kindRaw) ? kindRaw : 'TEXT';
        const msg = await prisma.waMessage.create({
            data: {
                tenantId: auth.tenantId,
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                senderType: 'BOT',
                kind: kind as any,
                body: body.body ?? null,
                mediaUrl: body.mediaUrl ?? null,
                templateName: body.templateName ?? null,
                wamid: body.wamid ?? null,
                deliveryStatus: 'SENT', // n8n ya lo envió a Meta
            },
        });
        await prisma.waConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

        return NextResponse.json({ ok: true, messageId: msg.id, conversationId: conversation.id });
    } catch (e) {
        console.error('[wa/outbound/bot] error:', e);
        return NextResponse.json({ error: 'Error registrando el mensaje del bot' }, { status: 500 });
    }
}
