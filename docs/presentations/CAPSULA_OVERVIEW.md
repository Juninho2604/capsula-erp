---
title: "CÁPSULA — ERP Operativo para Restaurantes"
subtitle: "Resumen del producto · Mayo 2026"
author: "Capsula ERP"
date: "Mayo 2026"
---

<style>
  body {
    font-family: 'Inter', 'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #0F1A2A;
    line-height: 1.55;
  }
  .cover {
    page-break-after: always;
    padding: 40px 0;
    background: linear-gradient(145deg, #FF6B4A 0%, #E85A3A 38%, #2A4060 72%, #1B2D45 100%);
    color: #F7F5F0;
    border-radius: 24px;
    text-align: center;
    margin: -20px -20px 30px -20px;
    padding: 60px 40px;
  }
  .cover h1 {
    color: #F7F5F0;
    font-size: 64px;
    margin: 0;
    letter-spacing: -0.04em;
    font-weight: 700;
  }
  .cover .tag {
    color: rgba(247,245,240,0.7);
    font-size: 18px;
    margin-top: 16px;
    font-weight: 500;
  }
  .cover .meta {
    margin-top: 60px;
    font-size: 13px;
    color: rgba(247,245,240,0.55);
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }
  h1 { color: #1B2A3A; border-bottom: 3px solid #F25C3B; padding-bottom: 12px; margin-top: 56px; font-weight: 700; }
  h2 { color: #1B2A3A; margin-top: 36px; font-weight: 600; letter-spacing: -0.01em; }
  h3 { color: #253D5C; font-weight: 600; }
  blockquote {
    border-left: 4px solid #F25C3B;
    background: #FFF5F0;
    margin: 16px 0;
    padding: 14px 22px;
    border-radius: 0 12px 12px 0;
    color: #2A4060;
    font-style: normal;
  }
  .pill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: #1B2A3A;
    color: #F7F5F0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    margin-right: 6px;
  }
  .pill.coral { background: #F25C3B; }
  .pill.muted { background: #E8EDF2; color: #4A5568; }
  table { font-size: 13px; }
  table th { background: #F7F5F0; color: #2A4060; text-align: left; }
  code { background: #F7F5F0; padding: 1px 6px; border-radius: 4px; color: #B04A2E; font-size: 90%; }
  hr { border: none; border-top: 1px solid #E8EDF2; margin: 30px 0; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .module-card {
    border: 1px solid #E8EDF2;
    border-radius: 12px;
    padding: 14px;
    background: #FFF;
    page-break-inside: avoid;
  }
  .module-card h4 {
    margin: 0 0 6px 0;
    color: #1B2A3A;
    font-size: 14px;
    font-weight: 700;
  }
  .module-card .desc { color: #4A5568; font-size: 12px; margin: 0; }
  .stat {
    display: inline-block;
    text-align: center;
    margin: 0 12px 12px 0;
    min-width: 110px;
    padding: 14px;
    border: 1px solid #E8EDF2;
    border-radius: 12px;
    background: #FFF;
    page-break-inside: avoid;
  }
  .stat .num {
    font-size: 32px;
    font-weight: 700;
    color: #1B2A3A;
    letter-spacing: -0.02em;
    display: block;
  }
  .stat .lbl {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #6B7280;
    font-weight: 600;
    margin-top: 4px;
    display: block;
  }
</style>

<div class="cover">
  <h1>CÁPSULA</h1>
  <div class="tag">El ERP operativo para tu restaurante</div>
  <div class="meta">Resumen del producto · Mayo 2026</div>
</div>

# ¿Qué es Cápsula?

**Cápsula** es un sistema de gestión integral diseñado específicamente para restaurantes. Reemplaza el ecosistema de hojas de cálculo, sistemas POS legacy y herramientas desconectadas con una sola aplicación web que cubre desde la mesa hasta el balance financiero.

Construido con stack moderno (Next.js 14 + TypeScript + PostgreSQL 18 + Prisma) y desplegado sobre Vercel, Cápsula corre en cualquier dispositivo táctil — tablets, teléfonos, computadores de cajera — sin instalación.

> **Diseñado en Caracas. Probado en Shanklish.** Cada flujo del producto está alineado con la operación real: cobros mixtos en USD/Bs/EUR, descuentos en divisas, propinas, mesas con subcuentas, comandas térmicas para cocina.

---

# El producto en números

<div>
  <div class="stat"><span class="num">31</span><span class="lbl">Módulos</span></div>
  <div class="stat"><span class="num">4</span><span class="lbl">POS variants</span></div>
  <div class="stat"><span class="num">69</span><span class="lbl">Modelos BD</span></div>
  <div class="stat"><span class="num">44</span><span class="lbl">Server actions</span></div>
  <div class="stat"><span class="num">62</span><span class="lbl">Tests verdes</span></div>
  <div class="stat"><span class="num">30</span><span class="lbl">Migraciones</span></div>
</div>

---

# Punto de Venta (POS) — 4 variantes

Cápsula reconoce que un restaurante tiene **flujos de venta distintos** según el canal. En lugar de forzar un único POS para todo, cada canal tiene su propia interfaz optimizada:

<div class="grid-2">
  <div class="module-card">
    <h4>POS Restaurante (Cajera)</h4>
    <p class="desc">Vista completa con mesas, subcuentas, cobranza mixta, descuentos de divisas, cortesía, propina colectiva y reimpresión. Layout táctil de 3 columnas para gerentes.</p>
  </div>
  <div class="module-card">
    <h4>POS Mesero</h4>
    <p class="desc">UI mobile-first para tablets. Toma de órdenes, comandas a cocina, cobranza dividida en subcuentas, pre-cuentas para cajera (capitanes y gerentes).</p>
  </div>
  <div class="module-card">
    <h4>POS Delivery</h4>
    <p class="desc">Pickup + delivery con captura de cliente, tarifa de envío, descuento divisas opcional, integración WhatsApp para pedidos vía parser.</p>
  </div>
  <div class="module-card">
    <h4>POS PedidosYA</h4>
    <p class="desc">Conciliación de órdenes externas de PedidosYA con su propio flujo de cobro y reportes separados.</p>
  </div>
</div>

## Capacidades destacadas del POS

- **Subcuentas (split bills)** con asignación granular de items, recibos individuales por subcuenta, y anulación con autorización de gerente vía PIN.
- **Pago mixto** combinando hasta 5 métodos (Cash USD/EUR/Bs, Zelle, PDV, Pago Móvil, Transferencia, Cortesía).
- **Descuento divisas 33%** automático cuando el cliente paga en cash USD/EUR o Zelle.
- **Servicio 10%** opcional o forzado según `serviceType` de la mesa.
- **Propina** con porcentajes preset (10/15/20%) o monto custom; queda incluida en el total y se reporta separadamente para arqueo.
- **Cortesía** (100% o porcentaje) con autorización de manager y trazabilidad.
- **Comandas a cocina** vía impresoras térmicas (printer-thermal) con anulación automática si el cliente cambia el item.
- **Transferencia de mesa** entre meseros con doble PIN para auditoría.
- **Modificadores** por item con validación de grupos requeridos antes de agregar al carrito.

---

# Inventario y Recetas

El motor de **inventario** es el corazón operativo de Cápsula. Conecta cada venta al stock real, automáticamente.

<div class="grid-2">
  <div class="module-card">
    <h4>Catálogo de SKUs</h4>
    <p class="desc">Items con SKU, categoría, unidad base, conversiones, ubicaciones (áreas), stock mínimo y punto de reorden. SKU Studio para creación masiva con plantillas.</p>
  </div>
  <div class="module-card">
    <h4>Recetas estructuradas</h4>
    <p class="desc">MenuItem ↔ Recipe con ingredients (qty + unit). Al vender un MenuItem, el sistema descuenta automáticamente las cantidades de la receta del inventario del área asignada.</p>
  </div>
  <div class="module-card">
    <h4>Movimientos atómicos</h4>
    <p class="desc">Cada venta crea InventoryMovement (SALE, ADJUSTMENT, etc.) en una sola transacción Prisma. Si algo falla, rollback completo — no hay stock inconsistente.</p>
  </div>
  <div class="module-card">
    <h4>Outbox de reintentos</h4>
    <p class="desc">Si el descargo falla por concurrencia o error transitorio, queda en cola (InventoryDeductionRetry). Un cron cada 5 min reintenta con backoff exponencial (15min → 1h → 4h → 24h).</p>
  </div>
  <div class="module-card">
    <h4>Auditorías cíclicas</h4>
    <p class="desc">InventoryAudit con conteos físicos, ajustes con razón, y reporte de discrepancias. Mantiene la salud del stock real vs. teórico.</p>
  </div>
  <div class="module-card">
    <h4>Inventario diario</h4>
    <p class="desc">DailyInventory con plantilla por bar/cocina/proteína. Cierre rápido de turno con vista crítica de items bajo stock.</p>
  </div>
</div>

---

# Compras y Proveedores

<div class="grid-2">
  <div class="module-card">
    <h4>Órdenes de compra</h4>
    <p class="desc">Auto-generación basada en items bajo stock, creación manual, y parser inteligente desde mensajes de WhatsApp del proveedor.</p>
  </div>
  <div class="module-card">
    <h4>Recepción de mercancía</h4>
    <p class="desc">Confirmación cantidad recibida + costo unitario actualizado. Stock automáticamente incrementado con InventoryMovement de tipo PURCHASE.</p>
  </div>
  <div class="module-card">
    <h4>Histórico de precios por proveedor</h4>
    <p class="desc">Cada vez que se recibe una OC con precio diferente, se inserta una fila en SupplierItemPriceHistory (cierre del registro vigente + alta del nuevo). Permite ver gráficos de evolución y detectar alzas.</p>
  </div>
  <div class="module-card">
    <h4>Cuentas por pagar</h4>
    <p class="desc">Tracking de AccountsPayable con aging buckets (0-30, 31-60, 61-90, 90+ días vencidos), pagos parciales y reporte de overdue.</p>
  </div>
</div>

---

# Cocina y Producción

- **Producción**: ProductionOrder con plantillas (ProcessingTemplate) que definen inputs → outputs (ej: 1 kg de queso → 8 porciones). Mantiene trazabilidad de procesamiento de proteínas y subproductos.
- **Proteínas**: módulo dedicado para procesamiento de carne/proteína con yield ratios y reportes de mermas.
- **Display de cocina**: API `/api/kitchen/orders` para integración con pantallas de cocina externas.

---

# Finanzas

<div class="module-card" style="margin: 16px 0;">
  <h4>Dashboard financiero — Mensual y Diario</h4>
  <p class="desc">Toggle Mensual / Diario para zoom rápido. Cards de P&L con comparativa MOM/DOD: Ventas, Ticket promedio, Gastos, Utilidad operativa. Charts de ventas por día/hora, distribución por tipo y método de pago. Cash flow neto.</p>
</div>

<div class="grid-2">
  <div class="module-card">
    <h4>Estado de Resultados</h4>
    <p class="desc">P&L automático con margen bruto y operativo. Exportable a Excel con formato profesional (ExcelJS).</p>
  </div>
  <div class="module-card">
    <h4>Reportes Z y arqueo</h4>
    <p class="desc">Reporte Z diario con cierre por método de pago, propinas colectivas, descuentos por tipo. Excel del arqueo de caja descargable desde el historial de ventas.</p>
  </div>
  <div class="module-card">
    <h4>Tendencia 6 meses</h4>
    <p class="desc">BarChart de ventas, COGS, gastos y utilidad operativa de los últimos 6 meses. Visualiza estacionalidad y crecimiento.</p>
  </div>
  <div class="module-card">
    <h4>Gastos por categoría</h4>
    <p class="desc">PieChart con top categorías + tabla de top 5 gastos del período. Categorías custom + colores configurables.</p>
  </div>
</div>

---

# Caja, Ventas y Auditoría

- **Apertura/cierre de caja** con conteo en USD y Bs por turno. Cálculo automático de diferencia y reporte por operador.
- **Historial de ventas** con detección inteligente del cliente (nombre real vs. tag de mesa), filtros avanzados (fecha, método de pago, tipo, descuento, anuladas), expansión de filas con detalle de items, reimpresión y anulación con PIN.
- **Auditorías**: AuditLog con cada cambio sensible (anulaciones, transferencias, ajustes) y trazabilidad de quien autorizó.

---

# Equipo y Permisos

- **4 roles**: OWNER, ADMIN_MANAGER, OPS_MANAGER, AUDITOR + roles operativos (CASHIER, MESONERO, KITCHEN).
- **Sistema de permisos granular de 4 capas** (PR #36): roles base + permisos otorgados (`grantedPerms`) + permisos revocados (`revokedPerms`) + módulos permitidos (`allowedModules`).
- **PIN de mesonero** con criptografía PBKDF2 + salt. Capitanes con privilegios extendidos.
- **PIN de gerente** para autorizar anulaciones, transferencias y descuentos de cortesía.
- **Login** case-insensitive en email (mayúsculas no afectan), case-sensitive en password.

---

# Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript |
| Estilos | Tailwind CSS · Design system Minimal Navy (tokens custom) |
| Charts | Recharts (LineChart, BarChart, PieChart) |
| Backend | Next.js Server Actions · Prisma 5.22 ORM |
| BD | PostgreSQL 18.2 (RDS us-east-2 → migración a Contabo en curso) |
| Auth | Sesiones JWT + cookies HttpOnly · PBKDF2 para PINs y passwords |
| Hosting | Vercel · auto-deploy desde `main` · cron `*/5 min` |
| Storage | Filesystem persistente (Contabo) para uploads de notas de entrega |
| CI/CD | TypeScript check + Vitest 62 tests · gates antes de merge |
| Diseño | Minimal Navy — Inter Tight, paleta navy + coral + cream, dark-mode nativo |

### Convenciones del proyecto

- **Cero pérdida de datos**: instrucción permanente. Migraciones strict additive (`CREATE TABLE IF NOT EXISTS`), snapshots RDS pre-deploy, transacciones atómicas Prisma.
- **Outbox pattern** para operaciones críticas (descargo de inventario) con reintentos automáticos.
- **CLAUDE.md** documenta convenciones de UI, colores, tipografía, helpers POS, modales estándar.
- **OPUS_CONTEXT_CAPSULA.md** mantiene historial completo del producto y decisiones técnicas.

---

# Sprint reciente — Mayo 2026 (PRs #46–#58)

> 13 PRs squash-mergeados en menos de 2 semanas, todos con tsc + vitest verdes, todos con plan de testing manual documentado.

<div class="grid-2">
  <div class="module-card">
    <h4>Cierre Fase 2 audit restaurante</h4>
    <p class="desc">Outbox cron `*/5 min`, hook histórico de precios al recibir OC, vistas de proveedor con LineChart de evolución.</p>
  </div>
  <div class="module-card">
    <h4>Token cream + audit dark mode</h4>
    <p class="desc">Botón "+" del POS Restaurante invisible en dark → 121 ocurrencias migradas a `text-capsula-cream` (no-invertido).</p>
  </div>
  <div class="module-card">
    <h4>Maintenance mode</h4>
    <p class="desc">Middleware con env var MAINTENANCE_MODE + página /maintenance + endpoint /api/health para uptime monitoring.</p>
  </div>
  <div class="module-card">
    <h4>RBAC en pre-cuenta</h4>
    <p class="desc">Mesoneros regulares ya no imprimen pre-cuenta (solo capitanes y gerentes). Mantienen "Copiar" al portapapeles.</p>
  </div>
  <div class="module-card">
    <h4>Propina en total</h4>
    <p class="desc">Modal "Cuenta" + recibo térmico ahora suman propina al TOTAL A PAGAR. Línea separada en el breakdown.</p>
  </div>
  <div class="module-card">
    <h4>Subcuentas en POS Restaurante</h4>
    <p class="desc">Auto-detección + cash EUR + recibo individual por subcuenta (auto-print tras cobro + botón manual).</p>
  </div>
  <div class="module-card">
    <h4>33% cash discount automático</h4>
    <p class="desc">Cuentas y subcuentas: cash USD/EUR/Zelle aplica DIVISAS_33 sin click manual. Service charge sobre el descontado.</p>
  </div>
  <div class="module-card">
    <h4>Historial de ventas mejorado</h4>
    <p class="desc">Cliente real vs. tag de mesa, UI Minimal Navy completa, lucide icons, filtros con tonos autorizados.</p>
  </div>
  <div class="module-card">
    <h4>Anular subcuentas</h4>
    <p class="desc">Action atómica con PIN gerente. Cobradas → restaura saldo, marca PaymentSplit como VOID, reabre la mesa.</p>
  </div>
  <div class="module-card">
    <h4>Resumen diario en Finanzas</h4>
    <p class="desc">Toggle Mensual/Diario. Datepicker, cards con DOD, BarChart de 24 horas, listas tipo/método, cash flow del día.</p>
  </div>
  <div class="module-card">
    <h4>Login case-insensitive</h4>
    <p class="desc">`Admin@…` y `admin@…` ambos válidos. autoCapitalize/autoCorrect off para móvil. Password sigue case-sensitive.</p>
  </div>
  <div class="module-card">
    <h4>Migración BD preparada</h4>
    <p class="desc">PG 18 instalado en Contabo, dump+restore validado con row counts. Cutover pendiente de ventana de mantenimiento.</p>
  </div>
</div>

---

# Hoja de ruta

### Corto plazo (semanas)

- **Cutover BD a Contabo** durante ventana de mantenimiento de 5-15 min (snapshot RDS de seguridad ya tomado).
- **Configurar `CRON_SECRET`** en Vercel para autenticar el endpoint de cron del outbox.
- **Backups automáticos** con `pg_dump` cron diario a S3 alterno + BorgBackup remoto.

### Mediano plazo (meses)

- **App también a Contabo** (Next.js + PM2/Docker + nginx + Let's Encrypt). Menor latencia BD↔app, costo $0 en Vercel, control total.
- **Integraciones externas**: PedidosYA API directa (hoy es manual), conciliación bancaria automática, exportes a sistemas contables venezolanos.
- **Multi-sucursal** profundizado: Branch ya existe pero hay flujos por consolidar (intercompany transfers ya tiene base con IntercompanyItemMapping y IntercompanySettlement).

### Largo plazo

- **Cápsula SaaS multi-tenant**: el repo capsula-erp es la base operativa de Shanklish; existe un capsula-mt (multi-tenant) que generaliza la plataforma para vender a otros restaurantes.
- **App nativa móvil** para meseros (hoy es PWA en navegador móvil, funcional pero limitada offline).

---

# Garantías de operación

| Garantía | Cómo se cumple |
|---|---|
| **Cero pérdida de datos** | Migraciones additive + snapshots pre-deploy + transacciones atómicas + outbox pattern |
| **Auditoría completa** | AuditLog + voidReason + authorizedById en cada operación crítica |
| **Recuperación ante fallos** | Cron outbox cada 5 min con backoff exponencial; rollback automático en transacciones |
| **Dark mode nativo** | Tokens CSS variables, paleta capsula-* invierte automáticamente |
| **Mobile-first** | Helpers POS táctiles (`pos-btn`, `pos-tile`, `pos-card`) con feedback `:active` |
| **Performance** | Next.js Server Components + revalidatePath para invalidación granular; lazy-load de modales pesados |

---

# Cómo conocer Cápsula en profundidad

- **Repositorio**: [Juninho2604/capsula-erp](https://github.com/Juninho2604/capsula-erp)
- **Documentación viva**: `OPUS_CONTEXT_CAPSULA.md` en la raíz del repo (4900+ líneas con cada decisión técnica y cada bug fix histórico)
- **Convenciones para devs**: `CLAUDE.md` con reglas de tipografía, paleta, helpers, modales estándar
- **Esquema BD**: `prisma/schema.prisma` (69 modelos · 30 migraciones)

---

<div style="text-align: center; padding: 60px 20px; background: linear-gradient(145deg, #FF6B4A 0%, #2A4060 100%); color: #F7F5F0; border-radius: 24px; margin: 40px -20px;">
  <h2 style="color: #F7F5F0; border: none; margin: 0; font-size: 32px;">Cápsula</h2>
  <p style="color: rgba(247,245,240,0.7); font-size: 14px; margin-top: 10px;">El ERP operativo para tu restaurante</p>
  <p style="color: rgba(247,245,240,0.5); font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 30px;">Mayo 2026 · Versión productiva</p>
</div>
