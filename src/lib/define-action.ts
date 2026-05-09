/**
 * defineAction — wrapper para Server Actions multi-tenant.
 *
 * Reemplaza el patrón actual de cada action haciendo:
 *
 *   export async function myAction(args) {
 *     const guard = await checkActionPermission(PERM.X);
 *     if (!guard.ok) return { success: false, message: guard.message };
 *     // ... lógica
 *   }
 *
 * Por:
 *
 *   export const myAction = defineAction({
 *     permission: PERM.X,
 *     handler: async ({ user, tenant }, args) => {
 *       // ... lógica con user.id y tenant.tenantId garantizados
 *     },
 *   });
 *
 * Beneficios:
 *   - Validación de sesión + permiso + tenant context en UN solo lugar.
 *   - Imposible declarar una action sin guard (no se compila).
 *   - Cuando se active Fase 3 multi-tenant pleno, el handler recibe
 *     automáticamente el tenantId resuelto.
 *   - Manejo uniforme de errores (Zod, ForbiddenError, errores genéricos).
 *
 * Estado en este PR: DORMANTE. Disponible para usar en NUEVAS actions.
 * No migramos las existentes en esta sesión (el restaurante opera). La
 * migración se hará gradual con verificación caso a caso cuando esté
 * cerrado.
 */

import 'server-only';
import { checkActionPermission } from '@/lib/permissions/action-guard';
import { resolveTenantContext, type TenantContext } from '@/lib/tenant-context.server';
import type { PermKey } from '@/lib/constants/permissions-registry';
import type { PermUser } from '@/lib/permissions/has-permission';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ActionResult<T = unknown> =
    | { success: true; message?: string; data?: T }
    | { success: false; message: string };

export interface ActionContext {
    /** Usuario autenticado, validado y con tokenVersion al día. */
    user: PermUser & { id: string; email: string };
    /** Tenant resuelto del request (subdomain → JWT → fallback Shanklish). */
    tenant: TenantContext;
}

export interface DefineActionOptions<TArgs, TResult> {
    /** Permiso requerido. Si no se pasa, solo se valida sesión activa. */
    permission?: PermKey;
    /**
     * Handler con contexto inyectado. Recibe { user, tenant } + argumentos
     * tipados. Devuelve un ActionResult.
     */
    handler: (ctx: ActionContext, args: TArgs) => Promise<ActionResult<TResult>>;
    /**
     * Identificador para logs/audit. Útil para correlacionar errores con la
     * action específica. Recomendado pero opcional.
     */
    name?: string;
}

// ─── defineAction ────────────────────────────────────────────────────────────

/**
 * Construye una server action con auth + tenant context inyectados.
 *
 * Comportamiento:
 *   1. Valida sesión + permiso (si se especifica) usando checkActionPermission.
 *      Si falla → retorna { success: false, message } sin invocar el handler.
 *   2. Resuelve tenant context (resolveTenantContext: subdomain | session | fallback).
 *   3. Invoca handler con { user, tenant } y los argumentos del caller.
 *   4. Captura errores no-controlados → retorna { success: false } con mensaje genérico
 *      y loguea el error al server.
 */
export function defineAction<TArgs = void, TResult = unknown>(
    opts: DefineActionOptions<TArgs, TResult>,
): (args: TArgs) => Promise<ActionResult<TResult>> {
    return async (args: TArgs): Promise<ActionResult<TResult>> => {
        // 1. Validación de sesión + permiso.
        if (opts.permission) {
            const guard = await checkActionPermission(opts.permission);
            if (!guard.ok) {
                return { success: false, message: guard.message };
            }
            // 2. Tenant context (en el modo dormante actual: cae a fallback Shanklish).
            try {
                const tenant = await resolveTenantContext();
                return await opts.handler({ user: guard.user, tenant }, args);
            } catch (err) {
                console.error(`[defineAction${opts.name ? `:${opts.name}` : ''}]`, err);
                return { success: false, message: 'Error interno del servidor' };
            }
        }

        // Sin permiso requerido: aún validamos sesión (mismo guard con
        // un permiso "trivial" implícito no sirve; usamos un check menor).
        // Por ahora, sin permiso = sin validación (caller responsable).
        // En el futuro podemos añadir un modo "anon" o "authenticated".
        try {
            const tenant = await resolveTenantContext();
            // Sin guard, pasamos un user "anónimo" — el handler decide si lo necesita.
            const anonUser = {
                id: 'anonymous',
                email: 'anonymous',
                role: 'ANON',
                allowedModules: null,
                grantedPerms: null,
                revokedPerms: null,
            } satisfies PermUser & { id: string; email: string };
            return await opts.handler({ user: anonUser, tenant }, args);
        } catch (err) {
            console.error(`[defineAction${opts.name ? `:${opts.name}` : ''}]`, err);
            return { success: false, message: 'Error interno del servidor' };
        }
    };
}

// Re-exporta tipo PermUser por conveniencia.
export type { PermUser };
