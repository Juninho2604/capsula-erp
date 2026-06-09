/**
 * CAPSULA ERP — Module Registry
 * 
 * Registro maestro de TODOS los módulos disponibles del sistema.
 * El ADMIN puede activar/desactivar módulos por instalación.
 * 
 * Cada instalación del ERP lee la variable ENABLED_MODULES 
 * (o lo trae de la BD) y solo muestra los módulos activos.
 */

export interface ModuleDefinition {
  /** Identificador único del módulo */
  id: string;
  /** Nombre legible */
  label: string;
  /** Descripción corta */
  description: string;
  /** Icono emoji */
  icon: string;
  /** Ruta principal del módulo en el dashboard */
  href: string;
  /** Sección del sidebar donde aparece */
  section: 'operations' | 'sales' | 'admin' | 'games';
  /** Si está habilitado por defecto en una nueva instalación */
  enabledByDefault: boolean;
  /** Orden de aparición en el sidebar */
  sortOrder: number;
  /** Sub-rutas que pertenecen a este módulo (para breadcrumbs, etc.) */
  subRoutes?: string[];
  /** Tags para búsqueda / agrupación */
  tags?: string[];
  /**
   * Si está seteado, el módulo solo es visible cuando el feature flag del
   * tenant (clave de FEATURE_FLAGS en `src/lib/feature-flags.ts`) está ON.
   * El gate se aplica en `getEnabledModulesFromDB()` vía
   * `filterModuleIdsByFeatureFlags`. Tipado como string para no acoplar el
   * registry (importado en cliente) al módulo server-only de feature flags.
   */
  requiresFeatureFlag?: string;
}

/**
 * REGISTRO MAESTRO DE MÓDULOS
 * Todos los módulos disponibles en CAPSULA ERP (Shanklish + TablePong unificado)
 */
