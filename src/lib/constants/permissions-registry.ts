/**
 * PERMISSIONS REGISTRY — Cápsula ERP
 *
 * Catálogo de permisos granulares del sistema.
 * Los roles base tienen un conjunto predeterminado (ROLE_BASE_PERMS).
 * Cada usuario puede recibir permisos adicionales (grantedPerms) o
 * tener revocados permisos del rol base (revokedPerms).
 *
 * Resolución: base ∪ granted - revoked
 */

// ─── Catálogo de permisos ─────────────────────────────────────────────────────

export const PERM = {
  // POS — Ventas
  VOID_ORDER:           'VOID_ORDER',           // Anular una orden ya confirmada
  APPLY_DISCOUNT:       'APPLY_DISCOUNT',        // Seleccionar tipo de descuento en POS
  APPROVE_DISCOUNT:     'APPROVE_DISCOUNT',      // Autorizar descuento/cortesía con PIN gerencial
  VIEW_ALL_ORDERS:      'VIEW_ALL_ORDERS',       // Ver órdenes de todas las cajeras (no solo las propias)
  VIEW_SALES_HISTORY:   'VIEW_SALES_HISTORY',    // Ver el historial de ventas (solo lectura — sin exportar/anular)
  REPRINT_COMANDA:      'REPRINT_COMANDA',       // Re-imprimir comanda de cocina

  // Inventario
  ADJUST_STOCK:         'ADJUST_STOCK',          // Crear ajuste manual de inventario
  APPROVE_TRANSFER:     'APPROVE_TRANSFER',      // Aprobar requisición de transferencia
  CLOSE_DAILY_INV:      'CLOSE_DAILY_INV',       // Cerrar inventario diario

  // Financiero
  EXPORT_SALES:         'EXPORT_SALES',          // Exportar arqueo / Reporte Z a Excel
  VIEW_COSTS:           'VIEW_COSTS',            // Ver costos y márgenes
  OPEN_CASH_REGISTER:   'OPEN_CASH_REGISTER',    // Abrir turno de caja
  CLOSE_CASH_REGISTER:  'CLOSE_CASH_REGISTER',   // Cerrar turno de caja
  VIEW_FINANCES:        'VIEW_FINANCES',         // Acceder al Dashboard Financiero (P&L)

  // Admin / Sistema
  MANAGE_USERS:         'MANAGE_USERS',          // Crear/editar usuarios y asignar roles
  MANAGE_PINS:          'MANAGE_PINS',           // Asignar PINs a otros usuarios
  CONFIGURE_SYSTEM:     'CONFIGURE_SYSTEM',      // Módulos, métodos de pago, fees (solo OWNER)
  MANAGE_BROADCAST:     'MANAGE_BROADCAST',      // Crear/editar anuncios al equipo

  // Reportes — permisos granulares por familia (reportes.<familia>.ver)
  REPORTES_VENTAS_VER:      'REPORTES_VENTAS_VER',      // reportes.ventas.ver
  REPORTES_OPERATIVOS_VER:  'REPORTES_OPERATIVOS_VER',  // reportes.operativos.ver (X/Z, anulaciones, auditoría)
  REPORTES_INVENTARIO_VER:  'REPORTES_INVENTARIO_VER',  // reportes.inventario.ver
  REPORTES_COMPRAS_VER:     'REPORTES_COMPRAS_VER',     // reportes.compras.ver
  REPORTES_GERENCIAL_VER:   'REPORTES_GERENCIAL_VER',   // reportes.gerencial.ver (solo roles administrativos)
  REPORTES_FISCAL_VER:      'REPORTES_FISCAL_VER',      // reportes.fiscal.ver
  REPORTES_EXPORTAR:        'REPORTES_EXPORTAR',        // reportes.exportar (Excel/PDF)
} as const;

export type PermKey = typeof PERM[keyof typeof PERM];

// ─── Permisos base por rol ────────────────────────────────────────────────────
// Estos son los permisos que cada rol tiene SIN ninguna configuración extra.
// grantedPerms añade a este set; revokedPerms quita de él.

