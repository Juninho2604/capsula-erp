'use client';

/**
 * §157 — Fees de envío configurados, con carga RESILIENTE (mismo patrón que
 * useDivisasPercent, §99): reintenta 3 veces con backoff y si aun así falla
 * AVISA con un toast en vez de divergir en silencio, dejando los defaults.
 * El server recalcula el total con SU lectura de la config, así que una
 * tablet desactualizada no puede cobrar un fee viejo — pero sí mostrarlo, y
 * para eso está el aviso.
 */

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getDeliveryFeesAction } from '@/app/actions/system-config.actions';
import { DEFAULT_DELIVERY_FEES, type DeliveryFees } from '@/lib/sales/delivery-fee-config';

export function useDeliveryFees(): DeliveryFees {
    const [fees, setFees] = useState<DeliveryFees>(DEFAULT_DELIVERY_FEES);

    useEffect(() => {
        let alive = true;
        (async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const value = await getDeliveryFeesAction();
                    if (alive) setFees(value);
                    return;
                } catch {
                    await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
                }
            }
            if (alive) {
                toast.error(
                    `No se pudo cargar el costo de envío configurado — usando $${DEFAULT_DELIVERY_FEES.normal} / $${DEFAULT_DELIVERY_FEES.cercano} por defecto. Verificar conexión y recargar.`,
                    { duration: 8000 },
                );
            }
        })();
        return () => { alive = false; };
    }, []);

    return fees;
}
