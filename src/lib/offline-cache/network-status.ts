/**
 * Detector de conectividad real del navegador.
 *
 * Por qué no basta `navigator.onLine`: en Chrome desktop devuelve `true`
 * cuando hay una interfaz de red activa (incluso si esa red no llega a
 * internet). En tablets es más confiable pero todavía miente con WiFi
 * captivo o redes restrictivas.
 *
 * Estrategia: combinamos `navigator.onLine` como hint barato + un ping
 * activo a `/api/health` con `cache: 'no-store'`. Si `navigator.onLine`
 * dice offline → offline cierto. Si dice online → confirmamos con ping
 * (timeout 4s). Si el ping falla 2 veces consecutivas → offline.
 *
 * El estado se publica vía un mini event emitter para que los hooks
 * React reaccionen sin polling. Cada cliente comparte la misma instancia.
 */

export type NetworkState = 'online' | 'offline' | 'unknown';

interface NetworkStatusInternals {
    state: NetworkState;
    consecutiveFailures: number;
    listeners: Set<(state: NetworkState) => void>;
    pollHandle: ReturnType<typeof setInterval> | null;
    lastChecked: number;
}

const PING_URL = '/api/health';
const PING_TIMEOUT_MS = 4000;
const POLL_INTERVAL_MS = 30_000;
const FAILURE_THRESHOLD = 2;

let internals: NetworkStatusInternals | null = null;

function ensure(): NetworkStatusInternals {
    if (internals) return internals;
    internals = {
        state: 'unknown',
        consecutiveFailures: 0,
        listeners: new Set(),
        pollHandle: null,
        lastChecked: 0,
    };
    return internals;
}

function setState(next: NetworkState) {
    const s = ensure();
    if (s.state === next) return;
    s.state = next;
    s.listeners.forEach((fn) => {
        try { fn(next); } catch { /* swallow listener errors */ }
    });
}

/**
 * Hace un ping activo. Devuelve true si llega 2xx en < timeout.
 */
async function pingHealth(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
        const res = await fetch(PING_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(t);
    }
}

/**
 * Chequea el estado y actualiza si cambia. Llamable desde event
 * listeners o desde el polling.
 */
export async function checkNetworkNow(): Promise<NetworkState> {
    const s = ensure();
    s.lastChecked = Date.now();

    if (typeof window === 'undefined') return 'unknown';

    // 1. Si el navegador dice offline, es offline.
    if (navigator.onLine === false) {
        s.consecutiveFailures = FAILURE_THRESHOLD;
        setState('offline');
        return 'offline';
    }

    // 2. navigator.onLine dice online — confirmamos con ping.
    const ok = await pingHealth();
    if (ok) {
        s.consecutiveFailures = 0;
        setState('online');
        return 'online';
    }

    // 3. Ping falló — contamos. Solo cambiamos a offline tras N fallos
    //    consecutivos para no oscilar con blips de 1-2 segundos.
    s.consecutiveFailures += 1;
    if (s.consecutiveFailures >= FAILURE_THRESHOLD) {
        setState('offline');
        return 'offline';
    }
    return s.state;
}

/**
 * Suscribe un listener al cambio de estado. Devuelve función para
 * desuscribir. El listener recibe el estado actual inmediatamente.
 */
export function subscribeNetworkStatus(listener: (state: NetworkState) => void): () => void {
    const s = ensure();
    s.listeners.add(listener);
    // Notificar estado actual al subscribirse (si ya inicializado).
    if (s.state !== 'unknown') listener(s.state);
    return () => { s.listeners.delete(listener); };
}

/**
 * Arranca el detector: registra listeners de eventos del navegador y
 * arranca polling cada 30s. Idempotente — si ya está iniciado, no-op.
 *
 * Devuelve función para detenerlo (útil en tests / unmount global).
 */
export function startNetworkMonitor(): () => void {
    if (typeof window === 'undefined') return () => {};
    const s = ensure();
    if (s.pollHandle) return stopNetworkMonitor;

    const onOnlineEvent = () => { checkNetworkNow(); };
    const onOfflineEvent = () => { setState('offline'); };
    const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') checkNetworkNow();
    };

    window.addEventListener('online', onOnlineEvent);
    window.addEventListener('offline', onOfflineEvent);
    document.addEventListener('visibilitychange', onVisibilityChange);

    s.pollHandle = setInterval(() => { checkNetworkNow(); }, POLL_INTERVAL_MS);

    // Primera medición.
    checkNetworkNow();

    // Cleanup function.
    return () => {
        window.removeEventListener('online', onOnlineEvent);
        window.removeEventListener('offline', onOfflineEvent);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        stopNetworkMonitor();
    };
}

export function stopNetworkMonitor() {
    const s = ensure();
    if (s.pollHandle) {
        clearInterval(s.pollHandle);
        s.pollHandle = null;
    }
}

export function getNetworkState(): NetworkState {
    return ensure().state;
}

/**
 * EXPUESTO SOLO PARA TESTS — resetea el estado interno.
 * No usar desde código de aplicación.
 */
export function __resetForTests() {
    if (internals?.pollHandle) clearInterval(internals.pollHandle);
    internals = null;
}
