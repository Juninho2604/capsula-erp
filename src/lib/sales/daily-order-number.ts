/**
 * Número de orden del DÍA por canal (§84).
 *
 * Correlativo corto que resetea cada día (timezone Caracas) e identifica de
 * un vistazo cuál orden del día es — ej. "DL-14" (delivery 14 del día),
 * "MS-23" (mesa/restaurante 23). Se imprime en la comanda y en la nota de
 * entrega JUNTO al orderNumber global (REST-0101, DEL-0042…), que nunca
 * resetea.
 *
 * Pickup NO usa este contador: mantiene su propio "PK-NN" (gap-filling desde
 * `notes`, ver getDailyPickupCountAction). Este módulo cubre los demás
 * canales.
 *
 * El contador vive en la tabla DailyOrderCounter con unique
 * (tenantId, scope, dayKey) → el reseteo diario es implícito por dayKey.
 * `nextDailyNumber` debe llamarse DENTRO de la misma transacción que crea la
 * orden para que el número no se "reserve" si la creación falla… salvo que se
 * prefiera reservarlo siempre (monótono, sin huecos garantizados). Acá el
 * upsert corre en la tx de la orden, así que un rollback también revierte el
 * incremento.
 */

import { getCaracasDateStamp } from '@/lib/datetime';

/** Canales con numeración diaria. Pickup queda afuera (usa su propio PK). */
export type DailyScope = 'RESTAURANT' | 'DELIVERY' | 'WINK' | 'PEDIDOSYA';

/**
 * Prefijos de 2 letras, deliberadamente distintos de los prefijos del
 * correlativo global (REST, DEL, WNK, PYA, PKP) para que en la impresión no
 * se confundan "DL-14" (del día) con "DEL-0042" (correlativo).
 */
const DAILY_PREFIX: Record<DailyScope, string> = {
    RESTAURANT: 'MS', // Mesa / Salón
    DELIVERY: 'DL',
    WINK: 'WK',
    PEDIDOSYA: 'PY',
};

export function dailyLabel(scope: DailyScope, n: number): string {
    return `${DAILY_PREFIX[scope]}-${String(n).padStart(2, '0')}`;
}

/**
 * Palabra de canal por prefijo, para imprimir el label del día en forma
 * legible ("DL-1" → "DELIVERY N° 1") en comanda y nota de entrega. Incluye
 * "PK" (pickup) aunque su contador viva aparte: los recibos de pickup también
 * pasan por este formateo.
 */
const DAILY_PREFIX_WORD: Record<string, string> = {
    MS: 'MESA',
    DL: 'DELIVERY',
    WK: 'WINK',
    PY: 'PEDIDOSYA',
    PK: 'PICKUP',
};

/**
 * Convierte un label del día ("DL-1", "MS-07") en una línea legible por canal:
 * "DELIVERY N° 1", "MESA N° 7". El correlativo global (DEL-0042) NO se toca —
 * se imprime aparte. `channelHint` sobreescribe el prefijo cuando el canal ya
 * se conoce (ej. el recibo sabe que es DELIVERY). Defensivo: si el label no
 * matchea el formato, lo devuelve tal cual anteponiendo la palabra de canal.
 */
export function humanDailyLabel(label: string, channelHint?: string): string {
    const dash = label.lastIndexOf('-');
    const prefix = dash > 0 ? label.slice(0, dash) : label;
    const num = parseInt(dash > 0 ? label.slice(dash + 1) : '', 10);
    const word = channelHint || DAILY_PREFIX_WORD[prefix] || prefix;
    return Number.isFinite(num) ? `${word} N° ${num}` : `${word} ${label}`;
}

/**
 * Cliente Prisma mínimo que necesita el helper (tx o cliente crudo).
 * `dailyOrderCounter` NO es tenant-aware en la extensión, así que siempre se
 * pasa el tenantId explícito.
 */
interface CounterClient {
    dailyOrderCounter: {
        upsert(args: {
            where: { tenantId_scope_dayKey: { tenantId: string; scope: string; dayKey: string } };
            update: { lastValue: { increment: number } };
            create: { tenantId: string; scope: string; dayKey: string; lastValue: number };
        }): Promise<{ lastValue: number }>;
    };
}

/**
 * Reserva y devuelve el siguiente número + label del día para el canal.
 * Atómico vía upsert+increment. Pasar `tx` para que comparta la transacción
 * de creación de la orden.
 */
export async function nextDailyNumber(
    client: CounterClient,
    tenantId: string,
    scope: DailyScope,
    now: Date = new Date(),
): Promise<{ dailyNumber: number; dailyLabel: string }> {
    const dayKey = getCaracasDateStamp(now);
    const counter = await client.dailyOrderCounter.upsert({
        where: { tenantId_scope_dayKey: { tenantId, scope, dayKey } },
        update: { lastValue: { increment: 1 } },
        create: { tenantId, scope, dayKey, lastValue: 1 },
    });
    return { dailyNumber: counter.lastValue, dailyLabel: dailyLabel(scope, counter.lastValue) };
}
