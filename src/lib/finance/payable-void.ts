/**
 * Anulación de cuentas por pagar (§160) — pura.
 *
 * Caso que la motiva: admin pregunta si puede ELIMINAR la FACTURA 007023 de
 * inversiones jal 1 C.A. ($183.71, Pendiente). Hoy no existe forma: el
 * documento se puede anular, pero la deuda que generó en Cuentas por Pagar no
 * — y anular el documento la dejaría huérfana, Pendiente para siempre.
 *
 * Se anula, no se borra. Un borrado real de facturas es lo primero que un
 * auditor cuestiona, y no hay caso que lo justifique: si se cargó mal, queda
 * el registro de quién la anuló y por qué.
 *
 * Regla dura: **una deuda con dinero encima no se anula.** Si ya tiene abonos
 * registrados o retenciones aplicadas (§115), esos movimientos son reales y
 * anular la deuda los dejaría apuntando a la nada. Primero se revierten los
 * pagos, después se anula.
 */

export interface PayableVoidCheckInput {
    status: string;
    /** Abonos acumulados en USD. */
    paidAmountUsd: number;
    /** Retenciones IVA aplicadas (§115) — cierran saldo sin salida de efectivo. */
    retentionIvaUsd?: number;
    /** Retenciones ISLR aplicadas (§115). */
    retentionIslrUsd?: number;
}

export interface PayableVoidCheck {
    ok: boolean;
    /** Motivo del rechazo, listo para mostrar. null si se puede anular. */
    reason: string | null;
}

/** Tolerancia de un centavo: un residuo flotante no es "dinero encima". */
const CENT = 0.005;

export function canVoidPayable(input: PayableVoidCheckInput): PayableVoidCheck {
    const status = (input.status || '').toUpperCase();

    if (status === 'VOID') {
        return { ok: false, reason: 'Esta cuenta por pagar ya está anulada.' };
    }

    const paid = num(input.paidAmountUsd);
    if (paid > CENT) {
        return {
            ok: false,
            reason: `No se puede anular: ya tiene $${paid.toFixed(2)} en abonos registrados. `
                + 'Revertí los pagos primero.',
        };
    }

    const retained = num(input.retentionIvaUsd) + num(input.retentionIslrUsd);
    if (retained > CENT) {
        return {
            ok: false,
            reason: `No se puede anular: tiene $${retained.toFixed(2)} en retenciones aplicadas. `
                + 'Revertí las retenciones primero.',
        };
    }

    // PAID sin abonos ni retenciones no debería existir, pero si aparece
    // (dato viejo o inconsistente) se bloquea: una deuda saldada no se anula.
    if (status === 'PAID') {
        return { ok: false, reason: 'Esta cuenta ya está saldada. Una deuda pagada no se anula.' };
    }

    return { ok: true, reason: null };
}

/**
 * ¿Esta cuenta cuenta para los totales de deuda?
 * Las anuladas siguen visibles en el listado completo, pero no suman.
 */
export function payableCountsTowardDebt(status: string): boolean {
    const s = (status || '').toUpperCase();
    return s !== 'VOID' && s !== 'PAID';
}

function num(n: number | null | undefined): number {
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}