export const ROLE_BASE_PERMS: Record<string, PermKey[]> = {
  OWNER: Object.values(PERM) as PermKey[],

  AUDITOR: [
    PERM.VIEW_ALL_ORDERS,
    PERM.VIEW_SALES_HISTORY,
    PERM.EXPORT_SALES,
    PERM.VIEW_COSTS,
    PERM.VIEW_FINANCES,
    PERM.REPORTES_VENTAS_VER,
    PERM.REPORTES_OPERATIVOS_VER,
    PERM.REPORTES_INVENTARIO_VER,
    PERM.REPORTES_COMPRAS_VER,
    PERM.REPORTES_GERENCIAL_VER,
    PERM.REPORTES_FISCAL_VER,
    PERM.REPORTES_EXPORTAR,
  ],

  ADMIN_MANAGER: [
    PERM.VOID_ORDER,
    PERM.APPLY_DISCOUNT,
    PERM.APPROVE_DISCOUNT,
    PERM.VIEW_ALL_ORDERS,
    PERM.VIEW_SALES_HISTORY,
    PERM.REPRINT_COMANDA,
    PERM.EXPORT_SALES,
    PERM.VIEW_COSTS,
    PERM.OPEN_CASH_REGISTER,
    PERM.CLOSE_CASH_REGISTER,
    PERM.VIEW_FINANCES,
    PERM.MANAGE_USERS,
    PERM.MANAGE_PINS,
    PERM.MANAGE_BROADCAST,
    PERM.REPORTES_VENTAS_VER,
    PERM.REPORTES_OPERATIVOS_VER,
    PERM.REPORTES_INVENTARIO_VER,
    PERM.REPORTES_COMPRAS_VER,
    PERM.REPORTES_GERENCIAL_VER,
    PERM.REPORTES_FISCAL_VER,
    PERM.REPORTES_EXPORTAR,
  ],

  OPS_MANAGER: [
    PERM.VOID_ORDER,
    PERM.APPLY_DISCOUNT,
    PERM.APPROVE_DISCOUNT,
    PERM.VIEW_ALL_ORDERS,
    PERM.VIEW_SALES_HISTORY,
    PERM.REPRINT_COMANDA,
    PERM.ADJUST_STOCK,
    PERM.APPROVE_TRANSFER,
    PERM.CLOSE_DAILY_INV,
    PERM.EXPORT_SALES,
    PERM.VIEW_COSTS,
    PERM.OPEN_CASH_REGISTER,
    PERM.CLOSE_CASH_REGISTER,
    PERM.MANAGE_BROADCAST,
    // Reportes: operación completa SIN gerencial (solo roles administrativos)
    PERM.REPORTES_VENTAS_VER,
    PERM.REPORTES_OPERATIVOS_VER,
    PERM.REPORTES_INVENTARIO_VER,
    PERM.REPORTES_COMPRAS_VER,
    PERM.REPORTES_EXPORTAR,
  ],

  HR_MANAGER: [
    PERM.MANAGE_USERS,
    PERM.MANAGE_PINS,
  ],

  CHEF: [
    PERM.ADJUST_STOCK,
    PERM.CLOSE_DAILY_INV,
    PERM.REPORTES_INVENTARIO_VER,
  ],

  AREA_LEAD: [
    PERM.ADJUST_STOCK,
    PERM.APPROVE_TRANSFER,
    PERM.CLOSE_DAILY_INV,
    PERM.REPORTES_INVENTARIO_VER,
  ],

  // Rol unificado de cajera — regla base mínima
  // Los módulos visibles se controlan con allowedModules (Capa 2)
  CASHIER: [
    PERM.APPLY_DISCOUNT,
    PERM.REPRINT_COMANDA,
    PERM.VIEW_SALES_HISTORY, // historial solo lectura — sin método de pago, sin exportar/anular
    PERM.OPEN_CASH_REGISTER,
    PERM.CLOSE_CASH_REGISTER,
  ],

  KITCHEN_CHEF: [],
  WAITER: [],
};

// ─── Agrupación para la UI de gestión de permisos ────────────────────────────

export const PERM_GROUPS: { key: string; label: string; icon: string; perms: PermKey[] }[] = [
  {
    key: 'pos',
    label: 'POS / Ventas',
    icon: '💳',
    perms: [
      PERM.VOID_ORDER,
      PERM.APPLY_DISCOUNT,
      PERM.APPROVE_DISCOUNT,
      PERM.VIEW_ALL_ORDERS,
      PERM.VIEW_SALES_HISTORY,
      PERM.REPRINT_COMANDA,
    ],
  },
  {
    key: 'inventory',
    label: 'Inventario',
    icon: '📦',
    perms: [
      PERM.ADJUST_STOCK,
      PERM.APPROVE_TRANSFER,
      PERM.CLOSE_DAILY_INV,
    ],
  },
  {
    key: 'financial',
    label: 'Financiero',
    icon: '💰',
    perms: [
      PERM.EXPORT_SALES,
      PERM.VIEW_COSTS,
      PERM.OPEN_CASH_REGISTER,
      PERM.CLOSE_CASH_REGISTER,
      PERM.VIEW_FINANCES,
    ],
  },
  {
    key: 'admin',
    label: 'Administración',
    icon: '🔐',
    perms: [
      PERM.MANAGE_USERS,
      PERM.MANAGE_PINS,
      PERM.CONFIGURE_SYSTEM,
      PERM.MANAGE_BROADCAST,
    ],
  },
  {
    key: 'reportes',
    label: 'Reportes',
    icon: '📊',
    perms: [
      PERM.REPORTES_VENTAS_VER,
      PERM.REPORTES_OPERATIVOS_VER,
      PERM.REPORTES_INVENTARIO_VER,
      PERM.REPORTES_COMPRAS_VER,
      PERM.REPORTES_GERENCIAL_VER,
      PERM.REPORTES_FISCAL_VER,
      PERM.REPORTES_EXPORTAR,
    ],
  },
];

// ─── Etiquetas legibles para cada permiso ────────────────────────────────────

