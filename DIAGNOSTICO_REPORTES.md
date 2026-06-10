# DIAGNÓSTICO — Módulo de Reportes (Cápsula / kpsula.app)

**Fecha:** 2026-06-10 · **Alcance:** solo lectura, cero cambios de código.
**Contexto:** inducción con cliente real HOY. Este informe alimenta el prompt de desarrollo (Fase A/B/C al final).

Toda afirmación lleva `archivo:línea`. Verificado contra el código en `main` (commit `7ea6999`).

---

## 0. Resumen ejecutivo (leer esto primero)

- El módulo `/dashboard/reportes` existe pero es embrionario: **2 reportes de inventario funcionales** y 2 tiles "Próximamente". El 80% de la reportería real vive **dispersa** en `/dashboard/sales`, `/dashboard/finanzas`, `/dashboard/caja`, `/dashboard/costos/margen`, `/dashboard/compras/proveedor` e `/dashboard/inventario/historial-mensual`.
- Los **datos de ventas, anulaciones, descuentos, mesoneros y kardex ya existen** y son buenos — la mayoría de los reportes de FASE A son agregaciones nuevas sobre datos presentes, sin migración.
- Hay **3 bugs críticos de integridad** que hacen que ciertos reportes mientan si se construyen encima sin corregirlos: COGS siempre $0 (el P&L de Finanzas muestra utilidad bruta = ventas), voids de ítems de mesa que no revierten inventario, y cobros de mesa (PaymentSplit) que **no persisten tasa ni monto Bs** (rompe la regla de tasa histórica para mesas).
- **No existe NINGUNA infraestructura fiscal SENIAT** (ni adaptador TFHKA, ni modelo de documento fiscal, ni número de control). La familia F del catálogo es 🔴 completa.
- RBAC: el módulo `reportes` está registrado (OWNER/ADMIN_MANAGER/OPS_MANAGER/AUDITOR) pero **no hay permisos granulares por familia** (`reportes.ventas.ver`, etc.) y **no existe scoping por sucursal** (User no tiene `branchId` — `prisma/schema.prisma:135-237`). Aislamiento por tenant: correcto en todas las actions de reporte revisadas.

---

## 1. FASE 1 — Inventario del estado actual

### 1.1 Qué existe bajo `/dashboard/reportes` (§51.C del contexto)

