/**
 * Tenant context — primitivos puros (testables sin Next.js).
 *
 * Este archivo contiene la lógica de extracción de slug del host y las
 * constantes del fallback. NO importa server-only ni next/headers, así
 * que se puede testear en isolation con vitest.
 *
 * El resolver completo (con headers + Prisma + JWT) vive en
 * tenant-context.server.ts.
 *
 * IMPORTANTE: ningún server action existente importa este módulo todavía.
 * Es código "dormante" para Fase 3 — se activará cuando configuremos
 * routing por subdominio en kpsula.app.
 */

/** Slug del tenant inicial. Mientras solo Shanklish opera, es el fallback. */
export const FALLBACK_TENANT_SLUG = 'shanklish';
export const FALLBACK_TENANT_ID = 'tnt_shanklish_caracas';

/**
 * Dominios raíz reconocidos. Si el host es uno de estos sin subdomain,
 * NO se intenta extraer slug (caso "kpsula.app" o "localhost").
 */
const ROOT_DOMAINS = [
    'kpsula.app',
    'localhost',
    'vercel.app',
];

/**
 * Extrae el "subdomain del tenant" de un host string.
 * - "shanklish.kpsula.app" → "shanklish"
 * - "kpsula.app"           → null
 * - "www.kpsula.app"       → null (www no es tenant)
 * - "localhost:3000"       → null
 */
export function extractTenantSlugFromHost(host: string | null | undefined): string | null {
    if (!host) return null;
    const hostNoPort = host.split(':')[0]?.toLowerCase() ?? '';

    // Si es un root domain conocido, no hay slug.
    if (ROOT_DOMAINS.includes(hostNoPort)) return null;

    const parts = hostNoPort.split('.');
    if (parts.length < 3) return null; // necesita al menos sub.dom.tld

    const candidate = parts[0];
    if (!candidate || candidate === 'www') return null;
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(candidate)) return null;

    return candidate;
}

export interface TenantContext {
    tenantId: string;
    slug: string;
    /** De dónde se resolvió: 'subdomain', 'session' o 'fallback'. */
    source: 'subdomain' | 'session' | 'fallback';
}
