# Fase 3.0.A — Auditoría de modelos Prisma

**Fecha última actualización:** 2026-04-20 (v3 — cleanup final)
**HEAD del repo:** `e8bdc0e64a12118d5377c7b6a3477d24f128c692`
**Total de modelos analizados:** **67** (`^model\s+\w+` sobre `prisma/schema.prisma`)
**Estado:** ✅ Fase 3.0.A cerrada con este commit.

## Changelog

### 2026-04-20 — v3: Cleanup final con decisiones resueltas + Platform Admin

- 6 decisiones residuales de v2 (R1-R6) resueltas por Omar y aplicadas.
- 1 decisión adicional (M7) sobre MenuCategory: queda TENANT-SCOPED
  puro, no flexible.
- Sección nueva: **Platform Admin Panel** — arquitectura del panel
  de administración del SaaS (quién usa Cápsula desde el lado de los
  fundadores).
- Roles de plataforma definidos: PLATFORM_OWNER (Omar) y
  PLATFORM_SUPPORT (Gustavo default, escalable).
- Tablas nuevas expandidas de 11 a 14 para soportar Platform Admin
  (+PlatformAuditLog, +ImpersonationSession, +PlanModule,
  +WristbandPlanBranch; reorganizadas en 6 subsecciones).
- Sección nueva: **Principios de construcción de Fase 3** — disciplina
  "arquitectura flexible hoy, features cuando las pidan clientes".
- Sección nueva: **Features en hibernación** — lista explícita de UIs
  pospuestas con razón documentada.
- Reclasificaciones: `InventoryAudit` de AREA → BRANCH
  (`areaId` nullable como filtro opcional). `MenuItemModifierGroup`
  marcado como scope flexible heredado.
- Distribución final: 2 GLOBAL + 20 TENANT (3 flexible) + 31 BRANCH
  + 13 AREA + 1 SHARED = 67.
- Fase 3.0.A cerrada con este commit. Fase 3.0.B arranca fresca.

### 2026-04-20 — v2: Reclasificación a arquitectura de 3 niveles

Tras decisiones del humano sobre la estrategia de multi-tenancy
(10 decisiones resueltas durante la conversación post-v1):

- Arquitectura final: **Tenant → Branch → Area** (3 niveles).
- Reemplazada la clasificación binaria GLOBAL/TENANT-SCOPED/SHARED por
  cuatro buckets: GLOBAL, TENANT-SCOPED, BRANCH-SCOPED, AREA-SCOPED.
  SHARED se mantiene como caso aparte (User).
- Modelos con **scope flexible** (MenuItem, MenuModifier) marcados
  explícitamente: la misma tabla alberga rows de scope=TENANT (maestro
  del grupo) y rows de scope=BRANCH (exclusivos de una sucursal).
- Tablas nuevas identificadas para Fase 3.0.B:
  `Tenant`, `TenantModule`, `Plan`, `TenantConfig`, `PlatformConfig`,
  `UserTenant`, `UserBranch`, `PlatformBroadcast`, `MenuItemBranch`,
  `SupplierPriceOverride` (10 tablas).
