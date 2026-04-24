'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  HelpCircle,
  X,
  ClipboardList,
  Ruler,
  Lightbulb,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// GUÍAS POR MÓDULO
// ============================================================================

interface ModuleGuide {
  title: string;
  description: string;
  steps: string[];
  tips: string[];
  standards?: { label: string; example: string }[];
}

const HELP_GUIDES: Record<string, ModuleGuide> = {
  '/dashboard/pos/restaurante': {
    title: 'POS Restaurante',
    description: 'Punto de venta para consumo en el local. El cajero gestiona mesas, órdenes y cobros.',
    steps: [
      'Selecciona la zona (Sala Principal / Bar)',
      'Haz clic en la mesa del cliente',
      'Pulsa "Abrir cuenta" e ingresa nombre + teléfono',
      'Agrega los productos desde el menú central',
      'Presiona "Enviar a cocina" — la comanda va automáticamente',
      'Cuando el cliente pida la cuenta, selecciona el método de pago y presiona "Cobrar"',
      'Los descuentos requieren PIN del gerente — quedan registrados',
    ],
    tips: [
      'Mesa verde con punto = cuenta abierta activa',
      'Puedes agregar más productos a una cuenta ya abierta',
      'El 10% de servicio se aplica automáticamente a Sala (desactivable)',
      'Venta Directa / Pickup = para llevar sin asignar mesa',
      'Si la comanda no imprime, revisa Configuración POS',
    ],
    standards: [
      { label: 'Nombre cliente', example: '"Omar Ramírez" — nombre completo, no apodos' },
      { label: 'Teléfono', example: '"0412-1234567" — con prefijo, obligatorio' },
    ],
  },
  '/dashboard/pos/delivery': {
    title: 'POS Delivery',
    description: 'Para órdenes a domicilio. Registra datos del cliente y envía a cocina.',
    steps: [
      'Ingresa nombre, teléfono y dirección exacta del cliente',
      'Agrega los productos igual que en restaurante',
      'Selecciona el método de pago del cliente',
      'Presiona "Confirmar orden" — se envía a cocina automáticamente',
      'El botón WhatsApp abre el parser para importar pedidos directamente del chat',
    ],
    tips: [
      'El precio de delivery cambia si aplicas descuento Divisas (-33%)',
      'La dirección aparece en la comanda de cocina',
      'El parser de WhatsApp lee el formato de pedidos y carga el carrito automáticamente',
    ],
    standards: [
      { label: 'Dirección', example: '"Av. Principal, Edif. Torre Norte, Piso 3, Apto 3A, Chacao"' },
      { label: 'Nombre cliente', example: '"María González" — igual que en restaurante' },
    ],
  },
  '/dashboard/pos/mesero': {
    title: 'POS Mesero',
    description: 'Vista exclusiva para mesoneros. Solo toma de pedidos — el cajero gestiona el cobro.',
    steps: [
      'Selecciona la zona y la mesa asignada',
      'Si la mesa no tiene cuenta, abre una con datos del cliente',
      'Agrega los productos del pedido',
      'Presiona "Enviar a cocina" — la comanda va inmediatamente',
      'Puedes ver el estado de los pedidos enviados (En cocina / Listo)',
      'Para anular un ítem ya enviado necesitas justificación + PIN del supervisor',
    ],
    tips: [
      'El total es solo informativo — no puedes cobrar desde esta vista',
      'Puedes agregar más productos a la misma mesa en cualquier momento',
      'Verde = modo mesero activo',
    ],
  },
  '/dashboard/inventario': {
    title: 'Inventario',
    description: 'Gestión completa de materias primas, sub-recetas y productos terminados.',
    steps: [
      'Crea cada ingrediente como un ítem de inventario (Materia Prima)',
      'Define la unidad de medida base correcta (ver estándares abajo)',
      'Establece stock mínimo y punto de reorden para alertas automáticas',
      'Usa "Entrada" para registrar compras recibidas',
      'El inventario se descuenta automáticamente al vender (si tiene receta vinculada)',
    ],
    tips: [
      'Las unidades deben ser consistentes en TODO el sistema',
      'Un ítem puede tener receta si se produce internamente',
      'Los ítems con receta vinculada se descuentan por ingrediente, no por producto',
      'El costo por unidad afecta el análisis de márgenes',
    ],
    standards: [
      { label: 'Carnes/Proteínas', example: 'Unidad: KG · SKU: CARN-001 · Ej: "Pollo Pechuga Fresco"' },
      { label: 'Lácteos', example: 'Unidad: KG o LT · SKU: LACT-001 · Ej: "Queso Blanco Duro"' },
      { label: 'Bebidas (botellas)', example: 'Unidad: BOTELLA o ML · SKU: BEB-001 · Ej: "Ron Añejo 750ml"' },
      { label: 'Bebidas (cócteles)', example: 'Unidad: ML · el consumo se resta por ML al vender' },
      { label: 'Especias/Secos', example: 'Unidad: GR · SKU: SPEC-001 · Ej: "Comino Molido"' },
      { label: 'Pan/Masas', example: 'Unidad: UNIDAD o KG · SKU: PAN-001 · Ej: "Pan de Pita 22cm"' },
      { label: 'Frutas/Vegetales', example: 'Unidad: KG · SKU: VEG-001 · Ej: "Tomate Plum"' },
    ],
  },
  '/dashboard/inventario/diario': {
    title: 'Inventario Diario',
    description: 'Registro del inventario al inicio y cierre de cada día.',
    steps: [
      'Al abrir el local: registra el conteo inicial de cada área',
      'Al cerrar: registra el conteo final',
      'El sistema calcula automáticamente las diferencias vs las ventas',
      'Si hay diferencia significativa, genera una alerta de auditoría',
    ],
    tips: [
      'Hazlo a la misma hora todos los días para consistencia',
      'Separa por área: cocina, bar, depósito',
      'Una diferencia de ±2% es normal por mermas',
    ],
  },
  '/dashboard/recetas': {
    title: 'Recetas',
    description: 'Define la composición de cada plato o bebida para el control de costos e inventario.',
    steps: [
      'Crea la receta con el nombre EXACTO del producto del menú',
      'Vincula el ítem de inventario de salida (ej: "Plato Shanklish Tradicional")',
      'Agrega cada ingrediente con su cantidad y unidad',
      'Incluye el porcentaje de desperdicio de cada ingrediente',
      'Activa la receta — solo recetas activas se descuentan al vender',
      'Vincula el ítem de menú con el ítem de inventario en la configuración de menú',
    ],
    tips: [
      'La receta de un cóctel debe usar ML de cada licor, no botellas',
      'Para platos con variaciones, crea una receta por variación',
      'El costo de la receta se calcula automáticamente según precios de compra',
      'Si un ingrediente no tiene stock registrado, la venta igual ocurre (sin bloqueo)',
    ],
    standards: [
      { label: 'Bebidas alcohólicas', example: 'Ron: 60ml, Jugo limón: 30ml, Azúcar: 15gr, Hielo: 100gr' },
      { label: 'Platos principales', example: 'Proteína: en KG (ej: 0.25kg), Guarnición: en GR o UNIDAD' },
      { label: 'Nombre receta', example: 'Debe coincidir EXACTO con el nombre en el Menú del POS' },
    ],
  },
  '/dashboard/produccion': {
    title: 'Producción',
    description: 'Registro de producciones internas: salsas, masas, sub-recetas y preparaciones.',
    steps: [
      'Selecciona la receta a producir',
      'Ingresa la cantidad a producir',
      'El sistema verifica si hay stock suficiente de ingredientes',
      'Confirma — los ingredientes se descuentan y el producto se agrega al inventario',
      'Registra la producción real vs planificada para control de rendimiento',
    ],
    tips: [
      'Usa producción para preparar bases: salsas, marinados, mezclas',
      'El rendimiento real vs teórico te dice cuánto se pierde en el proceso',
      'Programa producciones en la mañana antes de abrir',
    ],
  },
  '/dashboard/ventas/cargar': {
    title: 'Cargar Ventas',
    description: 'Registro manual de ventas externas (PedidosYA, eventos, etc.)',
    steps: [
      'Ingresa la fecha de la venta',
      'Selecciona el tipo (delivery externo, evento, etc.)',
      'Carga los items y montos',
      'Estas ventas se suman al historial pero NO descuentan inventario automáticamente',
    ],
    tips: [
      'Solo usa este módulo para ventas que no pasan por el POS',
      'Para PedidosYA activa el módulo específico en Admin → Módulos',
    ],
  },
  '/dashboard/sales': {
    title: 'Historial de Ventas',
    description: 'Registro completo de todas las ventas. Base para el arqueo y auditoría.',
    steps: [
      'Filtra por fecha para ver el día que necesitas',
      'Expande cada orden para ver los items detallados',
      'Usa "Exportar Arqueo" para descargar el cierre del día en Excel',
      'El botón "Reporte Z" genera el resumen por método de pago',
      'Para anular una orden necesitas PIN de gerente + justificación',
    ],
    tips: [
      'Las anulaciones quedan registradas permanentemente — no se pueden eliminar del historial',
      'El arqueo en Excel es el documento oficial para contabilidad',
      'Los descuentos aplicados aparecen con el nombre del gerente que los autorizó',
    ],
  },
  '/dashboard/estadisticas': {
    title: 'Estadísticas',
    description: 'Panel de análisis en tiempo real. La información que ves depende de tu rol.',
    steps: [
      'DUEÑO/GERENTE: Ve revenue, métodos de pago, top productos, descuentos del día',
      'CHEF: Ve pedidos en cocina, producciones del día, ingredientes bajos',
      'CAJERO: Ve resumen de tu turno actual',
      'AUDITOR: Ve descuentos, anulaciones y variaciones de inventario',
    ],
    tips: [
      'Los datos son del momento actual — recarga la página para actualizar',
      'Las alertas de stock indican ítems por debajo del mínimo configurado',
      'Para ver datos históricos usa Historial de Ventas o Historial Mensual',
    ],
  },
};

