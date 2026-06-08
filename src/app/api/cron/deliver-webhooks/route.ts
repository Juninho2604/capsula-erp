import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/server/db';
import { hmacSign } from '@/lib/delivery/webhook-sign';

/**
 * Cron worker que entrega los webhooks salientes pendientes del outbox
 * `DeliveryWebhookOutbox` (Fase 3) a n8n.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (igual que retry-inventory).
 * Procesa cross-tenant en un solo lote. Firma cada body con HMAC-SHA256
 * (`DELIVERY_WEBHOOK_SECRET`) en el header `X-Kpsula-Signature`. La URL destino
 * sale de `DeliveryTenantConfig.webhookUrl` de cada tenant.
 *
 * Reintentos: cada corrida reintenta los PENDING; tras MAX_ATTEMPTS fallos el
 * registro queda FAILED. GET (cron) y POST (manual/debug).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 6;
const HTTP_TIMEOUT_MS = 10_000;

async function handler(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
        }
    } else {
        if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const webhookSecret = process.env.DELIVERY_WEBHOOK_SECRET;
    const startedAt = Date.now();

    const pending = await prisma.deliveryWebhookOutbox.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
    });

    if (pending.length === 0) {
        return NextResponse.json({ ok: true, processed: 0, durationMs: Date.now() - startedAt });
    }

    // Cache de webhookUrl por tenant (un query por tenant distinto en el lote).
    const urlCache = new Map<string, string | null>();
    async function getUrl(tenantId: string): Promise<string | null> {
        if (urlCache.has(tenantId)) return urlCache.get(tenantId)!;
        const cfg = await prisma.deliveryTenantConfig.findUnique({
            where: { tenantId },
            select: { webhookUrl: true },
        });
        const url = cfg?.webhookUrl ?? null;
        urlCache.set(tenantId, url);
        return url;
    }

    const result = { sent: 0, retried: 0, failed: 0 };

    for (const row of pending) {
        const url = await getUrl(row.tenantId);

        // Sin URL o sin secreto → no hay forma de entregar: marcar FAILED.
        if (!url || !webhookSecret) {
            await prisma.deliveryWebhookOutbox.update({
                where: { id: row.id },
                data: {
                    status: 'FAILED',
                    attempts: row.attempts + 1,
                    lastError: !url ? 'webhookUrl no configurado' : 'DELIVERY_WEBHOOK_SECRET no configurado',
                },
            });
            result.failed++;
            continue;
        }

        const body = JSON.stringify(row.payload);
        const signature = hmacSign(body, webhookSecret);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Kpsula-Signature': signature },
                body,
                signal: controller.signal,
            });
            if (res.ok) {
                await prisma.deliveryWebhookOutbox.update({
                    where: { id: row.id },
                    data: { status: 'SENT', attempts: row.attempts + 1, sentAt: new Date(), lastError: null },
                });
                result.sent++;
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            const attempts = row.attempts + 1;
            const failed = attempts >= MAX_ATTEMPTS;
            await prisma.deliveryWebhookOutbox.update({
                where: { id: row.id },
                data: {
                    status: failed ? 'FAILED' : 'PENDING',
                    attempts,
                    lastError: err instanceof Error ? err.message : String(err),
                },
            });
            if (failed) result.failed++;
            else result.retried++;
        } finally {
            clearTimeout(timer);
        }
    }

    return NextResponse.json({
        ok: true,
        processed: pending.length,
        ...result,
        durationMs: Date.now() - startedAt,
    });
}

export async function GET(request: NextRequest) {
    return handler(request);
}

export async function POST(request: NextRequest) {
    return handler(request);
}
