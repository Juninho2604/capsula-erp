/**
 * Qué roles autorizan con PIN en el POS (§153) — fuente única, pura.
 *
 * El caso que la motiva (TablePong, 2026-08-14, y antes Shanklish): el dueño
 * le asigna un PIN a un usuario desde Configuración → Usuarios, la pantalla
 * dice "PIN actualizado correctamente"… y en el POS el PIN no valida nunca,
 * porque el usuario tiene un rol que las validaciones ni siquiera cargan como
 * candidato. El PIN nace muerto y nadie se entera hasta que la cajera está
 * frente al cliente.
 *
 * Dos fallas distintas que esto corrige:
 *  1. La lista de roles autorizados estaba copiada en cinco lugares
 *     (validateManagerPinAction, validateCashierPinAction, resolveVoidAuthPin,
 *     DIVISAS_OVERRIDE_ROLES y scripts/tenant-access.ts). Misma clase de bug
 *     que los permisos del conteo (§150).
 *  2. Asignar el PIN no avisaba que el rol del destinatario no autoriza.
 *     updateUserPin ahora usa pinRoleWarning() para avisar en el momento.
 */

/**
 * Roles cuyo PIN autoriza COBROS (validateManagerPinAction), la sesión de
 * caja (validateCashierPinAction) y los ajustes de % de divisas.
 */
export const CHARGE_AUTH_ROLES: string[] = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];

/**
 * Roles cuyo PIN autoriza ANULACIONES (resolveVoidAuthPin, pool de users).
 * AREA_LEAD anula pero no cobra — los capitanes de mesoneros anulan también,
 * pero con el PIN de la tabla `waiter`, no de `user`.
 */
export const VOID_AUTH_USER_ROLES: string[] = [...CHARGE_AUTH_ROLES, 'AREA_LEAD'];

export function canAuthorizeCharges(role: string | null | undefined): boolean {
    return !!role && CHARGE_AUTH_ROLES.includes(role);
}

export function canAuthorizeVoids(role: string | null | undefined): boolean {
    return !!role && VOID_AUTH_USER_ROLES.includes(role);
}

/**
 * Aviso para quien ASIGNA un PIN, según el rol del destinatario.
 * null = el PIN sirve para todo; no hay nada que avisar.
 *
 * No bloquea el guardado a propósito: bloquear rompería el orden natural de
 * configurar un usuario nuevo (PIN primero, rol después), y el rol correcto
 * puede venir en camino. Pero el aviso viaja en el mensaje de éxito, así que
 * quien asigna se entera en el momento — no la cajera frente al cliente.
 */
export function pinRoleWarning(role: string | null | undefined): string | null {
    if (canAuthorizeCharges(role)) return null;
    if (canAuthorizeVoids(role)) {
        return 'Ojo: con el rol Jefe de Área este PIN autoriza ANULACIONES pero NO cobros. '
            + 'Para cobrar en el POS el usuario debe ser Dueño, Gerente Adm. o Gerente Ops.';
    }
    return `Ojo: el rol ${role ?? '(sin rol)'} NO autoriza nada en el POS — este PIN no va a validar `
        + 'al cobrar ni al anular. Para eso el usuario debe ser Dueño, Gerente Adm., '
        + 'Gerente Ops. (o Jefe de Área, solo anulaciones). Cambia el rol en Configuración → Roles.';
}
