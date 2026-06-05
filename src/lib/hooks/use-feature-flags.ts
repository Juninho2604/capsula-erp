'use client';

/**
 * Hook para leer los feature flags activos del tenant desde un client
 * component. Sigue el mismo patrón que `useTenantBranding`: fetch al
 * mount, cache en state local.
 *
 * Default mientras carga (o si falla la fetch): todos los flags en
 * `false`. Esto significa que la UI arranca con comportamiento legacy
 * y solo activa la feature flagged cuando confirma el response — más
 * seguro que pre-renderizar la feature y luego ocultarla.
 */

import { useEffect, useState } from 'react';
import { getActiveFeatureFlagsAction } from '@/app/actions/feature-flags.actions';
import { FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags';

function emptyFlags(): Record<FeatureFlagKey, boolean> {
    const out = {} as Record<FeatureFlagKey, boolean>;
    for (const k of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) out[k] = false;
    return out;
}

export function useTenantFeatureFlags(): Record<FeatureFlagKey, boolean> {
    const [flags, setFlags] = useState<Record<FeatureFlagKey, boolean>>(emptyFlags);

    useEffect(() => {
        let mounted = true;
        getActiveFeatureFlagsAction()
            .then(res => {
                if (!mounted) return;
                if (res.success && res.data) setFlags(res.data);
            })
            .catch(err => {
                console.error('[useTenantFeatureFlags]', err);
            });
        return () => {
            mounted = false;
        };
    }, []);

    return flags;
}
