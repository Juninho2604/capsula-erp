import { describe, it, expect } from 'vitest';
import { scrubPaymentMethodFromHistory } from './scrub-payment';

describe('scrubPaymentMethodFromHistory (#259 blindaje cajera)', () => {
    it('limpia campos de nivel superior', () => {
        const rows = [{ paymentMethod: 'ZELLE', paymentBreakdown: [{ method: 'ZELLE', amount: 10 }], orderPayments: [{ method: 'ZELLE' }] }];
        scrubPaymentMethodFromHistory(rows);
        expect(rows[0].paymentMethod).toBeNull();
        expect(rows[0].paymentBreakdown).toEqual([]);
        expect(rows[0].orderPayments).toEqual([]);
    });

    it('limpia el método en los SalesOrder crudos anidados en orders[] (la fuga real)', () => {
        const rows = [{
            paymentMethod: 'CASH',
            paymentBreakdown: [],
            orders: [
                {
                    paymentMethod: 'PDV_SHANKLISH',
                    orderPayments: [{ method: 'PDV_SHANKLISH', amountUSD: 20 }],
                    openTab: {
                        paymentSplits: [{ paymentMethod: 'ZELLE', paidAmount: 20 }],
                        subAccounts: [{ paymentMethod: 'CASH_USD', total: 20 }],
                    },
                },
            ],
        }];
        scrubPaymentMethodFromHistory(rows);
        const o = rows[0].orders[0] as any;
        expect(o.paymentMethod).toBeNull();
        expect(o.orderPayments).toEqual([]);
        expect(o.openTab.paymentSplits[0].paymentMethod).toBeNull();
        expect(o.openTab.subAccounts[0].paymentMethod).toBeNull();
        // No queda NINGÚN string de método de pago en todo el payload serializado.
        const json = JSON.stringify(rows);
        for (const leak of ['PDV_SHANKLISH', 'ZELLE', 'CASH_USD']) {
            expect(json).not.toContain(leak);
        }
    });

    it('preserva montos y demás datos (solo borra el método)', () => {
        const rows = [{
            paymentMethod: 'ZELLE',
            total: 33.5,
            orders: [{ paymentMethod: 'ZELLE', total: 33.5, openTab: { paymentSplits: [{ paymentMethod: 'ZELLE', paidAmount: 33.5 }] } }],
        }];
        scrubPaymentMethodFromHistory(rows);
        expect(rows[0].total).toBe(33.5);
        expect((rows[0].orders[0] as any).total).toBe(33.5);
        expect((rows[0].orders[0] as any).openTab.paymentSplits[0].paidAmount).toBe(33.5);
    });

    it('es idempotente y tolera filas sin orders/openTab', () => {
        const rows = [{ paymentMethod: 'CASH' }, { paymentMethod: 'CASH', orders: [] }];
        scrubPaymentMethodFromHistory(rows);
        scrubPaymentMethodFromHistory(rows);
        expect(rows[0].paymentMethod).toBeNull();
        expect(rows[1].paymentMethod).toBeNull();
    });
});