export const MODULE_REGISTRY: ModuleDefinition[] = [
  // ═══════════════════════════════════════════
  // OPERACIONES
  // ═══════════════════════════════════════════
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Panel principal con métricas y resumen',
    icon: '📊',
    href: '/dashboard',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 0,
  },
  // Nota: el módulo 'estadisticas' fue absorbido por '/dashboard' (PR #87/#88).
  // La entrada del registry se eliminó para evitar redirect loop:
  // /dashboard/home → primer módulo visible (estadisticas) → /dashboard/estadisticas
  // → redirect a /dashboard → primer módulo visible (estadisticas) → loop.
  {
    id: 'inventory_daily',
    label: 'Inventario Físico',
    description: 'Conteo físico y control diario de existencias',
    icon: '📅',
    href: '/dashboard/inventario/diario',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 10,
  },
  {
    id: 'inventory',
    label: 'Inventario',
    description: 'Gestión completa de inventario y stock',
    icon: '📦',
    href: '/dashboard/inventario',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 20,
    subRoutes: ['/dashboard/inventario/entrada'],
  },
  {
    id: 'inventory_quick_count',
    label: 'Conteo Rápido',
    description: 'Tipear el conteo físico directo al sistema desde la hoja impresa. Una persona dicta, otra escribe. Tab/Enter avanza.',
    icon: '⌨️',
    href: '/dashboard/inventario/conteo-rapido',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 22,
    tags: ['inventario', 'conteo', 'rapido'],
  },
  {
    id: 'transfers',
    label: 'Transferencias',
    description: 'Requisiciones y transferencias entre áreas',
    icon: '🔄',
    href: '/dashboard/transferencias',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 40,
  },
  {
    id: 'delivery_notes',
    label: 'Notas de Entrega',
    description: 'Generador de notas de entrega entre negocios',
    icon: '📦',
    href: '/dashboard/prestamos',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 50,
  },
  {
    id: 'recipes',
    label: 'Recetas',
    description: 'Gestión de recetas y fichas técnicas',
    icon: '📋',
    href: '/dashboard/recetas',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 60,
  },
  {
    id: 'production',
    label: 'Producción',
    description: 'Órdenes de producción y transformación',
    icon: '🏭',
    href: '/dashboard/produccion',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 70,
  },
  {
    id: 'costs',
    label: 'Costos',
    description: 'Análisis de costos y márgenes',
    icon: '💰',
    href: '/dashboard/costos',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 80,
    subRoutes: ['/dashboard/costos/margen'],
  },
  {
    id: 'margen',
    label: 'Margen por Plato',
    description: 'Análisis de margen de contribución por plato: costo de receta vs precio de venta en tiempo real',
    icon: '📊',
    href: '/dashboard/costos/margen',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 82,
    tags: ['costos', 'margen', 'rentabilidad'],
  },
  {
    id: 'purchases',
    label: 'Compras',
    description: 'Órdenes de compra y proveedores',
    icon: '🛒',
    href: '/dashboard/compras',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 90,
  },
  {
    id: 'proteins',
    label: 'Proteínas',
    description: 'Desposte y procesamiento de proteínas',
    icon: '🥩',
    href: '/dashboard/proteinas',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 100,
    tags: ['food'],
  },
  {
    id: 'mesoneros',
    label: 'Mesoneros',
    description: 'Gestión de mesoneros del restaurante: CRUD de nombre, apellido y estado activo',
    icon: '🧑‍🍽️',
    href: '/dashboard/mesoneros',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 55,
  },
  {
    id: 'sku_studio',
    label: 'SKU Studio',
    description: 'Creación guiada de productos con familias y plantillas. Chips de tipo, unidad y rol operativo.',
    icon: '🎨',
    href: '/dashboard/sku-studio',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 106,
    tags: ['sku', 'familias', 'plantillas', 'inventario'],
  },
  {
    id: 'asistente',
    label: 'Asistente de Nomenclatura',
    description: 'Asistente guiado para crear insumos con nombres y unidades estandarizadas, y verificar recetas vinculadas al menú',
    icon: '🧙',
    href: '/dashboard/asistente',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 105,
    tags: ['sku', 'nomenclatura', 'recetas'],
  },
  {
    id: 'menu',
    label: 'Menú',
    description: 'Gestión del menú y productos de venta',
    icon: '🍽️',
    href: '/dashboard/menu',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 110,
    subRoutes: ['/dashboard/menu/modificadores'],
  },
  {
    id: 'modifiers',
    label: 'Modificadores',
    description: 'Grupos de modificadores y opciones',
    icon: '🔧',
    href: '/dashboard/menu/modificadores',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 115,
  },
  {
    id: 'promotions',
    label: 'Promociones',
    description: 'Happy hour y descuentos automáticos por día/horario',
    icon: '🏷️',
    href: '/dashboard/promociones',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 117,
  },
  {
    id: 'clientes',
    label: 'Clientes',
    description: 'Cartera de clientes: ficha, historial de compras y análisis',
    icon: '👤',
    href: '/dashboard/clientes',
    section: 'operations',
    enabledByDefault: true,
    sortOrder: 118,
  },

  // ═══════════════════════════════════════════
  // VENTAS / POS
  // ═══════════════════════════════════════════
  {
    id: 'pos_restaurant',
    label: 'POS Restaurante',
    description: 'Punto de venta para consumo en local',
    icon: '🥙',
    href: '/dashboard/pos/restaurante',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 200,
  },
  {
    id: 'pos_waiter',
    label: 'POS Mesero',
    description: 'Toma de pedidos por mesa sin acceso a cobro — solo para mesoneros',
    icon: '🧑‍🍳',
    href: '/dashboard/pos/mesero',
    section: 'sales',
    enabledByDefault: false,
    sortOrder: 205,
    tags: ['waiter', 'mesero', 'comandas'],
  },
  {
    id: 'pos_delivery',
    label: 'POS Delivery',
    description: 'Punto de venta para despacho a domicilio',
    icon: '🛵',
    href: '/dashboard/pos/delivery',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 210,
  },
  {
    id: 'pedidosya',
    label: 'PedidosYA',
    description: 'Integración con plataforma PedidosYA',
    icon: '🍔',
    href: '/dashboard/pos/pedidosya',
    section: 'sales',
    enabledByDefault: false,
    sortOrder: 220,
    tags: ['integration'],
  },
  {
    id: 'sales_entry',
    label: 'Cargar Ventas',
    description: 'Carga manual de ventas externas',
    icon: '💳',
    href: '/dashboard/ventas/cargar',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 230,
  },
  {
    id: 'sales_history',
    label: 'Historial Ventas',
    description: 'Historial completo de ventas y arqueo',
    icon: '📈',
    href: '/dashboard/sales',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 240,
  },
  {
    id: 'sold_items_report',
    label: 'Platos Vendidos',
    description: 'Reporte de unidades vendidas y modificadores por rango de fecha',
    icon: '🍽️',
    href: '/dashboard/sales/items',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 245,
  },
  {
    id: 'kitchen_display',
    label: 'Comandera Cocina',
    description: 'Pantalla de órdenes para cocina',
    icon: '👨‍🍳',
    href: '/kitchen',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 250,
  },
  {
    id: 'barra_display',
    label: 'Comandera Barra',
    description: 'Pantalla de bebidas pendientes para barra',
    icon: '🥤',
    href: '/kitchen/barra',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 251,
  },
  {
    id: 'pos_config',
    label: 'Configuración POS',
    description: 'Ajustes de impresión, comanda y factura',
    icon: '🖨️',
    href: '/dashboard/config/pos',
    section: 'sales',
    enabledByDefault: true,
    sortOrder: 260,
  },

  // ═══════════════════════════════════════════
  // JUEGOS (Table Pong específico — off por default)
  // ═══════════════════════════════════════════
  {
    id: 'games',
    label: 'Juegos',
    description: 'Gestión de estaciones de juego (billar, PS, etc.)',
    icon: '🎱',
    href: '/dashboard/games',
    section: 'games',
    enabledByDefault: false,
    sortOrder: 300,
    tags: ['entertainment'],
  },
  {
    id: 'reservations',
    label: 'Reservaciones',
    description: 'Sistema de reservas de mesas y juegos',
    icon: '📅',
    href: '/dashboard/reservations',
    section: 'games',
    enabledByDefault: false,
    sortOrder: 310,
    tags: ['entertainment'],
  },
  {
    id: 'wristbands',
    label: 'Pulseras',
    description: 'Planes de pulsera para juegos ilimitados',
    icon: '⌚',
    href: '/dashboard/wristbands',
    section: 'games',
    enabledByDefault: false,
    sortOrder: 320,
    tags: ['entertainment'],
  },
  {
    id: 'queue',
    label: 'Cola de Espera',
    description: 'Gestión de turnos y cola de espera',
    icon: '🎫',
    href: '/dashboard/queue',
    section: 'games',
    enabledByDefault: false,
    sortOrder: 330,
    tags: ['entertainment'],
  },

  // ═══════════════════════════════════════════
  // INTERCOMPANY (off por default, para multi-negocio)
  // ═══════════════════════════════════════════
  {
    id: 'intercompany',
    label: 'Intercompany',
    description: 'Liquidaciones y trazabilidad entre negocios',
    icon: '🔗',
    href: '/dashboard/intercompany',
    section: 'admin',
    enabledByDefault: false,
    sortOrder: 400,
    tags: ['multi-business'],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    description: 'Reportes exportables a Excel: inventario completo, variación semanal, movimientos, ventas y márgenes.',
    icon: '📑',
    href: '/dashboard/reportes',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 410,
    subRoutes: [
      '/dashboard/reportes/inventario-completo',
      '/dashboard/reportes/variacion-semanal',
      '/dashboard/reportes/movimientos',
      '/dashboard/reportes/ventas-costos',
    ],
    tags: ['reports', 'excel', 'exports'],
  },
  {
    id: 'delivery',
    label: 'Gestión de Deliverys',
    description: 'Centro de operaciones de delivery: tablero de órdenes por estado y sede, sedes, motorizados y agotados. Alimentado por el bot (n8n + IA). Módulo aislado de la contabilidad.',
    icon: '🛵',
    href: '/dashboard/delivery',
    section: 'admin',
    // enabledByDefault:true PERO gated por el flag deliveryOps (que arranca OFF
    // para todos). Resultado: visible por defecto SOLO si el OWNER prende el
    // flag. El flag es el gate maestro (controla módulo + API).
    enabledByDefault: true,
    sortOrder: 412,
    requiresFeatureFlag: 'deliveryOps',
    subRoutes: [
      '/dashboard/delivery/sedes',
      '/dashboard/delivery/motorizados',
      '/dashboard/delivery/agotados',
      '/dashboard/delivery/instrucciones',
      '/dashboard/delivery/clientes',
      '/dashboard/delivery/config',
    ],
    tags: ['delivery', 'pedidos', 'motorizados', 'bot'],
  },

  // ═══════════════════════════════════════════
  // ADMINISTRACIÓN
  // ═══════════════════════════════════════════
  {
    id: 'users',
    label: 'Usuarios',
    description: 'Gestión de usuarios del sistema',
    icon: '👥',
    href: '/dashboard/usuarios',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 500,
  },
  {
    id: 'modulos_usuario',
    label: 'Módulos por Usuario',
    description: 'Configura qué módulos puede ver cada usuario en su menú, de forma individual.',
    icon: '🧩',
    href: '/dashboard/config/modulos-usuario',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 503,
  },
  {
    id: 'roles_config',
    label: 'Roles y Permisos',
    description: 'Configuración de roles y permisos',
    icon: '⚙️',
    href: '/dashboard/config/roles',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 510,
  },
  {
    id: 'module_config',
    label: 'Módulos',
    description: 'Activar/desactivar módulos del sistema',
    icon: '🧩',
    href: '/dashboard/config/modules',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 520,
  },
  {
    id: 'branding_config',
    label: 'Identidad del Negocio',
    description: 'Logo, RIF, razón social y nombre para recibos y headers',
    icon: '🏷️',
    href: '/dashboard/config/branding',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 525,
  },
  {
    id: 'feature_flags',
    label: 'Feature Flags',
    description: 'Kill switch por tenant para features con riesgo. Solo OWNER.',
    icon: '🚩',
    href: '/dashboard/config/feature-flags',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 526,
  },
  {
    id: 'almacenes',
    label: 'Almacenes',
    description: 'Gestión de áreas de almacenamiento: crear, activar/desactivar y detectar duplicados.',
    icon: '🏭',
    href: '/dashboard/almacenes',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 528,
  },
  {
    id: 'tasa_cambio',
    label: 'Tasa de Cambio',
    description: 'Actualizar la tasa de cambio BCV diariamente',
    icon: '💱',
    href: '/dashboard/config/tasa-cambio',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 530,
  },
  {
    id: 'anuncios',
    label: 'Anuncios a Gerencia',
    description: 'Crea y gestiona comunicados internos que aparecen en la campana 🔔 para todos los usuarios.',
    icon: '📣',
    href: '/dashboard/anuncios',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 542,
  },
  {
    id: 'metas',
    label: 'Objetivos y Metas',
    description: 'Fijar metas de venta diaria, semanal y mensual. Control de % de merma aceptable con seguimiento en tiempo real.',
    icon: '🎯',
    href: '/dashboard/metas',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 540,
    tags: ['kpi', 'metas', 'objetivos'],
  },

  // ═══════════════════════════════════════════
  // ADMINISTRACIÓN FINANCIERA
  // ═══════════════════════════════════════════
  {
    id: 'finanzas',
    label: 'Dashboard Financiero',
    description: 'Estado de resultados (P&L), flujo de caja y análisis financiero mensual',
    icon: '📊',
    href: '/dashboard/finanzas',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 550,
    tags: ['finanzas', 'pl', 'resultados', 'caja'],
  },
  {
    id: 'gastos',
    label: 'Gastos',
    description: 'Registro y control de gastos operativos: alquiler, servicios, nómina, mantenimiento y más',
    icon: '💸',
    href: '/dashboard/gastos',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 560,
    tags: ['gastos', 'egresos', 'operativos'],
  },
  {
    id: 'caja',
    label: 'Control de Caja',
    description: 'Apertura y cierre de caja diaria con cuadre de efectivo y diferencias',
    icon: '🏧',
    href: '/dashboard/caja',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 570,
    tags: ['caja', 'cierre', 'efectivo', 'cuadre'],
  },
  {
    id: 'cuentas_pagar',
    label: 'Cuentas por Pagar',
    description: 'Control de facturas y deudas pendientes con proveedores y acreedores',
    icon: '📄',
    href: '/dashboard/cuentas-pagar',
    section: 'admin',
    enabledByDefault: true,
    sortOrder: 580,
    tags: ['cuentas', 'pagar', 'proveedores', 'deudas'],
  },
  {
    id: 'cuentas_bancarias',
    label: 'Cuentas Bancarias',
    description: 'Cuentas, cajas y terminales (PDV) — base de comisiones y conciliación bancaria',
    icon: '🏦',
    href: '/dashboard/cuentas-bancarias',
    section: 'admin',
    enabledByDefault: false,
    sortOrder: 585,
    tags: ['cuentas', 'bancos', 'tesorería', 'conciliación', 'terminales', 'pdv', 'comisiones'],
  },
  {
    id: 'conciliacion',
    label: 'Conciliación',
    description: 'Conciliación de cuentas: esperado del sistema vs estado de cuenta, con diferencial',
    icon: '⚖️',
    href: '/dashboard/conciliacion',
    section: 'admin',
    enabledByDefault: false,
    sortOrder: 587,
    tags: ['conciliación', 'bancos', 'tesorería', 'diferencial', 'estado de cuenta'],
  },
  {
    id: 'cuentas_cobrar',
    label: 'Cuentas por Cobrar',
    description: 'Lo que terceros le deben al negocio ("nos deben"): deudas a favor y sus cobros',
    icon: '🤝',
    href: '/dashboard/cuentas-cobrar',
    section: 'admin',
    enabledByDefault: false,
    sortOrder: 583,
    tags: ['cuentas', 'cobrar', 'nos deben', 'deudores', 'por cobrar'],
  },
];

