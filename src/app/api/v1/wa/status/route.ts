/**
 * POST /api/v1/wa/status — n8n reenvía los webhooks de estado de Meta.
 * Actualiza WaMessage.deliveryStatus por wamid (sent/delivered/read/failed).
 *
 * Body: forma de Meta `{ statuses: [{ id, status, errors? }] }`
 *       o simplificada `{ wamid, status, errorDetail? }`.
 */
import { NextResponse } from 'next/server';
import { authenticateWaApi } from '@/lib/wa/auth';
import { tenantFeatureEnabled } from '@/lib/feature-flags';
import { updateDeliveryStatusByWamid } from '@/lib/wa/service';

export const dynamic = 'force-dynamic';

interface MetaStatus {
    id?: string;
    status?: string;
    errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
}

interface StatusBody {
    statuses?: MetaStatus[];
    wamid?: string;
    status?: string;
    errorDetail?: string;
}

function extractError(s: MetaStatus): string | null {
    const e = s.errors?.[0];
    if (!e) return null;
    return `code=${e.code ?? '?'} ${e.title ?? e.message ?? ''}${e.error_data?.details ? ` · ${e.error_data.details}` : ''}`.trim();
}

export async function POST(req: Request) {
    const auth = authenticateWaApi(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await tenantFeatureEnabled(auth.tenantId, 'waConversations'))) {
        return NextResponse.json({ error: 'wa_conversations disabled' }, { status: 403 });
    }

    let body: StatusBody;
    try {
        body = (await req.json()) as StatusBody;
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }

    const updates: Array<{ wamid: string; status: string; errorDetail: string | null }> = [];
    if (Array.isArray(body.statuses)) {
        for (const s of body.statuses) {
            if (s.id && s.status) updates.push({ wamid: s.id, status: s.status, errorDetail: extractError(s) });
        }
    }
    if (body.wamid && body.status) {
        updates.push({ wamid: body.wamid, status: body.status, errorDetail: body.errorDetail ?? null });
    }
    if (updates.length === 0) {
        return NextResponse.json({ error: 'Sin estados: se espera "statuses[]" o "wamid"+"status"' }, { status: 400 });
    }

    try {
        let applied = 0;
        for (const u of updates) {
            const ok = await updateDeliveryStatusByWamid(auth.tenantId, u.wamid, u.status, u.errorDetail);
            if (ok) applied++;
        }
        return NextResponse.json({ ok: true, applied, received: updates.length });
    } catch (e) {
        console.error('[wa/status] error:', e);
        return NextResponse.json({ error: 'Error actualizando estados' }, { status: 500 });
    }
}
