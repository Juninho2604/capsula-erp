import { describe, it, expect, vi } from 'vitest';
import { dailyLabel, humanDailyLabel, kitchenDailyLabel, nextDailyNumber, nextDailyNumberReusingGaps, type DailyScope } from './daily-order-number';

describe('dailyLabel', () => {
    it('formatea con prefijo de 2 letras y padding 2', () => {
        expect(dailyLabel('DELIVERY', 14)).toBe('DL-14');
        expect(dailyLabel('RESTAURANT', 3)).toBe('MS-03');
        expect(dailyLabel('WINK', 7)).toBe('WK-07');
        expect(dailyLabel('PEDIDOSYA', 120)).toBe('PY-120');
    });

    it('los prefijos NO colisionan con los del correlativo global', () => {
        const dailyPrefixes = (['RESTAURANT', 'DELIVERY', 'WINK', 'PEDIDOSYA'] as DailyScope[])
            .map(s => dailyLabel(s, 1).split('-')[0]);
        const correlativoPrefixes = ['REST', 'DEL', 'WNK', 'PYA', 'PKP', 'TAB'];
        for (const p of dailyPrefixes) {
            expect(correlativoPrefixes).not.toContain(p);
        }
    });
});

describe('nextDailyNumber', () => {
    const makeClient = (returnValue: number) => ({
        dailyOrderCounter: {
            upsert: vi.fn().mockResolvedValue({ lastValue: returnValue }),
        },
    });

    it('devuelve número y label desde el upsert', async () => {
        const client = makeClient(14);
        const res = await nextDailyNumber(client, 'tenant-1', 'DELIVERY', new Date('2026-07-09T18:00:00Z'));
        expect(res).toEqual({ dailyNumber: 14, dailyLabel: 'DL-14' });
    });

    it('usa el dayKey Caracas (no UTC) en el where del upsert', async () => {
        const client = makeClient(1);
        // 2026-07-10 01:00 UTC = 2026-07-09 21:00 Caracas → dayKey del 09
        await nextDailyNumber(client, 'tenant-1', 'RESTAURANT', new Date('2026-07-10T01:00:00Z'));
        const arg = client.dailyOrderCounter.upsert.mock.calls[0][0];
        expect(arg.where.tenantId_scope_dayKey.dayKey).toBe('2026-07-09');
        expect(arg.where.tenantId_scope_dayKey.scope).toBe('RESTAURANT');
        expect(arg.create.lastValue).toBe(1);
        expect(arg.update.lastValue).toEqual({ increment: 1 });
    });
});

describe('humanDailyLabel — línea legible por canal para la comanda (§84.1)', () => {
    it('traduce el prefijo a palabra + número sin ceros a la izquierda', () => {
        expect(humanDailyLabel('DL-01')).toBe('DELIVERY N° 1');
        // §151 — 'PEDIDO', no 'MESA': es el enésimo pedido del día. Impreso
        // como "MESA N° 7" junto a "Mesa: SP-10" la cocina leía dos mesas.
        expect(humanDailyLabel('MS-07')).toBe('PEDIDO N° 7');
        expect(humanDailyLabel('WK-12')).toBe('WINK N° 12');
        expect(humanDailyLabel('PY-03')).toBe('PEDIDOSYA N° 3');
        expect(humanDailyLabel('PK-14')).toBe('PICKUP N° 14');
    });

    it('channelHint sobreescribe el prefijo cuando el canal ya se conoce', () => {
        expect(humanDailyLabel('DL-05', 'DELIVERY')).toBe('DELIVERY N° 5');
        expect(humanDailyLabel('MS-02', 'PEDIDO')).toBe('PEDIDO N° 2');
    });

    it('defensivo: prefijo desconocido o sin numero no rompe', () => {
        expect(humanDailyLabel('ZZ-09')).toBe('ZZ N° 9');
        expect(humanDailyLabel('DL-')).toBe('DELIVERY DL-');
    });
});

