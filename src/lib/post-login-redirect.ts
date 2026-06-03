/**
 * Calcula la URL de redirect post-login al subdomain del tenant.
 *
 * Si el usuario hizo login desde el root `kpsula.app` (o desde un subdomain
 * que no es el suyo), lo mandamos a `<slug>.kpsula.app/dashboard/home`.
 * La cookie usa `domain=.kpsula.app` en producción (ver src/lib/auth.ts),
 * así viaja al subdominio sin reloggear.
 *
 * Reglas:
 *   - Sin slug válido / regex inválida → null (cae al fallback del cliente).
 *   - Host no-kpsula (localhost, vercel preview, IP raw) → null.
 *   - Slug ya matchea el host → null (no redirige innecesariamente).
 *   - Root o subdominio incorrecto → URL absoluta al subdomain del tenant.
 *
 * Defensa-en-profundidad: si por cualquier motivo no podemos calcular un
 * target seguro, devolvemos null. El cliente cae a `router.push('/dashboard/home')`
 * — comportamiento histórico que sabemos que funciona.
 *
 * Si una cookie pre-mayo (host-only, sin domain=.kpsula.app) no viaja al
 * subdominio, el middleware del subdominio la trata como "sin sesión" y
 * redirige a /login. El usuario reloguea una vez y la cookie nueva ya
 * viaja para siempre. No hay bucle ni pérdida de datos — el cross-tenant
 * guard en middleware (src/middleware.ts) cubre el caso degradado.
 *
 * Pura, sin dependencias. Testeable en isolation.
 */
export function computePostLoginUrl(
    tenantSlug: string | null,
    hostOverride?: string,
): string | null {
    if (!tenantSlug || tenantSlug.length < 2) return null;
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(tenantSlug)) return null;

    const host =
        hostOverride !== undefined
            ? hostOverride
            : typeof window !== 'undefined'
                ? window.location.host.split(':')[0].toLowerCase()
                : '';
    if (!host) return null;

    const ROOT = 'kpsula.app';
    const expectedHost = `${tenantSlug}.${ROOT}`;

    // Ya estamos en el subdomain correcto → no redirigir.
    if (host === expectedHost) return null;

    // Solo redirigimos desde el root o desde otro subdominio de kpsula.app.
    // Hosts ajenos (localhost, vercel previews, IPs) → null para no romper
    // ambientes de desarrollo ni hacer redirects cross-host inesperados.
    const isRoot = host === ROOT;
    const isOtherSubdomain = host.endsWith('.' + ROOT) && host !== expectedHost;
    if (!isRoot && !isOtherSubdomain) return null;

    return `https://${expectedHost}/dashboard/home`;
}
