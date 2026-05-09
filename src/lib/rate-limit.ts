/**
 * Rate limiting via Postgres (sliding fixed-window).
 *
 * Diseño:
 *   - Cada bucket = (key, windowStart). windowStart se redondea al ancho de
 *     ventana, así todos los hits dentro del mismo intervalo caen en el
 *     mismo bucket.
 *   - Upsert atómico (Postgres ON CONFLICT) para incrementar el contador
 *     sin race conditions entre invocaciones serverless concurrentes.
 *   - Si count > max → bloquea y devuelve retryAfterSeconds.
 *
 * Por qué Postgres y no Redis:
 *   - No requiere servicio externo (Upstash, Redis Cloud).
 *   - Funciona idéntico en Vercel y en VPS futuro.
 *   - El overhead es 1 query por intento de auth, despreciable.
 */

import prisma from '@/server/db';
import { headers } from 'next/headers';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    /** Segundos hasta que el bucket actual expire (cuando un nuevo intento sería aceptado). */
    retryAfterSeconds: number;
}

interface RateLimitOptions {
    /** Identificador único del bucket. Ej: "login:1.2.3.4:user@x.com" */
    key: string;
    /** Máximo de hits permitidos por ventana antes de bloquear. */
    max: number;
    /** Tamaño de la ventana en segundos. */
    windowSeconds: number;
}

/**
 * Consume 1 hit del bucket. Devuelve si está permitido y cuánto falta.
 * Llamar SIEMPRE antes de la operación protegida; si !allowed, retornar
 * error genérico al cliente sin ejecutar la lógica.
 */
export async function consumeRateLimit(
    opts: RateLimitOptions,
): Promise<RateLimitResult> {
    const now = new Date();
    const windowMs = opts.windowSeconds * 1000;
    // Redondear al inicio de la ventana actual.
    const windowStart = new Date(
        Math.floor(now.getTime() / windowMs) * windowMs,
    );
    const expiresAt = new Date(windowStart.getTime() + windowMs);

    // Upsert atómico: incrementa si existe, crea si no.
    const bucket = await prisma.rateLimitBucket.upsert({
        where: {
            key_windowStart: { key: opts.key, windowStart },
        },
        create: {
            key: opts.key,
            windowStart,
            count: 1,
            expiresAt,
        },
        update: {
            count: { increment: 1 },
        },
        select: { count: true },
    });

    const allowed = bucket.count <= opts.max;
    const remaining = Math.max(0, opts.max - bucket.count);
    const retryAfterSeconds = allowed
        ? 0
        : Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

    return { allowed, remaining, retryAfterSeconds };
}

/**
 * Obtiene la IP del cliente desde headers HTTP. En Vercel viene en
 * x-forwarded-for; el primer IP es el cliente real (los siguientes son
 * proxies). En VPS detrás de nginx también funciona si nginx pasa el header.
 */
export async function getClientIp(): Promise<string> {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0]?.trim();
        if (first) return first;
    }
    return h.get('x-real-ip') ?? 'unknown';
}

/**
 * Limpia buckets expirados. Pensado para cron periódico (no es crítico que
 * corra siempre — los buckets vivos solo cuestan unos KBs).
 */
export async function cleanupExpiredRateLimitBuckets(): Promise<number> {
    const result = await prisma.rateLimitBucket.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
}
