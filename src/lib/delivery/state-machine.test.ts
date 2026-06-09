import { describe, it, expect } from 'vitest';
import {
    canTransition,
    nextStates,
    isTerminal,
    isDeliveryState,
    STATE_WEBHOOK_EVENT,
} from './state-machine';

describe('delivery state machine', () => {
    it('avanza el flujo feliz una etapa a la vez', () => {
        expect(canTransition('ESPERANDO_PAGO', 'PAGO_POR_VALIDAR')).toBe(true);
        expect(canTransition('PAGO_POR_VALIDAR', 'EN_COCINA')).toBe(true);
        expect(canTransition('EN_COCINA', 'LISTA')).toBe(true);
        expect(canTransition('LISTA', 'EN_CAMINO')).toBe(true);
        expect(canTransition('EN_CAMINO', 'ENTREGADA')).toBe(true);
    });

    it('no permite saltar etapas', () => {
        expect(canTransition('ESPERANDO_PAGO', 'EN_COCINA')).toBe(false);
        expect(canTransition('PAGO_POR_VALIDAR', 'EN_CAMINO')).toBe(false);
        expect(canTransition('EN_COCINA', 'ENTREGADA')).toBe(false);
    });

    it('no permite retroceder ni no-ops', () => {
        expect(canTransition('EN_COCINA', 'PAGO_POR_VALIDAR')).toBe(false);
        expect(canTransition('EN_COCINA', 'EN_COCINA')).toBe(false);
    });

    it('permite CANCELADA desde cualquier estado no terminal', () => {
        expect(canTransition('ESPERANDO_PAGO', 'CANCELADA')).toBe(true);
        expect(canTransition('EN_CAMINO', 'CANCELADA')).toBe(true);
    });

    it('no transiciona desde estados terminales', () => {
        expect(isTerminal('ENTREGADA')).toBe(true);
        expect(isTerminal('CANCELADA')).toBe(true);
        expect(canTransition('ENTREGADA', 'CANCELADA')).toBe(false);
        expect(canTransition('CANCELADA', 'EN_COCINA')).toBe(false);
        expect(nextStates('ENTREGADA')).toEqual([]);
    });

    it('nextStates incluye la próxima etapa feliz + CANCELADA', () => {
        expect(nextStates('EN_COCINA')).toEqual(['LISTA', 'CANCELADA']);
        expect(nextStates('EN_CAMINO')).toEqual(['ENTREGADA', 'CANCELADA']);
    });

    it('valida nombres de estado', () => {
        expect(isDeliveryState('EN_COCINA')).toBe(true);
        expect(isDeliveryState('FOO')).toBe(false);
    });

    it('mapea estados a eventos de webhook', () => {
        expect(STATE_WEBHOOK_EVENT.EN_COCINA).toBe('orden.en_cocina');
        expect(STATE_WEBHOOK_EVENT.ENTREGADA).toBe('orden.entregada');
        expect(STATE_WEBHOOK_EVENT.ESPERANDO_PAGO).toBeUndefined();
    });
});
