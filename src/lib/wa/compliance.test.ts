import { describe, it, expect } from 'vitest';
import {
    checkOutboundAllowed,
    computeWindow,
    isOptOutMessage,
    isWindowOpen,
    windowRemainingMs,
    WINDOW_MS,
    MAX_CONSECUTIVE_OUTBOUND,
    type SendCheckInput,
} from './compliance';

const NOW = new Date('2026-07-04T15:00:00Z');
const IN_WINDOW = new Date(NOW.getTime() + 60 * 60 * 1000);   // expira en 1h
const EXPIRED = new Date(NOW.getTime() - 60 * 1000);           // expiró hace 1min

function base(overrides: Partial<SendCheckInput> = {}): SendCheckInput {
    return {
        kind: 'TEXT',
        windowExpiresAt: IN_WINDOW,
        optedOutAt: null,
        marketingOptIn: false,
        template: null,
        consecutiveOutbound: 0,
        now: NOW,
        ...overrides,
    };
}

describe('isOptOutMessage (§4.3)', () => {
    it('detecta BAJA/STOP con mayúsculas, acentos y puntuación', () => {
        expect(isOptOutMessage('BAJA')).toBe(true);
        expect(isOptOutMessage('  stop  ')).toBe(true);
        expect(isOptOutMessage('Stop.')).toBe(true);
        expect(isOptOutMessage('No molestar!')).toBe(true);
        expect(isOptOutMessage('UNSUBSCRIBE')).toBe(true);
    });
    it('detecta frases naturales de baja', () => {
        expect(isOptOutMessage('quiero darme de baja')).toBe(true);
        expect(isOptOutMessage('Cancelar suscripción')).toBe(true);
        expect(isOptOutMessage('ya no quiero recibir mensajes')).toBe(true);
        expect(isOptOutMessage('desuscribirme por favor')).toBe(true);
        expect(isOptOutMessage('no deseo recibir más promociones')).toBe(true);
    });
    it('NO confunde cancelar un PEDIDO con opt-out', () => {
        expect(isOptOutMessage('quiero dar de baja el pedido')).toBe(false);
        expect(isOptOutMessage('en la parada del stop')).toBe(false);
        expect(isOptOutMessage('quiero cancelar mi pedido')).toBe(false);
        expect(isOptOutMessage(null)).toBe(false);
        expect(isOptOutMessage('')).toBe(false);
    });
});

describe('ventana 24h (§4.1)', () => {
    it('computeWindow suma exactamente 24h', () => {
        const w = computeWindow(NOW);
        expect(w.windowExpiresAt.getTime() - w.lastCustomerMsgAt.getTime()).toBe(WINDOW_MS);
    });
    it('isWindowOpen: vigente, expirada y nula', () => {
        expect(isWindowOpen(IN_WINDOW, NOW)).toBe(true);
        expect(isWindowOpen(EXPIRED, NOW)).toBe(false);
        expect(isWindowOpen(null, NOW)).toBe(false);
    });
    it('texto libre dentro de ventana → permitido', () => {
        expect(checkOutboundAllowed(base())).toEqual({ ok: true });
    });
    it('texto libre con ventana expirada → WINDOW_EXPIRED (server-side)', () => {
        const r = checkOutboundAllowed(base({ windowExpiresAt: EXPIRED }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('WINDOW_EXPIRED');
    });
    it('texto libre sin ventana (nunca escribió) → WINDOW_EXPIRED', () => {
        const r = checkOutboundAllowed(base({ windowExpiresAt: null }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('WINDOW_EXPIRED');
    });
    it('plantilla APPROVED con ventana expirada → permitida', () => {
        const r = checkOutboundAllowed(base({
            kind: 'TEMPLATE',
            windowExpiresAt: EXPIRED,
            template: { approvalStatus: 'APPROVED', category: 'UTILITY' },
        }));
        expect(r).toEqual({ ok: true });
    });
    it('plantilla NO aprobada → TEMPLATE_NOT_APPROVED', () => {
        const r = checkOutboundAllowed(base({
            kind: 'TEMPLATE',
            template: { approvalStatus: 'PENDING', category: 'UTILITY' },
        }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('TEMPLATE_NOT_APPROVED');
    });
    it('plantilla inexistente → TEMPLATE_NOT_FOUND', () => {
        const r = checkOutboundAllowed(base({ kind: 'TEMPLATE', template: null }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('TEMPLATE_NOT_FOUND');
    });
});

describe('opt-in marketing (§4.2)', () => {
    const marketingTpl = { approvalStatus: 'APPROVED', category: 'MARKETING' };
    it('MARKETING sin opt-in → NO_MARKETING_OPTIN', () => {
        const r = checkOutboundAllowed(base({ kind: 'TEMPLATE', template: marketingTpl, marketingOptIn: false }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('NO_MARKETING_OPTIN');
    });
    it('MARKETING con opt-in → permitida', () => {
        const r = checkOutboundAllowed(base({ kind: 'TEMPLATE', template: marketingTpl, marketingOptIn: true }));
        expect(r).toEqual({ ok: true });
    });
    it('MARKETING con opt-in pero opted-out → OPTED_OUT', () => {
        const r = checkOutboundAllowed(base({
            kind: 'TEMPLATE', template: marketingTpl, marketingOptIn: true, optedOutAt: NOW,
        }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('OPTED_OUT');
    });
});

describe('opt-out (§4.3)', () => {
    it('opted-out + ventana vigente (cliente volvió a escribir) → texto permitido', () => {
        const r = checkOutboundAllowed(base({ optedOutAt: NOW, windowExpiresAt: IN_WINDOW }));
        expect(r).toEqual({ ok: true });
    });
    it('opted-out + ventana expirada → texto bloqueado con OPTED_OUT', () => {
        const r = checkOutboundAllowed(base({ optedOutAt: NOW, windowExpiresAt: EXPIRED }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('OPTED_OUT');
    });
    it('opted-out + plantilla UTILITY (transaccional) → permitida', () => {
        const r = checkOutboundAllowed(base({
            kind: 'TEMPLATE',
            optedOutAt: NOW,
            windowExpiresAt: EXPIRED,
            template: { approvalStatus: 'APPROVED', category: 'UTILITY' },
        }));
        expect(r).toEqual({ ok: true });
    });
});

describe('rate limit (§4.4)', () => {
    it(`${MAX_CONSECUTIVE_OUTBOUND} consecutivos sin INBOUND → RATE_LIMITED`, () => {
        const r = checkOutboundAllowed(base({ consecutiveOutbound: MAX_CONSECUTIVE_OUTBOUND }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe('RATE_LIMITED');
    });
    it('override de gerente lo permite', () => {
        const r = checkOutboundAllowed(base({
            consecutiveOutbound: MAX_CONSECUTIVE_OUTBOUND, managerOverride: true,
        }));
        expect(r).toEqual({ ok: true });
    });
    it('por debajo del límite pasa sin override', () => {
        const r = checkOutboundAllowed(base({ consecutiveOutbound: MAX_CONSECUTIVE_OUTBOUND - 1 }));
        expect(r).toEqual({ ok: true });
    });
});

describe('windowRemainingMs', () => {
    it('devuelve restante y 0 al expirar', () => {
        expect(windowRemainingMs(IN_WINDOW, NOW)).toBe(60 * 60 * 1000);
        expect(windowRemainingMs(EXPIRED, NOW)).toBe(0);
        expect(windowRemainingMs(null, NOW)).toBe(0);
    });
});
