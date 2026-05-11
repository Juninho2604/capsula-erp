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
 * Dominio multi-tenant productivo. Solo hosts que terminen en
 * ".<TENANT_ROOT_DOMAIN>" extraen subdomain como slug del tenant.
 *
 * Cualquier otro host (vercel.app, localhost, dominios ajenos) NO extrae
 * tenant — cae al fallback. Esto evita que un preview de Vercel
 * (xxx.vercel.app) o un host desconocido sea tratado como un tenant slug.
 */
const TENANT_ROOT_DOMAIN = 'kpsula.app';

/**
 * Extrae el "subdomain del tenant" de un host string.
 *
 * Reglas:
 * - Solo extrae si el host termina exactamente en `.<TENANT_ROOT_DOMAIN>`.
 * - "shanklish.kpsula.app"           → "shanklish"
 * - "kpsula.app"                     → null (root sin subdomain)
 * - "www.kpsula.app"                 → null (www no es tenant)
 * - "capsula-erp.vercel.app"         → null (no es kpsula.app)
 * - "localhost:3000"                 → null
 * - "shanklish.staging.kpsula.app"   → "shanklish" (multi-nivel OK,
 *                                       toma la primera label)
 */
export function extractTenantSlugFromHost(host: string | null | undefined): string | null {
    if (!host) return null;
    const hostNoPort = host.split(':')[0]?.toLowerCase() ?? '';
    if (!hostNoPort) return null;

    // Caso 1: el host es exactamente el root domain (sin subdomain).
    if (hostNoPort === TENANT_ROOT_DOMAIN) return null;

    // Caso 2: el host debe terminar en ".<TENANT_ROOT_DOMAIN>". Si no,
    // no es un host de tenants (es un preview de Vercel, localhost, etc.).
    const requiredSuffix = '.' + TENANT_ROOT_DOMAIN;
    if (!hostNoPort.endsWith(requiredSuffix)) return null;

    // Extraer la parte antes del suffix y tomar la primera label.
    const prefix = hostNoPort.slice(0, -requiredSuffix.length);
    if (!prefix) return null;
    const candidate = prefix.split('.')[0];
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