/**
 * Mapa de módulo → roles que pueden acceder
 * Esto trabaja EN CONJUNTO con los modules habilitados:
 *   1. El módulo debe estar HABILITADO en la instancia
 *   2. El usuario debe tener el ROL correcto
 */
export const MODULE_ROLE_ACCESS: Record<string, string[]> = {
  dashboard: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER', 'CHEF', 'AREA_LEAD'],
  // 'estadisticas' eliminado: absorbido por '/dashboard' en PR #87/#88. La
  // página redirect a /dashboard, dejarlo en este map causaba redirect loop
  // para CASHIER/WAITER (su primer módulo visible era estadisticas).
  inventory_daily: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
  inventory: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
  inventory_count: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'],
  inventory_quick_count: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD', 'AUDITOR'],
  audits: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
  transfers: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
  inventory_history: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  loans: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  recipes: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF'],
  production: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
  costs: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  margen: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  purchases: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
  proteins: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
  sku_studio: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF'],
  asistente: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF'],
  menu: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  modifiers: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  promotions: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  clientes: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER', 'CHEF'],
  pos_restaurant: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD', 'CASHIER'],
  pos_waiter: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'WAITER', 'CASHIER', 'AREA_LEAD'],
  pos_delivery: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'],
  pedidosya: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'],
  sales_entry: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'],
  sales_history: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'CHEF', 'CASHIER'],
  sold_items_report: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'CHEF'],
  kitchen_display: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'KITCHEN_CHEF'],
  barra_display: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'KITCHEN_CHEF', 'AREA_LEAD', 'CASHIER'],
  pos_config: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD', 'CASHIER'],
  // Juegos (Table Pong)
  games: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  reservations: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'],
  wristbands: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  queue: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'],
  // Intercompany
  intercompany: ['OWNER', 'ADMIN_MANAGER', 'AUDITOR'],
  // Reportes (§51.C)
  reportes: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'],
  // Gestión de Deliverys (módulo aislado, gated por flag deliveryOps)
  delivery: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'],
  // Admin
  mesoneros: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER'],
  users: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER', 'AUDITOR'],
  modulos_usuario: ['OWNER', 'ADMIN_MANAGER'],
  roles_config: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  module_config: ['OWNER'], // Solo el OWNER puede activar/desactivar módulos
  feature_flags: ['OWNER'], // Solo el OWNER puede prender/apagar features con riesgo
  almacenes: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  tasa_cambio: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER'],
  anuncios: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
  metas: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD', 'AUDITOR'],
  // Módulo Financiero
  finanzas:      ['OWNER', 'ADMIN_MANAGER', 'AUDITOR'],
  gastos:        ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'],
  caja:          ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER', 'AUDITOR'],
  cuentas_pagar: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'],
  cuentas_bancarias: ['OWNER', 'ADMIN_MANAGER'],
  conciliacion: ['OWNER', 'ADMIN_MANAGER'],
  cuentas_cobrar: ['OWNER', 'ADMIN_MANAGER'],
};

