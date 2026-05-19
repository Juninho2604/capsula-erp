/**
 * Calcula la URL de redirect post-login al subdomain del tenant.
 *
 * Reglas:
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
    if (!tenantSlug || tenantSlug.length < 2) return null;
    // /^[a-z0-9][a-z0-9-]{0,62}$/ — valid DNS label
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(tenantSlug)) return null;

    const host =
        hostOverride !== undefined
            ? hostOverride
            : typeof window !== 'undefined'
                ? window.location.host.split(':')[0].toLowerCase()
                : '';
    if (!host) return null;

    const ROOT = 'kpsula.app';
    const isRoot = host === ROOT;
    const isOtherSubdomain = host.endsWith('.' + ROOT) && host !== `${tenantSlug}.${ROOT}`;
    if (!isRoot && !isOtherSubdomain) {
        // localhost / Vercel preview / IP raw / ya en subdomain correcto
        return null;
    }

    return `https://${tenantSlug}.${ROOT}/dashboard/home`;
}
