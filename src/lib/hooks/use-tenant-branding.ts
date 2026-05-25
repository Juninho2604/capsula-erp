'use client';

/**
 * useTenantBranding — hook que carga el branding del tenant activo desde
 * BD una sola vez al mount del componente. Cacheado en state local.
 *
 * Usado por callers de printReceipt (POS Restaurante, POS Delivery,
 * SubAccountPanel) para pasar branding al recibo. Si el tenant no tiene
 * branding seteado en BD, devuelve null — el recibo omite logo/RIF.
 *
 * No es global cache: cada componente que monta hace su propio fetch.
 * Aceptable porque la action `getTenantBrandingAction` es trivial
 * (single-row lookup por tenantId del JWT) y el branding raramente cambia
 * durante la vida de una sesión POS.
 */

import { useEffect, useState } from 'react';
import { getTenantBrandingAction, type TenantBranding } from '@/app/actions/branding.actions';

export function useTenantBranding(): TenantBranding | null {
    const [branding, setBranding] = useState<TenantBranding | null>(null);

    useEffect(() => {
        let mounted = true;
        getTenantBrandingAction()
            .then((b) => { if (mounted) setBranding(b); })
            .catch((err) => {
                // No bloquear UI si la fetch falla — el recibo simplemente
                // sale sin logo/RIF. Mejor recibo limpio que crash.
                console.error('[useTenantBranding]', err);
                if (mounted) setBranding(null);
            });
        return () => { mounted = false; };
    }, []);

    return branding;
}
