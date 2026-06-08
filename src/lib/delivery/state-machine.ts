/**
 * Máquina de estados de una orden de delivery (módulo aislado).
 *
 * Flujo feliz:
 *   ESPERANDO_PAGO → PAGO_POR_VALIDAR → EN_COCINA → LISTA → EN_CAMINO → ENTREGADA
 * CANCELADA es alcanzable desde cualquier estado no terminal.
 *
 * Funciones PURAS (sin Prisma) → testeables en aislamiento. La persistencia
 * y los efectos (encolar PrintJob, webhooks) viven en delivery.actions.ts /
 * los route handlers; acá solo se decide si una transición es legal.
 */

export const DELIVERY_STATES = [
    'ESPERANDO_PAGO',
    'PAGO_POR_VALIDAR',
    'EN_COCINA',
    'LISTA',
    'EN_CAMINO',
    'ENTREGADA',
    'CANCELADA',
] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

/** Estados desde los que ya no se puede transicionar. */
export const TERMINAL_STATES: ReadonlySet<DeliveryState> = new Set<DeliveryState>([
    'ENTREGADA',
    'CANCELADA',
]);

/** Transiciones del flujo feliz (sin contar la cancelación). */
const HAPPY_PATH: Record<DeliveryState, DeliveryState[]> = {
    ESPERANDO_PAGO: ['PAGO_POR_VALIDAR'],
    PAGO_POR_VALIDAR: ['EN_COCINA'],
    EN_COCINA: ['LISTA'],
    LISTA: ['EN_CAMINO'],
    EN_CAMINO: ['ENTREGADA'],
    ENTREGADA: [],
    CANCELADA: [],
};

export function isDeliveryState(value: string): value is DeliveryState {
    return (DELIVERY_STATES as readonly string[]).includes(value);
}

export function isTerminal(state: DeliveryState): boolean {
    return TERMINAL_STATES.has(state);
}

/**
 * ¿Es legal pasar de `from` a `to`?
 *
 * - El flujo feliz avanza una etapa a la vez.
 * - CANCELADA se permite desde cualquier estado NO terminal.
 * - No hay no-ops (from === to es inválido).
 */
export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
    if (from === to) return false;
    if (isTerminal(from)) return false;
    if (to === 'CANCELADA') return true;
    return HAPPY_PATH[from].includes(to);
}

/** Estados a los que `from` puede ir (incluye CANCELADA si aplica). */
export function nextStates(from: DeliveryState): DeliveryState[] {
    if (isTerminal(from)) return [];
    return [...HAPPY_PATH[from], 'CANCELADA'];
}

/**
 * Mapa estado → evento de webhook saliente (KPSULA → n8n). Solo las
 * transiciones que el bot necesita observar emiten webhook (Fase 3).
 */
export const STATE_WEBHOOK_EVENT: Partial<Record<DeliveryState, string>> = {
    EN_COCINA: 'orden.en_cocina',
    LISTA: 'orden.lista',
    EN_CAMINO: 'orden.en_camino',
    ENTREGADA: 'orden.entregada',
};