/**
 * Filtra una lista de module ids dejando fuera los que requieren un feature
 * flag de tenant que está apagado. Función pura (testeable sin BD).
 *
 * @param ids          - module ids candidatos (ya filtrados por instalación)
 * @param enabledFlags - mapa flagKey → boolean del tenant actual
 */
export function filterModuleIdsByFeatureFlags(
  ids: string[],
  enabledFlags: Record<string, boolean>,
): string[] {
  const gated = new Map<string, string>(); // moduleId → flag requerido
  for (const m of MODULE_REGISTRY) {
    if (m.requiresFeatureFlag) gated.set(m.id, m.requiresFeatureFlag);
  }
  return ids.filter(id => {
    const flag = gated.get(id);
    if (!flag) return true; // módulo sin gate → siempre pasa
    return enabledFlags[flag] === true;
  });
}

/**
 * Obtener la lista de módulos habilitados para esta instancia.
 * NOTA: Esta función lee de env var (solo para fallback en cliente).
 * En producción, usa getEnabledModulesFromDB() desde un Server Component.
 */
export function getEnabledModuleIds(): string[] {
  const envModules = process.env.NEXT_PUBLIC_ENABLED_MODULES;

  if (envModules) {
    return envModules.split(',').map(m => m.trim()).filter(Boolean);
  }

  return MODULE_REGISTRY
    .filter(m => m.enabledByDefault)
    .map(m => m.id);
}

