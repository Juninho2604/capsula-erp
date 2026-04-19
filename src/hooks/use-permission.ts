'use client';

/**
 * Hook client-side para consultar permisos del usuario logueado.
 *
 * Solo para UX (habilitar/deshabilitar botones, ocultar menús, etc).
 * La SEGURIDAD real vive en los Server Actions con `checkActionPermission`.
 * Un usuario malicioso podría editar el client-state — nunca confiar en
 * este hook para decisiones sensibles.
 *
 * Uso:
 *   const canVoid = usePermission(PERM.VOID_ORDER);
 *   <button disabled={!canVoid}>Anular</button>
 *
 *   const canManage = useAnyPermission([PERM.MANAGE_USERS, PERM.MANAGE_PINS]);
 */

import { useAuthStore } from '@/stores/auth.store';
import {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    type PermUser,
} from '@/lib/permissions/has-permission';
import type { PermKey } from '@/lib/constants/permissions-registry';

function buildPermUser(
    user: { role: string } | null,
    permissions: { allowedModules: string | null; grantedPerms: string | null; revokedPerms: string | null } | null,
): PermUser | null {
    if (!user) return null;
    return {
        role: user.role,
        allowedModules: permissions?.allowedModules ?? null,
        grantedPerms: permissions?.grantedPerms ?? null,
        revokedPerms: permissions?.revokedPerms ?? null,
    };
}

export function usePermission(perm: PermKey): boolean {
    const user = useAuthStore(s => s.user);
    const permissions = useAuthStore(s => s.permissions);
    const permUser = buildPermUser(user, permissions);
    if (!permUser) return false;
    return hasPermission(permUser, perm);
}

export function useAnyPermission(perms: PermKey[]): boolean {
    const user = useAuthStore(s => s.user);
    const permissions = useAuthStore(s => s.permissions);
    const permUser = buildPermUser(user, permissions);
    if (!permUser) return false;
    return hasAnyPermission(permUser, perms);
}

export function useAllPermissions(perms: PermKey[]): boolean {
    const user = useAuthStore(s => s.user);
    const permissions = useAuthStore(s => s.permissions);
    const permUser = buildPermUser(user, permissions);
    if (!permUser) return false;
    return hasAllPermissions(permUser, perms);
}
