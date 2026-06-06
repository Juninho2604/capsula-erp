/**
 * Permiso fine-grained: ¿este rol puede ver el método de pago en historial
 * de ventas, detalle de venta y desglose del Report Z?
 *
 * Solo OWNER y ADMIN_MANAGER lo ven. Esto es independiente del flag
 * `hideCashierPaymentMethod` por tenant: el chequeo combinado es
 *
 *   const hide = !canViewPaymentMethod(role)
 *             && await tenantFeatureEnabled(tenantId, 'hideCashierPaymentMethod');
 *
 * Así el tenant puede prender el blindaje sin redeploy, y los roles altos
 * siguen viendo el dato siempre.
 */

const ALLOWED_ROLES = new Set(['OWNER', 'ADMIN_MANAGER']);

export function canViewPaymentMethod(role: string | undefined | null): boolean {
    if (!role) return false;
    return ALLOWED_ROLES.has(role);
}

/**
 * Política de ocultamiento del método de pago en el historial de ventas.
 *
 *  - OWNER / ADMIN_MANAGER: nunca se oculta (canViewPaymentMethod).
 *  - Roles de gestión que exportan (OPS_MANAGER, AUDITOR): se oculta solo si
 *    el tenant prendió el flag `hideCashierPaymentMethod` (histórico).
 *  - Roles de solo-lectura (cajera/mesero, sin EXPORT_SALES): SIEMPRE oculto
 *    — un rol que solo mira el historial no debe ver el método de pago.
 */
export function shouldHidePaymentMethod(args: {
    role: string | undefined | null;
    canExport: boolean;
    flagOn: boolean;
}): boolean {
    if (canViewPaymentMethod(args.role)) return false;
    return args.flagOn || !args.canExport;
}