describe('nextDailyNumberReusingGaps', () => {
    type WhereArg = {
        dailyLabel: { startsWith: string };
        status: { not: 'CANCELLED' };
        createdAt: { gte: Date; lte: Date };
    };
    const makeOrdersClient = (dailyNumbers: (number | null)[]) => ({
        salesOrder: {
            findMany: vi.fn(async (_args: { where: WhereArg; select: { dailyNumber: true } }) =>
                dailyNumbers.map((dailyNumber) => ({ dailyNumber })),
            ),
        },
    });

    it('reutiliza el hueco que dejó una anulación (el caso del auditor)', async () => {
        // Existen DL-1, DL-2, DL-3, DL-5 vivos; el 4 fue anulado.
        const client = makeOrdersClient([1, 2, 3, 5]);
        const res = await nextDailyNumberReusingGaps(client, 'DELIVERY');
        expect(res.dailyNumber).toBe(4);
        expect(res.dailyLabel).toBe('DL-04');
    });

    it('sin huecos, continúa después del último', async () => {
        const client = makeOrdersClient([1, 2, 3]);
        const res = await nextDailyNumberReusingGaps(client, 'DELIVERY');
        expect(res.dailyNumber).toBe(4);
    });

    it('primer pedido del día arranca en 1', async () => {
        const client = makeOrdersClient([]);
        const res = await nextDailyNumberReusingGaps(client, 'DELIVERY');
        expect(res.dailyNumber).toBe(1);
        expect(res.dailyLabel).toBe('DL-01');
    });

    it('ignora órdenes sin número del día', async () => {
        const client = makeOrdersClient([1, null, 3]);
        const res = await nextDailyNumberReusingGaps(client, 'DELIVERY');
        expect(res.dailyNumber).toBe(2);
    });

    it('filtra por prefijo del canal, día Caracas y excluye anuladas', async () => {
        const client = makeOrdersClient([1]);
        await nextDailyNumberReusingGaps(client, 'DELIVERY', new Date('2026-07-10T01:00:00Z'));
        const where = client.salesOrder.findMany.mock.calls[0]![0].where;
        expect(where.dailyLabel).toEqual({ startsWith: 'DL-' });
        expect(where.status).toEqual({ not: 'CANCELLED' });
        // 2026-07-10 01:00 UTC = 2026-07-09 21:00 Caracas → rango del 09
        expect(where.createdAt.gte.toISOString()).toBe('2026-07-09T04:00:00.000Z');
    });
});

describe('kitchenDailyLabel — qué label lleva la COMANDA (§151)', () => {
    it('en mesa no lleva ninguno: a la cocina le importa la mesa real', () => {
        // Caso TAB-4270: imprimía "MESA N° 13" cuando la mesa era la SP-10.
        expect(kitchenDailyLabel('MS-13', 'MESA')).toBeUndefined();
    });

    it('delivery, pickup y marketplaces lo conservan — ahí ES el identificador', () => {
        expect(kitchenDailyLabel('DL-04', 'DELIVERY')).toBe('DL-04');
        expect(kitchenDailyLabel('PK-09', 'PICKUP')).toBe('PK-09');
        expect(kitchenDailyLabel('PY-02', 'PEDIDOSYA')).toBe('PY-02');
        expect(kitchenDailyLabel('WK-01', 'WINK')).toBe('WK-01');
    });

    it('sin label del día no inventa nada', () => {
        expect(kitchenDailyLabel(undefined, 'DELIVERY')).toBeUndefined();
        expect(kitchenDailyLabel(null, 'MESA')).toBeUndefined();
        expect(kitchenDailyLabel('', 'DELIVERY')).toBeUndefined();
    });

    it('sin tipo operativo se conserva — sólo mesa lo suprime', () => {
        expect(kitchenDailyLabel('MS-13')).toBe('MS-13');
    });
});
