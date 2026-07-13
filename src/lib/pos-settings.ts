/**
 * Configuración POS - almacenada en localStorage (por estación de trabajo).
 * Permite activar/desactivar impresión de comanda y factura en cada módulo.
 */

const STORAGE_KEY = 'shanklish_pos_config';

export interface POSConfig {
  /** Imprimir comanda cocina al confirmar Delivery */
  printComandaOnDelivery: boolean;
  /** Imprimir factura automáticamente al confirmar Delivery */
  printReceiptOnDelivery: boolean;
  /** Imprimir comanda cocina al enviar a mesa (Restaurante) */
  printComandaOnRestaurant: boolean;
  /** Imprimir factura al cerrar cuenta (Restaurante) */
  printReceiptOnRestaurant: boolean;
  /**
   * §111: enrutar el recibo/pre-cuenta por el Print Agent (impresora
   * térmica de red) en vez de la ventana del navegador. Silencioso, sin
   * diálogo de impresión. Requiere que `receiptStation` exista en el
   * PRINTERS_JSON del agente. Default false = comportamiento navegador
   * de siempre (no rompe setups sin agente de caja).
   */
  printReceiptViaAgent: boolean;
  /** §111: nombre de la estación de la impresora de caja en PRINTERS_JSON. */
  receiptStation: string;
  /**
   * Validar stock de ingredientes antes de confirmar una orden.
   * Si está activo y faltan insumos, la orden se bloquea.
   * Desactivado por defecto hasta completar la carga de recetas.
   */
  stockValidationEnabled: boolean;
}

const DEFAULTS: POSConfig = {
  printComandaOnDelivery: false,
  printReceiptOnDelivery: true,
  printComandaOnRestaurant: true,
  printReceiptOnRestaurant: true,
  printReceiptViaAgent: false,
  receiptStation: 'caja',
  stockValidationEnabled: false,
};

export function getPOSConfig(): POSConfig {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<POSConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function setPOSConfig(updates: Partial<POSConfig>): POSConfig {
  const current = getPOSConfig();
  const next = { ...current, ...updates };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
