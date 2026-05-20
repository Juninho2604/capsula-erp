/**
 * Calcula la URL de redirect post-login al subdomain del tenant.
 *
 * ⚠️ DESHABILITADO TEMPORALMENTE (2026-05-20):
 *   El redirect a `<slug>.kpsula.app` causaba bucle/404 a cajeras
 *   cuando su cookie de sesión no viajaba al subdomain (cookies viejas
 *   sin `domain=.kpsula.app`, políticas del browser, etc.).
 *   Por ahora retornamos null → cliente cae al `router.push('/dashboard/home')`
 *   de toda la vida (sin redirect cross-host).
 *
 *   Para re-habilitar: descomentar el bloque de abajo. Antes asegurarse
 *   de que TODAS las cookies de session activas tengan domain=.kpsula.app
 *   (forzar logout masivo + relogin, o bumpear tokenVersion).
 *
 * Reglas (cuando estaba habilitado):
 *   - Devuelve null si no hay slug válido, host no es kpsula.app/subdomain,
 *     o ya estamos en el subdomain correcto.
 *   - Devuelve `https://<slug>.kpsula.app/dashboard/home` cuando aplica.
 *
 * Pura, sin dependencias. Testeable en isolation.
 */
export function computePostLoginUrl(
    tenantSlug: string | null,
    hostOverride?: string,
): string | null {
    // ⚠️ Disabled — ver comentario arriba.
    void tenantSlug;
    void hostOverride;
    return null;

    // === Bloque deshabilitado, mantener por si se re-habilita ===
    // if (!tenantSlug || tenantSlug.length < 2) return null;
    // if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(tenantSlug)) return null;
    //
    // const host =
    //     hostOverride !== undefined
    //         ? hostOverride
    //         : typeof window !== 'undefined'
    //             ? window.location.host.split(':')[0].toLowerCase()
    //             : '';
    // if (!host) return null;
    //
    // const ROOT = 'kpsula.app';
    // const isRoot = host === ROOT;
    // const isOtherSubdomain = host.endsWith('.' + ROOT) && host !== `${tenantSlug}.${ROOT}`;
    // if (!isRoot && !isOtherSubdomain) {
    //     return null;
    // }
    //
    // return `https://${tenantSlug}.${ROOT}/dashboard/home`;
}