| Pieza | Archivo | Estado |
|---|---|---|
| Landing con 4 tiles | `src/app/dashboard/reportes/page.tsx` | ✅ Funcional |
| Inventario completo (stock × área, valorizado, Excel) | `src/app/dashboard/reportes/inventario-completo/` + `src/app/actions/reports.actions.ts:61` | ✅ Funcional (rol-gated, tenant-scoped, batch queries) |
| Variación semana vs semana (WeeklyCount N vs N-1, Excel) | `src/app/dashboard/reportes/variacion-semanal/` + `compareWeeklyCountsAction` | ✅ Funcional (requiere ≥2 conteos) |
| Movimientos por rango | tile `status: 'soon'` (`reportes/page.tsx:34`) | ❌ No existe la vista (backend parcial: `movement-history.actions.ts` solo mensual) |
| Ventas + costos + margen | tile `status: 'soon'` (`reportes/page.tsx:41`) | ❌ No existe (y depende del BUG #1 — COGS) |
| Helpers puros con tests | `src/lib/reports/inventory-report-helpers.ts`, `weekly-variation-helpers.ts` | ✅ 21 tests |

### 1.2 Reportería dispersa FUERA de `/reportes` (a consolidar)

| Reporte | Dónde vive | Estado |
|---|---|---|
| Historial de ventas (filtros, expansión subcuentas, void) | `/dashboard/sales` + `src/app/actions/sales/history.actions.ts` | ✅ Funcional |
| Reporte Z diario + export Excel | `sales/z-report.actions.ts` + `src/lib/export-z-report.ts` | ✅ Funcional (solo USD — ver BUG #6) |
| Arqueo Excel 24 columnas | `sales/arqueo.actions.ts` + `/api/arqueo` | ✅ Funcional |
| Cierre del día (end-of-day) | `sales/end-of-day.actions.ts` | ✅ Funcional |
| Platos vendidos por rango (producto + modifiers) | `sales/sold-items-report.actions.ts` + `/dashboard/sales/items` | ⚠️ Funciona, pero sin gate de rol y con criterio de "venta" distinto al Z (ver BUG #7) |
| Auditoría de ventas para cruce de inventario (Excel) | `sales/audit-export.actions.ts` | ✅ Funcional (gated `EXPORT_SALES`) |
| Comandas del día (reimpresión) | `sales/comandas-del-dia.actions.ts` | ✅ Funcional |
| P&L mensual + resumen diario (hourlySales, MoM/DOD, Excel) | `src/app/actions/finance.actions.ts` + `/dashboard/finanzas` | ⚠️ Funcional pero **COGS = $0** (BUG #1) |
| Dashboard ejecutivo del día (KPIs, top productos, propinas, anulaciones) | `/dashboard/page.tsx` + `dashboard.actions.ts` + `estadisticas.actions.ts` | ✅ Funcional |
| Margen por plato (precio vs costo receta) | `cost.actions.ts:getDishMarginsAction` + `/dashboard/costos/margen` | ✅ Funcional (costo teórico de receta, no COGS real) |
| Histórico de precios por proveedor (chart + Δ%) | `/dashboard/compras/proveedor/[id]` + `SupplierItemPriceHistory` | ✅ Funcional |
| Kardex mensual de movimientos | `movement-history.actions.ts` + `/dashboard/inventario/historial-mensual` | ⚠️ Funcional pero solo mes calendario, sin export, sin valorización en SALE (BUG #9) |
| Cierres de caja + KPIs mensuales de cuadre | `cash-register.actions.ts` + `/dashboard/caja` | ⚠️ Cuadre matemáticamente roto (BUG #4) |
| Gastos con charts + Excel | `/dashboard/gastos` | ✅ Funcional |
| Cuentas por pagar/cobrar, conciliación bancaria, comisiones | `/dashboard/cuentas-pagar`, `cuentas-cobrar`, `conciliacion`, `cuentas-bancarias` (§56, flag-gated) | ✅ Funcional |
| Inventario diario teórico vs real | `/dashboard/inventario/diario` (§50) | ✅ Funcional (post-fixes §50) |

### 1.3 Modelos Prisma relevantes para reportería

Leyenda: ten=tenantId · br=branchId · ts=timestamps confiables · $$=campos dual-currency (montoBs/montoUsd/tasa).

| Modelo (línea schema) | ten | br | ts | $$ | Notas para reportes |
|---|---|---|---|---|---|
| `SalesOrder` (1147) | ✅ | ⚠️ nullable — **solo se setea en órdenes de mesa** (`pos.actions.ts:1844`); `createSalesOrderAction` NO lo setea (`pos.actions.ts:1330-1368`) → delivery/pickup quedan `branchId=NULL` | ✅ `createdAt`, `sentToKitchenAt`, `closedAt`, `voidedAt` | ⚠️ `exchangeRateValue`/`totalBs` existen (1232-1233) pero **NUNCA se escriben** (0 writes en todo `src/`) | Mesonero (`waiterProfileId`), área, zona, mesa, canal, descuento+autorizador, void+motivo: todo presente |
| `SalesOrderItem` (1274) | ✅ | — | ✅ + `voidedAt` | — | `costPerUnit/costTotal/margin*` existen (1304-1307) pero **nunca se escriben al vender** (BUG #1). Snapshot de promoción ✅ (1295-1298) |
| `SalesOrderPayment` (2496) | hereda | — | ✅ | ✅ `amountUSD/amountBS/exchangeRate` | **Solo se crea si el POS manda `payments[]`** (`pos.actions.ts:1413`). Delivery con PDV/MOVIL sin monto → NO crea fila (`delivery/page.tsx:424,431`) |
| `PaymentSplit` (2414) — cobros de mesa | hereda | — | ✅ `paidAt` | ❌ **sin `amountBs` ni `exchangeRate`** | BUG #3. `serviceChargeAmount`, `tipAmount`, `subAccountId` ✅ |
| `TabSubAccount` (2448) | hereda | — | ✅ | ❌ solo USD | |
| `OpenTab` (2344) | ✅ | ✅ NOT NULL | ✅ `openedAt/closedAt` | — | `guestCount` ✅ (ningún reporte lo usa), `totalServiceCharge`, `totalTip`, `waiterProfileId` ✅ |
| `CashRegister` (1868) | ✅ | ❌ | ✅ | ⚠️ apertura/cierre Usd+Bs, pero resumen solo USD | **Sin FK desde SalesOrder** (no hay `cashRegisterId`) → no se puede atribuir venta→turno (BUG #4) |
| `Expense` (1810) | ✅ | ❌ | ✅ `paidAt` | ✅ | `bankAccountId` ✅ (tesorería) |
| `InventoryMovement` (414) | ❌ **sin tenantId** (hereda vía `inventoryItem`/`area`) | ❌ (área→branch) | ✅ | ⚠️ `unitCost/totalCost` nullable y **vacíos en SALE** (BUG #9) | Es el kardex. Trazabilidad cruzada completa (salesOrderId, purchaseOrderId, etc.) ✅. `WASTE` definido pero no usado en runtime |
| `PurchaseOrder` (1593) / `PurchaseOrderItem` (1646) | ✅ | ❌ | ✅ `orderDate/receivedDate` | ❌ solo USD, sin tasa | `quantityOrdered` vs `quantityReceived` ✅ |
| `SupplierDocument` (1679, §57) | ✅ | — | ✅ | ⚠️ `currency` string | Conciliación documentos↔OC ✅ |
| `CostHistory` (557) | hereda | — | ✅ `effectiveFrom/To` | `currency` | Dos políticas de escritura inconsistentes (BUG #8) |
| `DailyInventory/Item` (1357/1389) | ✅ | ❌ (área) | ✅ | `costPerUnit` | Teórico vs real DIARIO ✅: `initial+entries−sales−waste` vs `finalCount` → `variance` |
| `WeeklyCount/Item` (482/521) | ✅ | ❌ | ✅ | — | Snapshot inmutable, varianza por SKU ✅ |
| `Recipe/RecipeIngredient` (582/622) | ✅ | — | ✅ | — | Costeo recursivo en `cost.service.ts` ✅ |
| `SupplierItemPriceHistory` (2993) | hereda | — | ✅ | — | Variación de precios ✅ versionada |
| `TableTransfer` (2261) | hereda (openTab) | — | ✅ `transferredAt` | — | PIN dual + mesas from/to ✅. **Sin reporte que lo consuma** (solo se escribe en `waiter.actions.ts`) |
| `AuditLog` (1740) | ✅ | — | ✅ | — | Solo lo escriben 7 actions de tesorería/finanzas; el POS NO escribe AuditLog (voids/descuentos viven en columnas propias). Sin UI de consulta |
| `ExchangeRate` (2558) | ✅ | — | ✅ `effectiveDate` | — | |
| `Promotion` (1033) + snapshot en item | ✅ | — | ✅ | — | Reporte de descuentos por promo: datos ✅ |
| **Fiscal (TFHKA/SENIAT)** | — | — | — | — | **NO EXISTE NADA**: ni modelo, ni adaptador, ni número de control, ni IVA/IGTF desglosado. Solo `Tenant.taxId` (RIF para branding, schema:31-48) e `InvoiceCounter` (correlativo interno, 2543). El único "fiscal" del repo es `src/lib/fiscal-week.ts` (semana fiscal de tesorería, sin relación SENIAT) |

### 1.4 Índices — ver sección 4 (lista de faltantes)

---

## 2. FASE 2 — BUGS CRÍTICOS de integridad (ordenados por severidad)

> Regla aplicada: un reporte sobre datos rotos es peor que no tener reporte. Los #1–#4 deben corregirse ANTES de construir los reportes que los consumen.

### 🔴 BUG #1 — COGS siempre $0: el costo nunca se snapshotea al vender
- **Dónde:** `pos.actions.ts:1369-1390` (createSalesOrderAction) y `pos.actions.ts:1828+` (addItemsToOpenTabAction) crean `SalesOrderItem` **sin** `costPerUnit/costTotal` (campos existentes en `schema.prisma:1304-1307`). Grep en todo `src/`: **cero writes** de `costTotal`.
- **Efecto:** `finance.actions.ts:87-93, 227-237, 320-323, 471-477, 574-582` calculan COGS como `Σ items.costTotal` → **COGS = $0**, utilidad bruta = ventas, margen % ficticio en el P&L mensual y diario. El reporte "Ventas + costos + margen" planificado y el CMV/food cost % son imposibles hasta corregir.
- **Fix:** código puro (sin migración) — al crear cada item, resolver costo vigente vía `cost.service.ts:getCurrentItemCost`/costo recursivo de receta y persistirlo. Backfill histórico opcional con script (costo vigente a la fecha de la venta desde `CostHistory`).

### 🔴 BUG #2 — Voids/ajustes/reemplazos de ítems en mesa NO tocan inventario
- **Dónde:** `voidItemInTx` (`pos.actions.ts:2283-2331`) hace soft-delete y recalcula totales pero **no crea ningún movimiento de reversión**; `modifyTabItemAction` en modos `ADJUST_QTY`/`REPLACE` crea el ítem nuevo **sin descargo** (creates dentro del tx, sin `registerInventoryForCartItems` — verificado: la única creación de `inventoryMovement` en todo pos.actions.ts es la del descargo de venta, línea 807).
- **Contraste:** la anulación de orden COMPLETA sí revierte correctamente (`sales/void.actions.ts:51-99`, `ADJUSTMENT_IN` + restore de recetas y modificadores).
- **Efecto:** stock real vs teórico desincronizado en cada modificación de comanda → contamina kardex, inventario diario (varianza falsa) y cualquier reporte de costo real vs teórico.

### 🔴 BUG #3 — Cobros de mesa sin tasa histórica ni monto Bs (dato NO recuperable)
- **Dónde:** `PaymentSplit` (`schema.prisma:2414-2441`) no tiene `amountBs` ni `exchangeRate`; `registerOpenTabPaymentAction` crea el split solo con montos USD (`paidAmount = data.amount`). Las mesas NUNCA crean `SalesOrderPayment`.
- **Agravante en ventas directas:** en POS Delivery, pago único con `PDV_*` o `MOVIL_NG` sin monto tipeado cae al fallback `{ paymentMethod, amountPaid }` **sin crear línea de pago** (`delivery/page.tsx:424,431`) → ni Bs ni tasa persistidos. (POS Restaurante pickup sí manda `payments[]` siempre: `restaurante/page.tsx:1494-1498`.)
- **Efecto:** el reporte "ventas por método de pago en Bs con tasa del momento" es imposible para mesas y parcial para delivery. Cualquier conversión posterior con tasa actual sería el BUG CRÍTICO de dual-currency que el catálogo prohíbe. Nota: el módulo de comisiones de tesorería (§56) deriva de `SalesOrderPayment` → también pierde los cobros de mesa y los PDV sin línea de pago.
- **Fix:** migración menor (ADD COLUMN nullable en PaymentSplit — safe §44) + setear en el cobro + crear siempre la línea de pago en ventas directas. **Lo histórico sin tasa no es reconstruible con exactitud** — los reportes deben mostrar "Bs no registrado" para ese legado, no inventar conversión.

### 🔴 BUG #4 — Cierre de caja (X/Z por turno) matemáticamente roto
`cash-register.actions.ts:195-226` (`closeCashRegisterAction`):
1. `expectedCash = openingCashUsd + totalSalesUsd + tips − expenses` donde `totalSalesUsd` = `Σ SalesOrder.total` de **TODOS los métodos** (PDV, Zelle, pago móvil incluidos) — dinero que jamás entra a la gaveta física.
2. Ignora por completo el lado Bs (`openingCashBs` se guarda pero no participa; no hay esperado Bs).
3. Filtro `status IN ('COMPLETED','CONFIRMED')`: `COMPLETED` no existe en SalesOrder (§20.1) y **excluye `'READY'`** (órdenes de tab sin cocina, `pos.actions.ts:1836`), e **incluye órdenes de mesas aún no cobradas** (no filtra `paymentStatus`).
4. Ventana por `shiftDate` +4h/+28h (líneas 195-196) — **no hay FK orden→turno** (`SalesOrder` no tiene `cashRegisterId`): dos cajas/turnos del mismo día suman LAS MISMAS órdenes; el reporte X parcial por cajero es imposible con el modelo actual.

### 🟠 BUG #5 — `branchId` NULL en todas las ventas directas
`createSalesOrderAction` no setea `branchId` (`pos.actions.ts:1330-1368`); solo las órdenes de mesa lo heredan del OpenTab (`pos.actions.ts:1844`). Consecuencia: "ventas por sucursal (consolidado multi-branch)" — pilar del catálogo A — es irrealizable para delivery/pickup. Fix de código (resolver branch del terminal/área) + backfill.

### 🟠 BUG #6 — Reporte Z solo agrega USD
`sales/z-report.actions.ts`: `paymentBreakdown` acumula únicamente `amountUSD`; no expone totales Bs por método ni la tasa aplicada (los datos existen en `SalesOrderPayment.amountBS/exchangeRate` para ventas directas). El cierre que la Providencia/operación necesita "por método en Bs y USD con tasa" requiere extender la agregación (y depende del BUG #3 para mesas).

### 🟠 BUG #7 — "Ventas por producto" y "ventas cobradas" usan criterios distintos → no cuadran
- `sold-items-report.actions.ts:94-103` cuenta ítems de cualquier orden no anulada **incluyendo mesas abiertas sin cobrar** (no filtra `paymentStatus`/splits PAID), mientras el Z excluye tabs sin cobrar (§20.6).
- Además `getSoldItemsReportAction` **solo valida sesión, sin gate de rol** (`sold-items-report.actions.ts:76-77`) — un WAITER puede invocarla por RPC.
- Para que el módulo de reportes "cuadre" (total por producto == total por método del mismo rango) hay que unificar el criterio (recomendado: cobrado=PAID + splits, como el Z) o exponer ambos con etiqueta explícita.

### 🟡 BUG #8 — Dos políticas de costeo en compras
- `purchase.actions.ts:652-663` (recepción de OC): crea `CostHistory` con el **último costo** y **no cierra** el registro vigente anterior (quedan múltiples `effectiveTo: null`).
- `entrada.actions.ts:174-190` (entrada de mercancía): **costo promedio ponderado** y sí cierra el anterior.
- `getCurrentItemCost` (`cost.service.ts:61-67`) tolera duplicados (orderBy desc) pero el kardex de costos queda sucio y el costo de receta varía según el camino por el que entró la mercancía.

### 🟡 BUG #9 — Kardex sin valorización en ventas
El movimiento `SALE` se crea sin `unitCost/totalCost` (`pos.actions.ts:807-818`). El kardex no puede valorizar salidas por venta; el costo teórico del período hay que reconstruirlo desde recetas.

### 🟡 BUG #10 — Sub-recetas: descargo de primer nivel únicamente
`registerInventoryForCartItems` (`pos.actions.ts:754-770`) descarga los ingredientes del primer nivel; si un ingrediente es `SUB_RECIPE` se descuenta el semielaborado del stock (correcto SOLO si Producción registró su `PRODUCTION_IN`). Si el local no registra producción, el consumo teórico de materia prima se pierde. El costeo sí es recursivo (`cost.service.ts:130-137`) — asimetría costo vs consumo.

### 🟡 BUG #11 — Tiempos de cocina no medibles
Existe `sentToKitchenAt` (`schema.prisma:1201`, seteado en `pos.actions.ts:1346,1598,1838`) pero el PATCH de la comandera solo cambia `status` (`api/kitchen/orders/route.ts:103-107`) — **no hay `kitchenReadyAt`**. El reporte "tiempos de cocina por estación" carece del timestamp de fin. (Menor: el GET de cocina usa `setHours` del server, no Caracas — `route.ts:35`, mismo patrón corregido en §50 para el daily.)

### 🟡 BUG #12 — AuditLog casi vacío para operaciones POS
`writeAuditLog` solo se invoca desde 7 actions de tesorería/compras (`bank-account`, `treasury`, `expense`, `account-payable/receivable`, `cash-register`, `supplier-document`). Voids, descuentos, transferencias de mesa y cambios de PIN viven en columnas propias (suficiente para reportes B.2/B.3/B.4) pero el "reporte de auditoría de operaciones sensibles" unificado no puede salir solo de AuditLog.

### ✅ Verificado SIN problema
- **Huérfanos:** FKs con `onDelete: Cascade` en `SalesOrderPayment→SalesOrder` (2499), `PaymentSplit→OpenTab` (2417), `SalesOrderItem→SalesOrder` (1278). No pueden existir pagos sin orden ni splits sin mesa.
- **Aislamiento tenant en reportes:** `reports.actions.ts`, `sales/*.actions.ts`, `finance.actions.ts`, `treasury.actions.ts` usan `resolveTenantContext()` + `withTenant()` (auditoría §45.1: 0 DANGER).
- **Timezone:** todas las agregaciones de ventas usan `getCaracasDayRange`/`revenueWhere` (§20.2-20.3).
- **Tasa histórica donde existe el dato:** historial/arqueo leen `amountBS/exchangeRate` persistidos; los usos de `getExchangeRateValue()` (tasa de hoy) en reportes son display-only (ej. equivalente Bs en POS mesero, `mesero/page.tsx:1707`). No se encontró ningún reporte que convierta totales históricos con tasa actual — el riesgo es la **ausencia** del dato (BUG #3), no la reconversión.

---

## 3. FASE 3 — Gap analysis contra el catálogo objetivo

Leyenda: ✅ existe y funciona · ⚠️ existe con problemas · ❌ no existe · 🔶 no existe pero los datos YA están · 🔴 no existe y FALTAN datos en el modelo.

### A. VENTAS
| Reporte | Estado | Detalle |
|---|---|---|
| Ventas por día/semana/mes + comparativo vs período anterior | ⚠️ | Mensual con MoM y diario con DOD en Finanzas (`finance.actions.ts`); falta vista por rango libre/semana y consolidación en /reportes |
| Ventas por producto y categoría (unid, monto, %) | ⚠️ | `sold-items-report` + `/dashboard/sales/items` — criterio no cuadra con Z (BUG #7), sin % del total ni agrupación por categoría en UI, sin gate de rol |
| Ventas por hora (heatmap) | 🔶 | `hourlySales` 24 buckets existe SOLO para un día (`finance.actions.ts:398-503`); por rango = agregación nueva sobre `createdAt` |
| Ventas por mesonero | 🔶 | `SalesOrder.waiterProfileId` + `OpenTab.waiterProfileId` poblados; **ningún reporte agrupa por mesonero** (grep: 0 usos en sales/finance) |
| Ventas por área (salón/barra/delivery) | 🔶 | `serviceZoneId`/`areaId` en la orden; Z agrega por canal, no por zona |
| Ventas por canal | ✅ | Z `byType` + bloques del arqueo (REST/PICKUP/DELIVERY/PY) |
| Ventas por método de pago Bs y USD con tasa | ⚠️/🔴 | USD ✅ (Z/arqueo). Bs con tasa histórica: ✅ ventas directas con `payments[]`; 🔴 mesas (PaymentSplit sin tasa — BUG #3) y delivery PDV/MOVIL fallback |
| Ticket promedio y comensales | ⚠️/🔶 | Ticket promedio ✅ (Finanzas). Comensales: `OpenTab.guestCount` existe y nadie lo reporta |
| Ventas por sucursal (multi-branch) | 🔴 | `branchId` NULL en ventas directas (BUG #5); ningún reporte filtra/agrupa por branch (grep: 0 usos en sales/finance) |

### B. OPERATIVOS
| Reporte | Estado | Detalle |
|---|---|---|
| Reporte X (parcial de cajero/turno) | 🔴 | No existe; **falta el vínculo orden→turno** (`SalesOrder.cashRegisterId`) — hoy es imposible separar 2 turnos del mismo día (BUG #4) |
| Reporte Z (cierre de jornada) | ⚠️ | Existe, consultable por fecha histórica, con export — pero solo USD (BUG #6) y `expectedCash` del cuadre de caja roto (BUG #4) |
| Anulaciones y voids con motivo/autorizador/mesonero | 🔶 | Datos completos: orden (`voidedAt/voidReason/voidedById`, schema:1185-1188) e ítem (`voidedAt/voidReason/voidedByWaiterId/voidedByUserId`, schema:1310-1315). Solo hay sección resumida en Z + Excel de auditoría; falta reporte dedicado por rango |
| Descuentos y cortesías por autorizador | 🔶 | `discountType/discountReason/authorizedById` (schema:1179-1182) + snapshot de promos (1295-1298). Sin reporte dedicado |
| Transferencias de mesa (PINs involucrados) | 🔶 | `TableTransfer` completo (schema:2261-2287) — cero consumo en UI |
| Propinas por mesonero y método de pago | 🔴 | Propina existe agregada (Z `totalTips`, splits `tipAmount`, PKP) pero la PKP colectiva no guarda mesonero ni el split la tasa/método desglosable por mesonero de forma confiable |
| Tiempos de cocina por estación | 🔴 | Solo `sentToKitchenAt`; falta `kitchenReadyAt` (BUG #11) |
| Auditoría de operaciones sensibles | 🔶/⚠️ | Columnas por entidad ✅; `AuditLog` subutilizado (BUG #12), sin UI |

### C. COMPRAS
| Reporte | Estado | Detalle |
|---|---|---|
| Compras por proveedor y período | 🔶 | `PurchaseOrder(orderDate, supplierId, totalAmount)` listo; solo hay listado operativo, no agregación por período |
| Detalle OC vs recepciones | ⚠️ | `quantityOrdered` vs `quantityReceived` en detalle de OC ✅ + conciliación documentos↔OC (§57) ✅; falta reporte consolidado de diferencias |
| Variación de precios de insumos | ✅ | `/dashboard/compras/proveedor/[id]` con `SupplierItemPriceHistory` |

### D. INVENTARIO
| Reporte | Estado | Detalle |
|---|---|---|
| Existencias valorizadas (Bs y USD) | ⚠️ | USD ✅ (`/reportes/inventario-completo`); Bs = falta multiplicar por tasa del día (display) — trivial |
| Kardex de movimientos por insumo | ⚠️ | `historial-mensual` existe (mes calendario, sin export, sin valor en SALE — BUG #9); el tile "Movimientos por rango" está "soon" |
| Mermas y ajustes con motivo | ⚠️ | `ADJUSTMENT_*` con `reason` ✅; `WASTE` definido pero **no usado en runtime**; merma diaria (`DailyInventoryItem.waste`) sin motivo ni `InventoryMovement` espejo |
| Costo real vs teórico por período | ⚠️/🔶 | Diario ✅ por área (varianza); semanal ✅ N vs N-1; falta el cruce "esperado = conteo previo + compras − ventas teóricas" (roadmap §51.B.5) y lo contamina el BUG #2 |
| Consumo por receta | 🔶 | `computeConsumptionFromOrders` (`src/lib/inventory/consumption.ts`) ya calcula consumo por ítem desde órdenes — solo se usa para el diario; reporte por rango = wrapper nuevo |
| Alertas de stock mínimo | ✅ | `getLowStockItemsAction` + broadcasts + tabla en dashboard |

### E. GERENCIALES
| Reporte | Estado | Detalle |
|---|---|---|
| Dashboard ejecutivo del día (tiempo real) | ✅/⚠️ | `/dashboard` + resumen diario Finanzas; falta comparativo "mismo día semana pasada" (agregación nueva, datos ✅) |
| CMV / food cost % por categoría | 🔴* | Bloqueado por BUG #1 (COGS=$0). *Los campos existen — es fix de código, no de schema |
| Ingeniería de menú (popularidad × margen) | 🔶 | Popularidad ✅ (sold-items) + margen teórico ✅ (`getDishMarginsAction`); falta cruzarlos en la matriz estrella/vaca/rompecabezas/perro |
| Comparativo entre sucursales | 🔴 | BUG #5 (branchId NULL) + un solo branch real por tenant hoy |
| P&L operativo simplificado | ⚠️ | Existe (Finanzas mensual/diario) — COGS roto (BUG #1) |

### F. FISCAL
| Reporte | Estado | Detalle |
|---|---|---|
| Resumen de documentos fiscales emitidos por período | 🔴 | **No existe infraestructura fiscal alguna**: ni modelo `FiscalDocument`, ni adaptador TFHKA/impresora fiscal (el print-agent es ESC/POS térmico no fiscal), ni número de control/serial, ni IVA/IGTF desglosado (`SalesOrder.tax` siempre 0). Solo `InvoiceCounter` interno y `Tenant.taxId` para branding |

### Transversales
| Capacidad | Estado |
|---|---|
| Export Excel | ✅ en arqueo/Z/finanzas/gastos/inventario; inconsistente (cada vista su propio builder) |
| Export PDF | ❌ no existe en ningún reporte |
| Permisos granulares de reportes (`reportes.*`) | ❌ — solo módulo `reportes` por rol (`modules-registry.ts:709`) y PERMs genéricos (`EXPORT_SALES`, `VIEW_FINANCES`, `VIEW_COSTS`) |
| Scoping por sucursal en RBAC | 🔴 — `User` sin `branchId`; documentado como "opción A" en §55.9 |
| Aislamiento por tenant | ✅ verificado en todas las actions de reporte |

---

## 4. Índices faltantes

Hoy `SalesOrder` y compañía tienen índices single-column (`@@index([createdAt])` + `@@index([tenantId])` por separado, schema:1259-1271); los índices compuestos `(tenantId, …)` solo existen en los modelos nuevos (PrintJob, Customer, DeliveryOrder…). Con un solo tenant activo el impacto actual es bajo (Postgres combina con bitmap-AND), pero para el patrón de reportes (`tenantId + branchId + fecha`) faltan:

| Tabla | Índice propuesto | Para qué |
|---|---|---|
| `SalesOrder` | `@@index([tenantId, createdAt])` | Toda agregación de ventas por rango |
| `SalesOrder` | `@@index([tenantId, branchId, createdAt])` | Consolidado multi-branch (post BUG #5) |
| `SalesOrder` | `@@index([tenantId, voidedAt])` | Reporte de anulaciones por rango |
| `Expense` | `@@index([tenantId, paidAt])` | Gastos por período |
| `CashRegister` | `@@index([tenantId, shiftDate])` | Histórico de cierres |
| `PurchaseOrder` | `@@index([tenantId, orderDate])` | Compras por período/proveedor |
| `InventoryMovement` | `@@index([inventoryItemId, createdAt])` | Kardex por insumo y rango (hoy son 2 índices separados) |
| `InventoryMovement` | `@@index([movementType, createdAt])` | Mermas/ajustes por rango |
| `AuditLog` | `@@index([tenantId, createdAt])` | Auditoría por período |
| `PaymentSplit` | `@@index([paidAt])` | Cobros de mesa por rango (hoy solo vía openTab) |

Todos aplicables con `CREATE INDEX CONCURRENTLY` (safe en producción viva, §44). Nota adicional: `InventoryMovement` no tiene `tenantId` — el kardex multi-tenant DEBE filtrar vía relación (`inventoryItem: { tenantId }`), nunca asumir scope implícito.

---

## 5. Cambios necesarios al schema (con migración propuesta)

Todos los cambios son **aditivos y safe** (§44: ADD COLUMN nullable / CREATE TABLE / CREATE INDEX CONCURRENTLY). Ninguno es prerequisito de FASE A.

```sql
-- M1 (FASE B) — Dual currency en cobros de mesa (cierra BUG #3 hacia adelante)
ALTER TABLE "PaymentSplit" ADD COLUMN "amountBs"     DOUBLE PRECISION;  -- monto Bs realmente recibido
ALTER TABLE "PaymentSplit" ADD COLUMN "exchangeRate" DOUBLE PRECISION;  -- tasa BCV al momento del cobro

-- M2 (FASE B) — Vínculo venta→turno de caja (habilita Reporte X y cuadre real, BUG #4)
ALTER TABLE "SalesOrder" ADD COLUMN "cashRegisterId" TEXT
  REFERENCES "CashRegister"(id) ON DELETE SET NULL;
CREATE INDEX CONCURRENTLY "SalesOrder_cashRegisterId_idx" ON "SalesOrder"("cashRegisterId");
-- (+ código: al cobrar, resolver la caja OPEN del terminal y stampearla)

-- M3 (FASE B) — Timestamp de cocina lista (habilita tiempos de cocina, BUG #11)
ALTER TABLE "SalesOrder" ADD COLUMN "kitchenReadyAt" TIMESTAMP(3);
-- (+ código: PATCH /api/kitchen/orders setea kitchenReadyAt al marcar READY)

-- M4 (FASE B) — Sucursal en entidades financieras (multi-branch real)
ALTER TABLE "CashRegister" ADD COLUMN "branchId" TEXT REFERENCES "Branch"(id) ON DELETE SET NULL;
ALTER TABLE "Expense"      ADD COLUMN "branchId" TEXT REFERENCES "Branch"(id) ON DELETE SET NULL;
-- BUG #5 (SalesOrder.branchId NULL en directas) NO requiere schema: la columna existe,
-- falta poblarla en createSalesOrderAction + backfill UPDATE de históricos.

-- M5 (FASE B, opcional) — índices compuestos de la sección 4 (CONCURRENTLY)

-- M6 (FASE C) — Documento fiscal (familia F) — modelo nuevo, no toca tablas existentes
CREATE TABLE "FiscalDocument" (
  id              TEXT PRIMARY KEY,
  "tenantId"      TEXT NOT NULL REFERENCES "Tenant"(id),
  "salesOrderId"  TEXT REFERENCES "SalesOrder"(id),
  "docType"       TEXT NOT NULL,           -- FACTURA | NOTA_CREDITO | NOTA_DEBITO
  "machineSerial" TEXT,                    -- serial impresora fiscal (TFHKA)
  "controlNumber" TEXT,                    -- número de control SENIAT
  "fiscalNumber"  TEXT,                    -- correlativo fiscal
  "baseAmount"    DOUBLE PRECISION,        -- base imponible
  "ivaAmount"     DOUBLE PRECISION,
  "igtfAmount"    DOUBLE PRECISION,
  "totalBs"       DOUBLE PRECISION,
  "exchangeRate"  DOUBLE PRECISION,
  "issuedAt"      TIMESTAMP(3) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'ISSUED'  -- ISSUED | VOIDED
);
CREATE INDEX "FiscalDocument_tenant_issued_idx" ON "FiscalDocument"("tenantId","issuedAt");

-- M7 (FASE C, opcional) — tenantId en InventoryMovement (hoy hereda vía relaciones)
ALTER TABLE "InventoryMovement" ADD COLUMN "tenantId" TEXT;
UPDATE "InventoryMovement" m SET "tenantId" = i."tenantId"
  FROM "InventoryItem" i WHERE i.id = m."inventoryItemId" AND m."tenantId" IS NULL;
```

**Cambios que NO requieren schema (solo código):** BUG #1 (snapshotear costo — columnas existen), BUG #2 (revertir/descargar inventario en modify/void de ítem), BUG #5 (poblar `branchId`), BUG #6 (Z en Bs), BUG #7 (criterio + gate de rol), BUG #8 (unificar política de costeo), BUG #9 (costo en movimiento SALE), `SalesOrder.exchangeRateValue/totalBs` (columnas existen, poblar al cobrar), propinas por mesonero (poblar `waiterProfileId` en la PKP — columna existe).

---

## 6. Plan de implementación propuesto

### FASE A — HOY (sin migraciones; reportes con datos ya disponibles)
Prioridad: que la inducción pueda mostrar un módulo `/reportes` coherente y que ningún número mienta.

1. **Fixes de código previos (críticos, sin migración):**
   - A0.1 Snapshot de costo al vender (BUG #1) — de aquí en adelante; backfill por script opcional.
   - A0.2 Reversión de inventario en `voidItemInTx` / `modifyTabItemAction` (BUG #2).
   - A0.3 Poblar `branchId`, `exchangeRateValue`, `totalBs` y línea de pago SIEMPRE en ventas directas (BUGs #3-parcial, #5).
   - A0.4 Gate de rol en `getSoldItemsReportAction` + unificar criterio "cobrado" (BUG #7).
2. **Registrar RBAC granular**: permisos `reportes.ventas.ver`, `reportes.operativos.ver`, `reportes.inventario.ver`, `reportes.compras.ver`, `reportes.gerencial.ver`, `reportes.fiscal.ver`, `reportes.exportar` en `permissions-registry.ts` (Capa 4) — sin migración (los perms son JSON en User).
3. **Capa de servicios `src/lib/reports/`** (sales-reports, operations-reports, inventory-reports, purchases-reports, management-reports) — funciones `{tenantId, branchIds?, dateFrom, dateTo}` → datos tipados.
4. **Reportes FASE A** (todos con datos presentes):
   - Dashboard de entrada de /reportes con KPIs del día (reusar dashboard/finanzas-diario) + comparativo mismo día semana pasada (query nueva).
   - Ventas por período: producto, categoría, canal, mesonero (`waiterProfileId`), área/zona, método de pago (USD completo; Bs solo donde hay dato, etiquetando el legado sin tasa).
   - Cierres Z históricos consultables (ya existe por fecha — exponer en /reportes con rango).
   - Anulaciones/voids + descuentos/cortesías con motivo y autorizador (datos completos a nivel orden e ítem).
   - Transferencias de mesa (TableTransfer — solo falta la vista).
   - Existencias valorizadas (ya ✅) + Kardex por rango (extender `getMonthlyMovementsAction` a rango y mover el tile a available).
   - Compras por proveedor/período (agregación nueva sobre PurchaseOrder).
5. **Estados vacíos elegantes + skeletons + Excel** en cada vista nueva.

### FASE B — Migraciones menores (esta semana)
- M1 PaymentSplit Bs/tasa + cobro de mesa que la escriba → completa "ventas por método Bs/USD con tasa" y Z dual-currency (BUGs #3/#6).
- M2 `SalesOrder.cashRegisterId` + stamping → **Reporte X por turno/cajero** y arreglo del cuadre (`expectedCash` solo efectivo, esperado Bs separado) (BUG #4).
- M3 `kitchenReadyAt` → tiempos de cocina por estación.
- M4 branchId en CashRegister/Expense + backfill de `SalesOrder.branchId` → consolidado por sucursal.
- M5 índices compuestos (CONCURRENTLY).
- Unificación de política de costeo en recepción de OC (ponderado + cerrar vigente — BUG #8) y costo en movimiento SALE (BUG #9).
- Propinas por mesonero (poblar waiterProfileId en PKP + agregación).

### FASE C — Gerenciales avanzados / fiscal
- CMV / food cost % por categoría (requiere A0.1 maduro + ventana de datos).
- Ingeniería de menú (matriz popularidad × margen con cuadrantes).
- Costo real vs teórico por período (cruce WeeklyCount + InventoryMovement, roadmap §51.B.5) — depende de A0.2.
- Comparativo entre sucursales (depende de M4 + segundo branch real).
- P&L por sucursal.
- Familia F fiscal: modelo `FiscalDocument` + adaptador TFHKA + reporte de emitidos por período (proyecto propio, no un "reporte" más).
- Export PDF unificado.

---

## 7. Estimación — qué se puede tener funcionando HOY

**Mostrables en la inducción sin tocar nada (ya funcionan):**
- `/dashboard` (KPIs del día) y `/dashboard/finanzas` (P&L mensual/diario) — ⚠️ NO presentar el COGS/margen del P&L como real (BUG #1; las ventas, gastos y flujo de caja sí son correctos).
- `/dashboard/sales`: historial, Reporte Z del día/fecha, arqueo Excel, cierre del día.
- `/dashboard/sales/items`: platos vendidos por rango.
- `/dashboard/reportes`: inventario completo valorizado + variación semanal.
- `/dashboard/costos/margen`, `/dashboard/compras/proveedor` (variación de precios), `/dashboard/caja` (⚠️ no mostrar el "esperado/diferencia" como cuadre confiable), gastos, cuentas por pagar.

**Construible HOY (FASE A, ~1 jornada de desarrollo, sin migraciones):** los 4 fixes A0 + ventas por mesonero/categoría/canal/método + anulaciones y descuentos con autorizador + kardex por rango + transferencias de mesa + compras por período, todos bajo `/dashboard/reportes` con RBAC nuevo y Excel.

**NO prometer hoy:** Reporte X por turno, dual-currency completo en mesas, tiempos de cocina, comparativo entre sucursales, food cost real, y todo lo fiscal — requieren FASE B/C.