export const PERM_LABELS: Record<PermKey, { label: string; description: string }> = {
  [PERM.VOID_ORDER]:          { label: 'Anular órdenes',        description: 'Anular ventas ya confirmadas' },
  [PERM.APPLY_DISCOUNT]:      { label: 'Aplicar descuentos',    description: 'Seleccionar tipo de descuento en POS' },
  [PERM.APPROVE_DISCOUNT]:    { label: 'Aprobar descuentos',    description: 'Autorizar cortesías con PIN gerencial' },
  [PERM.VIEW_ALL_ORDERS]:     { label: 'Ver todas las órdenes', description: 'Ver historial de todas las cajeras' },
  [PERM.VIEW_SALES_HISTORY]:  { label: 'Ver historial de ventas', description: 'Historial de órdenes en solo lectura (sin método de pago, sin exportar ni anular)' },
  [PERM.REPRINT_COMANDA]:     { label: 'Re-imprimir comanda',   description: 'Volver a imprimir comanda de cocina' },
  [PERM.ADJUST_STOCK]:        { label: 'Ajustar inventario',    description: 'Crear ajuste manual de stock' },
  [PERM.APPROVE_TRANSFER]:    { label: 'Aprobar transferencias',description: 'Aprobar requisición de transferencia entre áreas' },
  [PERM.CLOSE_DAILY_INV]:     { label: 'Cerrar inv. diario',    description: 'Cerrar el inventario diario del turno' },
  [PERM.EXPORT_SALES]:        { label: 'Exportar ventas',       description: 'Descargar arqueo y Reporte Z en Excel' },
  [PERM.VIEW_COSTS]:          { label: 'Ver costos',            description: 'Acceder a costos y márgenes por plato' },
  [PERM.OPEN_CASH_REGISTER]:  { label: 'Abrir caja',            description: 'Abrir turno de control de caja' },
  [PERM.CLOSE_CASH_REGISTER]: { label: 'Cerrar caja',           description: 'Cerrar turno y registrar diferencias' },
  [PERM.VIEW_FINANCES]:       { label: 'Ver finanzas',          description: 'Acceder al Dashboard Financiero (P&L)' },
  [PERM.MANAGE_USERS]:        { label: 'Gestionar usuarios',    description: 'Crear/editar usuarios y cambiar roles' },
  [PERM.MANAGE_PINS]:         { label: 'Gestionar PINs',        description: 'Asignar o cambiar PINs de otros usuarios' },
  [PERM.CONFIGURE_SYSTEM]:    { label: 'Configurar sistema',    description: 'Módulos, métodos de pago, fees (solo OWNER)' },
  [PERM.MANAGE_BROADCAST]:    { label: 'Gestionar anuncios',    description: 'Crear/editar anuncios al equipo' },
  [PERM.REPORTES_VENTAS_VER]:     { label: 'Reportes: ventas',      description: 'reportes.ventas.ver — ventas por producto/categoría/mesonero/área/método' },
  [PERM.REPORTES_OPERATIVOS_VER]: { label: 'Reportes: operativos',  description: 'reportes.operativos.ver — cierres X/Z, anulaciones, descuentos, transferencias' },
  [PERM.REPORTES_INVENTARIO_VER]: { label: 'Reportes: inventario',  description: 'reportes.inventario.ver — existencias valorizadas, kardex, variación' },
  [PERM.REPORTES_COMPRAS_VER]:    { label: 'Reportes: compras',     description: 'reportes.compras.ver — compras por proveedor, OC vs recepción' },
  [PERM.REPORTES_GERENCIAL_VER]:  { label: 'Reportes: gerencial',   description: 'reportes.gerencial.ver — KPIs ejecutivos, ingeniería de menú (solo administrativos)' },
  [PERM.REPORTES_FISCAL_VER]:     { label: 'Reportes: fiscal',      description: 'reportes.fiscal.ver — documentos fiscales (requiere infraestructura FASE C)' },
  [PERM.REPORTES_EXPORTAR]:       { label: 'Reportes: exportar',    description: 'reportes.exportar — descargar Excel/PDF de cualquier reporte' },
};

// ─── Función de resolución de permisos ───────────────────────────────────────

export function resolvePerms(role: string, grantedPerms?: string | null, revokedPerms?: string | null): Set<PermKey> {
  const base = new Set<PermKey>(ROLE_BASE_PERMS[role] ?? []);

  if (grantedPerms) {
    try {
      const granted = JSON.parse(grantedPerms) as PermKey[];
      granted.forEach(p => base.add(p));
    } catch { /* ignore malformed JSON */ }
  }

  if (revokedPerms) {
    try {
      const revoked = JSON.parse(revokedPerms) as PermKey[];
      revoked.forEach(p => base.delete(p));
    } catch { /* ignore malformed JSON */ }
  }

  return base;
}

export function canDo(role: string, perm: PermKey, grantedPerms?: string | null, revokedPerms?: string | null): boolean {
  return resolvePerms(role, grantedPerms, revokedPerms).has(perm);
}