const DEFAULT_GUIDE: ModuleGuide = {
  title: 'CÁPSULA ERP',
  description: 'Sistema de gestión para restaurantes y locales tipo Sport Bar.',
  steps: [
    'Navega por los módulos del sidebar según tu rol',
    'Los módulos disponibles dependen de los permisos de tu usuario',
    'Para activar módulos adicionales ve a Admin → Módulos (solo OWNER)',
    'Cada módulo tiene su propia guía de uso — abre el panel de ayuda en ese módulo',
  ],
  tips: [
    'El POS Restaurante y Delivery son los módulos principales de operación diaria',
    'Las recetas deben cargarse antes de que el inventario se descuente automáticamente',
    'Las Estadísticas muestran datos en tiempo real personalizados por rol',
  ],
  standards: [
    { label: 'SKU productos', example: 'CARN-001, BEB-001, LACT-001 (categoría + número secuencial)' },
    { label: 'Nombres de productos', example: 'Usar nombre completo y descriptivo, sin abreviaciones' },
    { label: 'Unidades de medida', example: 'KG, GR, LT, ML, UNIDAD, BOTELLA (siempre en mayúsculas)' },
  ],
};

function getGuide(pathname: string): ModuleGuide {
  if (HELP_GUIDES[pathname]) return HELP_GUIDES[pathname];
  const match = Object.keys(HELP_GUIDES)
    .filter((key) => pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match ? HELP_GUIDES[match] : DEFAULT_GUIDE;
}

// ============================================================================
// COMPONENTE
// ============================================================================

export function HelpPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'guide' | 'standards'>('guide');
  const pathname = usePathname();
  const guide = getGuide(pathname);

  return (
    <>
      {/* Botón ayuda */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-capsula-ivory-alt text-capsula-ink-muted transition-colors hover:bg-capsula-navy-soft hover:text-capsula-ink"
        title="Ayuda y guía del módulo"
        aria-label="Abrir guía de ayuda"
      >
        <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-capsula-navy-deep/55 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-capsula-line bg-capsula-ivory-surface shadow-cap-raised animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-capsula-line bg-capsula-ivory-alt px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-capsula-navy-soft text-capsula-ink">
                  <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="font-semibold text-base tracking-[-0.01em] text-capsula-ink">{guide.title}</h2>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-capsula-ink-muted">Guía de uso</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-capsula-ink-muted transition-colors hover:bg-capsula-ivory hover:text-capsula-ink"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Tabs */}
            {guide.standards && guide.standards.length > 0 && (
              <div className="flex border-b border-capsula-line">
                <button
                  onClick={() => setActiveTab('guide')}
                  className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
                    activeTab === 'guide'
                      ? 'border-b-2 border-capsula-navy bg-capsula-navy-soft text-capsula-ink'
                      : 'text-capsula-ink-muted hover:text-capsula-ink'
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Guía de uso
                </button>
                <button
                  onClick={() => setActiveTab('standards')}
                  className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
                    activeTab === 'standards'
                      ? 'border-b-2 border-capsula-navy bg-capsula-navy-soft text-capsula-ink'
                      : 'text-capsula-ink-muted hover:text-capsula-ink'
                  }`}
                >
                  <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Estándares
                </button>
              </div>
            )}

            {/* Contenido */}
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {activeTab === 'guide' ? (
                <>
                  {/* Descripción */}
                  <div className="rounded-2xl border border-capsula-line bg-capsula-ivory-alt p-4">
                    <p className="text-sm font-medium leading-relaxed text-capsula-ink-soft">{guide.description}</p>
                  </div>

                  {/* Pasos */}
                  <div>
                    <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                      Pasos del proceso
                    </h3>
                    <div className="space-y-2">
                      {guide.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-capsula-navy-soft text-xs font-semibold text-capsula-ink">
                            {i + 1}
                          </div>
                          <p className="text-sm font-medium leading-snug text-capsula-ink-soft">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tips */}
                  <div>
                    <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted">
                      <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Recomendaciones
                    </h3>
                    <div className="space-y-2">
                      {guide.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-2xl border border-capsula-line bg-capsula-ivory-alt p-3">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-capsula-coral" strokeWidth={2} />
                          <p className="text-xs font-medium leading-snug text-capsula-ink-soft">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Estándares de nomenclatura */
                <div>
                  <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.75} />
                    <p className="text-xs font-medium text-amber-700">
                      Los estándares son críticos para que el inventario se descuente correctamente.
                      Un nombre inconsistente rompe la conexión receta → venta → inventario.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {guide.standards!.map((s, i) => (
                      <div key={i} className="rounded-2xl border border-capsula-line bg-capsula-ivory-alt p-4">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink">{s.label}</div>
                        <div className="rounded-lg bg-capsula-ivory px-3 py-2 font-mono text-xs text-capsula-ink-soft">
                          {s.example}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-capsula-line bg-capsula-ivory-alt px-4 py-3">
              <p className="text-center text-[9px] font-medium uppercase tracking-[0.18em] text-capsula-ink-muted">
                CÁPSULA · {guide.title}
              </p>
              <p className="mt-0.5 text-center text-[9px] text-capsula-ink-faint">
                Para soporte contacta al administrador del sistema
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
