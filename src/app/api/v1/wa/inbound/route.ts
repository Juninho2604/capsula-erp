/**
 * POST /api/v1/wa/inbound — n8n reporta cada mensaje ENTRANTE del cliente.
 *
 * Crea/actualiza WaConversation (upsert tenantId+waId), crea WaMessage
 * INBOUND, actualiza la ventana 24h, procesa opt-out (BAJA/STOP), descarga
 * media (los mediaId de Meta expiran) e incrementa unreadCount.
 *
 * Respuesta: { status, conversationId, optedOut } — si status == "HUMAN",
 * n8n NO invoca al AI Agent (Fabiola callada).
 *
 * Auth: X-API-Key por tenant (patrón /api/v1/delivery) + flag waConversations.
 */
import { NextResponse } from 'next/server';
import { authenticateWaApi } from '@/lib/wa/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { processInboundMessage } from '@/lib/wa/service';

export const dynamic = 'force-dynamic';

interface InboundBody {
    waId?: string;
    name?: string;
    kind?: string;
    body?: string;
    mediaId?: string;
    location?: { latitude?: number; longitude?: number };
    wamid?: string;
    timestamp?: string | number;
}

export async function POST(req: Request) {
    const auth = authenticateWaApi(req);
    if (!auth.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await tenantFeatureEnabled(auth.tenantId, 'waConversations'))) {
        return NextResponse.json({ error: 'wa_conversations disabled' }, { status: 403 });
    }

    let body: InboundBody;
    try {
        body = (await req.json()) as InboundBody;
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }

    // Coerción defensiva: n8n podría mandar waId numérico o tipos raros →
    // .trim() sobre no-string crashea antes del try. Validar tipo explícito.
    const waId = typeof body.waId === 'string' ? body.waId.trim() : '';
    const kind = typeof body.kind === 'string' ? body.kind.trim() : '';
    if (!waId) return NextResponse.json({ error: 'Falta "waId" (string)' }, { status: 400 });
    if (!kind) return NextResponse.json({ error: 'Falta "kind" (string)' }, { status: 400 });

    try {
        const result = await processInboundMessage(auth.tenantId, {
            waId,
            name: typeof body.name === 'string' ? body.name : null,
            kind,
            body: typeof body.body === 'string' ? body.body : null,
            mediaId: body.mediaId ?? null,
            latitude: body.location?.latitude ?? null,
            longitude: body.location?.longitude ?? null,
            wamid: body.wamid ?? null,
        });
        return NextResponse.json({
            status: result.status,
            conversationId: result.conversationId,
            optedOut: result.optedOut,
            ...(result.duplicated ? { duplicated: true } : {}),
        });
    } catch (e) {
        console.error('[wa/inbound] error:', e);
        return NextResponse.json({ error: 'Error procesando el mensaje' }, { status: 500 });
    }
}
