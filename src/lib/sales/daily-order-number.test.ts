import { describe, it, expect, vi } from 'vitest';
import { dailyLabel, humanDailyLabel, nextDailyNumber, type DailyScope } from './daily-order-number';

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
        expect(humanDailyLabel('MS-07')).toBe('MESA N° 7');
        expect(humanDailyLabel('WK-12')).toBe('WINK N° 12');
        expect(humanDailyLabel('PY-03')).toBe('PEDIDOSYA N° 3');
        expect(humanDailyLabel('PK-14')).toBe('PICKUP N° 14');
    });

    it('channelHint sobreescribe el prefijo cuando el canal ya se conoce', () => {
        expect(humanDailyLabel('DL-05', 'DELIVERY')).toBe('DELIVERY N° 5');
        expect(humanDailyLabel('MS-02', 'MESA')).toBe('MESA N° 2');
    });

    it('defensivo: prefijo desconocido o sin numero no rompe', () => {
        expect(humanDailyLabel('ZZ-09')).toBe('ZZ N° 9');
        expect(humanDailyLabel('DL-')).toBe('DELIVERY DL-');
    });
});
