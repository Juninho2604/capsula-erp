/**
 * §168 — Cortesía en subcuentas, con PIN de gerencia. Puro.
 *
 * Caso que lo motiva (reporte de Gianni): una mesa con "descuento de
 * membresía" (operativamente, una cortesía en %) se dividió en subcuentas para
 * que cada quien pagara lo suyo — y el descuento desapareció, porque las
 * subcuentas sólo conocían el descuento de divisas. La cajera no hizo nada
 * mal: la función no existía.
 *
 * Reglas, calcadas de la cortesía de cuenta principal:
 *   - SIEMPRE requiere gerente validado (PIN → validateManagerPinAction →
 *     el server re-verifica el id contra CHARGE_AUTH_ROLES). Sin gerente no
 *     hay cortesía parcial ni total — nunca se degrada en silencio.
 *   - CORTESIA_100 cubre el subtotal completo de la subcuenta.
 *   - CORTESIA_PERCENT admite 1–99.99%. El 100 se rechaza a propósito: la
 *     cortesía total es CORTESIA_100, con su semántica propia (cobro $0,
 *     método CORTESIA) — no un porcentaje que "casualmente" da todo.
 *   - Un cobro lleva UN solo descuento: divisas o cortesía, nunca ambos.
 *     Esa exclusión la impone el caller; este módulo sólo resuelve cortesía.
 */

export interface SubCortesiaInput {
    type: 'CORTESIA_100' | 'CORTESIA_PERCENT';
    /** % solicitado — sólo aplica a CORTESIA_PERCENT. */
    percent?: number | null;
    /** Subtotal bruto de la subcuenta (sin servicio). */
    subtotal: number;
    /** Gerente re-verificado por el server. null = no autorizado. */
    manager: { firstName: string | null; lastName: string | null } | null;
}

export type SubCortesiaResult =
    | {
        ok: true;
        /** Monto a descontar, redondeado a centavos. */
        discount: number;
        /** % efectivo aplicado (100 para cortesía total). */
        percent: number;
        /** Nombre visible de quien autorizó, para el split. */
        authorizedBy: string;
    }
    | { ok: false; reason: 'UNAUTHORIZED' | 'INVALID_PERCENT' | 'INVALID_SUBTOTAL' };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function resolveSubAccountCortesia(input: SubCortesiaInput): SubCortesiaResult {
    if (!input.manager) return { ok: false, reason: 'UNAUTHORIZED' };
    const authorizedBy = [input.manager.firstName, input.manager.lastName]
        .filter(Boolean).join(' ').trim() || 'Gerencia';

    const subtotal = typeof input.subtotal === 'number' && Number.isFinite(input.subtotal)
        ? input.subtotal
        : NaN;
    if (!(subtotal > 0)) return { ok: false, reason: 'INVALID_SUBTOTAL' };

    if (input.type === 'CORTESIA_100') {
        return { ok: true, discount: round2(subtotal), percent: 100, authorizedBy };
    }

    const pct = typeof input.percent === 'number' && Number.isFinite(input.percent)
        ? input.percent
        : NaN;
    if (!(pct >= 1 && pct <= 99.99)) return { ok: false, reason: 'INVALID_PERCENT' };

    return {
        ok: true,
        discount: round2(subtotal * (pct / 100)),
        percent: Math.round(pct * 100) / 100,
        authorizedBy,
    };
}

/** Etiqueta corta para el split y el ticket: "Cortesía 100%" / "Cortesía 15%". */
export function subCortesiaLabel(percent: number): string {
    const p = Math.round(percent * 100) / 100;
    return `Cortesía ${Number.isInteger(p) ? p : p.toFixed(2)}%`;
}
