import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { retryInventoryDeductionFromOutbox } from '@/app/actions/pos.actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // s — Vercel timeout cap por invocación de cron

const BATCH_SIZE = 25;

/**
 * Cron worker que reintenta los descargos de inventario fallidos del outbox
 * `InventoryDeductionRetry` (Fase 2.C).
 *
 * Triggered por Vercel Cron (cada 5 min, ver vercel.json) — autenticado con
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Comportamiento:
 *  1. Busca hasta BATCH_SIZE registros con status=PENDING y nextRetryAt<=NOW
 *  2. Para cada uno, delega en `retryInventoryDeductionFromOutbox` que claim-ea
 *     atómicamente y ejecuta la deducción.
 *  3. Devuelve un resumen con counts por outcome.
 *
 * Aceptamos GET (Vercel Cron usa GET por default) y POST (manual / debugging).
 */
async function handler(request: NextRequest) {
    // Auth: en prod requerimos el secret. En dev (sin secret configurado) lo permitimos.
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const startedAt = Date.now();

    try {
        // Lectura inicial de candidatos. Ordenamos por nextRetryAt para procesar
        // los más antiguos primero (FIFO).
        const candidates = await prisma.inventoryDeductionRetry.findMany({
            where: {
                status: 'PENDING',
                nextRetryAt: { lte: new Date() },
            },
            select: { id: true },
            orderBy: { nextRetryAt: 'asc' },
            take: BATCH_SIZE,
        });

        if (candidates.length === 0) {
            return NextResponse.json({
                ok: true,
                processed: 0,
                durationMs: Date.now() - startedAt,
                message: 'Outbox vacío',
            });
        }

        // Procesamos en serie. Esto evita hammering a la BD en caso de
        // problemas transitorios y mantiene el log ordenado. Con BATCH_SIZE=25
        // y deducciones típicas de <1s, el lote completo cabe en <60s.
        const results = {
            completed: 0,
            pending: 0,
            failed: 0,
            cancelled: 0,
            skipped: 0,
        };
        const errors: Array<{ id: string; error: string }> = [];

        for (const candidate of candidates) {
            try {
                const result = await retryInventoryDeductionFromOutbox(candidate.id);
                switch (result.status) {
                    case 'COMPLETED': results.completed++; break;
                    case 'PENDING': results.pending++; if (result.error) errors.push({ id: result.id, error: result.error }); break;
                    case 'FAILED': results.failed++; if (result.error) errors.push({ id: result.id, error: result.error }); break;
                    case 'CANCELLED': results.cancelled++; break;
                    case 'SKIPPED': results.skipped++; break;
                }
            } catch (perItemErr) {
                // No debería pasar — retryInventoryDeductionFromOutbox no lanza —
                // pero por seguridad capturamos para no tirar el lote completo.
                console.error('[CRON_OUTBOX] error en item', candidate.id, perItemErr);
                results.skipped++;
                errors.push({
                    id: candidate.id,
                    error: perItemErr instanceof Error ? perItemErr.message : String(perItemErr),
                });
            }
        }

        const durationMs = Date.now() - startedAt;

        // Log estructurado para observabilidad (Vercel logs)
        console.log('[CRON_OUTBOX] lote procesado', JSON.stringify({
            processed: candidates.length,
            ...results,
            durationMs,
        }));

        return NextResponse.json({
            ok: true,
            processed: candidates.length,
            ...results,
            errors: errors.slice(0, 10), // capamos para no inflar la response
            durationMs,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[CRON_OUTBOX] fallo global del cron:', err);
        return NextResponse.json(
            { ok: false, error: message, durationMs: Date.now() - startedAt },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return handler(request);
}

export async function POST(request: NextRequest) {
    return handler(request);
}
