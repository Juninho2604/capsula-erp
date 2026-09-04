/**
 * §171 — Quién y hasta cuándo puede anular un documento que ya entró al
 * inventario. Puro.
 *
 * Caso que lo motiva (Maurizio, administración): una factura de compra que ya
 * tiene entrada de inventario no se puede anular — el botón desaparece. La
 * regla era sana (anular sin revertir dejaría el stock inflado) pero choca de
 * frente con el flujo real: **los jefes dan entrada primero y administración
 * registra la factura después**, así que para cuando admin toca el documento
 * casi siempre ya está bloqueado. La ventana para corregir existía justo
 * cuando la persona que corrige no estaba mirando.
 *
 * Reglas acordadas con el dueño:
 *
 *   1. Dentro de 15 días — dueño y gerente de administración, con PIN.
 *   2. Pasados 15 días — sólo el dueño, con PIN. No se bloquea del todo: un
 *      bloqueo empuja a "arreglarlo" con ajustes a mano, que es peor y menos
 *      rastreable.
 *   3. **Bloqueo duro, sin importar la fecha, si hubo un conteo cerrado de ese
 *      almacén después de la entrada.** Es el peligro de verdad: revertir
 *      movería existencias que alguien ya verificó a mano, y eso reabre el
 *      descuadre que el conteo venía a cerrar.
 *
 * La fecha es un proxy; el conteo es el hecho. Por eso la regla 3 gana sobre
 * las otras dos.
 */

export const DOCUMENT_VOID_WINDOW_DAYS = 15;

/** Roles que pueden anular dentro de la ventana. */
export const VOID_ENTERED_ROLES = ['OWNER', 'ADMIN_MANAGER'] as const;
/** Rol que puede anular fuera de la ventana. */
export const VOID_ENTERED_ROLES_EXPIRED = ['OWNER'] as const;

export interface VoidEnteredInput {
    role: string;
    /** Cuándo entró la mercancía al inventario. */
    enteredAt: Date | string | null | undefined;
    /** Ahora. Parametrizado para poder probarlo. */
    now?: Date;
    /**
     * Conteos CERRADOS de los almacenes afectados, posteriores a la entrada.
     * Si hay alguno, se bloquea sin importar rol ni fecha.
     */
    closedCountsAfterEntry?: { areaName: string; closedAt: Date | string }[];
    /** Motivo escrito por quien anula. Obligatorio siempre. */
    reason?: string | null;
}

export type VoidEnteredCheck =
    | { ok: true; daysSinceEntry: number; outsideWindow: boolean }
    | {
        ok: false;
        reason:
            | 'NO_ENTRY_DATE'
            | 'MISSING_REASON'
            | 'COUNT_LOCKED'
            | 'ROLE_NOT_ALLOWED'
            | 'ROLE_NOT_ALLOWED_EXPIRED';
        message: string;
    };

const toDate = (v: Date | string | null | undefined): Date | null => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const fmt = (d: Date) =>
    d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function canVoidEnteredDocument(input: VoidEnteredInput): VoidEnteredCheck {
    const reason = (input.reason ?? '').trim();
    if (!reason) {
        return {
            ok: false, reason: 'MISSING_REASON',
            message: 'Indica el motivo de la anulación — es lo que se lee en la auditoría después.',
        };
    }

    // Regla 3 primero: el conteo gana sobre todo lo demás.
    const counts = (input.closedCountsAfterEntry ?? [])
        .map(c => ({ areaName: c.areaName, closedAt: toDate(c.closedAt) }))
        .filter((c): c is { areaName: string; closedAt: Date } => c.closedAt !== null)
        .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
    if (counts.length > 0) {
        const c = counts[0];
        return {
            ok: false, reason: 'COUNT_LOCKED',
            message:
                `El ${fmt(c.closedAt)} se cerró el conteo de ${c.areaName}. Revertir este ` +
                'documento movería existencias ya verificadas — corrígelo con un ajuste de inventario.',
        };
    }

    const entered = toDate(input.enteredAt);
    if (!entered) {
        return {
            ok: false, reason: 'NO_ENTRY_DATE',
            message: 'El documento no tiene fecha de entrada registrada. Revísalo con soporte antes de anular.',
        };
    }

    const now = input.now ?? new Date();
    const days = Math.floor((now.getTime() - entered.getTime()) / 86_400_000);
    const outsideWindow = days > DOCUMENT_VOID_WINDOW_DAYS;

    if (!outsideWindow) {
        if (!(VOID_ENTERED_ROLES as readonly string[]).includes(input.role)) {
            return {
                ok: false, reason: 'ROLE_NOT_ALLOWED',
                message: 'Anular un documento que ya entró al inventario lo autoriza el dueño o el gerente de administración.',
            };
        }
        return { ok: true, daysSinceEntry: days, outsideWindow: false };
    }

    if (!(VOID_ENTERED_ROLES_EXPIRED as readonly string[]).includes(input.role)) {
        return {
            ok: false, reason: 'ROLE_NOT_ALLOWED_EXPIRED',
            message:
                `Este documento entró hace ${days} días (más de ${DOCUMENT_VOID_WINDOW_DAYS}). ` +
                'Pasado ese plazo sólo el dueño puede anularlo.',
        };
    }
    return { ok: true, daysSinceEntry: days, outsideWindow: true };
}
