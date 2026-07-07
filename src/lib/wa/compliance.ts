/**
 * Compliance de mensajería WhatsApp (Cloud API Meta) — funciones PURAS.
 *
 * Reglas §4 del spec del módulo Conversaciones:
 *   4.1 Ventana de servicio de 24h (texto libre solo dentro de ventana;
 *       plantillas APPROVED siempre).
 *   4.2 Opt-in de marketing (plantillas MARKETING solo con marketingOptIn).
 *   4.3 Opt-out (BAJA/STOP): bloquea todo salvo respuestas dentro de ventana
 *       y plantillas UTILITY transaccionales.
 *   4.4 Anti-spam: máx. 10 OUTBOUND consecutivos sin INBOUND de por medio
 *       (bloqueo suave, override de gerente).
 *
 * Estas reglas se aplican SIEMPRE en el servidor (actions/API), la UI solo
 * las refleja. Sin dependencias de Prisma — testeable con vitest.
 */

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export const MAX_CONSECUTIVE_OUTBOUND = 10;

/** Texto fijo de confirmación de baja (§4.3) — se envía UNA sola vez. */
export const OPT_OUT_CONFIRMATION_TEXT =
    'Entendido, no te enviaremos más mensajes promocionales. ' +
    'Si necesitas hacer un pedido o tienes una consulta, escríbenos cuando quieras.';

