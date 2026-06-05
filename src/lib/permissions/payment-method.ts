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
