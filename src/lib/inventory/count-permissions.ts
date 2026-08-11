/**
 * Quién puede hacer qué en el conteo de inventario (§150) — pura, sin BD.
 *
 * Antes esta matriz estaba copiada en CUATRO lugares: el registro de módulos
 * (que decide si aparece en el sidebar), las dos páginas del módulo, y las
 * actions. Se desincronizaron, y el resultado fue el reporte del 9 de agosto:
 * los jefes de cocina no podían ni abrir el módulo, y aprobar el ajuste lo
 * podía un solo gerente. Un permiso vive acá y en ningún otro lado.
 *
 * Las tres capacidades:
 *
 *  - COUNT   contar: abrir una sesión, escribir cantidades, retomar mañana,
 *            y dejarla lista para revisión.
 *  - APPLY   aplicar: confirmar el ajuste y mover el stock real. Es el
 *            control del módulo — el conteo existe justamente porque las
 *            cantidades cargadas no cuadraban con el inventario.
 *  - CANCEL  descartar una sesión sin aplicarla.
 *
 * Regla de negocio (Omar, grupo SISTEMA SC, 2026-08-09):
 *   "El ajuste de inventario se hará efectivo una vez gerencia o auditoría
 *    haga la validación en el sistema".
 * Por eso AUDITOR aplica, y el chef y los jefes cuentan pero no aplican.
 */

/** Contar: producción, cocina, jefes de área, chef, gerencia y auditoría. */
export const COUNT_ROLES: string[] = [
    'OWNER',
    'AUDITOR',
    'ADMIN_MANAGER',
    'OPS_MANAGER',
    'CHEF',
    'AREA_LEAD',
    'KITCHEN_CHEF',
];

/**
 * Aplicar el ajuste al stock. Gerencia y auditoría, nadie más.
 * A propósito NO incluye CHEF ni AREA_LEAD ni KITCHEN_CHEF: quien cuenta no
 * confirma su propio conteo. Ese es todo el punto del módulo.
 */
export const APPLY_SESSION_ROLES: string[] = [
    'OWNER',
    'AUDITOR',
    'ADMIN_MANAGER',
    'OPS_MANAGER',
];

/** Cancelar una sesión: mismo criterio que aplicar. */
export const CANCEL_SESSION_ROLES: string[] = APPLY_SESSION_ROLES;

export function canCount(role: string | null | undefined): boolean {
    return !!role && COUNT_ROLES.includes(role);
}

export function canApplyCount(role: string | null | undefined): boolean {
    return !!role && APPLY_SESSION_ROLES.includes(role);
}

export function canCancelCount(role: string | null | undefined): boolean {
    return !!role && CANCEL_SESSION_ROLES.includes(role);
}