- **Intercompany** confirmado como **intra-tenant cross-branch**
  (derivado de #7). Deja de ser cross-tenant en todos los casos.
- **User** con dos pivotes: `UserTenant` (rol de grupo: OWNER, ADMIN,
  BILLING…) + `UserBranch` (rol operativo: MANAGER, CASHIER, WAITER…).
- **ExchangeRate** sigue GLOBAL pero con `countryCode` para LATAM.
- **SystemConfig** se divide en `PlatformConfig` (global) +
  `TenantConfig` (per-tenant).
- **AuditLog** TENANT-SCOPED con rol `PLATFORM_ADMIN` que bypassa el
  filtro para soporte/debugging.
- **BroadcastMessage** se divide en `TenantBroadcast` (per-tenant, con
  `branchId` opcional para anuncios branch-específicos) +
  `PlatformBroadcast` (anuncios de Cápsula a todos los tenants).
- **ProductFamily** per-tenant puro (sin seed global ni override).
- **GameType** sigue GLOBAL pleno (sin tabla `TenantEnabledGameType`;
  el UI filtra por `GameStation` existente).
- **Supplier** per-tenant (directorio), con precios variables por
  branch vía `SupplierPriceOverride`.

### 2026-04-20 — v1: Primera auditoría (Escenario 2 simple)

Clasificación inicial en GLOBAL / TENANT-SCOPED / SHARED asumiendo
arquitectura de 2 niveles (tenant / no-tenant). Generó 10 decisiones
abiertas que fueron resueltas posteriormente y motivaron v2.

## Resumen ejecutivo

- **GLOBAL:** 2 modelos
- **TENANT-SCOPED:** 20 modelos (3 con scope flexible:
  `MenuItem`, `MenuModifier`, `MenuItemModifierGroup`)
- **BRANCH-SCOPED:** 31 modelos
- **AREA-SCOPED:** 13 modelos
- **SHARED:** 1 modelo
- **Total:** 67 ✓

Además, Fase 3.0.A define la arquitectura del **Platform Admin Panel**
(§6) — panel separado usado por Cápsula (Omar, Gustavo) para gestionar
el SaaS en sí. La Fase 3.0.B materializa 14 tablas nuevas que soportan
tanto el core multi-tenancy como el Platform Admin.

> **Nota sobre modelos scope-flexible.** `MenuItem`, `MenuModifier` y
> `MenuItemModifierGroup` cuentan dentro de TENANT-SCOPED porque el
> "dueño" lógico del row es el tenant (siempre hay `tenantId`). El
> campo discriminador (`scope = TENANT | BRANCH` + `ownerBranchId`
> nullable) determina si el row es visible a toda la organización o
> exclusivo de una sucursal. `MenuItemModifierGroup` hereda el scope
> de su `MenuItem` padre (decisión R6).

## 1. Modelos GLOBAL

Sin `tenantId`. Compartidos por todos los tenants de la plataforma.

| # | Modelo | Justificación |
|---|---|---|
| 1 | `GameType` | Catálogo universal de tipos de juego (BILLAR, PLAYSTATION, PING_PONG, ARCADE). Decisión #9: GLOBAL pleno, sin pivote `TenantEnabledGameType`; el UI filtra por `GameStation` existente para ese tenant. |
| 2 | `ExchangeRate` | Tasa del día. Decisión #1: sigue GLOBAL pero se le agrega `countryCode` (VE, MX, AR, CO…) para expansión LATAM. Un tenant resuelve su tasa por su país. |

## 2. Modelos TENANT-SCOPED

`tenantId` obligatorio, **sin** `branchId` propio. Son datos del
grupo/organización: catálogos maestros, configuración, directorio.

La columna **Scope** marca `TENANT` para datos puros del grupo, y
`TENANT/BRANCH flex` para tablas con scope flexible (discriminador por
row, con `ownerBranchId` nullable).

| # | Modelo | Scope | Razón | FK críticas a validar |
|---|---|---|---|---|
| 1 | `InventoryItem` | TENANT | Catálogo de SKUs del grupo. | `productFamilyId` → `ProductFamily` (mismo tenant) |
| 2 | `CostHistory` | TENANT | Historial de costo por ítem. | `inventoryItemId`, `createdById` |
| 3 | `Recipe` | TENANT | Recetas estándar del grupo (se reutilizan en todas las sucursales). | `outputItemId` → `InventoryItem`, `createdById` |
| 4 | `RecipeIngredient` | TENANT | Líneas de receta. | `recipeId`, `ingredientItemId` |
| 5 | `ProcessingTemplate` | TENANT | Plantilla de desposte/procesamiento. | `sourceItemId` |
| 6 | `ProcessingTemplateOutput` | TENANT | Outputs permitidos de plantilla. | `templateId`, `outputItemId` |
| 7 | `MenuCategory` | **TENANT fijo (M7)** | Decisión M7: estructura del menú del grupo. **NO es scope flexible.** Items `scope=BRANCH` usan categorías tenant existentes; una sucursal que necesita categoría nueva la pide al dueño. | — |
| 8 | `MenuItem` | **TENANT/BRANCH flex** | Ítem de menú. `scope=TENANT` = maestro del grupo, `scope=BRANCH` = plato local de una sucursal (`ownerBranchId` poblado). Overrides por branch (precio/disponibilidad) en `MenuItemBranch` (Fase 3.0.B). | `categoryId`, `recipeId` (string), `sourceBranchId` (string, intercompany) |
| 9 | `MenuModifierGroup` | TENANT | Grupos de modificadores del menú maestro. | — |
| 10 | `MenuModifier` | **TENANT/BRANCH flex** | Modificador. Misma semántica que `MenuItem`: maestro del grupo o exclusivo de una sucursal. | `groupId`, `linkedMenuItemId` |
| 11 | `MenuItemModifierGroup` | **TENANT/BRANCH flex (hereda de MenuItem, R6)** | Pivote ítem↔grupo-modificador. Su scope lo dicta el `MenuItem` padre: si el ítem es `scope=BRANCH`, el pivote es BRANCH-efectivo; si es `scope=TENANT`, es TENANT. El row no lleva `ownerBranchId` propio — se deriva. | `menuItemId`, `modifierGroupId` |
| 12 | `Supplier` | TENANT | Directorio del grupo. Decisión #10: per-tenant. Precios por branch vía `SupplierPriceOverride` (Fase 3.0.B). | — |
| 13 | `SupplierItem` | TENANT | Precio base (tenant-level) por (proveedor, ítem). Overrides en `SupplierPriceOverride`. | `supplierId`, `inventoryItemId` |
| 14 | `AuditLog` | TENANT | Decisión #3: TENANT-SCOPED; rol `PLATFORM_ADMIN` bypassa el filtro a nivel server action. Las acciones de platform admin también se registran en `PlatformAuditLog` separado (§9). | `userId` (string), `entityId` (string polimórfico) |
| 15 | `ExpenseCategory` | TENANT | Catálogo de categorías de gasto del grupo (el gasto en sí vive en la sucursal). | — |
| 16 | `ProductFamily` | TENANT | Decisión #5: per-tenant puro (duplicación aceptable; revisitar si SKU Studio se vuelve diferenciador). | — |
| 17 | `SkuCreationTemplate` | TENANT | Plantillas del grupo. | `productFamilyId` |
| 18 | `SystemConfig` | TENANT | Decisión #2: se divide en `PlatformConfig` (global) + `TenantConfig` (per-tenant). La tabla actual pasa a ser `TenantConfig` tras migración. | — |
| 19 | `BroadcastMessage` | TENANT | Decisión #4: se divide en `TenantBroadcast` (con `branchId?` opcional para anuncios branch-específicos) + `PlatformBroadcast` (anuncios de Cápsula). La tabla actual pasa a ser `TenantBroadcast`. | `createdById` (string) |
| 20 | `WristbandPlan` | TENANT (R1) | Decisión R1: plan del grupo (producto uniforme). Overrides por sucursal (precio, inclusiones) vía tabla puente `WristbandPlanBranch` (Fase 3.0.B, patrón idéntico a `MenuItemBranch`). | — |

## 3. Modelos BRANCH-SCOPED

`tenantId` + `branchId` obligatorios. Datos **operativos de una
sucursal física**. Varias de estas tablas hoy **no tienen** ninguno
(o solo `branchId` nullable); Fase 3.0.B agregará ambos como NOT NULL.

| # | Modelo | Tiene hoy | FK críticas |
|---|---|---|---|
| 1 | `Branch` | `code @unique` (el row **es** la sucursal; gana `tenantId`) | — |
| 2 | `Waiter` | `branchId` | — |
| 3 | `ServiceZone` | `branchId` | — |
| 4 | `TableOrStation` | `branchId`, `serviceZoneId` | — |
| 5 | `OpenTab` | `branchId` | `serviceZoneId`, `tableOrStationId`, `openedById`, `assignedWaiterId`, `waiterProfileId`, `closedById` |
| 6 | `OpenTabOrder` | — (hereda vía `openTabId`) | `openTabId`, `salesOrderId` deben ser **misma branch** |
| 7 | `PaymentSplit` | — (hereda vía `openTabId`) | `openTabId`, `salesOrderId`, `subAccountId` |
| 8 | `TabSubAccount` | — (hereda vía `openTabId`) | `openTabId` |
| 9 | `SubAccountItem` | — (hereda vía `subAccountId`) | `subAccountId`, `salesOrderItemId` — deben alinearse al mismo OpenTab/branch |
| 10 | `SalesOrder` | `branchId` (nullable), `areaId` (nullable) | `serviceZoneId`, `tableOrStationId`, `openTabId`, `waiterProfileId`, `exchangeRateId`, `createdById`, `authorizedById`, `voidedById` |
| 11 | `SalesOrderItem` | — (hereda vía `orderId`) | `orderId`, `menuItemId`, `voidedByWaiterId`, `voidedByUserId`, `replacedByItemId` |
| 12 | `SalesOrderItemModifier` | — (hereda vía `orderItemId`) | `orderItemId`, `modifierId` |
| 13 | `SalesOrderPayment` | — (hereda vía `salesOrderId`) | `salesOrderId` |
| 14 | `TableTransfer` | — (hereda vía `openTabId`) | `openTabId`, `fromWaiterId`, `toWaiterId`, `fromTableId`, `toTableId`, `authorizedByWaiterId`, `authorizedByUserId` — **5 FKs branch-scoped en un solo row, todas deben ser misma branch** |
| 15 | `CashRegister` | **nada** — sin `branchId` hoy. **DEUDA DE BACKFILL.** | `openedById`, `closedById` |
| 16 | `Expense` | **nada** — sin `branchId` hoy. **DEUDA DE BACKFILL.** | `categoryId` (TENANT), `createdById` |
| 17 | `AccountPayable` | **nada** — sin `branchId` hoy. **DEUDA DE BACKFILL.** Consolidación por tenant vía `getConsolidatedPayables(tenantId)` server action (R4); no duplicar en TENANT. | `supplierId` (TENANT), `purchaseOrderId`, `createdById` |
| 18 | `AccountPayment` | — (hereda vía `accountPayableId`) | `accountPayableId`, `createdById` |
| 19 | `PurchaseOrder` | **nada** — sin `branchId` hoy. **DEUDA DE BACKFILL.** | `supplierId`, `createdById`, `receivedById` |
| 20 | `PurchaseOrderItem` | — (hereda vía `purchaseOrderId`) | `purchaseOrderId`, `inventoryItemId` |
| 21 | `InvoiceCounter` | `channel @unique` — **debe pasar a `(tenantId, branchId, channel)`**. Motivo: en Venezuela la numeración fiscal es por sede. | — |
| 22 | `GameStation` | `branchId` (nullable) | `gameTypeId` → **GLOBAL** |
| 23 | `Reservation` | — (hereda vía `stationId`) | `stationId`, `wristbandPlanId` (TENANT), `createdById` |
| 24 | `GameSession` | — (hereda vía `stationId`) | `stationId`, `gameTypeId` → **GLOBAL**, `reservationId`, `salesOrderId`, `startedById`, `endedById` |
| 25 | `QueueTicket` | — (hereda vía `stationId`) | `stationId`, `gameTypeId` → **GLOBAL** |
| 26 | `InventoryCycle` | `areaIds` como JSON string | `createdById`, `closedById`. El ciclo se ejecuta desde una sucursal aunque abarque varias áreas. |
| 27 | `InventoryLoan` | **nada** — sin `branchId` hoy. **DEUDA DE BACKFILL.** | **R2 (estructura híbrida):** `tenantId` obligatorio, `fromBranchId` obligatorio, `toBranchId` nullable (intra-tenant cross-branch), `externalLoaneeName` nullable (texto libre para préstamo a negocio ajeno). **Constraint semántico:** exactamente uno de `{toBranchId, externalLoaneeName}` debe estar poblado. |
| 28 | `InventoryAudit` | `areaId` nullable | **R3: reclasificado de AREA → BRANCH.** `areaId` queda nullable como **filtro opcional** (auditorías por área específica o branch-wide). FK: `areaId`, `createdById`, `resolvedById` |
| 29 | `IntercompanySettlement` | `fromBranchId`, `toBranchId` | **Ambas FKs deben resolverse al mismo tenant-padre** (decisión #8: intra-tenant). |
| 30 | `IntercompanySettlementLine` | — (hereda vía `settlementId`) | `settlementId`, `menuItemId` (string), `inventoryItemId` (string) |
| 31 | `IntercompanyItemMapping` | `fromBranchId`, `toBranchId` | `menuItemId`, `sourceInventoryItemId` (string) — también intra-tenant. |

## 4. Modelos AREA-SCOPED

`tenantId` + `branchId` + `areaId` obligatorios. Datos físicos
granulares: stock físico, movimientos, producción.

| # | Modelo | Requiere | FK críticas |
|---|---|---|---|
| 1 | `Area` | `tenantId`, `branchId` (el row **es** el área; `branchId` hoy nullable → pasa a NOT NULL) | — |
| 2 | `AreaCriticalItem` | `tenantId`, `branchId`, `areaId` | `areaId`, `inventoryItemId` (TENANT catálogo) |
| 3 | `InventoryLocation` | `tenantId`, `branchId`, `areaId` | `inventoryItemId` (TENANT), `areaId` |
| 4 | `InventoryMovement` | `tenantId`, `branchId`, `areaId` | `inventoryItemId`, `salesOrderId` (BRANCH), `loanId` (BRANCH), `areaId`, `createdById`; + strings sin FK: `productionOrderId`, `requisitionId`, `purchaseOrderId`, `auditId`, `proteinProcessingId` |
| 5 | `DailyInventory` | `tenantId`, `branchId`, `areaId` | `areaId`, `closedById` |
| 6 | `DailyInventoryItem` | (hereda vía `dailyInventoryId`) | `dailyInventoryId`, `inventoryItemId` |
| 7 | `InventoryAuditItem` | (hereda vía `auditId` — cuya audit es BRANCH post-R3, pero el row no tiene `areaId` ni `branchId` propios; hereda scope via parent) | `auditId`, `inventoryItemId` |
| 8 | `Requisition` | `tenantId`, `branchId` (todas las áreas src/target deben ser misma branch) | `targetAreaId`, `sourceAreaId`, `requestedById`, `processedById`, `dispatchedById`, `receivedById` |
| 9 | `RequisitionItem` | (hereda vía `requisitionId`) | `requisitionId`, `inventoryItemId` |
| 10 | `ProteinProcessing` | `tenantId`, `branchId`, `areaId` | `sourceItemId`, `supplierId`, `areaId`, `parentProcessingId`, `createdById`, `completedById` |
| 11 | `ProteinSubProduct` | (hereda vía `processingId`) | `processingId`, `outputItemId` |
| 12 | `ProductionOrder` | `tenantId`, `branchId`, `areaId` — **hoy schema no tiene ni `branchId` ni `areaId`**. **DEUDA DE BACKFILL:** agregar ambos campos; backfill con valores del único tenant real (Shanklish Caracas, área "cocina principal"). (R5) | `recipeId` (TENANT), `createdById` |
| 13 | `InventoryCycleSnapshot` | (hereda vía `cycleId`; `areaId` ya existe) | `cycleId`, `inventoryItemId`, `areaId`, `countedById` |

## 5. Modelos SHARED

| # | Modelo | Diseño propuesto |
|---|---|---|
| 1 | `User` | Tabla `User` conserva identidad global: `email` (único global), `password`, `firstName`, `lastName`, metadatos de cuenta. Se eliminan `pin` y `role` de la tabla raíz. **Columnas nuevas para Platform Admin:** `isPlatformAdmin` (boolean, default false), `platformRole` (nullable: `PLATFORM_OWNER` \| `PLATFORM_SUPPORT`), `defaultTenantId` (nullable, skip del selector al login). Dos pivotes nuevas en Fase 3.0.B: **`UserTenant(userId, tenantId, role, pin?, grantedPerms, revokedPerms, isActive, joinedAt, deletedAt)`** con rol de grupo (OWNER/TENANT_ADMIN/MULTI_BRANCH_MANAGER) y PIN per-tenant; y **`UserBranch(userId, branchId, tenantId, role, isActive)`** con rol operativo por sucursal (BRANCH_MANAGER/CASHIER/WAITER). Todo FK `User.id` desde tablas tenant/branch-scoped debe validar **membresía activa** en el `tenantId`/`branchId` del row — afecta ~40 relaciones en el schema actual (`createdById`, `openedById`, `closedById`, etc.). |

## 6. Platform Admin Panel

Panel de administración del SaaS Cápsula usado por los fundadores y
staff de Cápsula, **distinto del panel de cada tenant**.

### 6.1 Niveles de panel

Cápsula tiene 4 niveles de interfaz:

1. **Platform Admin** — Cápsula (Omar, Gustavo, staff futuro). Gestiona
   el SaaS, los tenants, facturación.
2. **Tenant Admin** — dueño del restaurante (grupo completo). Gestiona
   branches, users, menú maestro, planes suscritos.
3. **Branch Admin** — gerente de sucursal. Gestiona waiters, mesas,
   arqueo, ventas de SU sucursal.
4. **POS** — cajero, mesonero. Opera el turno.

Fase 3 construye todos: Platform, Tenant, Branch. POS ya existe.

### 6.2 Acceso a Platform Admin

**Fase 3 (hoy, Q1):** mismo dominio, flag `isPlatformAdmin=true` en
`User`. UI detecta el flag y muestra menú extra "Platform".

**Fase 4+ (futuro):** subdominio separado `admin.capsulapp.com`.
Detonante: primer empleado de Cápsula no-founder, o >10 tenants.

### 6.3 Features del Platform Admin Panel

#### MVP Fase 3 (SE CONSTRUYE)

1. **Lista de tenants** — todos los clientes con status (activo,
   suspendido, trial, churned).
2. **Crear tenant nuevo** — onboarding: datos del negocio, plan
   asignado, primer usuario OWNER, subdominio (placeholder si no hay
   DNS aún).
3. **Suspender/reactivar tenant** — falta de pago, soporte temporal.
4. **Gestión de planes** — CRUD de `Plan` y qué `TenantModule`s incluye
   cada uno (vía `PlanModule`).
5. **Toggle manual de módulos por tenant** — override comercial a
   nivel individual.
6. **Impersonation** — platform admin "entra como" un user de un
   tenant para soporte. Log obligatorio en `ImpersonationSession`.
7. **Gestión de platform users** — quién es platform admin, con qué
   rol (OWNER vs SUPPORT).

#### Hibernando Fase 3 (schema listo, UI pospuesta)

8. Dashboard de métricas de plataforma (MRR, churn, uso).
9. Platform audit log UI (schema existe, UI después).
10. Platform broadcasts (schema existe, UI después).
11. Feature flags por tenant.

#### Lejanas (Fase 5+)

12. Billing automatizado (Stripe integration).
13. Analytics por tenant.
14. Support ticketing.
15. Developer console (API keys, webhooks).

### 6.4 Roles de plataforma

| Rol | Capacidades |
|---|---|
| `PLATFORM_OWNER` | Todo: crear/eliminar tenants, suspender, planes, audit, gestionar platform users, impersonation. **Omar** tiene este rol. |
| `PLATFORM_SUPPORT` | Impersonation, lectura de dashboards, **NO** crear/eliminar/suspender tenants, **NO** modificar planes. **Gustavo** arranca con este rol. |

Promoción de `SUPPORT` → `OWNER` requiere **query manual** de un
`OWNER` existente (no hay self-service). Esto evita errores caros
accidentales mientras Cápsula es chica.

### 6.5 Impersonation — diseño de seguridad

- Toda impersonation queda en `ImpersonationSession`: quién inició,
  a qué user impersonó, en qué tenant, timestamp start/end, reason.
- Durante impersonation, el user "real" que realiza acciones es el
  platform admin; el user "impersonado" es contextual.
- En audit logs, las acciones durante impersonation se marcan como
  `performedByImpersonator=true` con **ambos user IDs**.
- Session de impersonation tiene **timeout máximo** (p.ej. 4 horas)
  para forzar intervenciones cortas.
- Un `PLATFORM_SUPPORT` **no puede impersonar a un user con rol
  `OWNER`** de un tenant sin aprobación adicional (flujo de 2 pasos
  futuro; en Fase 3 MVP permitido con log).

### 6.6 Usuario Omar post-refactor (Q3)

`admin@capsulapp.com` queda con:

- `isPlatformAdmin = true`
- `platformRole = PLATFORM_OWNER`
- `UserTenant` en **Shanklish Caracas** con `role = OWNER`
- `UserTenant` en **Table Pong** con `role = OWNER`

Al loggear, el selector muestra tres opciones: **Platform** /
**Shanklish Caracas** / **Table Pong**. Se puede setear
`defaultTenantId` para saltar el selector si es solo operador de
un tenant (no aplica a Omar).

## 7. Relaciones cross-scope críticas (top 10)

Orden = prioridad de validar. Cada fila indica el riesgo: **cross-T**
(cruza tenants), **cross-B** (cruza branches del mismo tenant),
**jerárquico** (rompe la cadena tenant→branch→area).

| # | Relación | Riesgo | Por qué es crítica |
|---|---|---|---|
| 1 | `SalesOrderItem.menuItemId` → `MenuItem.id` | cross-T + cross-B | Volumen altísimo. Fallo cross-T = venta de menú ajeno. Fallo cross-B con `MenuItem.scope=BRANCH` = vender ítem de otra sucursal del mismo grupo (precio incorrecto, inventario incorrecto). |
| 2 | `InventoryMovement.inventoryItemId` + `areaId` → ... | jerárquico | El movimiento carga al `areaId` del tenant/branch correcto. Cadena rota = stock se descuenta en área ajena. |
| 3 | `SalesOrder.{branchId, areaId}` → `Branch` / `Area` | jerárquico | Ancla de la orden. `branchId` y `areaId` deben pertenecer al mismo tenant; `areaId` debe pertenecer al `branchId` dado. |
| 4 | `InventoryMovement.salesOrderId` → `SalesOrder.id` | cross-B | `SalesOrder` es BRANCH-scoped y `InventoryMovement` es AREA-scoped; la venta de branch A no puede mover stock de un área de branch B. |
| 5 | `Requisition.{targetAreaId, sourceAreaId}` → `Area.id` | cross-B + cross-T | Dos FKs al mismo tipo. Deben ser **mismo tenant + misma branch** (las requisiciones son intra-branch por diseño). Sin restricción, tres niveles de leak posible. |
| 6 | `RecipeIngredient.ingredientItemId` + `Recipe.outputItemId` → `InventoryItem.id` | cross-T | Recetas tenant-scoped no pueden referenciar ingredientes de otro tenant (costo y descargo contaminan ambos). |
| 7 | `PurchaseOrderItem.inventoryItemId` → `InventoryItem.id` | cross-T | Compra que actualiza stock/costo del catálogo correcto. `PurchaseOrder` es BRANCH-scoped pero `InventoryItem` es TENANT — coherente siempre que el tenant coincida. |
| 8 | `OpenTab.{tableOrStationId, serviceZoneId, branchId}` + `OpenTabOrder.salesOrderId` + `SubAccountItem.salesOrderItemId` | cross-B | Todo el árbol de POS (tab + órdenes + subcuentas + splits) debe cerrarse sobre la misma branch. Mezclar branches del mismo tenant envenena el cierre contable. |
| 9 | `TableTransfer` — 5 FKs branch-scoped en un solo row (`openTabId`, `fromWaiterId`, `toWaiterId`, `fromTableId`, `toTableId`) | cross-B | Todas deben ser **misma branch**. Un transfer cross-branch no tiene semántica válida. |
| 10 | `IntercompanySettlement.{fromBranchId, toBranchId}` + `IntercompanyItemMapping.{fromBranchId, toBranchId}` | cross-T (bloquear) | Decisión #8: intra-tenant. Validar que **ambas branches resuelven al mismo `tenantId`**; si una está en otro tenant, rechazar. |

### Casos honorable-mention

- **`MenuItem.sourceBranchId`** — string sin FK; flag de intercompany.
  Igual que el top 10: intra-tenant.
- **`AuditLog.{userId, entityId}`** — strings sin FK; el aislamiento
  depende 100% del código de aplicación. Add `tenantId`.
- **`InventoryCycle.areaIds` (JSON)** — cada ID del array debe validar
  mismo tenant + misma branch que el ciclo. Candidato fuerte a
  convertirse en pivote `InventoryCycleArea`.
- **`InventoryLoan.toBranchId` vs `externalLoaneeName` (R2)** — XOR
  aplicativo: validar en server action que exactamente uno está
  poblado; si toBranchId, validar mismo tenant.

## 8. Campos proto-tenant y proto-branch en schema actual

| Campo | Modelo(s) | Nota |
|---|---|---|
| `branchId` | `Area` (nullable), `SalesOrder` (nullable), `Waiter`, `ServiceZone`, `TableOrStation`, `OpenTab`, `GameStation` (nullable) | **Proto-branch actual**. Útil — lo conservamos y promovemos a NOT NULL donde proceda. |
| `sourceBranchId` | `MenuItem` (nullable, string sin FK) | Flag intercompany "este ítem viene de otro negocio". Se mantiene para intra-tenant. |
| `fromBranchId` / `toBranchId` | `IntercompanySettlement`, `IntercompanyItemMapping` | Cross-branch intra-tenant (decisión #8). Validar mismo tenant. |
| `areaId` | `InventoryLocation`, `InventoryMovement`, `DailyInventory`, `InventoryAudit` (nullable post-R3: filtro opcional), `ProteinProcessing`, `AreaCriticalItem`, `InventoryCycleSnapshot`, `Requisition` (targetAreaId + sourceAreaId), `SalesOrder` (nullable) | **Proto-area** ya bastante modelado. Faltan `branchId`/`tenantId` arriba para cerrar la jerarquía. |
| `tenantId` | **No existe aún** | Trabajo de Fase 3.0.B+. Proto-tenant **no hay** — la jerarquía actual es plana. |
| `companyId`, `warehouseId`, `organizationId` | No existen | No hay proto-tenant oculto. |

**Lectura.** El schema ya modela "multi-branch" pero `Branch` vive al
mismo nivel del restaurante, sin organización arriba. Shanklish
Caracas y Table-Pong son hoy rows de la misma tabla `Branch`. Fase
3.0.B agrega la capa `Tenant` arriba y reclasifica `Branch` como
"hija de un tenant".

## 9. Tablas nuevas a crear en Fase 3.0.B

Schema de multi-tenancy + Platform Admin. **14 tablas nuevas**
agrupadas en 6 subsecciones.

### 9.1 Core multi-tenancy (6 tablas)

| # | Tabla | Scope | Campos clave |
|---|---|---|---|
| 1 | `Tenant` | raíz | `id`, `name`, `rif`, `ownerEmail`, `planId`, `status` (active/suspended/trial/churned), `createdAt`, `suspendedAt`, `suspendedReason`. Organización que paga la suscripción. |
| 2 | `TenantModule` | TENANT | `tenantId`, `moduleKey`, `enabledAt`, `expiresAt` (nullable para trials). Qué módulos tiene activos cada tenant (inventario, delivery, juegos, etc.). |
| 3 | `Plan` | GLOBAL | `id`, `name`, `price`, `priceCurrency`, `description`, `isActive`. Definición de planes comerciales (Basic, Pro, Enterprise). |
| 4 | `PlanModule` | GLOBAL | `planId`, `moduleKey`. Pivote Plan ↔ moduleKey. Qué módulos trae cada plan por default. |
| 5 | `TenantConfig` | TENANT | `tenantId`, `key`, `value`, `updatedAt`, `updatedBy`. Configuración key-value per-tenant (payment_methods, delivery_fees, tax_rate). Reemplaza la parte tenant-specific del actual `SystemConfig`. |
| 6 | `PlatformConfig` | GLOBAL | `key`, `value`, `updatedAt`, `updatedBy`. Configuración key-value de la plataforma Cápsula misma (maintenance_mode, feature flags globales). Reemplaza la parte platform-wide del actual `SystemConfig`. |

### 9.2 User management (2 tablas)

| # | Tabla | Scope | Campos clave |
|---|---|---|---|
| 7 | `UserTenant` | pivote SHARED | `userId`, `tenantId`, `role` (OWNER/TENANT_ADMIN/MULTI_BRANCH_MANAGER), `grantedPerms`, `revokedPerms`, `pin`, `isActive`, `joinedAt`, `deletedAt`. Membresía de User en Tenant con rol a nivel organización. |
| 8 | `UserBranch` | pivote SHARED | `userId`, `branchId`, `tenantId` (denormalizado para filtros rápidos), `role` (BRANCH_MANAGER/CASHIER/WAITER), `isActive`. Rol operativo de User en Branch. |

### 9.3 Broadcasts (1 tabla + rename)

| # | Tabla | Scope | Campos clave |
|---|---|---|---|
| 9 | `PlatformBroadcast` | GLOBAL | `id`, `title`, `body`, `type`, `targetTenantIds` (nullable: null = todos), `startsAt`, `expiresAt`, `createdByPlatformUserId`. Anuncios de Cápsula a todos los tenants (mantenimiento, features nuevas). |

El modelo actual `BroadcastMessage` **se renombra a `TenantBroadcast`**
con `tenantId` agregado + `branchId?` opcional para anuncios
branch-específicos.

### 9.4 Scope flexible overrides (3 tablas)

| # | Tabla | Scope | Campos clave |
|---|---|---|---|
| 10 | `MenuItemBranch` | BRANCH | `menuItemId`, `branchId`, `tenantId`, `isEnabled`, `priceOverride` (nullable), `stockAvailable`. Override por sucursal de `MenuItem` scope=TENANT. |
| 11 | `SupplierPriceOverride` | BRANCH | `supplierItemId`, `branchId`, `tenantId`, `priceOverride`, `notes`. Override de precios de `SupplierItem` por sucursal. |
| 12 | `WristbandPlanBranch` | BRANCH | `wristbandPlanId`, `branchId`, `tenantId`, `priceOverride` (nullable), `inclusionsOverride` (JSON nullable), `isEnabled`. Override de `WristbandPlan` por sucursal (R1). |

### 9.5 Platform Admin (2 tablas)

| # | Tabla | Scope | Campos clave |
|---|---|---|---|
| 13 | `PlatformAuditLog` | GLOBAL | `id`, `platformUserId`, `action`, `targetTenantId` (nullable), `targetEntityType`, `targetEntityId`, `payload` (JSON), `timestamp`. Log de acciones hechas por platform admins. Separado de `AuditLog` per-tenant. |
| 14 | `ImpersonationSession` | GLOBAL | `id`, `platformUserId`, `impersonatedUserId`, `tenantId`, `startedAt`, `endedAt` (nullable), `reason` (texto libre opcional), `timeoutAt`. Registro de sesiones de impersonation. |

### 9.6 Columnas agregadas a `User`

No son tabla nueva, pero son columnas nuevas:

- `isPlatformAdmin` — boolean, default `false`.
- `platformRole` — nullable string: `null` | `"PLATFORM_OWNER"` | `"PLATFORM_SUPPORT"`.
- `defaultTenantId` — nullable string, útil para skip del selector al login.

## 10. Decisiones resueltas (resolución v3)

Las 10 decisiones originales de v1 quedaron resueltas en v2 (ver
Changelog v2). Las 6 residuales que quedaron abiertas en v2 (R1-R6)
más una decisión adicional de Omar (M7) y tres de Platform Admin
(Q1-Q3) quedan resueltas acá.

- **R1. `WristbandPlan` — RESUELTA.** TENANT-SCOPED. Los planes son
  producto del grupo. Overrides de precio/inclusiones por sucursal
  vía tabla puente `WristbandPlanBranch` (Fase 3.0.B, patrón
  idéntico a `MenuItemBranch`).

- **R2. `InventoryLoan` — RESUELTA.** BRANCH-SCOPED con flexibilidad
  interna/externa. `tenantId` obligatorio; `fromBranchId` obligatorio;
  `toBranchId` nullable (intra-tenant cross-branch); `externalLoaneeName`
  nullable (texto libre para préstamo externo). **Constraint
  semántico:** exactamente uno de `{toBranchId, externalLoaneeName}`
  debe estar poblado (validación aplicativa).

- **R3. `InventoryAudit` — RESUELTA.** Reclasificado de AREA-SCOPED a
  BRANCH-SCOPED. `areaId` queda nullable como **filtro opcional**
  (audit branch-wide o area-específica). Distribución cambia: AREA
  14 → 13, BRANCH 30 → 31.

- **R4. `AccountPayable`/`AccountPayment` — RESUELTA.** Quedan
  BRANCH-SCOPED. La consolidación del grupo se resuelve en server
  actions agregados (`getConsolidatedPayables(tenantId)`,
  `getConsolidatedPayments(tenantId)`). **No duplicar datos en
  TENANT**, no materializar agregados.

- **R5. `ProductionOrder` — RESUELTA.** Clasificar como AREA-SCOPED.
  Hoy carece de `branchId` y `areaId`. Durante Fase 3 implementación,
  backfill con valores del único tenant real (Shanklish Caracas,
  área "cocina principal"). **Mismo backfill** aplica a todas las
  tablas marcadas "DEUDA DE BACKFILL" en §3: `CashRegister`,
  `Expense`, `AccountPayable`, `PurchaseOrder`, `InventoryLoan`.

- **R6. `MenuItemModifierGroup` — RESUELTA.** Scope flexible heredado.
  El pivote **tiene el mismo scope que su `MenuItem` padre**. Si
  `MenuItem` es `scope=BRANCH`, el pivote es BRANCH-efectivo; si
  `scope=TENANT`, es TENANT. El row no carga `ownerBranchId` propio;
  se deriva. Total de modelos con scope flexible en TENANT-SCOPED
  sube a **3** (`MenuItem`, `MenuModifier`, `MenuItemModifierGroup`).

- **M7. `MenuCategory` (decisión adicional) — RESUELTA.** Queda
  TENANT-SCOPED puro, **NO flexible**. Las categorías son estructura
  del menú del grupo. Items `scope=BRANCH` (experimentales de una
  sucursal) deben usar categorías existentes del maestro tenant.
  Si una sucursal necesita categoría nueva, la pide al dueño.

- **Q1. Separación Platform Admin — RESUELTA.** Fase 3: mismo
  dominio, flag `isPlatformAdmin` en `User`. Fase 4+: subdominio
  separado `admin.capsulapp.com` cuando haya >10 tenants o primer
  empleado no-founder. (Ver §6.2.)

- **Q2. Impersonation — RESUELTA.** SÍ en MVP de Fase 3. Platform
  admins con rol suficiente pueden "entrar como" cualquier usuario
  de cualquier tenant para soporte. Log obligatorio en
  `ImpersonationSession`. (Ver §6.5.)

- **Q3. Usuario Omar post-refactor — RESUELTA.** `admin@capsulapp.com`
  queda con `isPlatformAdmin=true`, `platformRole=PLATFORM_OWNER`,
  `UserTenant` en Shanklish y Table Pong con `role=OWNER`. Selector
  al login muestra tres opciones: Platform / Shanklish / Table Pong.
  (Ver §6.6.)

**Ninguna decisión abierta residual al cerrar Fase 3.0.A.v3.**

## 11. Principios de construcción de Fase 3

Disciplina que rige decisiones de alcance durante Fase 3
implementación.

### 11.1 Arquitectura flexible hoy, features cuando las pidan clientes

- **Arquitectura (schema, tablas, relaciones, FK):** se construye
  completa ahora. Todas las 14 tablas nuevas de §9 se crean aunque
  algunas no tengan UI todavía.
- **UI pragmática:** solo construimos interfaces para lo que
  Shanklish Caracas y Table Pong van a usar realmente.
- **Features hibernando:** schema disponible, UI deferida hasta que
  un cliente real lo pida con razón de negocio.

### 11.2 Regla de decisión futura

Cuando durante implementación aparezca un tradeoff entre:

- **A) Flexibilidad arquitectónica barata** (ej. un campo nullable,
  una tabla pivote, un scope flag).
- **B) Feature costosa ahora** (ej. UI completa, flujo de usuario,
  integración compleja).

Siempre se elige **A**. La opción **B** solo se construye cuando un
cliente real lo pide con valor comercial claro.

### 11.3 Excepciones a la regla

Hay excepciones legítimas a "features cuando las pidan":

- **Platform Admin Panel (Fase 3 MVP):** infraestructura que Cápsula
  necesita para operar su propio negocio. No es feature de cliente,
  es herramienta operativa interna.
- **Impersonation:** habilita todo el soporte a clientes. Sin ella,
  el soporte es imposible o inseguro.
- **Selector de tenant al login:** Omar es OWNER de 2 tenants desde
  día 1. Sin selector no puede operar.

Estas son "features" pero son **fundacionales**, no especulativas.

## 12. Features en hibernación (schema listo, UI pospuesta)

Features cuyo schema existe en §9 pero cuya UI **no se construye en
Fase 3**. Se desbloquean individualmente cuando un cliente real las
justifique.

| # | Feature | Schema | UI Fase 3 | Desbloqueo cuando... |
|---|---|---|---|---|
| 1 | Items `scope=BRANCH` experimentales | `MenuItem` con scope flag + `ownerBranchId` | NO | Shanklish o Table Pong quiera plato exclusivo de una sucursal |
| 2 | Loans externos a negocios vecinos | `InventoryLoan.externalLoaneeName` | NO | Caso operativo real reportado |
| 3 | `WristbandPlanBranch` overrides | Tabla `WristbandPlanBranch` | NO | Table Pong tenga 2+ branches con precios distintos |
| 4 | `SupplierPriceOverride` per branch | Tabla `SupplierPriceOverride` | NO | Shanklish tenga 2+ branches negociando precios distintos |
| 5 | Categorías a nivel branch | Decisión M7: NO hay schema, queda TENANT | NO | Cliente con caso fuerte contra-argumenta M7 |
| 6 | Platform: Dashboard de métricas (MRR, churn) | Queries sobre `Tenant`/`Plan` | NO | >3 tenants activos, necesidad de visibilidad |
| 7 | Platform: Broadcasts UI | Tabla `PlatformBroadcast` | NO | Primer mantenimiento/anuncio masivo requerido |
| 8 | Platform: Feature flags granulares | Requiere tabla adicional, no está en §9 | NO | Necesidad de beta-testing con clientes selectos |

Cada entrada aquí es un contrato entre Omar y su futuro yo: "este
trabajo está diseñado arquitectónicamente pero no construido
completamente; sé lo que falta si algún día hace falta."

## 13. Notas de riesgo para la implementación

### 13.1 Filtro a tres niveles en cada query

Cada query necesita decidir **a qué nivel filtrar**:
- Tenant-scoped: `WHERE tenantId = :x`
- Branch-scoped: `WHERE tenantId = :x AND branchId = :y`
- Area-scoped: `WHERE tenantId = :x AND branchId = :y AND areaId = :z`

Un error común: filtrar solo por `areaId` confiando en que el área es
única, pero la unicidad solo aplica dentro de una branch. Las queries
deben componer la jerarquía completa o confiar en joins que ya la
cargan.

### 13.2 UI progresiva (branch count)

Tenants con **1 branch** deben ver la UI simplificada (sin selector
de sucursal, sin reports cross-branch). Tenants con **N branches**
ven selector y vistas consolidadas. Detectar vía `tenant.branchCount`
y mostrar/ocultar. Riesgo: ocultar UI sin aplicar el filtro en el
server action (el selector oculto no protege — el server action debe
validar independientemente).

### 13.3 Queries consolidados para dueños de cadena

El rol `OWNER` en `UserTenant` debe poder ver sumas cross-branch
(ventas totales, deuda total, inventario total por SKU). Estos
queries cruzan N branches pero deben quedar **dentro del tenant**.
Riesgo: un query consolidado que accidentalmente no filtra `tenantId`
devuelve data cross-tenant. Todo endpoint consolidado debe iniciar
con `WHERE tenantId = :currentTenant`.

### 13.4 Costo de testing: cada feature en 2 modos

Cada feature debe probarse en **modo 1-branch** (UI simple, sin
selector) y **modo N-branches** (UI completa, selector obligatorio,
consolidados). Dos fixtures distintas. Agregar esto al plan de QA
de 3.1/3.2.

### 13.5 Intercompany redefinido

Con decisión #8, `IntercompanySettlement` deja de ser cross-tenant y
pasa a ser **intra-tenant cross-branch**. Consecuencias:
- La validación de aislamiento se relaja: las dos branches están en
  el mismo tenant (no hace falta acuerdo bilateral).
- Pero se endurece la validación de **no salir del tenant**: si
  alguien intenta liquidar con una branch de otro tenant, rechazar.
- El mapping intercompany de items (`IntercompanyItemMapping`) sigue
  su lógica actual, solo añade validación de mismo-tenant.

### 13.6 FKs como `String` sin `@relation`

Igual que v1/v2 (los campos no cambiaron):
- `InventoryMovement.{productionOrderId, requisitionId, purchaseOrderId, auditId, proteinProcessingId}` — todos string.
- `MenuItem.recipeId`, `MenuItem.sourceBranchId` — string.
- `AuditLog.{userId, entityId}` — polimórfico.
- `InventoryCycle.areaIds` — JSON string.
- `BroadcastMessage.createdById`, `BroadcastMessage.targetRoles`.
- `IntercompanySettlementLine.{menuItemId, inventoryItemId}`.
- `IntercompanyItemMapping.sourceInventoryItemId`.

Post-tenancy: validar en server action o convertir a FKs reales.

### 13.7 Unique constraints que rompen con tenant

Constraints que pasan a compuestas `(tenantId, …)` o
`(tenantId, branchId, …)` según scope:

**Pasan a `(tenantId, …)`:**
- `InventoryItem.sku`, `Supplier.code`, `MenuItem.sku`,
  `ProductionOrder.orderNumber`, `ProteinProcessing.code`,
  `Requisition.code`, `ProductFamily.code`, `ExpenseCategory.name`,
  `InventoryCycle.code`.

**Pasan a `(tenantId, branchId, …)`:**
- `PurchaseOrder.orderNumber`, `SalesOrder.orderNumber`,
  `OpenTab.tabCode`, `IntercompanySettlement.code`,
  `GameStation.code`, `Reservation.code`, `GameSession.code`,
  `InvoiceCounter.channel` — clave `(tenantId, branchId, channel)`.

**Se queda unique global:**
- `GameType.code` — GLOBAL.
- `User.email` — identifica a la persona (SHARED).
- `WristbandPlan.code` — TENANT post-R1; pasa a `(tenantId, code)`.

**Compuestos existentes que mutan:**
- `TableOrStation @@unique([branchId, code])` → agregar `tenantId`
  por defensa en profundidad, aunque `branchId` ya implica tenant.
- `ServiceZone @@unique([branchId, name])` → ídem.
- Resto de `@@unique([xId, yId])` donde ambos son tenant-scoped —
  revisar caso por caso.

### 13.8 Soft delete + tenant/branch

`deletedAt`/`deletedById` en muchos modelos. `deletedById` referencia
`User` (SHARED); cuando se use, validar membresía en el tenant/branch
del row borrado.

### 13.9 Volumen / costo de migración

Tablas caras de migrar (ADD COLUMN + backfill + índices compuestos):
- `AuditLog` — la más grande; migración en batches.
- `InventoryMovement` — alto volumen.
- `SalesOrderItem` + `SalesOrderItemModifier` + `SalesOrderPayment`.
- `OpenTabOrder`, `PaymentSplit`, `SubAccountItem` — crecen con POS.

Propuesta operacional (Fase 3.1+): 2 pasos — (1) `ADD COLUMN tenantId`
(y `branchId`/`areaId` según scope) con default temporal del
tenant/branch actual; (2) `NOT NULL + FK + índices compuestos`. No
bloquear escrituras durante (1).

### 13.10 RLS a nivel Postgres — fuera de scope

Igual que v1/v2. Evaluar en Fase 3.2/3.3 como segunda línea de
defensa; primero funcionar con filtro aplicativo.

### 13.11 NULL semántico en campos nuevos

`Area.branchId`, `SalesOrder.branchId`, `MenuItem.sourceBranchId`,
`GameStation.branchId` son nullable hoy. Post-3.0.B:
- `tenantId` **siempre NOT NULL** en todo modelo tenant/branch/area.
- `branchId` NOT NULL en modelos branch/area (se pobla por backfill).
- `areaId` NOT NULL en modelos area; **nullable en `InventoryAudit`**
  por R3 (filtro opcional, audit branch-wide o area-específica).
- `MenuItem.sourceBranchId` sigue nullable (solo intercompany).
- `Area.branchId` pasa a NOT NULL (un área sin branch no tiene
  sentido físico).

### 13.12 Riesgo de privilege escalation en Platform Admin

Todo platform user con rol `PLATFORM_SUPPORT` puede impersonar.
Garantizar que impersonation **no otorga capacidades de `OWNER`**
accidentalmente:

- Las acciones ejecutadas durante impersonation se evalúan con los
  permisos del **user impersonado**, no del platform admin.
- Un `SUPPORT` impersonando a un `CASHIER` tiene capacidades de
  `CASHIER`, no capacidades mezcladas.
- Un `SUPPORT` no puede auto-promoverse a `PLATFORM_OWNER` vía la
  UI — la promoción es query manual de un `OWNER` existente.
- El flag `isPlatformAdmin` sólo se modifica vía `PlatformAuditLog`
  (ninguna server action no-platform puede tocarlo).

### 13.13 Riesgo de cross-tenant data leak vía Platform queries

Server actions del Platform Admin deben marcarse **explícitamente**
con decorator `@platform` (o convención de naming `platform.*`) para
permitir queries sin `tenantId` filter; el filter normal debe seguir
siendo **default** en todo el resto del código.

- Toda query sin filtro de tenant que **no** esté dentro de un
  server action `@platform` es bug por construcción.
- CI/lint debe detectar uso de `findMany`/`findFirst` sin filtro de
  tenant en código no-platform (regla custom).
- `PlatformAuditLog` registra qué data se consultó en cada acción
  platform para trazabilidad forense.
