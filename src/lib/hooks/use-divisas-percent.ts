'use client';

/**
 * §99 — % de descuento por divisas con carga RESILIENTE.
 *
 * Antes cada POS hacía `getDivisasDiscountPercentAction().catch(() => {})`:
 * si la carga fallaba (wifi del salón), esa tablet se quedaba con el default
 * 33,33% mientras las demás usaban el % configurado → montos distintos por
 * CÉNTIMOS entre dispositivos, y como el cobro de mesas confía en el
 * descuento calculado por el cliente, la diferencia se cobraba de verdad.
 *
 * Este hook reintenta 3 veces con backoff y, si aun así falla, AVISA con un
 * toast (en vez de divergir en silencio) dejando el default histórico.
 */

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getDivisasDiscountPercentAction } from '@/app/actions/system-config.actions';
import { DEFAULT_DIVISAS_DISCOUNT_PERCENT } from '@/lib/sales/divisas-config';

export function useDivisasPercent(): number {
    const [percent, setPercent] = useState<number>(DEFAULT_DIVISAS_DISCOUNT_PERCENT);

    useEffect(() => {
        let alive = true;
        (async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const value = await getDivisasDiscountPercentAction();
                    if (alive) setPercent(value);
                    return;
                } catch {
                    await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
                }
            }
            if (alive) {
                toast.error(
                    `No se pudo cargar el % de divisas configurado — usando ${(Math.round(DEFAULT_DIVISAS_DISCOUNT_PERCENT * 100) / 100)}% por defecto. Verificar conexión y recargar.`,
                    { duration: 8000 },
                );
            }
        })();
        return () => { alive = false; };
    }, []);

    return percent;
}