/** Normaliza texto para matching: minúsculas, sin acentos, sin puntuación de borde. */
function normalizeText(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[.,;:!¡¿?"'«»()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Palabras clave canónicas que Meta espera reconocer como opt-out cuando
 * llegan SOLAS (mensaje completo). "baja" tiene ambigüedad en español
 * (adjetivo/verbo), pero como palabra única aislada casi siempre es opt-out;
 * el falso positivo es reversible (el cliente vuelve a escribir y sigue).
 */
const OPT_OUT_KEYWORDS = new Set(['baja', 'stop', 'no molestar', 'unsubscribe', 'cancelar suscripcion', 'desuscribir', 'desuscribirme']);

/**
 * Frases naturales de baja (§4.3). Distingue "darme de baja" (opt-out) de
 * "dar de baja el pedido" (cancelar orden). Sobre texto ya normalizado.
 */
const OPT_OUT_PATTERNS: RegExp[] = [
    /\b(darme|darse|dame|quiero.*(darme|darse)) de baja\b/,
    /\bcancelar (la )?suscripcion\b/,
    /\bdesuscribir(me)?\b/,
    /\bno (quiero|deseo) (recibir )?(mas )?(mensajes|promociones|publicidad|notificaciones)\b/,
    /\bya no (quiero|deseo).*(mensajes|promociones|publicidad|recibir)\b/,
];

/** ¿El mensaje entrante es una solicitud de baja? (§4.3) */
export function isOptOutMessage(text: string | null | undefined): boolean {
    if (!text) return false;
    const n = normalizeText(text);
    if (OPT_OUT_KEYWORDS.has(n)) return true;
    return OPT_OUT_PATTERNS.some(re => re.test(n));
}

/** Ventana nueva a partir de un mensaje entrante. */
export function computeWindow(now: Date): { lastCustomerMsgAt: Date; windowExpiresAt: Date } {
    return {
        lastCustomerMsgAt: now,
        windowExpiresAt: new Date(now.getTime() + WINDOW_MS),
    };
}

/** ¿La ventana de 24h está vigente? */
export function isWindowOpen(windowExpiresAt: Date | null | undefined, now: Date): boolean {
    if (!windowExpiresAt) return false;
    return now.getTime() <= windowExpiresAt.getTime();
}

export type OutboundKind = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'TEMPLATE';

export type SendRejectionCode =
    | 'WINDOW_EXPIRED'
    | 'OPTED_OUT'
    | 'NO_MARKETING_OPTIN'
    | 'TEMPLATE_NOT_FOUND'
    | 'TEMPLATE_NOT_APPROVED'
    | 'RATE_LIMITED';

export type SendCheckResult =
    | { ok: true }
    | { ok: false; code: SendRejectionCode; message: string };

export interface SendCheckInput {
    kind: OutboundKind;
    windowExpiresAt: Date | null;
    optedOutAt: Date | null;
    marketingOptIn: boolean;
    /** Datos de la plantilla si kind=TEMPLATE (null = no encontrada). */
    template?: { approvalStatus: string; category: string } | null;
    /** OUTBOUND consecutivos sin INBOUND de por medio (para §4.4). */
    consecutiveOutbound: number;
    /** true si un gerente confirmó el envío pese al rate limit (§4.4). */
    managerOverride?: boolean;
    now: Date;
}

/**
 * Regla central de envío OUTBOUND (§4.1–§4.4). Orden de evaluación:
 *   1. Plantilla: debe existir y estar APPROVED.
 *   2. Opt-out: bloquea todo salvo (a) mensajes dentro de ventana vigente
 *      (el cliente volvió a escribir) y (b) plantillas UTILITY.
 *   3. Marketing: plantilla MARKETING exige marketingOptIn y no opt-out.
 *   4. Ventana: no-plantilla fuera de ventana → rechazo.
 *   5. Rate limit: >= MAX_CONSECUTIVE_OUTBOUND sin INBOUND → bloqueo suave.
 */
export function checkOutboundAllowed(input: SendCheckInput): SendCheckResult {
    const {
        kind, windowExpiresAt, optedOutAt, marketingOptIn,
        template, consecutiveOutbound, managerOverride, now,
    } = input;

    const windowOpen = isWindowOpen(windowExpiresAt, now);

    if (kind === 'TEMPLATE') {
        if (!template) {
            return { ok: false, code: 'TEMPLATE_NOT_FOUND', message: 'La plantilla no está registrada para este tenant.' };
        }
        if (template.approvalStatus !== 'APPROVED') {
            return {
                ok: false,
                code: 'TEMPLATE_NOT_APPROVED',
                message: `La plantilla no está aprobada por Meta (estado: ${template.approvalStatus}).`,
            };
        }
        if (template.category === 'MARKETING') {
            if (optedOutAt) {
                return { ok: false, code: 'OPTED_OUT', message: 'El cliente pidió la baja (BAJA/STOP). No se pueden enviar plantillas de marketing.' };
            }
            if (!marketingOptIn) {
                return { ok: false, code: 'NO_MARKETING_OPTIN', message: 'El cliente no dio opt-in de marketing. Solo plantillas UTILITY.' };
            }
        }
        // UTILITY/AUTHENTICATION: permitidas aun con opt-out (§4.3.b —
        // transaccionales de un pedido en curso).
    } else {
        // Texto libre / media
        if (optedOutAt && !windowOpen) {
            return { ok: false, code: 'OPTED_OUT', message: 'El cliente pidió la baja y la ventana no está vigente. Solo plantillas UTILITY.' };
        }
        if (!windowOpen) {
            return {
                ok: false,
                code: 'WINDOW_EXPIRED',
                message: 'La ventana de 24h expiró. Solo puede enviar una plantilla aprobada.',
            };
        }
    }

    if (consecutiveOutbound >= MAX_CONSECUTIVE_OUTBOUND && !managerOverride) {
        return {
            ok: false,
            code: 'RATE_LIMITED',
            message: `Ya se enviaron ${consecutiveOutbound} mensajes sin respuesta del cliente. Un gerente debe confirmar el envío.`,
        };
    }

    return { ok: true };
}

/** Milisegundos restantes de ventana (0 si expirada/inexistente) — para la UI. */
export function windowRemainingMs(windowExpiresAt: Date | null | undefined, now: Date): number {
    if (!windowExpiresAt) return 0;
    return Math.max(0, windowExpiresAt.getTime() - now.getTime());
}
