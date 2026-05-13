/**
 * SUPER_ADMIN allowlist por email.
 *
 * No es un rol persistido en BD — un SUPER_ADMIN sigue siendo un `User`
 * normal (con `role: 'OWNER'` o cualquier otro) que pertenece a un tenant,
 * pero su email aparece en `SUPER_ADMIN_EMAILS` (env var, lista separada
 * por coma). Esa whitelist le habilita acceso a `/admin/*` y a operar
 * sobre cualquier tenant del sistema.
 *
 * Por qué env var y no DB:
 *   - No requiere schema change ni migration.
 *   - Revocar acceso = remover email de la var + restart pm2. Inmediato.
 *   - El JWT no necesita campos extra; chequeamos email contra la lista
 *     en cada request a /admin.
 *   - Bootstrap simple: el primer admin del sistema se setea con un edit
 *     de `.env` en el VPS, sin necesidad de un "primer login".
 *
 * Caveats:
 *   - El email es case-insensitive (normalizamos a lowercase).
 *   - Si la env var no existe, `isSuperAdmin` siempre devuelve false → /admin 404.
 *   - Útil setear distintos allowlists en Vercel y VPS si querés admins
 *     diferentes por entorno; por default suelen ser los mismos.
 */

let cached: { raw: string | undefined; set: Set<string> } | null = null;

function getAllowlist(): Set<string> {
    const raw = process.env.SUPER_ADMIN_EMAILS;
    if (cached && cached.raw === raw) return cached.set;
    const set = new Set<string>(
        (raw ?? '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length > 0),
    );
    cached = { raw, set };
    return set;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return getAllowlist().has(email.toLowerCase());
}

/**
 * Útil para tests — limpia el cache para que un nuevo valor de
 * `process.env.SUPER_ADMIN_EMAILS` se recalcule.
 */
export function __resetSuperAdminCache(): void {
    cached = null;
}
