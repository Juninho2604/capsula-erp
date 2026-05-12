/**
 * Tests del detector de red. Cubre la máquina de estados:
 * navigator.onLine=false → offline inmediato.
 * navigator.onLine=true + ping ok → online.
 * navigator.onLine=true + ping fail × 1 → mantiene estado anterior.
 * navigator.onLine=true + ping fail × 2 → offline.
 * online sin cambio no notifica dos veces.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    checkNetworkNow,
    subscribeNetworkStatus,
    __resetForTests,
} from './network-status';

// Mock global fetch + navigator.onLine + window. navigator viene del entorno
// node y trae solo un getter; usamos defineProperty para sobreescribirlo.
function setupBrowserGlobals(onlineHint: boolean) {
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { addEventListener: () => {}, removeEventListener: () => {} },
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' },
    });
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { onLine: onlineHint },
    });
}

function teardownBrowserGlobals() {
    try { Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined }); } catch {}
    try { Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined }); } catch {}
    // navigator no se borra del entorno node — solo se reasigna en el próximo setup.
}

describe('network-status', () => {
    beforeEach(() => {
        __resetForTests();
    });

    afterEach(() => {
        __resetForTests();
        teardownBrowserGlobals();
        vi.restoreAllMocks();
    });

    it('navigator.onLine=false → offline inmediato sin pingear', async () => {
        setupBrowserGlobals(false);
        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy as unknown as typeof fetch;

        const state = await checkNetworkNow();

        expect(state).toBe('offline');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('ping 200 → online', async () => {
        setupBrowserGlobals(true);
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response('{"ok":true}', { status: 200 })
        ) as unknown as typeof fetch;

        const state = await checkNetworkNow();

        expect(state).toBe('online');
    });

    it('ping falla 1 vez → mantiene "unknown" o estado previo (no oscila)', async () => {
        setupBrowserGlobals(true);
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

        const state = await checkNetworkNow();

        expect(state).not.toBe('offline');
    });

    it('ping falla 2 veces consecutivas → offline', async () => {
        setupBrowserGlobals(true);
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

        await checkNetworkNow();
        const state = await checkNetworkNow();

        expect(state).toBe('offline');
    });

    it('ping recover (fail → ok) resetea el contador', async () => {
        setupBrowserGlobals(true);
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
            .mockRejectedValueOnce(new Error('Network error'));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        // 1er ping: fail (failures=1)
        await checkNetworkNow();
        // 2do ping: ok (failures=0, online)
        const stateAfterRecover = await checkNetworkNow();
        expect(stateAfterRecover).toBe('online');
        // 3er ping: fail (failures=1, NO offline aún)
        const stateAfterOneFail = await checkNetworkNow();
        expect(stateAfterOneFail).not.toBe('offline');
    });

    it('listener recibe transición online → offline', async () => {
        setupBrowserGlobals(true);
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response('{"ok":true}', { status: 200 })
        ) as unknown as typeof fetch;

        await checkNetworkNow(); // → online

        const received: string[] = [];
        const unsubscribe = subscribeNetworkStatus((s) => { received.push(s); });

        // Cambia el mock para fallar
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

        await checkNetworkNow(); // failures=1, no cambia aún
        await checkNetworkNow(); // failures=2, → offline

        unsubscribe();

        // Listener recibió: 'online' al suscribirse, luego 'offline' en la transición.
        expect(received).toContain('online');
        expect(received).toContain('offline');
    });

    it('mismo estado consecutivo NO notifica dos veces', async () => {
        setupBrowserGlobals(true);
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response('{"ok":true}', { status: 200 })
        ) as unknown as typeof fetch;

        await checkNetworkNow(); // → online

        const calls: string[] = [];
        const unsubscribe = subscribeNetworkStatus((s) => { calls.push(s); });

        // Llamamos 3 veces más con el mismo resultado online.
        await checkNetworkNow();
        await checkNetworkNow();
        await checkNetworkNow();

        unsubscribe();

        // Solo recibe 'online' una vez (la notificación inmediata al suscribirse).
        const onlineCalls = calls.filter((s) => s === 'online');
        expect(onlineCalls.length).toBe(1);
    });
});