/**
 * Obtener módulos filtrados por:
 *  1. Si están habilitados a nivel de instalación (enabledIds explícito o env var)
 *  2. Si el usuario tiene el rol correcto
 *  3. Si el usuario tiene acceso individual (userAllowedModules — null/undefined = sin restricción extra)
 *
 * @param userRole           - Rol del usuario autenticado
 * @param enabledIds         - IDs habilitados en la instalación (desde la BD, vía DashboardLayout)
 * @param userAllowedModules - IDs permitidos para este usuario específico (null = sin restricción extra)
 */
export function getVisibleModules(
  userRole: string,
  enabledIds?: string[],
  userAllowedModules?: string[] | null,
): ModuleDefinition[] {
  const ids = enabledIds ?? getEnabledModuleIds();

  const visibleIds = new Set(ids);
  // module_config siempre visible para OWNER
  if (userRole === 'OWNER') {
    visibleIds.add('module_config');
  }

  // Si el usuario tiene permisos individuales, intersectar
  const userFilter = userAllowedModules ? new Set(userAllowedModules) : null;

  return MODULE_REGISTRY
    .filter(m => visibleIds.has(m.id))
    .filter(m => {
      // module_config solo visible para OWNER, sin importar allowedModules
      if (m.id === 'module_config') return userRole === 'OWNER';
      // Si el usuario tiene allowedModules individuales, esa lista es la única autoridad
      if (userFilter) return userFilter.has(m.id);
      // Sin allowedModules → acceso por rol
      const allowedRoles = MODULE_ROLE_ACCESS[m.id];
      if (!allowedRoles) return true;
      return allowedRoles.includes(userRole);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Agrupar módulos visibles por sección del sidebar.
 *
 * @param userRole           - Rol del usuario
 * @param enabledIds         - IDs habilitados desde la BD (pasados desde DashboardLayout)
 * @param userAllowedModules - IDs permitidos para este usuario (null = sin restricción extra)
 */
export function getModulesBySection(
  userRole: string,
  enabledIds?: string[],
  userAllowedModules?: string[] | null,
) {
  const modules = getVisibleModules(userRole, enabledIds, userAllowedModules);

  return {
    operations: modules.filter(m => m.section === 'operations'),
    sales:      modules.filter(m => m.section === 'sales'),
    games:      modules.filter(m => m.section === 'games'),
    admin:      modules.filter(m => m.section === 'admin'),
  };
}
