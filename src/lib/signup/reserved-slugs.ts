/**
 * Slugs reservados — no se pueden usar como slug de tenant.
 *
 * Razones:
 * - Conflicto con subdominios técnicos (www, api, admin, etc.)
 * - Conflicto con rutas de la app (login, signup, admin, etc.)
 * - Riesgo de phishing / typosquatting de marcas conocidas
 * - Confusión semántica (shanklish ya existe, kpsula es el dominio)
 *
 * La validación se hace case-insensitive. El slug ya pasa por
 * `extractTenantSlugFromHost` que lo normaliza a lowercase ASCII.
 */
export const RESERVED_TENANT_SLUGS = new Set<string>([
    // Subdominios técnicos comunes
    'www',
    'mail',
    'email',
    'ftp',
    'sftp',
    'ssh',
    'webmail',
    'cpanel',
    'whm',

    // Rutas de la app que pisarían el subdomain
    'api',
    'admin',
    'dashboard',
    'login',
    'logout',
    'signup',
    'register',
    'auth',
    'app',
    'static',
    'public',
    'assets',
    'cdn',
    'img',
    'image',
    'images',

    // Servicios operacionales / monitoring
    'status',
    'health',
    'monitor',
    'monitoring',
    'metrics',
    'logs',
    'debug',
    'beta',
    'alpha',
    'staging',
    'dev',
    'test',
    'testing',
    'demo',
    'sandbox',
    'qa',

    // Identidad del producto / marca
    'kpsula',
    'capsula',
    'shanklish',
    'soporte',
    'support',
    'help',
    'contacto',
    'contact',
    'legal',
    'terms',
    'privacy',
    'privacidad',
    'ayuda',
    'docs',
    'documentation',
    'blog',
    'news',
    'press',
    'careers',
    'jobs',

    // Catch-all defensivos
    'root',
    'system',
    'me',
    'my',
    'mi',
    'us',
    'tu',
    'tus',
]);

export function isReservedSlug(slug: string): boolean {
    return RESERVED_TENANT_SLUGS.has(slug.toLowerCase());
}
