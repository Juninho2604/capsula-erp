/**
 * Ajuste puntual del % de descuento por divisas (§149.2) — puro.
 *
 * El % general vive en Configuración → POS (§87). Al cobrar una subcuenta un
 * gerente puede pedir otro % SÓLO para ese cobro, autorizando con PIN.
 *
 * Esta función decide qué tasa se aplica y quién la autorizó. Está separada
 * de la action a propósito: es la pieza que decide cuánto dinero se descuenta,
 * y tiene que poder probarse sin base de datos.
 *
 * Reglas:
 *  - Sin descuento de divisas en el cobro → el override se ignora por completo.
 *    Un % ajustado no puede "colarse" en un pago en bolívares.
 *  - Con override pedido y SIN gerente verificado → se rechaza. No se degrada
 *    silenciosamente al % configurado: la cajera tiene que enterarse.
 *  - Con gerente verificado → se usa el % pedido, normalizado a [0, 90] por
 *    normalizeDivisasPercent (el tope evita regalar la venta por un typo).
 */

import { divisasDiscountRate } from './divisas-config';

export type DivisasRateResolution =
    | { ok: true; rate: number; overrideBy: string | null }
    | { ok: false; reason: 'UNAUTHORIZED' };

export interface ResolveDivisasRateInput {
    /** % configurado en SystemConfig, ya normalizado. */
    configuredPercent: number;
    /** true si este cobro realmente lleva descuento por divisas. */
    discountApplies: boolean;
    /** % pedido para este cobro. null/undefined = sin ajuste. */
    requestedPercent?: number | null;
    /**
     * Gerente ya verificado contra la BD (id activo y con rol autorizado).
     * null = no se pudo verificar. El llamador NO debe pasar acá lo que
     * mandó el cliente sin comprobarlo.
     */
    manager?: { firstName: string; lastName: string } | null;
}

export function resolveDivisasRate(input: ResolveDivisasRateInput): DivisasRateResolution {
    const configuredRate = divisasDiscountRate(input.configuredPercent);

    // Sin descuento aplicable, el override no existe.
    if (!input.discountApplies) {
        return { ok: true, rate: configuredRate, overrideBy: null };
    }

    // Sin ajuste pedido → el configurado, sin autor.
    if (input.requestedPercent == null || !Number.isFinite(input.requestedPercent)) {
        return { ok: true, rate: configuredRate, overrideBy: null };
    }

    const name = `${input.manager?.firstName ?? ''} ${input.manager?.lastName ?? ''}`.trim();
    if (!input.manager || !name) {
        return { ok: false, reason: 'UNAUTHORIZED' };
    }

    return {
        ok: true,
        rate: divisasDiscountRate(input.requestedPercent),
        overrideBy: name,
    };
}
