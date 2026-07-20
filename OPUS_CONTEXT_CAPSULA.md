# Documento de Contexto — Shanklish ERP / Cápsula SaaS
## Radiografía Completa del Sistema

> **Cómo leer este documento.** Las secciones **§1–§42** son la radiografía
> temática del sistema (identidad, datos, RBAC, módulos). A partir de **§43**
> el documento funciona como **changelog cronológico**: cada sección registra
> un bloque de trabajo con su fecha y PRs. Por eso algunos números aparecen
> fuera de secuencia física (ej. §51.B después de §54, §56 antes de §55) — es
> esperado; usá el índice de abajo para ubicarte. Última sincronización con
> `main`: **2026-06-15** (tip `7101fbd`).

### Índice cronológico del changelog (§43 en adelante)

| § | Fecha | Tema | PRs |
|---|---|---|---|
| §43–§45 | 2026-05-18→23 | Multi-tenant en producción · tenants · pre-flight onboarding | — |
| §46 | 2026-06 | Bug TAB-2433 — propina fantasma con descuentos | — |
| §47–§49 | 2026-06-06→07 | Historial cajera · CRM captura · POS Mesero 10%/propina · congruencia | #278 |
| §50–§53 | 2026-06-07 | Inventario Diario · conteo físico/rápido · WeeklyCount · modelo de capas | #279–#286 |
| §51.B / §51.C | 2026-06-07 | Variación semana vs semana · esqueleto Reportes | #283, #287 |
| §54 | 2026-06-07 | Auditoría seguridad npm (audit fix) | #288 |
| §55 | 2026-06-08→09 | Módulo Gestión de Deliverys (Fases 1–5 + Pieza C) | #290, #295 |
| §56 | 2026-06-09 | Tesorería / Conciliación Bancaria (Fases 0–4) | #291–#293 |
| §57 | 2026-06-09 | Documentos de Proveedor (facturas/notas de entrega) | #294 |
| §63 | 2026-06-09 | Recetas restaurante por tamaño · importador CSV | #298, #299 |
| §58–§59 | 2026-06-10 | Módulo Reportes (diagnóstico + FASE A/B) · puente de cuadre · cobrado secundario | #300–#302 |
| §60 | 2026-06-11 | BUG Promociones — fechas vencían un día antes (off-by-one TZ) | — |
| §61 | 2026-06-12 | Landing "Editorial" 2.0 — rebrand aislado de la home | #316 |
| §62 | 2026-06-15 | BUG Comanda delivery — items como string del bot n8n | — |

---

## 1. Identidad del Sistema

**Cápsula** (`kpsula.app`) es un SaaS POS + ERP **multi-tenant** para restaurantes
y entretenimiento, construido con Next.js 14 (App Router), Prisma ORM y
PostgreSQL. **Shanklish ERP** fue el sistema original (un solo restaurante) y hoy
es el tenant fundador; el producto que se vende es Cápsula.

### Tenants en producción (1 sola BD multi-tenant)

> Actualizado 2026-06: ya **no** hay instancias/BD separadas. Todos los clientes
> viven en una sola BD (`capsula_erp_prod` en VPS Contabo) aislados por
> `tenantId`. Para el listado vivo y el estado de cada tenant ver **§44**.

| Tenant | Negocio |
|--------|---------|
| Shanklish | Restaurante Shanklish Caracas (tenant fundador) |
| Table Pong | Sala de juegos / bar |
| Sello Criollo, Poke Pok, … | Onboarding posterior (ver §44/§45) |
| `demo` | Sandbox de prospectos (ver §44.3) |

La visión multi-tenant de §14 **ya está implementada** (ver §43–§45).

### Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 App Router, Server Actions, TypeScript |
| Base de datos | PostgreSQL self-hosted en VPS Contabo (`localhost:5433/capsula_erp_prod`) + Prisma ORM 5.10. **Versión a confirmar** (`SELECT version();` en el VPS) — el doc decía 18.3, la verificación local usó 16 |
| Autenticación | JWT custom con `jose` (sesiones 24h, cookie httpOnly) |
| UI | Tailwind CSS 3.4 + Radix UI primitives + Lucide icons |
| State management | Zustand 4.5 + React Query (TanStack) |
| Tablas | TanStack React Table 8.13 |
| Impresión | ESC/POS via `react-to-print` + CSS térmico 80mm |
| Excel | ExcelJS + XLSX |
| Búsqueda fuzzy | Fuse.js |
| OCR | Google Cloud Vision API |
| Validación | Zod |
| Charts | Recharts |
| Deploy app | **VPS Contabo** vía GitHub Actions SSH: `.github/workflows/ci.yml` descarga y corre `scripts/deploy-vps.sh` **versionado en el repo** (migrado del viejo `/root/deploy-capsula.sh` en PR #296). Vercel dormant pendiente apagar — ver §1.2. |
| Reverse proxy | nginx en VPS (termina SSL wildcard `*.kpsula.app` con Let's Encrypt) |
| DNS | Cloudflare (`kpsula.app` y `*.kpsula.app` → VPS) |
| Proceso runtime | pm2 con `node .next/standalone/server.js` |
| Backups BD | Cron diario 7am en VPS (`/usr/local/bin/capsula-backup.sh` → `/var/lib/postgresql/backups/`, retención 30 días). **Pendiente off-site copy.** |

### 1.2 Infraestructura productiva — fuente única de verdad (2026-05-18)

**Regla operativa (no negociable):** toda la stack de producción vive en el
**VPS Contabo**. BD, app server, reverse proxy, backups — todo en el mismo
host. AWS RDS quedó desconectado tras el cutover documentado en §18.43
(2026-05-08); el `.env.example` apunta a AWS RDS solo como referencia
histórica, no se carga en runtime. Cualquier dev/admin que vaya a crear
deploys nuevos, jobs, crons, backups o cualquier infra adicional → debe
ir al mismo VPS, no a otros providers.

| Pieza | Ubicación | Detalle |
|---|---|---|
| BD productiva | VPS Contabo `147.93.6.70:5433` (interno `localhost:5433`) | `capsula_erp_prod`, owner `capsula`, SSL self-signed `sslmode=require` |
| App Next.js | VPS Contabo, pm2 process | `/var/www/capsula-erp/.next/standalone/server.js` en `localhost:3000` |
| Reverse proxy | VPS Contabo, nginx | `*.kpsula.app` → SSL wildcard → `localhost:3000` |
| Cron jobs (outbox retry, backups) | VPS Contabo, crontab del root | Ver `crontab -l` |
| Deploy CI/CD | GitHub Actions → SSH al VPS | `.github/workflows/ci.yml` job `deploy`. Secrets: `CONTABO_HOST`, `CONTABO_USER`, `CONTABO_SSH_KEY` |
| Backups locales | VPS Contabo `/var/lib/postgresql/backups/` | Cron 7am, 30 días retención. **Falta: copia off-site.** |
| AWS RDS | **Desconectado** | Snapshot final pendiente bajar a S3/storage antes de terminate (ver pendientes §35) |
| Vercel | **Dormant** | Sigue corriendo pero ya nadie le pega tráfico desde el cutover de DNS. Apagado completo pendiente (ver pendientes §35) |

**Confirmado en VPS** (2026-05-18 con `grep DATABASE_URL /var/www/capsula-erp/.env`):
```
DATABASE_URL=postgresql://capsula:***@localhost:5433/capsula_erp_prod?sslmode=require
```
Sin variables `_REPLICA`, `_BACKUP`, ni referencias a `amazonaws` en el `.env` activo.

Para detalle completo del cutover histórico y razón de las decisiones, ver §18.43.

### Mapa de carpetas del proyecto
```
capsula-erp/
├── prisma/
│   └── schema.prisma              # 3479 líneas, 95 modelos (2026-06-15)
├── src/
│   ├── app/
│   │   ├── actions/               # 66 archivos .actions.ts (Server Actions)
│   │   ├── api/                   # 19 route.ts (REST, incl. /api/v1/delivery)
│   │   ├── dashboard/             # 85 páginas
│   │   ├── kitchen/               # cocina + barra
│   │   └── login/                 # Página de login
│   ├── components/
│   │   ├── layout/                # Navbar, Sidebar, ThemeToggle, NotificationBell, HelpPanel
│   │   ├── pos/                   # 6 componentes POS especializados
│   │   ├── ui/                    # 7 componentes UI base (Card, button, combobox, dialog...)
│   │   ├── users/                 # ChangePasswordDialog
│   │   └── *.tsx                  # 2 parsers WhatsApp (compras + órdenes)
│   ├── lib/
│   │   ├── constants/             # modules-registry.ts, roles.ts, permissions-registry.ts, units.ts
│   │   ├── auth.ts                # JWT encrypt/decrypt/session
│   │   ├── permissions.ts         # hasPermission() por nivel numérico
│   │   ├── audit-log.ts           # writeAuditLog() — tabla forense
│   │   ├── invoice-counter.ts     # Correlativos atómicos (REST-0101, DEL-0042...)
│   │   ├── pos-settings.ts        # POSConfig en localStorage por terminal
│   │   ├── print-command.ts       # Impresión térmica 80mm
│   │   ├── export-z-report.ts     # Generación Reporte Z Excel
│   │   ├── export-arqueo-excel.ts # Exportación arqueo de caja
│   │   ├── currency.ts            # Formateo moneda USD/Bs
│   │   ├── datetime.ts            # Utilidades fecha/hora Caracas
│   │   ├── soft-delete.ts         # Helpers para soft delete
│   │   └── prisma.ts              # Singleton PrismaClient
│   ├── server/
│   │   ├── db/index.ts            # PrismaClient export
│   │   └── services/
│   │       ├── inventory.service.ts   # Compras, ventas, ajustes de stock
│   │       ├── production.service.ts  # Órdenes de producción
│   │       └── cost.service.ts        # COGS recursivo por receta
│   └── types/
│       └── index.ts               # Tipos compartidos (User, InventoryItem, etc.)
├── middleware.ts                   # RBAC: protección /dashboard, redirect login
└── package.json
```

---

## 2. Arquitectura de Datos — 95 Modelos Prisma

> Conteo real al 2026-06-15: **95 modelos** (`grep -c '^model ' prisma/schema.prisma`).
> Casi todos llevan `tenantId` (multi-tenant, §43); las excepciones (InventoryMovement,
> PaymentSplit, TableTransfer, sub-líneas) se aíslan vía relación al padre.

### 2.1 Core (4 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **Tenant** | id, slug, name, legalName, taxId, displayName, logoUrl, featureFlags (JSON) | **Raíz multi-tenant.** Cada cliente de Cápsula es un Tenant; `slug` mapea al subdominio. `featureFlags` activa módulos opcionales (ej. deliveryOps) |
| **User** | id, email, passwordHash, pin, role, allowedModules, grantedPerms, revokedPerms, isActive, deletedAt, tenantId | Usuarios del sistema. 9 roles activos. `allowedModules` (JSON array nullable) filtra módulos por usuario; `grantedPerms`/`revokedPerms` (JSON arrays de PERM keys) amplían o restringen permisos del rol base |
| **Area** | id, name, branchId, isActive, deletedAt | Áreas/almacenes de trabajo (Cocina, Bodega, Barra, etc.) |
| **Branch** | id, code, name, legalName, timezone, currencyCode | Sucursal física. Relaciona zonas, mesas, mesoneros |

### 2.2 Inventario (18 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **InventoryItem** | sku (unique), name, type (RAW_MATERIAL/SUB_RECIPE/FINISHED_GOOD), baseUnit, category, minimumStock, reorderPoint, isCritical, isBeverage, beverageCategory, productFamilyId | Insumo/producto del inventario |
| **InventoryLocation** | inventoryItemId + areaId (unique), currentStock, lastCountDate | Stock actual de un item en un área específica |
| **InventoryMovement** | inventoryItemId, movementType, quantity, unit, unitCost, totalCost, areaId, salesOrderId, loanId, productionOrderId, requisitionId, purchaseOrderId, auditId, proteinProcessingId | Registro inmutable de todo movimiento. Tipos: PURCHASE, SALE, PRODUCTION_IN/OUT, ADJUSTMENT_IN/OUT, TRANSFER, WASTE |
| **CostHistory** | inventoryItemId, costPerUnit, currency, isCalculated, costBreakdown (JSON), effectiveFrom/To | Historial de precios unitarios |
| **DailyInventory** | date + areaId (unique), status (DRAFT/OPEN/CLOSED), totalVarianceValue | Cabecera del inventario diario por área |
| **DailyInventoryItem** | dailyInventoryId + inventoryItemId (unique), initialCount, finalCount, entries, sales, waste, theoreticalStock, variance, costPerUnit | Línea de conteo diario |
| **InventoryLoan** | inventoryItemId, loaneeName, quantity, type (REPLACEMENT/PAYMENT), status, agreedPrice | Préstamos de inventario entre negocios |
| **InventoryAudit** | status (DRAFT/APPROVED/REJECTED), areaId, effectiveDate | Auditoría de inventario |
| **InventoryAuditItem** | auditId + inventoryItemId, systemStock, countedStock, difference, costSnapshot | Línea de auditoría |
| **InventoryCycle** | code, cycleType (WEEKLY/MONTHLY/SPOT_CHECK), areaIds (JSON), status | Ciclo de conteo físico semanal/mensual |
| **InventoryCycleSnapshot** | cycleId + inventoryItemId + areaId (unique), countedStock, systemStock, difference | Snapshot de conteo en un ciclo |
| **AreaCriticalItem** | areaId + inventoryItemId (unique) | Items marcados como críticos por área |
| **WeeklyCount** | countNumber, countDate, principalAreaId, productionAreaId, status, appliedAt, tenantId | Conteo semanal como entidad (§51.A). Compara stock principal vs producción |
| **WeeklyCountItem** | weeklyCountId + inventoryItemId, sku, stockBeforePrincipal, qtyCountedPrincipal, variancePrincipal, stockBeforeProduction, qtyCountedProduction, varianceProduction | Línea de conteo semanal con varianza por área |
| **Requisition** | code, status, requestedById, sourceAreaId, targetAreaId, dispatchedAt, receivedAt, tenantId | Requisición/transferencia interna de stock entre áreas (genera movimientos TRANSFER) |
| **RequisitionItem** | requisitionId + inventoryItemId, quantity, sentQuantity, dispatchedQuantity, receivedQuantity | Línea de requisición |
| **InventoryDeductionRetry** | salesOrderId, payload (JSON), status, attempts, maxAttempts, lastError, nextRetryAt | Outbox de reintentos cuando el descuento de stock de una venta falla (no bloquea el cobro) |
| **ItemAvailability** | tenantId + branchId + itemLabel, available, updatedById | Toggle de "agotado/86" por ítem y sucursal (delivery/POS) |

### 2.3 Producción (5 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **Recipe** | name, outputItemId, outputQuantity, outputUnit, yieldPercentage, isApproved, version | Receta/ficha técnica |
| **RecipeIngredient** | recipeId + ingredientItemId (unique), quantity, unit, wastePercentage, sortOrder | Ingrediente de una receta |
| **ProductionOrder** | orderNumber (unique), recipeId, plannedQuantity, actualQuantity, status (DRAFT→COMPLETED), actualYieldPercentage, actualCost | Orden de producción/transformación |
| **ProteinProcessing** | code (unique), sourceItemId, frozenWeight, drainedWeight, totalSubProducts, wastePercentage, yieldPercentage, status, processingStep (LIMPIEZA/MASERADO/DISTRIBUCION), parentProcessingId (cadena), areaId, supplierId | Desposte y procesamiento de proteínas |
| **ProteinSubProduct** | processingId, outputItemId, name, weight, units, unitType, estimatedCost | Sub-producto resultante del procesamiento |

### 2.4 Plantillas de Procesamiento (2 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **ProcessingTemplate** | name, sourceItemId, processingStep, canGainWeight, chainOrder | Plantilla reutilizable para procesamiento de proteínas |
| **ProcessingTemplateOutput** | templateId + outputItemId (unique), expectedWeight, expectedUnits, isIntermediate | Output esperado en la plantilla |

### 2.5 Menú (6 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **MenuCategory** | name, sortOrder, isActive | Categoría del menú (Shawarmas, Bebidas...) |
| **MenuItem** | sku (unique), name, categoryId, price, cost, recipeId, pedidosYaPrice, pedidosYaEnabled, posGroup, posSubcategory, serviceCategory, kitchenRouting, isIntercompanyItem | Producto de venta |
| **MenuModifierGroup** | name, isRequired, minSelections, maxSelections | Grupo de modificadores (Acompañantes, Tamaño...) |
| **MenuModifier** | groupId, name, priceAdjustment, linkedMenuItemId, isAvailable | Opción modificadora (Tabulé, Extra queso...) |
| **MenuItemModifierGroup** | menuItemId + modifierGroupId (unique) | Pivote: qué grupos aplican a qué productos |
| **Promotion** | name, discountType, discountValue, maxDiscountPerUnit, startTime, endTime, startDate, endDate, priority, isActive, tenantId | Promoción/happy hour por horario y rango de fechas (§6.0). ⚠️ fechas: usar `caracasDateOnlyToDate` (§60) |

### 2.6 Ventas / POS (10 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **SalesOrder** | orderNumber (unique), orderType (RESTAURANT/DELIVERY), serviceFlow (DIRECT_SALE/OPEN_TAB/TAB_CLOSING), sourceChannel, status, kitchenStatus, subtotal, discount, total, discountType, paymentMethod, paymentStatus, exchangeRateValue, totalBs, areaId, branchId, serviceZoneId, tableOrStationId, openTabId | Orden de venta (central del POS) |
| **SalesOrderItem** | orderId, menuItemId, itemName (snapshot), unitPrice, quantity, lineTotal, costPerUnit, marginPerUnit | Línea de venta con snapshot de precio y margen |
| **SalesOrderItemModifier** | orderItemId, modifierId, name (snapshot), priceAdjustment | Modificador aplicado en la venta |
| **SalesOrderPayment** | salesOrderId, method, amountUSD, amountBS, exchangeRate, reference | Línea de pago (para pagos mixtos) |
| **OpenTab** | tabCode (unique), branchId, serviceZoneId, tableOrStationId, status (OPEN/PARTIALLY_PAID/CLOSED), runningTotal, balanceDue, totalServiceCharge, totalTip, waiterLabel | Mesa/tab abierta |
| **OpenTabOrder** | openTabId + salesOrderId (unique) | Vincula órdenes con tab abierto |
| **PaymentSplit** | openTabId, salesOrderId, splitLabel, splitType, paymentMethod, status, serviceChargeAmount, tipAmount, total, amountBs, exchangeRate | División de cuenta (pago parcial por persona). `amountBs`/`exchangeRate` (FASE B §59) persisten la tasa histórica del cobro |
| **TabSubAccount** | openTabId, label, sortOrder, status, subtotal, serviceCharge, total, paidAmount, paymentMethod, paidAt | Subcuenta lógica dentro de una mesa (división por persona); la habilita el capitán |
| **SubAccountItem** | subAccountId, salesOrderItemId, quantity, lineTotal | Ítem asignado a una subcuenta |
| **InvoiceCounter** | channel (unique), lastValue | Correlativo global por canal. Nunca se resetea |

### 2.7 Modelo Operativo Restaurante (4 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **ServiceZone** | branchId + name (unique), zoneType (DINING/BAR/TERRACE/VIP), sortOrder | Zona de servicio del local |
| **TableOrStation** | branchId + code (unique), serviceZoneId, stationType (TABLE/BAR_SEAT/VIP_ROOM), capacity, currentStatus | Mesa o estación física |
| **Waiter** | branchId, firstName, lastName, pin (PBKDF2 hash), isCaptain, isActive | Mesonero del restaurante. `pin` permite identificación sin sesión en POS Mesero. `isCaptain` habilita subcuentas y autorizaciones de transferencia |
| **TableTransfer** | openTabId, fromWaiterId, toWaiterId, authorizedByWaiterId?, authorizedByUserId?, authorizedNote?, fromTableId?, toTableId?, reason, transferredAt | Historial de transferencias de mesonero y de mesa física. PIN dual: capitán Waiter O gerente User |

### 2.8 Compras (7 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **Supplier** | name, code (unique), contactName, phone, email | Proveedor |
| **SupplierItem** | supplierId + inventoryItemId (unique), unitPrice, leadTimeDays, isPreferred | Catálogo de items por proveedor |
| **PurchaseOrder** | orderNumber (unique), orderName, supplierId, status (DRAFT→RECEIVED), subtotal, totalAmount | Orden de compra |
| **PurchaseOrderItem** | purchaseOrderId, inventoryItemId, quantityOrdered, quantityReceived, unitPrice | Línea de orden de compra |
| **SupplierDocument** | documentType, documentNumber, supplierId, documentDate, totalAmount, currency, documentUrl, inventoryStatus, linkedPurchaseOrderId, accountPayableId, status, tenantId | Factura/nota de entrega del proveedor — documento decoplado del inventario (§57) |
| **SupplierDocumentItem** | supplierDocumentId, inventoryItemId, itemName, quantity, unit, unitCost, lineTotal | Línea de documento de proveedor |
| **SupplierItemPriceHistory** | supplierId + inventoryItemId, unitPrice, currency, effectiveFrom/To, registeredFromPurchaseOrderId | Historial de precio de compra por proveedor e insumo |

### 2.9 Financiero (5 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **ExpenseCategory** | name (unique), color, icon, sortOrder | Categoría de gasto (Alquiler, Nómina...) |
| **Expense** | description, categoryId, amountUsd, amountBs, paymentMethod, paidAt, status (CONFIRMED/VOID), periodMonth/Year | Gasto operativo |
| **CashRegister** | registerName, shiftDate, shiftType, status (OPEN/CLOSED), openingCashUsd/Bs, closingCashUsd/Bs, expectedCash, difference, openingDenominationsJson, closingDenominationsJson, operatorsJson | Apertura/cierre de caja |
| **AccountPayable** | description, supplierId, totalAmountUsd, paidAmountUsd, remainingUsd, status (PENDING/PARTIAL/PAID/OVERDUE), purchaseOrderId | Cuenta por pagar |
| **AccountPayment** | accountPayableId, amountUsd, amountBs, paymentMethod, paymentRef, paidAt | Pago aplicado a cuenta |

### 2.10 Entretenimiento — Table Pong (6 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **GameType** | code (unique), name, defaultSessionMinutes | Tipo de juego (BILLAR, PLAYSTATION...) |
| **GameStation** | code (unique), gameTypeId, branchId, currentStatus, hourlyRate | Estación física de juego |
| **WristbandPlan** | code (unique), name, durationMinutes, price, maxSessions | Plan de pulsera |
| **Reservation** | code (unique), stationId, wristbandPlanId, customerName, scheduledStart/End, status, depositAmount | Reserva de estación |
| **GameSession** | code (unique), stationId, gameTypeId, reservationId, salesOrderId, wristbandCode, billingType (HOURLY/WRISTBAND/FLAT), minutesBilled, amountBilled, status | Sesión activa de juego |
| **QueueTicket** | ticketNumber, stationId, gameTypeId, customerName, status (WAITING→SEATED), estimatedWaitMinutes | Turno en cola de espera |

### 2.11 Intercompany (3 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **IntercompanySettlement** | code (unique), fromBranchId, toBranchId, periodStart/End, status, totalAmount | Liquidación entre negocios |
| **IntercompanySettlementLine** | settlementId, menuItemId, inventoryItemId, description, quantity, unitPrice | Línea de liquidación |
| **IntercompanyItemMapping** | menuItemId + fromBranchId (unique), sourceInventoryItemId, toBranchId, transferPrice | Mapeo de items entre negocios |

### 2.12 Configuración y Sistema (6 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **SystemConfig** | key (PK), value, updatedBy | Configuración clave-valor. Keys activas: `enabled_modules`, `pos_stock_validation_enabled`, metas de venta |
| **ExchangeRate** | rate (Bs por 1 USD), effectiveDate, source (BCV) | Tasa de cambio diaria |
| **ProductFamily** | code (unique), name | Familia de productos para SKU Studio |
| **SkuCreationTemplate** | name, productFamilyId, defaultFields (JSON) | Plantilla de creación rápida de SKUs |
| **RateLimitBucket** | key, windowStart, count, expiresAt | Rate limiting (ventana deslizante) para login/endpoints sensibles |
| **PrintJob** | tenantId, type, station, payload (JSON), status, retries, claimedAt, completedAt | Cola de impresión térmica que consume el Print Agent (§45.4) |

### 2.13 Comunicación y Auditoría (2 modelos)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **BroadcastMessage** | title, body, type (INFO/WARNING/ALERT/SUCCESS), targetRoles (JSON), startsAt, expiresAt | Anuncios internos |
| **AuditLog** | userId, userName, userRole, action, entityType, entityId, description, changes (JSON), module, createdAt | Registro forense inmutable. NUNCA se borra |

### 2.15 Tesorería / Conciliación Bancaria (6 modelos — §56)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **AccountReceivable** | description, debtorName, customerId, totalAmountUsd, collectedAmountUsd, remainingUsd, issueDate, dueDate, status, tenantId | Cuenta por cobrar |
| **ReceivablePayment** | accountReceivableId, amountUsd, amountBs, exchangeRate, method, bankAccountId, collectedAt, tenantId | Cobro aplicado a una CxC |
| **BankAccount** | name, bankName, currency, kind, rif, isActive, commInNaturalPct, commInJuridicaPct, commOutNaturalPct, commOutJuridicaPct, tenantId | Cuenta bancaria con comisiones por tipo de contraparte (natural/jurídica, entrada/salida) |
| **PosTerminal** | label, terminalCode, posMethodKey, commissionPct, commNaturalPct, commJuridicaPct, bankAccountId, tenantId | Terminal PDV con su comisión, ligado a una cuenta bancaria |
| **BankReconciliation** | bankAccountId, date, fiscalWeek, expectedIn, statementIn, commissionStmt, differential, status, rateAtSettle, bcvLossUsd, postedExpenseId, tenantId | Conciliación semanal: esperado vs estado de cuenta, pérdida BCV al liquidar |
| **BankMovementRecon** | bankAccountId, sourceType, sourceId, date, counterpartyType, commissionRemoved, reconciled, statementAmount, tenantId | Marca de conciliación por movimiento individual |

### 2.16 Delivery / CRM (10 modelos — §55, §6.0.1)

> Detalle completo en §55 (estados, API n8n, webhooks). Aquí solo el inventario de modelos.

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **Customer** | tenantId, fullName, idDocument, phone, email, address, totalOrders, totalSpent, lastOrderAt | Cartera de clientes (CRM, §6.0.1/§48). Compartido con CxC |
| **DeliveryTenantConfig** | tenantId, … | Config de delivery a nivel tenant (feature flag deliveryOps) |
| **BranchDeliveryConfig** | branchId, … | Config de delivery por sucursal |
| **DeliveryZone** | tenantId/branchId, nombre, tarifa | Zona de reparto con su tarifa |
| **DeliveryOrder** | código, estado (máquina §55.2), cliente, total, motorizado | Pedido de delivery (entra por API n8n) |
| **DeliveryDriver** | tenantId, nombre, estado | Motorizado/repartidor |
| **DeliveryWebhookOutbox** | payload, status, attempts, HMAC | Outbox de webhooks salientes firmados (§55.8) |
| **DeliveryOrderEvent** | deliveryOrderId, tipo, timestamp | Bitácora de eventos del pedido (auditoría de estados) |
| **RoutingRule** | tenantId, matchProduct, branchId, priority, isActive | Regla de ruteo de pedido → sucursal por producto |
| **ManagerNote** | tenantId, branchId, text, isActive, expiresAt | Instrucción dinámica del gerente al tablero de delivery (§55.9) |

### 2.17 SaaS / Facturación de la plataforma (1 modelo)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| **TenantPayment** | tenantId, amount, currency, paidAt, method, periodStart, periodEnd, recordedById | Pago de suscripción del tenant a Cápsula (cobro de la plataforma, no del restaurante) |

### 2.14 Diagrama de Relaciones Principales

```
MenuItem ←── recipeId ──→ Recipe ←── ingredientItemId ──→ InventoryItem
   ↓                        ↓                                  ↓
SalesOrderItem          RecipeIngredient              InventoryLocation (stock por área)
   ↓                                                           ↑
SalesOrder ──→ inventory.service.registerSale() ──→ InventoryMovement(SALE)
   ↓                                                           ↑
SalesOrderPayment                                   InventoryMovement(PURCHASE) ←── PurchaseOrder
   ↓                                                           ↑
OpenTab / PaymentSplit                              InventoryMovement(PRODUCTION) ←── ProductionOrder
   ↓                                                           ↑
CashRegister ← ventas del turno                     InventoryMovement(TRANSFER) ←── Requisition
   ↓                                                           ↑
Finanzas (P&L) ← Expense + AccountPayable          InventoryMovement(ADJUSTMENT) ←── InventoryAudit
```

---

## 3. Autenticación, Roles y Permisos

### 3.1 Autenticación — JWT Custom

**Archivo**: `src/lib/auth.ts`

- JWT firmado con HS256 via `jose`
- Cookie `session` httpOnly, secure en prod, sameSite lax, 24h TTL
- Secret: `JWT_SECRET` env var. ⚠️ **GAP DE SEGURIDAD (crítico para multi-tenant):** `getSecretKey()` en `auth.ts` cae a un `FALLBACK_SECRET` hardcodeado si `JWT_SECRET` falta o tiene <32 chars (solo loguea un warning). En un SaaS con varios tenants, un deploy sin `JWT_SECRET` deja sesiones **forjables**. Acción: hacer que producción **falle el arranque** si falta el secret, no que degrade.
- Payload: `{ id, email, firstName, lastName, role }`
- Funciones: `encrypt()`, `decrypt()`, `getSession()`, `createSession()`, `deleteSession()`

**Server Actions de auth**: `src/app/actions/auth.actions.ts`
- `loginAction(prevState, formData)` — valida email+password, crea sesión
- `logoutAction()` — elimina cookie de sesión

### 3.2 Los 10 Roles del Sistema

**Archivo**: `src/lib/constants/roles.ts` (`ROLE_HIERARCHY` define **10 roles**)

| Rol | Nivel RBAC | Nivel permisos | Descripción |
|-----|-----------|---------------|-------------|
| OWNER | 1 | 100 | Acceso total. Único que activa/desactiva módulos |
| AUDITOR | 2 | 90 | Solo lectura en todo, acceso a auditoría y reportes |
| ADMIN_MANAGER | 3 | 80 | Gestión administrativa y financiera |
| OPS_MANAGER | 4 | 70 | Gestión de operaciones, inventario, producción |
| HR_MANAGER | 5 | 60 | Recursos humanos |
| CHEF | 6 | 50 | Recetas, producción, inventario (lectura) |
| AREA_LEAD | 7 | 40 | Gestión de área específica |
| KITCHEN_CHEF | 7 | 15 | Comandera de cocina (solo vista) |
| CASHIER | 8 | 20 | Cajera unificada. Módulos accesibles controlados por `allowedModules` |
| WAITER | 8 | 15 | Toma de pedidos en mesa |

**CASHIER es el rol canónico único para cajeras** (Fase 3 RBAC). Los roles `CASHIER_RESTAURANT` y `CASHIER_DELIVERY` fueron eliminados del codebase en Fase 4. El acceso a POS restaurante vs. delivery se controla ahora mediante `allowedModules` por usuario individual.

Existen dos sistemas de niveles numéricos paralelos (históricamente separados, no unificados en una sola fuente):
- `roles.ts:ROLE_HIERARCHY` — menor número = mayor rango (1-8), usado en `canManageRole()`
- `permissions.ts:roleLevels` — mayor número = mayor rango (15-100), usado en `hasPermission()`

`STAFF` aparece solo en `permissions.ts:roleLevels` (nivel 10, legado) — **no** está en `ROLE_HIERARCHY` ni se asigna a usuarios; no cuenta como rol canónico.

### 3.3 Sistema de Permisos — 4 Capas

El sistema RBAC opera en **4 capas apiladas**:

| Capa | Mecanismo | Archivo | Alcance |
|------|-----------|---------|---------|
| 1 | **Middleware** — rutas protegidas por rol | `middleware.ts` | `/dashboard/usuarios`, `/dashboard/inventario/auditorias`, `/dashboard/config/*` |
| 2 | **MODULE_ROLE_ACCESS** — módulos visibles en Sidebar | `modules-registry.ts` | Todos los módulos del sistema |
| 3 | **allowedModules** — restricción por usuario | `User.allowedModules` (BD) | Subconjunto de módulos de Capa 2 |
| 4 | **grantedPerms / revokedPerms** — permisos granulares | `User.grantedPerms/revokedPerms` (BD) | Acciones específicas dentro de módulos |

#### Capa 1 — `src/lib/permissions.ts` (sistema numérico heredado)

```typescript
// userLevel >= requiredLevel = acceso permitido
roleLevels = { OWNER: 100, AUDITOR: 90, ADMIN_MANAGER: 80, OPS_MANAGER: 70,
               HR_MANAGER: 60, CHEF: 50, AREA_LEAD: 40, CASHIER: 20,
               KITCHEN_CHEF: 15, WAITER: 15, STAFF: 10 }
PERMISSIONS = { CONFIGURE_ROLES: 70, APPROVE_TRANSFERS: 40,
                VIEW_COSTS: 80, VIEW_USERS: 60, MANAGE_USERS: 70 }
```

#### Capas 2–3 — `src/lib/constants/roles.ts`

- `ROLE_PERMISSIONS` — matriz por módulo y acción (view, create, edit, delete, approve, export)
- `canManageRole(actorRole, targetRole)` — jerarquía (solo superiores modifican inferiores)
- `getManageableRoles(actorRole)` — qué roles puede crear/editar

#### Capa 4 — `src/lib/constants/permissions-registry.ts` *(nuevo)*

Catálogo de **25 permisos granulares** con resolución por usuario:

```typescript
// Permisos disponibles (PERM keys):
// POS/Ventas (6): VOID_ORDER, APPLY_DISCOUNT, APPROVE_DISCOUNT, VIEW_ALL_ORDERS,
//                 VIEW_SALES_HISTORY, REPRINT_COMANDA
// Inventario (3): ADJUST_STOCK, APPROVE_TRANSFER, CLOSE_DAILY_INV
// Financiero (5): EXPORT_SALES, VIEW_COSTS, OPEN_CASH_REGISTER, CLOSE_CASH_REGISTER, VIEW_FINANCES
// Admin (4): MANAGE_USERS, MANAGE_PINS, CONFIGURE_SYSTEM, MANAGE_BROADCAST
// Reportes (7): REPORTES_VENTAS_VER, REPORTES_OPERATIVOS_VER, REPORTES_INVENTARIO_VER,
//               REPORTES_COMPRAS_VER, REPORTES_GERENCIAL_VER, REPORTES_FISCAL_VER, REPORTES_EXPORTAR

// ROLE_BASE_PERMS — set base por rol (sin override). OWNER = Object.values(PERM) (todos)
// Resolución final: base ∪ grantedPerms - revokedPerms
resolvePerms(role, grantedPerms?, revokedPerms?) → Set<PermKey>
canDo(role, perm, grantedPerms?, revokedPerms?)   → boolean
```

`PERM_GROUPS` — **5 grupos** para la UI (POS/Ventas, Inventario, Financiero, Administración, Reportes).
`PERM_LABELS` — etiquetas y descripciones legibles para cada permiso.

**Flujo de resolución**: El JWT carga `grantedPerms`/`revokedPerms` en la sesión (`auth.actions.ts`). `resolvePerms()` aplica la fórmula `base ∪ granted − revoked` en runtime — no hay cache, siempre calculado desde la sesión.

### 3.4 Middleware RBAC

**Archivo**: `src/middleware.ts`

Matcher: `/dashboard/:path*` y `/login`

| Regla | Rutas | Roles permitidos |
|-------|-------|-----------------|
| Login requerido | `/dashboard/*` sin sesión | Redirect → `/login` |
| Ya autenticado | `/login` con sesión | Redirect → `/dashboard` |
| Gestión usuarios | `/dashboard/usuarios` | OWNER, ADMIN_MANAGER |
| Auditorías | `/dashboard/inventario/auditorias`, `/dashboard/inventario/importar` | OWNER, ADMIN_MANAGER, OPS_MANAGER, AUDITOR |
| Config global | `/dashboard/config/*` | Solo OWNER |

**Nota**: El middleware cubre las rutas de mayor riesgo. Para el resto de módulos, el control de acceso se aplica en dos niveles: el Sidebar filtra por `MODULE_ROLE_ACCESS` (no muestra el enlace), y cada Server Component/Action hace su propia verificación de rol antes de servir datos. Un usuario que acceda directamente a una URL no autorizada verá la página vacía o recibirá error del Server Action, pero no datos sensibles.

### 3.5 Acceso por Módulos — Triple Filtro

Un módulo aparece en el Sidebar solo si pasa los **tres filtros** en orden:

1. **Habilitado** en la instalación → `SystemConfig.enabled_modules` (BD) o `NEXT_PUBLIC_ENABLED_MODULES` (env var fallback)
2. **Rol autorizado** → `MODULE_ROLE_ACCESS[moduleId].includes(userRole)` en `modules-registry.ts`
3. *(Restricción individual)* **allowedModules** → si `User.allowedModules` no es null, el módulo debe estar en ese array

Función clave: `getVisibleModules(userRole, enabledIds, userAllowedModules)` en `modules-registry.ts`

Los permisos granulares (Capa 4) no controlan visibilidad de módulos sino acciones dentro de ellos (anular orden, exportar, abrir caja, etc.).

---

## 4. Module Registry y Navegación

### 4.1 Registro Maestro de Módulos

**Archivo**: `src/lib/constants/modules-registry.ts` (682 líneas)

Interfaz `ModuleDefinition`: id, label, description, icon, href, section, enabledByDefault, sortOrder, subRoutes?, tags?

### 4.2 Las 4 Secciones del Sidebar

#### Operaciones (20 módulos)

| # | id | Label | Ruta | enabledByDefault | sortOrder |
|---|-----|-------|------|-----------------|-----------|
| 1 | dashboard | Dashboard | /dashboard | true | 0 |
| 2 | estadisticas | Estadísticas | /dashboard/estadisticas | true | 5 |
| 3 | inventory_daily | Inventario Diario | /dashboard/inventario/diario | true | 10 |
| 4 | inventory | Inventario | /dashboard/inventario | true | 20 |
| 5 | inventory_count | Conteo Físico (Excel) | /dashboard/inventario/conteo-semanal | true | 25 |
| 6 | audits | Auditorías | /dashboard/inventario/auditorias | true | 30 |
| 7 | transfers | Transferencias | /dashboard/transferencias | true | 40 |
| 8 | inventory_history | Historial Mensual | /dashboard/inventario/historial-mensual | true | 45 |
| 9 | loans | Préstamos | /dashboard/prestamos | true | 50 |
| 10 | mesoneros | Mesoneros | /dashboard/mesoneros | true | 55 |
| 11 | recipes | Recetas | /dashboard/recetas | true | 60 |
| 12 | production | Producción | /dashboard/produccion | true | 70 |
| 13 | costs | Costos | /dashboard/costos | true | 80 |
| 14 | margen | Margen por Plato | /dashboard/costos/margen | true | 82 |
| 15 | purchases | Compras | /dashboard/compras | true | 90 |
| 16 | proteins | Proteínas | /dashboard/proteinas | true | 100 |
| 17 | asistente | Asistente de Nomenclatura | /dashboard/asistente | true | 105 |
| 18 | sku_studio | SKU Studio | /dashboard/sku-studio | true | 106 |
| 19 | menu | Menú | /dashboard/menu | true | 110 |
| 20 | modifiers | Modificadores | /dashboard/menu/modificadores | true | 115 |

#### Ventas / POS (9 módulos)

| # | id | Label | Ruta | enabledByDefault | sortOrder |
|---|-----|-------|------|-----------------|-----------|
| 1 | pos_restaurant | POS Restaurante | /dashboard/pos/restaurante | true | 200 |
| 2 | pos_waiter | POS Mesero | /dashboard/pos/mesero | **false** | 205 |
| 3 | pos_delivery | POS Delivery | /dashboard/pos/delivery | true | 210 |
| 4 | pedidosya | PedidosYA | /dashboard/pos/pedidosya | **false** | 220 |
| 5 | sales_entry | Cargar Ventas | /dashboard/ventas/cargar | true | 230 |
| 6 | sales_history | Historial Ventas | /dashboard/sales | true | 240 |
| 7 | kitchen_display | Comandera Cocina | /kitchen | true | 250 |
| 8 | barra_display | Comandera Barra | /kitchen/barra | true | 251 |
| 9 | pos_config | Configuración POS | /dashboard/config/pos | true | 260 |

#### Entretenimiento / Games (4 módulos — todos off por default)

| # | id | Label | Ruta | enabledByDefault | sortOrder |
|---|-----|-------|------|-----------------|-----------|
| 1 | games | Juegos | /dashboard/games | **false** | 300 |
| 2 | reservations | Reservaciones | /dashboard/reservations | **false** | 310 |
| 3 | wristbands | Pulseras | /dashboard/wristbands | **false** | 320 |
| 4 | queue | Cola de Espera | /dashboard/queue | **false** | 330 |

#### Administración (14 módulos)

| # | id | Label | Ruta | enabledByDefault | sortOrder |
|---|-----|-------|------|-----------------|-----------|
| 1 | intercompany | Intercompany | /dashboard/intercompany | **false** | 400 |
| 2 | users | Usuarios | /dashboard/usuarios | true | 500 |
| 3 | modulos_usuario | Módulos por Usuario | /dashboard/config/modulos-usuario | true | 503 |
| 4 | roles_config | Roles y Permisos | /dashboard/config/roles | true | 510 |
| 5 | module_config | Módulos | /dashboard/config/modules | true | 520 |
| 6 | almacenes | Almacenes | /dashboard/almacenes | true | 528 |
| 7 | tasa_cambio | Tasa de Cambio | /dashboard/config/tasa-cambio | true | 530 |
| 8 | metas | Objetivos y Metas | /dashboard/metas | true | 540 |
| 9 | anuncios | Anuncios a Gerencia | /dashboard/anuncios | true | 542 |
| 10 | finanzas | Dashboard Financiero | /dashboard/finanzas | true | 550 |
| 11 | gastos | Gastos | /dashboard/gastos | true | 560 |
| 12 | caja | Control de Caja | /dashboard/caja | true | 570 |
| 13 | cuentas_pagar | Cuentas por Pagar | /dashboard/cuentas-pagar | true | 580 |

### 4.3 MODULE_ROLE_ACCESS — Matriz Completa

Roles con acceso a **todos** los módulos de operaciones:
- OWNER, ADMIN_MANAGER, OPS_MANAGER (con variaciones en inventory_history, loans, costs, margen, menu, modifiers)

Roles con acceso **restringido**:
- CHEF → dashboard, estadísticas, inventario, conteo, auditorías, transferencias, recetas, producción, compras, proteínas, sku_studio, asistente
- AREA_LEAD → dashboard, estadísticas, inventario diario/general, conteo, auditorías, transferencias, producción, compras, proteínas, **pos_restaurant** (Fase 4)
- CASHIER → estadísticas, pos_restaurant, **pos_waiter** (Fase 4), pos_delivery, pedidosya, sales_history, barra_display, pos_config, reservations, queue, tasa_cambio, caja *(módulos visibles filtrados además por `allowedModules`)*
- KITCHEN_CHEF → estadísticas, kitchen_display, barra_display
- WAITER → estadísticas, pos_waiter
- HR_MANAGER → dashboard, users, mesoneros
- AUDITOR → dashboard, estadísticas, inventario (todo lectura), transfers, recipes, production, costs, margen, purchases, sales_history, intercompany, users, finanzas, gastos, caja, cuentas_pagar

### 4.4 Funciones Clave del Registry

```
getEnabledModuleIds()                                    → string[]  // Lee env var o usa defaults
getVisibleModules(userRole, enabledIds?, userAllowed?)    → ModuleDefinition[]  // Filtro triple
getModulesBySection(userRole, enabledIds?, userAllowed?)  → { operations, sales, games, admin }
```

**Nota especial**: `module_config` siempre es visible para OWNER, independientemente de `enabled_modules`. Nunca se filtra por `allowedModules`.

---

## 5. Módulos de OPERACIONES (20 módulos)

### 5.1 Dashboard

- **Ruta**: `/dashboard`
- **Página**: `src/app/dashboard/page.tsx` — Server Component
- **Actions**: `dashboard.actions.ts` → `getDashboardStatsAction()`
- **Modelos**: SalesOrder, InventoryItem, OpenTab (lectura agregada)
- **Lógica**: Métricas resumen: ventas del día, tabs abiertos, items bajo stock, última actividad
- **Conexiones**: ← SalesOrder (ventas hoy), ← InventoryLocation (alertas stock), ← OpenTab (mesas activas)
- **Estado**: Funcional

### 5.2 Estadísticas

- **Ruta**: `/dashboard/estadisticas`
- **Página**: `src/app/dashboard/estadisticas/page.tsx` — Server Component
- **Actions**: `estadisticas.actions.ts` → `getEstadisticasAction()`
- **Modelos**: SalesOrder, SalesOrderItem, OpenTab, ProductionOrder, DailyInventory
- **Lógica**: Análisis en tiempo real personalizado por rol — ventas, cocina, inventario, auditoría. Datos del día y tendencias.
- **Conexiones**: ← SalesOrder (ventas), ← ProductionOrder (producción), ← DailyInventory (conteos)
- **Estado**: Funcional
- **Roles con acceso**: Todos los roles (cada uno ve datos relevantes a su función)

### 5.3 Inventario Diario

- **Ruta**: `/dashboard/inventario/diario`
- **Página**: `src/app/dashboard/inventario/diario/page.tsx` — Server Component (carga áreas), Client Component interior
- **Responsive (tablet/móvil)**: `daily-manager.tsx` rinde **dos vistas** del mismo dataset: tabla de 10 columnas solo en `lg:` (`hidden … lg:table`) y **tarjetas apiladas** en `< lg` (`lg:hidden`) con Apertura/Cierre editables + chips de los calculados. El contenedor suelta la altura fija en pantallas chicas (`lg:h-[calc(100vh-12rem)]`, sin `flex-1/overflow` bajo `lg`) para que la página scrollee natural y no se clipee en landscape. Tarjetas usan tokens capsula + 4 tonos de estado.
- **Actions**: `inventory-daily.actions.ts` → 14 funciones:
  - `getDailyInventoryAction(dateStr, areaId)` — carga/crea inventario del día
  - `saveDailyInventoryCountsAction(dailyId, items[])` — guarda conteos
  - `syncSalesFromOrdersAction(dailyId)` — sincroniza ventas POS al diario
  - `processManualSalesAction(dailyId, salesData[])` — ingreso manual de ventas
  - `processWhatsAppSalesForDailyAction(...)` — parser WhatsApp para ventas
  - `closeDailyInventoryAction(dailyId)` / `reopenDailyInventoryAction(dailyId)`
  - `getInventorySummaryByRangeAction(...)` / `getWeeklyInventorySummaryAction(...)`
  - `getDaysStatusAction(areaId, start, end)` — calendario de días abiertos/cerrados
  - `searchItemsForCriticalListAction(query, areaId)` — buscar items para lista crítica
  - `toggleItemCriticalStatusAction(itemId, isCritical, areaId)` — marcar/desmarcar crítico
  - `getCriticalProteinItemsAction(areaId)` — items proteína críticos
  - `getMenuItemsWithRecipesAction()` — para ingreso manual
- **Modelos**: DailyInventory, DailyInventoryItem, SalesOrder, Recipe, InventoryItem, AreaCriticalItem
- **Conexiones**: ← SalesOrder (sincroniza ventas del POS), ← Recipe (calcula consumo teórico), ← InventoryLocation (stock actual) → genera varianzas (teórico vs real)
- **Lógica clave**: Flujo diario: abrir → contar items → sincronizar ventas POS → calcular teórico → registrar varianza → cerrar
- **Estado**: Funcional

### 5.4 Inventario

- **Ruta**: `/dashboard/inventario`
- **Página**: `src/app/dashboard/inventario/page.tsx` — Server Component
- **Actions**: `inventory.actions.ts` → 6 funciones:
  - `createQuickItem(data)` — crear insumo rápido
  - `getInventoryListAction()` — listado completo con stock por área
  - `getAreasAction()` — áreas disponibles
  - `updateInventoryItemAction(id, data)` — editar insumo
  - `deleteInventoryItemAction(id)` — soft delete
  - `getInventoryHistoryAction(filters)` — historial de movimientos
- **Modelos**: InventoryItem, InventoryLocation, InventoryMovement, Area
- **Conexiones**: ← InventoryMovement (historial), ← InventoryLocation (stock actual por área)
- **Estado**: Funcional

### 5.5 Conteo Físico (Excel)

- **Ruta**: `/dashboard/inventario/conteo-semanal`
- **Página**: `src/app/dashboard/inventario/conteo-semanal/page.tsx` — Server Component
- **Actions**: `inventory-count.actions.ts` → 4 funciones:
  - `resolveDefaultCountAreasAction()` — áreas para conteo
  - `previewPhysicalCountFromExcelAction(formData)` — parsea Excel, muestra preview
  - `applyPhysicalCountAction(input)` — aplica ajustes de stock
  - `resetAllWarehouseStockAction(confirmPhrase)` — resetea stock (peligrosa, requiere confirmación)
- **Modelos**: InventoryLocation, InventoryMovement (ADJUSTMENT_IN/OUT)
- **Lógica**: Importar Excel con conteos → comparar vs sistema → generar InventoryMovement(ADJUSTMENT)
- **Estado**: Funcional

### 5.6 Auditorías

- **Ruta**: `/dashboard/inventario/auditorias` (lista) + `/dashboard/inventario/auditorias/[id]` (detalle)
- **Página**: Server Component (lista), Client interior (detalle)
- **Actions**: `audit.actions.ts` → 8 funciones:
  - `getAuditsAction()` / `getAuditAction(id)`
  - `createAuditAction(input)` — snapshot de stock actual del sistema
  - `updateAuditItemAction(input)` — actualizar conteo de un item
  - `approveAuditAction(input)` — genera InventoryMovement(ADJUSTMENT) por cada diferencia
  - `rejectAuditAction(id)` / `voidAuditAction(id)` / `deleteAuditAction(id)`
- **Modelos**: InventoryAudit, InventoryAuditItem, InventoryMovement, InventoryLocation
- **Conexiones**: → genera InventoryMovement(ADJUSTMENT_IN/OUT) al aprobar → actualiza InventoryLocation
- **Estado**: Funcional

### 5.7 Transferencias

- **Ruta**: `/dashboard/transferencias`
- **Página**: `src/app/dashboard/transferencias/page.tsx` — Server Component (importa de `entrada.actions` y `requisition.actions`)
- **Actions**: `requisition.actions.ts` → 10 funciones:
  - `getRequisitions(filter)` / `createRequisition(input)`
  - `dispatchRequisition(input)` — Jefe de Producción despacha
  - `approveRequisition(input)` — Gerente aprueba con cantidades recibidas
  - `receiveRequisition(input)` — verificación de recepción
  - `completeRequisition(id, completedById)` — cierra el flujo
  - `rejectRequisition(id, userId)`
  - `getCategoriesForTransferAction()` — categorías para filtrar
  - `previewBulkTransferAction(...)` / `executeBulkTransferAction(...)` — transferencia masiva
- **Modelos**: Requisition, RequisitionItem, InventoryMovement (TRANSFER), InventoryLocation
- **Lógica**: Flujo escalonado: Solicitud → Despacho → Aprobación → Recepción → Completar. Genera InventoryMovement(TRANSFER) y actualiza stock en áreas origen/destino.
- **Estado**: Funcional

### 5.8 Historial Mensual

- **Ruta**: `/dashboard/inventario/historial-mensual`
- **Página**: `src/app/dashboard/inventario/historial-mensual/page.tsx` — Client Component
- **Actions**: `movement-history.actions.ts` → 2 funciones:
  - `getMonthlyMovementsAction(filters)` — movimientos filtrados por mes/área/tipo/item
  - `getMovementTypesAction()` — lista de tipos de movimiento
- **Modelos**: InventoryMovement (lectura)
- **Estado**: Funcional

### 5.9 Préstamos

- **Ruta**: `/dashboard/prestamos` (lista) + `/dashboard/prestamos/nuevo` (crear)
- **Página**: Server Component (lista)
- **Actions**: `loan.actions.ts` → 4 funciones:
  - `getLoansAction()` — lista con filtros
  - `createLoanAction(input)` — genera InventoryMovement de salida
  - `resolveLoanAction(input)` — cierra préstamo (reposición o pago)
  - `getLoanableItemsAction()` — items con stock disponible
- **Modelos**: InventoryLoan, InventoryMovement, InventoryLocation
- **Conexiones**: → InventoryMovement (SALE/ADJUSTMENT al prestar, PURCHASE al reponer)
- **Estado**: Funcional

### 5.10 Mesoneros

- **Ruta**: `/dashboard/mesoneros`
- **Página**: `src/app/dashboard/mesoneros/page.tsx` — Client Component
- **Actions**: `waiter.actions.ts` → 6 funciones:
  - `getWaitersAction()` / `getActiveWaitersAction()`
  - `createWaiterAction(data)` / `updateWaiterAction(id, data)`
  - `toggleWaiterActiveAction(id, isActive)` / `deleteWaiterAction(id)`
- **Modelos**: Waiter, Branch
- **Conexiones**: → POS Restaurante (asignar mesonero a OpenTab vía `waiterLabel`)
- **Estado**: Funcional

### 5.11 Recetas

- **Ruta**: `/dashboard/recetas` (lista) + `/dashboard/recetas/[id]` (detalle) + `/dashboard/recetas/[id]/editar` + `/dashboard/recetas/nueva`
- **Página**: Server Component (lista y detalle)
- **Actions**: `recipe.actions.ts` → 6 funciones:
  - `getRecipesAction()` — lista con ingredientes, costo calculado
  - `getRecipeByIdAction(id)` — detalle completo
  - `getIngredientOptionsAction()` — items para ingredientes
  - `createRecipeAction(input)` / `updateRecipeAction(input)`
  - `updateRecipeCostAction(...)` — recalcula costo desde CostHistory
- **Modelos**: Recipe, RecipeIngredient, InventoryItem, MenuItem, CostHistory
- **Conexiones**: ← InventoryItem (ingredientes), → MenuItem (vía recipeId), ← CostHistory (cálculo de costo), → ProductionOrder (se produce la receta)
- **Lógica clave**: El costo de receta se calcula recursivamente: si un ingrediente es SUB_RECIPE, se busca su propia receta y su costo (cost.service.ts)
- **Estado**: Funcional

### 5.12 Producción

- **Ruta**: `/dashboard/produccion`
- **Página**: `src/app/dashboard/produccion/page.tsx` — Client Component
- **Actions**: `production.actions.ts` → 9 funciones:
  - `getProductionRecipesAction()` — recetas disponibles para producir
  - `calculateRequirementsAction(recipeId, qty, unit)` — verifica ingredientes disponibles
  - `quickProductionAction(...)` — producción rápida (descuenta ingredientes, suma output)
  - `manualProductionAction(...)` — producción manual sin receta formal
  - `getProductionHistoryAction(filters)` — historial
  - `getProductionAreasAction()` / `getProductionItemsAction()`
  - `updateProductionOrderAction(...)` / `deleteProductionOrderAction(...)`
- **Modelos**: ProductionOrder, Recipe, RecipeIngredient, InventoryMovement, InventoryLocation
- **Servicios**: `production.service.ts` — `createProductionOrder()`, `completeProduction()`, `calculateRequirements()`
- **Conexiones**: ← Recipe (qué producir), → InventoryMovement(PRODUCTION_OUT) por ingredientes, → InventoryMovement(PRODUCTION_IN) por output
- **Estado**: Funcional

### 5.13 Costos

- **Ruta**: `/dashboard/costos`
- **Página**: `src/app/dashboard/costos/page.tsx` — Server Component
- **Actions**: `cost.actions.ts` → 5 funciones:
  - `parseCostUploadAction(formData)` — parsea Excel de costos
  - `processCostImportAction(rows)` — importa costos desde Excel
  - `getCurrentCostsAction()` — último costo por item
  - `updateItemCostAction(itemId, cost, reason)` — actualiza costo manual
  - `getDishMarginsAction()` — margen por plato (usado en /costos/margen)
- **Modelos**: CostHistory, InventoryItem, Recipe, MenuItem
- **Servicios**: `cost.service.ts` — `calculateGrossQuantity()`, cálculo COGS recursivo
- **Conexiones**: ← PurchaseOrder (unitCost), ← Recipe (costo calculado), → MenuItem.cost (se puede actualizar)
- **Estado**: Funcional

### 5.14 Margen por Plato

- **Ruta**: `/dashboard/costos/margen`
- **Página**: `src/app/dashboard/costos/margen/page.tsx` — Server Component
- **Actions**: `cost.actions.ts` → `getDishMarginsAction()`
- **Modelos**: Recipe, MenuItem, CostHistory
- **Lógica**: Para cada MenuItem con receta: precio de venta - costo de receta = margen. Ordena por % margen.
- **Conexiones**: ← Recipe + CostHistory (costo), ← MenuItem (precio venta)
- **Estado**: Funcional

### 5.15 Compras

- **Ruta**: `/dashboard/compras`
- **Página**: `src/app/dashboard/compras/page.tsx` — Client Component
- **Actions**: `purchase.actions.ts` → 13 funciones:
  - `updateStockLevelsAction(items)` — actualiza minimumStock/reorderPoint
  - `getAllItemsWithStockConfigAction()` — items con config de stock
  - `getLowStockItemsAction()` — alertas de bajo stock
  - `getAllItemsForPurchaseAction()` — catálogo para crear OC
  - `createPurchaseOrderAction(data)` — nueva orden de compra
  - `getPurchaseOrdersAction(status?)` / `getPurchaseOrderByIdAction(id)`
  - `sendPurchaseOrderAction(id)` — cambiar estado a SENT
  - `receivePurchaseOrderItemsAction(...)` — recibir items, genera InventoryMovement(PURCHASE) + CostHistory
  - `cancelPurchaseOrderAction(id)`
  - `getSuppliersAction()` / `createSupplierAction(input)`
  - `getAreasForReceivingAction()` — áreas destino de mercancía
  - `createReorderBroadcastsAction()` — crea anuncios automáticos para items bajo stock
  - `exportPurchaseOrderTextAction(id)` — texto para WhatsApp
- **Modelos**: PurchaseOrder, PurchaseOrderItem, Supplier, SupplierItem, InventoryMovement, CostHistory, InventoryLocation, BroadcastMessage
- **Componentes**: `whatsapp-purchase-order-parser.tsx` — parser de OC desde WhatsApp
- **Conexiones**: → InventoryMovement(PURCHASE) al recibir, → CostHistory (actualiza precio), → InventoryLocation (suma stock), → AccountPayable (puede crear deuda), → BroadcastMessage (alertas reorder)
- **Estado**: Funcional

### 5.16 Proteínas

- **Ruta**: `/dashboard/proteinas`
- **Página**: `src/app/dashboard/proteinas/page.tsx` — Client Component
- **Actions**: `protein-processing.actions.ts` → 13 funciones:
  - `getProteinItemsAction()` / `getProcessingAreasAction()` / `getSuppliersAction()`
  - `createProteinProcessingAction(...)` — inicia procesamiento
  - `getProteinProcessingsAction(filters)` / `getProteinProcessingByIdAction(id)`
  - `completeProteinProcessingAction(...)` — finaliza: genera InventoryMovement de salida (source) y entrada (subproductos), calcula rendimiento/desperdicio
  - `cancelProteinProcessingAction(id)`
  - `getProteinProcessingStatsAction(startDate, endDate)` — estadísticas
  - `getProcessingTemplatesAction()` / `getTemplateBySourceItemAction(...)` / `getTemplateChainAction(...)`
  - `createProcessingTemplateAction(...)` / `deleteProcessingTemplateAction(...)`
  - `getCompletedProcessingsForChainAction()` — procesados para encadenar
- **Modelos**: ProteinProcessing, ProteinSubProduct, ProcessingTemplate, ProcessingTemplateOutput, InventoryMovement, InventoryLocation, Supplier
- **Lógica clave**: Procesamiento en cadena (LIMPIEZA → MASERADO → DISTRIBUCIÓN). Cada paso puede generar sub-productos que son input del siguiente paso. Calcula rendimiento (yieldPercentage) y desperdicio.
- **Costeo dinámico**: `completeProteinProcessingAction` debería calcular el costo proporcional de cada sub-producto: `costoRealPorKg = (costoUnitarioSource × pesoCongelado) / totalSubProducts`. El campo `estimatedCost` en ProteinSubProduct y `isCalculated`/`costBreakdown` en CostHistory ya existen para esto. **Verificar si está implementado o pendiente.**
- **Estado**: Funcional

### 5.17 SKU Studio

- **Ruta**: `/dashboard/sku-studio`
- **Página**: `src/app/dashboard/sku-studio/page.tsx` — Server Component
- **Actions**: `sku-studio.actions.ts` → 6 funciones:
  - `getProductFamilies()` / `createProductFamily(data)`
  - `getSkuTemplates(familyId?)` / `createSkuTemplate(data)`
  - `createProductFromTemplate(...)` — crea InventoryItem + opcionalmente MenuItem desde plantilla
  - `createSkuItemAction(input)` — creación directa con chips de tipo/unidad/rol
- **Modelos**: ProductFamily, SkuCreationTemplate, InventoryItem, MenuItem
- **Conexiones**: → InventoryItem (crea), → MenuItem (opcionalmente crea)
- **Estado**: Funcional

### 5.18 Asistente de Nomenclatura

- **Ruta**: `/dashboard/asistente`
- **Página**: `src/app/dashboard/asistente/page.tsx` — Client Component
- **Actions**: `asistente.actions.ts` → 4 funciones:
  - `createRawMaterialAction(data)` — crear insumo con nombres estandarizados
  - `suggestSkuAction(prefix)` — sugerir SKU basado en prefijo
  - `getMenuRecipeStatusAction()` — qué items del menú tienen/faltan receta
  - `getRawMaterialsListAction()` — lista de materias primas
- **Modelos**: InventoryItem, Recipe, MenuItem
- **Conexiones**: → InventoryItem (crea), ← MenuItem + Recipe (diagnóstico de vinculación)
- **Estado**: Funcional

### 5.19 Menú

- **Ruta**: `/dashboard/menu`
- **Página**: `src/app/dashboard/menu/page.tsx` — Client Component
- **Actions**: `menu.actions.ts` → 9 funciones:
  - `getFullMenuAction()` — menú completo con categorías, modificadores
  - `getCategoriesAction()` — categorías activas
  - `createMenuItemAction(data)` — nuevo producto
  - `updateMenuItemPriceAction(id, price)` / `updateMenuItemNameAction(id, name)`
  - `toggleMenuItemStatusAction(id, isActive)`
  - `getMenuItemsWithoutRecipeAction()` — productos sin receta vinculada
  - `linkMenuItemToRecipeAction(menuItemId, recipeId)` — vincular receta existente
  - `createRecipeStubForMenuItemAction(menuItemId)` — crear receta vacía y vincular
  - `ensureBasicCategoriesAction()` — seed de categorías básicas
- **Modelos**: MenuItem, MenuCategory, Recipe
- **Conexiones**: ← Recipe (vía recipeId — para descargo automático), → SalesOrderItem (se vende en POS), ← MenuModifierGroup (modificadores aplicables)
- **Estado**: Funcional

### 5.20 Modificadores

- **Ruta**: `/dashboard/menu/modificadores`
- **Página**: `src/app/dashboard/menu/modificadores/page.tsx` — Server Component
- **Actions**: `modifier.actions.ts` → 11 funciones:
  - `getModifierGroupsWithItemsAction()` — grupos con sus modificadores y menú items vinculados
  - `createModifierGroupAction(data)` / `updateModifierGroupAction(id, data)` / `deleteModifierGroupAction(id)`
  - `addModifierAction(data)` / `updateModifierNamePriceAction(id, name, price)` / `deleteModifierAction(id)`
  - `toggleModifierAvailabilityAction(id, isAvailable)`
  - `linkGroupToMenuItemAction(groupId, menuItemId)` / `unlinkGroupFromMenuItemAction(groupId, menuItemId)`
  - `linkModifierToMenuItemAction(modifierId, menuItemId)` — vincula modificador a MenuItem para descargo de inventario
  - `getMenuItemsForModifierLinkAction()` — lista de MenuItems para vincular
- **Modelos**: MenuModifierGroup, MenuModifier, MenuItemModifierGroup, MenuItem
- **Lógica clave**: Un modificador puede tener `linkedMenuItemId` — cuando el cliente elige ese modificador, se descarga la receta del plato vinculado (ej: elegir "Tabulé" como acompañante descuenta ingredientes del tabulé)
- **Estado**: Funcional

### Conexiones Críticas entre Módulos de Operaciones

```
Receta ──── se vincula a ──→ MenuItem ──→ POS la usa para descargar inventario
  ↓
Producción ──→ InventoryMovement(PRODUCTION_IN/OUT) ──→ actualiza stock
  
Compras ──→ InventoryMovement(PURCHASE) ──→ actualiza stock + CostHistory
  
Auditorías ──→ InventoryMovement(ADJUSTMENT) ──→ corrige stock
  
Transferencias ──→ InventoryMovement(TRANSFER) ──→ mueve stock entre áreas
  
Inv. Diario ←── sincroniza ventas POS ──→ calcula consumo teórico vs real
  
Costos/Margen ←── CostHistory ←── Compras (unitCost) + Recetas (costo calculado)
  
Proteínas ──→ InventoryMovement (salida source, entrada subproductos) ──→ stock
```

---

## 6. Módulos de VENTAS / POS (9 módulos)

### 6.0 Promociones (happy hour por horario) — módulo (2026-06-05)

Descuento automático (% o monto fijo) sobre categorías/items en días y horas
específicas. Primera versión: **solo happy hour automático por horario**
(sin 2x1 ni combos todavía).

**Modelo** `Promotion` (`prisma/schema.prisma`): discountType `PERCENT|FIXED`,
discountValue, maxDiscountPerUnit?, applicableCategoryIds/applicableItemIds
(JSON arrays; ambos vacíos = todo el menú; unión si hay ambos), daysOfWeek
(JSON 0-6, 0=domingo), startTime/endTime ("HH:MM", soporta cruce de
medianoche), startDate/endDate?, priority (mayor gana; no se acumulan),
isActive, soft delete. Snapshot en `SalesOrderItem`: `appliedPromotionId`,
`appliedPromotionName`, `originalUnitPrice`, `promotionDiscount` (sin FK, para
no afectar ventas históricas al editar/borrar promos).

**Motor** `src/lib/promotions/engine.ts` — función PURA y testeada (19 tests):
`resolveBestPromotion(item, rules, at)`. Timezone Caracas vía Intl. Misma
lógica en cliente y servidor.

**Gating**: flag tenant `promotionsEnabled`. Sin el flag, ninguna promo se
aplica aunque existan cargadas.

**Aplicación**:
- `getMenuForPOSAction({ applyPromotions })` (`pos.actions.ts`): cuando el flag
  está activo, sobrescribe `item.price` con el precio con descuento y deja
  `item.listPrice` (original) + `item.appliedPromotion`. Así el POS muestra y
  cobra el precio correcto sin tocar el add-to-cart. **PedidosYA y el
  WhatsApp parser pasan `applyPromotions: false`** (usan su propio pricing).
- Re-aplicación AUTORITATIVA en `createSalesOrderAction` y
  `addItemsToOpenTabAction` vía `applyPromotionsToCart(db, tenantId, items)`
  (`src/lib/promotions/server.ts`): recalcula desde el precio base de BD al
  momento del cobro (corrige desfase de horario, bloquea manipulación) y
  guarda el snapshot de auditoría. Solo toca items con promo activa; el resto
  del pricing queda intacto. **Sin doble descuento**: el server siempre parte
  del precio base de lista, no del precio que mandó el cliente.

**Admin**: `/dashboard/promociones` (page + `promociones-view.tsx`), CRUD en
`promotions.actions.ts` (gated OWNER/ADMIN_MANAGER/OPS_MANAGER). Toggle del
flag `promotionsEnabled` desde la misma vista (solo OWNER) o desde
`/dashboard/config/feature-flags`. Módulo registrado en `modules-registry.ts`
(id `promotions`, sección operations, sortOrder 117, icon lucide `Tag`).

### 6.0.2 Auditoría 2026-06-05 — correcciones a PRs #259–#263

Auditoría adversarial de los 5 PRs. Bugs encontrados y corregidos (PR #264):
- **#259 CRÍTICO — fuga del método de pago.** El strip del historial limpiaba
  solo el nivel superior; las filas adjuntan `orders[]` (SalesOrder crudos) con
  `paymentMethod`, `orderPayments` y `openTab.paymentSplits/subAccounts` →
  legible en DevTools. Fix: `scrubPaymentMethodFromHistory` (deep-strip) en
  `src/lib/sales/scrub-payment.ts` + tests. Usado en `history.actions.ts`.
- **#260 CRÍTICO — doble cobro.** El `PaymentConfirmationModal` no se
  deshabilitaba al confirmar (`loading` nunca se pasaba); doble-tap táctil
  disparaba dos `createSalesOrderAction`. Fix: guard interno `busy` que bloquea
  el segundo disparo y resetea al reabrir.
- **#263 ALTO — doble-conteo de stats.** Coexistían DOS caminos de upsert de
  cliente: el pre-existente `upsertCustomerFromOrder` (que el Explore inicial no
  reportó) y el nuevo `resolveCustomerForOrder`+`bumpCustomerStats`. Ambos
  incrementaban `totalOrders`/`totalSpent` → doble. Fix: se eliminó
  `upsertCustomerFromOrder`; UN solo camino, invocado **después** de crear la
  orden (evita además clientes huérfanos si la orden fallaba) y que setea
  `customerId` vía update + bump.
- **#263 ALTO — agregados de la ficha mal.** `getCustomerDetailAction` calculaba
  total/conteo/ticket/primera-visita sobre las 100 órdenes capadas. Fix:
  `aggregate` sin cap + `findFirst` para la primera visita; `take:100` solo para
  la lista visible.
- **#263 MEDIO — duplicados de cliente.** Match por teléfono con `take:200`
  arbitrario (perdía clientes con >200 fichas) y normalización divergente entre
  los dos caminos. Fix: match por `contains` de los últimos 7 dígitos +
  teléfono guardado normalizado (solo dígitos) + auto-create exige teléfono.

Pre-existentes detectados, NO corregidos (no son regresión de estos PRs;
requieren visto bueno porque cambian números del cierre): reconciliación
`totalCollected` vs arqueo bajo redondeo DIVISAS; detección de propina en
órdenes no-tab que ignora `tipAtCheckout`/pago mixto; modelo "confiar en el
precio del cliente" para items sin promo.

### 6.0.2.c Fix: propinas explícitas de delivery/pickup subreportadas (PR #266)

Tercera auditoría: confirmado bug histórico en Z report y End-of-day. La fórmula
de propina para órdenes no-tab exigía `change === 0`, así que el **Caso C**
(cliente paga $25, cajera marca $3 de propina con `tipAtCheckout`, sistema
guarda `change=2`) quedaba en **$0** aunque los $3 estuvieran físicamente en
caja. Los Casos A y B (paga justo / "quedate con el vuelto") sí se contaban.

El dato real ya estaba en BD — no hizo falta columna nueva: la fórmula
correcta es `max(0, amountPaid - change - total)`, idéntica a la que usa
`history.actions.ts:255`. Extraída a `src/lib/sales/infer-tip.ts` (función
pura) con tests de los 3 casos + pago mixto + nulls.

Aplicada en `z-report.actions.ts` y `end-of-day.actions.ts`, gateada por el
mismo flag `unifyTipReporting` (sin flag = fórmula vieja, para no mover los
números sin que el OWNER decida). La descripción del flag se actualizó para
mencionar explícitamente este caso.

Efecto al prender el flag: la línea PROPINAS sube por las propinas explícitas
que antes quedaban invisibles; el efectivo en caja por fin reconcilia con el
arqueo.

### 6.0.2.b Auditoría 2026-06-05 — segunda pasada (PR #265)

Barrido de áreas no cubiertas en la primera. Confirmado OK: las 3 migraciones
matchean el schema; aislamiento por tenant correcto en promotions/server/link;
promos NO se re-aplican en los reintentos del create (están fuera del loop y
del $transaction); cache de feature flags bien particionado por tenantId.

Corregido:
- **CRÍTICO — fuga de tenant en escritura de clientes** (pre-existente, anterior
  a #263). `updateCustomerAction`/`deactivate`/`reactivate` usaban
  `db.customer.update({where:{id}})`; `withTenant` NO inyecta tenantId en
  `update`/`findUnique`/`delete` (uniques globales, ver prisma-tenant-client.ts:158)
  → un tenant podía editar/desactivar fichas de otro conociendo el id. Fix:
  `updateMany({where:{id,tenantId}})` + `findFirst` (scopeado) + chequeo de count.
- **MEDIO — motor de promos podía cobrar NaN.** `discountValue` no finito en BD
  (import/SQL crudo) producía `unitPrice`/`lineTotal` = NaN (el guard
  `discount<=0` no descarta NaN). Fix: guard `Number.isFinite` en
  `discountPerUnitFor` (engine.ts) → descuento 0 ante datos corruptos. + tests.
- **MEDIO — validación de promos incompleta.** Faltaba validar `startDate<=endDate`
  (promo "muerta" en silencio), `daysOfWeek∈0-6`, y `maxDiscountPerUnit≥0`. Fix
  en `validateInput` (promotions.actions.ts).

Notas (NO corregidas, bajo impacto / por diseño): `setTenantFeatureFlag` es
read-modify-write no atómico (lost-update si dos OWNER togglean a la vez —
raro); en pm2 cluster el `cache.delete` solo afecta al worker que togglea (los
demás sirven stale ≤30s, ya documentado); `window.location.reload()` tras
guardar promo (UX, no datos).

### 6.0.1 Cartera de Clientes (CRM) — módulo (2026-06-05)

Primera versión: **CRM (historial + análisis), solo de ahora en adelante**
(sin crédito/fiado todavía; sin backfill de ventas históricas).

**Base ya existente** (no se tocó): modelo `Customer` (`schema.prisma:2701`)
con `fullName`, `idDocument` (unique por tenant), `phone`, `email`, `address`,
`notes`, stats cacheadas `totalOrders`/`totalSpent`/`lastOrderAt`, `isActive`.
CRUD en `customer.actions.ts` + UI `/dashboard/clientes`. El POS Delivery ya
buscaba clientes (`searchCustomersAction`).

**Lo nuevo:**
- `SalesOrder.customerId` (nullable, FK SET NULL, índice) — vínculo CRM.
  Migración safe (ADD COLUMN nullable). Relación inversa `Customer.salesOrders`.
- `resolveCustomerForOrder` + `bumpCustomerStats` (`src/lib/customers/link.ts`):
  en `createSalesOrderAction`, si llega `customerId` explícito se vincula; si
  no y es DELIVERY/PICKUP con teléfono/nombre real, se hace **upsert por
  teléfono** (match por dígitos, tolera formato) y se crea ficha liviana si no
  existe → la cartera se llena sola con cada delivery. Mesas (RESTAURANT sin
  customerId) NO auto-crean (customerName suele ser la mesa). Nombres
  placeholder ("Cliente en Caja", etc.) no generan ficha. No bloquea el cobro
  si falla (devuelve null).
- Stats cacheadas: se incrementan al cobrar (`totalOrders`, `totalSpent`,
  `lastOrderAt`). **Antes nunca se actualizaban.** Son cache para ordenar/
  listar; los agregados EXACTOS de la ficha se calculan on-demand desde las
  ventas vinculadas (sin drift por anulaciones; excluye CANCELLED y PROPINA
  COLECTIVA).
- POS Delivery (`delivery/page.tsx`): estado `selectedCustomerId`, se setea al
  elegir del buscador, se limpia si la cajera edita nombre/teléfono a mano, y
  se pasa a `createSalesOrderAction` como `customerId`.
- Ficha de cliente `/dashboard/clientes/[id]` (`getCustomerDetailAction`):
  datos + agregados exactos (pedidos, total gastado, ticket promedio, primera/
  última visita) + historial de las últimas 100 órdenes. Nombre clickeable en
  la lista.
- `getTopCustomersAction(limit)` — top clientes por gasto (para análisis).
- Módulo registrado en `modules-registry.ts` (id `clientes`, sección
  operations, sortOrder 118, icon `UserCircle2`); **antes el módulo existía
  pero NO estaba en el registry → invisible en el sidebar.** Roles:
  OWNER/ADMIN_MANAGER/OPS_MANAGER/CASHIER/CHEF.

Sin flag: es additivo y de bajo riesgo. Limitación conocida: las anulaciones
no decrementan las stats cacheadas (la ficha usa el agregado exacto, que sí
las excluye). Crédito/fiado y backfill quedan para iteraciones futuras.

### 6.1 POS Restaurante

- **Ruta**: `/dashboard/pos/restaurante`
- **Página**: `src/app/dashboard/pos/restaurante/page.tsx` — **~2850 líneas**, Client Component (el archivo más grande del sistema)
- **Actions**: `pos.actions.ts` (1470 líneas) → funciones usadas:
  - `getMenuForPOSAction()` — carga menú completo para POS
  - `validateManagerPinAction(pin)` — autoriza descuentos/cortesías
  - `validateCashierPinAction(pin)` — trazabilidad de sesión de caja (solo `updateSessionCashier`)
  - `createSalesOrderAction(data)` — crea orden con descargo de inventario
  - `recordCollectiveTipAction(data)` — propina colectiva a mesoneros
  - `openTabAction(data)` — abre mesa/tab
  - `addItemsToOpenTabAction(data)` — agrega items a tab abierto (envía a cocina)
  - `registerOpenTabPaymentAction(data)` — registra pago parcial/total en tab
  - `closeOpenTabAction(tabId)` — cierra tab
  - `removeItemFromOpenTabAction(data)` — elimina item de tab
  - `getRestaurantLayoutAction()` — zonas y mesas del restaurante
  - `getUsersForTabAction()` — usuarios asignables a tabs
- **Actions adicionales**: `exchange.actions.ts` → `getExchangeRateValue()`
- **Modelos escritos**: SalesOrder, SalesOrderItem, SalesOrderItemModifier, SalesOrderPayment, OpenTab, OpenTabOrder, PaymentSplit, InvoiceCounter
- **Modelos leídos**: MenuItem, MenuCategory, MenuModifier, ExchangeRate, ServiceZone, TableOrStation, Waiter
- **Componentes**: `MixedPaymentSelector`, `PrintTicket`, `PriceDisplay`, `CashierShiftModal`, `BillDenominationInput`, `CurrencyCalculator`
- **Lógica clave**:
  - Tres flujos: **Mesa/Tab** (abrir → agregar items → enviar cocina → cobrar → cerrar), **Pickup Tabs** (múltiples pedidos de mostrador simultáneos, carrito persistente), **Subcuentas** (división por persona)
  - **Modal apertura de mesa**: campos Nombre (opcional, default `"Cliente"`), Número de personas, Mesonero asignado. El teléfono fue eliminado — el botón "Abrir cuenta" solo se bloquea durante `isProcessing`.
  - **Pickup Tabs** (`PickupTabLocal`): cada pickup es un "tab virtual" con número auto-generado `PK-01`, `PK-02`… (editable), nombre y teléfono opcionales. Sidebar muestra lista de pickups abiertos. Al cambiar de contexto (pickup↔mesa), el carrito se guarda y restaura automáticamente. Al cobrar, el tab completado se elimina y se activa el siguiente si existe.
  - Service charge 10% toggle por venta (estado local `serviceFeeIncluded`)
  - Descuentos: DIVISAS_33, CORTESIA_100, CORTESIA_PERCENT (requiere PIN gerente)
  - **DIVISAS_33 proporcional al pago (fix TAB-3048, 2026-06-23)**: el −33,33% del cobro en divisas de método único se calcula sobre la PORCIÓN pagada en ese momento, no sobre el saldo total. Antes `discountAmount = balanceDue/3` en un pago PARCIAL se llevaba el descuento de toda la mesa y el siguiente pago volvía a descontar el remanente → sobre-descuento (mesa pagada en cuotas cash+zelle cobraba de menos ~$6–9). Ahora la liquidación sale de `computeDivisasSettlement()` (`src/lib/sales/divisas-settlement.ts`, función pura testeada): `grossSettled = min(balanceDue, recibido / (⅔·serviceMult))`, `discount = grossSettled/3`, `netItems = grossSettled·⅔`. Pago completo = idéntico a `balanceDue/3` (sin cambios). En divisas el cliente manda `amount = netItems` y el dinero entregado en `paidAmountOverride` (nuevo campo de `RegisterOpenTabPaymentInput`; si se omite, `paidAmount = amount`). El **pago MIXTO de mesa** (MixedPaymentSelector) también usa la función pura para el descuento (`mixedDivisasDiscount`): mixto todo-divisas converge a `balanceDue/3` correcto, y divisas+Bs descuenta solo la porción en divisas. **Pendiente separado**: el mixto de PICKUP (`divisasUsdAmountPickup/3`, otro handler) tiene la misma raíz y aún no se tocó.
  - Pago único (7 métodos) o mixto (MixedPaymentSelector)
  - PaymentSplit: dividir cuenta por persona en mesa
  - Descargo automático de inventario vía `inventory.service.registerSale()`
  - **Copiar consumos para WhatsApp** (botones en card "Consumos cargados"): "Copiar nuevos" copia solo los ítems agregados desde la última vez que se copió (dedupe por `OrderItem.id` persistida en `localStorage` con clave `posResto:copiedConsumos:<openTabId>`); "Todo" copia toda la cuenta y reinicia el conteo. El localStorage se limpia al cerrar la cuenta. Formato: `Mesa <name> — <waiter>` + lista `<qty>× <item>` con modificadores indentados
  - **Copiar consumos en pickup**: mismos dos botones bajo el input "Nombre del cliente" en modo pickup. Dedupe por **cantidad de ítems del cart ya copiados** (no hay ID estable en `CartItem`), persistida en `localStorage` con clave `posResto:copiedPickupCount:<pickupTabId>`. Si la cajera borra un ítem y el cart encoge por debajo del contador, se reinicia automáticamente. Se limpia al pagar o descartar el pickup tab. Formato: `Pickup <PK-NN> — <cliente>` + lista `<qty>× <item> (Para llevar)` con modificadores y notas indentadas
- **Impresión** (`src/lib/print-command.ts` → `printReceipt`):
  - `ReceiptData.tableLabel?: string` — nombre de mesa impreso bajo el correlativo (ej. `Mesa: Interior 3`)
  - `ReceiptData.tipAmount?: number` — propina impresa como línea informativa tras el 10% servicio
  - Descuento siempre visible: DIVISAS_33 imprime `Desc. divisas (33.33%): -$XX` (ya no se oculta con `hideDiscount`)
- **Estado**: Funcional
- **Valores hardcodeados** (detallados en Sección 11)

### 6.2 POS Mesero

- **Ruta**: `/dashboard/pos/mesero`
- **Página**: `src/app/dashboard/pos/mesero/page.tsx` — Client Component
- **Actions**: `pos.actions.ts` (subset: solo apertura de tab y agregar items, sin cobro)
- **Modelos**: OpenTab, SalesOrder, SalesOrderItem, MenuItem
- **Lógica**: Vista simplificada del POS Restaurante. Mesonero toma pedido por mesa, agrega items, envía a cocina. **No tiene acceso a cobro ni cierre de mesa.**
- **Conexiones**: → OpenTab (abre/agrega items) → SalesOrder (crea con kitchenStatus: SENT)
- **Estado**: Funcional
- **enabledByDefault**: false (debe habilitarse manualmente)

### 6.3 POS Delivery

- **Ruta**: `/dashboard/pos/delivery`
- **Página**: `src/app/dashboard/pos/delivery/page.tsx` — **898 líneas**, Client Component
- **Actions**: `pos.actions.ts` → `createSalesOrderAction()`, `getMenuForPOSAction()`, `validateManagerPinAction()`; `exchange.actions.ts` → `getExchangeRateValue()`
- **Modelos escritos**: SalesOrder, SalesOrderItem, SalesOrderPayment, InvoiceCounter
- **Lógica clave**:
  - Solo venta directa (sin tabs/mesas)
  - Delivery fee automático: $4.50 normal / $3.00 divisas (**hardcodeado**)
  - Mismos descuentos: DIVISAS_33, CORTESIA_100, CORTESIA_PERCENT
  - Impresión de comanda + factura configurable por POSConfig (localStorage)
- **Valores hardcodeados**:
  ```typescript
  // src/app/dashboard/pos/delivery/page.tsx:15-16
  const DELIVERY_FEE_NORMAL = 4.5;
  const DELIVERY_FEE_DIVISAS = 3;
  ```
- **Estado**: Funcional

### 6.4 PedidosYA

- **Ruta**: `/dashboard/pos/pedidosya`
- **Página**: `src/app/dashboard/pos/pedidosya/page.tsx` — Client Component
- **Actions**: `pedidosya.actions.ts` → `createPedidosYAOrderAction(data)`; `pos.actions.ts` → `getMenuForPOSAction()`
- **Modelos**: SalesOrder, SalesOrderItem
- **Lógica**: Carga órdenes de PedidosYA. Usa precios `pedidosYaPrice` del MenuItem si existen, sino precio normal. Canal: `PEDIDOS_YA`. No maneja pagos (PedidosYA cobra directamente).
- **Lib**: `src/lib/pedidosya-price.ts` — lógica de precio PedidosYA
- **Estado**: Funcional
- **enabledByDefault**: false

### 6.4.1 WINK (canal de venta, espejo de PedidosYA)

- **Ruta**: `/dashboard/pos/wink` · módulo `wink` (registry, `enabledByDefault: false`, icono `Truck`).
- **Página**: `src/app/dashboard/pos/wink/page.tsx` — Client Component, copia adaptada de PedidosYA.
- **Action**: `src/app/actions/wink.actions.ts` → `createWinkOrderAction(data)` (orderType `WINK`, sourceChannel `POS_WINK`, paymentMethod `WINK`, status PAID — WINK cobra). Descarga inventario por receta igual que PedidosYA/Delivery.
- **Correlativo**: canal `WINK` → prefijo `WNK-####` (`invoice-counter.ts`).
- **Precio**: campo `MenuItem.winkPrice Float?` (migración `20260618120000_add_wink_price_to_menuitem`). **Default = precio base** (`winkPrice ?? price`); NO hay fórmula de descuento (a diferencia de PedidosYA). Override editable **solo por gerente** vía `updateMenuItemWinkPriceAction` gated por `PERM.EDIT_WINK_PRICE` (otorgado a OWNER/ADMIN_MANAGER/OPS_MANAGER). UI en `/dashboard/menu`: input WINK editable si `canEditWinkPriceAction()` true, si no chip read-only.
- **Reportes**: ya contemplado en Z/fin-de-día (`byType.wink` por `orderType === 'WINK'`) y agregado a `getSalesByChannel` (sales-reports.ts) con label `WINK`. print-command.ts ya tenía la fila Wink.
- **Estado**: Funcional.

### 6.5 Cargar Ventas

- **Ruta**: `/dashboard/ventas/cargar`
- **Página**: `src/app/dashboard/ventas/cargar/page.tsx` — Client Component
- **Actions**: `sales-entry.actions.ts` → 7 funciones:
  - `getMenuItemsForSalesAction()` / `getMenuCategoriesAction()`
  - `createSalesEntryAction(data)` — crea SalesOrder manual (sourceChannel configurable)
  - `getTodaySalesAction()` — ventas del día
  - `getSalesAreasAction()` — áreas disponibles
  - `voidSalesOrderAction(params)` — anular venta
  - `getSalesSummaryAction(startDate, endDate)` — resumen
- **Modelos**: SalesOrder, SalesOrderItem, MenuItem, MenuCategory, Area
- **Lógica**: Carga manual de ventas externas (plataformas, eventos). Permite crear órdenes sin pasar por el POS. Útil para registrar ventas de canales que no usan el sistema directamente.
- **Estado**: Funcional

### 6.6 Historial Ventas

- **Ruta**: `/dashboard/sales`
- **Página**: `src/app/dashboard/sales/page.tsx` — Client Component
- **Actions**: `sales.actions.ts` (810 líneas) → 5 funciones:
  - `getSalesHistoryAction(date?)` — listado de ventas por fecha
  - `getSalesForArqueoAction(date)` — datos para arqueo de caja
  - `getDailyZReportAction(date?)` — Reporte Z completo del día
  - `voidSalesOrderAction(params)` — anulación con PIN y razón
  - `getEndOfDaySummaryAction(date?)` — resumen de cierre del día
- **Actions adicionales**: `pos.actions.ts` → `validateManagerPinAction(pin)` (anulaciones)
- **Modelos**: SalesOrder, SalesOrderItem, SalesOrderPayment, PaymentSplit, OpenTab
- **Lógica clave**:
  - **Reporte Z**: Agrupa ventas por método de pago, calcula totales Bs/USD, service charge (detectado por splitLabel `+10% serv`), descuentos, anulaciones
  - **Arqueo**: Exporta a Excel vía `export-arqueo-excel.ts`
  - **Anulación**: Requiere PIN de cajera, razón obligatoria, marca `voidedAt/voidedById/voidReason`
- **Libs**: `export-z-report.ts`, `export-arqueo-excel.ts`, `arqueo-excel-utils.ts`
- **Estado**: Funcional
- **Gap**: Service charge se detecta por string matching (`splitLabel.includes('| +10% serv')`) — frágil

### 6.7 Comandera Cocina

- **Ruta**: `/kitchen`
- **Página**: `src/app/kitchen/page.tsx` — Client Component (fuera de `/dashboard`, sin sidebar)
- **API**: `src/app/api/kitchen/orders/route.ts` → GET (órdenes pendientes) + PATCH (actualizar estado)
- **Modelos**: SalesOrder (filtrado por `kitchenStatus: 'SENT'`), SalesOrderItem, MenuItem, MenuCategory
- **Lógica**:
  - Polling constante al API route (no Server Actions — necesita refresh sin navegación)
  - Filtra items: excluye categoría "Bebidas" (constante `BAR_CATEGORIES = ['Bebidas']`)
  - PATCH actualiza `kitchenStatus` de la orden
  - Impresión de comanda vía `printKitchenCommand()` (`src/lib/print-command.ts`)
- **Conexiones**: ← SalesOrder (órdenes con kitchenStatus SENT), → SalesOrder (marca como READY)
- **Estado**: Funcional
- **Gap**: `BAR_CATEGORIES` hardcodeado — debería ser configurable

### 6.8 Comandera Barra

- **Ruta**: `/kitchen/barra`
- **Página**: `src/app/kitchen/barra/page.tsx` — Client Component
- **API**: Mismo `src/app/api/kitchen/orders/route.ts` con `?station=bar`
- **Lógica**: Idéntica a Comandera Cocina pero filtro invertido: **solo** categoría "Bebidas"
- **Estado**: Funcional

### 6.9 Configuración POS

- **Ruta**: `/dashboard/config/pos`
- **Página**: `src/app/dashboard/config/pos/page.tsx` — Server Component (lee SystemConfig)
- **Actions**: `system-config.actions.ts` → `getStockValidationEnabled()`, `setStockValidationEnabled()`
- **Lib**: `src/lib/pos-settings.ts` — POSConfig en localStorage (por terminal/estación):
  ```typescript
  interface POSConfig {
    printComandaOnDelivery: boolean;      // default: false
    printReceiptOnDelivery: boolean;      // default: true
    printComandaOnRestaurant: boolean;    // default: true
    printReceiptOnRestaurant: boolean;    // default: true
    stockValidationEnabled: boolean;      // default: false
  }
  ```
- **Lógica**: Configuración híbrida — `stockValidationEnabled` se lee de BD (SystemConfig) + localStorage. El resto es solo localStorage. Cada terminal puede tener configuración distinta.
- **Estado**: Funcional
- **Gap**: Mezcla de BD y localStorage dificulta administración centralizada

### Flujo POS Completo End-to-End

```
1. Cajera abre POS
   ├── getMenuForPOSAction() → carga menú completo (categorías, items, modificadores, precios)
   └── getExchangeRateValue() → tasa del día para conversión Bs

2. Selecciona items → arma carrito (CartItem[])
   └── Cada CartItem: { menuItemId, name, price, quantity, modifiers[], notes? }

3A. RESTAURANTE (mesa):
   ├── openTabAction() → crea OpenTab + asigna zona/mesa/mesonero
   ├── addItemsToOpenTabAction() → crea SalesOrder con kitchenStatus: SENT
   │   └── Cocina: /kitchen ve la orden → marca como READY
   ├── registerOpenTabPaymentAction() → pago parcial/total → PaymentSplit
   │   ├── Pago único → 1 SalesOrderPayment
   │   └── Pago mixto → N SalesOrderPayment (MixedPaymentSelector)
   └── closeOpenTabAction() → cierra tab, actualiza totales

3B. DELIVERY (directo):
   └── createSalesOrderAction() → crea SalesOrder + items + pagos + descargo inventario
       ├── Calcula delivery fee ($4.50 normal / $3.00 divisas)
       ├── Aplica descuento si aplica (DIVISAS_33 / CORTESIA)
       ├── Registra SalesOrderPayment[]
       ├── registerSale() → descuenta ingredientes por receta de cada item
       └── getNextCorrelativo('DELIVERY') → número único DEL-0042

4. Descargo automático de inventario (inventory.service.ts)
   ├── Para cada SalesOrderItem con MenuItem que tiene recipeId:
   │   ├── Busca Recipe → RecipeIngredient[]
   │   └── Crea InventoryMovement(SALE) por cada ingrediente
   └── Actualiza InventoryLocation.currentStock

5. Post-venta
   ├── Historial: /dashboard/sales → getSalesHistoryAction()
   ├── Reporte Z: getDailyZReportAction() → agrupa por método de pago
   ├── Arqueo: getSalesForArqueoAction() → exporta Excel
   └── Anulación: voidSalesOrderAction() → marca voidedAt, requiere PIN
```

### Valores Hardcodeados en POS (candidatos a Panel Admin)

| Valor | Archivo | Línea | Descripción |
|-------|---------|-------|-------------|
| `DELIVERY_FEE_NORMAL = 4.5` | `pos.actions.ts` | 263 | Tarifa delivery pago Bs |
| `DELIVERY_FEE_DIVISAS = 3` | `pos.actions.ts` | 264 | Tarifa delivery pago divisas |
| `DELIVERY_FEE_NORMAL = 4.5` | `delivery/page.tsx` | 15 | Duplicado en frontend |
| `DELIVERY_FEE_DIVISAS = 3` | `delivery/page.tsx` | 16 | Duplicado en frontend |
| `* 0.1` (10% servicio) | `restaurante/page.tsx` | 696, 769 | Service charge restaurante |
| `* 1.1` (total + 10%) | `restaurante/page.tsx` | 430 | Monto con servicio incluido |
| `DIVISAS_33` (1/3 descuento) | `pos.actions.ts` | 276-280 | Descuento divisas fijo |
| `CORTESIA_100` | `pos.actions.ts` | 285-286 | Cortesía 100% |
| `CORTESIA_PERCENT` | `pos.actions.ts` | 290-292 | Cortesía porcentaje variable |
| `'| +10% serv'` | `sales.actions.ts` | 120,264,428,737 | Detección service charge por string |
| `BAR_CATEGORIES = ['Bebidas']` | `api/kitchen/orders/route.ts` | 7 | Categorías que van a barra |

### Métodos de Pago Hardcodeados (3 archivos)

**`MixedPaymentSelector.tsx:23-31`**:
```typescript
const METHODS = [
  { id: 'CASH_USD',       label: '💵 Cash $' },
  { id: 'CASH_EUR',       label: '€ Cash €' },
  { id: 'ZELLE',          label: '⚡ Zelle' },
  { id: 'CASH_BS',        label: '💴 Efectivo Bs' },
  { id: 'PDV_SHANKLISH',  label: '💳 PDV Shanklish' },
  { id: 'PDV_SUPERFERRO', label: '💳 PDV Superferro' },
  { id: 'MOVIL_NG',       label: '📱 Pago Móvil NG' },
  { id: 'CORTESIA',       label: '🎁 Cortesía' },
];
const BS_METHODS = new Set(['CASH_BS','PDV_SHANKLISH','PDV_SUPERFERRO','MOVIL_NG','MOBILE_PAY','CARD','TRANSFER']);
```

**`restaurante/page.tsx:147-149`**:
```typescript
const BS_SINGLE_METHODS = new Set(["PDV_SHANKLISH","PDV_SUPERFERRO","MOVIL_NG","CASH_BS"]);
const SINGLE_PAY_METHODS = ["CASH_USD","CASH_EUR","ZELLE","PDV_SHANKLISH","PDV_SUPERFERRO","MOVIL_NG","CASH_BS"];
```

**`delivery/page.tsx:226`**: Idéntico `BS_SINGLE_METHODS` inline.

---

## 7. Módulos de ADMINISTRACIÓN (14 módulos)

### 7.1 Usuarios

- **Ruta**: `/dashboard/usuarios`
- **Página**: Server Component — importa `getUsers()` + `getEnabledModulesFromDB()`
- **Actions**: `user.actions.ts` → 9 funciones:
  - `getUsers()` — lista con roles, allowedModules, grantedPerms, revokedPerms, pinSet
  - `updateUserRole(userId, newRole)` — cambia rol
  - `toggleUserStatus(userId, isActive)` — activar/desactivar
  - `changePasswordAction(currentPassword, newPassword)` — cambio propio (usa PBKDF2)
  - `updateUserModules(userId, allowedModules)` — asigna módulos individuales
  - `updateUserPin(userId, rawPin)` — asigna/cambia PIN de otro usuario (requiere MANAGE_USERS)
  - `updateUserPerms(userId, grantedPerms, revokedPerms)` — sobreescribe permisos granulares
  - **`createUserAction(data)`** — crea usuario nuevo; requiere MANAGE_USERS; hashea password con PBKDF2; valida email único; retorna `{ success, user, message }`
  - **`adminResetPasswordAction(userId, newPassword)`** — resetea contraseña de otro usuario; requiere OWNER o ADMIN_MANAGER; no puede resetear la propia
- **Modelos**: User (schema completo, no requiere migración para estas funciones)
- **Componentes**: `PinSection`, `PasswordResetSection`, `PermsSection`, `CreateUserModal` (todos en `users-view.tsx`)
- **Middleware**: Ruta protegida — solo OWNER, ADMIN_MANAGER
- **Estado**: Funcional

#### Crear Usuario (`CreateUserModal`)

- **Dónde**: Botón "➕ Nuevo Usuario" en el header de `/dashboard/usuarios`, visible solo para `canManageUsers`
- **Modal**: `z-60`, backdrop `bg-black/75 backdrop-blur-sm`, card `bg-card border border-border rounded-2xl`
- **Campos**: firstName, lastName, email, password (min 6 chars), rol (select con todos los roles)
- **Validaciones cliente**: todos los campos requeridos; server: email único, longitud password, formato email
- **Al guardar**: usuario nuevo aparece al tope de la lista y queda seleccionado — sin recarga de página
- **Password**: hasheado con PBKDF2-SHA256 antes de guardarse (ver `src/lib/password.ts`)

#### Resetear Contraseña de Otro Usuario (`PasswordResetSection`)

- **Dónde**: Panel lateral derecho, debajo de `PinSection`, visible solo para OWNER/ADMIN_MANAGER y cuando el seleccionado no es el mismo admin
- **Validación**: mínimo 6 caracteres; el servidor rechaza `session.id === userId`
- **Password resultante**: hasheada con PBKDF2-SHA256

#### Panel de Permisos Granulares (`PermsSection`)

UI dentro de `/dashboard/usuarios` para gestionar la Capa 4:
- Muestra los 17 permisos agrupados en 4 grupos (`PERM_GROUPS`) con checkboxes tri-estado: **base** (gris — del rol), **granted** (verde — añadido), **revoked** (rojo — quitado)
- Solo aparece la opción de revocar para permisos que el rol base tiene; solo aparece grant para los que no tiene
- Persiste con `updateUserPermsAction(userId, granted[], revoked[])`
- Visible solo para OWNER/ADMIN_MANAGER

#### Gestión de PINs

- **Dónde**: Panel lateral derecho de `/dashboard/usuarios` → sección "PIN de acceso (POS)"
- **Quién puede asignar**: Roles con `MANAGE_USERS` (nivel 70+: OWNER, ADMIN_MANAGER, OPS_MANAGER)
- **Restricción**: Un usuario no puede modificar su propio PIN desde este panel (`session.id === userId` → error)
- **Validación**: Numérico estricto, 4–6 dígitos (`/^\d{4,6}$/`)
- **Almacenamiento**: Nunca en texto plano — se hashea con PBKDF2-SHA256 antes de guardar en BD
- **Indicador visual**: `PinSection` muestra badge "Asignado" (verde) o "Sin PIN" (ámbar) según `pinSet: boolean` proveniente de `getUsers()`. El campo `pin` nunca se expone al cliente — solo el boolean derivado.

#### Bug PIN resuelto (2026-04-11) — Zustand vs JWT desconectados

**Causa raíz**: `loginAction` creaba el cookie JWT con el ID real del usuario en BD, pero **nunca llamaba `useAuthStore().login()`**. El store Zustand quedaba inicializado con `mockCurrentUser` (id: `'user-admin'`) de forma permanente, persisitido en localStorage.

Consecuencia directa: la guardia UI `selectedUser.id !== currentUser?.id` comparaba contra `'user-admin'` (siempre distinto de cualquier ID real), por lo que el botón "Guardar PIN" aparecía incluso cuando el OWNER seleccionaba su propio usuario. En el servidor, `session.id === userId` (ambos el ID real del OWNER) lo bloqueaba correctamente, devolviendo `{ success: false }`. El toast de error se mostraba pero el origen del problema no era evidente.

**Fix aplicado (commit `82cfb00`)**:
- `auth.actions.ts`: `loginAction` ya **no hace `redirect()` server-side**. Retorna `{ success: true, user: { id, email, firstName, lastName, role } }` con datos reales de BD.
- `login-form-client.tsx`: Al recibir `success: true`, llama `login(result.user)` en el store Zustand y luego `router.push('/dashboard')` client-side. El store siempre refleja el usuario real del JWT.
- `user.actions.ts` → `getUsers()`: añade `pin: true` al select y lo mapea a `pinSet: pin !== null` — el hash PBKDF2 nunca llega al cliente.
- `users-view.tsx`: interfaz `User` incluye `pinSet: boolean`; `PinSection` recibe `pinSet` y `onSaved()` que actualiza estado local al guardar; `ModulesPanelProps` incluye `onPinSaved`.

**Regla permanente**: `currentUser.id` en el cliente viene del store Zustand (sincronizado en login). `session.id` en el servidor viene del JWT cookie. Deben ser idénticos tras el login. Cualquier lógica de "auto-edición bloqueada" debe verificarse en el servidor — la UI puede tener estado stale.

#### Hashing PBKDF2 — Fuente Autoritativa

- **Archivo compartido**: `src/lib/password.ts` — exporta `hashPassword(password)` y `verifyPassword(password, stored)`
- **Archivo de PINs**: `src/app/actions/user.actions.ts` — exporta `hashPin(rawPin)` y `pbkdf2Hex(pin, saltHex)` (mismo algoritmo, sección específica para PINs)
- **Algoritmo**: PBKDF2-SHA256, 100 000 iteraciones, salt aleatorio de 16 bytes por hash
- **Formato en BD**: `"saltHex:hashHex"` — si no contiene `:` se trata como contraseña/PIN legado en texto plano (retrocompatibilidad con usuarios creados antes del hashing)
- **Login retrocompatible**: `auth.actions.ts` → `verifyPassword(password, user.passwordHash)` detecta automáticamente si es PBKDF2 o texto plano

#### Regla permanente: contraseñas en texto plano (usuarios legacy)

> Existen usuarios en producción con `passwordHash` en texto plano (creados antes de 2026-04-11). `verifyPassword()` los soporta detectando la ausencia de `:`. Al cambiar o resetear la contraseña, se guarda en PBKDF2 automáticamente — migración progresiva sin script.
- **Uso en POS**: `pos.actions.ts` importa `hashPin` y `pbkdf2Hex` desde `user.actions.ts`; `verifyPin()` permanece local en `pos.actions.ts`

### 7.2 Módulos por Usuario

- **Ruta**: `/dashboard/config/modulos-usuario`
- **Página**: Server Component — importa `getUsers()` + `getEnabledModulesFromDB()`
- **Actions**: `user.actions.ts` → `updateUserModules(userId, allowedModules | null)`
- **Modelos**: User (campo `allowedModules` JSON array)
- **Lógica**: Seleccionar usuario → ver/editar checkboxes de módulos permitidos. `null` = acceso por rol completo, array = solo esos módulos.
- **Estado**: Funcional

### 7.3 Roles y Permisos

- **Ruta**: `/dashboard/config/roles`
- **Página**: Server Component — importa `getUsers()`
- **Actions**: `user.actions.ts` → `updateUserRole(userId, newRole)`
- **Lógica**: Vista de usuarios agrupados por rol. Permite reasignar roles respetando jerarquía (`canManageRole()`).
- **Estado**: Funcional

**Nota**: La configuración de permisos granulares (grantedPerms/revokedPerms) vive en `/dashboard/usuarios` dentro del panel de cada usuario (`PermsSection`), no en esta página. Esta página solo cambia el rol base.

### 7.4 Módulos (toggle por instalación)

- **Ruta**: `/dashboard/config/modules`
- **Página**: Server Component — importa `getEnabledModulesFromDB()`
- **Actions**: `system-config.actions.ts` → 4 funciones:
  - `getEnabledModulesFromDB()` — lee `SystemConfig['enabled_modules']`
  - `saveEnabledModules(moduleIds[])` — guarda módulos activos
  - `getStockValidationEnabled()` / `setStockValidationEnabled(enabled)`
- **Modelos**: SystemConfig
- **Lógica**: OWNER activa/desactiva módulos para toda la instalación. Lee `MODULE_REGISTRY` como catálogo, guarda selección en BD.
- **Acceso**: Solo OWNER
- **Estado**: Funcional

### 7.5 Almacenes

- **Ruta**: `/dashboard/almacenes`
- **Página**: Server Component — importa `getAreasAction()`
- **Actions**: `areas.actions.ts` → 4 funciones:
  - `getAreasAction()` — lista de áreas con branchId
  - `createAreaAction(data)` — crear área nueva
  - `toggleAreaStatusAction(id, isActive)` — activar/desactivar
  - `findDuplicateAreasAction()` — detecta nombres duplicados
- **Modelos**: Area, Branch
- **Estado**: Funcional

### 7.6 Tasa de Cambio

- **Ruta**: `/dashboard/config/tasa-cambio`
- **Página**: Server Component — importa `getExchangeRateHistory()`
- **Actions**: `exchange.actions.ts` → 5 funciones:
  - `getCurrentExchangeRate()` — última tasa activa
  - `getExchangeRateForDisplay()` — formateada para UI
  - `getExchangeRateValue()` — solo número (usado por POS)
  - `setExchangeRateAction(rate, effectiveDate)` — registra nueva tasa
  - `getExchangeRateHistory(limit)` — historial
- **Modelos**: ExchangeRate
- **Conexiones**: → POS (conversión Bs/USD en pagos), → SalesOrder.exchangeRateValue (snapshot)
- **Estado**: Funcional

### 7.7 Anuncios a Gerencia

- **Ruta**: `/dashboard/anuncios`
- **Página**: Server Component — importa `getAllBroadcastsAdminAction()`
- **Actions**: `notifications.actions.ts` → 4 funciones:
  - `getNotificationsAction()` — anuncios activos para el usuario (filtro por rol + fecha)
  - `createBroadcastAction(input)` — crea anuncio con targetRoles, fecha inicio/expiración
  - `getAllBroadcastsAdminAction()` — todos los anuncios (admin view)
  - `dismissBroadcastAction(id)` — marcar como leído (localStorage)
- **Modelos**: BroadcastMessage
- **Componentes**: `NotificationBell` en Navbar — muestra campana con contador de no leídos
- **Lógica**: Los anuncios se filtran por: `isActive`, `targetRoles` incluye rol del usuario, `startsAt <= now`, `expiresAt > now || null`
- **Estado**: Funcional

### 7.8 Objetivos y Metas

- **Ruta**: `/dashboard/metas`
- **Página**: Server Component — importa `getMetasAction()`
- **Actions**: `metas.actions.ts` → 2 funciones:
  - `getMetasAction()` — lee metas actuales + progreso vs ventas reales
  - `saveMetasAction(input)` — guarda targets en SystemConfig (keys: `meta_diaria`, `meta_semanal`, `meta_mensual`, `merma_aceptable_pct`)
- **Modelos**: SystemConfig (lectura/escritura), SalesOrder (lectura para progreso)
- **Lógica**: Fijar metas de venta (diaria, semanal, mensual) y % de merma aceptable. Muestra progreso en tiempo real comparando ventas actuales vs targets.
- **Conexiones**: ← SalesOrder (ventas actuales) vs SystemConfig (targets)
- **Estado**: Funcional

### 7.9 Dashboard Financiero

- **Ruta**: `/dashboard/finanzas`
- **Página**: Server Component — importa `getFinancialSummaryAction()` + `getMonthlyTrendAction()`
- **Actions**: `finance.actions.ts` → 3 funciones:
  - `getFinancialSummaryAction(month?, year?)` — P&L mensual completo con:
    - Ingresos: ventas totales, ticket promedio, desglose por tipo (Restaurant/Delivery), por método de pago, ventas diarias del mes
    - COGS: calculado desde `SalesOrderItem.costTotal` (no desde PurchaseOrder)
    - Gastos operativos: por categoría con % del total, top 5 gastos individuales
    - Cuentas por pagar: pendientes, vencidas, aging report (0-30, 31-60, 61-90, 90+ días)
    - Flujo de caja: inflows (ventas), outflows (gastos + pagos a proveedores), neto
    - P&L: utilidad bruta (ventas - COGS), utilidad operativa (bruta - gastos), márgenes %
    - MoM (Month-over-Month): % cambio vs mes anterior en ventas, gastos, utilidad, # órdenes
  - `getMonthlyTrendAction(months)` — tendencia de últimos N meses con ventas, COGS, gastos y utilidad (profit = sales - cogs - expenses)
  - `getDailySalesAction(month, year)` — ventas agrupadas por día del mes
- **Vista** (`finanzas-view.tsx`): Dashboard con 10 secciones:
  1. KPI Cards con badges MoM (ventas, ticket promedio, gastos, utilidad)
  2. Flujo de Caja (3 tarjetas: entradas, salidas, neto)
  3. Estado de Resultados P&L formal (ventas → COGS → utilidad bruta → gastos → utilidad operativa)
  4. Gráficas: LineChart ventas diarias + PieChart donut gastos por categoría
  5. BarChart tendencia 6 meses (ventas, COGS, gastos, utilidad)
  6. Top 5 gastos del período + ventas por método de pago con barras de progreso
  7. Alertas financieras expandidas (6 tipos: deudas vencidas, pérdida operativa, margen bruto bajo <30%, ratio gastos alto >40%, caída ventas MoM >15%, flujo de caja negativo) con severidad critical/warning/info
  8. Cuentas por pagar pendientes (3 tarjetas: deudas, vencido, compras)
  9. Aging report de deudas (4 buckets coloreados azul→rojo)
- **Exportación Excel**: Botón "📥 Exportar Excel" genera archivo `.xlsx` con ExcelJS — incluye P&L completo (ventas por tipo, COGS, utilidad bruta, gastos por categoría, utilidad operativa) + sección Flujo de Caja
- **Modelos**: SalesOrder + SalesOrderItem (ingresos + COGS), Expense (gastos), AccountPayable + AccountPayment (deudas + pagos)
- **Conexiones**: ← SalesOrder.total (ingresos), ← SalesOrderItem.costTotal (COGS), ← Expense.amountUsd (gastos), ← AccountPayable.remainingUsd (deudas), ← AccountPayment.amountUsd (pagos del período para flujo de caja)
- **Charts**: recharts (BarChart, LineChart, PieChart con Pie + Cell)
- **Dependencias**: ExcelJS (exportación Excel)
- **Widget en Dashboard Home** (`page.tsx`): Resumen financiero del mes con 5 tarjetas (Ventas, Gastos, Utilidad, Flujo Neto, Deudas) + indicadores MoM + enlace "Ver detalle →" a `/dashboard/finanzas`. Visible solo para roles con `VIEW_COSTS`. Fetch paralelo con `Promise.all` junto a stats generales.
- **Acceso rápido**: Tarjeta "Finanzas" en sección de accesos rápidos del dashboard home (solo roles con `VIEW_COSTS`)
- **Estado**: Funcional — Mejorado con MoM, flujo de caja, gráficas, aging report, exportación Excel P&L, alertas expandidas 6 tipos, widget resumen en dashboard home

### 7.10 Gastos

- **Ruta**: `/dashboard/gastos`
- **Página**: Server Component — importa `getExpensesAction()` + `getExpenseCategoriesAction()`
- **Actions**: `expense.actions.ts` → 6 funciones:
  - `getExpenseCategoriesAction()` / `createExpenseCategoryAction(input)` / `updateExpenseCategoryAction(id, data)`
  - `getExpensesAction(filters)` — filtro por categoría, fecha, status
  - `createExpenseAction(input)` — registro con categoría, monto USD/Bs, método de pago, período
  - `voidExpenseAction(id, reason)` — anula gasto
- **Vista** (`gastos-view.tsx`): Módulo con analítica visual:
  - KPI Cards con MoM comparison (% cambio vs mes anterior, inverted logic: gastos menores = verde)
  - Desglose por categoría con barras de progreso (existente)
  - PieChart donut distribución por categoría + BarChart horizontal por método de pago
  - BarChart tendencia 6 meses de gastos (carga automática vía useEffect, llama `getExpensesAction` por cada mes)
  - Filtros avanzados: por categoría y por método de pago con conteo dinámico
  - Tabla detallada con filtrado aplicado
  - Modales: crear gasto, crear categoría, anular gasto
- **Exportación Excel**: Botón "📥 Exportar Excel" genera archivo `.xlsx` con ExcelJS — tabla de gastos filtrados (Fecha, Descripción, Categoría, Método de Pago, Monto USD, Registrado por) + fila TOTAL
- **Charts**: recharts (PieChart, BarChart horizontal, BarChart tendencia 6 meses)
- **Dependencias**: ExcelJS (exportación Excel)
- **Modelos**: Expense, ExpenseCategory
- **Conexiones**: → Finanzas (P&L como gasto operativo), → Caja (gastos del turno)
- **Estado**: Funcional — Mejorado con gráficas donut/barras, MoM, filtros avanzados, tendencia 6 meses, exportación Excel

### 7.11 Control de Caja

- **Ruta**: `/dashboard/caja`
- **Página**: Server Component — importa `getCashRegistersAction()`
- **Actions**: `cash-register.actions.ts` → 4 funciones:
  - `getCashRegistersAction(filters)` — lista de cajas por fecha/status
  - `openCashRegisterAction(input)` — apertura con fondo inicial USD/Bs + desglose billetes
  - `closeCashRegisterAction(input)` — cierre: conteo final, calcula diferencia vs esperado
  - `updateRegisterOperatorsAction(id, operators[])` — asigna operadoras al turno
- **Vista** (`caja-view.tsx`): Módulo con analítica de cuadre:
  - Cajas abiertas con gestión de operadoras y cambio de turno (existente)
  - Resumen mensual KPIs: ventas del mes, gastos del mes, diferencia acumulada, precisión de cuadre (% turnos sin diferencia)
  - BarChart mini tendencia de diferencias por cierre (positivo=sobrante, negativo=faltante) con ReferenceLine en 0
  - Historial de cierres con desglose de billetes (existente)
  - Modales: abrir caja, cerrar caja, desglose billetes, gestión operadoras
- **Charts**: recharts (BarChart con ReferenceLine)
- **Modelos**: CashRegister
- **Componentes**: `BillDenominationInput` — entrada de billetes por denominación
- **Conexiones**: ← SalesOrder (ventas del turno para calcular esperado), ← Expense (gastos del turno)
- **Lógica**: Apertura → ventas del día → cierre con conteo → `expectedCash = apertura + ventas_efectivo - gastos` → `difference = cierre_contado - esperado`
- **Estado**: Funcional — Mejorado con KPIs mensuales, gráfica de tendencia diferencias, precisión de cuadre

### 7.12 Cuentas por Pagar

- **Ruta**: `/dashboard/cuentas-pagar`
- **Página**: Server Component — importa `getAccountsPayableAction()` + `getSuppliersAction()`
- **Actions**: `account-payable.actions.ts` → 3 funciones:
  - `getAccountsPayableAction(filters)` — filtro por status, proveedor, fecha
  - `createAccountPayableAction(input)` — nueva deuda (manual o desde PurchaseOrder)
  - `registerPaymentAction(input)` — pago parcial/total → actualiza `paidAmountUsd`, `remainingUsd`, `status`
- **Vista** (`cuentas-pagar-view.tsx`): Módulo con análisis de deudas:
  - KPI Cards: pendiente, vencido, pagado, # acreedores (existente)
  - Aging report: 5 buckets (Vigente, 0-30, 31-60, 61-90, 90+ días) coloreados verde→rojo
  - Top acreedores: ranking de proveedores por monto pendiente con barras de progreso proporcionales
  - Próximos vencimientos (14 días): lista con badges (HOY, MAÑANA, Nd) coloreados por urgencia
  - Filtros (Activas/Todas/Pagadas) + tabla expandible con historial de pagos (existente)
  - Modales: crear cuenta, registrar pago
- **Modelos**: AccountPayable, AccountPayment, Supplier, PurchaseOrder
- **Conexiones**: ← PurchaseOrder (puede crear deuda al recibir), ← Supplier (acreedor), → Finanzas (deudas pendientes en P&L)
- **Estado**: Funcional — Mejorado con aging report, ranking acreedores, alertas de vencimiento

### 7.13 Intercompany

- **Ruta**: `/dashboard/intercompany`
- **Página**: Server Component — importa `getSettlements()`
- **Actions**: `intercompany.actions.ts` → 4 funciones:
  - `getSettlements(filters)` — lista por status, período
  - `getSettlementById(id)` — detalle con líneas
  - `createSettlement(data)` — nueva liquidación entre negocios
  - `approveSettlement(id)` — aprobación
- **Modelos**: IntercompanySettlement, IntercompanySettlementLine, IntercompanyItemMapping
- **Lógica**: Liquidación periódica entre Shanklish y Table Pong. Registra items vendidos por un negocio que pertenecen al otro (ej: comida de Shanklish vendida en Table Pong).
- **enabledByDefault**: false
- **Estado**: Funcional

### 7.14 Entrada de Mercancía

- **Ruta**: `/dashboard/inventario/entrada`
- **Página**: Server Component — importa de `entrada.actions.ts`
- **Actions**: `entrada.actions.ts` → 4 funciones:
  - `registrarEntradaMercancia(data)` — registra entrada vía `inventory.service.registerPurchase()` → genera InventoryMovement(PURCHASE) + CostHistory
  - `getInventoryItemsForSelect()` — items disponibles
  - `getAreasForSelect()` — áreas destino
  - `getRecentMovements(limit)` — últimas entradas
- **Modelos**: InventoryMovement, InventoryLocation, CostHistory, InventoryItem, Area
- **Servicios**: `inventory.service.ts` → `registerPurchase()`
- **Conexiones**: → InventoryMovement(PURCHASE) → InventoryLocation (suma stock) → CostHistory (actualiza precio)
- **Nota**: Este módulo está registrado como sub-ruta de `inventory` en el registry, no como módulo independiente
- **Estado**: Funcional

### Conexiones Críticas entre Módulos de Administración

```
Finanzas ← SalesOrder (ingresos + COGS vía items.costTotal) + Expense (gastos) + AccountPayable (deudas) + AccountPayment (pagos período)
   ↓
P&L = Ingresos - COGS - Gastos Operativos
Flujo de Caja = Ventas - (Gastos + Pagos a Proveedores)
MoM = % cambio vs mes anterior
Exportación: Excel P&L vía ExcelJS (finanzas) + Excel gastos filtrados (gastos)

Dashboard Home ← getFinancialSummaryAction() (widget resumen 5 métricas con MoM, solo roles VIEW_COSTS)
   ↓
Acceso rápido a Finanzas desde dashboard principal

Caja ← SalesOrder (ventas del turno) + Expense (gastos del turno)
   ↓
Cuadre = Apertura + Ventas_Efectivo - Gastos - Cierre_Contado

Metas ← SalesOrder (ventas actuales) vs SystemConfig (targets guardados)

Cuentas por Pagar ← PurchaseOrder (deuda al recibir) → pagos parciales → AccountPayment

Intercompany: Shanklish ←→ Table Pong (items vendidos entre negocios)
```

---

## 8. Módulos de ENTRETENIMIENTO — Table Pong (4 módulos)

Todos estos módulos están **deshabilitados por default** (`enabledByDefault: false`). Se activan solo en la instancia Table Pong.

### 8.1 Juegos

- **Ruta**: `/dashboard/games`
- **Página**: Server Component — importa `getGameStations()`, `getActiveSessions()`, `getGamesDashboardStats()`
- **Actions**: `games.actions.ts` → 16+ funciones organizadas en bloques:
  - **GameType CRUD**: `getGameTypes()`, `createGameType(data)`, `updateGameType(id, data)`
  - **GameStation CRUD**: `getGameStations(filters)`, `createGameStation(data)`, `updateStationStatus(id, status)`
  - **Sesiones**: `getActiveSessions()`, `getSessionHistory(filters)`, `startSession(data)`, `endSession(id, notes?)`, `pauseSession(id)`, `resumeSession(id)`
  - **Stats**: `getGamesDashboardStats()` — resumen del día
- **Modelos**: GameType, GameStation, GameSession, SalesOrder
- **Lógica**: Dashboard de juegos con estaciones activas, sesiones en curso, facturación por hora o pulsera. `endSession()` calcula tiempo + monto y opcionalmente crea SalesOrder.
- **Conexiones**: → SalesOrder (facturación de sesión) → InvoiceCounter (correlativo GSN-xxxx)
- **Estado**: Funcional

### 8.2 Reservaciones

- **Ruta**: `/dashboard/reservations`
- **Página**: Server Component
- **Actions**: `games.actions.ts` (mismo archivo) → funciones de reservas implícitas
- **Modelos**: Reservation, GameStation, WristbandPlan
- **Lógica**: Reservar estación para cliente con fecha/hora, opcionalmente vincular plan de pulsera. Estados: PENDING → CONFIRMED → CHECKED_IN / NO_SHOW / CANCELLED.
- **Estado**: Funcional

### 8.3 Pulseras

- **Ruta**: `/dashboard/wristbands`
- **Página**: Server Component
- **Actions**: `games.actions.ts` → `getWristbandPlans()`, `createWristbandPlan(data)`, `updateWristbandPlan(id, data)`
- **Modelos**: WristbandPlan
- **Lógica**: CRUD de planes de pulsera con duración, precio, color, máximo de sesiones simultáneas. Se vinculan a Reservations y GameSessions.
- **Estado**: Funcional

### 8.4 Cola de Espera

- **Ruta**: `/dashboard/queue`
- **Página**: Server Component
- **Actions**: `games.actions.ts` → funciones de cola (QueueTicket)
- **Modelos**: QueueTicket, GameStation
- **Lógica**: Gestión de turnos. Ticket con número correlativo (reset diario), estado WAITING → CALLED → SEATED / EXPIRED / CANCELLED. Estimación de tiempo de espera.
- **Estado**: Funcional

---

## 9. API Routes y Servicios

### 9.1 API Routes (4 rutas)

| Método | Ruta | Archivo | Propósito |
|--------|------|---------|-----------|
| GET | `/api/kitchen/orders?station=kitchen\|bar` | `src/app/api/kitchen/orders/route.ts` | Órdenes pendientes para comandera (filtra por categoría food/beverage) |
| PATCH | `/api/kitchen/orders` | (mismo archivo) | Actualizar kitchenStatus de una orden |
| GET | `/api/arqueo?date=YYYY-MM-DD` | `src/app/api/arqueo/route.ts` | Datos de arqueo para exportar |
| GET | `/api/auth/session` | `src/app/api/auth/session/route.ts` | Verificar sesión activa (devuelve payload JWT) |
| POST | `/api/upload` | `src/app/api/upload/route.ts` | Upload de archivos (comprobantes, imágenes OCR) |

**Nota**: Las API routes se usan solo donde Server Actions no son prácticas (polling de cocina, verificación de sesión client-side). Todo lo demás usa Server Actions.

### 9.2 Server Services (3 servicios)

| Servicio | Archivo | Funciones principales |
|----------|---------|----------------------|
| **Inventory** | `src/server/services/inventory.service.ts` | `registerPurchase(input)` — entrada de mercancía + actualiza stock + CostHistory |
| | | `registerSale(input)` — descuento por venta (receta → ingredientes) |
| | | `registerAdjustment(...)` — ajuste de inventario |
| **Production** | `src/server/services/production.service.ts` | `createProductionOrder(input)` — crear orden |
| | | `completeProduction(input)` — finalizar (resta ingredientes, suma output) |
| | | `calculateRequirements(recipeId, qty)` — verifica disponibilidad |
| **Cost** | `src/server/services/cost.service.ts` | `calculateGrossQuantity(net, waste%)` — cantidad bruta con merma |
| | | Cálculo recursivo de COGS para recetas con sub-recetas |

### 9.3 Lib Utilities (20 archivos)

| Archivo | Propósito |
|---------|-----------|
| `auth.ts` | JWT encrypt/decrypt, session CRUD |
| `prisma.ts` | Singleton PrismaClient |
| `permissions.ts` | `hasPermission()` por nivel numérico |
| `audit-log.ts` | `writeAuditLog()` — registro forense inmutable |
| `invoice-counter.ts` | `getNextCorrelativo(channel)` — correlativos atómicos |
| `pos-settings.ts` | `POSConfig` en localStorage por terminal |
| `print-command.ts` | Impresión térmica 80mm (comanda cocina + factura) |
| `export-z-report.ts` | Generación Reporte Z a Excel |
| `export-arqueo-excel.ts` | Exportación arqueo de caja a Excel |
| `arqueo-excel-utils.ts` | Utilidades para formato de arqueo |
| `currency.ts` | Formateo USD/Bs |
| `datetime.ts` | Utilidades fecha/hora timezone Caracas |
| `soft-delete.ts` | Helpers para soft delete en queries |
| `inventory-excel-parse.ts` | Parser de Excel para conteo físico |
| `pedidosya-price.ts` | Lógica de precio PedidosYA |
| `mock-data.ts` | Datos de ejemplo para desarrollo |
| `utils.ts` | Utilidades generales (cn, etc.) |
| `constants/modules-registry.ts` | Registro maestro de módulos (682 líneas) |
| `constants/roles.ts` | Roles, jerarquía, ROLE_PERMISSIONS, canManageRole |
| `constants/permissions-registry.ts` | Catálogo granular de 17 PERM keys, ROLE_BASE_PERMS, resolvePerms(), canDo(), PERM_GROUPS |
| `constants/units.ts` | Unidades de medida con conversión |

---

## 10. Componentes UI Compartidos (23 componentes)

### Layout (5)
| Componente | Archivo | Propósito |
|-----------|---------|-----------|
| Navbar | `components/layout/Navbar.tsx` | Barra superior con usuario, rol, tema |
| Sidebar | `components/layout/Sidebar.tsx` | Menú lateral con módulos agrupados por sección |
| ThemeToggle | `components/layout/ThemeToggle.tsx` | Dark/light mode |
| NotificationBell | `components/layout/NotificationBell.tsx` | Modal centrado z-[70], backdrop negro, animación zoom-in-95. Tabs Stock/Sistema con bg tint activo. Cards p-4 rounded-2xl. Legible light/dark. |
| HelpPanel | `components/layout/HelpPanel.tsx` | Modal centrado z-[70], backdrop negro, animación zoom-in-95. Guía contextual por ruta. Cards p-4 rounded-2xl. Legible light/dark. |

### POS (6)
| Componente | Archivo | Propósito |
|-----------|---------|-----------|
| MixedPaymentSelector | `components/pos/MixedPaymentSelector.tsx` | Selector de pago mixto (N métodos, conversión Bs) |
| PrintTicket | `components/pos/PrintTicket.tsx` | Template de factura imprimible |
| PriceDisplay | `components/pos/PriceDisplay.tsx` | Muestra precio USD + equivalente Bs |
| CashierShiftModal | `components/pos/CashierShiftModal.tsx` | Modal para cambio de cajera (PIN) |
| BillDenominationInput | `components/pos/BillDenominationInput.tsx` | Entrada de billetes por denominación |
| CurrencyCalculator | `components/pos/CurrencyCalculator.tsx` | Calculadora de conversión USD↔Bs |

### UI Base (7)
| Componente | Archivo | Propósito |
|-----------|---------|-----------|
| Card | `components/ui/Card.tsx` | Tarjeta contenedora |
| button | `components/ui/button.tsx` | Botón con variantes (CVA) |
| combobox | `components/ui/combobox.tsx` | Selector con búsqueda (Radix + cmdk) |
| dialog | `components/ui/dialog.tsx` | Modal (Radix Dialog) |
| command | `components/ui/command.tsx` | Command palette (cmdk) |
| scroll-area | `components/ui/scroll-area.tsx` | Scroll personalizado (Radix) |
| popover | `components/ui/popover.tsx` | Popover (Radix) |
| quick-create-item-dialog | `components/ui/quick-create-item-dialog.tsx` | Diálogo rápido para crear insumo |

### Otros (3)
| Componente | Archivo | Propósito |
|-----------|---------|-----------|
| ChangePasswordDialog | `components/users/ChangePasswordDialog.tsx` | Cambio de contraseña |
| whatsapp-purchase-order-parser | `components/whatsapp-purchase-order-parser.tsx` | Parser de OC desde mensaje WhatsApp |
| whatsapp-order-parser | `components/whatsapp-order-parser.tsx` | Parser de órdenes desde WhatsApp — se usa en POS Delivery como modal z-60 (botón "💬 WhatsApp" en header abre modal centrado con backdrop, botón X para cerrar; NO inline) |
| theme-provider | `components/theme-provider.tsx` | Provider de next-themes |

---

## 11. PANEL ADMIN — Sistema de Configuración Cápsula (Propuesta)

### 11.1 Decisión de Diseño: Enfoque Híbrido

**Administración** = Gestión del negocio (usuarios, finanzas, gastos, caja, metas)
**Panel Admin** = Configuración del sistema/SaaS (módulos, roles, métodos de pago, fees, plantillas)

Propuesta: mover las páginas de `/dashboard/config/*` a `/dashboard/admin/*` y crear las nuevas funcionalidades ahí. Un solo namespace para toda la configuración del sistema.

### 11.2 Migración de Rutas Existentes

| Ruta Actual | Ruta Propuesta | Actions |
|-------------|---------------|---------|
| `/dashboard/config/modules` | `/dashboard/admin/modules` | system-config.actions.ts |
| `/dashboard/config/roles` | `/dashboard/admin/roles` | user.actions.ts |
| `/dashboard/config/modulos-usuario` | `/dashboard/admin/modulos-usuario` | user.actions.ts |
| `/dashboard/config/tasa-cambio` | `/dashboard/admin/tasa-cambio` | exchange.actions.ts |
| `/dashboard/config/pos` | `/dashboard/admin/pos` | system-config.actions.ts |

**Impacto de migración**: Actualizar `modules-registry.ts` (hrefs), `middleware.ts` (RBAC rules para `/dashboard/admin/*`), Sidebar links.

### 11.3 Nuevas Páginas (Cápsula SaaS)

| Funcionalidad | Estado | Ruta Propuesta |
|--------------|--------|---------------|
| Métodos de Pago CRUD | **NO EXISTE** | `/dashboard/admin/payment-methods` |
| Fees y Porcentajes | **NO EXISTE** | `/dashboard/admin/fees` |
| Tipos de Descuento | **NO EXISTE** | `/dashboard/admin/discounts` |
| Canales de Orden | **NO EXISTE** | `/dashboard/admin/channels` |
| Datos del Negocio | **NO EXISTE** | `/dashboard/admin/business` |
| Plantilla de Configuración | **NO EXISTE** | `/dashboard/admin/template` |

### 11.4 Prioridad 1 — Métodos de Pago (CRUD completo)

**¿Por qué CRUD y no toggle?** Cada cliente puede necesitar métodos distintos. Venezuela: Zelle, Pago Móvil. Colombia: Nequi, Daviplata. México: OXXO Pay.

**Modelo propuesto**:
```prisma
model PaymentMethod {
  id              String   @id @default(cuid())
  key             String   // "ZELLE", "BINANCE", "NEQUI" — único por tenant
  label           String   // "⚡ Zelle"
  emoji           String?
  isBsMethod      Boolean  @default(false)   // true = ingresa Bs, convierte a USD
  isDivisasMethod Boolean  @default(false)   // true = aplica descuento divisas
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  showInSinglePay Boolean  @default(true)    // botones de pago único
  showInMixedPay  Boolean  @default(true)    // MixedPaymentSelector
  tenantId        String?                    // NULL ahora, para SaaS futuro
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Archivos a refactorizar**:
1. `MixedPaymentSelector.tsx` — cargar métodos desde prop (no array fijo)
2. `restaurante/page.tsx` — cargar métodos desde BD al montar
3. `delivery/page.tsx` — ídem
4. `pos.actions.ts` — leer `isBsMethod`/`isDivisasMethod` desde BD
5. `sales.actions.ts` — Reporte Z con métodos dinámicos
6. `sales/page.tsx` — labels dinámicos en historial

**Compatibilidad histórica**: Keys legacy (`CASH`, `MOBILE_PAY`, `CARD`, `TRANSFER`) existen en `SalesOrderPayment.method`. Fallback: `methods.find(m => m.key === key)?.label ?? key`.

### 11.5 Prioridad 2 — Fees y Porcentajes

Almacenar en `SystemConfig`:

| Key | Default | Descripción |
|-----|---------|-------------|
| `delivery_fee_normal` | 4.50 | Tarifa delivery pago en Bs |
| `delivery_fee_divisas` | 3.00 | Tarifa delivery pago en divisas |
| `service_charge_pct` | 10 | % servicio mesas (0 = desactivado) |
| `divisas_discount_pct` | 33.33 | % descuento pago en divisas |

### 11.6 Prioridad 3 — Tipos de Descuento

Toggle + nombre personalizable:
- `DIVISAS_33` → habilitado/no, nombre configurable, % vinculado a `divisas_discount_pct`
- `CORTESIA_100` → habilitado/no, nombre configurable
- `CORTESIA_PERCENT` → habilitado/no, nombre configurable

### 11.7 Prioridad 4 — Canales de Orden Activos

Toggle por `orderType`:
- RESTAURANT ✅ siempre
- DELIVERY ✅/❌ configurable
- PICKUP ✅/❌ configurable
- PEDIDOSYA ✅/❌ configurable
- WINK ✅/❌ configurable
- EVENTO ✅/❌ configurable

---

## 12. Mapa de Conexiones Inter-módulo

```
┌─────────────────────── OPERACIONES ───────────────────────┐
│                                                            │
│  InventoryItem ←──── RecipeIngredient ────→ Recipe         │
│       ↓                                      ↓             │
│  InventoryLocation                    MenuItem (recipeId)  │
│       ↑↓                                     ↓             │
│  InventoryMovement ←──────────── SalesOrderItem            │
│    ↑    ↑    ↑    ↑                          ↓             │
│    │    │    │    │              ┌── SalesOrder ──┐         │
│    │    │    │    │              │                │         │
│    │    │    │    └── Audit      │   ┌──────────┐│         │
│    │    │    └─── Transfer       │   │ OpenTab  ││         │
│    │    └──── Production         │   │ PaySplit ││         │
│    └───── Purchase               │   └──────────┘│         │
│              ↓                   │                │         │
│         CostHistory              └────────┬───────┘         │
│              ↓                            │                 │
│         MenuItem.cost                     │                 │
└───────────────────────────────────────────┼─────────────────┘
                                            │
┌─────────── VENTAS/POS ────────────────────┼─────────────────┐
│                                           │                  │
│  POS Restaurante ── openTab ── cocina ────┤                  │
│  POS Delivery ───── directSale ───────────┤                  │
│  POS Mesero ─────── openTab (sin cobro) ──┤                  │
│  PedidosYA ──────── directSale ───────────┤                  │
│  Cargar Ventas ──── manual entry ─────────┤                  │
│                                           │                  │
│  SalesOrderPayment[]                      │                  │
│       ↓                                   │                  │
│  MixedPaymentSelector / SinglePay         │                  │
└───────────────────────────────────────────┼──────────────────┘
                                            │
┌─────────── ADMINISTRACIÓN ────────────────┼──────────────────┐
│                                           │                  │
│  Finanzas (P&L) ← ventas ────────────────┘                  │
│       ↑              ↑                                       │
│  Expense        PurchaseOrder.totalAmount                    │
│       ↑              ↑                                       │
│  Gastos         Compras (COGS)                               │
│                      ↓                                       │
│                 AccountPayable ← deuda → AccountPayment      │
│                                                              │
│  CashRegister ← ventas_turno + gastos → cuadre de caja      │
│  Metas ← ventas_actuales vs targets (SystemConfig)           │
│  ExchangeRate → POS (conversión Bs) → SalesOrder (snapshot)  │
└──────────────────────────────────────────────────────────────┘
```

---

## 13. Restricciones Técnicas Inamovibles

1. **BD solo aditiva**: Solo `ALTER TABLE ADD COLUMN` con DEFAULT o nullable. Nunca `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE` destructivo.

2. **Sin romper historial**: Keys legacy de métodos de pago (`CASH`, `MOBILE_PAY`, `CARD`, `TRANSFER`) deben seguir mostrándose en historial aunque no existan en tabla nueva.

3. **Server Actions**: Toda lógica de negocio en `src/app/actions/*.actions.ts`. Los componentes client-side llaman Server Actions, no APIs REST directas (excepto cocina que usa polling).

4. **Caching**: Métodos de pago y menú se usan en cada render del POS. Usar `unstable_cache` o pasar como prop desde Server Component.

5. **Sin librerías nuevas** salvo estrictamente necesarias y justificadas.

6. **TypeScript estricto**: Sin `any` salvo casos justificados.

7. **Soft Delete**: Todos los modelos con `deletedAt` usan soft delete. Nunca `DELETE FROM` en datos de negocio.

8. **AuditLog inmutable**: La tabla AuditLog NUNCA se borra. Solo archivar a cold storage.

9. **Correlativos nunca se resetean**: InvoiceCounter es global y monotónico por canal.

---

## 14. Visión Multi-Tenant (diseñar para ello, NO implementar ahora)

> ⚠️ **DESACTUALIZADO (histórico).** Esta sección describe el plan original de
> mayo 2026. **Multi-tenant YA está implementado y en producción** desde §43:
> `tenantId` NOT NULL en ~67 modelos, `resolveTenantContext()` + `withTenant()`,
> aislamiento auditado (`scripts/audit-tenant-isolation.ts`), demo tenant como
> sandbox de prospectos. **Para el estado real ver §43 (multi-tenant en prod),
> §44 (tenants en producción) y §45 (pre-flight onboarding).** Se conserva este
> texto solo como registro de la decisión de diseño.

### Estado actual (mayo 2026 — superado)
- 1 BD por cliente (instancias separadas)
- Sin `tenantId` en ningún modelo

### Objetivo: SaaS "Cápsula"
- Múltiples clientes en una sola BD
- Aislamiento total de datos por tenant
- Admin de cada tenant solo ve/modifica sus datos

### Restricción de diseño
Agregar `tenantId String?` (nullable) a todo modelo de configuración nuevo (`PaymentMethod`, etc.). Migración futura:
```sql
UPDATE "PaymentMethod" SET "tenantId" = 'tenant_shanklish' WHERE "tenantId" IS NULL;
ALTER TABLE "PaymentMethod" ALTER COLUMN "tenantId" SET NOT NULL;
```

---

## 15. Roadmap de Implementación

| Prioridad | Tarea | Complejidad | Impacto |
|-----------|-------|-------------|---------|
| **P1** | Panel Admin — Métodos de Pago CRUD | Alta (6 archivos refactor) | Elimina hardcoding en 3+ archivos |
| **P2** | Panel Admin — Fees y Porcentajes | Media (SystemConfig + 4 archivos) | Delivery fee, service charge configurables |
| **P3** | Panel Admin — Tipos de Descuento | Media (toggle + POS refactor) | Descuentos configurables por instalación |
| **P4** | Panel Admin — Canales de Orden | Baja (toggle de orderType) | Canales activables por cliente |
| **P5** | Middleware RBAC completo | Media (middleware.ts) | Cerrar gap de acceso directo por URL *(parcialmente mitigado por Capa 4)* |
| **P6** | Unificar sistemas de niveles numéricos | Baja (permissions.ts ↔ roles.ts) | Un solo sistema numérico coherente |
| **P7** | Service charge como dato (no string matching) | Media (schema + POS + sales) | Elimina detección frágil por splitLabel |

---

## 16. Gap Analysis — Qué falta para 100%

### Gaps Críticos (afectan producción)

| # | Gap | Archivos afectados | Impacto |
|---|-----|-------------------|---------|
| 1 | **Métodos de pago hardcodeados** en 3+ archivos | `MixedPaymentSelector.tsx`, `restaurante/page.tsx`, `delivery/page.tsx` | No se pueden agregar/quitar métodos sin deploy |
| 2 | **Delivery fees hardcodeados** duplicados front+back | `pos.actions.ts:263-264`, `delivery/page.tsx:15-16` | Cambiar tarifa requiere editar 2 archivos |
| 3 | **Service charge 10% hardcodeado** | `restaurante/page.tsx:696,769`, `sales.actions.ts` | No configurable por instalación |
| 4 | **Service charge detectado por string** (`'| +10% serv'`) | `sales.actions.ts:120,264,428,737` | Detección frágil, se rompe si cambia el texto |
| 5 | **BAR_CATEGORIES hardcodeado** `['Bebidas']` | `api/kitchen/orders/route.ts:7` | No configurable qué va a barra vs cocina |

### Gaps de Seguridad

| # | Gap | Archivo | Impacto |
|---|-----|---------|---------|
| 6 | **JWT secret con fallback hardcodeado** | `src/lib/auth.ts:5` | Si no se configura env var, todos los JWT usan la misma key |
| 7 | **Middleware RBAC cubre solo 3 rutas críticas** — resto se protege en Server Actions | `middleware.ts` | Acceso directo por URL posible, pero Server Actions no retornan datos a roles no autorizados |
| 8 | **Dos sistemas de niveles numéricos** no unificados | `permissions.ts` vs `roles.ts` | KITCHEN_CHEF, WAITER sin nivel en ROLE_HIERARCHY; CASHIER_DELIVERY ya eliminado |

### Gaps Funcionales

| # | Gap | Detalle |
|---|-----|---------|
| 9 | **Descuentos no configurables** por instalación | DIVISAS_33, CORTESIA fijos en código |
| 10 | **Canales de orden no configurables** | DELIVERY, PICKUP, PEDIDOSYA siempre disponibles si el módulo está activo |
| 11 | **kitchenRouting no se usa** en comandera | MenuItem tiene campo `kitchenRouting` (BAR/KITCHEN/GRILL) pero la API filtra por categoría name |
| 12 | **Inventario diario no sincroniza** producción ni transferencias automáticamente | Solo sincroniza ventas POS, no registra entradas/producción del día |
| 13 | **CostHistory no se actualiza** automáticamente al recibir compra en todos los flujos | `receivePurchaseOrderItemsAction` lo hace, pero `registrarEntradaMercancia` podría no |
| 14 | **Intercompany desconectado** de descargo automático | Items intercompany no generan InventoryMovement en el negocio proveedor |

### Gaps de UX

| # | Gap | Detalle |
|---|-----|---------|
| 15 | **POSConfig mixto** BD + localStorage | `stockValidationEnabled` en BD, el resto en localStorage — difícil administrar centralizadamente |
| 16 | **Páginas legacy** bajo `/dashboard/inventario/` sin registro en module-registry | `historial`, `importar`, `compras` existen como páginas pero no como módulos independientes |
| 17 | **Mobile UX**: combobox difícil de usar en móvil | Estrategia propuesta: drawer desde abajo en `<640px`, cards apiladas en vez de tablas, botones `min-h-[44px]`, `inputMode="decimal"` en inputs numéricos |

---

## 17. Deploy e Infraestructura

### 17.1 Deploy Principal — Vercel (Producción actual)

- **Trigger**: Push a GitHub → Vercel detecta cambios → build automático
- **Build command**: `prisma generate && prisma migrate deploy && next build` (definido en `package.json:vercel-build`)
- **Variables de entorno** (configuradas en Vercel dashboard):
  - `DATABASE_URL` — conexión PostgreSQL (Google Cloud SQL)
  - `JWT_SECRET` — secret para firmar tokens de sesión
  - `GOOGLE_VISION_API_KEY` — para OCR de notas escritas a mano
  - `NEXT_PUBLIC_ENABLED_MODULES` — fallback de módulos habilitados (opcional, se lee de BD)

### 17.2 Base de Datos — Google Cloud SQL

- **Motor**: PostgreSQL
- **Instancias**: Una por cliente (shanklish-prod, table-pong-prod)
- **Backups**: Automáticos diarios vía GCP (verificar en Consola GCP → SQL → Copias de seguridad)
- **Backup manual**:
  ```bash
  pg_dump -h localhost -U postgres -d shanklish-prod > backup_fecha.sql
  ```

### 17.3 Entornos Dev / Prod

Para evitar mezclar datos de prueba con operaciones reales:

| Entorno | Base de datos | Uso |
|---------|--------------|-----|
| Producción | `shanklish-prod` (GCP) | Restaurante real, datos reales |
| Desarrollo | `shanklish-dev` (GCP o local) | Pruebas y simulaciones |

Cambiar entorno editando `DATABASE_URL` en `.env`.

### 17.4 Script de Limpieza (Go-Live Reset)

```bash
npm run db:clean    # Ejecuta scripts/clean-transactions.ts
```

- **Borra**: Ventas, órdenes, movimientos de inventario, producciones, historial de costos, conteos
- **Preserva**: Usuarios, insumos (catálogo), recetas, áreas, proveedores
- Requiere confirmación interactiva ("BORRAR DATOS")

### 17.5 Deploy Alternativo — AWS ECR + App Runner (documentado, no activo)

Existe una guía para deploy vía Docker en AWS como alternativa a Vercel:

1. **Prerrequisitos**: Docker Desktop + AWS CLI configurado
2. **ECR (Elastic Container Registry)**: Crear repositorio privado `shanklish-erp`
3. **Build & Push**:
   ```powershell
   .\deploy-aws.ps1 -AccountId "AWS_ACCOUNT_ID" -Region "us-east-1"
   ```
   El script: login Docker con AWS → build imagen → tag → push a ECR
4. **App Runner**: Crear servicio desde la imagen ECR
   - Config: 1 vCPU / 2 GB RAM
   - Environment variables: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_VISION_API_KEY`
   - Deploy automático al pushear nuevas imágenes

**Nota**: Este flujo no está activo actualmente. La producción usa Vercel. Se documentó como opción para clientes que prefieran AWS.

### 17.6 Comandos de BD Útiles

```bash
npm run db:generate        # prisma generate (regenerar cliente)
npm run db:push            # prisma db push (sincronizar schema sin migración)
npm run db:migrate         # prisma migrate dev (crear migración con nombre)
npm run db:migrate:deploy  # prisma migrate deploy (aplicar migraciones pendientes)
npm run db:studio          # prisma studio (explorar datos en navegador)
npm run db:seed            # tsx prisma/seed.ts (datos iniciales)
```

---

---

## 18. Convenciones de UI / Design System

### 18.1 Z-Index Stack (inamovible)

| Capa | Valor | Elementos |
|------|-------|-----------|
| Header fijo | `z-30` | Navbar de cada módulo POS |
| Nav móvil | `z-50` | `<nav>` inferior en Restaurante, Delivery, PedidosYA |
| Modales POS | `z-60` | Modifier, PIN, Tip, Table, Remove-item, Open-tab, WhatsApp parser (Delivery) — todos los módulos |
| NotificationBell / HelpPanel | `z-[70]` | Backdrop + modal card — siempre sobre todo lo anterior |

**Regla**: Nunca poner un modal POS a `z-50` (colisiona con nav móvil). Verificar esta tabla ante cualquier nuevo modal.

### 18.2 Sistema de Cards Unificado (4 módulos POS)

| Propiedad | Valor | Aplica en |
|-----------|-------|-----------|
| Padding | `p-4` | Cart items, alert cards, tip cards |
| Border radius | `rounded-2xl` | Cart items, modal cards de alerta/info |
| Modal cards | `rounded-2xl` o `rounded-3xl` | Modales de tamaño completo |
| Modal sheets (mobile) | `rounded-t-3xl sm:rounded-3xl` | Modales bottom-sheet |

Módulos donde está aplicado: **Restaurante, Delivery, PedidosYA** (cart items + modales).

### 18.3 Modal Pattern — NotificationBell / HelpPanel

```
fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4   ← backdrop
  └── bg-card w-full max-w-sm rounded-2xl flex flex-col max-h-[90vh]
      shadow-2xl border border-border overflow-hidden
      animate-in fade-in zoom-in-95 duration-200                        ← animación
        ├── Header: p-5 border-b bg-{color}/15   (legible light + dark)
        ├── Tabs activos: border-b-2 bg-{color}/10  (no solo underline)
        ├── Content: overflow-y-auto flex-1
        └── Footer: bg-secondary/40  (separación visual clara)
```

### 18.4 Cajera Activa en Sesión y Trazabilidad

- `validateCashierPinAction()` escribe el `id` de la cajera autenticada en el cookie JWT (`activeCashierId`)
- `createSalesOrderAction()` usa `session.activeCashierId ?? session.id` como `createdById`
- Función: `updateSessionCashier(cashierId)` en `src/lib/auth.ts`
- Resultado: cuando varias cajeras comparten terminal, cada orden queda bajo la cajera que validó el PIN
- **Mesa consolidada** (`getSalesHistoryAction`): en el tab RESTAURANT, el grupo de órdenes de un OpenTab se consolida en una fila. `createdBy` toma de `last.createdBy` (la orden más reciente = quien procesó el pago final), no de `first`. Así el historial refleja la cajera de cierre, no de apertura.
- **Modal de anulación** (`sales/page.tsx`): muestra `createdBy.firstName` (cajera) y, si `authorizedById` existe, también `authorizedBy.firstName` con label "Autorizado por:"

### 18.8 Método de Pago PedidosYA

- El método de pago para órdenes PedidosYA se guarda en BD como `'PY'` (antes era `'EXTERNAL'`)
- Escritura: `pedidosya.actions.ts:60` — `paymentMethod: 'PY'`
- Lectura/arqueo: `sales.actions.ts` — branch `k === 'PY'` acumula en `pay.external` del resumen de caja
- Nunca usar `'EXTERNAL'` — es el valor legado, ya renombrado

### 18.5 Redondeo de Descuentos y Total Final

#### roundCents — redondeo de descuentos intermedios
- Helper: `roundCents(n)` = `Math.round(n * 100) / 100` — en `pos.actions.ts` (función privada)
- **Aplica a todos los tipos de descuento** en `calculateCartTotals`: `DIVISAS_33` y `CORTESIA_PERCENT` (ambas ramas DELIVERY y RESTAURANT/PICKUP)
- El frontend (`handleCheckoutPickup` en restaurante/page.tsx) replica el redondeo con `rc()` inline para mantener consistencia de vuelto en pantalla
- `CORTESIA_100` no requiere redondeo (siempre es subtotal exacto)
- Regla: igual o mayor a 0.5 → redondea arriba; menor a 0.5 → redondea abajo

#### roundToWhole — redondeo del total final por método de pago
- Helper: `roundToWhole(amount, paymentMethod)` — en `pos.actions.ts` (función privada) y replicado como lambda en restaurante/page.tsx y delivery/page.tsx
- **Aplica Math.round al total final** solo para: `CASH_USD`, `ZELLE`, `CASH_BS`
- **No aplica** para: `PDV_SHANKLISH`, `PDV_SUPERFERRO`, `MOVIL_NG`, `PY`, y cualquier otro método
- **Orden de aplicación:** ÚLTIMO paso — después de todos los descuentos y después del 10% service charge si aplica
- Ubicaciones de aplicación:
  - `pos.actions.ts` → `calculateCartTotals()`: al `total` final, en ambas ramas (DELIVERY y RESTAURANT/PICKUP), antes de calcular el vuelto
  - `restaurante/page.tsx` → `paymentAmountToCharge`: aplicado después del `* 1.1` (service charge)
  - `restaurante/page.tsx` → `handleCheckoutPickup` `finalTotal`: aplicado al total pickup antes de enviar a la action
  - `restaurante/page.tsx` → IIFE display `pickupTotal`: para que la pantalla muestre el mismo total redondeado
  - `delivery/page.tsx` → `finalTotal`: único punto de display y submit en delivery

### 18.7 amountPaid en Delivery — Regla por Método Bs

**Regla implementada en `delivery/page.tsx` → `handleCheckout` IIFE (desde 2026-04-11):**

| Método | Comportamiento |
|--------|---------------|
| `PDV_SHANKLISH`, `PDV_SUPERFERRO` | Siempre `amountPaid = finalTotal`. Terminales que cobran exacto, sin entrada manual. |
| `MOVIL_NG` | Si `rawAmt >= finalTotal * 10` → convierte Bs→USD (`rawAmt / exchangeRate`). Si no, usa `finalTotal`. |
| `CASH_BS` | Siempre convierte Bs→USD con el monto real ingresado (para calcular vuelto). |

**Bug corregido (2026-04-11):** Entre DEL-0156 (10 abr) y DEL-0197 (11 abr), `amountPaid` se guardaba como `total / exchangeRate` en lugar de `total`. Root cause: el cajero ingresaba el monto USD (ej. `22.5`) en el campo Bs; el código lo dividía por el tipo de cambio → `22.5 / 476 = $0.047`. 25 órdenes afectadas (MOVIL_NG + PDV_SHANKLISH). Corregidas con `scripts/fix-movil-ng-amounts.ts` el 11 abr 2026 (`amountPaid = total`, `change = 0`). El historial de ventas y Z-Report usan `amountPaid - change` para la columna COBRADO — quedaron correctos tras el fix.

### 18.8 Flujo Completo de Propina Colectiva (resuelto 2026-04-11)

> **ACTUALIZACIÓN 2026-06-06 (§46 + PR propina-colectiva-vinculada):**
> La propina colectiva ahora es EXCLUSIVAMENTE para propina dejada DESPUÉS de
> cerrar la mesa (la auto-creación en el cobro se eliminó — esa propina ya
> queda en el excedente del split, ver §46). El modal de propina colectiva:
> - Carga las mesas CERRADAS de hoy vía `getClosedTabsTodayAction()` y obliga
>   a elegir una (o escribir referencia manual si no está en la lista).
> - Guarda el correlativo vinculado dentro de `notes` con el marcador estable
>   `[tab:<tabCode>]` (helpers puros en `src/lib/sales/collective-tip-ref.ts`:
>   `embedTabCode`/`extractTabCode`/`stripTabMarker`, con tests). NO hay columna
>   nueva (se evitó migración).
> - El historial de ventas muestra ese correlativo como badge junto al PKP
>   (`extractTabCode(sale.notes)` en sales/page.tsx).
> Modelo de cuentas separadas: **10% servicio** (`totalServiceFee`) — **propina
> al cerrar** (excedente del split) — **propina colectiva posterior** (PKP).
> Las dos propinas hoy se suman en la línea `PROPINAS` del Z report cuando
> `unifyTipReporting` está ON; si se quiere separarlas en dos líneas del cierre,
> es un follow-up chico.

#### Creación
- Botón "🪙 PROPINA" en POS Restaurante → modal → `handleRecordTip` (restaurante/page.tsx)
- Si método es Bs (`CASH_BS`, `PDV_SHANKLISH`, `PDV_SUPERFERRO`, `MOVIL_NG`): convierte `tipAmountUSD = Math.round(amount / exchangeRate * 100) / 100`
- Llama `recordCollectiveTipAction(data)` en `pos.actions.ts`
- Crea `SalesOrder` con: `orderType='PICKUP'`, `total=0`, `amountPaid=tipAmountUSD`, `customerName='PROPINA COLECTIVA'`, correlativo `PKP-XXXX` (via `getNextCorrelativo('PICKUP')`)
- `amountPaid` siempre en USD. Toast: "Bs 50.00 ($1.96) registrada" o "$5.00 registrada"

#### Historial de Ventas (`sales/page.tsx`)
- Filtro "Tipo → 🍽️ Mesa / Pickup" incluye `orderType='RESTAURANT'` Y `'PICKUP'` (ambos)
- Filtro "Tipo → 🪙 Propinas" filtra por `customerName === 'PROPINA COLECTIVA'`
- Filas PROPINA COLECTIVA: badge ámbar "🪙 PROPINA", correlativo en ámbar, fila con fondo `bg-amber-950/20`
- Columna "Total Factura" muestra `—` (el total es $0), columna "Cobrado" muestra `amountPaid` en ámbar

#### Reporte Z (`getDailyZReportAction` en `sales.actions.ts`)
- `totalTips` acumula: para mesas (tab) → `totalCobrado - totalFactura`; para órdenes sueltas → `amountPaid - total` cuando `change=0` y `amountPaid > total`
- `tipCount` cuenta las transacciones de propina (tanto de mesas como PROPINA COLECTIVA)
- El Reporte Z imprimible muestra `(+) PROPINAS (N)` con el monto acumulado

#### Cierre del Día (`getEndOfDaySummaryAction` en `sales.actions.ts`)
- `propinas` acumula igual que Z-report; `propinaCount` cuenta transacciones
- Modal "Cierre del Día" muestra `Propinas (N): +$X.XX`

#### Control de Caja (`closeCashRegisterAction` en `cash-register.actions.ts`)
- **Bug corregido**: `salesAgg._sum.total` era 0 para PROPINA COLECTIVA (su `total=0`)
- Fix: agrega `tipsAgg._sum.amountPaid` de órdenes `customerName='PROPINA COLECTIVA'`
- `expectedCash = openingCashUsd + totalSalesUsd + totalTipsUsd - totalExpenses`
- Modal de cierre en `caja-view.tsx` muestra línea "🪙 Propinas (N): +$X.XX" obtenida via `getEndOfDaySummaryAction` en `useEffect` cuando se abre el modal

#### Regla permanente
> **PROPINA COLECTIVA siempre usa `amountPaid`, nunca `total`.** El campo `total` es 0 por diseño (no es una venta de producto). Cualquier lógica que agregue ingresos de propina debe usar `_sum.amountPaid` filtrado por `customerName='PROPINA COLECTIVA'`, no `_sum.total`.

#### Unificación de propinas en el cierre — flag `unifyTipReporting` (2026-06-05)

**Problema histórico:** el Z report y el Cierre del Día **excluían** las propinas colectivas (`customerName: { not: 'PROPINA COLECTIVA' }`), así que la línea `(+) PROPINAS` solo sumaba el **excedente** al cobrar en pickup/delivery. Las propinas de **mesa** (que se graban como PROPINA COLECTIVA, ver flujo §18.8) y las colectivas manuales quedaban **fuera** del total de propinas del cierre. Esto las hacía sentir como una "cuenta aparte". Inconsistente además con el arqueo de caja (`closeCashRegisterAction`), que **sí** las contaba en `expectedCash` vía `tipsAgg`.

**Modelo correcto (confirmado por el dueño):**
- **10% servicio** = una cosa, su propia línea (`totalServiceFee`). Intacto.
- **Propina** = TODO lo que excede al 10%. Si el cliente deja 15%, ese 5% es propina, aparte del 10%.
- La propina extra llega por dos caminos que deben **unificarse en un solo número**: (B) excedente al cobrar, (C) propina colectiva registrada aparte.

**Implementación (flag-gated, sin cambio de schema):**
- Flag por tenant `unifyTipReporting` (catálogo en `src/lib/feature-flags.ts`). OFF por default = comportamiento histórico.
- Con el flag ON, `getDailyZReportAction` (`z-report.actions.ts`) trae las órdenes PROPINA COLECTIVA en una query aparte (`collectiveTipOrders`, `select amountPaid + paymentMethod`) — aparte para **no inflar** conteos por canal ni ventas brutas — y suma su `amountPaid` a `totalTips`, `tipCount`, `totalCollected` y al arqueo (`pay`/paymentBreakdown). El 10% (`totalServiceFee`) queda separado e intacto.
- `getEndOfDaySummaryAction` (`end-of-day.actions.ts`) hace lo mismo sobre `propinas`/`propinaCount`/`totalUSD`.
- `ZReportData.tipsUnified?: boolean` señala al cliente que `totalTips` ya incluye colectivas.
- **Sin doble-conteo:** en mesa el tip va 100% por la orden colectiva (el `paidAmount` del split es el total factura sin propina → excedente del split = 0); en pickup/delivery va por excedente y no se crea orden colectiva. Caminos disjuntos.
- El export a Excel (`export-z-report.ts`) lee `totalTips` → correcto automáticamente.
- `estadisticas`/`metas`/`comandas-del-dia` **siguen excluyendo** PROPINA COLECTIVA (una propina no es venta). No se tocan.
- Activación: `/dashboard/config/feature-flags` (solo OWNER) → "Unificar propinas en el cierre". Efectivo en ≤30s (cache TTL).

### 18.9 Correcciones Responsive — RedmiPad 2 + Desktop (2026-04-11)

**Target devices**: RedmiPad 2 landscape 1200×2000px, Desktop 1920×1080px.

**Breakpoints activos** (tailwind.config.ts):
- `md:` = 768px — sidebar visible, main padding 24px
- `lg:` = 1024px — paneles desktop POS activos
- `tablet-land:` = 1200px — **breakpoint custom para tablet landscape** (antes sin uso)
- `xl:` = 1280px — NO activa a 1200px (RedmiPad 2)

#### 18.9.1 Modo Pantalla Completa (commits a6e4623)

- **`ui.store.ts`**: `posFullscreen: boolean` + `togglePosFullscreen()` añadidos al `UIState`
- **`DashboardShell.tsx`** (Client Component nuevo en `components/layout/`):
  - Fullscreen: `h-screen w-screen overflow-hidden`, sin Sidebar/Navbar, botón flotante `z-[80]` "Salir POS" (bottom-right)
  - Normal: renderiza Sidebar + Navbar + `<main p-4 md:p-6>`
  - Recibe `sidebar` como prop (JSX del Server Component layout.tsx)
- **`dashboard/layout.tsx`**: importa DashboardShell, pasa `<Sidebar ...>` como prop, ya no importa Navbar directamente
- **`Navbar.tsx`**: botón fullscreen toggle (SVG expand/compress) en barra de acciones derecha

#### 18.9.2 POS Restaurante — layout 3 paneles (commit 0f5f2ab)

- Panel izquierdo (mesas): `lg:w-64 tablet-land:w-64 xl:w-72` (antes `lg:w-72 xl:w-80`)
- Panel derecho (cuenta): `lg:w-[380px] tablet-land:w-[380px] xl:w-[440px]` (antes `lg:w-[420px] xl:w-[480px]`)
- A 1200px: menú pasa de ~188px a ~308px de ancho
- Grilla de productos: `tablet-land:grid-cols-4` añadido (antes solo `xl:grid-cols-4` que no activaba a 1200px)

#### 18.9.3 Delivery + PedidosYA — doble header eliminado (commit efd32ea)

**Problema**: Headers `fixed top-0 z-30` de las páginas POS quedaban ocultos detrás del Navbar `sticky z-40`. El body `pt-16/pt-24` creaba blank gap visible.

**Solución**: Ambas páginas importan `useUIStore`:
```tsx
const { posFullscreen } = useUIStore();
```

- **Fullscreen** (comportamiento anterior): `fixed top-0 w-full z-30`, body `h-screen pt-16/pt-24`
- **Normal**: header `relative w-full z-[31]` (en flow), body `flex-1 min-h-0`, root `flex-1 -m-4 md:-m-6 h-[calc(100vh-4rem)]` (negative margins cancelan padding del main)

Ambas páginas también tienen `tablet-land:grid-cols-4` en su grilla de productos.
PedidosYA: panel derecho `w-80 tablet-land:w-96 xl:w-96`.

#### 18.9.4 Historial de Ventas — scroll horizontal (commit d8fa308)

- `<table className="w-full min-w-[900px]">` en `sales/page.tsx`
- El wrapper `overflow-x-auto` ya existía; el `min-w` evita compresión de columnas

### 18.10 Subcuentas en POS Restaurante y Mesero (2026-04-11)

#### Schema Prisma (commit d9dfc85)
- `TabSubAccount`: división de un `OpenTab` en hasta 25 subcuentas; campos `subtotal`, `serviceCharge` (10%), `total`, `paidAmount`, `status (OPEN|PAID|VOID)`
- `SubAccountItem`: vincula un `SalesOrderItem` a una `TabSubAccount`; `quantity` puede ser parcial (ej. 1 de 3 del mismo ítem)
- `PaymentSplit.subAccountId`: FK nullable — `null` = cobro de mesa completa (comportamiento existente), set = cobro de subcuenta
- Migración manual SQL en `prisma/migrations/20260411000000_add_tab_sub_accounts/migration.sql` (sin `prisma migrate dev` por shadow DB no disponible)

#### Server Actions (commit b72a9bb) — `src/app/actions/pos.actions.ts`
| Action | Descripción |
|--------|-------------|
| `createSubAccountsAction` | Crea N subcuentas con labels personalizados (máx 25) |
| `renameSubAccountAction` | Renombra una subcuenta |
| `deleteSubAccountAction` | Elimina subcuenta (solo si OPEN y sin ítems pagados) |
| `assignItemToSubAccountAction` | Asigna qty parcial de un SalesOrderItem a una subcuenta |
| `unassignItemFromSubAccountAction` | Desasigna un ítem de una subcuenta |
| `autoSplitEqualAction` | División round-robin igualitaria (crea subcuentas + reparte ítems) |
| `paySubAccountAction` | Cobra una subcuenta; cierra mesa si todas pagadas y saldo ≤ 0.01 |
| `getOpenTabWithSubAccountsAction` | Deep include subcuentas → ítems → order ítems → modifiers |

#### Componente UI (commits e5340a1, 9fc4954)
- `src/components/pos/SubAccountPanel.tsx` — Client Component con sub-componentes top-level `PoolItemRow` y `SubAccountCard`
- División rápida: botones 2/3/4/5/6 llaman `autoSplitEqualAction`
- Pool: ítems sin asignar o parcialmente asignados — no bloquean cierre de mesa
- Cobro por subcuenta: selector de método, toggle +10% servicio, input monto
- Integrado en **POS Restaurante** (`restaurante/page.tsx`): botón "÷ Dividir cuenta" en header del tab activo; alterna con panel de cobro normal (state `subAccountMode`)
- Integrado en **POS Mesero** (`mesero/page.tsx`): botón "÷ Dividir cuenta" en bloque "Total cuenta"; mesonero crea labels y asigna ítems sin acceso a cobro principal

#### Reglas de diseño
- Labels editables inline (click en nombre → input, Enter confirma)
- Modificadores siempre siguen al ítem principal
- Cocina no ve subcuentas — comanda normal
- Pool sin asignar se cobra con el botón principal de la mesa (flow existente)

### 18.11 Bugfixes POS — z-index, carrito compartido, pre-cuenta (2026-04-11)

#### commit 24f7799 — fix(pos): 3 bugs en restaurante/delivery/pedidosya

**Bug 1 — `z-60` → `z-[60]` en todos los modales POS**

`z-60` no existe en la escala Tailwind (va hasta `z-50`; no había entry en `tailwind.config.ts`). Sin z-index efectivo, los modales renderizan en `z-index: auto` y quedan detrás del Sidebar (`z-50`) y bottom nav mobile (`z-50`). El síntoma: clicar "+" Propina abría el modal pero éste era invisible (detrás del Sidebar).

Archivos corregidos:
| Archivo | Ocurrencias |
|---------|-------------|
| `pos/restaurante/page.tsx` | 6 modales (propina, mesa, abrir tab, PIN pago, eliminar ítem, modificador) |
| `pos/delivery/page.tsx` | 3 (WhatsApp parser, modificador, propina) |
| `pos/pedidosya/page.tsx` | 1 (modificador) |

commit `77fa94a` — también corregido en `dashboard/usuarios/users-view.tsx` (1 ocurrencia).

**Bug 2 — Carrito compartido entre mesas (`resetTableState`)**

`cart` era un `useState` global nunca limpiado al cambiar de mesa. `setCart([])` solo se llamaba tras `handleSendToTab` o `handleCheckoutPickup`. Resultado: ítems de Mesa A permanecían en carrito al abrir Mesa B y se enviaban a la cuenta equivocada.

Solución: nueva función `resetTableState()` en `restaurante/page.tsx` que limpia:
```typescript
setCart([])
setDiscountType("NONE")
setAuthorizedManager(null)
setMixedPaymentsTable([])
setIsTableMixedMode(false)
setCortesiaPercent("100")
setAmountReceived("")
setSubAccountMode(false)
setCheckoutTip("")
```
Llamada en 3 puntos: selección de mesa, cambio de zona, cierre de modal de mesa (backdrop click).

**Bug 3 — Pre-cuenta mostraba descuento falso**

`handlePrintPrecuenta` usaba `base = activeTab.balanceDue` como subtotal de la pre-cuenta. `balanceDue` disminuye con pagos parciales, por lo que si la mesa había pagado $30 de $100, la pre-cuenta mostraba: ítems=$100, subtotal=$70 → diferencia de $30 aparecía como descuento.

Fix: `base = activeTab.runningTotal` — campo que siempre refleja el total de todos los consumos sin importar pagos intermedios. `runningTotal` ya existía en el tipo `OpenTabSummary` (línea 102 del componente).

Adicionalmente: `discountType` tampoco se reseteaba al cambiar mesa → pre-cuenta de Mesa B heredaba el descuento DIVISAS_33 configurado para Mesa A. Resuelto por `resetTableState()`.

#### Diagnóstico: PKP (Propinas Colectivas) en totalFacturado vs totalCobrado

`recordCollectiveTipAction` crea un `SalesOrder` con `total=0` y `amountPaid=tipAmount`. En `getSalesHistoryAction` (y en `sales/page.tsx` donde se calculan los totales del header):

```typescript
// sales/page.tsx línea 258-267
acc.invoiced  += s.totalFactura ?? s.total ?? 0;  // PKP: += 0
acc.collected += s.totalCobrado ?? s.total ?? 0;  // PKP: += tipAmount
```

Para un PKP de $10: `totalFactura=0`, `totalCobrado=10`, `propina=10`.

**Resultado**: `totalCobrado > totalFacturado` por el monto exacto de todas las propinas colectivas del período. Esto es **comportamiento por diseño** — las propinas no son ventas facturadas, pero sí ingreso recibido. La diferencia entre ambos totales = servicio 10% + propinas. El Z-report los trata de forma separada con `totalTips` explícito.

### 18.12 Separación de responsabilidades — validateManagerPinAction vs validateCashierPinAction (2026-04-12)

#### Contexto

Existían dos funciones de validación de PIN en `pos.actions.ts`. `validateCashierPinAction` tenía `AREA_LEAD` y `CASHIER` en su filtro de roles, lo que permitía a cajeras y jefes de área "autorizar" operaciones que deben ser exclusivamente gerenciales. Además, `sales/page.tsx` (anulaciones) llamaba a `validateCashierPinAction` en lugar de `validateManagerPinAction`.

#### Regla definitiva

| Función | Roles que acceden | Propósito único |
|---------|------------------|-----------------|
| `validateManagerPinAction` | `OWNER`, `ADMIN_MANAGER`, `OPS_MANAGER` | Autorizar descuentos, cortesías, pagos, **anulaciones** |
| `validateCashierPinAction` | `OWNER`, `ADMIN_MANAGER`, `OPS_MANAGER` | Trazabilidad de sesión de caja (`updateSessionCashier`) |

**Regla**: `CASHIER` y `AREA_LEAD` no autorizan operaciones sensibles. Solo pueden identificarse para la trazabilidad de su sesión de caja — y eso solo si usan el mismo PIN que uno de los roles permitidos (actualmente ambas funciones usan los mismos 3 roles).

#### Cambios aplicados (commit `80253d0`)

1. **`pos.actions.ts`** — `validateCashierPinAction`: eliminados `'AREA_LEAD'` y `'CASHIER'` del filtro `role: { in: [...] }`. Ambas funciones usan ahora exactamente los mismos roles (`OWNER`, `ADMIN_MANAGER`, `OPS_MANAGER`). La diferencia es el efecto secundario: solo `validateCashierPinAction` llama a `updateSessionCashier`.

2. **`sales/page.tsx`** — `handleVoidPinConfirm` (anulaciones): cambiado de `validateCashierPinAction` a `validateManagerPinAction`. El import correspondiente también actualizado.

#### Mapa completo de uso de PINs en la UI

| Archivo | Función | Flujo |
|---------|---------|-------|
| `pos/restaurante/page.tsx` | `validateManagerPinAction` | Cortesía, pago checkout |
| `pos/delivery/page.tsx` | `validateManagerPinAction` | Descuento / cortesía |
| `pos/mesero/page.tsx` | `validateManagerPinAction` | Autorización subcuentas |
| `dashboard/sales/page.tsx` | `validateManagerPinAction` | **Anulaciones** (corregido) |
| (solo si aplica) | `validateCashierPinAction` | Registro de sesión cajera |

### 18.13 Export Excel Arqueo — Formato completo ExcelJS (2026-04-12)

#### Commit `08e6969` — feat(arqueo): Excel de arqueo con formato completo, 24 columnas y estilo oscuro

El botón **EXPORTAR EXCEL** en `/dashboard/ventas` genera un `.xlsx` desde el servidor via `/api/arqueo?date=` sin depender de plantilla externa.

#### Arquitectura del flujo

```
sales/page.tsx
  └─ handleExportArqueo()
       └─ GET /api/arqueo?date=YYYY-MM-DD      (route.ts)
            ├─ getSalesForArqueoAction(date)    (sales.actions.ts)
            └─ buildArqueoWorkbookFromTemplate(sales, dateStr)  (arqueo-excel-utils.ts)
                 └─ devuelve ExcelJS.Buffer → descarga .xlsx
```

#### Estructura del workbook

**Sección 1 — Resumen (filas 1-14)**: Totales del día por método de pago, auto-calculados. Celdas en blanco para entradas manuales (Capital Inicio, Egresos, BCV).

| Filas | Contenido |
|-------|-----------|
| 1 | Título con fecha |
| 2 | Labels de sub-secciones (Cash $, Cash €, Cash Bs) |
| 3-4 | Capital Dólares Inicio / Cash $ Ingreso (auto) / Egreso / Cerrado |
| 5-6 | Capital Euro Inicio / Cash € Ingreso EN$ (auto) / Egreso / Cerrado |
| 7-8 | Capital Bs Inicio / Cash Bs Ingreso EN$ (auto) / Egreso / Cerrado |
| 9-10 | Vuelto PM / PM Shanklish EN$ (auto) |
| 11-12 | PDV Shanklish EN$ (auto) / PDV Superferro EN$ (auto) / Zelle (auto) / Servicio 10% |
| 13-14 | Total Ingreso $ (auto, verde grande) / PM Nour (auto) / PedidosYA (auto) / BCV manual |

**Sección 2 — Detalle (fila 15+)**: 24 columnas, filas congeladas en fila 15.

```
A  Item · B Descripción · C Correlativo · D Total Ingreso $ · E Total Gasto $
F  Cash $ In · G Cash $ Out · H Cash € In · I Cash € Out
J  Cash Bs In · K Cash Bs Out · L Zelle
M  Vuelto PM Bs · N Vuelto PM $ · O PM Bs Shanklish · P PM $ Shanklish
Q  PM Bs Nour · R PM $ Nour · S PDV Shanklish Bs · T PDV Shanklish $
U  PDV Superferro Bs · V PDV Superferro $ · W Servicio 10% · X Propina Extra
```

Filas agrupadas en bloques por tipo:
- `▸ MESAS — RESTAURANTE` (orders con `orderType === 'RESTAURANT'`)
- `▸ PICKUP / PARA LLEVAR`
- `▸ DELIVERY`
- `▸ PEDIDOS YA` (detectado por `orderType === 'PEDIDOSYA'` o `sourceChannel === 'POS_PEDIDOSYA'`)

Cada bloque tiene su **fila de subtotal** en verde oscuro y un separador visual. Al final: **TOTAL GENERAL DEL DÍA** en verde intenso.

#### Paleta de colores (todos ARGB)

| Uso | Color |
|-----|-------|
| Fondo título / datos | `FF0D1117` (casi negro) |
| Sección labels | `FF161B22` |
| Encabezados columna | `FF1B3A5C` (azul oscuro) |
| Encabezado de bloque | `FF1A2A3A` |
| Subtotal de bloque | `FF0A3D2B` (verde oscuro) |
| Total general | `FF052E16` (verde muy oscuro) |
| Labels / valores clave | `FFFBBF24` (ámbar) |
| Totales numéricos | `FF86EFAC` (verde claro) |
| Celdas entrada manual | `FF21262D` (gris oscuro) |

#### Cambios en ArqueoSaleRow (sales.actions.ts)

- `orderType` expandido: `'RESTAURANT' | 'PICKUP' | 'DELIVERY' | 'PEDIDOSYA'`
- `paymentBreakdown` añade `cashEur: number` y `cashBs: number`
- Separación de pagos: `CASH`/`CASH_USD` → `cashUsd`, `CASH_EUR` → `cashEur`, `CASH_BS` → `cashBs`
- PEDIDOSYA detectado por `orderType === 'PEDIDOSYA' || sourceChannel === 'POS_PEDIDOSYA'`

#### Librerías usadas

- **ExcelJS** `^4.4.0` — única librería activa para generación server-side
- `xlsx` (`^0.18.5`) sigue en `package.json` pero solo se usa en el fallback cliente `export-arqueo-excel.ts` (no en el flujo principal)
- El archivo `public/templates/arqueo-plantilla.xlsx` ya no se usa — `buildArqueoWorkbookFromTemplate` genera desde cero siempre

### 18.6 Skills Instalados en `.claude/skills/`

Estos archivos son cargados automáticamente en toda sesión de Claude Code:

| Skill | Archivo | Uso |
|-------|---------|-----|
| Frontend Design | `frontend-design.md` | Guía estética para componentes UI — tipografía, color, motion, layout |
| Vercel React Best Practices | `vercel-react-best-practices.md` | 69 reglas de performance React/Next.js (waterfalls, bundle, re-renders) |
| Error Handling Patterns | `error-handling-patterns.md` | Patrones de manejo de errores TypeScript — Result types, Circuit Breaker |
| PostgreSQL Table Design | `postgresql-table-design.md` | Diseño de esquemas PostgreSQL — tipos, índices, constraints, partitioning |

**Ubicación**: `C:\Users\Usuario\Desktop\SHANKLISH ERP 3.0\.claude\skills\`

### 18.14 Mejoras flujo POS Restaurante — 4 cambios (2026-04-12)

#### Branch: `claude/review-pos-workflow-hEEWh`

---

#### Cambio 1 — Modal apertura de mesa sin campos obligatorios (commit `6122a00`)

**Archivo**: `src/app/dashboard/pos/restaurante/page.tsx`

- Eliminado el campo **Teléfono del cliente** del modal "Abrir cuenta" — estado `openTabPhone` removido por completo junto con su validación y el parámetro `customerPhone` en `openTabAction`.
- El campo **Nombre del cliente** pasa a ser opcional (label `(opcional)`, ya no `*`). Si está vacío, se usa `"Cliente"` como default.
- El botón "✓ Abrir cuenta" solo se deshabilita durante `isProcessing`; ya no depende de que haya texto en ningún campo.
- **Campos que quedan**: Nombre (opcional), Número de personas (spinner), Mesonero asignado (select).

---

#### Cambio 2 — Número de mesa en factura impresa (commit `4c36741`)

**Archivos**: `src/lib/print-command.ts`, `src/app/dashboard/pos/restaurante/page.tsx`

- `ReceiptData` (print-command.ts) recibe nuevo campo `tableLabel?: string`.
- El HTML térmico imprime una línea `Mesa: [valor]` inmediatamente debajo del correlativo, solo si `tableLabel` está presente.
- `printReceipt` se llama con `tableLabel: selectedTable?.name` en:
  - Pago real (`handlePaymentPinConfirm`) — línea ~820
  - Pre-cuenta (`handlePrintPrecuenta`) — línea ~900
- El flujo de Pickup no pasa `tableLabel` (no tiene mesa física).

---

#### Cambio 3 — Pickup tipo mesa con tabs persistentes (commit `86d8d5b`)

**Archivo**: `src/app/dashboard/pos/restaurante/page.tsx`

**Interfaz añadida**:
```typescript
interface PickupTabLocal {
  id: string;           // UUID (crypto.randomUUID)
  pickupNumber: string; // "PK-01", "PK-02"... editable en modal
  customerName: string; // opcional
  customerPhone: string; // opcional
  cart: CartItem[];     // carrito guardado al cambiar de contexto
}
```

**Estado nuevo**: `pickupTabs: PickupTabLocal[]`, `activePickupTabId: string | null`, modal fields (`newPickupNumber`, `newPickupName`, `newPickupPhone`).

**Derivado**: `activePickupTab = useMemo(() => pickupTabs.find(t => t.id === activePickupTabId))`.

**Flujo**:
1. Clic "🛍️ Venta Directa / Pickup" → abre modal con número auto-generado `PK-NN` (editable), nombre y teléfono opcionales.
2. Confirmar → crea `PickupTabLocal` con cart vacío, lo activa, limpia carrito.
3. Items se acumulan en `cart` (estado global) como antes.
4. **Al cambiar de contexto** (pickup→mesa, mesa→pickup, pickup→otro pickup): `saveActivePickupCart(cart)` guarda `cart` en `pickupTabs[activeId].cart` antes de `resetTableState()`.
5. Sidebar muestra lista de tabs abiertos (`PK-01 · Juan · $12.50`); clic activa el tab y restaura su carrito; `×` descarta el tab.
6. Botón "COBRAR" idéntico al anterior (`handleCheckoutPickup`). Al éxito: elimina el tab completado de `pickupTabs`, activa el siguiente si existe, sale de pickup mode si no quedan tabs.

**Funciones añadidas**: `openPickupModal()`, `handleCreatePickupTab()`, `handleSelectPickupTab(tabId)`, `handleDiscardPickupTab(tabId)`, `saveActivePickupCart(cart)`.

**No requiere cambios en backend** — `createSalesOrderAction` no cambia; el tab de pickup es puramente frontend.

---

#### Cambio 4 — Factura: descuento divisas visible y línea de propina (commit `b5abd37`)

**Archivos**: `src/lib/print-command.ts`, `src/app/dashboard/pos/restaurante/page.tsx`

**4a — Descuento divisas siempre visible**:
- Antes: `hideDiscount=true` (DIVISAS_33) suprimía completamente la línea de descuento → factura mostraba subtotal=$20, TOTAL=$13.33 sin explicación.
- Ahora: siempre se imprime si `discountAmount > 0`. Label: `data.discountReason` si existe, o `'Desc. divisas (33.33%)'` si `hideDiscount=true`, o `'Descuento aplicado'` como fallback.
- Código: `${discountAmount > 0 ? \`...(data.discountReason || (data.hideDiscount ? 'Desc. divisas (33.33%)' : 'Descuento aplicado'))...\` : ''}`

**4b — Propina en recibo**:
- `ReceiptData` recibe `tipAmount?: number`.
- Si `tipAmount > 0`, se imprime línea informativa `Propina: $XX.XX` después del bloque TOTAL/TOTAL A PAGAR.
- En el pago de mesa (`handlePaymentPinConfirm`): `tipVal` se calcula antes de `printReceipt` y se pasa como `tipAmount`; luego se llama `recordCollectiveTipAction` con el mismo valor (sin cambio funcional).
- En checkout pickup (`handleCheckoutPickup`): `pickupTipVal = parseFloat(checkoutTip) || 0` se pasa como `tipAmount` en `pickupReceiptData`.

### 18.15 Bugfix: pago mixto mesa completamente bloqueado (2026-04-12)

#### commit `9a23869` — fix(pos): pago mixto mesa bloqueado — 3 fixes

**Síntoma**: Al activar "Pago Mixto" en el cobro de mesa, el botón "🔐 REGISTRAR PAGO" permanecía disabled aunque el usuario hubiera ingresado todos los montos (ej: $100 Efectivo + $10.05 PDV). El sistema no aceptaba el pago ni permitía imprimir la factura.

---

**Bug 1 — BLOQUEADOR: botón siempre disabled en modo mixto**

`disabled={paidAmount <= 0 || isProcessing}` — `paidAmount` se deriva del input de pago único (`amountReceived`), que se limpia a `""` en la línea que activa el modo mixto:

```javascript
onClick={() => { setIsTableMixedMode(true); setAmountReceived(""); }}
//                                                              ^^^  → paidAmount = 0 para siempre
```

Fix: la condición ahora es:
```javascript
disabled={isTableMixedMode
  ? (totalMixedTablePaid <= 0 || isProcessing)
  : (paidAmount <= 0 || isProcessing)}
```
El texto del botón también muestra el total mixto: `isTableMixedMode ? totalMixedTablePaid : paidAmount`.

Añadido: `const totalMixedTablePaid = mixedPaymentsTable.reduce((s, p) => s + p.amountUSD, 0)` como valor derivado explícito.

---

**Bug 2 — roundToWhole aplicado al target del MixedPaymentSelector**

```typescript
// Antes (single paymentMethod afectaba el modo mixto):
const paymentAmountToCharge = roundToWhole(
  serviceFeeIncluded ? paymentBaseAmount * 1.1 : paymentBaseAmount,
  paymentMethod  // ← CASH_USD → Math.round → $110.05 se vuelve $110
);

// Después:
const paymentAmountToCharge = isTableMixedMode
  ? (serviceFeeIncluded ? paymentBaseAmount * 1.1 : paymentBaseAmount)  // exacto
  : roundToWhole(..., paymentMethod);  // solo single-mode se redondea
```

En modo mixto el target del `MixedPaymentSelector` es ahora el monto exacto con centavos. Evita que un total de $110.05 se muestre como $110 causando que el selector marque "Completado" con $0.05 pendiente o que al cobrar exacto quede saldo residual.

---

### 18.16 Bugfix: reimpresión pickup y subtotal factura mesa (2026-04-12)

#### commit `18eb9c3` — fix(pos): bugfix reimpresión pickup y subtotal en factura mesa

---

**BUG 1 — Reimpresión pickup: botón desaparece tras cobrar el último tab**

**Síntoma**: Al cobrar el último pickup tab activo, la cajera ya no podía reimprimir la factura porque el botón "🖨️ Imprimir factura" quedaba invisible.

**Causa**: En `handleCheckoutPickup`, al detectar `remaining.length === 0`, se llamaba `setIsPickupMode(false)`. Esto ocultaba todo el panel derecho de pickup (el bloque `{isPickupMode ? ... : ...}`), incluido el botón de reimpresión que vive dentro de ese bloque.

**Fix**: Se eliminó `setIsPickupMode(false)` de la rama `remaining.length === 0`. El modo pickup **permanece activo** con el carrito vacío, manteniendo visible el botón de reimpresión. La cajera sale del modo pickup haciendo clic en cualquier zona/mesa de la columna izquierda (esos botones ya llamaban `setIsPickupMode(false)` antes del fix).

```typescript
// Antes:
} else {
  setCart([]);
  setActivePickupTabId(null);
  setIsPickupMode(false);  // ← ocultaba el panel y el botón de reimpresión
  setPickupCustomerName("");
}

// Después:
} else {
  setCart([]);
  setActivePickupTabId(null);
  // isPickupMode=true se mantiene → panel sigue visible con botón de reimpresión
  setPickupCustomerName("");
}
```

---

**BUG 2 — Subtotal incorrecto en factura de mesa**

**Síntoma**: En el recibo de mesa, el subtotal mostrado no reflejaba el valor correcto del tab, lo que potencialmente causaba una inconsistencia entre la línea de descuento y el total.

**Causa**: `handlePaymentPinConfirm` calculaba el subtotal usando `(activeTab as any).runningSubtotal` (campo no incluido en `OpenTabSummary`, casteado con `as any`). Siempre caía en el fallback `activeTab.orders.reduce(...)` que sumaba manualmente los `lineTotal` de todos los ítems. Este valor podía diferir de `runningTotal` si había descuentos o ajustes previos en la DB.

**Fix**: Se reemplazó por `activeTab.runningTotal` — el campo tipado en `OpenTabSummary` (línea 102), que es la base canónica del tab. Es consistente con cómo `handlePrintPrecuenta` calcula su base:

```typescript
// Antes:
const subtotal = (activeTab as any).runningSubtotal
  ?? activeTab.orders.reduce((s, o) => s + o.items.reduce(...), 0);

// Después:
const subtotal = activeTab.runningTotal;
```

Con esto, la receta de mesa muestra:
- `Subtotal: $110.00` (= `runningTotal`, base antes del descuento de caja)
- `Desc. divisas (33.33%): -$36.67` (= `discountAmount = balanceDue / 3`)
- `TOTAL: $73.33`

---

### 18.17 Merge rama finanzas de Gustavo + bugfix MoM (2026-04-12)

#### Contexto
Se integró la rama `claude/improve-finance-sections-S7urM` al master. Esta rama contenía mejoras sustanciales a los módulos de finanzas desarrolladas por Gustavo de forma independiente (sin fork).

#### Lo que se integró (7 archivos)

**`finance.actions.ts`** — Backend enriquecido:
- `avgTicket` por orden calculado en servidor
- `byPaymentMethod`: ventas desglosadas por método de pago con conteo
- `dailySales`: ventas por día del mes para gráfico de línea
- `byCategory[].pct`: porcentaje de cada categoría sobre total de gastos
- `topExpenses`: top 5 gastos del período ordenados por monto
- `aging`: buckets de cuentas por pagar vencidas (0-30, 31-60, 61-90, 90+ días)
- `cashFlow`: inflows (ventas) + outflows (gastos + pagos a proveedores) + net
- `mom`: Month-over-Month % de cambio en ventas, gastos, utilidad y órdenes
- `getMonthlyTrendAction`: ahora incluye COGS en la tendencia histórica
- `getDailySalesAction`: nueva action para ventas diarias por demanda

**`finanzas-view.tsx`** — Dashboard financiero completo:
- Indicadores MoM con flechas ▲▼ en todas las tarjetas KPI
- Ticket promedio como nueva card (reemplaza "Costo de Ventas")
- Cash Flow: panel de 3 columnas (entradas / salidas / flujo neto)
- Gráfico de línea: ventas diarias del mes
- Gráfico donut: gastos por categoría con % y leyenda
- Gráfico de barras apiladas: tendencia 6 meses (ventas / COGS / gastos / utilidad)
- Top 5 gastos del período con categoría y fecha
- Barras de progreso: ventas por método de pago
- Aging report de cuentas por pagar vencidas (4 buckets)
- Alertas financieras automáticas (margen bajo, pérdida operativa, caída de ventas, flujo negativo)
- Exportación Excel del P&L completo con sección de Cash Flow (ExcelJS)

**`gastos-view.tsx`** — Módulo gastos enriquecido:
- Indicador MoM en KPI de total gastos (vs mes anterior, cargado en mount)
- Pie chart: distribución por categoría
- Bar chart horizontal: por método de pago
- Bar chart: tendencia 6 meses (6 llamadas secuenciales en `useEffect`)
- Filtros por categoría y método de pago (client-side sobre `expenses[]`)
- Exportación Excel con filtros aplicados (ExcelJS)

**`caja-view.tsx`** — Resumen mensual:
- `monthlyStats`: totalSales, totalExpenses, totalDifference, avgDifference, perfectShifts
- Cards de resumen del mes (ventas, gastos, diferencia acumulada, % precisión de cuadre)
- Bar chart: tendencia de diferencias por turno con `ReferenceLine` en y=0

**`cuentas-pagar-view.tsx`** — Aging report expandido:
- Aging de 5 buckets (Vigente + 4 overdue) calculado client-side sobre `accounts[]`
- Resumen por proveedor/acreedor (top 8 por monto pendiente)
- Próximos vencimientos: cuentas con vencimiento en los próximos 14 días
- Supplier summary con conteo y monto agrupado por acreedor

**`dashboard/page.tsx`** — Widget financiero:
- Se llama `getFinancialSummaryAction()` en paralelo con `getDashboardStatsAction()`
- Widget de 5 columnas: Ventas / Gastos / Utilidad / Flujo Neto / Deudas
- Indicadores MoM inline (▲▼ con colores)
- Acceso rápido a `/dashboard/finanzas` desde la grilla de módulos

#### Bug corregido durante la integración

**MoM utilidad operativa inconsistente** (`finance.actions.ts`):

```typescript
// ANTES — prevProfit no incluía COGS del mes anterior:
const prevSales = prevSalesAgg._sum.total ?? 0;
const prevProfit = prevSales - prevExpenses;  // ❌ missing prevCogs

// DESPUÉS — se cambió aggregate por findMany para obtener items:
const [prevSalesOrders, prevExpAgg] = await Promise.all([
  prisma.salesOrder.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: prevStart, lte: prevEnd } },
    select: { total: true, items: { select: { costTotal: true } } },
  }),
  ...
]);
const prevSales = prevSalesOrders.reduce((s, o) => s + o.total, 0);
const prevCogs  = prevSalesOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + (i.costTotal ?? 0), 0), 0);
const prevProfit = prevSales - prevCogs - prevExpenses;  // ✅ fórmula consistente
```

Sin este fix, `profitChange` comparaba `operatingProfit` (que descuenta COGS) contra un `prevProfit` sin COGS, generando un % de cambio siempre inflado artificialmente.

#### Notas de arquitectura
- **ExcelJS en cliente**: `finanzas-view.tsx` y `gastos-view.tsx` importan ExcelJS a nivel de módulo (`import ExcelJS from 'exceljs'`). ExcelJS v4+ soporta browser via webpack. Funciona en Next.js 14 con su configuración por defecto. Si el bundle crece, migrar a dynamic import dentro de la función de exportación.
- **Tendencia gastos**: `gastos-view.tsx` hace 6 llamadas secuenciales a `getExpensesAction` en `useEffect`. Aceptable para un panel admin con datos históricos.
- **Cash Flow**: `outflows = totalExpensesUsd + accountPayments`. Son tablas independientes (`Expense` = gastos operativos directos; `AccountPayment` = pagos a proveedores por crédito). No hay doble conteo si el equipo no registra el mismo pago en ambas tablas.

---

### 18.18 Bugfixes flujo Pickup — 4 correcciones (2026-04-13)

#### commits `41c1c39` `ea2318c` `097a71a` `da496ac`

---

**FIX 4 — Vuelto no se registra como propina (crítico)**

`handleCreatePickupTab` y `handleSelectPickupTab` ahora llaman `setAmountReceived("")`, `setCheckoutTip("")`, `setIsPickupMixedMode(false)` y `setMixedPaymentsPickup([])` al activar cualquier tab. Antes, `checkoutTip` persistía entre tabs: si la cajera había ingresado "30" en el campo propina de PK-01 y luego cambiaba a PK-02, ese valor viajaba al nuevo cobro y hacía que `change = 0` y el Z-report contara `$30` como propina (`orderTip = change === 0 && amountPaid > total`).

UX del bloque vuelto mejorado: "Vuelto a devolver" es ahora la línea prominente (tamaño grande, arriba). "Propina voluntaria" queda en sección secundaria con label aclarado "solo si el cliente la deja" y botón `×` para borrarla rápido.

---

**FIX 3 — Recibo pickup muestra código PK y nombre del cliente**

`pickupReceiptData` incluye ahora:
```typescript
tableLabel: activeTabSnap?.pickupNumber,       // → "PK-02"
tableLabelTitle: "Pickup",                     // → etiqueta en recibo
customerName: activeTabSnap?.customerName || pickupCustomerName || "Cliente en Caja",
```
`activeTabSnap` es un snapshot del tab activo tomado **antes** del checkout (evita carreras si `pickupTabs` cambia). `lastPickupOrder` también guarda `pickupNumber` para la reimpresión.

`print-command.ts` recibe nuevo campo `tableLabelTitle?: string` (default `'Mesa'`). El HTML imprime `${data.tableLabelTitle ?? 'Mesa'}:` → pickup muestra "Pickup: PK-02", mesas muestran "Mesa: Mesa 5".

---

**FIX 2 — COBRAR requiere monto en métodos de efectivo**

Nueva constante `METHODS_REQUIRING_AMOUNT = Set{CASH_USD, CASH_EUR, ZELLE, CASH_BS}`. PDV_SHANKLISH, PDV_SUPERFERRO y MOVIL_NG quedan excluidos (el terminal procesa el monto exacto).

Botón COBRAR:
```tsx
const needsAmount = !isPickupMixedMode && METHODS_REQUIRING_AMOUNT.has(paymentMethod) && paidAmount <= 0;
disabled={cart.length === 0 || isProcessing || needsAmount}
```
Si `needsAmount`, aparece `"⚠️ Ingresa el monto recibido"` encima del botón.

---

**FIX 1 — Número de pickup secuencial del día y no editable**

Nueva Server Action `getDailyPickupCountAction()` en `pos.actions.ts`:
```typescript
const count = await prisma.salesOrder.count({
    where: { orderType: 'PICKUP', sourceChannel: 'POS_RESTAURANT',
             createdAt: { gte: start, lte: end } },  // rango día Caracas
});
return { success: true, nextNumber: `PK-${(count + 1).toString().padStart(2, '0')}` };
```

`openPickupModal()` es ahora `async`: muestra `"PK-…"` mientras espera la respuesta del servidor, luego actualiza. El campo en el modal cambió de `<input>` editable a `<div>` estático — la cajera ya no puede modificar el número.

---

### 18.19 Fix: numeración PK con huecos, sin anulados, persistida en BD (2026-04-13)

#### commit `d1f82a9`

**Tres bugs en la implementación anterior de `getDailyPickupCountAction`:**

1. **`orderType: 'PICKUP'` incorrecto** — En la BD, `orderType='PICKUP'` solo lo usan las propinas colectivas (`recordCollectiveTipAction`). Las ventas directas/pickup reales tienen `orderType='RESTAURANT'`.
2. **Cancelados contaban** — No había filtro de `status`, por lo que un PK anulado bloqueaba ese número para siempre en el día.
3. **Sin persistencia del PK en BD** — El número PK era solo frontend. La action no podía saber qué números ya se habían usado, haciendo imposible la detección de huecos.

---

**Solución completa (`pos.actions.ts` + `page.tsx`):**

**Persistencia del PK en `notes`** — `handleCheckoutPickup` ahora incrusta el número en el campo `notes` de la orden al hacer checkout:
```typescript
notes: activeTabSnap?.pickupNumber
  ? `Venta Directa Pickup | ${activeTabSnap.pickupNumber}`   // → "Venta Directa Pickup | PK-02"
  : "Venta Directa Pickup",
```
`activeTabSnap` se captura al inicio de `handleCheckoutPickup` (antes del primer `await`) para evitar carreras con el estado de `pickupTabs`.

**`getDailyPickupCountAction` reescrita:**
```typescript
export async function getDailyPickupCountAction(
    openTabNumbers: string[] = [],   // tabs abiertos en memoria, pasados desde el cliente
): Promise<{ success: boolean; nextNumber: string }>
```
```typescript
// 1. Consultar BD: RESTAURANT, no cancelados, con "Venta Directa Pickup" en notes
const orders = await prisma.salesOrder.findMany({
    where: {
        orderType: 'RESTAURANT',
        sourceChannel: 'POS_RESTAURANT',
        status: { not: 'CANCELLED' },
        notes: { contains: 'Venta Directa Pickup' },
        createdAt: { gte: start, lte: end },
    },
    select: { notes: true },
});

// 2. Extraer números PK de los notes (patrón "PK-NN")
const usedNums = new Set<number>();
for (const o of orders) {
    const m = o.notes?.match(/PK-(\d+)/);
    if (m) usedNums.add(parseInt(m[1], 10));
}

// 3. Agregar tabs abiertos en memoria
for (const pk of openTabNumbers) {
    const m = pk.match(/PK-(\d+)/);
    if (m) usedNums.add(parseInt(m[1], 10));
}

// 4. Primer entero positivo no usado (primer hueco)
let next = 1;
while (usedNums.has(next)) next++;
```

**`openPickupModal`** pasa los tabs en memoria:
```typescript
const openNumbers = pickupTabs.map((t) => t.pickupNumber);
const res = await getDailyPickupCountAction(openNumbers);
```

**Resultado:** si hoy se crearon PK-01 y PK-03 (PK-02 fue anulado), la acción devuelve `PK-02`. Los cancelados liberan su número. Los tabs abiertos en RAM también se excluyen.

---

### 18.20 Debug: console.log en getDailyPickupCountAction para diagnóstico PK (2026-04-13)

#### commit `0b2cb4e`

**Contexto:** Se reportó que al abrir un segundo tab (PK-02) antes de cobrar el primero (PK-01), la action volvía a asignar PK-01. La lógica era correcta en teoría, pero se necesitaba verificar qué datos llegaban realmente al servidor.

**Se agregaron 4 `console.log` en `getDailyPickupCountAction`** (`src/app/actions/pos.actions.ts`):

```typescript
// Después de la consulta a BD:
console.log('[PK] openTabNumbers recibidos:', openTabNumbers);
console.log('[PK] Órdenes en BD encontradas:', orders.map(o => o.notes));

// Después de armar el Set combinado:
console.log('[PK] usedNums (BD + memoria):', Array.from(usedNums).sort((a, b) => a - b));

// Antes de retornar:
console.log('[PK] nextNumber calculado:', `PK-${next.toString().padStart(2, '0')}`);
```

**Diagnóstico esperado** en los logs del servidor al abrir el segundo tab con PK-01 activo:
```
[PK] openTabNumbers recibidos: [ 'PK-01' ]
[PK] Órdenes en BD encontradas: []
[PK] usedNums (BD + memoria): [ 1 ]
[PK] nextNumber calculado: PK-02
```

**Si `openTabNumbers` aparece vacío `[]`**, el bug está en el cliente — `pickupTabs.map(t => t.pickupNumber)` devuelve vacío porque el tab no tiene `pickupNumber` asignado en ese momento.

**Estado:** logs temporales de diagnóstico — remover una vez confirmado el fix.

---

### 18.21 Bugfixes impresión y subcuentas — 4 correcciones (2026-04-13)

#### commits `786668d` (print) + `a95232e` (subcuentas)

---

#### BUG 1 — "Subtotal con desc." en recibo de impresión

**Archivo:** `src/lib/print-command.ts`

**Problema:** El recibo mostraba el descuento pero no el resultado post-descuento. La cajera no podía ver el subtotal neto de un vistazo.

**Fix:** Después del bloque del descuento, se agrega una línea adicional solo cuando `discountAmount > 0`:
```javascript
${discountAmount > 0 ? `
<div class="total-row">
    <span>${data.discountReason || ...}:</span>
    <span>-$${discountAmount.toFixed(2)}</span>
</div>
<div class="total-row">
    <span>Subtotal con desc.:</span>
    <span>$${(subtotal - discountAmount).toFixed(2)}</span>
</div>
` : ''}
```

**Resultado visual:**
```
Subtotal:             $30.00
Cortesía Autorizada:  -$9.00
Subtotal con desc.:   $21.00
TOTAL:                $21.00
```

---

#### BUG 2A — Infinite render/fetch loop al activar subcuentas (CRÍTICO)

**Archivos:** `src/components/pos/SubAccountPanel.tsx`

**Causa raíz:** `onTabUpdated={() => loadData()}` en `page.tsx` crea una nueva arrow function reference en cada render. Esto causaba un ciclo infinito:
1. Parent render → nueva `onTabUpdated` fn
2. `loadTab` useCallback (deps: `[openTabId, onTabUpdated]`) recrea
3. `useEffect([loadTab])` dispara `loadTab()`
4. `loadTab()` llama `onTabUpdated()` → `loadData()` → 4 API calls → parent re-render
5. Volver al paso 1

**Fix:** Patrón `useRef` para estabilizar el callback sin moverlo a los deps:
```typescript
// En SubAccountPanel:
const onTabUpdatedRef = useRef(onTabUpdated);
useEffect(() => { onTabUpdatedRef.current = onTabUpdated; }, [onTabUpdated]);

const loadTab = useCallback(async () => {
    const res = await getOpenTabWithSubAccountsAction(openTabId);
    if (res.success && res.data) {
        setTab(res.data as TabWithSubs);
        onTabUpdatedRef.current(res.data);  // ref, nunca en deps
    }
}, [openTabId]); // ← onTabUpdated removido de deps
```

---

#### BUG 2B — Extra round-trip innecesario en handlePay

**Archivo:** `src/components/pos/SubAccountPanel.tsx`

**Problema:** `handlePay` llamaba `loadTab()` después de `paySubAccountAction`, que ya devuelve el tab actualizado en `res.data`. Esto causaba un fetch extra y disparaba el ciclo `onTabUpdated` una vez más.

**Fix:**
```typescript
if (res.data) {
    setTab(res.data as TabWithSubs);   // usar datos devueltos directamente
    onTabUpdatedRef.current(res.data);
} else {
    await loadTab(); // fallback
}
```

---

#### BUG 2C — balanceDue sobre-deducido al cobrar subcuenta

**Archivo:** `src/app/actions/pos.actions.ts` — `paySubAccountAction`

**Problema:** `balanceDue` del `OpenTab` acumula solo totales de ítems de comida (sin service charge). Pero `paySubAccountAction` descontaba `sub.total` (= `subtotal + serviceCharge`), resultando en sobre-deducción. En una mesa con dos subcuentas iguales de $30 comida + $3 service:
- `balanceDue` inicial: $60
- Tras pagar subcuenta A con `sub.total = $33`: `balanceDue = max(0, 60-33) = $27` ← incorrecto (debería ser $30)
- Tras pagar subcuenta B con `sub.total = $33`: `balanceDue = max(0, 27-33) = $0` ← OK pero display intermedio era erróneo

**Fix:**
```typescript
// Antes:
const newBalance = Math.max(0, openTab.balanceDue - sub.total);
// Después:
const newBalance = Math.max(0, openTab.balanceDue - sub.subtotal);
```

---

### 18.22 Rediseño layout POS Delivery — pantalla dividida (2026-04-13)

#### commit `8162f2e`

**Archivo:** `src/app/dashboard/pos/delivery/page.tsx`

**Motivación:** En monitores de 1920×1080 (LG 24"), el layout anterior tenía los datos del cliente (nombre, teléfono, dirección) en la parte superior del **panel derecho**, mezclados con el carrito y el cobro. La cajera debía hacer scroll para ver todos los elementos. El menú de productos ocupaba el panel izquierdo sin contexto del cliente.

---

**Nuevo layout de dos paneles:**

```
┌─ PANEL IZQUIERDO (flex-1) ──────────────────┬─ PANEL DERECHO (420/480px) ─┐
│ [Nombre ──────────── | Teléfono]             │ [🛒 Pedido  ×N ítems]       │
│ [📍 Dirección exacta de entrega...]          │ [resumen cliente 1 línea]   │
│ ─────────────────────────────────            │ ─────────────────────        │
│ [🔍 Buscar producto...]                      │ item 1 ........... $12.00   │
│ [Cat1] [Cat2] [Cat3] [Cat4]...               │ item 2 ............ $8.00   │
│                                              │ item 3 ........... $35.00   │
│ [prod][prod][prod][prod]                     │ ─────────────────────        │
│ [prod][prod][prod][prod]                     │ Subtotal          $55.00    │
│ [prod][prod][prod][prod]                     │ Delivery          +$4.50    │
│                                              │ TOTAL             $59.50    │
│                                              │ [Normal][Divisa][Cortesía]  │
│                                              │ [Único ][  Mixto          ] │
│                                              │ [Cash$][Zelle][PDV Shan.]   │
│                                              │ [Monto recibido...  USD]    │
│                                              │ [ CONFIRMAR ORDEN ]         │
└──────────────────────────────────────────────┴─────────────────────────────┘
```

---

**Cambios técnicos clave:**

1. **Datos del cliente → panel izquierdo (barra superior compacta):**
   ```tsx
   <div className="px-4 py-3 bg-blue-950/40 border-b border-blue-500/20 shrink-0">
     <div className="grid grid-cols-2 gap-2 mb-2">
       <input ... placeholder="👤 Nombre del cliente" />
       <input type="tel" ... placeholder="📞 Teléfono" />
     </div>
     <input ... placeholder="📍 Dirección exacta de entrega..." />
   </div>
   ```
   - Botón "Limpiar ✕" aparece cuando hay datos ingresados
   - `type="tel"` en teléfono para teclado numérico en mobile

2. **Panel derecho → solo carrito + cobro:**
   - Eliminados los 3 inputs de cliente del panel derecho
   - Encabezado compacto con contador de ítems (`×N ítems`)
   - Resumen readonly del cliente en 1 línea (`nombre · teléfono · dirección`) visible cuando hay datos — formato `bg-blue-950/30 border-b border-blue-500/20`
   - Botón "Vaciar ✕" para limpiar el carrito directamente
   - Items del carrito más compactos (`rounded-xl px-3 py-2.5` vs `rounded-2xl p-4`)
   - `flex-1 min-h-0` en la lista del carrito para scroll correcto

3. **Botones de cobro más compactos para 1080p:**
   - Descuentos en 3 columnas en una sola fila (`grid-cols-3`) en vez de 2 filas
   - `py-2.5 text-xs` en todos los botones de acción (vs `py-3.5 text-sm` anterior)
   - Panel de pago usa `maxHeight: '62%'` con `overflow-y-auto` para no ocupar espacio excesivo

4. **Panel derecho más estrecho:** `w-[420px] xl:w-[480px]` (vs `w-[460px] xl:w-[520px]`) — el espacio liberado va al panel del menú.

---

**Resultado operacional:**
- La cajera ingresa nombre y teléfono **mientras** navega el menú — sin cambiar de panel
- El carrito y el cobro siempre están visibles en el panel derecho
- En monitores de 1080p todo cabe sin scroll en el panel de cobro

---

---

### 18.23 Sistema de Mesoneros con PIN — FASES 1-4 (2026-04-17)

#### Commits: `[fase1-4 session commits]`

**Objetivo**: Identificación individual de mesoneros en POS Mesero por PIN numérico, con historial de transferencias de mesa y control por capitanes.

---

#### Modelos Prisma nuevos/modificados

**`Waiter`** — campos añadidos:
- `pin String?` — hash PBKDF2-SHA256 formato `saltHex:hashHex`, 100k iteraciones. Almacena nunca en claro.
- `isCaptain Boolean @default(false)` — habilita subcuentas y autorización de transferencias

**`TableTransfer`** — modelo nuevo:
```prisma
model TableTransfer {
  id             String   @id @default(cuid())
  openTabId      String
  openTab        OpenTab  @relation(fields: [openTabId], references: [id], onDelete: Cascade)
  fromWaiterId   String
  fromWaiter     Waiter   @relation("TransferFrom",       fields: [fromWaiterId],   references: [id])
  toWaiterId     String
  toWaiter       Waiter   @relation("TransferTo",         fields: [toWaiterId],     references: [id])
  authorizedById String
  authorizedBy   Waiter   @relation("TransferAuthorizer", fields: [authorizedById], references: [id])
  reason         String?
  transferredAt  DateTime @default(now())
  @@index([openTabId])
  @@index([fromWaiterId])
  @@index([toWaiterId])
}
```

**`OpenTab`** — campo añadido: `waiterProfileId String?` → Waiter (FK, SET NULL)
**`SalesOrder`** — campo añadido: `waiterProfileId String?` → Waiter (FK, SET NULL)

---

#### Flujo de identificación por PIN

1. POS Mesero carga → lee `sessionStorage["pos-mesero-active-waiter"]`
2. Si vacío → renderiza `<WaiterIdentification>` (teclado numérico, lista de mesoneros con PIN)
3. El mesonero ingresa su PIN → `validateWaiterPinAction(pin)` (sin sesión de usuario requerida)
4. Action busca candidatos activos con `pin != null` en el branch, ejecuta `verifyPin()` en loop
5. Match → devuelve `{ waiterId, firstName, lastName, isCaptain }` → se guarda en sessionStorage
6. POS recarga normalmente con identidad del mesonero activo

**Persistencia**: `sessionStorage` (se pierde al cerrar la pestaña — correcto para turno de trabajo)

---

#### Server Actions — `waiter.actions.ts`

| Action | Descripción |
|--------|-------------|
| `getWaitersAction()` | Lista con `hasPin: boolean` (PIN nunca expuesto) |
| `getActiveWaitersAction()` | Solo activos, mismo formato |
| `createWaiterAction(data)` | Crea mesonero. Solo OWNER/ADMIN_MANAGER/OPS_MANAGER pueden asignar PIN |
| `updateWaiterAction(id, data)` | PIN: undefined=no tocar, null/''=borrar, string=hashear+guardar |
| `validateWaiterPinAction(pin)` | Sin sesión. Devuelve waiterId + nombre + isCaptain |
| `transferTableAction({openTabId, fromWaiterId, toWaiterId, captainPin, reason})` | Requiere PIN de capitán activo. Crea TableTransfer + actualiza OpenTab.waiterProfileId en transacción |

**`PIN_MANAGER_ROLES`**: `new Set(['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'])` — únicos que pueden asignar/cambiar PINs en UI de mesoneros. HR_MANAGER gestiona mesoneros pero NO puede asignar PINs.

---

#### Componentes POS

**`src/components/pos/WaiterIdentification.tsx`**:
- Pantalla de bloqueo con teclado numérico 3×4
- Lista de mesoneros activos con PIN (`hasPin: true`)
- Soporte teclado físico (`keydown`)
- Display de 6 puntos animados
- Paleta de colores de avatar determinista por ID de mesonero

**`src/app/dashboard/pos/mesero/page.tsx`** — cambios Fase 2-4:
- Gate: si `!activeWaiter` → renderiza `<WaiterIdentification>`
- Mesa libre → modal "Abrir cuenta" centrado z-[60] directo (sin botón inferior)
- "🧾 Mostrar cuenta al cliente" → bill modal z-[70] con subtotal, servicio 10%, total USD, divisas 33%, Bs con tasa
- Subcuentas y "↔ Transferir mesa" visibles solo cuando `activeWaiter.isCaptain`
- `waiterProfileId: activeWaiter.id` propagado a `openTabAction`, `addItemsToOpenTabAction`, `removeItemFromOpenTabAction`

---

#### UI Gestión de Mesoneros — `src/app/dashboard/mesoneros/`

**`page.tsx`** (Server Component): verifica sesión + rol, pasa `currentUserRole` al cliente
**`mesoneros-view.tsx`** (Client Component):
- Lista de mesoneros con badge "🔒 PIN" / "Sin PIN" y "⭐ Capitán"
- Formulario con campo PIN (visible solo para `PIN_MANAGER_ROLES`)
- Checkbox "Borrar PIN" para limpiar hash existente
- Toggle isCaptain disponible para todos los roles con acceso al módulo

---

#### Capitanes activos

Los capitanes son mesoneros con `isCaptain = true` y PIN configurado. Autorizan:
- Transferencias de mesa (PIN requerido en modal "↔ Transferir mesa")
- Subcuentas / división de cuenta

**Capitanes actuales** (configurar en /dashboard/mesoneros):
- **Yair** — mesonero con isCaptain=true (también con acceso a POS Restaurante como AREA_LEAD)
- **Julhian** (antes Alexis) — mesonero con isCaptain=true

---

#### Usuarios — cambios FASE 4

| Cambio | Detalle |
|--------|---------|
| **Nuevo usuario** `mesonero@shanklish.com` | Rol CASHIER, `allowedModules = '["pos_waiter"]'`, contraseña temporal `Mesonero2024!` (plaintext legacy — actualizar via admin UI) |
| **Yair** `yair@shanklish.com` | Rol AREA_LEAD. Ahora tiene acceso a `pos_restaurant` vía MODULE_ROLE_ACCESS |
| **Alexis → Julhian** | Email cambiado: `alexis@shanklish.com` → `julhian@shanklish.com` |

---

#### Migraciones SQL (cronológico)

| Archivo | Contenido |
|---------|-----------|
| `20260417000000_add_waiter_pin` | `ALTER TABLE "Waiter" ADD COLUMN "pin" TEXT` |
| `20260417010000_add_waiter_profile_to_tabs_and_orders` | `waiterProfileId` en OpenTab y SalesOrder (FK SET NULL) |
| `20260417020000_add_waiter_is_captain` | `ALTER TABLE "Waiter" ADD COLUMN "isCaptain" BOOLEAN NOT NULL DEFAULT false` |
| `20260417030000_add_table_transfer` | CREATE TABLE TableTransfer con 4 FKs nombradas |
| `20260417040000_data_fase4` | INSERT mesonero@shanklish.com · UPDATE alexis→julhian email |

---

### 18.24 Fix: mesonero@shanklish.com no debe ver POS Restaurante (2026-04-17)

**Problema diagnosticado (3 capas):**

1. **BD correcta** — `allowedModules = '["pos_waiter"]'` ya estaba en producción. Verificado con `scripts/fix-mesonero-modules.ts`.
2. **MODULE_ROLE_ACCESS** — `pos_restaurant` incluía `CASHIER` en su array de roles, dando acceso por rol antes de que `allowedModules` pudiera bloquearlo.
3. **Redirección hardcodeada** — `dashboard/page.tsx` redirigía todo CASHIER a `/dashboard/pos/restaurante` sin consultar `allowedModules`.

---

#### FIX 1 — `src/lib/constants/modules-registry.ts`

**`MODULE_ROLE_ACCESS['pos_restaurant']`:** eliminado `CASHIER` del array de roles.

```typescript
// ANTES
pos_restaurant: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER', 'AREA_LEAD'],
// DESPUÉS
pos_restaurant: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD'],
```

**`getVisibleModules()`:** rediseñada — `allowedModules` es la **única autoridad** cuando está definido (reemplaza al rol, no se combina).

```typescript
// ANTES: dos filtros independientes (rol AND allowedModules)
.filter(m => allowedRoles.includes(userRole))
.filter(m => !userFilter || userFilter.has(m.id))

// DESPUÉS: allowedModules reemplaza al rol cuando está presente
.filter(m => {
  if (m.id === 'module_config') return userRole === 'OWNER';
  if (userFilter) return userFilter.has(m.id);   // override total
  const allowedRoles = MODULE_ROLE_ACCESS[m.id];
  if (!allowedRoles) return true;
  return allowedRoles.includes(userRole);
})
```

**Por qué importa:** con la lógica anterior, eliminar CASHIER de `pos_restaurant` también habría bloqueado a Elizabeth, Estefani, Gianni, cajera1 y cajera2, que tienen `pos_restaurant` en su `allowedModules`. Con el nuevo diseño, `allowedModules` garantiza acceso sin depender del rol.

**Estado de cajeras verificado antes del cambio:**

| Email | allowedModules relevantes |
|-------|--------------------------|
| elizabeth@shanklish.com | `pos_restaurant` ✅ |
| estefani@shanklish.com | `pos_restaurant` ✅ |
| gianni@shanklish.com | `pos_restaurant` ✅ |
| cajera1@shanklish.com | `pos_restaurant` ✅ |
| cajera2@shanklish.com | `pos_restaurant` ✅ |
| **mesonero@shanklish.com** | solo `pos_waiter` — sin pos_restaurant ✅ |

---

#### FIX 2 — `src/app/dashboard/page.tsx`

**Antes:** redirección hardcodeada ignorando `allowedModules`:
```typescript
if (session?.role === 'CASHIER') {
    redirect('/dashboard/pos/restaurante');
}
```

**Después:** consulta BD + `getVisibleModules()` → redirige al primer módulo visible real:
```typescript
if (session?.role === 'CASHIER' || session?.role === 'WAITER') {
    // leer allowedModules desde BD
    const dbUser = await prisma.user.findUnique({ where: { id: session.id }, select: { allowedModules: true } });
    if (dbUser?.allowedModules) userAllowedModules = JSON.parse(dbUser.allowedModules);
    const enabledIds = await getEnabledModulesFromDB();
    const visible = getVisibleModules(session.role, enabledIds, userAllowedModules);
    redirect(visible[0]?.href ?? '/dashboard/pos/restaurante');
}
```

`mesonero@shanklish.com` → `visible[0]` = POS Mesero → redirige a `/dashboard/pos/mesero`.

---

#### Commits de esta sesión

| Hash | Descripción |
|------|-------------|
| `474cde5` | fix(auth): allowedModules overrides role — remove CASHIER from pos_restaurant |
| `899d3c2` | fix(auth): redirigir al primer módulo visible en lugar de hardcode pos_restaurant |

---

### 18.25 BD: allowedModules de Yair y Julhian ampliados (2026-04-17)

Actualización directa en RDS. Ambos usuarios son `AREA_LEAD`. Se añadieron `pos_waiter` y `mesoneros` a sus `allowedModules` existentes sin quitar nada.

| Usuario | allowedModules resultante |
|---------|--------------------------|
| yair@shanklish.com | `["pos_restaurant","inventory_daily","inventory","estadisticas","transfers","pos_waiter","mesoneros"]` |
| julhian@shanklish.com | `["inventory","inventory_daily","transfers","pos_restaurant","pos_waiter","mesoneros"]` |

`pos_restaurant` ya lo tenían — no se duplicó. Script ejecutado: `scripts/_update_yair_julhian_tmp.ts` (temporal, eliminado post-ejecución).

---

### 18.26 Sistema de transferencia de mesa física (2026-04-17)

Implementado flujo completo para mover un OpenTab entre mesas físicas sin cerrar ni reabrir la cuenta.

#### Schema — `TableTransfer` extendido

```prisma
model TableTransfer {
  // ...campos existentes (fromWaiterId/toWaiterId para trazabilidad del mesonero)...
  fromTableId  String?   // FK → TableOrStation (nullable, retrocompatible)
  toTableId    String?   // FK → TableOrStation
}
```
Migración: `20260417080000_add_table_fields_to_table_transfer`

#### Action — `moveTabBetweenTablesAction` (`waiter.actions.ts`)

```typescript
moveTabBetweenTablesAction({
  openTabId: string,   // tab a mover
  toTableId: string,   // mesa destino (debe estar AVAILABLE)
  captainPin: string,  // PIN dual: Waiter capitán O User gerente
  reason?: string,
})
```

**Validaciones:** mesa destino `AVAILABLE`, sin OpenTab activo conflictivo, misma sucursal.  
**Transacción atómica:** `openTab.tableOrStationId = toTableId` + mesa origen → `AVAILABLE` + mesa destino → `OCCUPIED` + registro `TableTransfer` con `from/toTableId`.  
**PIN dual:** `resolveAuthPin` — Waiter `isCaptain:true` O User con rol `OWNER/ADMIN_MANAGER/OPS_MANAGER`.

#### UI — Modal en `mesero/page.tsx`

- Botón "↔ Transferir mesa" visible para capitanes (`canUseCaptainFeatures`)
- Grid 4 columnas con todas las mesas `AVAILABLE` del layout (con zona como subtítulo)
- Header muestra `Mesa A → Mesa B` en tiempo real al seleccionar
- Al éxito: `loadData(false)` (refresh silencioso) + `setSelectedTableId(toTableId)` para seguir viendo el tab

#### Commits

| Hash | Descripción |
|------|-------------|
| `99435c7` | feat(db): add fromTableId/toTableId to TableTransfer |
| `ba1aa2e` | feat(actions): moveTabBetweenTablesAction |
| `0b77982` | feat(ui): replace waiter-transfer modal with table-move modal |

---

### 18.27 Sistema de modificación de ítems enviados a cocina (2026-04-17)

Implementado sistema completo de soft delete y modificación de ítems ya enviados, con comanda de notificación a cocina y PIN dual.

#### Schema — `SalesOrderItem` extendido

```prisma
model SalesOrderItem {
  // ...campos existentes...

  // Soft delete / void tracking
  voidedAt         DateTime?
  voidReason       String?
  voidedByWaiterId String?   // FK → Waiter (capitán que autorizó)
  voidedByWaiter   Waiter?   @relation("ItemVoidedByWaiter", ...)
  voidedByUserId   String?   // FK → User (gerente que autorizó)
  voidedByUser     User?     @relation("ItemVoidedByUser", ...)
  replacedByItemId String?   // auto-relación: apunta al ítem de reemplazo
  replacedByItem   SalesOrderItem?  @relation("ItemReplacement", ...)
  replacements     SalesOrderItem[] @relation("ItemReplacement")
}
```
Migración: `20260417090000_add_item_void_tracking`

Los ítems con `voidedAt != null` se filtran en `ensureRestaurantSetup` (`where: { voidedAt: null }`) para no aparecer en el layout ni en los totales de la UI.

#### Action — `modifyTabItemAction` (`pos.actions.ts`)

```typescript
modifyTabItemAction({
  openTabId: string,
  orderId: string,
  itemId: string,
  captainPin: string,   // PIN dual: Waiter capitán O User gerente
  reason: string,       // obligatorio
  modification:
    | { type: 'VOID' }
    | { type: 'ADJUST_QTY'; newQuantity: number }   // newQuantity < item.quantity
    | { type: 'REPLACE'; newMenuItemId: string; newQuantity?: number }
})
```

**Modos de modificación:**

| Modo | Qué hace |
|------|----------|
| `VOID` | Soft delete del ítem: `voidedAt = now`, limpia SubAccountItems, recalcula totales orden + tab |
| `ADJUST_QTY` | Void del original + crea nuevo ítem con mismos datos pero `newQuantity`. Corrige totales para net delta |
| `REPLACE` | Void del original + crea nuevo ítem con nuevo `menuItemId`/`itemName`/`unitPrice`. Corrige totales |

En `ADJUST_QTY` y `REPLACE` el original queda con `replacedByItemId` apuntando al nuevo ítem (trazabilidad).

**PIN dual:** helper `resolveVoidAuthPin` — Waiter `isCaptain:true` O User con rol `OWNER/ADMIN_MANAGER/OPS_MANAGER/AREA_LEAD`.

**Devuelve `kitchenPrintData`** para que el cliente llame `printVoidKitchenCommand` inmediatamente.

#### Action legacy — `removeItemFromOpenTabAction`

Reescrita para usar soft delete + dual PIN (backward compat para integraciones externas). Ya no hace hard delete.

#### Función de impresión — `printVoidKitchenCommand` (`print-command.ts`)

```typescript
printVoidKitchenCommand(data: VoidKitchenCommandData, station?: 'kitchen' | 'bar')

interface VoidKitchenCommandData {
  orderNumber: string;
  tableName: string;
  authorizerName: string;
  waiterLabel?: string;
  modificationType: 'VOID' | 'ADJUST_QTY' | 'REPLACE';
  voidedItem:  { name: string; quantity: number; modifiers: string[] };
  newItem?:    { name: string; quantity: number; modifiers: string[] };
}
```

Imprime comanda 80mm con:
- Encabezado `⚠️ MODIFICACIÓN ⚠️` + número de orden grande
- Bloque ❌ CANCELADO con qty-box negro (ítem anulado)
- Bloque ✅ NUEVA CANTIDAD / NUEVO ÍTEM con qty-box blanco (si hay reemplazo)
- Usa iframe oculto (no interrumpe la pantalla activa)

#### UI — Modal unificado en `mesero/page.tsx` y `restaurante/page.tsx`

Al tocar `✕` (mesero, hover) o `🗑️` (restaurante) en un ítem enviado:

1. **3 botones de opción:** ❌ Cancelar · ✏️ Ajustar · 🔄 Cambiar
2. **Si ADJUST_QTY:** spinner numérico (mín 1, máx `quantity-1`)
3. **Si REPLACE:** input de búsqueda + lista scrollable de ítems del menú
4. **Motivo** (textarea, obligatorio)
5. **PIN de capitán o gerente** (input password)
6. **Al confirmar:** llama `modifyTabItemAction` → si éxito, imprime comanda de modificación → `loadData(false)` (refresh silencioso)

#### Commits

| Hash | Descripción |
|------|-------------|
| `bb934f3` | feat(paso1): void tracking on SalesOrderItem + modifyTabItemAction |
| `7c71413` | feat(paso2): printVoidKitchenCommand for kitchen void/modification receipts |
| `a2661c9` | feat(paso3): replace void modal with 3-option modify modal in mesero + restaurante |

---

### 18.28 Dual PIN auth en transferencia de mesa (2026-04-18)

Antes, `transferTableAction` solo aceptaba PIN de Waiter capitán. Ahora acepta **también PIN de User gerente** (OWNER/ADMIN_MANAGER/OPS_MANAGER).

#### Schema — `TableTransfer` actualizado

```prisma
model TableTransfer {
  // ...campos existentes...
  authorizedByWaiterId String?  // capitán Waiter (era authorizedById — renombrado)
  authorizedByWaiter   Waiter?  @relation("TransferAuthorizedByWaiter", ...)
  authorizedByUserId   String?  // gerente User (nuevo)
  authorizedByUser     User?    @relation("TransferAuthorizedByUser", ...)
  authorizedNote       String?  // "Capitán: Nombre" o "Gerente: Nombre"
}
```

Migración: `20260417050000_dual_auth_table_transfer`
- DROP CONSTRAINT fk antiguo (`authorizedById`) → RENAME a `authorizedByWaiterId`
- DROP NOT NULL · ADD `authorizedByUserId` TEXT · ADD `authorizedNote` TEXT
- Restaura FKs con `ON DELETE SET NULL` · ADD INDEX en `authorizedByUserId`

#### Helper `resolveAuthPin` — `waiter.actions.ts`

```typescript
type AuthResult =
    | { type: 'CAPTAIN'; name: string; waiterId: string }
    | { type: 'MANAGER'; name: string; userId: string };

async function resolveAuthPin(pin: string, branchId: string): Promise<AuthResult | null>
```

Prioridad 1: busca Waiters `isCaptain=true, isActive=true, pin≠null` en el branchId.
Prioridad 2: busca Users con role `OWNER/ADMIN_MANAGER/OPS_MANAGER`, `isActive=true, pin≠null` (cualquier sucursal).

#### `transferTableAction` actualizado

Ahora guarda `authorizedByWaiterId` O `authorizedByUserId` según el tipo de auth, y `authorizedNote = "Capitán: Nombre"` / `"Gerente: Nombre"` para auditoría.

#### `canUseCaptainFeatures` en POS Mesero

```typescript
const MANAGER_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];
const canUseCaptainFeatures = activeWaiter?.isCaptain || MANAGER_ROLES.includes(currentUser?.role ?? '');
```

Reemplaza `activeWaiter?.isCaptain` en los dos condicionales del render (subcuentas + modal de transferencia). Los gerentes que usan el POS Mesero ahora ven los mismos controles que un capitán.

---

### 18.29 Fix: bucle infinito de carga en POS Restaurante y POS Mesero (2026-04-18)

#### Causa raíz

`SubAccountPanel.loadTab()` → llama `onTabUpdated()` → llama `loadData()` → `setIsLoading(true)` → condicional `if (isLoading) return <Spinner>` **desmonta** `SubAccountPanel` → al terminar la carga se **remonta** → `useEffect([loadTab])` se dispara → bucle infinito.

#### Fix

```typescript
// ANTES
const loadData = async () => {
    setIsLoading(true);
    ...
    finally { setIsLoading(false); }
};
onTabUpdated={() => loadData()}

// DESPUÉS
const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    ...
    finally { if (showSpinner) setIsLoading(false); }
};
onTabUpdated={() => loadData(false)}   // refresh silencioso — no toca isLoading
```

Aplicado a: `restaurante/page.tsx` y `mesero/page.tsx`.

También se corrigió el botón de retry que usaba `onClick={loadData}` — TypeScript rechazaba el `MouseEvent` como argumento de `showSpinner`. Cambiado a `onClick={() => loadData()}` en 3 lugares.

---

### 18.30 Menú jerárquico en POS Mesero (2026-04-18)

El POS Mesero tenía grilla plana de productos. Se replicó el sistema de navegación jerárquico del POS Restaurante.

#### Nuevos campos de estado

```typescript
const [selectedSubcategory, setSelectedSubcategory] = useState("");
const [selectedGroup, setSelectedGroup] = useState("");
```

#### Extensión de interface `MenuItem`

```typescript
interface MenuItem {
  // ...campos existentes...
  posGroup?: string | null;
  posSubcategory?: string | null;
}
```

#### Memos derivados

```typescript
// Items dentro de la subcategoría seleccionada (o todos si no hay filtro)
const subcatFilteredItems = useMemo(() => {
    if (!selectedSubcategory) return menuItems;
    return menuItems.filter((i) => i.posSubcategory === selectedSubcategory);
}, [menuItems, selectedSubcategory]);

// Chips de subcategoría únicos del catálogo de la categoría activa
const subcategories = useMemo(() => {
    return Array.from(new Set(menuItems.map((i) => i.posSubcategory).filter(Boolean)));
}, [menuItems]);

// Tiles de grupo únicos dentro de subcatFilteredItems
const groupsInView = useMemo(() => {
    return Array.from(new Set(subcatFilteredItems.map((i) => i.posGroup).filter(Boolean)));
}, [subcatFilteredItems]);
```

#### Lógica de renderizado (3 capas)

1. **Chips de subcategoría** — barra horizontal scrolleable. Al seleccionar, resetea `selectedGroup`.
2. **Tiles de grupo** (`posGroup ≠ null`) — `groupsInView.map(group => ...)` con min-max precio y count. Al tocar → `setSelectedGroup(group)`.
3. **Botón "← Volver"** — visible cuando `selectedGroup` activo; muestra ítems del grupo (variantes de tamaño).
4. **Items sueltos** — `subcatFilteredItems.filter(i => !i.posGroup)` — rendered como grilla directa.
5. **Búsqueda** — `productSearch` activa busca en todos los items del menú (`allMenuItems`).

Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 tablet-land:grid-cols-4 xl:grid-cols-4`. Tema emerald-500.

El `useEffect([selectedCategory])` resetea `selectedSubcategory` y `selectedGroup` al cambiar categoría.

---

### 18.31 Restricción de módulos para mesonero@shanklish.com (2026-04-18)

Migración `20260417060000_restrict_mesonero_to_pos_waiter`:

```sql
UPDATE "User"
SET "allowedModules" = '["pos_waiter"]', "updatedAt" = NOW()
WHERE "email" = 'mesonero@shanklish.com';
```

**Por qué no bastaba solo con esto**: ver sección 18.24 — la lógica de `getVisibleModules` y la redirección del dashboard también debían ser corregidas para que `allowedModules` tuviera efecto real.

**Script de diagnóstico**: `scripts/fix-mesonero-modules.ts` — verifica y aplica el fix desde la máquina local con `DATABASE_URL` cargado. También reporta `posGroup` de todos los items Shakifel.

---

### 18.32 Fix: posGroup de variantes Shakifel Mixto (2026-04-18)

#### Diagnóstico

El filtro de categoría en el POS Mesero usa `categoryId` (via `categories.find(c => c.id === selectedCategory)`), no el nombre de la categoría. Los items `SHAWARMA SHAKIFEL MIXTO 350G` y `500G` estaban en la categoría correcta (Shawarmas) pero con `posGroup = NULL`, causando que se renderizaran como ítems sueltos en lugar de agruparse bajo un tile "Shakifel Mixto".

#### Fix

Migración `20260417070000_normalize_shakifel_mixto_posgroup`:

```sql
UPDATE "MenuItem"
SET
    "posGroup"       = 'Shakifel Mixto',
    "posSubcategory" = COALESCE("posSubcategory", 'Shawarmas')
WHERE
    LOWER("name") LIKE '%shakifel%mixto%'
    AND "isActive" = true;
```

Idempotente. Aplica a todas las variantes de gramaje (250G, 350G, 500G) para que queden bajo un único tile colapsado en el menú.

---

### 18.33 Fix: redondeo incorrecto en pagos con Efectivo Bs (2026-04-18)

#### Bug

La función `roundToWhole` en `restaurante/page.tsx` incluía `CASH_BS` junto con `CASH_USD` y `ZELLE`:

```typescript
// BUGGY — redondeaba $31.50 → $32 para Bs también
const roundToWhole = (amount: number, method: string): number =>
    (method === 'CASH_USD' || method === 'ZELLE' || method === 'CASH_BS') ? Math.round(amount) : amount;
```

Efecto: el total $31.50 se redondeaba a $32 en USD, y el equivalente en Bs se calculaba sobre $32 (15.368 Bs en lugar de los correctos 15.128 Bs). El botón COBRAR también mostraba `$32.00` en lugar de `$31.50`.

#### Fix — dos cambios en `restaurante/page.tsx`

```typescript
// 1. Quitar CASH_BS del redondeo — solo USD y Zelle se redondean a entero
const roundToWhole = (amount: number, method: string): number =>
    (method === 'CASH_USD' || method === 'ZELLE') ? Math.round(amount) : amount;

// 2. Placeholder Bs en modo mesa — mostrar con 2 decimales (no 0)
// ANTES: `Bs ${(paymentAmountToCharge * exchangeRate).toFixed(0)}`
// DESPUÉS:
`Bs ${(paymentAmountToCharge * exchangeRate).toFixed(2)}`
```

**Regla de negocio**: Solo CASH_USD y ZELLE se redondean a dólar entero (quien paga con billete no da centavos). Bolívares (efectivo, PDV, móvil) deben cobrarse con la cifra exacta.

---

### Migraciones recientes (2026-04-18)

| Migración | Contenido |
|-----------|-----------|
| `20260417050000_dual_auth_table_transfer` | Renombra `authorizedById` → `authorizedByWaiterId`, agrega `authorizedByUserId` + `authorizedNote`, FKs SET NULL |
| `20260417060000_restrict_mesonero_to_pos_waiter` | UPDATE allowedModules para mesonero@shanklish.com |
| `20260417070000_normalize_shakifel_mixto_posgroup` | UPDATE posGroup = 'Shakifel Mixto' para variantes Shakifel Mixto |

---

### 18.34 Auto-polling de layout POS cada 5s (2026-04-18)

#### Problema

Cuando dos dispositivos estaban en el mismo módulo POS (cajera + mesonero, o dos cajeras), los cambios que uno hacía no aparecían en el otro hasta refrescar manualmente (F5). El `router.refresh()` no sirve aquí porque las páginas POS son **Client Components** — no hay Server Components que re-fetchear.

#### Solución — polling silencioso con `pollLayout`

Patrón aplicado en `restaurante/page.tsx` y `mesero/page.tsx`:

```typescript
const isProcessingRef = useRef(isProcessing);
useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

const pollLayout = useCallback(async () => {
    const [layoutResult, rate] = await Promise.all([
        getRestaurantLayoutAction(),
        getExchangeRateValue(),
    ]);
    if (layoutResult.success && layoutResult.data) {
        setLayout(layoutResult.data as SportBarLayout);
    }
    if (rate) setExchangeRate(rate);
}, []);

useEffect(() => {
    const POLL_MS = 5_000;
    const id = setInterval(() => {
        if (!document.hidden && !isProcessingRef.current) pollLayout();
    }, POLL_MS);
    return () => clearInterval(id);
}, [pollLayout]);
```

#### Guardas clave

| Guard | Por qué |
|-------|---------|
| `document.hidden` | Pausa el polling cuando la pestaña no está visible (ahorro de BD y red) |
| `isProcessingRef.current` | Evita pisar trabajo del usuario (agregando ítem, procesando cobro, etc.) |
| `useCallback([])` | El `pollLayout` no depende de props/state mutables — el efecto no se recrea en cada render |
| `useRef` para `isProcessing` | Leer el valor actual dentro del interval sin forzar re-creación del mismo |

#### Por qué `pollLayout` y no `loadData`

- `loadData()` toca muchos estados (productos, categorías, etc.) → re-renders agresivos
- `pollLayout()` solo actualiza `layout` y `exchangeRate` → re-render mínimo
- El menú de productos no cambia con frecuencia — no vale re-fetchearlo cada 5s

Intervalo final elegido: **5 segundos** tras pruebas de UX (inicialmente 15s, se redujo a 5s).

---

### 18.35 Extensión regla de redondeo — CASH_EUR incluido + backend alineado (2026-04-18)

Complemento de la sección 18.33. Dos fixes adicionales al `roundToWhole`:

#### 1. CASH_EUR debe redondearse (antes no estaba incluido)

Regla de negocio completa:

> **DIVISAS efectivo** (`CASH_USD`, `CASH_EUR`, `ZELLE`): aplicar 33% descuento → `Math.round()` al resultado final.
>
> **BOLÍVARES** (`CASH_BS`, `PDV_SHANKLISH`, `PDV_SUPERFERRO`, `MOVIL_NG`): sin redondeo. El monto USD exacto × tasa BCV = Bs exactos.

#### 2. Backend `pos.actions.ts` no estaba alineado

`src/app/actions/pos.actions.ts::roundToWhole` tenía CASH_BS y le faltaba CASH_EUR — misma ley que el frontend. Corregido:

```typescript
/**
 * Regla de negocio — redondeo por método de pago:
 *  DIVISAS efectivo (CASH_USD, CASH_EUR, ZELLE):
 *    Aplicar 33% de descuento → Math.round() al resultado FINAL.
 *  BOLÍVARES (CASH_BS, PDV_SHANKLISH, PDV_SUPERFERRO, MOVIL_NG):
 *    SIN redondeo. El monto USD exacto × tasa BCV = Bs exactos.
 */
function roundToWhole(amount: number, paymentMethod?: string): number {
    if (paymentMethod === 'CASH_USD' || paymentMethod === 'CASH_EUR' || paymentMethod === 'ZELLE') {
        return Math.round(amount);
    }
    return amount;
}
```

Aplicado en frontend (`restaurante/page.tsx`) y backend (`pos.actions.ts`) — misma docstring para que nadie vuelva a introducir la regresión.

---

### 18.36 Sistema de permisos granular de 4 capas (2026-04-18)

Reemplazo incremental del sistema previo (solo `role` + `allowedModules`). Mantiene retrocompatibilidad total: con `grantedPerms=null` y `revokedPerms=null`, el comportamiento es idéntico al sistema viejo.

#### Las 4 capas — orden de evaluación

```
┌─────────────────────────────────────────────────────────────┐
│  CAPA 4: revokedPerms  ← excepciones que RESTRINGEN (win)   │
│  CAPA 3: grantedPerms  ← excepciones que AMPLÍAN (bypass 2) │
│  CAPA 2: allowedModules ← gating por módulo (si definido)   │
│  CAPA 1: ROLE_BASE_PERMS[role] ← defaults por rol           │
└─────────────────────────────────────────────────────────────┘
```

**Reglas de resolución:**

1. Si el permiso está en `revokedPerms` → **DENY** (Capa 4 gana siempre, incluso sobre OWNER)
2. Si el permiso está en `grantedPerms` → **ALLOW** (Capa 3 bypassea Capa 1 y Capa 2)
3. Si el rol base no tiene el permiso → **DENY**
4. Si `allowedModules` está definido y ningún módulo del perm está en él → **DENY**
5. En caso contrario → **ALLOW**

#### Catálogo de permisos (`permissions-registry.ts`)

17 permisos agrupados en 4 categorías:

| Grupo | Permisos |
|-------|----------|
| 💳 POS / Ventas | VOID_ORDER, APPLY_DISCOUNT, APPROVE_DISCOUNT, VIEW_ALL_ORDERS, REPRINT_COMANDA |
| 📦 Inventario | ADJUST_STOCK, APPROVE_TRANSFER, CLOSE_DAILY_INV |
| 💰 Financiero | EXPORT_SALES, VIEW_COSTS, OPEN_CASH_REGISTER, CLOSE_CASH_REGISTER, VIEW_FINANCES |
| 🔐 Admin | MANAGE_USERS, MANAGE_PINS, CONFIGURE_SYSTEM, MANAGE_BROADCAST |

Cada PERM se mapea a uno o más módulos vía `PERM_TO_MODULES`. Ejemplo: `VOID_ORDER → [pos_restaurant, pos_waiter, pos_delivery, pedidosya, sales_history]`.

#### Archivos creados (`src/lib/permissions/`)

| Archivo | Responsabilidad |
|---------|-----------------|
| `has-permission.ts` | Core engine — `hasPermission(permUser, permission)`, `visibleModules(user)`, `serializePerms(perms)`. Isomorfo (server + client). |
| `perm-to-modules.ts` | Mapeo `PermKey → string[]` de módulos donde el perm aplica. |
| `action-guard.ts` | `checkActionPermission(PERM)` — para Server Actions. Devuelve `{ ok, user/message }`. |
| `api-guard.ts` | `requirePermission(PERM)` — para API routes. Devuelve `{ ok, status, message }`. |
| `index.ts` | Barrel exports (excluye api-guard para no traer Next internals a contextos client). |

#### Session enrichment — JWT con permisos

`SessionPayload` extendido en `src/lib/auth.ts`:

```typescript
export interface SessionPayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    activeCashierId?: string;
    allowedModules?: string | null;   // ← nuevo (espejo de BD)
    grantedPerms?: string | null;     // ← nuevo
    revokedPerms?: string | null;     // ← nuevo
}
```

`loginAction` ahora carga `allowedModules`/`grantedPerms`/`revokedPerms` desde BD y los inyecta al JWT. Los guards server-side releen `allowedModules` de BD por cada request (para evitar JWTs stale tras cambios del admin), pero `grantedPerms`/`revokedPerms` se toman del JWT (cambios requieren re-login).

#### DashboardLayout usa `visibleModules()`

En lugar de parsear `dbUser.allowedModules` directamente, llama `visibleModules(permUser)` que devuelve `allowedModules ∪ módulos derivados de grantedPerms`. Así cuando el admin concede `VIEW_ALL_ORDERS` a una cajera cuyo `allowedModules=["pos_waiter"]`, la cajera ve también `sales_history` en el sidebar sin tocar `allowedModules`.

**Fallback defensivo:** si `session.allowedModules === undefined` (JWT emitido antes de la session enrichment), el layout consulta BD una vez. Así ningún usuario ve de más hasta que re-loguee.

#### Hook client `usePermission` (UX only)

```typescript
import { usePermission } from '@/hooks/use-permission';
const canVoid = usePermission(PERM.VOID_ORDER);
<button disabled={!canVoid}>Anular</button>
```

También `useAnyPermission([perms])` y `useAllPermissions([perms])`.

⚠️ **Solo para UX.** La seguridad real vive en `checkActionPermission`. Cliente malicioso puede bypassear el hook.

El store `useAuthStore` se extendió con `permissions: AuthPermissions | null` y action `setPermissions()`. El `Sidebar` sincroniza desde `session` → store en el mismo `useEffect` que sincroniza `user`.

#### Migración de Server Actions existentes

Reemplazamos el patrón legacy `hasPermission(session.role, PERMISSIONS.X)` por `checkActionPermission(PERM.X)` en 10 actions:

| Archivo | Acciones migradas | PERM |
|---------|-------------------|------|
| `user.actions.ts` | `getUsers`, `updateUserRole`, `toggleUserStatus`, `updateUserModules`, `updateUserPerms`, `createUserAction`, `updateUserNameAction`, `adminResetPasswordAction` | `MANAGE_USERS` |
| `user.actions.ts` | `updateUserPin` | `MANAGE_PINS` (más restrictivo) |
| `inventory-daily.actions.ts` | `closeDailyInventoryAction` | `CLOSE_DAILY_INV` |
| `sales.actions.ts` | `getSalesHistoryAction`, `getSalesForArqueoAction` | `EXPORT_SALES` |
| `sales.actions.ts` | `voidSalesOrderAction` | `VOID_ORDER` |
| `finance.actions.ts` | `getFinancialSummaryAction`, `getMonthlyTrendAction`, `getDailySalesAction` | `VIEW_FINANCES` |

**No tocados** (por diseño):
- `pos.actions.ts` — usa PIN-gating (manager PIN). Patrón distinto; requiere diseño aparte.
- `reopenDailyInventoryAction` — raro, hardcoded OWNER/AUDITOR preservado explícitamente.
- `changePasswordAction` — el usuario cambia su propia contraseña, no requiere perm admin.

#### Admin UI — ya existente en `/dashboard/usuarios`

El panel `/dashboard/usuarios` ya incluía:
- Checkboxes de módulos (bulk update `allowedModules`)
- Sección "PERMISOS GRANULARES" con tri-state por PERM: default (rol) / granted / revoked
- Badges "del rol" / "revocado" / "personalizado"
- Reset password, cambiar PIN, activar/desactivar

La action `updateUserPerms(userId, granted[], revoked[])` escribe JSON serializado via `serializePerms()` (dedup + sort + null si vacío).

#### Tests — vitest con 27 smoke tests

`src/lib/permissions/has-permission.test.ts`:

- Capa 1: OWNER full access, CASHIER subset, rol desconocido = ∅
- Capa 2: null = sin restricción, subset filtra, JSON malformado tolerado, empty array bloquea no-globales
- Capa 3: bypass de rol base Y de allowedModules (sales_history para mesonero con solo `pos_waiter`)
- Capa 4: vence a Capa 1/2/3 — revoca incluso OWNER
- `hasAnyPermission` / `hasAllPermissions` edge cases
- `visibleModules`: null passthrough, unión con grantedPerms, dedup
- `serializePerms`: empty→null, dedup, sort estable

**Comandos:**

```bash
npm test          # corre todos (1 vez)
npm run test:watch
```

Vitest 4.1.4, config mínima en `vitest.config.ts` (alias `@/` → `./src`, env node).

**Estado:** ✅ 27/27 tests pasan en ~1s. Sin CI wiring todavía.

---

### 18.37 Fix: select "Dueño (Full Access)" fantasma en Roles y Permisos (2026-04-18)

#### Bug visual

Muchos usuarios (cajeras, mesoneros) aparecían en `/dashboard/config/roles` con el rol "Dueño (Full Access)" aunque en BD tenían rol `CASHIER`. El script de diagnóstico contra RDS confirmó que la BD estaba correcta — era bug de render.

#### Causa raíz

```typescript
// src/app/dashboard/config/roles/roles-view.tsx
const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
    { value: 'OWNER', label: 'Dueño (Full Access)' },
    { value: 'AUDITOR', label: 'Auditor' },
    { value: 'ADMIN_MANAGER', label: 'Gerente Adm.' },
    { value: 'OPS_MANAGER', label: 'Gerente Ops.' },
    { value: 'HR_MANAGER', label: 'RRHH' },
    { value: 'CHEF', label: 'Chef Ejecutivo' },
    { value: 'AREA_LEAD', label: 'Jefe de Área' },
    // ← FALTABAN: CASHIER, KITCHEN_CHEF, WAITER
];
```

Cuando `<select value="CASHIER">` no encuentra `<option value="CASHIER">`, HTML muestra el **primer** option por defecto — en este caso "Dueño (Full Access)". El `value` controlado en React no dispara `onChange` hasta que el usuario interactúa, pero el texto visible es el equivocado.

#### Fix

Agregar las 3 opciones faltantes:

```typescript
    { value: 'AREA_LEAD', label: 'Jefe de Área' },
    { value: 'CASHIER', label: 'Cajera' },
    { value: 'KITCHEN_CHEF', label: 'Jefe de Cocina' },
    { value: 'WAITER', label: 'Mesero' },
];
```

**Lección:** los selects en data-driven UIs necesitan opciones para **todos** los valores posibles de la tabla. Este bug estuvo latente hasta que se creó el primer usuario CASHIER/mesonero.

---

## 19. Consolidación Cápsula (2026-04-19)

Trabajo de unificación del branch `capsula/consolidation` para reconciliar dos repositorios divergentes en una única base productiva. Arranque diagnóstico: 2026-04-13. Estado al cierre de este registro: Fase 2 al 85% (sub-fases 2.A, 2.B, 2.C.1, 2.C.2, 2.C.3.a, 2.C.3.b y 2.F cerradas; 2.D y 2.E pendientes).

### 19.1 Contexto

El sistema vive desde el inicio del proyecto en dos repositorios con solapamiento funcional pero divergencia creciente: `shanklish-erp-main` (la base productiva actual de Shanklish Caracas, desplegada en AWS RDS) y `capsula-erp` (el fork hecho más tarde para desarrollar el branding y la visión SaaS "Cápsula"). Ambos compartían aproximadamente el 80% del código pero habían derivado en direcciones opuestas: shanklish concentró la evolución técnica (schema Prisma completo al nivel de 46 modelos, sistema de permisos 4-capa, suite de tests vitest, lógica POS madura con subcuentas y propinas colectivas), mientras capsula acumuló el trabajo visual (paleta Coral Energy `#FF6B4A / #1B2D45`, tipografía Nunito, `CapsulaLogo` en tres variantes, landing premium, login premium, sidebar colapsable).

La estrategia adoptada invierte la intuición inicial: en lugar de traer la lógica de shanklish a capsula, se toma shanklish como base técnica y se porta la presentación de capsula sobre ella. Razón: el código crítico de negocio (permisos, actions, schema) es irremplazable y riesgoso de mover; el branding es JSX y CSS, portable sin tocar la lógica. El branch de trabajo es `capsula/consolidation` dentro de `shanklish-erp-main`. El diagnóstico formal de divergencia entre los dos repos vive en `C:\Users\Usuario\capsula-migration\DIVERGENCE_REPORT.md` (workspace root, fuera del repo).

### 19.2 Modelo de portación — regla maestra y líneas rojas

**Regla maestra**: la presentación se trae de `capsula-erp`, la lógica se preserva de `shanklish-erp-main`.

Las definiciones operativas son precisas porque el modelo vive o muere por cómo se clasifica cada import:

- **Presentación** = JSX estructural, `className`, tokens de diseño, colores, tipografía, assets estáticos, copy secundario (labels de UI, títulos, placeholders puramente visuales).
- **Lógica** = hooks de sesión (`useAuthStore`, `getSession`), redirects (`redirect()`, `router.push`), guards RBAC, `useEffect` de bootstrap, stores Zustand, server actions, middleware, el módulo completo de permisos.

**Excepción calibrada**: cuando shanklish tiene copy operativo más concreto que capsula (caso paradigmático: la guía de `HelpPanel` en `/dashboard/ventas/cargar` dice `"PedidosYA"` en shanklish y `"Canales Externos"` en capsula), gana shanklish. Esta asimetría se mantiene hasta Fase 3, que introducirá i18n o config por tenant y moverá el copy operativo a parámetro. Antes de esa fase, el genérico de capsula es una regresión porque oculta información que el cajero necesita ver tal cual.

**Líneas rojas operativas** — paths que no se tocan durante toda la Fase 2:

- `prisma/` — cualquier cambio de schema pasa por migración auditada, no por consolidación.
- `.env*` — secrets fuera del flujo de branch.
- `src/lib/permissions/` — el sistema 4-capa es el núcleo de seguridad.
- `src/lib/auth.ts` — JWT custom, no se toca.
- `src/middleware.ts` — RBAC edge, no se toca.
- `src/stores/auth.store.ts` — store de sesión cliente, no se toca.
- `src/app/actions/*.actions.ts` — toda la lógica de negocio server-side.
- `package.json`, `package-lock.json` — cambios de dependencias en commits dedicados, nunca como efecto colateral.

**Protocolo de commit**. Cada sub-fase tiene un prompt `.md` en `C:\Users\Usuario\capsula-migration\prompts\`. Antes de commitear se audita `git diff --stat` y `git status`, se verifica que ningún path protegido aparezca, se usa `git add` con archivos enumerados explícitamente (nunca `git add .`), y el mensaje sigue convención semántica (`feat(layout):`, `ci:`, `docs(OPUS):`). Si cualquier archivo fuera del scope aprobado aparece en el diff, el commit se aborta.

### 19.3 Fase 1 — Migraciones Prisma (resolución de landmine)

La consolidación arrancó golpeando una mina enterrada en la base de datos del servidor Contabo: 14 migraciones aplicadas por DDL directo pero solo 2 registradas en `_prisma_migrations`. Esto significa que la DB tenía las tablas, columnas e índices correctos al nivel estructural, pero Prisma no lo sabía — cualquier `prisma migrate deploy` intentaría reaplicar migraciones ya aplicadas y fallaría. Landmine secundario: la migración `20260308000000_add_order_name_to_purchase_order` estaba marcada como `failed` en `_prisma_migrations`, bloqueando la cadena entera.

La resolución no se ejecutó desde Windows sino directamente en el host Contabo, para evitar roundtrips de red y porque la propia herramienta `prisma migrate resolve` necesita conectarse a la DB destino. Pasos efectivos: se creó un proyecto Prisma temporal en `/root/capsula-migrate` con el schema `shanklish`, se ejecutaron 14 invocaciones de `prisma migrate resolve --applied <migration-name>` para registrar las migraciones aplicadas por DDL, luego `prisma migrate resolve --rolled-back` seguido de `--applied` sobre la landmine `add_order_name_to_purchase_order` para limpiar el estado `failed`, y finalmente un `prisma migrate deploy` que aplicó limpio las 10 migraciones nuevas de shanklish que Contabo aún no tenía.

Estado final: 26/26 migraciones registradas en `_prisma_migrations`, DB de Contabo sincronizada con el schema de `shanklish-erp-main`. Backups del estado pre-consolidación en `/var/backups/capsula/`, inmutables como seguro en caso de necesitar rollback durante Fase 4 o Fase 5.

Esta fase fue condición previa para que Fase 2 pudiera avanzar: sin una base Prisma coherente, ninguna portación posterior hubiera podido desplegarse. Queda aún un problema estructural relacionado (ver §19.12: la falta de migración `0000_init` hace que cualquier DB vacía falle al intentar `migrate deploy` desde cero).

### 19.4 Fase 2.A — Branding Coral Energy (commit `eec5e92`)

Portación del sistema de diseño completo de `capsula-erp`, preservando `shanklish.*` como namespace secundario para retrocompatibilidad.

Tokens Coral Energy que rigen la paleta por default:

- `#FF6B4A` — coral primario (CTAs, acentos, badges).
- `#E85A3A` — coral hover/press (gradientes).
- `#1B2D45` — navy (títulos, contraste oscuro).
- `#FFF8F5` — crema fondo (landing, hero backgrounds).
- `#F0F2F5` — gris neutro (transiciones de gradiente).

Tipografía principal: **Nunito** (700/800/900 para titulares), `system-ui` como fallback.

Archivos nuevos:

- `src/config/branding.ts` — exporta la config tipada con colores, typography, layout metrics.
- `src/config/social-brand.ts` — social handles y OG defaults para metadata.
- `src/hooks/useBranding.ts` — hook cliente que en Fase 3 permitirá overrides por tenant.
- `src/components/ui/CapsulaLogo.tsx` — componente con tres variantes (`full` con wordmark, `icon` solo isotipo, `favicon` para usos pequeños).
- `public/brand/logo-full-color.svg`, `logo-full-white.svg`, `logo-icon-color.svg` — assets estáticos.

Archivos mergeados (no reescritos — merge dirigido):

- `tailwind.config.ts` — se añaden los namespaces `capsula.*` y `tablepong.*` preservando `shanklish.*` preexistente. Ninguna clase `shanklish-*` en código existente se rompe.
- `src/app/globals.css` — paleta Coral Energy como CSS custom properties default; variables de dark mode ajustadas; keyframes `shimmer` y `fade-in zoom-in-95` añadidos para uso en login y modales.
- `src/app/layout.tsx` (raíz) — import de Nunito vía `next/font/google`, metadata actualizada (`title: "CÁPSULA — ERP para Restaurantes"`, `description`, `applicationName`, OG tags).

Decisión de diseño fijada aquí: **Coral Energy es el tema por default del monorepo post-consolidación**. La configuración por tenant (cuando Shanklish Caracas quiera mantener un tema propio, por ejemplo) se aplicará vía `useBranding` en Fase 3, leyendo un campo `theme` de la tabla `Tenant` (aún no creada).

### 19.5 Fase 2.B — Widgets de Dashboard (commit `b310466`)

Cuatro componentes nuevos para el dashboard ejecutivo, alineados a los mocks de capsula pero cableados a los queries de shanklish.

Nuevos:

- `src/components/dashboard/KpiCard.tsx` — card con valor principal, variación porcentual, sparkline inline, iconografía por categoría.
- `src/components/dashboard/SparklineChart.tsx` — gráfica minimalista sin ejes.
- `src/components/dashboard/FinancialSummaryWidget.tsx` — bloque agregado de revenue/costos/margen del período seleccionado.
- `src/components/dashboard/ExecutiveSummary.tsx` — orquestador de KPIs del día (revenue, órdenes, ticket promedio, top producto).
- `src/app/dashboard/loading.tsx` — skeleton premium con shimmer Coral Energy.

Mergeado:

- `src/app/dashboard/page.tsx` — integra `ExecutiveSummary` y `FinancialSummaryWidget` en la vista principal. Queries, `getSession()`, filtros de permisos por rol y llamadas a `getDashboardStatsAction` permanecen intactos. La integración es puramente de composición JSX.

**Pendiente documentado**: `KpiCard` está diseñado para exponer `previousValue` y delta (variación vs. período anterior), pero `getDashboardStatsAction` hoy no devuelve ese breakdown. El componente está en el árbol pero no renderiza variación hasta que se extienda la action. Queda como trabajo para Fase 2.D o 2.E según cuándo se priorice.

### 19.6 Fase 2.C.1 — Login premium (commit `591d323`)

Reescritura presentacional de `/login` sin tocar el flujo de autenticación.

`src/app/login/page.tsx` — server component. Fondo con gradient coral → navy, overlay de noise/glow, `CapsulaLogo` centrado, card translúcida con `backdrop-blur`. Llamadas a `getSession()` y lógica de redirect a `/dashboard` si ya hay sesión activa preservadas byte a byte: son la primera línea de defensa contra rehash de cookies.

`src/app/login/login-form-client.tsx` — client component. Botón primario con gradient coral y efecto `shimmer` (keyframe definido en `globals.css`), inputs `rounded-xl` con foco coral, `onFocus`/`onBlur` locales para estados visuales. `loginAction`, integración con `useAuthStore`, `router.push` post-login y manejo de errores preservados intactos. Nada de la cadena `action → store → redirect` fue tocado.

### 19.7 Fase 2.C.2 — Sidebar colapsable (commits `1e0cdb6` + `3798142`)

Portación del árbol de navegación colapsable de capsula preservando las 4 capas de permisos de shanklish. Es la sub-fase más delicada de la consolidación hasta ahora: `src/components/layout/Sidebar.tsx` pasó de 253 a 683 líneas porque el componente de capsula tiene estructura visual más rica (grupos expandibles, iconos por sección, active-state) pero se enchufa al sistema de permisos completo de shanklish.

Cinco decisiones aplicadas durante el merge:

- **D1** — El `useEffect` de sync con sesión llama `login()` y luego `setPermissions({ allowedModules, grantedPerms, revokedPerms })` exactamente como en shanklish. Intocado. Es el puente entre JWT y store cliente; romperlo desconecta la UI de los permisos reales.
- **D2** — Grouping **híbrido**: la constante `SIDEBAR_TREE` define el árbol visual jerárquico de capsula, pero se añade una red de seguridad "Otros" con un `orphanSection` calculado vía `useMemo` que detecta módulos presentes en el `MODULES_REGISTRY` de shanklish pero no listados en el tree. Así ningún módulo queda invisible por olvido editorial.
- **D3** — Se añaden explícitamente al tree: `asistente`, `modulos_usuario`, `module_config`. Se corrige el typo `modulos` heredado de capsula.
- **D4** — Finanzas como sección top-level independiente del `registry.section`. Decisión de UX: los módulos financieros viven en su propio header, no bajo Administración.
- **D5** — `CapsulaNavbarLogo` sin fallback al emoji placeholder que capsula usaba durante desarrollo. El logo real es el que renderiza.

Fix técnico aplicado durante el port: `Array.from(visibleMap.keys())` en lugar de spread directo sobre el `MapIterator`, para evitar `TS2802: Type 'MapIterator<string>' can only be iterated through...` en el target del `tsconfig`.

Infraestructura establecida colateralmente: se fijó `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` en Windows (necesario para que los scripts de npm corran desde PowerShell), se ejecutó un `npm install` completo (769 packages, `package-lock.json` normalizado en `1e0cdb6`), y se consolidó el pipeline local de validación: `npx tsc --noEmit` + `npm run test` (vitest con 27/27 smoke tests del engine de permisos). Esta tupla es el gate obligatorio antes de cada commit de Fase 2.

### 19.8 Fase 2.C.3.a — HelpPanel + root page (commit `089dee5`)

**`src/components/layout/HelpPanel.tsx`**: no-op efectivo. Diff byte a byte con `diff -u` contra la versión de capsula reveló que los dos archivos son idénticos excepto por 2 strings en la guía de `/dashboard/ventas/cargar`: shanklish dice `"PedidosYA"` (tanto en `description` como en `tips`), capsula dice `"Canales Externos"`. Por la excepción definida en §19.2, se preserva `"PedidosYA"`. Portar la versión de capsula y revertir esos 2 strings daría un archivo byte-idéntico al existente, así que no se escribe. Cero cambios al archivo.

**`src/app/page.tsx`**: landing pública. Sistema visual **Editorial Aurora** (dark cinematográfico) sobre la arquitectura de información CRO. Estilos en `src/app/aurora-landing.css` (scoped con clase `.cap-backdrop`, no contamina el resto de la app). Excepción consciente al sistema `capsula-*` global: la landing usa una paleta dark dedicada (`--cap-*`) por ser superficie pública con identidad propia.

Secciones:
- **Nav** (`.cap-nav`): backdrop-blur sobre `rgba(10,17,30,0.55)`. Solo `CapsulaLogo variant="full"` + "Iniciar sesión" + CTA "Solicitar demo" (ghost azul con shadow azul suave). Sin ítems de menú.
- **Hero**: aurora warm-orange + cool-blue + grain SVG + dos `.cap-blob` decorativos (warm/cool, blur 120px). Centro: `CapsulaAnimatedMark size={96}` envuelto en `.cap-mark-halo` (pseudo-elemento radial cálido — **no toca el SVG**). Eyebrow pill naranja con dot pulsante (`capPulse 2.4s`). H1 con gradient italic blanco→naranja en "una cápsula." (Inter Tight inherit). Subtítulo en `--cap-blue`. CTAs: `cap-btn--primary` (gradient azul `#3B5BDB → #6E94EE` con shadow azul) + `cap-btn--ghost` (translúcido con backdrop-blur).
- **Producto**: dotgrid masked + radial naranja sutil al tope. Eyebrow "PRODUCTO". H2 "Cuatro módulos. Una sola operación." (segunda línea italic semibold). Grid `md:grid-cols-2 lg:grid-cols-4` con 4 `.cap-card` (Inventario `Box`, Recetas `BookOpen`, Costos `Coins`, Analítica `BarChart3`). Cada card: backdrop-blur 12px, hairline accent superior naranja, hover lift `-2px`. Iconos lucide coloreados con `var(--cap-accent)` dentro de `.cap-icon` (tile cuadrado naranja translúcido).
- **CTA panel** (`.cap-cta-panel`): radial-gradients de esquinas (warm top-left, cool bottom-right) + linear navy + corner glow blobs. H2 + subtítulo blue + dos CTAs (primary + ghost).
- **Footer**: 4 columnas (Logo + Producto + Empresa + Recursos), links en `--cap-blue` opacity 0.9. Divider con fade. Fila inferior: © + Legal y Seguridad (Términos y condiciones · Privacidad · Seguridad).

Tokens nuevos en `aurora-landing.css`:
- **Color**: `--cap-bg #0A111E`, `--cap-bg-deep #070C16`, `--cap-ink #F4F1EA`, `--cap-accent #E8714A`, `--cap-blue #7AA7FF`, `--cap-hair`/`--cap-hair-bright` para hairlines.
- **Radius**: pill 999px, card 18px, cta 28px, icon 12px.
- **Sombras**: `--cap-shadow-glass`, `--cap-shadow-glass-hover`, `--cap-shadow-cta-blue`, `--cap-shadow-cta-blue-hover`, `--cap-shadow-cta-panel`.
- **Motion**: `--cap-ease cubic-bezier(.2,.8,.2,1)`, `--cap-dur 220ms`.

Reglas de preservación (críticas, no negociar):
- `CapsulaLogo` (nav y footer) **no se reemplaza** por la propuesta `cap-mark` con texto.
- `CapsulaAnimatedMark` (hero center) **no se mueve ni se reemplaza** por el bowl naranja proposed. Solo se le añade halo externo via pseudo-elemento.

Eliminadas permanentemente (CRO previo): logo strip "Operando hoy en …", sección "Impacto verificado" con métricas de clientes, quote/testimonial.

No hay lógica que preservar: la versión shanklish del root page era 100% presentacional (gradient amber/orange con emoji placeholder), sin `redirect()`, sin `getSession()`, sin guards. Es la única ruta completamente pública del sistema antes del login. Portación limpia.

### 19.8.1 Marketing route group `(marketing)` — shell público compartido

Tras la aplicación de Aurora se extrajo el shell público en un route group dedicado. Cualquier nueva página pública (Producto, Empresa, Recursos, Legal) hereda backdrop, nav y footer sin duplicar código.

```
src/app/(marketing)/
  aurora.css                  ← tokens --cap-* + utilidades cap-*, scope .cap-backdrop
  layout.tsx                  ← <div class="cap-backdrop"> + <AuroraNav> + {children} + <AuroraFooter>
  page.tsx                    ← landing /
  legal/{terminos,privacidad,seguridad}/page.tsx
  empresa/page.tsx            ← Sobre nosotros (historia + valores + equipo + CTA)
  contacto/page.tsx           ← 3 canales + 3 rutas por intención + ubicación/horarios
  producto/{inventario,recetas,costos,analitica}/page.tsx
  ayuda/page.tsx              ← 8 categorías de doc + canales de soporte
  estado/page.tsx             ← status global + 4 servicios + uptime 90 días + incidentes

src/components/marketing/
  AuroraNav.tsx               ← Logo + Iniciar sesión + CTA Solicitar demo
  AuroraFooter.tsx            ← 4 columnas + fila legal con links a /legal/*
  LegalShell.tsx              ← reusable: hero (eyebrow + título + last-updated + intro)
                                + body grid 260px_1fr (TOC sticky lateral + secciones numeradas)
  ProductoShell.tsx           ← reusable para los 4 módulos: hero (icono grande + eyebrow +
                                título + intro + CTAs) → sub-features (4 cards) → "por qué
                                importa" (paragraph block) → conexiones (auto-genera 3 cards
                                a los OTROS módulos vía slug) → CTA panel
```

**Reglas críticas del route group**:
- `(marketing)` es route group de Next.js: paréntesis no afectan la URL. `app/(marketing)/page.tsx` resuelve a `/`.
- El layout de marketing **NO** debe contener `<html>` ni `<body>` — esos viven en `app/layout.tsx` (root). Solo envuelve children con `.cap-backdrop`.
- `aurora.css` se importa **únicamente** en `(marketing)/layout.tsx`. Los `:root` que define son globales pero las clases `.cap-*` solo aplican dentro de `.cap-backdrop`. No contamina `/dashboard`, `/login` ni `/kitchen`.
- `/login`, `/dashboard`, `/kitchen` viven fuera del route group y mantienen su diseño propio (login premium coral, dashboard Minimal Navy capsula-*).

**Páginas Legal** (Fase 2 — placeholders):
- `LegalShell` recibe `eyebrow`, `title`, `lastUpdated`, `intro` opcional, y `sections: { id, title, body }[]`. Cada sección renderiza con un kicker numerado (`01 · Sección`), `h2` y body con `space-y-4 cap-text-dim text-[15px] leading-[1.7]`.
- El TOC lateral usa `<a href="#id">` directo (anchor scroll nativo) con `scroll-mt-24` en cada sección para compensar el nav sticky.
- Texto pendiente de revisión legal está marcado con dos señales:
  1. Comentario inline `// TODO: ...` para el agente futuro.
  2. Bloque visible `<p className="cap-text-soft text-[13px]">[Pendiente — ...]</p>` para que el equipo legal lo localice al hacer review en preview.

**Páginas Empresa, Producto, Recursos** (Fases 3+4+5):
- **`/empresa`** — hero + sección "historia" en grid 2 columnas (kicker + body) + valores en grid 2x2 (`Compass`, `Eye`, `Heart`, `Users`) + sección equipo (placeholder pendiente de fotos y bios reales) + CTA. Sin testimonios.
- **`/contacto`** — 3 canales (`Mail`, `MessageCircle` para WhatsApp, `Linkedin`) en grid + 3 rutas por intención (`Briefcase` demo, `LifeBuoy` soporte, `Megaphone` prensa) + 2 cards finales: ubicación y horarios. Sin formulario funcional; los CTAs son `mailto:` o `https://wa.me/`. Decisión deliberada: forms requieren proveedor (Resend/SES) — diferido hasta confirmación.
- **`/producto/<slug>`** (4 módulos) — todas usan `ProductoShell`. Sub-features específicas por módulo, copy operativo (no marketing), conexiones auto-generadas vía `slug`. CTA cierra con "Pongamos {módulo} bajo control."
- **`/ayuda`** — 8 categorías en grid `md:grid-cols-2 lg:grid-cols-3` (Primeros pasos, Inventario, Recetas, Costos, Analítica, POS, Compras, Facturación). Cada categoría lista 3 artículos como bullets pero **los slugs no llevan a páginas todavía** (placeholder explícito). Buscador marcado como pendiente.
- **`/estado`** — patrón de status page minimal: badge global con icono `CheckCircle2` + 4 servicios con pill de estado (operational/degraded/outage usando los hex de §18 de CLAUDE.md) + grilla de uptime de 90 días (90 barras de 1.5px) + sección de incidentes recientes. Mock estático, marcado para reemplazo cuando exista monitoreo real (`/api/health`, Better Stack, Statuspage).

**SEO**:
- `src/app/sitemap.ts` lista las 12 rutas públicas (landing + 4 producto + empresa + contacto + ayuda + estado + 3 legal). Usa `process.env.NEXT_PUBLIC_SITE_URL` con fallback `https://capsula.app`. Tras Fase 5 todas las rutas existen — no hay 404 navegando desde el footer.
- `src/app/robots.ts` permite todo y bloquea explícitamente `/dashboard/`, `/api/`, `/login`, `/kitchen/`.

**Convención global de placeholders**:
1. Comentario inline `// TODO: ...` para el agente futuro.
2. Bloque visible `<p className="cap-text-soft text-[13px]">[Pendiente — ...]</p>` para que el equipo localice qué falta al hacer preview.

Items pendientes documentados en placeholder a fecha de cierre (Fase 5):
- Términos: alcance exacto de licencia + política reembolsos + jurisdicción definitiva.
- Privacidad: región/proveedor cloud específico + listado público de subprocesadores.
- Seguridad: proveedor cloud + región + política formal de bug bounty.
- Empresa: año de fundación + métricas cobertura + perfiles de equipo.
- Contacto: número WhatsApp definitivo + handle LinkedIn + decisión de publicar dirección física.
- Ayuda: buscador de artículos + páginas individuales `/ayuda/[slug]`.
- Estado: integración con monitoreo real + feed de incidentes con post-mortems.

### 19.9 Fase 2.C.3.b — Layouts compartidos restantes (no-op, sin commit)

Exploración de `src/components/layout/` y `src/app/**/layout.tsx` para cerrar el bloque 2.C. Resultado: cero escritura requerida.

Auditoría con `cmp -s` byte a byte contra capsula:

- `src/components/layout/DashboardShell.tsx` — 1 910 B idéntico.
- `src/components/layout/Navbar.tsx` — 3 767 B idéntico.
- `src/components/layout/NotificationBell.tsx` — 20 546 B idéntico.
- `src/components/layout/ThemeToggle.tsx` — 1 087 B idéntico.

Los cuatro ya están sincronizados byte a byte, probablemente porque derivan de un ancestro común pre-fork y ninguna de las dos ramas los modificó desde entonces. Sin trabajo.

**Veto permanente sobre `src/app/dashboard/layout.tsx`**. Este archivo es `visual+logic` y shanklish está adelantado respecto a capsula: usa `visibleModules({ role, allowedModules, grantedPerms, revokedPerms })` del módulo `src/lib/permissions/` con fallback defensivo a BD para JWTs emitidos antes del Prompt 6 (cuando el campo `allowedModules` del JWT era `undefined`). Capsula solo hace `JSON.parse(dbUser.allowedModules)`, una versión más simple que no aplica el álgebra de 4 capas. Portar capsula aquí sería regresión directa del núcleo de seguridad y además tocaría `src/lib/permissions/` indirectamente vía import, cruzando una línea roja. La dirección correcta en Fase 4 es la inversa: capsula recibe este archivo de shanklish, no al revés.

`src/app/layout.tsx` raíz ya fue mergeado en 2.A (metadata CÁPSULA + Nunito) y está explícitamente fuera de scope para esta sub-fase.

### 19.10 Fase 2.F — CI/CD (commits `4f18704` + `19b85f6`)

Primer workflow de GitHub Actions del branch, definido en `.github/workflows/ci.yml`. Dos jobs:

**`validate`** — dispara en push y en PR contra `capsula/consolidation`. Levanta un servicio `postgres:16` efímero en el runner con DB `capsula_ci` y health check vía `pg_isready`. Pasos: checkout del repo → setup de Node 22 con caché npm → `npm ci` determinista contra `package-lock.json` → `prisma generate` → `prisma db push --skip-generate --accept-data-loss` contra la DB efímera → `npx tsc --noEmit` → `npm run test` (vitest run, 27 smoke tests). Sin `continue-on-error` en ninguna step: falla al primer error. El job es el gate para cualquier merge futuro hacia `master` o hacia `capsula-erp` (Fase 4).

**`deploy`** — stub pensado como shape final para Fase 4. Trigger `workflow_dispatch` only (manual), `needs: validate`. Template listo para SSH a Contabo: `git pull` en el working dir del servidor, `npm ci`, `prisma migrate deploy`, `npm run build`, `pm2 reload all`. Los secrets esperados están declarados como referencia: `CONTABO_HOST`, `CONTABO_USER`, `CONTABO_SSH_KEY`, `DATABASE_URL_PROD`. Ninguno configurado aún en GitHub — se registran en Fase 4.

**Switch de `migrate deploy` a `db push`** (commit `19b85f6`): la versión inicial del workflow (`4f18704`) usaba `prisma migrate deploy` para respetar el historial de migraciones, pero falló en la corrida inicial contra una DB vacía al llegar a la segunda migración (`20260308000000_add_order_name_to_purchase_order`), que ejecuta `ALTER TABLE "PurchaseOrder"` sobre una tabla que nunca fue creada. Diagnóstico: falta migración `0000_init` — ver ticket BASELINE-001 en §19.12. Mitigación: `prisma db push --accept-data-loss` sincroniza la DB efímera directamente desde `schema.prisma` sin recorrer el historial. Primera corrida verde justo tras el switch.

CI operativo de forma estable a partir de `19b85f6`. Fase 2.F cerrada.

### 19.11 Fases pendientes (orden actualizado 2026-04-19)

El orden de fases cambió el 2026-04-19 — ver §19.13 para el razonamiento.
Estado actualizado al cierre del día 2026-04-19:

- **Fase 4 — Cutover repo** ✅ **COMPLETADA 2026-04-19**. Force-push
  de `capsula/consolidation` → `capsula-erp/main`. Safety tag
  `pre-cutover-2026-04-19` creado en `6d57b00`. Remote local swap
  ejecutado. Ver §19.14 para detalles de ejecución.
- **Fase 5.a — Switch Vercel producción** ✅ **COMPLETADA 2026-04-19**.
  Proyecto Vercel `shanklish-erp-main` reconectado de
  `Juninho2604/shanklish-erp-main` → `Juninho2604/capsula-erp` manteniendo
  mismo nombre de proyecto (URL pública preservada). Deploy `47JtCiTN`
  (commit `ec37b51`) promovido manualmente a producción. DB sigue en
  AWS RDS sin cambios. Ver §19.14 para detalles.
- **Fase 2.D — Admin UI módulos (POST-CUTOVER)**. Se ejecuta directamente
  en `capsula-erp` como feature normal, no como portación. Scope:
  `src/app/dashboard/config/modulos/`. Riesgo previsto medio por
  interacción con permisos 4-capa.
- **Fase 2.E — Seed bootstrap (POST-CUTOVER)**. Se ejecuta cerca del
  momento en que se agregue un segundo tenant real (Table Pong o
  similar), cuando el shape de tenant esté definido.
- **Fase 3 — Documentación multi-tenancy**. Documento
  `docs/MULTITENANCY.md`. No bloquea nada, se hace cuando haya banda.
- **Fase 5.b — Migración AWS RDS → Contabo (POSPUESTA)**. Ventana de
  mantenimiento de 2-4h. Deadline flexible (próximos 1-3 meses por
  decisión del humano). Contabo hoy tiene schema pero BD vacía. Pre-req:
  resolver BASELINE-001 (§19.12) antes o durante esta fase. Pre-req
  adicional: Contabo en grado producción (SSL, backups automáticos,
  monitoring).
- **Fase 6 — UI review del POS (POST-CUTOVER)**. Los colores coral del
  branding Cápsula, heredados vía globals.css de 2.A, son inadecuados
  para operación táctica en tableta del POS. Requiere paleta operativa
  independiente del branding marketing. Alcance: POS Restaurante, POS
  Mesero, POS Delivery, POS PedidosYA, vistas de Cajera. Usar skill
  `tablepong-ui-review` ya instalada en el proyecto. Pre-req: test con
  tableta real en condiciones de luz de cocina. Detectado durante
  validación post-switch 2026-04-19.

### 19.12 Deuda técnica identificada durante la consolidación

**BASELINE-001** (descubierto en Fase 2.F durante la primera corrida fallida del CI):

`prisma/migrations/` carece de una migración inicial `0000_init` que cree desde cero el schema base. Las 26 migraciones actuales son únicamente **deltas**: la primera cronológicamente (`20260127011614_add_requisitions`) ya asume la existencia de un schema preexistente, creado originalmente vía `prisma db push` en la era pre-migrations del proyecto. En producción (AWS RDS) y en Contabo esto no se nota porque sus tablas ya existen y Prisma solo aplica los deltas incrementales. El problema aparece al primer intento de `prisma migrate deploy` contra una DB vacía: la segunda migración (`20260308000000_add_order_name_to_purchase_order`) ejecuta `ALTER TABLE "PurchaseOrder"` sobre una tabla que nunca fue creada y falla.

Consecuencias directas:

- CI no puede usar `prisma migrate deploy` y tiene que hacer `db push` (§19.10). Pierde la validación del historial de migraciones como efecto secundario.
- Cualquier tenant nuevo que se cree en Fase 3 tendrá el mismo problema al bootstrapear su schema aislado.
- Fase 4 no puede usar `migrate deploy` limpio en el flujo de deploy a Contabo si la ruta alguna vez toca una DB vacía.

**Mitigación temporal** (ya aplicada): CI en `prisma db push --skip-generate --accept-data-loss`. Funcional para validación de schema, pero no prueba migraciones reales.

**Fix definitivo** (postpuesto a Fase 3, día 0): generar el baseline con

```bash
prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/00000000000000_init/migration.sql
```

marcar como `--applied` en las DBs existentes (Contabo, AWS RDS) con `prisma migrate resolve --applied 00000000000000_init`, verificar que `_prisma_migrations` quede consistente, y cambiar el CI de vuelta a `prisma migrate deploy`. Operación de bajo riesgo si se hace aislada y con backup previo.

### 19.13 Decisión estratégica — reorden de fases (2026-04-19)

El plan original de consolidación tenía como último paso antes del
cutover completar 2.D (admin UI módulos) y 2.E (seed bootstrap).

A mitad de la Fase 2, tras cerrar 2.A, 2.B, 2.C.1, 2.C.2, 2.C.3.a,
2.C.3.b, 2.F y 2.DOCS, se reevaluó el orden. Hallazgos:

- El objetivo real del proyecto es **cortar el trabajo doble en dos
  repos**, no completar una portación visual perfecta. 2.D y 2.E no
  avanzan ese objetivo — solo refinan el UI de un módulo que ya
  funciona en shanklish.
- El branch `capsula/consolidation` en `95ba60e` ya cumple las
  condiciones de producción: tests verdes (27/27), CI verde, permisos
  4-capa intactos, branding aplicado, layouts reconciliados, deploy
  stub listo. No hay riesgo técnico en promover.
- Hacer 2.D y 2.E *antes* del cutover significa días adicionales de
  mantenimiento paralelo de dos repos (cambios del cliente Shanklish
  Caracas tienen que aplicarse en ambos o arriesgarse a divergencia).
  Hacerlas *después* del cutover significa trabajo una sola vez en
  el repo único.

Decisión: adelantar Fase 4 y Fase 5.a. Postponer 2.D y 2.E. Mantener
Fase 5.b (migración DB) postpuesta hasta que un tenant nuevo lo
justifique.

La BD de producción AWS RDS NO se toca en este reorden. El cutover
es solo de código y configuración Vercel.

### 19.14 Ejecución del cutover — Fase 4 + Fase 5.a (2026-04-19)

Fase 4 y Fase 5.a se ejecutaron en la misma sesión el 2026-04-19 entre
aproximadamente las 20:30 y 21:30 hora local.

**Fase 4 — Cutover repo (git)**

Ejecución desde local en `C:\Users\Usuario\capsula-migration\shanklish-erp-main`:

1. Safety tag `pre-cutover-2026-04-19` creado sobre `6d57b00` (HEAD
   previo de `capsula-erp/main`) y pusheado al remote. Hace el estado
   previo recuperable permanentemente.
2. Force-push: `git push -f capsula-dest capsula/consolidation:main`.
   Transición: `6d57b00` → `ec37b51` en `capsula-erp/main`.
3. Remote swap local: `origin` renombrado a `shanklish-legacy`, nuevo
   `origin` creado apuntando a `capsula-erp`.
4. Branch local renombrado: `capsula/consolidation` → `main`, con
   upstream `origin/main`.

Rollback disponible post-Fase 4:
`git push -f origin pre-cutover-2026-04-19:main` (restituye
`capsula-erp/main` a `6d57b00`).

**Fase 5.a — Switch Vercel producción**

Ejecución desde UI de Vercel (no CLI). Proyecto: `shanklish-erp-main`
(nombre preservado a propósito — cambiar el nombre del proyecto habría
cambiado la URL pública y roto accesos del equipo).

1. Settings → Git → Disconnect del repo `Juninho2604/shanklish-erp-main`.
2. Connect Git Repository → `Juninho2604/capsula-erp`.
3. Verificación: env vars intactas (3 variables), URL pública sirviendo
   deploy viejo `6uY2rA6or` mientras tanto, zero downtime observable.
4. Settings → Build and Deployment → Node.js Version cambiado de `24.x`
   a `22.x` (Vercel había asignado 24 por default al reconectar, pero
   el código se desarrolla contra Node 22).
5. Deployments → click en preview `47JtCiTN` (commit `ec37b51`,
   pre-construido exitosamente durante el día) → Promote to Production.
6. Vercel re-apuntó la URL pública al deploy `47JtCiTN` en ~30-60s.

Validación post-switch:

- URL pública carga branding coral/navy con `CapsulaLogo` (confirmado
  visualmente).
- POS PedidosYA renderiza correctamente con datos reales de AWS RDS
  (productos, precios, descuentos).
- Login funciona con usuarios existentes (Dueño, Cajera, Mesonero con
  PIN verificados).
- Sidebar colapsable opera normalmente.

Rollback disponible post-Fase 5.a:
Deployments → click en `6uY2rA6or` → Promote to Production. ~30 segundos.
DB no se tocó.

**Hallazgos operativos de Vercel (Hobby plan)**

- No existe setting explícito de "Production Branch" en Settings del
  proyecto. Vercel usa la default branch del repo (`main` en
  `capsula-erp`). Funciona bien pero sorprende si se espera encontrar
  la config.
- El reconnect a un repo nuevo NO dispara redeploy automático si el
  commit HEAD del nuevo repo ya existe como preview previo. Hay que
  promover manualmente el preview existente.
- Al reconectar, Node.js version se resetea a default (24.x al momento
  de esta ejecución). Verificar siempre post-reconnect.

### 19.15 Branch protection en capsula-erp/main (2026-04-19)

Activado Ruleset "Main" en GitHub `capsula-erp` tras el cutover.

**Reglas activas:**

- **Require pull request before merging** (1 approval requerido)
- **Required status check: `validate`** (job del CI workflow creado en
  Fase 2.F — tsc + vitest + prisma db push)
- **Require branches to be up to date before merging**
- **Block force pushes**
- **Restrict deletions**

**Lista de bypass:** solo `Rol de administrador del repositorio`
(efectivamente Juninho2604). Permite que el owner haga push directo a
main para hotfixes de emergencia o trabajo iterativo sin armar PR.

**Claude App SIN bypass** (decisión tomada 2026-04-19 tras evaluar
tradeoff velocidad vs riesgo). Razones documentadas:

- Sesiones automatizadas de Claude cloud pueden fallar (bucle infinito
  histórico, commits sin pedir permiso) y un bypass permitiría deploys
  no filtrados a producción.
- El valor real del bypass era ahorrar ~15s al mergear un PR — costo
  menor que la red de seguridad del CI.
- Flujo actual: Claude cloud abre PR → CI corre → Omar aprueba con 1
  click. Mantiene velocidad + safety.
- Omar (admin) sigue pudiendo push directo para emergencias reales.

**Protocolo para Gustavo (colaborador con write access):**

- Trabajo en branches con patrón `gustavo/feature-xxx`.
- Push a esas branches permitido sin restricciones.
- Para mergear a `main`: PR obligatorio con 1 approval (Omar) + CI verde.
- Mensaje sobre el cambio enviado a Gustavo el 2026-04-19.

**Revisar esta configuración cuando:**

- El equipo crezca a 3+ desarrolladores activos.
- Omar ya no sea el único admin funcional.
- Aparezca un incidente de producción causado por push directo (del
  admin o de un bypass).

---

### 18.38 Minimal Navy Design System — catálogo vivo (2026-04-23)

> Migración completa concluida: sidebar, dashboard, estadísticas, 4 POS (delivery, pedidosya, mesero, restaurante), cuentas-pagar. Cualquier archivo nuevo debe usar ESTE sistema. Las reglas permanentes viven en `CLAUDE.md` en la raíz del repo.

#### Decisión cromática y tipográfica

- **Tipografía única en UI:** Inter Tight sans (`var(--font-body)`). Instrument Serif (`var(--font-heading)`) queda declarado pero **no se aplica** en titulares — `h1/h2/h3` reciben `font-family: var(--font-body)` + `font-weight: 600` + `letter-spacing: -0.02em` desde `globals.css`. Convenir jerarquía con tamaño/peso, no con familia.
- **Paleta editorial:** coral (`#EF5B3A`), navy (`#0B1727` deep / `#20334D` base / navy-soft = tinte claro), ivory (base + surface + alt), ink (4 escalones para texto), line (separador + strong).
- **Iconografía:** `lucide-react` en todo chrome de UI. Los emojis solo sobreviven en payloads de impresoras térmicas, contenido del usuario y debug.

#### Arquitectura de tokens

- **HSL vars** (`hsl(var(--x))`) — siguen usándose para `--background`, `--foreground`, `--primary`, etc. (shadcn/ui primitives). No tocar.
- **RGB triplets** (`rgb(var(--capsula-X-rgb) / <alpha-value>)`) — definidos en `:root` (light) y `.dark` (dark) en `src/app/globals.css` para cada `capsula-*` token. Tailwind consume estos en `tailwind.config.ts → colors.capsula`. Esto permite `text-capsula-ink/70`, `bg-capsula-coral/10`, etc. con dark-mode automático.
- **Hex legado** (`--capsula-navy-deep` sin sufijo `-rgb`) — sobrevive para los helpers CSS (`.pos-btn`, `.pos-tile`) que consumen la var directo. Los dos conjuntos (hex y rgb triplet) deben mantenerse sincronizados en `:root` y `.dark`.

#### Clases canónicas (usar siempre)

```
Fondos:    bg-capsula-ivory · bg-capsula-ivory-surface · bg-capsula-ivory-alt
           bg-capsula-navy-deep · bg-capsula-navy · bg-capsula-navy-soft
           bg-capsula-coral · bg-capsula-coral-hover
Texto:     text-capsula-ink · text-capsula-ink-soft · text-capsula-ink-muted · text-capsula-ink-faint
           text-capsula-ivory · text-capsula-coral · text-capsula-navy-deep
Bordes:    border-capsula-line · border-capsula-line-strong
Helpers:   pos-btn · pos-btn-secondary · pos-btn-danger
           pos-tile · pos-card · pos-panel · pos-input
           pos-label · pos-kicker · pos-amount · pos-heading-lg
Overlay:   bg-capsula-ink/60 backdrop-blur-sm  (modales)
Focus:     focus:border-capsula-navy-deep  (inputs)
Números:   tabular-nums  (obligatorio en precios/saldos)
Kickers:   text-[10px] font-semibold uppercase tracking-[0.14em] text-capsula-ink-muted
Titulares: font-semibold tracking-[-0.02em] text-capsula-ink
```

#### Clases prohibidas en código nuevo (lista curada tras la migración)

| Prohibido | Reemplazo |
|-----------|-----------|
| `font-black`, `font-bold` (en UI nueva) | `font-semibold` |
| `font-heading`, `Instrument Serif` | `font-body` (default) |
| `text-primary`, `bg-primary text-white` en POS | `bg-capsula-navy-deep text-capsula-ivory` |
| `text-capsula-navy*` para texto largo | `text-capsula-ink` (invierte en dark) |
| `bg-emerald-*`, `bg-amber-*`, `bg-sky-*`, `bg-red-*`, `bg-blue-*`, `bg-purple-*`, `bg-indigo-*` (chrome) | `bg-capsula-navy-soft`, `bg-capsula-ivory-alt`, `bg-capsula-coral/10` |
| `text-emerald-*`, `text-amber-*`, `text-sky-*`, `text-red-*`, `text-blue-*` (chrome) | `text-capsula-ink` / `text-capsula-coral` |
| `capsula-btn`, `capsula-btn-primary`, `capsula-btn-secondary`, `capsula-card` | `pos-btn` family + `pos-card` |
| `glass-panel` en UI nueva | `bg-capsula-ivory border border-capsula-line` |
| `shadow-2xl shadow-primary/20` sobre `pos-btn` | los helpers ya traen `--tactile-shadow` |
| `bg-black/70`, `bg-background/90` (backdrops) | `bg-capsula-ink/60 backdrop-blur-sm` |
| Emojis en JSX chrome (🍸 🔥 ✅ 🧾 🪑 etc.) | Icono `lucide-react` — ver tabla completa en `CLAUDE.md` |
| `text-gray-950 dark:text-foreground` (hack dark) | `text-capsula-ink` |

#### 4 tonos sutiles autorizados para estado (NO abrir tokens adicionales)

Cuando necesites señalización cromática (ok/warn/danger/info), escribir hex inline con `dark:` override:

```
ok      bg-[#E5EDE7] text-[#2F6B4E] dark:bg-[#1E3B2C] dark:text-[#6FB88F]   (Listo / enviado a cocina)
warn    bg-[#F3EAD6] text-[#946A1C] dark:bg-[#3B2F15] dark:text-[#E8D9B8]   (En cocina / pendiente)
danger  bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]   (Error — alterna con capsula-coral)
info    bg-[#E6ECF4] text-[#2A4060] dark:bg-[#1A2636] dark:text-[#D1DCE9]   (Informativo neutro)
```

Usar solo donde el status lo amerita. Por defecto seguir capsula-* neutro.

#### Iconografía — mapa canónico emoji → lucide

(Resumen; tabla completa en `CLAUDE.md`)

| Área | Icono |
|------|-------|
| POS Restaurante header | `Wine` |
| POS Mesero / Enviar cocina | `ChefHat` |
| Pickup / Venta directa | `ShoppingBag` |
| Carrito | `ShoppingCart` |
| Cuenta / factura | `Receipt` |
| Reimprimir / Pre-cuenta | `Printer` |
| Mesas | `Armchair` |
| Menú | `UtensilsCrossed` |
| Zona Bar / Jardín | `Beer` / `Leaf` |
| Cortesía | `Gift` |
| PIN / Autorización | `Lock` |
| Cuenta abierta | `Unlock` |
| Mesonero / Cajera | `UserCircle2` / `UserCog` |
| Subcuentas | `Divide` |
| Transferir mesa | `ArrowLeftRight` |
| Cash USD / EUR | `DollarSign` / `Euro` |
| Zelle / PDV / Móvil / Bs | `Zap` / `CreditCard` / `Smartphone` / `Banknote` |
| Anular / Ajustar / Cambiar | `Ban` / `Pencil` / `RefreshCw` |
| En cocina / Listo | `Flame` / `Check` |
| Cerrar | `X as XIcon` |
| Volver | `ArrowLeft` |
| Advertencia | `AlertTriangle` |
| Teléfono | `Phone as PhoneIcon` |
| Fecha | `Calendar` |
| Código / Tag | `Tag` |

Los iconos de **sidebar y módulos** viven centralizados en `src/lib/module-icons.ts` (44 `MODULE_ICONS` + 4 `SUBGROUP_ICONS`). Añadir cualquier módulo nuevo ahí antes de registrarlo en el sidebar.

#### Patrón de modal estándar

```tsx
<div className="fixed inset-0 z-[60] bg-capsula-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
  <div className="bg-capsula-ivory border border-capsula-line w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl">
    <div className="border-b border-capsula-line p-5 flex items-center justify-between">
      <h3 className="font-semibold text-lg tracking-[-0.02em] text-capsula-ink">Título</h3>
      <button className="h-8 w-8 rounded-full hover:bg-capsula-coral/10 hover:text-capsula-coral text-capsula-ink-muted flex items-center justify-center">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
    <div className="p-5 space-y-4">…</div>
    <div className="border-t border-capsula-line p-4 flex gap-3">
      <button className="pos-btn-secondary flex-1 py-3 text-sm">Cancelar</button>
      <button className="pos-btn flex-[2] py-3 text-sm inline-flex items-center justify-center gap-2">
        <Check className="h-4 w-4" /> Confirmar
      </button>
    </div>
  </div>
</div>
```

z-index: modales POS en `z-[60]` (sec. 18.1); BellPanel/HelpPanel en `z-[70]`.

#### Archivos de referencia viva

Cuando dudes, copia del archivo migrado más reciente:

| Patrón                          | Archivo canónico                              |
|---------------------------------|-----------------------------------------------|
| Header POS + badge cajera       | `src/app/dashboard/pos/restaurante/page.tsx`  |
| Grid de mesas / zonas           | `src/app/dashboard/pos/restaurante/page.tsx`  |
| Panel pedido activo + cobro     | `src/app/dashboard/pos/restaurante/page.tsx`  |
| Mesero layout + modales PIN     | `src/app/dashboard/pos/mesero/page.tsx`       |
| Pickup mode / Pago mixto        | `src/app/dashboard/pos/restaurante/page.tsx`  |
| Delivery (captura WhatsApp)     | `src/app/dashboard/pos/delivery/page.tsx`     |
| Tabla expandible + KPIs         | `src/app/dashboard/cuentas-pagar/cuentas-pagar-view.tsx` |
| Dashboard hero + stat cards     | `src/app/dashboard/page.tsx`                  |
| Estadísticas con iconFor()      | `src/app/dashboard/estadisticas/page.tsx`     |
| Sidebar grupos + submódulos     | `src/components/layout/Sidebar.tsx`           |

#### Gates antes de commitear cambios de UI

```bash
npx tsc --noEmit            # exit 0 obligatorio
npx vitest run              # 27/27 obligatorio
```

Render desde `main` auto-despliega; los feature branches se mergean vía PR solo cuando el usuario lo pida. No `--amend` a commits empujados.

#### Lecciones duras de la migración (no repetir)

1. **Tailwind no sabe de CSS vars HSL sin wrapper.** Tokens capsula-* deben usar el patrón `rgb(var(--X-rgb) / <alpha-value>)` para que Tailwind pueda aplicar alpha. Hex directo mata dark mode.
2. **`text-capsula-navy*` no invierte en dark** — se usa navy puro en light y en dark, resultando en texto invisible. Para cuerpo/texto largo usar `text-capsula-ink` (que sí cambia).
3. **`bg-primary text-white`** desaparece en dark porque `--primary` invierte a un tono pálido. Usar tokens capsula fijos.
4. **`glass-panel`** y similares que declaran `background: rgba(...)` sin override `.dark` quedan blanquísimos o invisibles. Siempre revisar que cualquier var CSS referenciada tenga redefinición en `.dark`.
5. **Instrument Serif (Times-like)** se activa por herencia si algún ancestro aplica `font-heading`. La migración forzó `h1/h2/h3` globales a `font-body`, pero cualquier clase `font-heading` residual lo reactiva. Buscar y eliminar en nuevos archivos.
6. **Sed con brackets Tailwind** requiere escape: `tracking-\[-0.02em\]`. Sin escape, `-` dentro de `[]` se interpreta como rango de caracteres.
7. **Nunca amendar commits ya pusheados** a rama viva. Si una migración rompe algo, push un nuevo commit corrector.

---

### 18.39 Auditoría módulos restaurante — Fase 1 (2026-04-28)

> Auditoría técnica de los módulos **Inventario · Recetas · SKUs · Artículos · Compras · Proteínas · Almacenes**. Fase 1 = **cero cambios en BD**, solo UI, lógica derivada (read-only), búsqueda fuzzy, scripts auditores. Rama: `claude/audit-restaurant-modules-fKYTr` (28 commits).

#### Política de preservación de datos (regla permanente)

La BD de producción es intocable. Operaciones prohibidas (no las ejecuta nadie sin OK escrito):

- `prisma db push --accept-data-loss`, `prisma db push` contra prod, `prisma migrate reset`.
- `DROP TABLE` / `DROP COLUMN` / `RENAME` sin doble escritura previa.
- `ALTER COLUMN ... TYPE` con cast no seguro.
- Hard-delete en datos transaccionales (`InventoryMovement`, `SalesOrder`, `Recipe`, `InventoryItem`).
- Cambiar valores de un `enum` existente.
- Disparar `resetAllWarehouseStockAction` desde el agente.

Operaciones permitidas en migraciones futuras: `CREATE TABLE` aislado, `ADD COLUMN` nullable o con default determinista, `CREATE INDEX CONCURRENTLY`, `ADD CONSTRAINT NOT VALID` en dos pasos, soft-delete (`deletedAt = NOW()`).

#### Sub-Fase 1.A — Chrome de módulos auditados (UI)

Migración a Minimal Navy (CLAUDE.md §2/§3) en archivos del scope:

- **Hubs**: `inventario/inventory-view`, `inventario/edit-item-dialog`, `recetas/RecipeList`, `recetas/MissingRecipesPanel`, `recetas/[id]/page`, `sku-studio/sku-studio-view`, `almacenes/almacenes-view`, `inventario/diario/page`.
- **Auditorías + historial**: `inventario/auditorias/AuditList`, `inventario/auditorias/[id]/AuditDetail`, `inventario/historial-mensual/movement-history-view`.
- **Submódulos**: `inventario/entrada/entrada-form` (α toasts → β emojis → γ paleta), `inventario/importar/page`, `inventario/diario/daily-manager` (α emojis), `inventario/diario/critical-list-manager`, `inventario/compras/compra-form` (Compra Rápida), `compras/purchase-order-view` (αβγ), `components/whatsapp-purchase-order-parser`, `proteinas/page`, `proteinas/protein-processing-view` (β toasts + γ emojis), `proteinas/processing-templates` (ε emojis).

Reglas aplicadas:

- **Cero `alert()` blocking** en chrome — todos pasaron a `toast.error/success/neutral` (react-hot-toast).
- **Cero emojis en chrome de UI** — reemplazados por iconos `lucide-react`. Las únicas excepciones autorizadas (CLAUDE.md §2): contenido dinámico del usuario, traces de debug, payloads de impresoras térmicas.
- **Cero hex sueltos sin `dark:` override** salvo los 4 tonos sutiles canónicos (ok/warn/danger/info) documentados en CLAUDE.md §3.
- **Helpers `pos-btn` / `pos-input` / `pos-label`** en CTAs/inputs/etiquetas.
- **Z-stack**: modales POS en `z-[60]` con `bg-capsula-ink/60 backdrop-blur-sm`.

#### Sub-Fase 1.E — Paletas con identidad cromática funcional

Tres archivos que codifican estado/columna/paso con color (operativamente útil) recibieron pase quirúrgico que **preserva los hues funcionales** y solo migra el chrome neutro:

- `inventario/diario/daily-manager`: blue=apertura, indigo=entradas, rose=ventas, orange=merma, green=cierre, cyan=sugerencia automática.
- `proteinas/protein-processing-view` y `proteinas/processing-templates`: blue=limpieza, purple=maserado, green=distribución, gris/capsula=personalizado.

#### Sub-Fase 1.B — Lógica derivada (sin BD)

| Cambio | Archivos | Notas |
|---|---|---|
| `costPerServing` derivado | `recipe.actions.ts` + `RecipeList.tsx` | `currentCost / outputQuantity`, fallback a `costPerUnit` cuando `outputQuantity = 0`. Solo lectura. |
| Banner gerencial "ventas con descargo pendiente" | `inventory.actions.ts` + `pending-deduction-banner.tsx` + `inventario/page.tsx` | Detecta `SalesOrder.notes contains 'DESCARGO INVENTARIO PENDIENTE'`. Server Component que se monta sobre `InventoryView`; renderiza solo si `count > 0`. Tono danger dark-aware. |
| Validación Zod | `recipe.actions.ts` (createRecipe/updateRecipe), `sku-studio.actions.ts` (createProductFamily/createSkuTemplate/createSkuItem) | `safeParse` al inicio; mensaje en español con ruta del campo si falla. Tipos derivan con `z.infer`. |
| Helper SKU canónico | `lib/sku.ts` + `lib/sku.test.ts` | `generateSkuCode` / `parseSkuCode` / `skuPrefix` / `sanitizeSegment`. Patrón `FAM-SUB-FMT-NNN` con secuencial zero-padded. **Solo helpers** — no integrado todavía con SKU Studio (espera aprobación). 19 tests vitest. |
| `router.push()` en lugar de `window.location.href` | `inventario/importar/page.tsx` | Preserva estado de cliente y habilita prefetch. |

#### Sub-Fase 1.C — UX búsqueda + paginación

- `lib/fuzzy-search.ts` + `lib/fuzzy-search.test.ts` — wrapper sobre Fuse.js con defaults del ERP (threshold 0.35, ignoreLocation, ignoreDiacritics) y `paginate<T>(items, page, pageSize)` con clamps. 16 tests.
- `inventory-view.tsx` — búsqueda fuzzy (tolera "aciete" → "Aceite") y paginación de 50 ítems con paginador inferior (capsula-line + ChevronLeft/Right). Reset de página al cambiar filtros.
- `RecipeList.tsx` — búsqueda fuzzy sobre nombre/categoría/unidad. No se añadió paginación porque el agrupamiento por categoría ya da estructura visual.

#### Sub-Fase 1.D — Scripts auditores read-only

Solo `SELECT` — preparan diagnóstico para futuras migraciones:

- `scripts/audit-orphan-recipes.ts` — detecta `MenuItem.recipeId` rotos (FK fantasma), inactivos, y recetas activas sin `MenuItem` que las use. **Gate previo** a la migración futura que añada `@relation MenuItem.recipe → Recipe`.
- `scripts/audit-deduction-failures.ts` — diagnóstico profundo de `SalesOrder` con descargo pendiente: distribución por canal, heatmap por día, top 15 `MenuItem` involucrados, identificación de items SIN receta vinculada (root cause estructural). Soporta `--days N` y `--csv`.
- `scripts/audit-supplier-without-history.ts` — cobertura de precios por proveedor: `SupplierItem` sin precio, items con varios proveedores sin preferido, precios obsoletos vs `CostHistory` (proxy hasta que exista `SupplierItemPriceHistory`), suppliers sin items. Soporta `--csv`.

#### Estado de validación al cierre

- `tsc --noEmit` clean.
- `vitest run` → **62/62 tests passing** (27 originales + 19 SKU + 16 fuzzy).
- 28 commits temáticos, todos pusheados a `claude/audit-restaurant-modules-fKYTr`.
- **Cero modificaciones a `prisma/schema.prisma` ni a tablas de la BD.**

#### Pendiente de aprobación gerencial (Fase 2 = toca BD)

Antes de avanzar a Fase 2 (refactor N+1, FK MenuItem.recipe, outbox descargos, etc.), se requiere confirmación explícita del cliente sobre 7 puntos:

1. Patrón de SKU `FAM-SUB-FMT-NNN`.
2. Estrategia ante descargo fallido: outbox + reintento (recomendado) vs rollback duro.
3. Aplicar mermas en descargo: todos los ítems o solo `RAW_MATERIAL` el primer mes.
4. Stack de impresión: `react-to-print` (sin nuevas deps) vs `pdfmake` (+150 KB).
5. Orden de fases: 3.1 (impresión, valor inmediato) antes que 2.1 (refactor N+1).
6. Acceso a `pg_dump` para snapshot pre-migración.
7. Revisión humana del SQL como gate obligatorio.

---

### 18.40 Fase 2 — Migraciones outbox + supplier-history vía Vercel (2026-04-28)

> Aplicación additive-only de las dos primeras migraciones approved
> (`InventoryDeductionRetry` + `SupplierItemPriceHistory`). El despliegue
> real del proyecto es **Vercel + AWS RDS** (no Render), y `vercel-build`
> ya corre `prisma migrate deploy` en cada deploy. Por eso aplicamos vía
> el flujo natural del proyecto.

#### Descubrimiento clave

Hasta este punto se asumió que el proyecto no tenía `_prisma_migrations`
en la BD (porque no había `migration_lock.toml` en el repo). En realidad:

- **Producción real**: Vercel + AWS RDS. `render.yaml` existe pero no es
  el deploy productivo.
- **`vercel-build`** (`package.json`):
  ```
  "vercel-build": "prisma generate && prisma migrate deploy && next build"
  ```
  Esto significa que cada deploy ejecuta `prisma migrate deploy` desde
  hace tiempo, así que `_prisma_migrations` está poblada con las 27
  migraciones existentes. Solo faltaba `migration_lock.toml` en el repo
  (y está intencionalmente en `.gitignore` línea 25).

#### Qué se entrega en este commit

| Archivo | Propósito |
|---|---|
| `prisma/migrations/20260428120000_inventory_deduction_retry/migration.sql` | Outbox table — copia canónica de la propuesta 001 |
| `prisma/migrations/20260428120100_supplier_item_price_history/migration.sql` | Histórico de precios — copia canónica de la propuesta 002 |
| `prisma/migrations-proposed/001_*.sql` y `002_*.sql` | **Eliminados** (ya están como migraciones reales) |
| `prisma/migrations-proposed/README.md` | Actualizado con flujo Vercel + RDS |
| `scripts/apply-phase2-migrations.ts` | **Eliminado** (redundante con `migrate deploy`) |
| `scripts/verify-phase2-migrations.ts` | Mantenido — smoke test post-deploy |

`prisma/schema.prisma` mantiene los modelos `InventoryDeductionRetry` y
`SupplierItemPriceHistory` + relaciones inversas introducidos en el
commit anterior (ya en main).

#### Procedimiento de aplicación

1. **Antes de mergear** el PR:
   - AWS Console → RDS → instancia productiva → Actions → **Take snapshot**.
   - Nombre sugerido: `pre-phase2-2026-04-28`.
   - Esperar status `available` (1-3 minutos).
2. **Mergear el PR a main**.
3. **Vercel auto-deploy**:
   - Ejecuta `prisma generate` (regenera cliente).
   - Ejecuta `prisma migrate deploy` → detecta las 2 migraciones nuevas
     y las aplica en orden, registrándolas en `_prisma_migrations`.
   - Ejecuta `next build` y publica.
4. **Smoke test post-deploy** (opcional pero recomendado):
   ```bash
   DATABASE_URL=... npx tsx scripts/verify-phase2-migrations.ts
   ```
   Confirma que ambas tablas existen, los 9 índices están creados, y el
   cliente Prisma puede contar registros sin error.

#### Garantías de no pérdida de datos

- El SQL es **strict additive**: solo `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE … ADD CONSTRAINT`.
- Cero `DROP`, `TRUNCATE`, `ALTER COLUMN`, `RENAME`.
- Las tablas nuevas no tocan las existentes.
- Snapshot RDS pre-merge funciona como safety net.

#### Rollback (si algo falla)

Probabilidad: bajísima dado el SQL additive con `IF NOT EXISTS`. Pero si
ocurre:

1. **Si Vercel deploy falla** durante `migrate deploy`: el sitio sigue
   en el deploy estable previo. La BD puede haber quedado con una
   migración a medio aplicar (ej. tabla creada pero índices no). En tal
   caso:
   ```sql
   -- desde AWS Console o psql (queries seguras de rollback)
   DROP TABLE IF EXISTS "InventoryDeductionRetry";
   DROP TABLE IF EXISTS "SupplierItemPriceHistory";
   DELETE FROM "_prisma_migrations" WHERE migration_name IN
     ('20260428120000_inventory_deduction_retry',
      '20260428120100_supplier_item_price_history');
   ```
2. **Si todo va peor**: AWS Console → snapshot pre-phase2 → Actions →
   Restore snapshot a nueva instancia → cambiar `DATABASE_URL` en Vercel.

#### Próximos pasos (después de aplicar exitosamente)

1. Conectar `registerInventoryForCartItems` (en `pos.actions.ts`) al
   outbox: cuando el descargo falla, además del flag silencioso en
   `SalesOrder.notes`, insertar fila en `InventoryDeductionRetry`.
2. Implementar cron/worker que consuma
   `InventoryDeductionRetry WHERE status='PENDING' AND nextRetryAt <= NOW()`.
3. Extender `receivePurchaseOrderItemsAction` para insertar en
   `SupplierItemPriceHistory` cuando el `unitPrice` cambia.
4. Vista `/dashboard/compras/proveedor/[id]` con histórico graficado.

---

### 18.41 Fase 2 cierre — outbox cron + histórico precios proveedor (2026-04-29)

> Cierre completo de Fase 2 del audit de módulos restaurante. Sub-fases
> A/B/D/E/C entregadas en 4 PRs squash-mergeados a `main`. Cero pérdida o
> modificación de datos existentes.

#### Mapeo sub-fase → PR → commit

| Sub-fase | Descripción | PR | Commit en main |
|---|---|---|---|
| 2.A | Outbox writer en POS al fallar descargo | #45 | `22545d3` |
| 2.B | Banner gerencial dual (outbox + legacy) | #45 | `22545d3` |
| 2.D | Hook precio en `receivePurchaseOrderItemsAction` | #46 | `a8869b3` |
| 2.E | Vistas read-only `/dashboard/compras/proveedor[/id]` | #46 | `a8869b3` |
| 2.C | Cron worker `/api/cron/retry-inventory-deductions` | #47 | (este commit) |

#### 2.A — Outbox writer (commit `22545d3`)

`src/app/actions/pos.actions.ts`:
- Helper privado `recordDeductionFailure({ items, areaId, orderId, userId, error })`
  → inserta fila `InventoryDeductionRetry` con payload JSON, status `PENDING`,
  `attempts=0`, `maxAttempts=5`, `nextRetryAt = NOW + 5min`. **Best-effort**:
  si el insert falla, sólo loggea — no rompe el flujo de venta.
- Llamado desde los 2 `catch` blocks donde `registerInventoryForCartItems`
  podía fallar (`createSalesOrderAction` ~líneas 904-917, `addToOpenTabAction`
  ~líneas 1266-1276). El flag legado en `SalesOrder.notes` se mantiene por
  compat — el banner consulta ambos y muestra solo el delta.

#### 2.B — Banner gerencial (commit `22545d3`)

`src/app/dashboard/inventario/pending-deduction-banner.tsx`:
- Server Component dual-source. Lee `getOutboxSummaryAction` (Fase 2)
  + `getPendingDeductionSummaryAction` (legacy `notes`).
- Muestra `pending`, `inProgress`, `failed` separados con iconos
  `Loader2`, `Loader2 animate-spin`, `Ban`. Tono `danger` dark-aware.
- Lista de los 3 outbox-items más recientes con `formatRelativeFromNow`
  (próximo intento `en N min` / `atrasado N min`).
- `legacyOnly = max(0, legacy.count - outbox.actionable)` para evitar
  doble-conteo: el outbox es la fuente de verdad post-Fase 2; lo
  legado es histórico anterior al outbox.

#### 2.D — Hook precio en recepción de OC (commit `a8869b3`)

`src/app/actions/purchase.actions.ts`:
- Helper privado `registerSupplierPriceChange({ supplierId,
  inventoryItemId, newUnitPrice, purchaseOrderId, registeredById })`:
  - Lee `SupplierItem.unitPrice` actual.
  - Si `|currentPrice - newUnitPrice| < 0.0001` → no-op (idempotente).
  - En `prisma.$transaction`:
    1. `UPDATE SupplierItemPriceHistory SET effectiveTo=NOW WHERE
       (supplierId,inventoryItemId)=? AND effectiveTo IS NULL`
    2. `INSERT SupplierItemPriceHistory` con `effectiveFrom=NOW`,
       `effectiveTo=NULL`, `registeredFromPurchaseOrderId`.
    3. `UPDATE SupplierItem SET unitPrice=? WHERE id=?` (o `INSERT` si
       el par no existía aún).
- En `receivePurchaseOrderItemsAction`: pre-carga `orderForSupplier.supplierId`
  una sola vez. En el loop por línea, si `supplierId && unitCost > 0`,
  invoca el helper en `try/catch` best-effort.

#### 2.E — Vistas read-only (commit `a8869b3`)

Pages (Server Components con `Suspense` + `notFound()`):
- `src/app/dashboard/compras/proveedor/page.tsx` — grid de proveedores
  activos con `itemsCount` + último cambio (relativo).
- `src/app/dashboard/compras/proveedor/[id]/page.tsx` — header de
  proveedor + delega al chart client component.
- `src/app/dashboard/compras/proveedor/[id]/price-history-chart.tsx` —
  Client Component con `recharts` `LineChart`. Tokens aplicados via
  `rgb(var(--capsula-coral-rgb))`, `rgb(var(--capsula-line-rgb))`, etc.
  para soporte dark-mode nativo. Trend indicator (`TrendingUp/Down/Minus`)
  con tonos `ok`/`danger` autorizados. Tabla cronológica con Δ% entre
  puntos consecutivos.

Actions read-only en `purchase.actions.ts`:
- `getSupplierListForHistoryAction()` → `[{ id, name, code, contactName,
   itemsCount, lastPriceChangeAt }]`.
- `getSupplierPriceHistoryAction(supplierId)` → `{ supplier, items:
   [{ ..., currentPrice, history: HistoryPoint[] }] }`. Limita 50 puntos
  por item para evitar over-fetch.

Link "Histórico de precios" añadido en el header del módulo de compras
(`purchase-order-view.tsx`).

#### 2.C — Cron worker (este commit)

`src/app/api/cron/retry-inventory-deductions/route.ts`:
- `GET` y `POST` ambos invocan el mismo handler (Vercel Cron usa GET por
  default; POST queda para debugging manual).
- **Auth**: si `process.env.CRON_SECRET` está seteado, requiere header
  `Authorization: Bearer ${CRON_SECRET}`. En dev sin secret se permite
  acceso libre.
- Lee hasta `BATCH_SIZE = 25` registros con `status='PENDING' AND
  nextRetryAt <= NOW`, ordenados FIFO por `nextRetryAt asc`.
- Procesa **en serie** (evita hammering) llamando a
  `retryInventoryDeductionFromOutbox(id)` por cada uno.
- Devuelve JSON con counts `{ completed, pending, failed, cancelled,
  skipped, durationMs, errors[10] }`. Log estructurado para Vercel logs.
- `maxDuration = 60` (segundos) — cap por invocación.

`src/app/actions/pos.actions.ts` — `retryInventoryDeductionFromOutbox(retryId)`:
1. **Claim optimista**: `updateMany` con WHERE `id+status=PENDING+
   nextRetryAt<=NOW` → `status=IN_PROGRESS`, `attempts: { increment: 1 }`,
   `lastAttemptAt=NOW`. Si 0 filas → otro worker la tomó, return SKIPPED.
2. Carga el row claimeado, valida `SalesOrder` asociado: si fue
   `CANCELLED` o no existe → marca `CANCELLED` y termina.
3. Parsea `payload` JSON; si está corrupto → `FAILED` inmediato (no
   reintenta payload roto).
4. Llama a `registerInventoryForCartItems(items, areaId, orderId, userId)`.
5. **Éxito** → `status=COMPLETED, completedAt=NOW, lastError=null`.
6. **Fallo** + `attempts >= maxAttempts` → `FAILED`.
7. **Fallo** + `attempts < maxAttempts` → `PENDING` + `nextRetryAt =
   computeNextRetryAt(attempts)` con backoff exponencial:
   - intent 1 → +15 min
   - intent 2 → +1 h
   - intent 3 → +4 h
   - intent 4+ → +24 h (cap)
   `lastError` truncado a 2000 chars.

**Nunca lanza** — siempre retorna `{ id, status, error? }` para que el
cron procese el lote completo sin romperse.

`vercel.json` (nuevo):
```json
{
  "crons": [
    { "path": "/api/cron/retry-inventory-deductions", "schedule": "*/5 * * * *" }
  ]
}
```
Cada 5 minutos. El throughput máximo es 25 items × 12 ejecuciones/h =
300 items/h, suficiente para escala actual.

#### Garantías de no pérdida ni modificación de datos

- Outbox es **append-only** desde el POS. Las únicas mutaciones provienen
  del cron (sus propios registros) o de cancelación manual (no implementada
  todavía — futura fase).
- `registerSupplierPriceChange` modifica `SupplierItem.unitPrice` (que ya
  era write desde el flujo previo de recepción) + crea fila nueva en
  `SupplierItemPriceHistory`. Cero update destructivo en datos existentes
  fuera del campo precio del proveedor.
- El cron mismo es idempotente por el claim optimista: dos workers no
  pueden procesar el mismo `retryId` simultáneamente.
- Backoff progresivo evita storms en caso de problemas persistentes en BD.
- Transacciones atómicas en `registerInventoryForCartItems` y en
  `registerSupplierPriceChange`: rollback completo si cualquier paso falla.

#### Test plan post-deploy

1. **Outbox e2e**:
   - Provocar fallo de descargo (apagar BD inventario / patch temporal).
   - Verificar fila en `InventoryDeductionRetry` con `status=PENDING`.
   - Esperar al cron (≤5 min) → fila debe pasar a `COMPLETED`.
2. **Cron auth**: `curl /api/cron/retry-inventory-deductions` sin Bearer
   debe devolver 401.
3. **Histórico de precios**: recibir una OC con precio diferente al
   vigente → nueva fila en `SupplierItemPriceHistory` y `SupplierItem.
   unitPrice` actualizado. Visitar `/dashboard/compras/proveedor/<id>`
   y comprobar que el punto aparece en el `LineChart`.
4. **Idempotencia**: recibir OC con el mismo precio dos veces → no se
   duplica fila en histórico (helper se short-circuit en tolerancia).

---

### 18.42 Sprint POS + Finanzas + Auth — UX y reglas de negocio (2026-05-08)

> Sprint de mejoras reportadas por operación. **13 PRs squash-mergeados a `main`**
> (#46–#58) que cierran Fase 2 del audit de restaurante, arreglan bugs de
> visibilidad, agregan reglas de negocio y mejoran flujo de cobranza.

#### Mapa de PRs

| PR | Tema | Commit |
|---|---|---|
| #46 | Fase 2.D + 2.E — histórico de precios por proveedor (read-only + hook OC) | `a8869b3` |
| #47 | Fase 2.C — cron worker outbox + cierre Fase 2 completa | `8987ecd` |
| #48 | Fix fonts — eliminar Instrument Serif (warning Vercel) | `329d0e1` |
| #49 | Maintenance mode + endpoint de health (preparación cutover BD) | `650f431` |
| #50 | Fix botón "+" invisible en dark mode + token cream no-invertido | `fa31b73` |
| #51 | POS Mesero — solo capitanes/gerentes imprimen precuenta | `a436c2a` |
| #52 | POS Mesero — propina se incluye en el total | `948f2f0` |
| #53 | Subcuentas en POS Restaurante + cash EUR + recibo individual | `adb5927` |
| #54 | 33% cash discount automático en cuentas y subcuentas | `4080806` |
| #55 | Historial de ventas — cliente real + UI Minimal Navy | `3fe2cb2` |
| #56 | Anular subcuentas (OPEN o cobradas) con autorización gerente | `59f16fd` |
| #57 | Finanzas — resumen diario con toggle Mensual/Diario | `cfa2d09` |
| #58 | Auth — login case-insensitive en email | `5b9c7a8` |

#### Cambios destacados

**1. Token `text-capsula-cream` (PR #50) — token nuevo en design system**

Bug crítico de contraste: `text-capsula-ivory` se invertía en dark mode porque comparte CSS variable con `bg-capsula-ivory` (fondo de página). Resultado: navy-deep + ivory = invisible.

- Agregado `capsula.cream: '#F7F5F0'` (literal hex, NO se invierte) en `tailwind.config.ts`.
- Bulk replace 121 ocurrencias `text-capsula-ivory` → `text-capsula-cream` en 26 archivos.
- CLAUDE.md §3 actualizado: `text-capsula-ivory` ahora prohibido en código nuevo, regla derivada documentada.

**2. POS Mesero — RBAC en impresión (PR #51)**

Botón "Imprimir" precuenta ahora está gateado por `canUseCaptainFeatures` (capitán o gerente). Mesoneros regulares solo ven "Copiar" (clipboard).

**3. Propina en total visible y cobrado (PR #52)**

`grandTotal = runningTotal + serviceCharge + tipAmount` en modal de Cuenta. Línea "Propina" agregada al breakdown. `print-command.ts` actualizado: `totalSuggested = total + serviceFee + tipAmount`. Compatibilidad: callers que no pasan `tipAmount` no se afectan.

**4. Subcuentas auto-detectadas en POS Restaurante (PR #53)**

useEffect en `restaurante/page.tsx`: cuando `activeTab` cambia, llama `getOpenTabWithSubAccountsAction` y si hay subcuentas existentes auto-entra a `subAccountMode`. Botón "Dividir cuenta" muestra "Ver subcuentas existentes (N)".

**5. Cash EUR en subcuentas (PR #53)**

`PAY_METHODS` en `SubAccountPanel.tsx` incluye `CASH_EUR` con icono `Euro`. Backend ya soportaba el método; faltaba exposición UI.

**6. Recibo individual por subcuenta (PR #53)**

- Helper `handlePrintSubAccount(sub)` en SubAccountPanel.
- Auto-impresión tras `paySubAccountAction` exitoso.
- Botón manual "Imprimir" en cada `SubAccountCard` (pre-cuenta o reimpresión).
- Recibo lleva `tabCode · Subcuenta X` en el header.

**7. 33% cash discount automático (PR #54)**

Regla de negocio: cash = 33% off siempre. Antes era manual.

- `restaurante/page.tsx` y `delivery/page.tsx`: useEffect bidireccional (auto-aplica DIVISAS_33 cuando paymentMethod es cash; lo quita cuando deja de serlo). Respeta CORTESIA si fue elegido manualmente.
- `paySubAccountAction` extendida con parámetro `discountType: 'NONE' | 'DIVISAS_33'`.
  - 33% off subtotal **antes** de calcular service charge (10% sobre el descontado).
  - `PaymentSplit` guarda `discount` + `notes='Pago en Divisas (33.33%)'` para auditoría.
  - `splitLabel` incluye `-33% divisas`.
  - `balanceDue` resta subtotal completo (la diferencia es absorbida por el restaurante).
  - `totalServiceCharge` acumula el realmente aplicado.
- `SubAccountPanel`: helper `isDivisasPayMethod` + banner verde "−33% Pago en Divisas: −$X (automático)" + auto-update del monto.

**8. Historial de ventas — cliente real (PR #55)**

Detección inteligente del valor `customerName` crudo:

| Caso | Render |
|---|---|
| Vacío | "Cliente general" italic + UserCircle2 |
| `Mesa 5` / `Bar 1` (sin `—`) | Tag mesa + "sin nombre de cliente" |
| `Mesa 5 — Juan` | "Juan" principal + "Mesa 5" contexto + teléfono |

Migración Minimal Navy completa de la página: header, filtros, 5 stats cards, tabla. Eliminados emojis 📥 🖨️ 📊 ✕ → iconos lucide. Tonos `ok` (cobrado), `danger` (anuladas), `warn` (propinas).

**9. Anular subcuentas con autorización (PR #56)**

Action nueva `voidSubAccountAction({ subAccountId, voidReason, authorizedById, authorizedByName })`:

- Atómica (`prisma.$transaction`).
- OPEN → status='VOID'; items vuelven al pool.
- PAID → además marca PaymentSplits como VOID con notes `[gerente] motivo`, restaura `balanceDue`, decrementa `totalServiceCharge`, reabre la mesa si estaba CLOSED (status='PARTIALLY_PAID', TableOrStation a OCCUPIED, SalesOrder.paymentStatus a PARTIAL).
- UI: modal 2 pasos (motivo → PIN gerente vía `validateManagerPinAction`). Botón rojo "Anular" en cada subcuenta PAID. Badge "ANULADA" en tono danger.

**10. Resumen diario en Finanzas (PR #57)**

Nueva interface `DailyFinancialSummary` (similar a `FinancialSummary` pero período = un día, `dailySales` → `hourlySales` 24 buckets, `mom` → `dod` día anterior).

`getDailyFinancialSummaryAction(dateStr?)`:

- Default: hoy en Caracas si no se pasa fecha.
- Filtra ventas por `revenueWhere()` con boundaries Caracas (04:00 UTC del día → 03:59:59.999 UTC del siguiente).
- Filtra gastos por `paidAt` en el rango (no por `periodMonth/Year` que son agregados mensuales).
- Computa P&L, cash flow, top 5 gastos, byCategory, byType, byPaymentMethod, hourlySales (0..23), DOD.
- Label: "Lunes 12 Mayo 2026".

UI `finanzas-view.tsx`:

- Toggle Mensual/Diario al inicio (Calendar / CalendarDays icons).
- Modo Diario: datepicker + flechas, 4 cards P&L con DOD, BarChart 24 horas, listas tipo/método, 3 cards cash flow.
- Carga lazy (no bloquea render inicial).
- Mensual queda intacto.

**11. Login case-insensitive en email (PR #58)**

Bug: `findUnique({ where: { email } })` con valor crudo del input → `Admin@…` ≠ `admin@…` por VARCHAR case-sensitive.

Fix triple capa:

- Server: trim + toLowerCase del input + cambio a `findFirst({ where: { email: { equals, mode: 'insensitive' } } })`. Cubre usuarios viejos guardados con mixed-case sin migrar datos.
- Client: input email con `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}` para evitar capitalización automática del teclado móvil.
- `createUserAction` y `updateUserNameAction` ya normalizaban — sin cambios.

#### Estado actual del proyecto (snapshot 2026-05-08)

| Métrica | Valor |
|---|---|
| **Modelos Prisma** | 69 |
| **Migraciones aplicadas** | 30 (incluye Fase 2 outbox + supplier-history) |
| **Módulos del dashboard** | 31 |
| **Variantes POS** | 4 (mesero · restaurante · delivery · pedidosya) |
| **Server actions (archivos)** | 44 |
| **Componentes (archivos)** | 41 |
| **API routes** | 6 (auth, arqueo, kitchen, upload, cron retry, health) |
| **Tests vitest** | 62/62 ✓ |
| **TypeScript** | 0 errores |
| **Stack** | Next.js 14 · TS · Prisma 5.22 · Tailwind · Recharts · React 18 |
| **DB** | PostgreSQL 18.2 (RDS us-east-2 actualmente; migración a Contabo PG 18.3 preparada) |
| **Hosting app** | Vercel · cron `*/5 min` (`/api/cron/retry-inventory-deductions`) |

#### Pendientes / próximos pasos sugeridos

1. **Migración BD AWS RDS → Contabo**: el setup en Contabo está completo (PG 18.3 en :5433, swap 3GB, SSL self-signed, firewall ufw, role + DB `capsula_erp_prod`, dump + restore validado con row counts). Falta solo el **cutover** durante ventana de mantenimiento (estimado 5-15 min downtime). Maintenance mode + health endpoint listos (PR #49).
2. **Rotar password de RDS** tras la migración (fue compartido en chat por error).
3. **Cerrar `capsula_db` legacy** en Contabo PG 16: dev/test setup abandonado del 19-abril, 12 MB, SalesOrder=0. Decisión actual: dejar intacto.
4. **Configurar `CRON_SECRET`** en Vercel para autenticar el cron de outbox (`/api/cron/retry-inventory-deductions`).
5. **Audit dark mode segunda pasada** (243 líneas con `text-blue/emerald/amber/etc` sin variante `dark:` detectadas en PR #50; estilo, no contraste crítico).
6. **Backups automáticos** Contabo `pg_dump` cron diario a S3 alterno o BorgBackup remoto (Paso 10 del plan migración).

---

### 18.43 Migración BD AWS RDS → Contabo PostgreSQL 18.3 — CUTOVER COMPLETADO (2026-05-08)

> Migración productiva ejecutada el 8 de mayo 2026 entre las 14:55 y 15:17
> hora Caracas (~22 min total con maintenance mode activo). El sistema dejó
> de leer/escribir en AWS RDS y pasó a operar contra Contabo PG 18.3. Cero
> pérdida de datos validada con row counts exactos.

#### Datos finales (post-cutover)

| Componente | Antes | Después |
|---|---|---|
| **Hosting BD** | AWS RDS db.t3.micro us-east-2 | Contabo VPS US-East 4vCPU/8GB |
| **Versión PG** | 18.2 | 18.3 |
| **Endpoint** | `shanklisherp.cbau4e08oxxx.us-east-2.rds.amazonaws.com:5432` | `147.93.6.70:5433` |
| **Database name** | `shanklish_erp` | `capsula_erp_prod` |
| **Owner role** | `juninho26` | `capsula` |
| **SSL** | RDS root CA verify-full | Self-signed `sslmode=require` |
| **Backups** | RDS automated (1 día retención) | Cron `pg_dump` diario, 30 días retención |
| **Costo mensual** | ~$15-20 (db.t3.micro + storage) | ~$7.68 (ya pagado, mismo VPS) |
| **Latencia app↔BD** | Vercel iad1 → us-east-2 (~10-30ms) | Vercel iad1 → St. Louis (~30-40ms) |

#### Causa raíz descubierta durante el cutover (CRÍTICO)

Antes de poder migrar, descubrí por qué **ningún deploy a producción funcionó
desde el 27 de abril** (commit `c2cc51e`): el cron schedule `*/5 * * * *` que
agregamos en PR #47 para el outbox de retry **viola los límites del plan Hobby
de Vercel** que solo permite cron jobs diarios.

```
{
  "error": {
    "code": "cron_jobs_limits_reached",
    "message": "Hobby accounts are limited to daily cron jobs. This cron
                expression (*/5 * * * *) would run more than once per day.
                Upgrade to the Pro plan."
  }
}
```

Vercel **rechazaba silenciosamente cada deploy de production** desde entonces
— ni en la UI ni en los logs aparecía este error visiblemente. Por eso 13 PRs
(#46–#60) mergeados a `main` no llegaban a producción y el deploy productivo
seguía siendo el redeploy manual de `78P3fEWw3` del 29 abr.

**Fix (PR #61)**: cambiar schedule a `"0 4 * * *"` (una vez al día, 4am UTC =
medianoche Caracas). Compatible con Hobby. El outbox sigue funcionando, solo
que los descargos pendientes se reintentan diariamente en lugar de cada 5 min.
Cuando movamos la app a Contabo, volvemos a `*/5` vía crontab del sistema sin
restricciones.

#### Cronograma del cutover (2026-05-08)

| Hora Caracas | Acción | Resultado |
|---|---|---|
| 14:55 | Activar `MAINTENANCE_MODE=true` en Vercel via API | Env var creada |
| 14:55 | Trigger redeploy con maintenance | Deploy `dpl_5TALWqfNgdwMNa7FTnJP1sgvc2dN` READY (196s) |
| 14:58 | Verificar `/api/health` → `maintenance:true` | ✓ App bloqueada |
| 14:57 | `pg_dump` fresh de RDS desde Contabo | `shanklish_erp-cutover-20260508-1457.dump` 3.8 MB, 70 tablas |
| 14:59 | DROP + CREATE `capsula_erp_prod` en Contabo PG 18 | DB recreada limpia |
| 15:00 | `pg_restore --single-transaction --exit-on-error` | Sin errores, FK constraints OK |
| 15:08 | Verificación row counts RDS vs Contabo | **EXACTAMENTE iguales** ✓ |
| 15:10 | PATCH `DATABASE_URL` via Vercel API → Contabo | Env var actualizada |
| 15:10 | Trigger redeploy con nueva URL | Deploy `dpl_2D71wMu8NWk2F3vBPg96u9q6Y2CP` READY (186s) |
| 15:14 | Delete `MAINTENANCE_MODE` env var | Maintenance OFF |
| 15:14 | Trigger redeploy final | Deploy `dpl_5KNRg3NvBCSDYKcoMUb7SDszCMhf` READY (219s) |
| 15:17 | Smoke test: `/api/health` → `maintenance:false`, `/login` HTTP 200 | ✓ App operativa |
| 15:25 | Configurar backups automáticos en Contabo | Cron `0 7 * * *` activo, primer dump 3.8 MB |

**Downtime total para usuarios: ~12 minutos** (entre primer redeploy con
maintenance ready y último redeploy con maintenance OFF).

#### Validación de integridad de datos

Row counts verificados ANTES del switch del DATABASE_URL (con maintenance
activo, RDS sin escrituras nuevas):

| Tabla | RDS | Contabo | Match |
|---|---|---|---|
| `BroadcastMessage` | 70,500 | 70,500 | ✅ |
| `SalesOrder` | 4,496 | 4,496 | ✅ |
| `InventoryMovement` | 20,407 | 20,407 | ✅ |
| `InventoryItem` | 886 | 886 | ✅ |
| `User` | 24 | 24 | ✅ |
| `Branch` | 1 | 1 | ✅ |
| `OpenTab` | 1,255 | 1,255 | ✅ |
| `MenuItem` | 231 | 231 | ✅ |

#### Configuración de PG 18 en Contabo (referencia rápida)

- **Cluster**: 18-main, port 5433 (PG 16 sigue en 5432 con `capsula_db` legacy intacto).
- **Datadir**: `/var/lib/postgresql/18/main`
- **Config tuning**: `/etc/postgresql/18/main/conf.d/capsula-tuning.conf`
  - `shared_buffers = 2GB` (25% RAM)
  - `effective_cache_size = 5500MB` (~70% RAM)
  - `work_mem = 20MB`
  - `maintenance_work_mem = 512MB`
  - `max_connections = 100`
  - `random_page_cost = 1.1` (SSD)
  - `log_min_duration_statement = 500` (queries lentas)
  - `ssl = on` con `server.crt`/`server.key` self-signed
  - `timezone = America/Caracas`
- **Authentication**: `pg_hba.conf` con `hostssl capsula_erp_prod capsula 0.0.0.0/0 scram-sha-256` + `hostnossl all all 0.0.0.0/0 reject`.
- **Firewall**: `ufw` activo. Puertos: 22 (SSH), 5433 (PG 18), 11434 (legacy Ollama).
- **Swap**: 3 GB en `/swapfile`, swappiness=10.

#### Backups automáticos (configurado el mismo día)

```
/usr/local/bin/capsula-backup.sh   ← script bash
crontab: 0 7 * * * (07:00 UTC = 03:00 Caracas, diario)
Destino: /var/lib/postgresql/backups/capsula_erp_prod-YYYYMMDD-HHMM.dump
Retención: 30 días (find -mtime +30 -delete)
Formato: pg_dump --format=custom (binario comprimido)
```

Test inicial: `capsula_erp_prod-20260508-1524.dump` (3.8 MB) ✓

⚠️ **Pendiente importante**: backups OFF-SITE. Hoy viven en el mismo server
que la BD. Si Contabo se cae catastróficamente (datacenter, RAID failure),
perdemos ambos. Opciones para resolver: rclone a Google Drive, BorgBackup
a otro VPS, o S3 Glacier (~$1/mes). NO urgente pero importante para resiliencia.

#### Pendientes wind-down de AWS

| Tarea | Cuándo | Status |
|---|---|---|
| Rotar password de RDS (compartida en chat) | HOY | 🔴 Pendiente |
| Revocar Vercel API token (compartido en chat) | HOY | 🔴 Pendiente |
| Restringir Security Group de RDS (sólo IP del usuario) | HOY-mañana | 🟡 Sugerido |
| Monitorear estabilidad app↔Contabo | 7-14 días | 🟢 En curso |
| Smoke test del backup recovery | Esta semana | 🟡 Recomendado |
| Snapshot final de RDS antes de terminar | ~22 mayo (D+14) | ⏳ Programado |
| Terminar instancia RDS | ~22 mayo (D+14) | ⏳ Programado |
| Eliminar SG / parameter groups / subnets de RDS | Tras terminar | ⏳ Programado |

#### Plan de rollback (si algo se rompe en los próximos 14 días)

1. Activar `MAINTENANCE_MODE=true` en Vercel (1 min via API).
2. Trigger redeploy.
3. Cambiar `DATABASE_URL` de vuelta a la URL de RDS (que está intacta).
4. Trigger redeploy.
5. Quitar `MAINTENANCE_MODE`.
6. **Tiempo total de rollback: ~5 minutos.**
7. RDS no fue modificada durante el cutover (todo lecturas), así que los datos
   están exactamente como antes.

#### Lecciones aprendidas

1. **Validar config en Vercel ANTES de mergear features que tocan plataforma**
   (cron schedules, headers, redirects). Vercel puede rechazar deploys de
   forma totalmente silenciosa.
2. **Vercel API es accesible vía sandbox** (con token temporal del usuario).
   Esto permite ejecutar maintenance toggles + redeploys sin requerir CLI ni
   PC del usuario. Crítico cuando solo se tiene acceso por celular.
3. **Deploy hooks (vs API directa)**: el deploy hook es más simple pero queda
   "en pending" si hay errores de config. La API directa devuelve el error
   exacto del problema. Para debugging, usar la API.
4. **Maintenance middleware funcionó perfecto**: al aplicar `MAINTENANCE_MODE=true`
   y redeployar, todas las rutas (excepto `/maintenance`, `/_next/*`,
   `/api/health`, `/favicon.ico`, `/robots.txt`) quedaron bloqueadas. Permitió
   hacer el dump+restore con 100% confianza de que RDS no recibía escrituras
   nuevas durante el cutover.
5. **Self-hosted PG es viable** para esta carga: la BD pesa ~50 MB, ~70 tablas,
   ~25k filas. Un VPS con 8 GB RAM y SSD da capacidad sobrada.

---

## 20. Correcciones de Agregación de Ventas (2026-04-24)

Sesión de auditoría numérica: se encontraron 6 tipos de discrepancias entre los dashboards y se implementó un plan de 10 fases. Estado actual: Fases 1, 2, 3, 4, 5, 6, 7, 8 completadas.

---

### 20.1 Bug crítico — `finance.actions.ts` siempre mostraba $0

**Síntoma:** El módulo `/dashboard/finanzas` mostraba ventas = $0 para cualquier mes.

**Causa:** Las 4 queries de `SalesOrder` filtraban `status: 'COMPLETED'`. El modelo `SalesOrder` **nunca alcanza** el estado `COMPLETED` — solo tiene `PAID` y `CANCELLED`. El estado `COMPLETED` es exclusivo de `ProductionOrder` e `InventoryMovement`.

**Fix:**
```ts
// Antes (roto — nunca matchea ningún registro)
where: { status: 'COMPLETED', ... }

// Después (correcto)
where: { status: { not: 'CANCELLED' }, ... }
```

Archivo: `src/app/actions/finance.actions.ts` — aplicado en las 4 funciones exportadas.

---

### 20.2 Zona horaria — regla canónica (Caracas = UTC-4)

**Síntoma:** Dashboard, Estadísticas, Metas y Finanzas usaban `new Date().setHours(0,0,0,0)` (servidor UTC) en lugar de la hora local de Caracas. Los cortes de día eran erróneos en ±4 horas.

**Regla fija:** Todo rango de fecha para ventas debe construirse con las utilidades de `src/lib/datetime.ts`:

```ts
import { getCaracasDayRange, getCaracasNowParts } from '@/lib/datetime';

// Día actual en Caracas
const { start: todayStart, end: todayEnd } = getCaracasDayRange();

// Día anterior
const { start: yesterdayStart, end: yesterdayEnd } = getCaracasDayRange(
  new Date(Date.now() - 86400000)
);

// Inicio de mes en Caracas
const { year: _cy, month: _cm } = getCaracasNowParts();
const monthStart = new Date(Date.UTC(_cy, _cm, 1, 4, 0, 0, 0));
// medianoche Caracas = 04:00 UTC

// Fin de mes en Caracas
const endDate = new Date(Date.UTC(y, m, 1, 3, 59, 59, 999));
// 23:59:59 Caracas del último día = 03:59:59 UTC del día 1 del mes siguiente
```

`getCaracasDayRange()` devuelve `{ start, end }` donde:
- `start` = 04:00 UTC de ese día (= medianoche Caracas)
- `end` = 27:59:59.999 UTC = 23:59:59.999 Caracas del mismo día

**Archivos actualizados:** `dashboard.actions.ts`, `estadisticas.actions.ts`, `metas.actions.ts`, `finance.actions.ts`.

---

### 20.3 Helper canónico de agregación — `src/lib/sales-where.ts`

**Regla:** Toda query de `SalesOrder` que compute **revenue** debe pasar por estas funciones. No escribir los filtros inline.

```ts
import { revenueWhere, propinasWhere, cancelledWhere } from '@/lib/sales-where';

// Revenue normal (excluye canceladas + propinas colectivas)
prisma.salesOrder.aggregate({
  where: revenueWhere(start, end),
  ...
})

// Solo propinas colectivas
prisma.salesOrder.aggregate({
  where: propinasWhere(start, end),
  ...
})

// Canceladas del día (por voidedAt)
prisma.salesOrder.aggregate({
  where: cancelledWhere(start, end),
  ...
})
```

**Reglas codificadas en `revenueWhere`:**
1. `status: { not: 'CANCELLED' }` — excluye anuladas
2. `customerName: { not: 'PROPINA COLECTIVA' }` — excluye propinas del revenue
3. `createdAt: { gte: start, lte: end }` — rango cerrado

**Nota:** para queries con rango abierto (ej. `createdAt: { gte: monthStart }` sin end) NO se puede usar `revenueWhere()` — usar los filtros inline con los mismos valores.

---

### 20.4 Propinas Colectivas — modelo de datos y KPI

Las propinas colectivas son `SalesOrder` con `customerName = 'PROPINA COLECTIVA'`. Son un mecanismo para registrar propinas del equipo de servicio separadas del revenue de mesa.

**Regla de negocio:**
- NO se suman al revenue de ventas en ningún dashboard
- Tienen su propio KPI: fila secundaria compacta debajo del grid principal
- Solo aparece si `count > 0` en el período

**Ubicación visual:**
- `/dashboard` → fila pill `bg-capsula-ivory-alt` debajo de los 4 KPI cards
- `/dashboard/estadisticas` → igual, después de la segunda fila de StatCards

**Query:**
```ts
prisma.salesOrder.aggregate({
  where: propinasWhere(todayStart, todayEnd),
  _sum: { total: true },
  _count: { id: true },
})
// → propinasHoy: { total: number; count: number }
```

---

### 20.5 Cargo de servicio — campo `totalServiceCharge`

**Síntoma anterior:** La detección del +10% de servicio usaba string-matching frágil:
```ts
splits.some(s => (s.splitLabel || '').includes('| +10% serv'))
```
Si el label del split cambiaba, el cargo de servicio quedaba en $0.

**Fix:** Usar el campo `OpenTab.totalServiceCharge Float @default(0)` (schema línea ~1633) que ya es poblado por `pos.actions.ts` al cobrar una mesa.

```ts
// En getSalesHistoryAction, getSalesForArqueoAction, getDailyZReportAction:
openTab: {
  select: {
    ...,
    totalServiceCharge: true,  // ← añadir siempre
  }
}

// Uso (en lugar del string match):
const servicioAmount = tab?.totalServiceCharge ?? 0;
const serviceFeeIncluded = servicioAmount > 0;
const totalFactura = total + servicioAmount;
```

---

### 20.6 Cuentas abiertas — exclusión del Reporte Z

**Regla de negocio:** Una mesa abierta (OpenTab) cuenta como venta **solo cuando se cobra** (cuando tiene `paymentSplits` con `status: 'PAID'`).

**Implementación en `getDailyZReportAction`:**

```ts
// El query de paymentSplits ya filtra por PAID:
paymentSplits: {
  where: { status: 'PAID' },
  ...
}

// Al procesar tabs: si splits.length === 0 → tab sin cobrar → excluir del revenue
if (splits.length === 0) {
  openTabsPending.count++;
  openTabsPending.total += totalFactura;
  continue;  // no suma a grossTotal, paymentBreakdown, etc.
}
```

**`ZReportData` interface** — campos nuevos (2026-04-24):
```ts
openTabsPending: { count: number; total: number }  // mesas abiertas excluidas
cancelledTotal: number                              // monto de anulaciones del día
ordersByStatus: { PAID: number; CANCELLED: number; OPEN: number }  // auditoría
```

**Visual:** banner dashed ámbar bajo "TOTAL COBRADO" en la UI del cierre Z cuando hay tabs pendientes.

---

### 20.7 Órdenes canceladas — visibilidad para auditoría

**Regla:** Las anulaciones deben estar visibles en todo momento para control operativo.

**Dashboard `/dashboard`:**
- Chip rojo danger en fila secundaria (junto a propinas)
- Aparece solo si `cancelledCount > 0` hoy
- Colores: `bg-[#F7E3DB] text-[#B04A2E] dark:bg-[#3B1F14] dark:text-[#EFD2C8]` (danger state canónico)

**Reporte Z `/dashboard/sales`:**
- Sección "AUDITORÍA — ANULACIONES" con count y monto
- Solo se renderiza si `ordersByStatus['CANCELLED'] > 0`

**Query para canceladas del día:**
```ts
prisma.salesOrder.aggregate({
  where: cancelledWhere(todayStart, todayEnd),  // filtra por voidedAt
  _count: { id: true },
  _sum: { total: true },
})
```

---

### 20.8 Tabla de consistencia — superficies vs reglas

| Surface | Status filter | Propinas | Timezone | Helper |
|---------|--------------|----------|----------|--------|
| Dashboard | `not CANCELLED` | excluidas | Caracas ✓ | `revenueWhere` |
| Estadísticas | `not CANCELLED` | excluidas | Caracas ✓ | `revenueWhere` |
| Metas | `not CANCELLED` | excluidas | Caracas ✓ | `revenueWhere` |
| Finanzas | `not CANCELLED` | excluidas | Caracas ✓ | `revenueWhere` |
| Reporte Z | `notIn CANCELLED` | incluidas* | Caracas ✓ | inline |
| Historial ventas | sin filtro | visibles | Caracas ✓ | inline |

*El Reporte Z incluye propinas porque consolida todo lo cobrado en el día (arqueo completo). Las propinas aparecen en `totalTips`.

---

### 20.9 Fases — historial al 2026-04-24

| Fase | Descripción | Estado |
|------|-------------|--------|
| 9 | Reorganizar `sales.actions.ts` en subcarpeta (`src/app/actions/sales/{history,z-report,end-of-day,arqueo,void}.actions.ts`) | ✅ Completada |
| 10 | Validación cruzada entre superficies (PROPINA COLECTIVA excluida, totalServiceCharge canónico) | ✅ Completada |

---

## 21. Cobranza POS Mesero — modal "Mostrar cuenta al cliente" (2026-04-24)

El modal de pre-cuenta del POS Mesonero (`/dashboard/pos/mesero`, `showBillModal`) muestra los datos reales del `OpenTab` para que el mesonero pueda enseñarle la cuenta al cliente antes de cobrar.

**Datos mostrados** (todos en vivo desde `OpenTab`):
- Subtotal (`runningSubtotal`)
- Descuento (`runningDiscount`)
- Servicio 10% (`totalServiceCharge`)
- Total USD = `runningTotal + totalServiceCharge`
- Equivalente Bs (a la tasa actual)
- Pagos ya registrados (`paymentSplits` con `status='PAID'`)
- Saldo pendiente (`balanceDue`) en coral si > 0
- Métodos de pago aceptados (Cash USD/Zelle, Cash EUR, PDV, Pago Móvil, Transferencia)

**Acciones rápidas:**
- **Copiar** — genera texto plano con desglose completo y lo copia al portapapeles
- **Imprimir** — usa `printReceipt({ isPrecuenta: true })` para imprimir pre-cuenta sin cerrar la mesa

**Z-index:** modal en `z-[70]` (sobre BellPanel/HelpPanel `z-[70]` y modales POS `z-[60]`).

---

## 22. Servicio 10% obligatorio en restaurante (2026-04-24)

**Regla de negocio:** Toda mesa (`OpenTab.serviceType === 'TABLE_SERVICE'`) cobra **siempre** el 10% de servicio. No hay opción de excluirlo.

**Backend (`pos.actions.ts`):**

```ts
// registerOpenTabPaymentAction — siempre persiste serviceCharge para TABLE_SERVICE
const isTableService = openTab.serviceType === 'TABLE_SERVICE';
const serviceCharge = isTableService ? appliedAmount * 0.10 : 0;

// PaymentSplit:
{ serviceChargeAmount: serviceCharge, subtotal: appliedAmount, total: appliedAmount, ... }

// OpenTab update:
totalServiceCharge: openTab.totalServiceCharge + serviceCharge
```

**`paySubAccountAction`** fuerza `applyServiceFee = true` para TABLE_SERVICE, ignorando el flag del caller.

**UI POS Restaurante:**
- Eliminado el checkbox "Incluir 10% servicio"
- Reemplazado por badge estático verde (ok-tone): "10% Servicio incluido ✓"
- `serviceFeeIncluded = true` como `const`, `paymentAmountToCharge` siempre aplica `× 1.1`

**Bug histórico (corregido):** `registerOpenTabPaymentAction` solo añadía un label de texto `| +10% serv` pero NUNCA actualizaba `OpenTab.totalServiceCharge` ni `PaymentSplit.serviceChargeAmount`. Solo `paySubAccountAction` lo hacía. Las mesas cobradas vía pago directo (sin subcuentas) tenían el servicio en $0 en los reportes.

---

## 23. Selección de propina por el cliente (2026-04-24)

**Schema** — `OpenTab` añade dos campos:
```prisma
tipPercent  Float?   // 0, 10, 15, 20 — null = no seleccionada
tipAmount   Float?   // tipPercent/100 × runningSubtotal
```

Migración: `prisma/migrations/20260424100000_add_tip_fields_to_open_tab/`.

**Acción nueva:** `setOpenTabTipAction({ openTabId, tipPercent })` en `pos.actions.ts`. Valida `tipPercent ∈ [0, 10, 15, 20]`, calcula `tipAmount = runningSubtotal × pct/100`, persiste y revalida `/dashboard/pos/restaurante` y `/dashboard/pos/mesero`.

**UI POS Mesero** (modal `showBillModal`):
- Sección "Propina" con 4 botones: Sin propina / 10% / 15% / 20%
- Botón activo en `bg-capsula-navy-deep text-capsula-ivory`
- Al seleccionar, llama `setOpenTabTipAction` y recarga
- Cuando hay selección > 0: confirmación verde "Propina X% = $Y"
- Cuando es 0: leyenda "Cliente indicó: sin propina"
- Texto copiado al portapapeles incluye `Propina X%: $Y` cuando hay propina

**UI POS Restaurante** (cajera):
- Banner amarillo (warn-tone) en resumen de cobro: "Propina X% (cliente) = $Y"
- Al abrir el modal de PIN: pre-rellena `checkoutTip` con `tipAmount` (solo si la cajera no ingresó un monto propio)
- Diferencia con `recordCollectiveTipAction`: la propina del cliente es una **preferencia declarada**, mientras que `recordCollectiveTipAction` crea un `SalesOrder` separado con `customerName='PROPINA COLECTIVA'` cuando se cobra efectivamente

---

## 24. Subcuentas como facturas separadas en reportes (2026-04-24)

**Problema:** Mesa con N subcuentas cobradas aparecía como una sola fila consolidada en historial/Z-report/arqueo. Operativamente, cada subcuenta es una factura distinta (cada cliente paga lo suyo).

**Regla:** Si `OpenTab.subAccounts.length > 0`, expandir a una fila por subcuenta. Si no hay subcuentas, comportamiento anterior (1 fila por mesa).

**Archivos afectados** (todos en `src/app/actions/sales/`):

### 24.1 `history.actions.ts` — `getSalesHistoryAction`
- Query: añade `subAccounts: { ... }` y `paymentSplits.subAccountId` al `openTab.select`
- Lógica: `subAccounts.length > 0` → N filas + 1 fila "Otros" si hay PaymentSplits sin `subAccountId` (pool)
- Cada fila de subcuenta tiene su propio `subtotal`, `serviceCharge`, `total`, `paymentMethod`
- Campos nuevos en la fila: `_isSubAccount: true`, `subAccountLabel: 'Cuenta A'`
- `customerName`: `${tab.customerLabel} — ${sub.label}`

### 24.2 `arqueo.actions.ts` — `getSalesForArqueoAction`
- Misma expansión por subcuenta — solo PAID
- `description`: `Mesa 5 Carlos — Cuenta A`
- `correlativo`: `TAB-042/Cuenta A`
- Refactor: helper `addToBreakdown()` y `emptyBreakdown()` para eliminar duplicación

### 24.3 `z-report.actions.ts` — `getDailyZReportAction`
- Query: añade `subAccounts: { select: { id, status } }` al `openTab.select`
- Conteo: `byType.restaurant += Math.max(1, subcuentas_paid)`
- `totalOrders`: ahora se calcula sumando `byType.*` (antes usaba `tabGroups.size + nonTabOrders.length`)
- Totales financieros (`grossTotal`, `totalServiceFee`, etc.): sin cambio

### 24.4 `end-of-day.actions.ts` — `getEndOfDaySummaryAction`
- Query: igual addition de `subAccounts`
- `totalInvoices` y `countByChannel.restaurant`: incrementan por número de subcuentas pagadas (mínimo 1)
- Totales monetarios: sin cambio

**Sin regresión:** Si una mesa no tiene subcuentas, las 4 acciones siguen produciendo 1 fila/factura por tab — comportamiento anterior preservado.

---

## 25. Dark mode visual audit (2026-04-24)

Sesión de fix masivo de visibilidad en dark mode. Patrones encontrados y corregidos:

**Patrón 1 — `text-capsula-navy-deep` invisible en dark:**
El token `--capsula-navy-deep` NO se invierte en dark mode (queda dark). Usar `text-capsula-ink` (ya es dark-aware).

Mass replace ejecutado en `pos/{delivery,mesero,restaurante}/page.tsx` y archivos relacionados (43+ ocurrencias).

**Patrón 2 — Helpers `.capsula-stat-value` con color hardcoded:**
```css
/* Antes */
.capsula-stat-value { color: var(--capsula-navy-deep); }

/* Después */
.capsula-stat-value { color: var(--capsula-ink); }
```

**Patrón 3 — `.pos-btn` con `var(--capsula-ivory)` invisible:**
En dark, `--capsula-ivory` queda dark, haciendo el texto del botón navy invisible. Se hardcodeó `color: #F7F5F0` (always-light) porque el botón siempre es navy.

**Patrón 4 — Botón fullscreen (`DashboardShell`) invisible:**
`bg-capsula-navy-deep text-capsula-ivory` se vuelve dark/dark en modo oscuro. Cambio a `bg-capsula-coral text-white` (siempre visible).

**Patrón 5 — Viewport en móvil:**
Modales de notificaciones/help usaban `max-h-[90vh]` que en Chrome iOS se desbordaba al aparecer la barra. Cambio a `max-h-[85dvh]` (dynamic viewport height — se ajusta cuando aparece/desaparece la barra).

**Patrón 6 — `FinancialSummaryWidget` y `ExecutiveSummary` con tokens shadcn:**
`text-muted-foreground hover:text-foreground hover:bg-muted` → equivalentes capsula-*. Conditionals de profit cambiados a hex con `dark:` override (ok-tone verde / coral).

---

### Tipo de servicio en `OpenTab`

`OpenTab.serviceType` (default `'TABLE_SERVICE'`):
- `TABLE_SERVICE` — mesa de restaurante (10% servicio obligatorio, propina opcional)
- `BAR_TAB` — barra
- `EVENT` — evento

Para validaciones, usar `openTab.serviceType === 'TABLE_SERVICE'` directamente — no inferir desde `orders[0].orderType`.

---

## 26. Dark mode audit — Transferencias y Cargas ventas (2026-04-25)

Dos nuevos patrones encontrados en archivos de módulos non-POS legacy.

**Patrón 7 — `bg-primary text-white` en tabs activos fuera del POS:**
`--primary` se invierte a ivory (`42 27% 95%`) en dark mode. Cualquier componente que use `bg-primary text-white` como estado activo (tabs, botones primarios no-capsula) queda blanco sobre crema = invisible.

Afectó: `transferencias-view.tsx` tab "Nueva Solicitud".

Corrección: `bg-capsula-navy-deep text-capsula-ivory` (o `pos-btn` para táctil).
El §18.38 ya documenta este patrón; queda extendido a todos los módulos, no solo POS.

**Patrón 8 — `text-gray-900` sin dark-variant dentro de `dark:bg-gray-800`:**
Archivos legacy usan escala gray de Tailwind. El contenedor padre tenía `dark:bg-gray-800` correcto, pero los elementos hijos con `text-gray-900` (casi negro) no tenían variante dark → texto negro sobre fondo gris oscuro.

Afectó: `sales-entry-view.tsx` — botones de menú, filas de historial de ventas.

Corrección: añadir `dark:text-capsula-ivory` a cada `text-gray-900`, `dark:text-gray-300` a `text-gray-700` del mismo scope.

**Regla derivada:** Al tocar cualquier archivo con `dark:bg-gray-800`, revisar TODOS los hijos con `text-gray-9*` o `text-gray-7*` sin `dark:` override y corregirlos en el mismo commit.

**Iconos añadidos al vocabulario (Transferencias + Cargas ventas):**

| Contexto | Icono lucide |
|----------|--------------|
| Solicitante / persona | `User` |
| Fecha de operación | `CalendarDays` |
| Items transferidos / caja | `Package` |
| Despacho / enviar | `Send` |
| Expandir fila | `ChevronRight` |
| Exportar / descargar | `Download` |
| Nueva venta / añadir | `Plus` |
| Lista / historial ventas | `ClipboardList` |
| WhatsApp / chat | `MessageCircle` |
| Reportes / estadísticas | `BarChart3` |
| Delivery / bicicleta | `Bike` |
| Cargar archivo | `Upload` |
| Carrito vacío | `ShoppingCart` |

---

*Actualizado el 2026-04-19 — Shanklish ERP / Cápsula SaaS — Documento Completo*
*46 modelos Prisma · 47 módulos · 52 actions · 4 API routes · 3 services · 26 componentes*
*Sistema de permisos 4 capas — commits sesión: 36eed85 · db76d09 · 1e0912c · 3ad8394 · 3617929 · ddb8c8f · 9bb217e · 895cc0c · 8d83bd3 · 34f0349* master

---
Extendido 2026-04-19 — Consolidación Cápsula (secciones 19, 19.11 actualizada, 19.14, 19.15 nuevas)
Extendido 2026-04-24 — Correcciones de agregación de ventas (sección 20)
Extendido 2026-04-24 — Cobranza POS Mesero, servicio 10% obligatorio, selección de propina, subcuentas como facturas separadas, dark mode audit (secciones 21–25)
Extendido 2026-04-25 — Dark mode audit módulos non-POS, patrones 7–8, iconografía ampliada (sección 26)
Repo canónico: capsula-erp
Branch: main (post-cutover)
Commits de consolidación: eec5e92 · b310466 · 591d323 · 3798142 · 4f18704 · 19b85f6 · 089dee5 · 95ba60e · ec37b51

---

## 27. Cobro POS Restaurante — método de pago sin default + pre-cuenta sin descuento divisas (2026-05-09)

### 27.1 Sin método pre-seleccionado en el cobro

Antes el panel de cobro de mesa, pickup y subcuenta arrancaban con `paymentMethod = "CASH_USD"`, lo que producía dos efectos no deseados:
- Visualmente el botón "Cash $" aparecía resaltado, sugiriendo a la cajera que ya estaba elegido.
- El `useEffect` de auto-aplicación de DIVISAS_33 marcaba el descuento desde el primer render → la pre-cuenta y la grilla de cobro mostraban el monto descontado antes de que la cajera escogiera nada.

**Fix:** se conserva `paymentMethod = "CASH_USD"` como sentinel interno (para no propagar `null` a 50+ usos del valor) y se introduce un flag separado `paymentMethodTouched: boolean`:
- **`src/app/dashboard/pos/restaurante/page.tsx`** — `paymentMethodTouched` arranca en `false`. Cada botón de método (`SINGLE_PAY_METHODS.map`) hace `setPaymentMethod(m); setPaymentMethodTouched(true)` en su `onClick`. El highlight visual usa `paymentMethodTouched && paymentMethod === m`.
  - El `useEffect` de auto-aplicación de DIVISAS_33 retorna temprano si `!paymentMethodTouched` y limpia DIVISAS_33 si quedó residual.
  - Botón "Registrar pago" deshabilitado en pago único cuando `!paymentMethodTouched`. En pickup mode aparece aviso `Selecciona un método de pago` antes del botón.
  - Reset del flag en: `resetTableState()`, `handleNewPickupTab()`, `handleSelectPickupTab()`, después de cobro exitoso (mesa y pickup).
- **`src/components/pos/SubAccountPanel.tsx`** — mismo patrón con `payMethodTouched`. Adicionalmente:
  - `applyDivisasDiscount = payMethodTouched && isDivisasPayMethod(payMethod)` (antes era directo).
  - `handlePayConfirm` valida `payMethodTouched` y muestra `toast.error('Selecciona un método de pago')` si no.
  - Botón "Confirmar" deshabilitado y muestra label "Elige método" hasta que la cajera escoja.
  - `useEffect` resetea `payMethodTouched` cuando se cierra el formulario de pago para que la próxima apertura vuelva a exigir elección.

### 27.2 Pre-cuenta — dos botones: con y sin descuento divisas

La pre-cuenta es el documento informativo que el cliente ve **antes de pagar**. Su propósito por defecto: mostrar el monto pleno (sin descuento de divisas) para que el cliente lea el costo real del consumo. Pero si el cliente pide explícitamente verla con el beneficio de divisas aplicado, la cajera tiene un segundo botón.

- **`handlePrintPrecuenta(withDivisasDiscount: boolean = false)` (`restaurante/page.tsx`)**: la firma ahora acepta un flag opcional.
  - `false` (default) → no aplica descuento divisas. Sólo se reflejan cortesías autorizadas (CORTESIA_100, CORTESIA_PERCENT) si están activas.
  - `true` → aplica `base / 3` como descuento e imprime la línea "Pago en Divisas (33.33%)".
- **UI**: en el header de la sección "Cobrar cuenta" hay dos botones lado a lado:
  - `Pre-cuenta` → llama `handlePrintPrecuenta(false)`. Default, monto pleno.
  - `Pre-cuenta c/ desc divisas` → llama `handlePrintPrecuenta(true)`. La cajera la usa cuando el cliente pide ver cuánto sería pagando en divisas.
- Esta separación es **independiente** del método de pago seleccionado en el panel de cobro — la cajera puede imprimir cualquiera de las dos pre-cuentas sin tocar la elección del método.
- **SubAccountPanel `handlePrintSubAccount`**: sigue como estaba — `inferredDivisas` requiere `sub.status === 'PAID'`, así que la reimpresión de pre-cuenta de una subcuenta OPEN nunca aplica descuento divisas. (Si en el futuro se necesita el mismo patrón de dos botones a nivel subcuenta, se replicará el flag.)
- El recibo final (`isPrecuenta: false`) sigue mostrando la línea de descuento divisas tal como antes — sólo se afectó el documento informativo previo al cobro.

### 27.3 Archivos tocados

- `src/app/dashboard/pos/restaurante/page.tsx`
- `src/components/pos/SubAccountPanel.tsx`

Tests: 81/81 ✓ — `tsc --noEmit` exit 0.

## 28. Multi-tenant — Fase 1 schema + Fase 2.A + Fase 3 dormante (2026-05-09)

Conversión de Capsula de single-tenant (Shanklish solo) a multi-tenant
SaaS. Esta sesión cubrió **toda la fase de schema** y la
**infraestructura preparatoria** de la Fase 3, sin activar todavía el
routing por subdominio (eso espera al dominio kpsula.app).

### 28.1 Modelo Tenant (PR #70)

Nuevo modelo raíz multi-tenant. La tabla queda creada y sembrada con
el primer tenant para Shanklish:

```prisma
model Tenant {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // + relaciones inversas a los 42 modelos multi-tenant
}
```

Seed inicial (id literal fijo para que backfills posteriores referencien sin SELECT):

```sql
INSERT INTO "Tenant" (id, slug, name, ...)
VALUES ('tnt_shanklish_caracas', 'shanklish', 'Shanklish Caracas', ...);
```

### 28.2 Schema migrations en lotes (PRs #72-77)

42 modelos recibieron columna `tenantId String NOT NULL DEFAULT 'tnt_shanklish_caracas'`,
FK a `Tenant(id)` con `ON DELETE RESTRICT`, y un índice `@@index([tenantId])`.

Los lotes se aplicaron en este orden por riesgo creciente:

- **Lote 1 (PR #72)** — 6 modelos no críticos: MenuCategory, MenuItem,
  Recipe, Supplier, ExpenseCategory, ProductFamily.
- **Lote 1.C (PR #73)** — backfill UPDATE de las 6 anteriores.
- **Lote 1.D-α (PR #74)** — 10 modelos bajo riesgo (catálogos
  secundarios): InventoryItem, MenuModifierGroup, MenuModifier,
  AuditLog, ExchangeRate, GameType, WristbandPlan, QueueTicket,
  SkuCreationTemplate, BroadcastMessage. Patrón cambió: schema +
  backfill juntos en una sola migration atómica.
- **Lote 1.D-β (PR #75)** — 12 modelos riesgo medio
  (administrativos/financieros): ProductionOrder, ProteinProcessing,
  Requisition, DailyInventory, InventoryLoan, InventoryAudit,
  PurchaseOrder, Expense, CashRegister, AccountPayable,
  AccountPayment, InventoryCycle.
- **Lote 1.D-γ (PR #76)** — 14 modelos POS crítico: User, Branch,
  Area, ServiceZone, TableOrStation, OpenTab, SalesOrder,
  SalesOrderItem, Waiter, GameStation, GameSession, InvoiceCounter,
  SystemConfig, Reservation. Aplicado en ventana de restaurante
  cerrado.

Decisión sobre uniques globales: `SystemConfig.key`,
`InvoiceCounter.channel`, `MenuItem.sku`, `User.email`, etc. **mantienen
su unique GLOBAL** (no compuesto con tenantId). En Fase 2.B se cambiará
a `@@unique([tenantId, key])` cuando entre el segundo tenant. Mientras
solo Shanklish opera, no hay colisión.

### 28.3 Fase 2.A — NOT NULL + DEFAULT (PR #77)

Tras tener todas las filas pobladas, se aplicó `SET NOT NULL` y
`SET DEFAULT 'tnt_shanklish_caracas'` en los 42 modelos. El DEFAULT es
**clave**: el código actual no setea `tenantId` en sus `create/update`,
pero Postgres lo aplica automático. Sin DEFAULT, todos los inserts
fallarían.

### 28.4 P3018 — recovery manual (incidente operativo)

El primer intento de Fase 2.A falló con `Database error code: 23502`
(Postgres null constraint violation): 2 filas en AuditLog y CashRegister
se crearon DESPUÉS del backfill y antes del NOT NULL. Como Vercel
ejecuta `prisma migrate deploy` y la migration falló mid-flight, el
registro `_prisma_migrations` quedó marcado como fallido y bloqueó
todos los deploys siguientes.

Recovery manual aplicado vía `psql` directo al VPS:

1. UPDATE de las 2 filas con NULL.
2. Aplicación manual de los 84 ALTERs (SET DEFAULT + SET NOT NULL × 42).
3. INSERT en `_prisma_migrations` marcando la migration como `finished`.

Lección: en futuros pasos similares (especialmente Fase 2.B uniques),
**combinar UPDATE + ALTER en una sola migration atómica** y verificar
conteos NULL en TODAS las tablas (no solo las críticas) antes del
NOT NULL.

### 28.5 Fase 3 dormante (PRs #83, #84, #85)

Tres PRs que añaden **infraestructura preparatoria** sin tocar
runtime. Ningún archivo en `src/app/` ni `src/server/` los importa
todavía. Se activan en el momento de entrar a multi-tenant pleno
(post-compra de kpsula.app + DNS wildcard + restaurante cerrado).

#### 28.5.1 Tenant context resolver (PR #83)

`src/lib/tenant-context.ts` (puro, testable):
- `extractTenantSlugFromHost(host)` → devuelve "shanklish" para
  "shanklish.kpsula.app", null para "kpsula.app" o "www.kpsula.app".
- Constantes `FALLBACK_TENANT_SLUG = 'shanklish'`,
  `FALLBACK_TENANT_ID = 'tnt_shanklish_caracas'`.
- ROOT_DOMAINS: `['kpsula.app', 'localhost', 'vercel.app']`.

`src/lib/tenant-context.server.ts` (server-only):
- `resolveTenantContext()` — orden: subdomain del host → JWT
  `session.tenantId` → fallback Shanklish. Devuelve siempre un
  TenantContext (nunca null).

#### 28.5.2 defineAction wrapper (PR #84)

`src/lib/define-action.ts` — wrapper para Server Actions que envuelve
auth + permission check + tenant context en una sola declaración tipada:

```typescript
export const myAction = defineAction({
  permission: PERM.MANAGE_USERS,
  handler: async ({ user, tenant }, args) => {
    // user.id y tenant.tenantId garantizados, tipados
    return { success: true };
  },
});
```

Beneficios cuando se active Fase 3:
- Imposible declarar action sin guard (no compila).
- ActionContext { user, tenant } inyectado uniformemente.
- Manejo uniforme de errores no controlados.

7 tests cubren: sin sesión, permiso ok, permiso denegado, user
inactivo, excepción capturada, args paso, sin permiso requerido.

#### 28.5.3 Prisma client tenant extension (PR #85)

`src/lib/prisma-tenant-client.ts` — `withTenant(tenantId)` devuelve un
cliente Prisma extendido que inyecta automáticamente `tenantId`:

- **Read ops** (findMany, findFirst, count, aggregate, groupBy,
  updateMany, deleteMany): añade `where.tenantId = X`.
- **Write ops** (create, createMany, createManyAndReturn): añade
  `data.tenantId = X` (a menos que el caller lo pase explícitamente).
- **upsert**: tenantId en where + create. update no se toca.
- **NO se aplica a**: findUnique, update, delete específicos. Mientras
  los uniques sean globales, Prisma no acepta where compuesto en estas
  ops. Se cubrirán en Fase 2.B.

42 modelos tenant-aware listados en `TENANT_MODELS` Set. Lógica de
inyección extraída como función pura `injectTenantInArgs()` para tests
sin instanciar Prisma (16 tests cubren todas las operaciones).

### 28.6 Vercel build script (PR #71)

`scripts/vercel-build.sh` — wrapper que ejecuta `prisma migrate deploy`
SOLO si `VERCEL_ENV=production`. Razón: Vercel construye un Preview
Deployment por cada PR y, sin esta protección, abrir un PR aplicaría
migraciones a la BD productiva inmediatamente (porque Vercel-DATABASE_URL
apunta a producción).

Con este script, las migrations corren únicamente cuando hay merge a
main. Los previews siguen sirviendo como QA visual del UI sin tocar BD.

### 28.7 Estado al cierre de la sesión

- 42 modelos con `tenantId NOT NULL DEFAULT 'tnt_shanklish_caracas'`.
- Tabla `Tenant` con 1 fila (Shanklish).
- Cliente Prisma principal sigue intacto (sin extensión).
- Ningún server action importa los módulos Fase 3 todavía.
- Sitio operó normal durante todos los merges (cero downtime).

### 28.8 Estado real Fase 2.B y Fase 3 (snapshot 2026-05-16)

- **Fase 2.B — ✅ COMPLETADA**: los uniques compuestos `(tenantId, X)` ya
  están en schema para User.email, MenuItem.sku, Supplier.code,
  ProductFamily.code, GameType.code, GameStation.code, WristbandPlan.code,
  Branch.code, SystemConfig.key, InvoiceCounter.channel, InventoryItem.sku.
  Verificable con `awk '/^model (User|Branch|...)/ {f=$2; pr=1} pr && /@@unique/ {print f}' prisma/schema.prisma`.
  Caveat: `IntercompanySettlement.code` sigue siendo `@unique` global sin
  `tenantId` — si dos tenants generan IC-2026-0001 simultáneamente, colisión.
  No bloqueante hasta que un segundo tenant use intercompany settlements.
- **`defineAction` wrapper — ❌ NO IMPLEMENTADO**: documentado en §28.5.2
  pero ninguna server action lo usa. El patrón vigente en `src/app/actions/**`
  es `resolveTenantContext()` + `withTenant(tenantId)` manual en cada
  función. Funciona en práctica, pero deja huecos cuando una acción olvida
  uno de los dos pasos. Refactor a `defineAction` queda como nice-to-have,
  no como blocker.
- **Multi-tenant hardening 2026-05-16** (PR Cloudflare branch): cerrados
  4 huecos descubiertos en auditoría: (1) `/api/kitchen/orders` GET/PATCH
  ahora requiere session + filtra por tenantId; (2) `/api/print-agent/*`
  resuelve tenantId por API key del agent (env `PRINT_AGENT_TENANT_KEYS`
  JSON), ignora header `X-Tenant-Id` del cliente; (3) IDOR en 6 acciones
  de subAccount (rename/delete/assign/unassign/pay/voidPayment) — todas
  ahora joinean `openTab.tenantId` en el findFirst; (4) `createTenantAction`
  ahora siembra áreas básicas (Almacén / Cocina / Bar / Producción) por
  default, para que el OWNER no aterrice en un sistema vacío.
- **Activación Fase 3 (subdomain routing) — pendiente**: el resolver
  por subdominio existe (`extractTenantSlugFromHost` con sufijo
  `.kpsula.app`) pero el código corre en modo fallback
  (`FALLBACK_TENANT_ID='tnt_shanklish_caracas'` en `tenant-context.ts:18`).
  Para SaaS real hace falta: DNS wildcard `*.kpsula.app`, quitar el
  fallback (o limitar a dev), verificar que JWT + middleware lean el slug
  del host antes que el del JWT.

---

## 29. Hardening de auth — 5 críticos resueltos (2026-05-09)

Audit inicial de auth identificó 6 bugs críticos. Esta sesión cerró
los 5 que requerían cambios de código (#1, #2, #4, #5, #6); el #3
(plain-text password fallback) se eliminará tras correr el script de
auditoría contra la BD productiva (PR #67 ya creado).

### 29.1 PR 1 v2 — JWT_SECRET hardening con fallback degradado (PR #78)

Antes:
```ts
const SECRET_KEY = process.env.JWT_SECRET || 'shanklish-super-secret-key-2024';
```

El fallback hardcodeado era una llave maestra latente.

Después:
```ts
function getSecretKey(): Uint8Array {
    const envSecret = process.env.JWT_SECRET;
    if (envSecret && envSecret.length >= 32) {
        return new TextEncoder().encode(envSecret);
    }
    // Fallback DEGRADADO con warning, no throw (un throw rompería el
    // sitio si la env var falla en deploy).
    if (!secretWarningEmitted) {
        secretWarningEmitted = true;
        console.warn('[auth] WARNING: JWT_SECRET missing or shorter than 32 chars...');
    }
    return new TextEncoder().encode(FALLBACK_SECRET);
}
```

**Lección operativa**: el primer intento (PR #66 original) tiraba `throw`
si JWT_SECRET no existía. Eso rompió producción al desplegar. Hubo que
hacer hotfix revert (#69). El v2 (#78) usa warning + fallback,
imposible de romper sitio.

### 29.2 Login sin enumeración de emails (PR #78)

Antes:
- "Credenciales inválidas (usuario no existe)" si email no existe.
- "Contraseña incorrecta" si password mal.

Después: mensaje único `"Credenciales inválidas"` en ambos casos +
`DUMMY_HASH` que ejecuta PBKDF2 también cuando el user no existe →
latencia idéntica → cierra enumeration por timing.

### 29.3 Timing-safe hash compare (PR #78)

`src/lib/password.ts` ahora usa `timingSafeEqualString()` en lugar de
`===` para comparar hashes. Aplica tanto en la rama PBKDF2 como en el
fallback plain-text legacy (este último se eliminará en script futuro).

### 29.4 Invariantes OWNER (PR #68)

Cierra 5 vectores de escalada/lockout en CRUD de usuarios.

`src/lib/permissions/owner-invariants.ts` (nuevo) con helpers:
- `assertCanModifyOwner(actor, target)`: solo OWNER puede modificar a
  otro OWNER. Antes un ADMIN_MANAGER podía degradar al OWNER.
- `assertNotSelfRoleChange(actor, target)`: nadie puede cambiarse su
  propio rol.
- `assertNotSelfDeactivate(actor, target, nextActive)`: nadie puede
  desactivar su propia cuenta.
- `assertNotLastOwnerDegrade(target, newRole)`: bloquea degradar al
  último OWNER activo (countActiveOwners ≤ 1).
- `assertNotLastOwnerDeactivate(target, nextActive)`: ídem para
  desactivar.

Aplicados en 8 mutations de `user.actions.ts`: updateUserRole,
toggleUserStatus, updateUserModules, updateUserPerms, updateUserPin,
updateUserNameAction, adminResetPasswordAction, createUserAction. La
última también valida que solo OWNER pueda crear OWNER.

### 29.5 tokenVersion — invalidación de JWT al cambiar rol (PR #81)

Antes: si OWNER cambiaba el rol/permisos/password de un user, el JWT
de ese user vivía hasta 24h con el rol viejo.

Schema:
```prisma
model User {
  // ...
  tokenVersion Int @default(0)
}
```

Migration trivial (1 ALTER con DEFAULT 0). Cero riesgo de NULL race.

Lógica:
- `SessionPayload.tokenVersion?: number` (opcional para compat con
  sesiones pre-PR4).
- `checkActionPermission` valida `session.tokenVersion < dbUser.tokenVersion`
  → "Sesión expirada". `undefined` se acepta (compat).
- `loginAction` emite el `tokenVersion` actual en el JWT.
- 6 funciones bumpean `tokenVersion: { increment: 1 }` en sus updates:
  updateUserRole, toggleUserStatus, updateUserModules, updateUserPerms,
  adminResetPasswordAction. La sexta (`changePasswordAction`) re-emite
  la cookie con la nueva versión para que el propio user que cambia su
  clave NO sea expulsado.

### 29.6 Rate limiting — login + PIN (PR #82)

Schema:
```prisma
model RateLimitBucket {
  id          String   @id @default(cuid())
  key         String
  windowStart DateTime
  count       Int      @default(1)
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@unique([key, windowStart])
  @@index([expiresAt])
}
```

Helper `src/lib/rate-limit.ts`:
- `consumeRateLimit({ key, max, windowSeconds })` — UPSERT atómico,
  devuelve `{ allowed, remaining, retryAfterSeconds }`. Sliding
  fixed-window.
- `getClientIp()` — extrae IP de `x-forwarded-for` (Vercel y nginx).
- `cleanupExpiredRateLimitBuckets()` — para cron futuro.

Aplicado en 4 puntos:
- `loginAction`: 5 intentos por (IP, email) cada 5 min.
- `validateWaiterPinAction`: 15 intentos por IP cada 5 min.
- `validateManagerPinAction`: 15 por IP cada 5 min.
- `validateCashierPinAction`: 15 por IP cada 5 min.

Combo IP+email en login evita que atacante bloquee cuenta de víctima
desde otra IP. A 15 intentos/5min, brute-forcear PIN de 4 dígitos
toma ~55h en lugar de segundos.

**Degradación segura**: si la BD falla al `consumeRateLimit`, el código
LOGUEA pero NO bloquea login/PIN. Filosofía: mejor permitir auth con
rate-limit caído que tirar todo el sitio.

### 29.7 Tests adicionales y script de auditoría (PR #67)

- `src/lib/permissions/has-permission.test.ts`: +8 tests cubriendo
  `assertPermission` (lanza Error 403), `revokedPerms` malformado,
  combinatorios reales (granted+revoked+allowedModules). Total 70 tests.
- `scripts/audit-credentials.ts`: read-only audit que detecta
  plain-text en `User.passwordHash`, `User.pin`, `Waiter.pin`. Flaggea
  PINs <4 chars y duplicados por branch. NO imprime ningún valor, solo
  conteos. Pendiente: ejecutarlo contra BD productiva.

---

## 30. Rebrand visible CÁPSULA → KPSULA (2026-05-09)

PR #86. Cambio del texto visible al usuario en preparación para el
dominio `kpsula.app` (no comprado todavía, pero decidido).

### 30.1 Lo que SÍ se cambió

10 archivos editados:

| Archivo | Cambio |
|---|---|
| `src/components/ui/CapsulaLogo.tsx` | Wordmark "CÁPSULA" → "KPSULA" |
| `src/components/layout/Navbar.tsx` | Texto del header |
| `src/components/layout/HelpPanel.tsx` | Title + footer |
| `src/components/layout/NotificationBell.tsx` | Footer "KPSULA · Alertas..." |
| `src/components/marketing/AuroraNav.tsx` y `AuroraFooter.tsx` | aria-label + copyright |
| `src/config/branding.ts` | name='KPSULA', taglineShort, domain='kpsula.app' |
| `src/hooks/useBranding.ts` | Default tenant slug 'capsula' → 'kpsula' |
| `src/app/layout.tsx` | Meta title + keywords |
| `src/config/social-brand.ts` | Hashtags, handles, URLs, copy |

### 30.2 Lo que NO se cambió (intencional)

- **Tokens CSS** `bg-capsula-navy`, `text-capsula-ink`, `border-capsula-line`,
  etc. (~500 referencias en todo el codebase). Refactor masivo sin valor
  visible para el usuario. Son nombres internos del sistema de diseño.
- **localStorage keys** `capsula-sidebar-v1`, `capsula_dismissed_stock_alerts`.
  Cambiarlas haría que users pierdan estado de UI guardado.
  (Nota: en PR #89 sí se migró a `kpsula-sidebar-v2` en sessionStorage,
  pero por otra razón — ver §32.)
- **Identificador exportado** `CAPSULA_BRAND` en `branding.ts`.
  Importado en muchos archivos; renombrarlo no aporta nada visible.
- **`package.json` name** `shanklish-erp`. No es 'capsula'.

Filosofía: la marca visible cambia a KPSULA pero los tokens técnicos
internos siguen siendo `capsula-*` (igual que Twitter mantiene clases
`tw-*` aunque ahora sea X).

---

## 31. Dashboard unificado — absorbe /dashboard/estadisticas (2026-05-09)

PRs #87 (additive) y #88 (destructivo). El usuario notó que Dashboard
y Estadísticas tenían 40-50% de solapamiento en KPIs (ventas hoy,
órdenes, ticket promedio, cuentas abiertas, top productos, stock bajo,
anulaciones).

### 31.1 Decisión arquitectónica

Fusionar TODO en `/dashboard` (la URL raíz). Eliminar
`/dashboard/estadisticas`. Razón: la URL `/dashboard` es el destino
natural; el sidebar queda más limpio con un solo ítem "Inicio".

### 31.2 PR #87 — additive

Nuevo componente `src/components/dashboard/RoleBasedSections.tsx` con 4
vistas según rol:

- `AdminView` (OWNER, ADMIN_MANAGER): métodos de pago, top productos,
  descuentos, anulaciones.
- `OpsView` (OPS_MANAGER, AREA_LEAD): métodos pago + top productos
  compactos.
- `ChefView` (CHEF, KITCHEN_CHEF): KPIs cocina, pedidos pendientes,
  producción del día.
- `AuditorView` (AUDITOR): KPIs auditoría, descuentos, anulaciones,
  ajustes.

CASHIER y WAITER no ven el RoleBasedSections (siguen redirigidos al POS
desde la page principal).

`/dashboard/page.tsx` importa `getEstadisticasAction()` adicional y
renderiza `<RoleBasedSections>` entre Stats Grid y Low Stock Alert
Table.

Estilo: Minimal Navy (tokens capsula-*, 4 tonos sutiles
ok/warn/danger/info, sin emojis en chrome, font-semibold).

### 31.3 PR #88 — destructivo

- `src/app/dashboard/estadisticas/page.tsx` → 16 líneas con
  `redirect('/dashboard')`. Bookmarks externos siguen funcionando.
- `src/components/layout/Sidebar.tsx` → eliminado item
  `'estadisticas'` del grupo Operations.
- `src/app/dashboard/page.tsx` → eliminado QuickAction "Estadísticas"
  + import TrendingUp.

Stats neto: −666 líneas (page de estadísticas) + 14 líneas (redirect).
Limpieza ~650 líneas.

`modules-registry.ts` mantiene la entrada del módulo `estadisticas`
como código muerto (no estorba; auditarlo en limpieza separada).

---

## 32. Sidebar + Home + Navbar icon (2026-05-09)

Paquete de UX: launchpad role-based + sidebar siempre cerrado.

### 32.1 Sidebar siempre cerrado al login (PR #89)

Bug: los subgrupos del sidebar (sg-inventario, sg-produccion, etc.) se
abrían solos al iniciar sesión y al navegar.

Causa: un `useEffect` (líneas 600-633 antes) auto-expandía la sección
y subgrupo del módulo activo cada vez que cambiaba la ruta.

Solución:

1. **Eliminado** el useEffect de auto-expand. El sidebar es 100%
   manual: solo el usuario abre subgrupos.
2. **localStorage → sessionStorage** para persistir state. Cada nuevo
   login arranca con todo cerrado (sessionStorage se limpia al cerrar
   navegador), pero durante la sesión activa conserva lo que el user
   abrió manualmente.
3. **Key migrada**: `'capsula-sidebar-v1'` → `'kpsula-sidebar-v2'`.
   `loadState()` también limpia la key legacy en localStorage para no
   acumular residuos.

### 32.2 Página /dashboard/home con atajos por rol (PR #90)

Nueva ruta tipo "launchpad" con 2-5 botones grandes según rol del
user. Diseño Minimal Navy.

Estructura:
- Saludo: "Hola, [nombre]" con nombre en `capsula-coral`.
- Subtítulo neutro: "Bienvenido a tu espacio" (sin nombrar el rol).
- Grid responsive (1 col mobile, 2 cols desktop) con cards-link.

Atajos por rol (matriz `SHORTCUTS_BY_ROLE`):

| Rol | Primary (grande) | Secundarios |
|---|---|---|
| OWNER, ADMIN_MANAGER | Dashboard ejecutivo | POS Restaurante, Inventario, Finanzas, Producción |
| OPS_MANAGER, AREA_LEAD | POS Restaurante | Inventario, Producción, Dashboard |
| CHEF, KITCHEN_CHEF | Comandera Cocina | Producción, Recetas |
| CASHIER | **Ir al POS** (gigante) | Control de Caja, Historial Ventas |
| WAITER | **POS Mesero** (gigante) | Vista Mesas |
| AUDITOR | Auditorías | Historial Ventas, Dashboard |

Botones marcados como `primary` ocupan `col-span-2` y son ~40% más
grandes (ícono 96px vs 56px, título text-3xl vs text-lg). Pensado para
cajeros/meseros: su botón principal es enorme y fácil de tocar en
tablet.

### 32.3 Ícono Home en navbar (PR #91)

Añadido `<Link href="/dashboard/home">` con ícono lucide `Home` en el
navbar, lado IZQUIERDO (después del hamburger mobile, antes del nombre
de usuario). Decisión de diseño: lado izquierdo comunica "navegación
principal" (vs lado derecho que tiene herramientas como notif, tema,
help).

### 32.4 Login redirige a /dashboard/home + POS para OWNER/ADMIN (PR #92)

Antes: tras login todos iban a `/dashboard` (Dashboard ejecutivo). El
home `/dashboard/home` era inalcanzable salvo via ícono navbar.

Ahora:

1. `login-form-client.tsx` redirige a `/dashboard/home` post-login.
2. `/dashboard/home/page.tsx` añadió guard CASHIER/WAITER → si llegan
   al home, los redirige a su primer módulo permitido (típicamente el
   POS). Comportamiento idéntico al de `/dashboard` antes — cajeros y
   meseros NO ven el home.
3. POS Restaurante añadido a los atajos de OWNER y ADMIN_MANAGER (5
   botones total, layout: Dashboard primary arriba + 2x2 grid).

Matriz post-login final:

| Rol | Aterriza en |
|---|---|
| OWNER, ADMIN_MANAGER | `/dashboard/home` (5 atajos) |
| OPS_MANAGER, AREA_LEAD | `/dashboard/home` (POS primary) |
| CHEF, KITCHEN_CHEF | `/dashboard/home` (Comandera primary) |
| AUDITOR | `/dashboard/home` (Auditorías primary) |
| CASHIER | `/dashboard/pos/restaurante` (auto-redirect) |
| WAITER | `/dashboard/pos/mesero` (auto-redirect) |

---

## 33. Fixes UI — contraste módulo Ventas + modales en Portal (2026-05-09)

### 33.1 Contraste módulo Ventas (PR #93)

Bug: el usuario reportó que los montos en `/dashboard/sales` no se
leen en vista clara. Causa: el módulo entero usaba tokens prohibidos
por el CLAUDE.md (`text-white`, `text-emerald-400`, `text-amber-400`,
`bg-gray-700`, `font-bold`, etc.) que funcionan solo en dark mode y
quedan invisibles o con bajo contraste en light.

424 líneas modificadas en 2 archivos:
- `src/app/dashboard/sales/page.tsx` (Historial Ventas + Z-Report).
- `src/app/dashboard/ventas/cargar/sales-entry-view.tsx` (Cargar Ventas).

Reemplazos sistemáticos aplicados con `sed`:

- `text-white` → `text-capsula-ink`.
- `text-gray-XXX` → `text-capsula-cream / ink-muted / ink-soft / ink`
  según el valor original.
- `text-emerald-XXX / green-XXX` → `text-[#2F6B4E] dark:text-[#6FB88F]` (tono ok).
- `text-amber-XXX / yellow-XXX` → `text-[#946A1C] dark:text-[#E8D9B8]` (tono warn).
- `text-red-XXX` → `text-[#B04A2E] dark:text-[#EFD2C8]` (tono danger).
- `text-blue/purple/indigo/violet/sky/cyan-XXX` → `text-[#2A4060] dark:text-[#D1DCE9]` (tono info).
- `text-pink/rose/orange-XXX` → `text-capsula-coral`.
- Backgrounds `bg-X-900` (badges payment methods) → tonos sutiles
  correspondientes con dark variant.
- CTAs: `bg-emerald-600 / amber-600` → `bg-capsula-navy-deep`.
  `bg-red-600` → `bg-capsula-coral`.
- `font-bold / font-black` → `font-semibold`.

Resultado: todos los montos y badges legibles en light y dark.

### 33.2 Modales en Portal (PR #94)

Dos bugs reportados:

1. Notificaciones: en desktop el panel se ve "muy hacia arriba" y se
   corta.
2. Resumen Financiero del Mes: al abrir detalle de Ventas/Gastos/etc.,
   la ventana emergente queda contenida dentro del recuadro padre y se
   recorta.

**Causa raíz común**: stacking context creado por padres con
propiedades que afectan `position: fixed`:

| Componente | Padre | Propiedad culpable |
|---|---|---|
| NotificationBell, HelpPanel | Navbar | `backdrop-blur-md` |
| FinancialSummaryWidget | `.capsula-card` | `transform: translateY(-1px)` en hover + `overflow: hidden` |

Cuando un ancestro tiene `transform`, `filter`, `backdrop-filter`,
`perspective`, `will-change` o `contain`, los descendientes con
`position: fixed` se posicionan **relativo a ese ancestro**, no al
viewport.

**Solución**: nuevo componente `<Portal>` (`src/components/ui/Portal.tsx`)
que usa `createPortal` de `react-dom` para renderizar children como hijo
directo de `document.body`, escapando de cualquier stacking context.

```typescript
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Portal({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(children, document.body);
}
```

Aplicado a `NotificationBell.tsx`, `HelpPanel.tsx`,
`FinancialSummaryWidget.tsx`. El modal de FinancialSummaryWidget también
migró su backdrop legacy `bg-black/70` → `bg-capsula-navy-deep/55
backdrop-blur-sm` (mismo patrón que los otros dos).

**Convención nueva**: cualquier modal o popover futuro que se renderice
desde dentro del Navbar, una `.capsula-card`, o cualquier otro
contenedor con backdrop-filter/transform/etc., DEBE envolverse con
`<Portal>` para garantizar que `position: fixed` se posicione relativo
al viewport.

---

## 34. PWA — KPSULA instalable en tablets (2026-05-09)

### 34.1 Por qué

Los mesoneros usan Redmi Pad 2 con el POS web. Quejas recurrentes: "se queda medio pegado", "tarda en cargar", "si pierdo WiFi se pierde la orden". La PWA resuelve los tres dolores con una sola pieza:

- App icon en home screen, abre instantánea (assets cacheados).
- Modo `standalone` — sin barra del navegador, pantalla completa.
- Cache del shell estático → arranque <1s.
- Cuando esté Fase 2.5 (background sync + IndexedDB) → órdenes en cola si pierde WiFi.

### 34.2 Piezas implementadas

| Archivo | Rol |
|---|---|
| `public/manifest.json` | Manifest del PWA: name "KPSULA ERP", short "KPSULA", `start_url: /dashboard`, `display: standalone`, theme/background `#1B2438` (navy deep), icons 192/512 + maskable, shortcuts a POS Restaurante / Mesero / Delivery. |
| `public/icons/*` | Iconos generados desde `public/brand/logo-icon-color.svg` con isotipo coral sobre fondo navy. Variantes: 192/512 any, 192/512 maskable (60% safe area), 180 apple-touch, 32/16 favicon. |
| `scripts/generate-pwa-icons.ts` | Script `tsx` para regenerar iconos cuando cambie el isotipo. Usa `sharp` (devDependency). |
| `public/sw.js` | Service Worker manual (~150 líneas, sin `next-pwa`). Estrategias:<br>– `_next/static/*` y assets estáticos → **cache-first inmutable**.<br>– HTML público → **network-first** con fallback a cache → fallback a `/offline`.<br>– HTML autenticado (`/dashboard/*`, `/kitchen/*`, `/maintenance`) → **network-only** (nunca cache, evita filtrar UI entre usuarios en tablets compartidas). Si offline → `/offline`.<br>– `/api/*` y métodos no-GET → bypass total.<br>– `CACHE_VERSION` `capsula-v1` para invalidar; cambia en cada release que toque el SW. |
| `src/components/pwa-register.tsx` | Componente cliente que registra el SW en producción, des-registra en dev. Detecta nuevas versiones (`updatefound`) y muestra toast persistente "Nueva versión disponible — Actualizar". Click → `postMessage SKIP_WAITING` → SW activa → `controllerchange` → `window.location.reload()`. |
| `src/app/layout.tsx` | Añade `metadata.manifest`, `metadata.appleWebApp` (capable + black-translucent, title "KPSULA"), `metadata.icons.apple`, y `viewport.themeColor` con variantes light (`#F7F5F0`) / dark (`#1B2438`). Inserta `<PWARegister />` al final del body. |
| `src/app/offline/page.tsx` | Página servida cuando el usuario navega sin red y la página solicitada no está en cache. Diseño Minimal Navy (light + dark), sin dependencias dinámicas. Pre-cacheada en SW install. |

### 34.3 Cómo instalar en una tablet (instrucciones para el operador)

1. Abrir Chrome en la Redmi Pad 2.
2. Visitar `https://capsula-erp.onrender.com` (o el dominio del cliente).
3. Iniciar sesión normalmente.
4. Menú de tres puntos → **"Instalar app"** o **"Agregar a la pantalla de inicio"**.
5. Confirmar. Aparece icono "KPSULA" en el home.
6. Tap al icono → abre en standalone (sin barra Chrome).
7. La primera vez carga normal; las siguientes son cuasi-instantáneas (assets cacheados).

### 34.4 Pendiente para Fase 2.5 (no implementado todavía)

- **IndexedDB queue de órdenes**: si el mesonero envía orden sin red, queda en cola local y se sube al volver señal.
- **Background Sync API**: dispara la sincronización automática.
- **Optimistic UI**: al tocar "Enviar", la orden aparece como aceptada inmediatamente; el backend confirma atrás.
- **TWA wrapper para generar APK**: distribuible por link sin Chrome.
- **Tenant-aware manifest**: cada cliente con su propia marca en el icono y nombre (multi-tenant Fase 3).

### 34.5 Versionar el SW

Cada vez que se modifique `public/sw.js` o se quiera forzar un re-cache, **incrementar `CACHE_VERSION`** en el archivo. El próximo `fetch` desde el cliente detecta el nuevo SW, lo instala, y la próxima carga muestra el toast "Actualizar". El usuario hace click una vez y queda con la versión nueva.

Tests: 81/81 ✓ — `tsc --noEmit` exit 0 — `next build` ok (offline page ○ static, 168B).

---

## 35. Multi-tenant — Fase 2.B aplicada + Fase 3 Pasos A y B (2026-05-11)

Sesión de avance multi-tenant ejecutada con restaurante cerrado y backup
de BD confirmado (`capsula_erp_prod-20260511-0700.dump`, 4.7 MB). Cero
incidentes operativos, cero downtime.

### 35.1 Step 1 (PR #105) — `findUnique → findFirst` preparatorio

Antes de cambiar el schema, refactor de código que dependía del unique
global single-column. Cero riesgo BD (solo cambio de método de query;
mismo `where`, mismo comportamiento mientras hay un solo tenant).

Hits refactorizados (4):
- `src/app/actions/user.actions.ts:388` (`User.email`)
- `src/app/actions/user.actions.ts:466` (`User.email`)
- `src/app/actions/sku-studio.actions.ts:211` (`InventoryItem.sku`)
- `src/app/actions/asistente.actions.ts:55` (`InventoryItem.sku`)

El `upsert` sobre `InvoiceCounter.channel` quedó intacto en Step 1 —
hacer findFirst+create/update rompía atomicidad. Se refactorizó en
Step 2 con el `where: { tenantId_channel: { tenantId, channel } }`
compuesto.

### 35.2 Step 2 (PR #107) — Schema migration: uniques compuestos

20 fields pasaron de `@unique` global a `@@unique([tenantId, X])`:

```
User.email                  InventoryItem.sku         MenuItem.sku
ProductionOrder.orderNumber ProteinProcessing.code    Requisition.code
SalesOrder.orderNumber      Supplier.code             PurchaseOrder.orderNumber
ExpenseCategory.name        Branch.code               OpenTab.tabCode
InvoiceCounter.channel      GameType.code             GameStation.code
WristbandPlan.code          Reservation.code          GameSession.code
ProductFamily.code          InventoryCycle.code
```

Quedan globales (intencional, documentado en migration.sql):
- `Tenant.slug` — global por diseño
- `IntercompanySettlement.code` — su modelo no es tenant-aware
- `GameSession.reservationId` — relación 1:1 con Reservation, id ya
  único globalmente; Prisma requiere `@unique` directo en field de FK
  1:1
- `RateLimitBucket.[key, windowStart]` — modelo no es tenant-aware

**Migración:** `prisma/migrations/20260511130500_multitenant_2b_composite_uniques/`.

Patrón por field (defensivo, idempotente):
```sql
ALTER TABLE "X" DROP CONSTRAINT IF EXISTS "X_field_key";
DROP INDEX IF EXISTS "X_field_key";
CREATE UNIQUE INDEX "X_tenantId_field_key" ON "X"("tenantId", "field");
```

Razón del doble DROP: en Postgres un `@unique` Prisma puede ser
constraint o index puro según la migration que lo creó. ALTER TABLE
DROP CONSTRAINT IF EXISTS cubre constraints; DROP INDEX IF EXISTS
cubre índices puros. Idempotente — la que no aplique es no-op.

**Auditoría pre-merge (6 vectores verificados):**
1. ✅ Uniques actuales son INDEX puros (verificado en migration
   `20260315200000_pos_restaurante_completo`)
2. ✅ Cero FKs no-id que referencien estos campos
3. ✅ Cero `$queryRaw`/`$executeRaw` en `src/` que dependa de nombres
   de índices
4. ✅ `Supplier.code` nullable: Postgres permite múltiples NULL en
   uniques compuestos (igual que en single-col)
5. ✅ Solo 1 tenant en BD → imposible que el composite tenga
   colisiones con datos existentes
6. ✅ DDL atómico en una sola transacción de `prisma migrate deploy`.
   Postgres no expone estado intermedio

**Cambio acompañante de código:** `src/lib/invoice-counter.ts`:
```typescript
// Antes
tx.invoiceCounter.upsert({
  where:  { channel },
  update: { lastValue: { increment: 1 } },
  create: { channel, lastValue: 101 },
});

// Ahora
tx.invoiceCounter.upsert({
  where:  { tenantId_channel: { tenantId, channel } },
  update: { lastValue: { increment: 1 } },
  create: { tenantId, channel, lastValue: 101 },
});
```

Firma de `getNextCorrelativo(channel, tenantId = FALLBACK_TENANT_ID)`.
Mantiene atomicidad del unique constraint (no degradado a
findFirst+create/update).

**Verificación post-deploy (consulta sobre BD productiva):**
```sql
SELECT indexname FROM pg_indexes
WHERE schemaname='public'
  AND (indexname LIKE '%_tenantId_%_key' OR indexname IN
       ('User_email_key','InventoryItem_sku_key','MenuItem_sku_key',
        'Branch_code_key','OpenTab_tabCode_key'))
ORDER BY indexname;
```

Resultado confirmado: 20 índices `_tenantId_X_key`, cero rastro de los
viejos. Sitio respondiendo normal.

### 35.3 Paso A (PR #108) — `tenantId` en JWT

Añadido a `SessionPayload`:
```typescript
/**
 * ID del tenant al que pertenece el usuario. Opcional para
 * compatibilidad con JWTs emitidos antes de Fase 3 — esos caen al
 * fallback Shanklish vía resolveTenantContext().
 */
tenantId?: string;
```

En `auth.actions.ts`, el `select` del login ahora incluye `tenantId` y
lo pasa a `createSession`. JWTs viejos sin el campo siguen funcionando
— al expirar (24h) se renuevan con el campo poblado.

Cero cambio de comportamiento runtime: nadie llama a
`resolveTenantContext()` todavía, así que el JWT solo lleva info
adicional.

### 35.4 Paso B (PR #109) — Hardening del host parser

Bug latente detectado: `extractTenantSlugFromHost('capsula-erp.vercel.app')`
devolvía `'capsula-erp'`. Cuando se active Fase 3 plena, eso buscaría
un tenant slug 'capsula-erp' en BD → fallback Shanklish. No rompía
nada (la función no se llama en runtime), pero conceptualmente sucio.

Fix: ahora solo extrae si el host termina exactamente en
`.kpsula.app`. Cualquier otro host (Vercel preview, localhost,
example.com, IPs) → `null`.

```typescript
const TENANT_ROOT_DOMAIN = 'kpsula.app';

export function extractTenantSlugFromHost(host) {
  // ...
  if (!hostNoPort.endsWith('.' + TENANT_ROOT_DOMAIN)) return null;
  // ...
}
```

3 tests nuevos: 116/116 ✓ (antes 113):
- `capsula-erp.vercel.app` / preview domains → null
- `example.com` / `attacker.evil.com` → null
- IPs raw → null
- `staging.kpsula.app` → `'staging'` (multi-nivel toma primera label)
- `shanklish.staging.kpsula.app` → `'shanklish'`

### 35.5 Estado al cierre de la sesión

**Schema y BD:** ✅
- Tabla Tenant con 1 fila (Shanklish)
- 42 modelos con `tenantId NOT NULL DEFAULT 'tnt_shanklish_caracas'`
- 20 uniques compuestos `(tenantId, X)` verificados en producción

**Código preparatorio:** ✅
- `findUnique → findFirst` en hits críticos
- `upsert` de invoice-counter usa unique compuesto
- JWT lleva `tenantId` en sesiones nuevas
- Host parser robusto contra hosts no-kpsula

**Dormante (no se importa en runtime):** ✅
- `src/lib/tenant-context.ts` (puro)
- `src/lib/tenant-context.server.ts` (server-only, usa Prisma)
- `src/lib/define-action.ts` (wrapper para actions)
- `src/lib/prisma-tenant-client.ts` (extension `withTenant()`)

### 35.6 Pendientes para próximas sesiones

**Paso C — Middleware passive subdomain (~15 min, riesgo bajo pero
blast radius alto)**
- `middleware.ts` extrae slug del host → lo pasa como header
  `x-tenant-slug` al downstream
- Server actions/components no leen el header todavía → cero impacto
- Requiere ventana de mantenimiento por safety (cambio en middleware =
  todo el sitio depende de él)

**Paso D — Activar `resolveTenantContext()` en actions críticas**
- Empezar por una action piloto (e.g., `getOpenTabsAction`)
- Si pasa una semana sin incidentes, migrar más
- Esto sí cambia comportamiento: las queries empiezan a filtrar por
  tenantId explícito (aunque sigue siendo Shanklish para todos)

**Paso E — Cliente Prisma extendido (`withTenant(tenant.id)`)**
- Reemplazar `prisma` por `withTenant(ctx.tenantId)` en actions
  migradas
- Inyecta `tenantId` automáticamente en `findMany/findFirst/create/etc.`

**Signup self-service + panel SUPER_ADMIN (~2-3 h)**
- `/signup` para crear nuevo tenant + owner
- `/admin/tenants` para listar/desactivar
- Bootstrap mínimo de un tenant nuevo (sucursal, áreas, zonas
  default)

**DNS wildcard `*.kpsula.app`** ← trabajo del usuario en GoDaddy/
Cloudflare. Documento en `docs/VPS_MIGRATION_PLAN.md`.

**Auditoría credenciales** — comando para SSH al VPS:
```bash
cd /var/www/capsula-erp && npx tsx scripts/audit-credentials.ts
```
Detecta passwords plain-text. 5 min, solo lectura.

### 35.7 Referencias

- PR #105: refactor findFirst preparatorio
- PR #107: schema migration uniques compuestos
- PR #108: tenantId en JWT
- PR #109: hardening host parser
- `prisma/migrations/20260511130500_multitenant_2b_composite_uniques/migration.sql`
- `src/lib/tenant-context.ts` (función pura, 12 tests)
- `src/lib/auth.ts` (`SessionPayload.tenantId?`)

---

## 36. Auditoría de credenciales y auto-rehash silencioso (2026-05-11)

Cierre de la deuda pendiente de §29 (hardening auth): correr el script
`scripts/audit-credentials.ts` contra producción y resolver hallazgos.

### 36.1 Setup del audit en el VPS

El VPS Contabo (`/var/www/capsula-erp`) tiene un build standalone de
Next, no un clone git completo, así que el script no estaba allí.
Procedimiento usado:

```bash
cd /var/www/capsula-erp && \
  mkdir -p scripts && \
  wget -q https://raw.githubusercontent.com/Juninho2604/capsula-erp/main/scripts/audit-credentials.ts \
    -O scripts/audit-credentials.ts && \
  set -a && source .env && set +a && \
  npx tsx scripts/audit-credentials.ts
```

**Trampa detectada:** el `.env` del proyecto (`/var/www/capsula-erp/.env`)
apunta a la BD staging `capsula_db:5432` (vacía), NO a la productiva
`capsula_erp_prod:5433`. El script corrió contra staging y reportó
"4 users totales / 1 plain-text" engañosamente. La app en pm2 tiene
su DATABASE_URL en otro lado (probablemente ecosystem.config.js).

Para auditar realmente la BD productiva, se usó SQL directo:

```bash
sudo -u postgres psql -p 5433 capsula_erp_prod -c "
  SELECT substring(id, 1, 8) AS id_prefix, email, \"isActive\"
  FROM \"User\"
  WHERE \"passwordHash\" IS NOT NULL
    AND \"passwordHash\" !~ '^[0-9a-f]{32}:[0-9a-f]{64}\$';
"
```

### 36.2 Hallazgos sobre BD productiva

**17 users con password en plain-text** (todos creados el 2026-01-27
salvo `admin@shanklish.com` que es 2026-03-26):

```
karina, admin, carlos, cocina, christian, maurizio, david, nour,
victor, cajera1, cajera2, oscar, hadkin, ramiro, miguel (inactivo),
nahomy, omar — todos @shanklish.com
```

El sistema seguía funcionando porque `verifyPassword`
(`src/lib/password.ts:62-71`) tiene fallback retrocompatible: si el
`stored` no contiene `:`, compara texto plano con `timingSafeEqualString`
(constant-time). Esto era deuda de seguridad — un dump de BD revelaría
todas las contraseñas en claro.

Waiters: ✅ 6 totales, 4 con PIN hasheado, 2 sin PIN (capitanes), 0
plain-text, 0 PINs duplicados entre waiters del mismo branch.

### 36.3 Solución — auto-rehash silencioso (PR #111)

En lugar de forzar password resets (disruptivo) o rehashear
manualmente desde script (requiere saber los plain-text, lo que es
exactamente la deuda que queremos cerrar), el fix es **transparente**:

En `loginAction` (`src/app/actions/auth.actions.ts`), después de
`verifyPassword` exitoso, si el `passwordHash` almacenado NO contiene
`:` (es plain-text legacy), se re-hashea con `hashPassword(password)`
y se persiste. El password en claro se conoce solo durante esa
request (acabamos de validarlo), así que podemos derivar el hash
correcto.

```typescript
if (user.passwordHash && !user.passwordHash.includes(':')) {
    try {
        const rehashed = await hashPassword(password);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: rehashed },
        });
    } catch (err) {
        console.error('[auto-rehash] failed for user', user.id, err);
        // No interrumpe el login (best-effort).
    }
}
```

Características:
- **Cero disrupción**: el user no nota nada, su login ya fue exitoso.
- **Best-effort**: si la `update` falla (BD ocupada, etc.) no
  interrumpimos el login. Se reintentará en el próximo login.
- **Sin riesgo de timing leak**: el bloque corre solo en el path
  exitoso, después de validar credenciales.
- **Auto-cierra la deuda**: a medida que cada user activo se loguea,
  su row se actualiza a PBKDF2. La deuda se diluye solo.

### 36.4 Verificación pendiente (3-5 días tras merge)

Re-correr la query para confirmar que los plain-text bajaron:

```bash
sudo -u postgres psql -p 5433 capsula_erp_prod -c "
  SELECT count(*) AS users_plain_text_restantes
  FROM \"User\"
  WHERE \"passwordHash\" IS NOT NULL
    AND \"passwordHash\" !~ '^[0-9a-f]{32}:[0-9a-f]{64}\$';
"
```

Expectativa: baja de 17 → ~1 (solo `miguel@shanklish.com` que está
`isActive=false`). Cuando se reactive, rotación manual de su password.

### 36.5 Lecciones aprendidas

1. **El `.env` del repo en el VPS es de staging, no de producción.**
   La app en pm2 usa otra fuente para DATABASE_URL. Anotar para
   próxima sesión: si se quiere correr un script contra producción
   desde VPS, hay que setear DATABASE_URL explícitamente con la URL
   correcta o leer del ecosystem de pm2.

2. **El script `audit-credentials.ts` tiene drift de schema** —
   intenta `select pin` con un Prisma client del VPS que tiene
   schema viejo. Actualizar el script o regenerar el client del VPS
   antes de ejecutarlo. Para auditoría puntual, SQL directo es más
   confiable.

3. **`verifyPassword` con fallback plain-text es una superficie de
   ataque silenciosa.** Útil para no romper logins históricos, pero
   conviene drenarlo cuanto antes. Eventualmente (cuando se confirme
   que no quedan plain-text), eliminar la rama de retrocompat de
   `password.ts:63-66` y forzar formato PBKDF2.

### 36.6 Referencias

- PR #111: auto-rehash silencioso
- `src/lib/password.ts` (fallback retrocompat — documentar deprecación
  futura)
- `scripts/audit-credentials.ts` (necesita actualización a schema
  actual)

---

## 37. PWA Nivel 1 — fundación cache offline (2026-05-11)

### 37.1 Contexto

Continuación de §34 (PWA instalable). Los mesoneros se quejan de "se queda medio pegado" y "se pierde la orden si cae el WiFi". Esta fase entrega la **fundación** del cache offline (Nivel 1 — lectura): IndexedDB, detector de red real, banner global y guard de mutaciones. La integración a cada POS (Mesero, Restaurante, Pickup, Delivery) viene en commits siguientes.

Niveles definidos en sesión:
- **Nivel 0** (§34) — instalable + shell cacheado + página offline. ✓
- **Nivel 1** (esta fase) — leer datos cacheados sin red; mutaciones bloqueadas con toast. ✓ fundación.
- **Nivel 2** (futuro) — cola de mutaciones con Background Sync. Pospuesto: el modelo Edge (mini PC) lo hace redundante in-restaurante.

### 37.2 Piezas implementadas

| Archivo | Rol |
|---|---|
| `src/lib/offline-cache/db.ts` | IndexedDB schema (DB `kpsula-offline` v1) con 5 object stores: `menu`, `layout`, `tabs`, `config`, `cart`. Cada registro tiene `cachedAt: number`. Conexión singleton. Migración aditiva (nunca borra stores existentes). Helpers `readCache`, `writeCache`, `clearAllCaches`. |
| `src/lib/offline-cache/network-status.ts` | Detector de conectividad real (no solo `navigator.onLine`). Combina `navigator.onLine` + ping activo a `/api/health` (timeout 4s) + polling cada 30s. **Threshold de 2 fallos consecutivos** antes de marcar offline para no oscilar con blips de 1-2s. Mini event emitter para hooks React. |
| `src/lib/offline-cache/menu-cache.ts` | `saveMenuCache(menu)` / `loadMenuCache()`. Una sola entrada `id='current'`. |
| `src/lib/offline-cache/layout-cache.ts` | Idem para layout (zonas + mesas). |
| `src/lib/offline-cache/tabs-cache.ts` | Snapshot de tabs/mesas abiertas `id='active'`. Stale-aware (`cachedAt` se usa para mostrar "actualizado hace X min"). |
| `src/lib/offline-cache/cart-cache.ts` | Carrito persistente por contexto: `tabId` / `pickup-${id}` / `delivery-${id}`. Operaciones: `saveCart`, `loadCart`, `deleteCart`, `listCarts`. Caso clave: mesonero en mesa 25 sin WiFi anota 5 ítems → al volver red presiona "Enviar" y se mandan todos. |
| `src/lib/offline-cache/index.ts` | Barrel export. Importar desde `@/lib/offline-cache`. |
| `src/hooks/use-online-status.ts` | Hook React `useOnlineStatus()` → `{ state: 'online'\|'offline'\|'unknown', sinceOffline: number\|null }`. Arranca el monitor global (idempotente, una sola instancia). |
| `src/hooks/use-offline-guard.ts` | Hook `useOfflineGuard()` → `{ guardMutation, isOffline }`. `guardMutation(fn, { blockedMessage })` ejecuta `fn` solo si online; si offline muestra toast y devuelve undefined. Para deshabilitar botones preventivamente, usar `isOffline`. |
| `src/components/offline-banner.tsx` | Banner global. Cinta amarilla persistente "Sin conexión — modo lectura" cuando offline. Al reconectar muestra cinta verde "Conexión restaurada" durante 3s. Usa los 4 tonos sutiles autorizados (warn + ok) de CLAUDE.md §3. z-[80] para quedar arriba de modales POS (z-[60]) y BellPanel (z-[70]). |
| `src/app/dashboard/layout.tsx` | Monta `<OfflineBanner />` al inicio para que cubra todas las rutas autenticadas. |

### 37.3 Tests

- `src/lib/offline-cache/network-status.test.ts` — 7 tests. Cubre máquina de estados: navigator.onLine=false → offline inmediato; ping 200 → online; falla 1 → mantiene estado; falla 2 → offline; recover resetea contador; listener recibe transiciones; mismo estado consecutivo no notifica dos veces.
- `src/lib/offline-cache/db.test.ts` — 10 tests con `fake-indexeddb`. Roundtrip de read/write, cache vacío, helpers específicos (menú/layout/tabs/cart), `deleteCart`, `listCarts`, `clearAllCaches`, `cachedAt` correcto.
- **Total fase 1 + repo**: 133/133 ✓ — `tsc --noEmit` exit 0 — `next build` ok.

### 37.4 Pendientes Fase 1.B (siguientes commits)

Aplicar el patrón a cada POS:
1. **POS Mesero** ✅ — integrado en §37.5.
2. **POS Restaurante** — pendiente.
3. **POS Pickup** — vive dentro de restaurante hoy.
4. **POS Delivery** — más datos (clientes), pero mismo patrón.

Cada POS necesita 4 cosas:
- `loadXxxCache()` al mount, luego fetch fresh online y actualizar el cache.
- Banner inline cuando se sirva desde cache: "actualizado hace X min".
- Persistir el carrito en cada cambio.
- Envolver botones de mutación con `useOfflineGuard().guardMutation` y deshabilitar visualmente con `isOffline`.

### 37.5 POS Mesero — integrado al cache offline (2026-05-11)

Primer POS aplicando la fundación de §37.2.

**Archivo tocado:** `src/app/dashboard/pos/mesero/page.tsx`

**Cambios:**

1. **`loadData` reescrita como offline-first** (líneas ~260-340):
   - Hidrata desde IndexedDB inmediatamente (UI usable en <100ms aunque el server tarde).
   - Dispara fetch al server en paralelo. Si llega → reemplaza el estado y persiste el nuevo cache (`saveMenuCache`, `saveLayoutCache`).
   - Si el fetch falla y hay cache → mantiene el estado cacheado, set `cacheStaleAt` con el timestamp.
   - Si el fetch falla y NO hay cache → `setLayoutError("Sin conexión y sin datos en caché")`.

2. **Estado `cacheStaleAt: number | null`** indica si la UI muestra datos cacheados. Se limpia en el siguiente fetch exitoso.

3. **Banner inline "Mostrando datos en caché · actualizados hace X min"** justo debajo del header (tono info `#E6ECF4`/`#1A2636`). Diferente del banner global amarillo (red caída) — este informa antigüedad del dato concreto.

4. **Carrito persistente por `tabId`** vía dos `useEffect`:
   - Al cambiar `activeTab.id`: rehidrata el carrito desde `loadCart(tabId)`. Solo si el carrito local está vacío — para no machacar lo que el mesero ya tipeó en pantalla.
   - En cada cambio de `cart`: si tiene ítems → `saveCart(tabId, cart)`; si está vacío → `deleteCart(tabId)`.
   - Caso clave validado: mesero en mesa 25 sin WiFi anota 5 ítems → app se cierra → al reabrir y entrar a la mesa, los 5 ítems siguen ahí.

5. **`handleSendToTab` envuelto en `guardMutation`** con mensaje específico: "Sin conexión. La orden quedó en el carrito local; se enviará cuando vuelva la señal." Tras éxito, `deleteCart(tabId)` limpia el cache persistido.

6. **Botón "Enviar a cocina" visualmente deshabilitado con `isOffline`**, texto cambia a "Sin conexión · $X" + tooltip explicativo. El carrito sigue agregándose normal (queda persistido) — solo bloqueamos el envío al servidor.

**Comportamiento end-to-end ahora:**

| Situación | Antes (sin cache) | Ahora |
|---|---|---|
| Abre POS con WiFi malo | Spinner 5-10s, frustración | UI usable en <100ms desde cache, server se sincroniza atrás |
| Pierde WiFi mid-servicio | Toda la pantalla deja de responder | Banner amarillo arriba + banner azul "datos en caché". Sigue navegando |
| Agrega ítems offline | Toast genérico de error | Los agrega al carrito local. Botón dice "Sin conexión · $X" |
| App se cierra con ítems offline | Pierde todo | Al volver y entrar a la mesa, ítems siguen ahí |
| Vuelve WiFi y toca "Enviar" | — | Manda todos los ítems acumulados de una |

**Pendiente para Fase 1.C:**
- POS Restaurante (mismo patrón).
- POS Pickup (pickup tabs viven en `restaurante/page.tsx` actualmente; se cubre con el item anterior).
- POS Delivery (necesita cachear lista de clientes/direcciones adicional al menú/layout).

### 37.6 Hotfix — "Application error: client-side exception" al apagar WiFi (2026-05-12)

Al probar §37.5 en la tablet, apagar el WiFi disparaba pantalla blanca **"Application error: a client-side exception has occurred"**. Causa raíz: `pollLayout` (cada 5s) y `refreshSubAccounts` invocaban server actions sin `try/catch`. Cuando la red caía, la promesa rechazada subía al error boundary de Next.js y reventaba la pantalla.

**Fixes aplicados:**

1. **`pollLayout` en POS Mesero y Restaurante**: envuelto en `try/catch`. En el camino exitoso, Mesero aprovecha para refrescar `saveLayoutCache(nextLayout)` y limpiar `cacheStaleAt` — así el cache offline siempre tiene el snapshot más reciente sin reload manual.

2. **`refreshSubAccounts` en POS Mesero**: envuelto en `try/catch`. Devuelve `[]` cuando falla en lugar de propagar.

3. **Defensa global en `<OfflineBanner />`** (`src/components/offline-banner.tsx`): registra listeners `unhandledrejection` y `error` en `window`. Si el mensaje matchea `NETWORK_ERROR_PATTERNS` (`failed to fetch`, `network error`, `load failed`, `the operation was aborted`, `err_internet_disconnected`, etc.) → `event.preventDefault()`. **No suprime errores reales de lógica** porque filtra por patrón de mensaje. Esta defensa cubre cualquier fetch sin `try/catch` en otros componentes del dashboard durante offline (panels, BellPanel, POS futuros) sin tener que auditarlos uno por uno.

**Regla de arquitectura nueva:**
Cualquier código cliente que invoque server actions o `fetch` en background (polling, refreshes, useEffect, etc.) **debe** estar envuelto en `try/catch`. La defensa global de OfflineBanner es safety net, no excusa para no manejar errores. Para código nuevo: si llamas a una `*Action()` fuera de un `onClick`/`onSubmit`, envuelve.

### 37.7 PWA auto-update silencioso (2026-05-12)

**Problema:** El hotfix de §37.6 estaba en producción pero la tablet seguía viendo el bug porque el Service Worker servía el JS viejo cacheado. El flujo viejo de actualización (de §34 / PR #100) mostraba un toast "Nueva versión disponible — Actualizar" que el usuario tenía que tocar manualmente. En el POS este toast se pierde detrás de la cinta de "sin conexión" o cualquier modal, y el mesonero no entiende de Service Workers. Resultado: deploys nuevos nunca llegaban a las tablets en uso.

**Solución (`src/components/pwa-register.tsx` reescrito):**

1. **Auto-skip-waiting silencioso**: cuando `updatefound` detecta una versión nueva y se instala (`state === 'installed'`) **con `navigator.serviceWorker.controller` existente** (es decir, es un UPDATE, no la primera instalación), envía `SKIP_WAITING` inmediatamente sin prompt.

2. **Reload con ventana de seguridad**: en lugar de `window.location.reload()` inmediato en `controllerchange`, llamamos `reloadWhenSafe()` que solo recarga cuando:
   - No hay input/textarea/contenteditable focuseado (mesero no está tipeando).
   - No hay `[role="dialog"]` ni `[data-state="open"]` (no hay modal abierto).
   - Si no es seguro, reintenta cada 5s hasta 60s máximo.

3. **El carrito está persistido** en IndexedDB (§37.5), así que aunque hubiera un reload mid-orden el contexto se restaura al volver a la mesa.

4. **Chequeo periódico cada 60 min** mediante `reg.update()` — útil para tablets que se quedan encendidas todo el servicio sin recargar la página.

5. **Sin import de `react-hot-toast`** ni `useRef` — código más simple, sin UI de prompt.

6. **`CACHE_VERSION` bumped a `capsula-v2`** en `public/sw.js` — fuerza la instalación del SW nuevo en todas las tablets al recargar (gracias al `updateViaCache: 'none'` que ya teníamos).

**Resultado:** desde este deploy en adelante, cualquier hotfix se aplica automáticamente:
1. Vercel deploya nuevo bundle.
2. Tablet abre la app (o ya está abierta).
3. El SW chequea actualizaciones (al cargar, cada hora, o cuando el usuario fuerza refresh).
4. Detecta versión nueva → instala en background → auto-skip-waiting → controllerchange → reload silencioso (cuando es seguro).
5. Usuario ve la app refrescarse sola sin saber que hubo un deploy.

Trade-off aceptado: el primer reload tras este merge ocurrirá la próxima vez que cada tablet abra la app. Después de eso, transparente.

### 37.8 Hardening — supresor global en root + global-error.tsx + WaiterIdentification (2026-05-12)

**Síntoma:** Tras §37.6 y §37.7 el usuario seguía viendo "Application error: a client-side exception has occurred" al apagar WiFi. Causas adicionales identificadas:

1. **El supresor global de errores vivía en `<OfflineBanner />`**, que se monta dentro de `dashboard/layout.tsx`. Si una ruta hija (POS Mesero, etc.) crashea durante el primer paint **antes** que el banner ejecute su `useEffect`, los listeners no estaban activos y el error reventaba.

2. **`WaiterIdentification.tsx`** invocaba `getActiveWaitersAction()` en un `useEffect` IIFE sin try/catch. Componente que monta en el POS Mesero al cargar — si offline, throw inmediato.

3. **No había `global-error.tsx`**, así que el fallback era la pantalla blanca por defecto de Next.js con texto técnico que el mesonero no entiende.

**Fixes:**

1. **`src/components/network-error-suppressor.tsx`** — extraído del `OfflineBanner`. Componente sin UI que solo registra listeners. Patrones ampliados a `err_name_not_resolved`, `unexpected end of json`, `not valid json`, `unexpected token .* in json` (para cubrir el caso donde el SW devuelve HTML offline al server action y el cliente intenta parsearlo como JSON).

2. **Montado en `src/app/layout.tsx` (root)**, dentro del `<body>` antes del `ThemeProvider`. Así los listeners están activos antes que cualquier ruta hija renderice.

3. **`OfflineBanner` simplificado**: solo UI del banner. El handler global se removió de allí (referencia comentada en el JSDoc del archivo).

4. **`WaiterIdentification`**: el `useEffect` ahora envuelve `getActiveWaitersAction()` en `try/catch/finally`. Lista vacía si falla, `setIsLoading(false)` siempre.

5. **`src/app/global-error.tsx`**: nuevo. Reemplaza la pantalla blanca de Next.js con una página branded Minimal Navy: icono triangle alert coral, "Algo salió mal", botón **Reintentar** (usa el `reset()` que Next.js inyecta para re-renderizar sin recargar), botón secundario **Recargar completamente** (`window.location.reload()`). Muestra `error.digest` para soporte. Self-contained con estilos inline (no depende de globals.css ni Tailwind por si el problema vino de assets).

6. **`CACHE_VERSION` bumped a `capsula-v3`** en `public/sw.js` — fuerza la instalación del SW nuevo.

**Auditoría pendiente:** otros archivos identificados con `useEffect` que invocan `*Action()` sin try/catch (cubiertos por el supresor global pero conviene endurecer en futuras iteraciones):
- `src/app/dashboard/pos/restaurante/page.tsx` (más fetches)
- `src/app/dashboard/pos/delivery/page.tsx`
- `src/app/dashboard/pos/pedidosya/page.tsx`

El supresor global sigue siendo safety net obligatorio — no eliminarlo aunque envolvamos todo en try/catch, porque siempre habrá fetches que se nos escapan.
## 38. Cutover Vercel→VPS paralelo + Paso C multi-tenant (2026-05-12)

Sesión larga de migración de infraestructura. Resultado: `kpsula.app`
sirviendo desde el VPS de Contabo en paralelo con Vercel, ambos
golpeando la misma BD productiva. Más middleware passive (Paso C del
multi-tenant) y script de deploy automatizado.

### 38.1 DNS + SSL wildcard (Fases 1-2 del VPS_MIGRATION_PLAN)

Dominio `kpsula.app` comprado en GoDaddy. Cloudflare configurado como
nameserver:

- 2 NS de Cloudflare (`robert.ns.cloudflare.com`, `adel.ns.cloudflare.com`)
- A records `@` y `*` → `147.93.6.70` (IP del VPS), proxy DNS-only (gris)
- API token Cloudflare con scope `Zone DNS Edit` para `kpsula.app` guardado
  en `/etc/letsencrypt/cloudflare.ini` (perms 600)

Certbot wildcard via DNS-01 emitió cert para `kpsula.app` y
`*.kpsula.app`, vence 2026-08-10, auto-renueva cada 60 días.

nginx site en `/etc/nginx/sites-available/kpsula.app`:
- HTTP→HTTPS redirect en :80
- HTTPS server en :443 con HTTP/2
- `/_next/static/` y `/public/` con `alias` (servidos directo por nginx)
- Resto `proxy_pass` a `127.0.0.1:3000` (Next standalone)

`ufw allow 80/tcp` y `ufw allow 443/tcp` (descubrimos que faltaba —
nginx escuchaba pero firewall bloqueaba externo).

### 38.2 Deploy del build actual al VPS (Fase 3.5 — manual)

El `/var/www/capsula-erp/` del VPS tenía un build del **17 de abril**,
mes y medio atrás. Y el `.env` apuntaba a la BD staging vacía
`capsula_db:5432`, no a `capsula_erp_prod:5433`. Es decir, esos 22
días de uptime del pm2 nunca tocaron producción real. Buena noticia
para esta sesión (cero riesgo de corrupción retroactiva).

Plan ejecutado:

1. Backup preventivo `pg_dump -Fc` de `capsula_erp_prod` (~5 MB).
2. Clone fresh `git clone --depth 1 --branch main` en
   `/var/www/capsula-erp-new/`.
3. Nuevo `.env` con valores de Vercel (`vercel.com/settings/env`):
   - `DATABASE_URL`: misma URL que Vercel pero con host
     `localhost:5433` (loopback, más rápido + sin firewall).
   - `NEXTAUTH_SECRET`, `JWT_SECRET`: copiados idénticos de Vercel.
   - `CRON_SECRET`: GENERADO NUEVO con `openssl rand -hex 32`. El de
     Vercel está marcado "Sensitive" y no se puede leer. Los crons
     de Vercel siguen usando el suyo; el VPS no tiene scheduler aún.
   - `NEXTAUTH_URL=https://kpsula.app`, `NODE_ENV=production`,
     `HOSTNAME=127.0.0.1`, `PORT=3000`.
4. `npm ci --include=dev` (sin --include=dev, npm omite
   `autoprefixer`/`tailwindcss`/`typescript` que sí son necesarios
   en build time). Después `npm run build` → standalone.
5. Copia de assets al standalone: Next standalone NO incluye
   `public/` ni `.next/static/`. Copiar a `.next/standalone/` y
   `.next/standalone/.next/` para que los `alias` de nginx
   funcionen.
6. Smoke test en puerto 3001 (sin tocar pm2 viejo) + validación
   visual via SSH tunnel.
7. Swap atómico: `mv` viejo → `OLD-<TS>`, `mv` nuevo → activo.
   `pm2 delete && pm2 start ecosystem.config.js && pm2 save`.

### 38.3 Trampa con `--env-file` de Node 22

Primera versión del `ecosystem.config.js` usaba
`node_args: '--env-file=.env'`. El proceso arrancaba pero Prisma
daba `Authentication failed against database server at localhost` —
pese a que `psql "$DATABASE_URL"` con la misma URL conectaba.

Diagnóstico: `node --env-file` y `bash source` veían ambos la misma
URL (length 112, idéntica). El issue era contaminación de env del
shell que ejecutó `pm2 start` (un `PORT=3001` leftover del smoke
test). Tras `unset PORT`, otras inconsistencias residuales del shell
seguían filtrándose al fork de pm2.

**Fix definitivo:** wrapper script `start-server.sh` que sourcea
`.env` explícitamente y `exec node`:

```bash
#!/usr/bin/env bash
set -e
set -a
source /var/www/capsula-erp/.env
set +a
cd /var/www/capsula-erp
exec node .next/standalone/server.js
```

`ecosystem.config.js` referencia ese script:

```js
module.exports = {
  apps: [{
    name: 'capsula-erp',
    script: '/var/www/capsula-erp/start-server.sh',
    interpreter: 'bash',
    cwd: '/var/www/capsula-erp',
    autorestart: true,
    max_memory_restart: '1G',
    error_file: '/root/.pm2/logs/capsula-erp-error.log',
    out_file: '/root/.pm2/logs/capsula-erp-out.log',
    time: true,
  }]
};
```

Tras este cambio, login con un user real en `https://kpsula.app`
funciona contra la BD productiva. kpsula.app y
`shanklish-erp-main.vercel.app` operan en paralelo contra el mismo
`capsula_erp_prod`.

Convención hereditaria: todos los deploys futuros al VPS deben
respetar este patrón. El script de deploy automatizado (§38.5)
copia el wrapper desde la instalación viva.

### 38.4 Paso C multi-tenant — middleware passive

`src/middleware.ts` ahora extrae el slug del host y lo setea como
`x-tenant-slug` en el request header, vía `extractTenantSlugFromHost`:

```typescript
const tenantSlug = extractTenantSlugFromHost(request.headers.get('host'));
// ... resto del middleware (maintenance, auth, RBAC) sin cambios ...
if (tenantSlug) {
    const headers = new Headers(request.headers);
    headers.set('x-tenant-slug', tenantSlug);
    return NextResponse.next({ request: { headers } });
}
return NextResponse.next();
```

Pasivo: nadie llama a `resolveTenantContext()` en runtime todavía.
El header existe pero no afecta comportamiento hasta Paso D
(activar `defineAction()` wrapper en una action piloto).

Verificación: `shanklish.kpsula.app` → header `x-tenant-slug:
shanklish`. `kpsula.app` (root) → sin header → si en algún momento
se invoca `resolveTenantContext()` cae al fallback Shanklish.
Vercel preview, IP raw, otros hosts → idéntico (sin header,
fallback).

### 38.5 Script de deploy `scripts/deploy-vps.sh`

Para que futuros deploys al VPS no requieran el procedimiento
manual de §38.2, hay un script reutilizable. Uso:

```bash
# En el VPS, como root:
bash /root/deploy-capsula.sh           # deploya main
bash /root/deploy-capsula.sh somebranch # deploya otra branch
```

Pasos (idempotente, con rollback en ~30s):

1. Backup `pg_dump` de `capsula_erp_prod` a `/root/backups/`
2. Clone fresh en `/var/www/capsula-erp-NEW-<TS>`
3. Copia `.env`, `ecosystem.config.js`, `start-server.sh` desde el
   directorio activo
4. `npm ci --include=dev` y `npm run build`
5. Copia `public/` y `.next/static/` al standalone
6. **Smoke test Prisma**: aborta si no conecta a BD antes del swap
7. Swap atómico de directorios
8. `pm2 restart` y verificación con curl

Instalación en el VPS:

```bash
wget https://raw.githubusercontent.com/Juninho2604/capsula-erp/main/scripts/deploy-vps.sh \
  -O /root/deploy-capsula.sh
chmod +x /root/deploy-capsula.sh
```

### 38.6 Estado al cierre y deuda

**Sirviendo en paralelo:** ✅
- Vercel (`shanklish-erp-main.vercel.app`) — producción, todos los
  clientes
- VPS (`kpsula.app`) — sirve mismo build de main, misma BD, listo
  para cutover

**Multi-tenant:** Paso A (JWT), Paso B (host parser), **Paso C
(middleware passive)** ahora listos. Pendiente:
- Paso D: activar `defineAction()` en 1 action piloto
- Paso E: `withTenant()` Prisma extension en actions migradas
- Signup self-service + panel SUPER_ADMIN

**Hardening pendiente:**
- `ufw deny` para puertos `5433` (Postgres) y `11434` (Ollama). Antes
  de bloquear 5433, cambiar el acceso de Vercel a la BD: o
  Cloudflare Tunnel, o whitelist por IP de Vercel, o TLS client cert.
- El Next standalone ya escucha solo en `127.0.0.1:3000` (vía
  `HOSTNAME=127.0.0.1` en `.env`), así que el puerto 3000 ya no es
  alcanzable externamente.

**CI/CD pendiente (Fase 3 del VPS_MIGRATION_PLAN):** GitHub Actions
con workflow_dispatch que llama a `deploy-vps.sh` via SSH. Reduce
trabajo manual de cada deploy futuro a un click en GitHub.

### 38.7 Lecciones aprendidas

1. `NODE_ENV=production` durante `npm ci` omite devDeps. Para
   build, `unset NODE_ENV && npm ci --include=dev`. Cuidado con
   `set -a; source .env` que puede leaks `NODE_ENV=production` al
   shell.

2. `node --env-file` no es 100% drop-in con `bash source` cuando
   hay contaminación de env del shell padre. Wrapper script con
   `source .env` explícito es el patrón confiable para pm2.

3. Next standalone NO incluye `public/` ni `.next/static/`. Hay que
   copiarlos a mano (o automatizarlo en CI/script).

4. `ufw allow 80/443` no estaba aplicado por default en Contabo.
   nginx escuchaba, certbot emitía cert, pero externamente nada
   llegaba. Verificar `ufw status` antes de asumir que un servicio
   "no responde".

5. El `.env` del VPS no apuntaba a la BD productiva — apuntaba a
   una BD staging vacía. Foot-gun: parecía que el VPS "ya estaba
   productivo" pero no lo estaba.

6. `tmux` es obligatorio para procesos >30s en SSH de Contabo. La
   sesión SSH se cae cada ~37s por inactividad. Configurar
   `ServerAliveInterval 30` en `~/.ssh/config` del cliente también
   ayuda.

### 38.8 Referencias

- `docs/VPS_MIGRATION_PLAN.md` (plan completo de migración Vercel→VPS)
- `scripts/deploy-vps.sh` (script de deploy reutilizable)
- `/var/www/capsula-erp/start-server.sh` (wrapper pm2; vive en el VPS)
- `/var/www/capsula-erp/ecosystem.config.js` (config pm2; vive en el VPS)
- `src/middleware.ts` (Paso C activado)
- `src/lib/tenant-context.ts` (extractor de slug, 13 tests)
- `src/lib/tenant-context.server.ts` (resolver activado en Paso D.a)

### 38.9 Paso D.a multi-tenant — endpoint `/api/tenant/whoami` (2026-05-12)

Primer consumidor real de `resolveTenantContext()` en runtime. Endpoint
de observabilidad que NO migra ninguna action existente — solo expone
el tenant resuelto del request actual.

**Por qué `whoami` y no migrar `getOpenTabsAction` (como sugería §35.6
originalmente):**

Migrar una action existente a `defineAction()` cambia su firma de retorno
de `T` a `ActionResult<T>`, lo que rompe todos los callers (UI, otras
actions). Es trabajo significativo y riesgoso para hacer en la misma
sesión que activamos el resolver por primera vez.

`whoami` desacopla las dos preocupaciones:
- **D.a (este commit)**: validar en producción que el resolver server-side
  funciona, retorna el tenant correcto en cada caso (subdomain / session
  / fallback), y no rompe nada.
- **D.b (siguiente sesión)**: una vez confirmado D.a, migrar la primera
  action real con `defineAction()`.

**Implementación** (`src/app/api/tenant/whoami/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await resolveTenantContext();
    return NextResponse.json({
        tenantId: ctx.tenantId,
        slug: ctx.slug,
        source: ctx.source,
        sessionTenantId: (session as { tenantId?: string }).tenantId ?? null,
    });
}
```

**Casos esperados en producción** (deploy a Vercel + VPS):

| URL | source | slug | sessionTenantId |
|---|---|---|---|
| `https://kpsula.app/api/tenant/whoami` (root, sin subdomain) | `fallback` (o `session` si el JWT tiene tenantId) | `shanklish` | depende de la sesión |
| `https://shanklish.kpsula.app/api/tenant/whoami` | `subdomain` | `shanklish` | depende |
| `https://shanklish-erp-main.vercel.app/api/tenant/whoami` | `fallback` (host no es kpsula.app) | `shanklish` | depende |

**Riesgo de este commit:** muy bajo. El resolver hace 1 query a
`prisma.tenant.findUnique` con `select: { id, slug }`. Si falla, el
endpoint devuelve 500 pero el resto del sitio sigue. Ninguna action
existente toca el resolver.

**Seguridad:** endpoint protegido por `getSession()`. Sin sesión
activa → 401. Cualquier role autenticado puede consultarlo (no es
info sensible — `slug` ya está en la URL del host).

### 38.10 Pendientes tras Paso D.a

- **Paso D.b**: migrar 1 action existente real a `defineAction()`. Empezar
  por una READ-only de bajo riesgo (no afecta data). Candidatos:
  - Una action `get*` simple que ya tenga ActionResult shape
  - O crear primero un wrapper paralelo y migrar callers gradualmente
- **Paso E**: una vez D.b estable, reemplazar `prisma` por
  `withTenant(tenant.id)` en actions migradas. Inyecta tenantId
  automáticamente.
- **Signup self-service**: ruta `/signup` que crea Tenant + Owner.
- **Panel SUPER_ADMIN**: `/admin/tenants` para listar/desactivar tenants.
- **Bootstrap de tenant nuevo**: branch default, áreas, zonas POS,
  invoiceCounter, etc.

### 38.11 Referencias adicionales

- `src/app/api/tenant/whoami/route.ts` (Paso D.a — primer consumidor)
- `src/lib/define-action.ts` (sigue dormante, espera D.b)
- `src/lib/prisma-tenant-client.ts` (sigue dormante, espera E)

### 38.12 CI/CD GitHub Actions → VPS (workflow_dispatch)

`.github/workflows/ci.yml` actualizado para que:

1. **`validate`** corra en push/PR a `main` (antes era `capsula/consolidation`).
   Hace `npm ci` + `prisma generate` + `prisma db push` (sobre BD efímera de
   CI) + `tsc` + `vitest`. Cualquier PR mostrará el estado.

2. **`deploy`** corre solo en `workflow_dispatch` (botón "Run workflow" en
   pestaña Actions). Hace SSH al VPS y ejecuta
   `bash /root/deploy-capsula.sh main`.

**Secrets requeridos** (configurar en GitHub → Settings → Secrets and
variables → Actions):

| Nombre | Valor |
|---|---|
| `CONTABO_HOST` | `147.93.6.70` |
| `CONTABO_USER` | `root` |
| `CONTABO_SSH_KEY` | Clave privada SSH ed25519 con acceso al VPS (ver §38.13) |

**Trigger automático en push a main:** se mantiene **deshabilitado**
hasta validar que el manual funciona. Una vez confirmado, se puede
agregar `if: github.ref == 'refs/heads/main'` al deploy job junto con
`github.event_name == 'push'`.

### 38.12.b 🚨 Deploy usa el script VERSIONADO del repo (2026-06-09)

**Causa raíz cerrada**: el deploy job invocaba `bash /root/deploy-capsula.sh`
— una copia que vivía SOLO en el VPS, quedó vieja y **no corría
`prisma migrate deploy`**. Cada PR con migración deployaba código que
crasheaba contra una BD sin las tablas nuevas (PRs #233/#234 branding,
#291 tesorería, #294 documentos de proveedor) y había que destrabarlo a
mano con `apply-migrations.yml` (3 veces: 2× mayo, 1× 9-jun).

**Fix**: el step "Deploy via SSH" de `ci.yml` ahora descarga
`scripts/deploy-vps.sh` desde raw.githubusercontent.com **pinneado al
`$GITHUB_SHA` que se está deployando**, lo corre desde `/tmp` (no desde
`/var/www/capsula-erp`, porque el script hace swap de ese directorio a
mitad de ejecución) y lo borra al final. El script versionado incluye
`prisma migrate deploy` en el paso [7/10] — si la migración falla, aborta
ANTES del swap y la app vieja sigue atendiendo.

**Implicaciones**:
- `/root/deploy-capsula.sh` queda obsoleto (se puede conservar como
  fallback manual, pero ya no lo invoca nadie). Cualquier mejora al deploy
  se hace en `scripts/deploy-vps.sh` y viaja sola con el merge.
- `apply-migrations.yml` pasa a ser solo escape-hatch de emergencia.
- Requiere repo público (raw.githubusercontent sin auth). Si el repo pasa
  a privado, cambiar el curl por `git archive` o un token.

### 38.13 SSH key setup para deploy automatizado

Generar keypair dedicado para GitHub Actions (NO usar la del user
operativo):

```bash
# En el VPS:
ssh-keygen -t ed25519 -f /root/.ssh/github-actions -N "" -C "github-actions deploy"

# Añadir la pública a authorized_keys
cat /root/.ssh/github-actions.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Mostrar la PRIVADA (copiar TODO el contenido, incluyendo BEGIN/END)
# para pegarla en GitHub Secret CONTABO_SSH_KEY:
cat /root/.ssh/github-actions
```

Después en GitHub:
1. Repo Settings → Secrets and variables → Actions → New repository secret
2. Crear `CONTABO_HOST` = `147.93.6.70`
3. Crear `CONTABO_USER` = `root`
4. Crear `CONTABO_SSH_KEY` = pegar contenido de `/root/.ssh/github-actions`

**Verificación**: GitHub → Actions → CI → "Run workflow" → main → debe
ejecutar `bash /root/deploy-capsula.sh main` y reportar éxito.

**Riesgo:** muy bajo. Si los secrets faltan o están mal, el job falla
en GitHub con error de auth y nada cambia en el VPS. El job tiene
`script_stop: true` así que cualquier error aborta sin dejar estados
intermedios.

---

### 38.14 Signup self-service MVP (feature flag SIGNUPS_ENABLED)

Primer "tenant operativo" entregable: una persona externa puede crear
su propia cuenta de negocio en `https://kpsula.app/signup` y empezar
a usar la app en `https://<su-slug>.kpsula.app`.

**Estado: detrás de feature flag.** En producción `SIGNUPS_ENABLED`
NO está seteada → `/signup` devuelve 404 y `signupTenantAction`
rechaza con mensaje "registros temporalmente cerrados".

**Activación en producción:** añadir `SIGNUPS_ENABLED=true` al
`/var/www/capsula-erp/.env` del VPS (y al `.env` de Vercel si querés
también activarlo ahí), restart pm2. Doble check: el feature flag se
chequea en `src/app/signup/page.tsx` (devuelve 404) y en
`src/app/actions/signup.actions.ts` (rechaza con mensaje).

**Componentes:**

- `src/lib/signup/reserved-slugs.ts` — lista de ~55 slugs reservados
  (www, api, admin, login, kpsula, shanklish, staging, dev, etc.) +
  helper `isReservedSlug`. 7 tests.
- `src/app/actions/signup.actions.ts` — `signupTenantAction(prevState, formData)`:
  - Feature flag check
  - Rate limit: 3 intentos/IP/hora vía `consumeRateLimit`
  - Validación: businessName 2-100, slug regex `^[a-z0-9][a-z0-9-]{1,29}$`,
    email regex, password 8-200, firstName/lastName 1-50
  - `isReservedSlug` check
  - Chequeo previo de slug único + `@unique` constraint atómico
  - Transacción: crea `Tenant` + `User` role=OWNER
  - Devuelve `{ success: true, tenantSlug, loginUrl }` o
    `{ success: false, message, field? }`
- `src/app/signup/page.tsx` — Server Component que llama `notFound()`
  si feature flag desactivada.
- `src/app/signup/signup-form-client.tsx` — Client Component con
  `useActionState`, muestra errores por campo, success card con
  link a `https://<slug>.kpsula.app/login`.

**Bootstrap mínimo:** intencional. La acción solo crea `Tenant` + `User`.
NO crea `Branch` ni datos default. El owner ve un dashboard inicial
vacío y configura todo desde `/dashboard/config`. Iteramos en
sub-secciones futuras (38.15, 38.16...) según feedback.

**Flujo del usuario nuevo:**

1. Va a `https://kpsula.app/signup` (con flag activada)
2. Completa el form: nombre del negocio, slug deseado, sus datos
3. Submit → action crea Tenant + User OWNER
4. Pantalla de éxito con link a `https://<slug>.kpsula.app/login`
5. Click → llega al login en su subdomain
6. Login con su email/password → llega a `/dashboard`
7. Configura branch, áreas, etc. manualmente

**Riesgo:** muy bajo en producción con flag OFF (default). Con flag ON:
- Cada signup escribe 2 filas en BD (Tenant + User). Inmutable: si algo
  falla, la transacción revierte.
- Rate limit defensivo contra abuso.
- Slugs reservados protegen subdominios técnicos y rutas críticas.
- `passwordHash` se calcula con PBKDF2 (`hashPassword` de
  `src/lib/password.ts`).

**Test plan (con flag ON localmente):**
- Visitar `/signup` → form se renderiza
- Submit con slug reservado (e.g. "www") → error "reservado"
- Submit con slug ya existente (e.g. "shanklish") → error "ya tomado"
- Submit válido → success card + Tenant nuevo en BD + User OWNER en BD
- Visitar `https://<nuevoslug>.kpsula.app/login` → login funciona
- Visitar `https://<nuevoslug>.kpsula.app/api/tenant/whoami` (con sesión)
  → `source: "subdomain"`, `slug: <nuevoslug>`

### 38.15 Pendientes tras Signup MVP

- **Auto-login post-signup**: actualmente el flujo manda al user a `/login`.
  Para hacerlo más fluido, el action podría llamar `createSession()` y
  redirigir directo a `/dashboard`. Complicación: cookies cross-subdomain
  — necesitamos setear `domain: '.kpsula.app'` en la cookie de sesión
  para que sea válida en cualquier subdomain.
- **Bootstrap de Branch default**: para que el owner pueda usar POS
  inmediatamente, crear un Branch "Principal" + Area "General" +
  ServiceZone "Salón" + algunas TableOrStation default. Reduce fricción
  pero acopla signup al schema POS.
- **Email de bienvenida**: notificar al owner por email (Resend / Postmark)
  con link al login y guía rápida.
- **Panel SUPER_ADMIN**: ruta `/admin/tenants` para listar tenants,
  desactivar abusos, ver métricas. Requiere role SUPER_ADMIN nuevo.
- **CAPTCHA o Turnstile**: si hay bots intentando crear tenants masivos,
  añadir Cloudflare Turnstile (free) en el form.

### 38.16 Bootstrap Branch + auto-login cross-subdomain (2026-05-12)

Resuelve los dos primeros pendientes de §38.15. El signup ahora deja al
owner directamente en `/dashboard` del subdomain del tenant, sin pedir
que vuelva a tipear credenciales.

**Cambios:**

| Archivo | Cambio |
|---|---|
| `src/lib/signup/bootstrap-token.ts` | Helpers `createBootstrapToken()` / `verifyBootstrapToken()`. JWT HS256 firmado con `JWT_SECRET`, expira en 60s, payload `{kind:"signup-bootstrap", userId, tenantId, tenantSlug}`. |
| `src/lib/signup/bootstrap-token.test.ts` | 4 tests: round-trip, JWT inválido, firma con otro secret, kind incorrecto. |
| `src/app/actions/signup.actions.ts` | La transacción ahora también crea `Branch{code:"MAIN", name:businessName}` para el tenant nuevo. Tras commit genera un bootstrap token y devuelve `loginUrl: https://<slug>.kpsula.app/auth/bootstrap?t=<jwt>` en vez de `/login`. |
| `src/app/auth/bootstrap/route.ts` | `GET` handler: verifica token, carga `User` validando `tenantId` matcheado, llama `createSession()` con snapshot fresco, redirige a `/dashboard`. Token inválido/expirado → `/login?bootstrap=expired`. |
| `src/app/signup/signup-form-client.tsx` | Tras éxito, `useEffect` redirige automáticamente a `loginUrl` con `window.location.href` 1.2s después. El CTA queda visible como fallback ("Ir ahora"). |

**Por qué un token en URL y no una cookie compartida `.kpsula.app`:**

Si emitiéramos la cookie de sesión con `domain=.kpsula.app`, el navegador
la mandaría también a otros subdomains de otros tenants. Aunque el
resolver de tenant (Paso D) rechaza JWTs cuyo `tenantId` no coincide
con el host, abrimos una superficie de cross-tenant leak innecesaria.
El token one-shot de 60s elimina ese vector: vive solo el tiempo del
redirect, no persiste y queda atado a un único `tenantId` específico.

**Por qué `Branch{code:"MAIN"}` y no más seed:**

`Branch` es el mínimo para que `/dashboard` no crashee en queries que
listan por tenant. El resto del seed (categorías, métodos de pago,
estaciones de cocina) queda para una sub-sección futura — es opinionado
y depende del tipo de negocio. El owner lo configura desde
`/dashboard/config` o `/dashboard/sku-studio`.

**Riesgo:**

Bajo. La acción sigue gated por `SIGNUPS_ENABLED`. El endpoint
`/auth/bootstrap` existe siempre pero solo acepta tokens firmados con
el `JWT_SECRET` actual, así que en Vercel (sin la flag) nadie puede
llegar a generarlos. Vercel intocable: el deploy de signup ya iba a
ese servidor en el code base anterior y queda igual de inerte.

**Pendientes que siguen abiertos de §38.15:**
Email de bienvenida, panel `SUPER_ADMIN`, Turnstile. El resto
(seed más completo de Area/ServiceZone/TableOrStation) puede esperar
porque el owner puede empezar el flujo solo con Branch + dashboard
funcionando.

### 38.17 Panel SUPER_ADMIN — `/admin/tenants` (2026-05-13)

Resuelve el pendiente "Panel SUPER_ADMIN" de §38.15. Permite listar y
suspender tenants sin tocar BD a mano.

**Modelo de autorización: env-var allowlist, no rol persistido.**

Un SUPER_ADMIN sigue siendo un `User` normal (con su rol y su tenant)
pero su email aparece en `SUPER_ADMIN_EMAILS` (lista separada por coma).
Esa whitelist le habilita acceso a `/admin/*` y a operar sobre cualquier
tenant. No hay schema change ni nuevo rol en `roles.ts`.

Ventajas vs un `role='SUPER_ADMIN'` en BD:
- No requiere migration.
- Bootstrap inmediato: edit `.env` + `pm2 restart` y listo, sin login previo.
- Revocar = remover email de la env + restart. Sin propagar a JWTs vivos.
- No contamina la tabla `Tenant`/`User` con un concepto cross-tenant.

Desventajas:
- No queda registro auditable en BD de quién fue SUPER_ADMIN cuándo
  (mitigable con git history del `.env` si está versionado, o con audit
  log de acciones del panel — futuro).

**Cambios:**

| Archivo | Rol |
|---|---|
| `src/lib/super-admin.ts` | `isSuperAdmin(email)`: lee `SUPER_ADMIN_EMAILS`, normaliza lowercase, cachea hasta cambio de la env var. `__resetSuperAdminCache()` para tests. |
| `src/lib/super-admin.test.ts` | 6 tests (no env / vacía / match exacto / case-insensitive / lista con espacios / email vacío). |
| `src/middleware.ts` | Gate `/admin/*` — sin sesión o email fuera de la allowlist responde 404 directo (no leakea existencia). |
| `src/app/admin/layout.tsx` | Doble check defense-in-depth con `getSession()` + `isSuperAdmin()` → `notFound()`. Header con email del admin. |
| `src/app/admin/page.tsx` | Redirect a `/admin/tenants`. |
| `src/app/admin/tenants/page.tsx` | Server Component: `prisma.tenant.findMany()` cross-tenant + `groupBy` de users activos y `salesOrder` últimos 30d. |
| `src/app/admin/tenants/actions.ts` | `suspendTenantAction` (todos los users → `isActive:false` + `tokenVersion += 1`); `reactivateTenantAction` (→ `isActive:true`). Ambos repiten `requireSuperAdmin()` por defense in depth. |
| `src/app/admin/tenants/tenants-table-client.tsx` | Tabla con badges Activo/Suspendido, link a `https://<slug>.kpsula.app`, botón Suspender (coral) / Reactivar. `confirm()` nativo antes de mutar. |

**Cómo se "suspende" un tenant sin `Tenant.isActive`:**

`updateMany` sobre `User` poniendo `isActive=false` + `tokenVersion += 1`.
Resultado:
- `loginAction` rechaza nuevos logins (chequea `isActive`).
- JWTs vivos quedan inválidos en la siguiente verificación porque
  `tokenVersion` del payload ya no matchea con el de BD.
- "Suspendido" en el panel = todos los users del tenant tienen
  `isActive=false`. Si hay al menos uno activo, mostramos "Activo".

**Variables de entorno:**

```env
SUPER_ADMIN_EMAILS=admin@kpsula.app,otroadmin@kpsula.app
```

Sin la var → `/admin` 404 universal. Setear en VPS (y opcionalmente en
Vercel si querés operar también desde ahí).

**Riesgo:**

Bajo. Sin la env var setteada el panel es invisible y inaccesible. Las
acciones validan SUPER_ADMIN en cada llamada (no confían en el middleware).
No hay schema change ni migration; nada toca BD existente más que un
`updateMany` reversible de `User.isActive`.

**Pendientes que quedan:**
Email de bienvenida, Turnstile, audit log de acciones del panel, seed
completo (Area/ServiceZone/TableOrStation).

### 38.18 Fase 3 Paso D.b — kickoff: red de seguridad (Lote 0) (2026-05-13)

Antes de empezar a migrar server actions a `withTenant()`, instalamos
una red de regression contra Postgres real para validar que el motor
de aislamiento (`prisma-tenant-client.ts`) hace lo que dice. Sin esto,
una bug en la extension contamina silenciosamente todos los módulos
que se migren después.

**Archivo:**
`src/lib/prisma-tenant-client.int.test.ts` — 5 tests de integración:
1. `create` inyecta `tenantId` y `findMany` no devuelve rows de otro tenant.
2. `count` y `aggregate` respetan el scope.
3. `findFirst` no leakea rows entre tenants aunque haya match en otros campos.
4. `updateMany` del scope A no toca rows de B.
5. `deleteMany` del scope A no toca rows de B.

**Gating:**
Solo corre cuando `process.env.CI === 'true'` (GitHub Actions lo setea
automáticamente). Eso evita que un `npm test` en dev local pegue
contra la BD del desarrollador y deje filas residuales. Para forzarlo
localmente:

```bash
CI=true DATABASE_URL=postgres://... npx vitest run prisma-tenant-client.int.test.ts
```

**Cleanup:**
Cada run usa prefijo único `int-test-<timestamp>-` para tenants y
branches. `afterAll` borra branches (FK Restrict) y luego tenants.
Si el cleanup falla, las filas quedan en la BD del CI (efímera) o
hay que limpiar a mano en dev.

**Resultado local:** 150 tests pasan + 5 skipped (integration).
**Resultado CI:** todos corren contra el servicio `postgres:16` del
workflow `validate`.

**Próximo lote:**
Lote 1 — migrar `exchange.actions.ts` (el más chico, baja criticidad)
para establecer el patrón de migración (`withTenant(ctx.tenantId)` +
`resolveTenantContext()`). Una vez validado en producción Shanklish,
seguimos con `areas`, `waiter`, `system-config`.

### 38.19 Lote 1 — `exchange.actions.ts` migrado a `withTenant()` (2026-05-13)

Primera server action migrada al patrón multitenant pleno. Sirve como
ejemplo canónico para los lotes siguientes.

**Patrón canónico** (lo que TODA action de aquí en adelante hace):

```ts
'use server';
import { withTenant } from '@/lib/prisma-tenant-client';
import { resolveTenantContext } from '@/lib/tenant-context.server';

export async function listX() {
    const { tenantId } = await resolveTenantContext();
    const db = withTenant(tenantId);
    return db.x.findMany({ orderBy: { ... } });
}
```

**Por qué no `defineAction()` todavía:**

`defineAction()` envuelve sesión + permiso + tenant, pero introduce
cambios en la firma del export (`async (args)` en vez de `async fn`)
y en cómo callers lo invocan. Mientras los callers (forms, client
components) están sin migrar, mantenemos las firmas planas y solo
inyectamos `withTenant + resolveTenantContext`. La transición a
`defineAction()` queda para una sub-fase posterior.

**Por qué empezamos por `exchange.actions.ts`:**

- 2.4 KB, 5 funciones, modelo único (`ExchangeRate`).
- Sin dependencias con POS / inventario / sales.
- Solo 3 callers (`tasa-cambio` config + `CurrencyCalculator`).
- Cada tenant lleva su propia tasa (Shanklish: BCV directo;
  Table Pong: BCV + 3%; etc.).

**Compatibilidad con Shanklish en producción:**

El resolver cae al fallback `tnt_shanklish_caracas` para:
- Hosts sin subdomain (kpsula.app, capsula-erp.vercel.app, IP raw).
- JWTs viejos sin `tenantId` (sesiones pre-Fase 3 Paso A).

Las tasas existentes en BD ya tienen `tenantId="tnt_shanklish_caracas"`
(default del schema), así que un `withTenant("tnt_shanklish_caracas")
.findMany()` devuelve exactamente lo mismo que el `findMany()` original.
Cero impacto perceptible para Shanklish.

**Validación:**

- `npx tsc --noEmit` → 0 errores.
- `npx vitest run` → 150/150 + 5 skipped (integration).
- En CI los 5 integration corren contra Postgres y validan el motor.

**Próximo lote:**

Lote 2 — `areas.actions.ts`, `waiter.actions.ts`, `system-config.actions.ts`.
Tres módulos admin chicos, read-mostly, sin dependencias críticas. Un PR
por archivo para mantener review fácil.

### 38.20 Lote 2.a/2.b mergeados + blocker en Lote 2.c (2026-05-13)

**Mergeados:**
- Lote 2.a (`areas.actions.ts`, PR #132): patrón `withTenant` + `update→updateMany` para tenant-safe writes.
- Lote 2.b parcial (`waiter.actions.ts`, PR #133): admin meseros (CRUD + PIN). `transferTableAction` y `moveTabBetweenTablesAction` diferidos a Lote 5 por su complejidad transaccional.

**Blocker encontrado en Lote 2.c — `SystemConfig`:**

`SystemConfig` es el ÚNICO modelo del schema cuya PK no es un cuid:

```prisma
model SystemConfig {
  key       String   @id          // ← PK es la key, NO cuid
  value     String
  tenantId  String   @default("tnt_shanklish_caracas")
  ...
}
```

El propio comentario del schema lo reconoce: "el unique sigue siendo en
`key` (no en `(tenantId, key)`). Eso se cambia en Fase 2."

**Consecuencia:**
Cuando Table Pong intente guardar su propio `enabled_modules`:
- `create` falla con P2002 (la PK ya existe para Shanklish).
- `upsert({ where: { key } })` encuentra la fila de Shanklish y la
  sobrescribe — mezcla configs entre tenants.

**Por qué saltamos en este lote:**
Migrar `system-config.actions.ts` requiere primero un **schema change**:
1. Añadir `id String @id @default(cuid())`.
2. Quitar `@id` de `key`.
3. Añadir `@@unique([tenantId, key])`.
4. Migration SQL que preserve los datos de Shanklish (asignar cuids
   nuevos a las filas existentes).

Riesgo bajo en sí (SystemConfig no tiene FKs apuntándolo) pero es DDL
que requiere coordinación con la BD de producción. Lo dejo como
**sub-tarea bloqueante de Lote 8** (alta de Table Pong y Sello Criollo
necesita que cada tenant pueda guardar su config sin colisionar con
Shanklish). Cuando arranquemos Lote 8 abrimos un PR aparte solo para
el schema fix.

**Para Shanklish todo sigue igual** — `system-config.actions.ts` no se
toca, sigue usando `prisma` directo. Los reads y writes funcionan como
hoy porque solo hay un tenant.

**Próximo:**
Lote 3 — Catálogo (`menu.actions.ts`, `recipe.actions.ts`,
`modifier.actions.ts`, `cost.actions.ts`). Mismo patrón canónico,
ningún blocker conocido (todos esos modelos tienen PK cuid + tenantId
opcional).

## 39. Print Agent — daemon ESC/POS para impresoras AON (2026-05-12)

### 39.1 Contexto

Las tablets (Android, PWA) **no tienen drivers de impresora térmica** y no pueden imprimir directamente. Hoy el ERP usa `printReceipt()` y `printKitchenCommand()` en `src/lib/print-command.ts` que abren `window.open()` + `window.print()` — funciona en PCs con driver instalado y modo kiosk, **falla en tablets**.

Setup físico (con Jonathan de sistemas):
- **7 impresoras AON Ethernet** (3 caja + 2 cocina + 1 pronto + 1 barra).
- **Pickup-1** (Windows 10/11) será el **host del Print Agent**.
- Las AON soportan **ESC/POS estándar por TCP puerto 9100**.

### 39.2 Arquitectura — polling, no WebSocket

```
Tablet POS              ERP Vercel            Print Agent (Pickup-1)      Impresora AON
─────────              ──────────            ────────────────────       ─────────────
enqueuePrintJob() ─►  crea PrintJob       ◄─  GET  /jobs?status=PENDING
                      (DB Postgres)       ─►  POST /jobs/:id/claim
                                                                      ─►  TCP:9100 (ESC/POS)
                                          ◄─  POST /jobs/:id/complete
```

Vercel no soporta WebSockets persistentes nativamente. Polling cada 1s con jobs FIFO es trivialmente fiable y la latencia (~1-2s) es aceptable para impresión en restaurante.

### 39.3 Pieza por pieza

| Archivo | Rol |
|---|---|
| `prisma/schema.prisma` | Modelo `PrintJob` con enums `PrintJobType` (RECEIPT/PRECUENTA/KITCHEN/VOID_KITCHEN) y `PrintJobStatus` (PENDING/PRINTING/COMPLETED/FAILED). Relaciones a `Tenant` y `User`. Índices `(tenantId, status, createdAt)`. |
| `prisma/migrations/20260512200000_add_print_job/` | Migration SQL con tabla + enums + FKs. |
| `src/lib/print-agent-auth.ts` | Auth del agent: `Bearer <PRINT_AGENT_API_KEY>` + `X-Tenant-Id`. Comparación constant-time. |
| `src/app/api/print-agent/jobs/route.ts` | `GET` — devuelve los jobs FIFO al agent. |
| `src/app/api/print-agent/jobs/[id]/claim/route.ts` | `POST` — claim atómico PENDING → PRINTING. 409 si race. |
| `src/app/api/print-agent/jobs/[id]/complete/route.ts` | `POST` — marca COMPLETED + completedAt. |
| `src/app/api/print-agent/jobs/[id]/fail/route.ts` | `POST` `{errorMessage, retryable}` — incrementa retries. Si `retryable && retries < 3` → vuelve a PENDING. Sino FAILED final. |
| `src/app/actions/print-agent.actions.ts` | `enqueuePrintJobAction({type, station?, payload})` — server action que el POS llama para encolar. `getRecentPrintJobsAction()` para UI futura. |
| `src/lib/print-via-agent.ts` | Wrappers cliente `enqueueReceipt()` y `enqueueKitchenCommand()` + helper `shouldUseAgent()`. Override manual via `localStorage.setItem('pos-print-via-agent', 'true'/'false')`. Errores con toast, NUNCA propagan. |
| `print-agent/` | Daemon Node.js standalone. Su propio package.json, tsconfig, .env.example, .gitignore. |
| `print-agent/src/printer-adapter.ts` | Adapter sobre `node-thermal-printer`. ESC/POS por `tcp://<ip>:9100`. Perfil `PrinterTypes.EPSON` (las AON son compatibles ESC/POS estándar). `CharacterSet.WPC1252` para acentos/ñ. Renderers `renderReceipt` (con dedupeo de items + totales) y `renderKitchen` (con motivo de void si aplica). Función `testPrint()` para probar sin payload real. |
| `print-agent/src/cli-test-print.ts` | CLI standalone: `npx tsx src/cli-test-print.ts --ip=192.168.1.50 --station=kitchen-1`. Útil para verificar conectividad sin pasar por el ERP. |
| `print-agent/src/config.ts` | Carga `.env`. `PRINTERS_JSON` es JSON serializado con array `[{station, ip, port}]` — editable sin recompilar. |
| `print-agent/src/api-client.ts` | Wrapper fetch hacia el ERP. Bearer + Tenant-Id en cada call. |
| `print-agent/src/index.ts` | Loop principal. `setInterval(pollIntervalMs)`. Lock interno `inFlight` para no solapar. Graceful shutdown SIGINT/SIGTERM. |
| `print-agent/scripts/install-service.ts` | Registra como Windows Service "KPSULA Print Agent" via `node-windows`. Auto-restart con backoff. |
| `print-agent/scripts/uninstall-service.ts` | Desinstala el servicio. |
| `print-agent/README.md` | Guía paso a paso para Jonathan. Troubleshooting con tabla síntoma → solución. |

### 39.4 Variables de entorno requeridas

**Vercel** (lado ERP):
- `PRINT_AGENT_API_KEY` — secreto compartido. Generar con `openssl rand -hex 32`.

**`.env` en Pickup-1** (lado agent):
```env
ERP_URL=https://shanklish-erp-main.vercel.app
API_KEY=<misma-clave-que-Vercel>
TENANT_ID=tnt_shanklish_caracas
POLL_INTERVAL_MS=1000
PRINTERS_JSON=[{"station":"kitchen-1","ip":"192.168.1.50","port":9100}]
DEFAULT_STATION=kitchen-1
```

### 39.5 Flow end-to-end del primer print real

1. Jonathan asigna IP estática a la primera AON (ej. `192.168.1.50`).
2. Verifica `ping 192.168.1.50` + `Test-NetConnection -ComputerName 192.168.1.50 -Port 9100`.
3. Instala Node 20 en Pickup-1.
4. `cd C:\kpsula-erp\print-agent`, `npm install`.
5. Copia `.env.example` a `.env`, edita IPs + API_KEY.
6. Test sin ERP: `npx tsx src/cli-test-print.ts --ip=192.168.1.50`. Sale hoja "KPSULA PRINT AGENT — Test de conectividad".
7. Configura `PRINT_AGENT_API_KEY` en Vercel.
8. Modo dev: `npm run dev`. Loop arranca.
9. Desde el POS, llamar `enqueueReceipt(payload, 'kitchen-1')`. En <2s sale el recibo.
10. Para producción: `npm run build` + `npx tsx scripts/install-service.ts` (PowerShell elevado).

### 39.6 Pendientes Fase 2+

- **Migración progresiva del POS**: hoy `enqueueReceipt()` está como wrapper paralelo a `printReceipt()`. Cada lugar del POS que llame `printReceipt()` se migra uno a uno usando `shouldUseAgent()`.
- **UI de monitoreo**: `/dashboard/admin/print-jobs` con lista, filtros, retry manual, reset huérfanos. La server action `getRecentPrintJobsAction()` ya está lista.
- **WebSocket en lugar de polling** (v0.2.0): latencia <100ms.
- **Multi-tenant**: el `PrintJob` ya tiene `tenantId`. Falta auth de agent por tenant (`PRINT_AGENT_API_KEY_<slug>`) cuando arranque Fase 3.
- **Otras 6 impresoras**: agregar progresivamente a `PRINTERS_JSON` y el ERP enruta por `station`.

---

## 40. Infraestructura — pendientes operativos (snapshot 2026-05-18)

Tareas concretas a ejecutar en sesiones futuras sin tocar producción hoy.
El negocio está abierto y operando; cualquier acción debe ser reversible
y no causar downtime. Si una tarea requiere ventana de mantenimiento, se
agenda y confirma con el operador antes.

### 40.1 Backups — off-site (alta prioridad)

**Estado actual**: cron diario en VPS a las 7am (`/usr/local/bin/capsula-backup.sh`)
deja dumps en `/var/lib/postgresql/backups/` con retención 30 días.

**Hueco**: los dumps viven en el MISMO host físico que la BD. Si el VPS
muere (disco, hack, error humano que borre `/var/lib/postgresql`),
perdemos BD y backup en un solo evento.

**Plan** (~2h trabajo, cero impacto producción):
1. Crear bucket S3 / Cloudflare R2 dedicado (`capsula-backups`).
2. Script `scripts/upload-backup-offsite.sh` que toma el dump del día y
   lo sube. Idempotente: si ya existe, no re-sube.
3. Workflow GitHub Actions diario (8am Caracas, post-cron del VPS) que
   ejecuta el upload vía SSH al VPS. Notifica fallo a un canal.
4. Lifecycle policy en el bucket: 90 días retención hot, archive a
   Glacier después de 90, delete a 365 días.
5. Smoke test de restore: 1 vez por mes, descargar el dump más reciente
   y restaurarlo a `capsula_erp_smoketest` en el VPS, verificar row
   counts, dropear. Workflow separado, manual o cron mensual.

### 40.2 Per-tenant backup (media prioridad)

**Por qué**: cuando haya ≥2 tenants, "exportame mi data" o "restaurame
solo a mí sin tocar a los otros" requiere dump filtrado por tenantId.

**Plan**:
- Script `scripts/backup-tenant.ts`: itera modelos tenant-aware, dumpea
  `WHERE tenantId='X'`, output SQL o JSON.
- Sube a `s3://capsula-backups/tenants/<slug>/<date>.sql.gz`.
- Workflow Actions con input `tenant-slug`.

### 40.3 Apagar Vercel (baja prioridad, alta visibilidad)

**Estado**: Vercel sigue corriendo pero el DNS de `kpsula.app` ya apunta
al VPS (cutover completo en §18.43, 2026-05-08). Nadie le pega tráfico
productivo desde entonces.

**Plan** (revisar mañana — bloque dedicado):
1. Confirmar 7+ días seguidos sin tráfico productivo a Vercel (Vercel
   Analytics → si está vacío salvo health checks ocasionales, OK).
2. Validar que las features críticas del último mes funcionan en VPS:
   POS mesero, restaurante, cierre de caja, reportes Z, impresión
   térmica vía print-agent, inventario diario.
3. Si todo OK: pausar el proyecto en Vercel (no eliminar, solo pausar).
   Si nada se queja en 48h, eliminar.
4. Eliminar variables de entorno de Vercel del repo (`vercel.json` si
   aplica, `vercel-build` script en `package.json`).

**No tocar nada de esto sin antes**:
- Off-site backups activos (§40.1).
- Confirmación operador.
- Ventana de bajo tráfico.

### 40.4 AWS RDS — dump final + terminate (baja prioridad)

**Estado**: la instancia RDS `shanklisherp.cbau4e08oxxx.us-east-2.rds.amazonaws.com`
existe en AWS pero no recibe queries desde el cutover. Posiblemente
sigue facturando ~$15-20/mes.

**Plan**:
1. `pg_dump` final de RDS, comprimido, subir a S3 archive
   (`s3://capsula-archive/aws-rds-final/`). Costo ~$0.10/mes en IA.
2. STOP (no terminate) la instancia RDS durante 7 días → confirma que
   nada externo la usa.
3. Si OK pasados 7 días: terminate + bajar snapshots de RDS a S3 antes
   de borrarlos.
4. Rotar credenciales del role `juninho26` que sigue activo en RDS
   (Pendiente §18.43.2).

### 40.5 Test de restore documentado

**Por qué**: backup no probado = no backup. Hoy nunca corrimos un
restore completo.

**Plan**:
- Doc `docs/BACKUP_RESTORE.md` con procedimiento exacto: cómo bajar un
  dump, restaurar a una BD escratch, verificar row counts.
- Correrlo 1 vez con el operador presente para confirmar tiempos.
- Repetir mensualmente como parte del smoke test §40.1.5.

---

## 41. 🚨 REGLA DURA — Nunca redirigir a localhost en producción

**TL;DR**: cualquier `redirect()` / `rewrite()` en código que corra detrás
de nginx **DEBE construir la URL absoluta leyendo los headers** que el
proxy forwardea (`X-Forwarded-Host` / `Host` / `X-Forwarded-Proto`).
Usar `request.url` o `request.nextUrl` **rompe** y manda al browser a
`http://localhost:3000/...`.

### 41.1 Por qué — la trampa de Next.js 14 standalone

En `output: "standalone"` (que es lo que corre en el VPS Contabo vía
pm2), el server bindea a `127.0.0.1:3000`. Cuando middleware o un route
handler hace:

```ts
new URL('/login', request.url)        // ❌
request.nextUrl.clone()                // ❌
```

…ambas resuelven a `http://localhost:3000/login` **aunque el browser
hubiera pegado a `https://kpsula.app/dashboard`** y aunque nginx tenga
`proxy_set_header Host $host`. Next.js construye `request.url` desde el
bind address, **no del header `Host`**.

Resultado: `NextResponse.redirect(...)` manda `Location: http://localhost:3000/...`
y el browser muestra "no se puede conectar al servidor".

### 41.2 Patrón correcto — helper `siteUrl(request, target)`

Vive en `src/middleware.ts` y replicado en `src/app/auth/bootstrap/route.ts`.
Lee `X-Forwarded-Host` / `Host` directamente. Solo confía si el host
está en la familia `kpsula.app` (defensa anti Host Header injection):

```ts
function siteUrl(request: NextRequest, target: string): URL {
    const rawHost =
        request.headers.get('x-forwarded-host') ??
        request.headers.get('host') ??
        '';
    const host = rawHost.split(',')[0].trim().toLowerCase();
    const proto =
        (request.headers.get('x-forwarded-proto') ?? '').split(',')[0].trim() ||
        request.nextUrl.protocol.replace(':', '') ||
        'https';

    const [pathname, search] = target.split('?');
    const isTrustedHost = host === 'kpsula.app' || host.endsWith('.kpsula.app');

    if (isTrustedHost) {
        const u = new URL(`${proto}://${host}${pathname}`);
        if (search) u.search = `?${search}`;
        return u;
    }
    // Fallback dev/local: comportamiento previo.
    const u = request.nextUrl.clone();
    u.pathname = pathname;
    u.search = search ? `?${search}` : '';
    return u;
}
```

### 41.3 Reglas de oro al tocar middleware / route handlers

1. **Nunca** uses `new URL('/x', request.url)` ni `new URL('/x', req.url)`
   para `redirect()` o `rewrite()`. Es el patrón que rompe.
2. **Nunca** uses `request.nextUrl.clone()` solo para construir un
   redirect absoluto. En standalone se evalúa al bind address.
3. **Siempre** usa el helper `siteUrl(request, '/path')` para redirects/
   rewrites del middleware. Si el archivo no es middleware, copia el
   helper local (como hicimos en `bootstrap/route.ts`).
4. **Redirects relativos** (`return redirect('/dashboard')` desde
   `next/navigation` en server components / actions) **son seguros** —
   no construyen URL absoluta, el browser resuelve relativo al host
   actual. NO requieren `siteUrl`.
5. **El allowlist de hosts en `siteUrl` debe incluir cualquier dominio
   raíz nuevo** que demos de alta. Hoy: `kpsula.app` + subdomains. Si
   en el futuro agregamos `capsula.io` u otro, actualizar el check.

### 41.4 Historial del bug (no repetirlo)

- **PR #189 (15 mayo 2026)**: primer fix — cambió `new URL(t, request.url)`
  por `request.nextUrl.clone()`. Funcionó un tiempo. **No es el fix
  correcto**: depende de cómo Next.js construye `nextUrl` internamente,
  que cambió con upgrades menores.
- **PR #214 (21 mayo 2026)**: fix definitivo — `siteUrl` lee headers
  directamente. Cubre middleware y `auth/bootstrap`. **Este es el
  patrón a copiar a futuro.**

### 41.5 Test manual rápido (5 segundos)

Cuando toques redirects, antes de mergear ejecuta en el VPS post-deploy:

```bash
# Debe responder con kpsula.app, NUNCA con localhost:
curl -sI -H 'Host: kpsula.app' http://localhost:3000/dashboard | grep -i location
# → location: http://kpsula.app/login   ✅

# Vía nginx (lo que ve el browser real):
curl -sI https://kpsula.app/dashboard | grep -i location
# → location: https://kpsula.app/login  ✅
```

Si CUALQUIER `Location:` muestra `localhost:3000` → no mergees, el bug
volvió.

### 41.6 Auditoría periódica

`grep -rn "new URL.*req.*\.url\|new URL.*request.*\.url\|nextUrl\.clone()" src/`
no debería matchear nada en código que se ejecute en request context.
Hits en route handlers / middleware / server actions deben migrarse a
`siteUrl`. Hits en tests o utilidades fuera de request (como `searchParams`
de un URL) son seguros — solo es problema cuando se construye una URL
para `Location:`.

## 42. Hora de entrega solicitada en PICKUP / DELIVERY (2026-05-21)

### 42.1 Contexto

Pedido de la visita SHANKLISH: la cajera necesitaba poder marcar la hora
exacta a la que el cliente quiere recibir su pickup o delivery, y que esa
hora se imprima grande en la comanda de cocina/barra para que prioricen
vs. los pedidos "ASAP".

Hasta ahora la cocina recibía todo igual y tenía que adivinar por orden
de llegada al ticket — funcionaba mal cuando un cliente pedía a las 4pm
para retirar a las 7pm: la cocina lo cocinaba a las 4 y se enfriaba.

### 42.2 Modelo de datos

Campo nuevo en `SalesOrder`:

```prisma
scheduledDeliveryTime DateTime?
```

Nullable: si la cajera no lo captura, la cocina lo trata como "lo antes
posible" (comportamiento histórico). Migración:
`prisma/migrations/20260521163926_add_scheduled_delivery_time/migration.sql`.

### 42.3 Flujo

1. **POS Delivery** (`src/app/dashboard/pos/delivery/page.tsx`):
   input `type="time"` al lado de la dirección. El helper
   `scheduledTimeToISO(hhmm)` convierte `HH:MM` (local) a ISO anclado a HOY
   — si la hora ya pasó (cajera marca 14:30 y son las 15:00), salta al día
   siguiente automáticamente.
2. **POS Pickup** (sección pickup de `pos/restaurante/page.tsx`):
   input `type="time"` en el modal de "Nueva venta Pickup" + input editable
   en el panel derecho (para corregir al vuelo si la cajera lo olvidó al
   crear el tab). Se persiste en el `PickupTabLocal` por tab — cada tab
   tiene su propia hora.
3. **`createSalesOrderAction`** recibe `scheduledDeliveryTime?: string`
   (ISO) en `CreateOrderData` y lo persiste como DateTime.
4. **Comanda cocina/barra** (`enqueueKitchenCommand` → `printKitchenCommand`
   y `print-agent/printer-adapter.ts`): si la orden tiene
   `scheduledDeliveryTime`, se imprime en un recuadro grande con
   "ENTREGAR A LAS HH:MM" debajo del header y antes de la lista de items.

### 42.4 Por qué un input `type="time"` y no datetime

La hora siempre es del día actual (o del siguiente si ya pasó). No tiene
sentido pedirle a la cajera teclear la fecha — la app la infiere. El
input nativo `type="time"` es perfecto: 5 keystrokes max (`19:30`), valida
formato sin JS, y los browsers móviles renderizan un picker táctil.

### 42.5 Helpers compartidos

`scheduledTimeToISO(hhmm: string): string | undefined`
- En `pos/delivery/page.tsx` y `pos/restaurante/page.tsx` (copia local).
- Acepta `'HH:MM'`, devuelve ISO o `undefined` si vacío/inválido.
- Si la hora ya pasó (> 1 min atrás), salta a mañana.

Si más pantallas necesitan capturar hora de entrega, mover a
`src/lib/scheduled-time.ts`.

## 43. Tablas — modifier group "Platos Principales" (2026-05-21)

### 43.1 Contexto

Las Tablas (`TABLA-X1`, `TABLA-X2`, `TABLA-X4`) son combos cuya
descripción dice "3 principales, 2 cremas, 1 shanklish, 1 ensalada y pan"
(x1/x2) o "3 principales, 4 cremas, 2 shanklish, 1 ensalada y pan" (x4).
Hasta ahora sólo el grupo "Cremas" estaba vinculado (fix de cremas en x4
en §18.x / PR #197). Los "3 principales" no estaban en el menú — la
cajera los anotaba a mano y la cocina los improvisaba.

### 43.2 Solución

Script:
`scripts/add-platos-principales-to-tablas.ts`

Crea (idempotente) un grupo `MenuModifierGroup` "Platos Principales (Tabla)"
con `minSelections=3`, `maxSelections=3`, `isRequired=true`, lo puebla con
los 10 principales por defecto (Falafel, Kibbe Crudo, Kibbe Horneado,
Kibbe Frito, Mini Kibbe Frito, Pinchos de Pollo/Carne/Kafta/Mixto, Arroz
con Pollo Libanés — todos con `priceAdjustment: 0` porque el costo va
contra el precio de la Tabla) y lo vincula a las 3 Tablas.

Uso:
```bash
# Dry-run (ver qué hará):
npx tsx scripts/add-platos-principales-to-tablas.ts --tenant-slug=shanklish

# Aplicar:
npx tsx scripts/add-platos-principales-to-tablas.ts --tenant-slug=shanklish --apply
```

Después de correrlo, el POS al agregar una Tabla muestra el grupo "Platos
Principales (Tabla)" como obligatorio con exactamente 3 selecciones. La
lista se puede editar luego desde `/dashboard/menu/modificadores`.

### 43.3 Por qué priceAdjustment=0

El precio de la Tabla ya incluye los 3 principales. Cobrar extra por
elegir Kibbe Crudo vs Falafel sería incorrecto — el cliente paga el
combo, elige las opciones internas. Si en el futuro algún principal es
"premium" (ej. carne especial), se sube el `priceAdjustment` de ese
modifier individual desde la UI; el resto queda en 0.

### 43.4 Compatibilidad con descargo de inventario

Estos modifiers nuevos NO tienen `linkedMenuItemId` configurado todavía,
así que NO descuentan inventario por sí solos. La Tabla descuenta su
receta como un todo (cuando esté hecha) o se contabiliza por el
modificador SIN/CON (§ ese tema). Próximo paso si se necesita: linkear
cada modifier a su MenuItem-ingrediente equivalente para que la cocina
vea el SIN/CON real reflejado en stock.
---

## 44. 🚨 Migraciones Prisma — deploy DEBE correr `migrate deploy`

**TL;DR**: cada PR que toca `prisma/schema.prisma` genera una migración en
`prisma/migrations/`. El script `scripts/deploy-vps.sh` ahora corre
`npx prisma migrate deploy` ANTES del swap atómico. Si una migración
falla, el deploy aborta — la app vieja sigue atendiendo sin downtime.

### 42.1 El bug que descubrió la regla (21 mayo 2026)

PR #216 (`feat(pos): hora de entrega en pickup/delivery`) agregó la
columna `SalesOrder.scheduledDeliveryTime` con su migración
`20260521163926_add_scheduled_delivery_time/migration.sql`. El deploy
ejecutó:
- `npm ci`
- `npm run build` (que incluye `prisma generate` → cliente Prisma con
  el campo nuevo en sus tipos TS)
- swap + pm2 restart

**Pero NO ejecutó `npx prisma migrate deploy`**, así que la columna nunca
se agregó a la BD productiva. Al primer cobro:

```
Error al crear la orden: Invalid `prisma.salesOrder.create()` invocation:
The column `SalesOrder.scheduledDeliveryTime` does not exist in the current database.
```

La cajera no podía cobrar ninguna orden. Fix manual en producción:
```bash
cd /var/www/capsula-erp
npx prisma migrate deploy
pm2 reload capsula-erp
```

Tiempo de resolución: 2 minutos (incluyendo diagnóstico).

### 42.2 Fix del script de deploy

`scripts/deploy-vps.sh` agrega el step `[7/10] prisma migrate deploy`
entre el copy de assets y el smoke test:

```bash
set -a; source .env; set +a
if ! npx prisma migrate deploy; then
    echo "ERROR: migración Prisma falló. Abort sin swap."
    exit 1
fi
```

Orden completo del deploy ahora:
1. Backup BD
2. Clone fresh
3. Copy .env/ecosystem/start-server
4. `npm ci --include=dev`
5. `npm run build` (incluye `prisma generate`)
6. Copy public/ + .next/static al standalone
7. **`npx prisma migrate deploy`** ← nuevo
8. Smoke test Prisma vs BD
9. Swap atómico + pm2 restart
10. Verificación curl

Si el paso 7 falla, los pasos 8-10 no corren — la app vieja sigue viva.

### 42.3 Reglas para migraciones safe en producción viva

**Safe** (zero-downtime, aplicar sin ceremonia):
- `ADD COLUMN ... NULLABLE` (Postgres: instant, no rewrite)
- `ADD COLUMN ... NULLABLE DEFAULT '<const>'` (en Postgres 11+: instant)
- `CREATE TABLE`
- `CREATE INDEX CONCURRENTLY`
- `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` aparte

**Peligrosas** — necesitan plan separado:
- `DROP COLUMN` — primero deshacer todas las referencias en código + deploy,
  luego en un PR aparte dropear la columna
- `NOT NULL` sin default — primero backfill, luego constraint en PR aparte
- `RENAME COLUMN/TABLE` — primero crear el nuevo + dual-write, luego
  migrar lectores, finalmente dropear el viejo
- `ALTER TYPE` que cambia representación binaria — table rewrite, lock
  largo en tablas grandes (SalesOrder, InventoryMovement)
- Foreign key nueva sobre tabla grande — usar `NOT VALID` + `VALIDATE`
  por separado

### 42.4 Cómo verificar post-deploy

```bash
cd /var/www/capsula-erp
npx prisma migrate status
# Esperado:
#   Database schema is up to date!
```

Si dice "Following migration have not yet been applied:" → corré
`npx prisma migrate deploy` manualmente.

### 42.5 Cómo verificar ANTES de mergear un PR con schema change

```bash
# En tu rama local:
ls prisma/migrations/ | tail -3
# Debe estar la migración nueva. Si no, generarla:
npx prisma migrate dev --name <descripcion-corta>

# Commitea TANTO el schema.prisma COMO la carpeta de migración
git add prisma/schema.prisma prisma/migrations/
git commit -m "..."
```

Sin la migración committeada en el PR, el deploy va a fallar.

### 42.6 Auditoría rápida

```bash
# ¿Hay diferencia entre el schema y la BD?
cd /var/www/capsula-erp && npx prisma migrate status

# Ver últimas 5 migraciones aplicadas
DB_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB_URL" -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;'
```

## §43 Sprint de aislamiento tenant (2026-05-22, PR #221)

Auditoría completa pre-onboarding del segundo tenant. Hallazgos críticos
cerrados antes de que se vuelvan explotables.

### 43.1 Cross-tenant context guard

**Bug**: la cookie de sesión (`domain=.kpsula.app`) viaja a todos los
subdomains. `resolveTenantContext()` priorizaba el slug del host SIN
validar que `session.tenantId` coincidiera — un user de tenant A podía
operar como tenant B simplemente navegando al subdomain ajeno con su
cookie intacta.

**Fix** (`src/lib/tenant-context.server.ts`, `src/middleware.ts`):
- Resolver lanza `CrossTenantAccessError` si `session.tenantId !==
  host.tenantId` y `!isSuperAdmin(session.email)`.
- Middleware (Edge runtime) compara a nivel slug usando un nuevo campo
  `tenantSlug` del JWT — sin tocar Prisma. Si difieren, redirect a
  `/login?error=wrong_tenant` + clear cookie.

**JWT change**: `SessionPayload.tenantSlug?: string` (auth.ts). Populado
en `loginAction` (auth.actions.ts), `/auth/bootstrap`, y
`changePasswordAction` (user.actions.ts) leyendo `tenant.slug` desde DB.
JWTs viejos sin `tenantSlug` no son bloqueados por middleware (compat)
pero `resolveTenantContext()` server-side sí valida vía DB.

**Excepción super admins**: por diseño operan como cualquier tenant
(impersonation natural). El allowlist `SUPER_ADMIN_EMAILS` (env var, ver
§38.17) es la única forma de cruzar tenants.

### 43.2 Uploads seguros + endpoint protegido `/api/files`

**Bug**: `/api/upload` POST sin auth + archivos en `public/uploads/notas-
entrega/` (sin namespace por tenant). URL guessable.

**Fix**:
- POST require sesión + tenantId del context.
- Path en disco: `storage/uploads/<tenantId>/notas-entrega/<uuid>.<ext>`
  (FUERA de `public/` — nginx no sirve).
- Filename con `crypto.randomUUID()`. Extension SOLO del MIME validado.
- Nuevo GET `/api/files/[...path]/route.ts`: valida sesión + tenant
  ownership (primer segmento del path debe ser `ctx.tenantId` o
  super admin). Defensa anti path-traversal vía `path.normalize` +
  `startsWith(tenantDir + sep)`.
- Script one-off: `scripts/migrate-uploads-to-tenant-scoped.ts` mueve
  archivos existentes + reescribe `InventoryMovement.documentUrl` en DB.
  Soporta `--dry-run`. Aborta si hay >1 tenant en BD (requiere
  clasificación manual).

### 43.3 IDORs por id sin filtro tenant

`withTenant()` no filtra `findUnique/update/delete` (uniques globales).
4 actions arregladas:

| Archivo:línea | Modelo | Fix |
|---|---|---|
| `audit.actions.ts:163-176` | InventoryAuditItem | `db.findFirst` + `updateMany` con id |
| `pos.actions.ts:deleteSubAccountAction` | TabSubAccount | `deleteMany` con `openTab: { tenantId }` |
| `pos.actions.ts:retryInventoryDeductionFromOutbox` | InventoryDeductionRetry | Carga `salesOrder.tenantId`; si difiere de ctx → SKIPPED + warn + back to PENDING |
| `inventory-daily.actions.ts:369,398` | DailyInventoryItem | Filtro `dailyInventory: { tenantId }` en delete/update |

`InventoryDeductionRetry` y `DailyInventoryItem` NO son tenant-aware en
schema — su aislación se hereda por FK al modelo padre que sí lo es.
Las queries deben filtrar por la relación.

### 43.4 Strict mode auto-detect

`MULTI_TENANT_STRICT=true` no estaba seteada en VPS → fallback Shanklish
silencioso seguía activo. `isStrictMode()` ahora chequea env var **O**
`prisma.tenant.count() > 1` con cache de 60s. El día que se crea el
segundo tenant, strict mode entra solo — sin necesidad de tocar `.env`.

### 43.5 Endpoints lockdown

- `/api/cron/retry-inventory-deductions`: en `NODE_ENV=production`, sin
  `CRON_SECRET` configurado → 503 + log error. Antes pasaba sin auth.
- `/api/debug/whoami`: 404 si `!isSuperAdmin`. Antes leakeaba
  `MODULE_REGISTRY` + `SystemConfig` parseado a cualquier user logueado.

### 43.6 Deploy notes

Post-merge del PR #221:

```bash
# En el VPS, una vez:
cd /var/www/capsula-erp
npx tsx scripts/migrate-uploads-to-tenant-scoped.ts --dry-run
npx tsx scripts/migrate-uploads-to-tenant-scoped.ts

# Verificar:
grep '^SUPER_ADMIN_EMAILS' .env       # solo Omar + Gustavo
grep '^CRON_SECRET' .env              # debe existir y ser ≥32 chars
```

### 43.7 Pendientes para sprint futuro

- **RLS Postgres**: defensa-en-profundidad a nivel BD. 47 modelos ×
  `ALTER TABLE ENABLE ROW LEVEL SECURITY` + policies + middleware
  Prisma que setea `SET app.current_tenant`. ~1-2 días.
- **Refactor multi-tenant del cron de retries**: hoy el guard
  (§43.3) detecta y skipea cross-tenant. Para que procese correctamente
  retries de cualquier tenant: pasar `tenantId` por argumento o usar
  AsyncLocalStorage en `getTenantDb()`.

### 43.8 Deploy confirmado en producción (2026-05-22 20:26)

Sprint deployado al VPS Contabo vía `scripts/deploy-vps.sh`:

- Commit en HEAD: `d163623` (incluye PR #221 + #222 + #223 hotfix)
- BUILD_ID nuevo: `UuOWypQhZNLi5BjJj_vWh` (anterior: `6DjpuZ84sm...`)
- `prisma migrate deploy` → "No pending migrations to apply" (el sprint
  no tocó schema, riesgo BD cero)
- Smoke test post-swap: HTTP 200 en `/`, `/login`, `https://kpsula.app`;
  `curl /api/files/test/foo.jpg` → 401 (endpoint nuevo activo).

Migración de uploads viejos (`scripts/migrate-uploads-to-tenant-scoped.ts`)
**no necesaria** — query post-deploy mostró 0 rows de
`InventoryMovement.documentUrl LIKE '/uploads/notas-entrega/%'`. No hay
deuda técnica de uploads legacy; la estructura nueva
`/uploads/notas-entrega/<tenantId>/<archivo>` arranca limpia.

---

## §44 Estado de tenants en producción (2026-05-22)

Cuatro tenants viven en BD. Hasta hoy yo creía que solo había uno
(Shanklish) y eso me llevó a desarrollar features sin estricto
aislamiento. El sprint §43 cerró los huecos. Esta sección documenta
qué es cada tenant para no volver a asumir mal.

### 44.1 Inventario

| ID | Slug | Nombre | Users | Propósito |
|---|---|---|---|---|
| `tnt_shanklish_caracas` | `shanklish` | Shanklish Caracas | 25 | Producción real, cliente activo |
| `tnt_kpsula_admin` | `admin` | KPSULA Admin | 2 | Hogar de super admins (omar@, gustavo@) |
| `cmp5y3f4w000011mxdzvwqyls` | `demo` | Capsula Demo Bistró | 5 | Sandbox público para prospectos |
| `cmp4ap2bt0001rof8px6bs7f8` | (testtenant) | Test Tenant | 1 | Test seed temprano, candidato a borrar |

Importante: el slug se lee del subdomain (`<slug>.kpsula.app`). El
campo en `Tenant` se llama **`slug`**, NO `subdomain` (un error
común — la query falló al usar `subdomain`).

### 44.2 Super admins viven en su propio tenant

Los super admins (`omar@kpsula.app`, `gustavo@kpsula.app`) son users
con `tenantId = tnt_kpsula_admin`. Su email aparece en la env var
`SUPER_ADMIN_EMAILS` (allowlist, NO un rol de BD).

Implicancias:

- Pueden loguear desde cualquier subdomain (root o `<slug>.kpsula.app`):
  el filtro estricto por tenantId se relaja para emails en la allowlist
  (`auth.actions.ts` línea 73). Fix histórico: PR #218.
- Su tenant `tnt_kpsula_admin` no tiene branch, productos ni ventas
  reales — es solo el "container" para el user. Si caen a `/dashboard`
  van a ver vistas vacías.
- Por eso post-login con `isSuperAdmin === true` el cliente redirige
  a `/admin` (no a `/dashboard/home`). Ver §44.4.

### 44.3 Demo tenant — sandbox para prospectos

`scripts/seed-demo-tenant.ts` deja el tenant listo con data sintética
creíble (no datos reales de Shanklish):

- 5 users con todos los roles del POS (OWNER, ADMIN_MANAGER, CASHIER,
  CHEF, WAITER)
- Branch + 4 áreas + 3 zonas + 12 mesas
- 20 InventoryItems con stock realista + cost history
- 25 MenuItems en 5 categorías
- ~30 SalesOrders distribuidas en los últimos 14 días
- 5 Expenses de muestra + 2 Suppliers + 1 ExchangeRate

**Credenciales públicas (hardcoded en el seed Y en el cartelito del
login)**:

| Rol | Email | PIN |
|---|---|---|
| Dueño | `owner@demo.kpsula.app` | 1234 |
| Gerente | `admin@demo.kpsula.app` | 2345 |
| Cajera | `caja@demo.kpsula.app` | 3456 |
| Chef | `chef@demo.kpsula.app` | 4567 |
| Mesero | `mesero@demo.kpsula.app` | 5678 |

**Password único**: `kpsula-demo`. Si se cambia, sincronizar **DOS
lugares**: `scripts/seed-demo-tenant.ts` (constante `DEMO_PASSWORD` en
`main()`) Y `src/app/login/demo-credentials-card.tsx` constante
`DEMO_PASSWORD`. Después, en el VPS:

```bash
set -a && source /var/www/capsula-erp/.env && set +a
npx tsx scripts/reset-demo-password.ts --dry-run       # verificar
npx tsx scripts/reset-demo-password.ts                 # aplicar
```

`reset-demo-password.ts` actualiza los hashes en BD SIN borrar la data
sintética (ventas, inventario, menú, mesas). Bumpea `tokenVersion`
para invalidar sessions activas → forzar relogin.

**Reseed completo**: si el demo se contamina (prospectos crearon basura,
ventas viejas, stock raro), `npx tsx scripts/seed-demo-tenant.ts
--slug=demo --reset` borra todo y rebuilda. El script lo hace
transaccionalmente.

**Cartelito visible**: `demo.kpsula.app/login` muestra las credenciales
en una card amarilla con copy-to-clipboard (solo si
`resolveTenantContext().slug === 'demo'`). En otros subdomains no
aparece nada.

### 44.4 Redirect post-login del super admin

Implementación (esta sesión):

1. `loginAction` devuelve `isSuperAdmin: boolean` en el response —
   computado server-side llamando a `isSuperAdmin(user.email)` contra
   la env var. El cliente nunca ve la lista.
2. `login-form-client.tsx` chequea ese flag ANTES del redirect normal:
   - `true` → `window.location.href = '/admin'` (reload completo para
     que el middleware recoja la cookie). NO usa `router.push` para
     evitar problemas de hidratación de cookie.
   - `false` → flujo normal (`computePostLoginUrl` o fallback a
     `/dashboard/home`).
3. `/admin/layout.tsx` agrega botón "Ver dashboard" en el header (al
   lado del email) como toggle al dashboard del tenant del propio
   user. Cuando se implemente impersonar (sesión futura), se reemplaza
   por un selector de tenants.

### 44.5 Panel SUPER_ADMIN — estado y roadmap

Hoy en `/admin`:

- Dashboard con KPIs globales (tenants activos, ventas 7/30/90d,
  cobrado al SaaS)
- Tendencia diaria 30d (SVG inline, sin libs)
- Ranking por tenant (revenue 30d)
- Últimos pagos al SaaS
- CRUD básico de tenants (`/admin/tenants`, `/admin/tenants/new`,
  `/admin/tenants/[id]`)

Roadmap acordado para sesiones futuras (cada bullet es un PR aparte
por tamaño):

- **Impersonar un tenant**: botón "Entrar como [X]" → abre dashboard
  del cliente sin pedir password. Con audit log obligatorio.
- **CRUD completo de tenants**: editar slug/plan/estado, desactivar,
  reset password masivo.
- **Cobros y planes de subscripción**: registrar pagos desde UI,
  historial por tenant, flag de moroso, billing automático.
- **Health checks y logs por tenant**: última actividad, errores
  recientes, jobs colgados, uso de uploads/disco.

### 44.6 Borrar un tenant (testtenant cleanup)

`scripts/delete-tenant.ts` borra un tenant + toda su data en cascada.
**Solo para tenants de test o demo abandonado.** Defensas:

- HARD BLOCK en código: `tnt_shanklish_caracas`, `tnt_kpsula_admin`,
  `cmp5y3f4w...` (demo) → nunca se borran, no importa qué flags se pasen.
- ALLOWLIST explícita: solo IDs listados en `ALLOWED_TENANTS` pueden
  borrarse. Agregar uno requiere PR.
- Backup check: en `--apply`, aborta si no hay backup `/root/backups/*.dump`
  de las últimas 24h.
- Default `--dry-run`: muestra counts por tabla sin tocar BD.

Uso típico:

```bash
set -a && source /var/www/capsula-erp/.env && set +a

# Ver qué se borraría (dry-run, default)
npx tsx scripts/delete-tenant.ts --id=cmp4ap2bt0001rof8px6bs7f8

# Aplicar (requiere backup BD reciente)
npx tsx scripts/delete-tenant.ts --id=cmp4ap2bt0001rof8px6bs7f8 --apply
```

Después de borrar, remover el ID de `ALLOWED_TENANTS` en el código y
mergear — la allowlist debe quedar vacía después de cada cleanup para
evitar acumulación de "puertas abiertas".

## §45 Pre-flight onboarding Sello Criollo + Table Pong (2026-05-23)

Sprint específico para validar que el aislamiento multi-tenant es seguro
para incorporar dos clientes nuevos en simultáneo. Resultado: **sistema
safe en código** después de arreglar 4 bugs encontrados durante el audit.

### 45.1 Audit estático — `scripts/audit-tenant-isolation.ts`

Script que escanea todos los archivos de `src/app/actions/*.actions.ts`
y `src/app/api/**/route.ts` y clasifica el uso de Prisma en 5 categorías:

| Clasif | Significa |
|--------|-----------|
| OK | Usa `withTenant` exclusivamente, sin queries `prisma.<modelo>` directas |
| WHITELIST | Cross-tenant legítimo (login, signup, super admin, cron, files con guard propio) |
| MANUAL | Hace `prisma.<modelo>` directo PERO con filtro manual de tenantId visible en ±15 líneas |
| REVIEW | Importa `withTenant` pero hace `prisma.<modelo>` directo sin filtro detectable. **Validar manualmente** |
| DANGER | No usa `withTenant` ni filtro manual → bug cross-tenant casi seguro |

Estado actual (2026-05-23): 38 OK / 14 WHITELIST / 5 MANUAL / 5 REVIEW
(todos validados como FK upstream o tx-scoped) / **0 DANGER**.

Uso:
```bash
npx tsx scripts/audit-tenant-isolation.ts            # report
npx tsx scripts/audit-tenant-isolation.ts --strict   # exit 1 si hay REVIEW/DANGER
```

Para CI: cuando el equipo migre los 5 REVIEW restantes a `withTenant`,
agregar `--strict` al pipeline y el script bloqueará cualquier PR que
introduzca regresión.

### 45.2 Bug crítico — cron retry de outbox solo procesaba Shanklish

Síntoma: la función `retryInventoryDeductionFromOutbox` resolvía el
tenant del contexto del request. El cron corre sin sesión → caía al
fallback Shanklish → los retries de otros tenants se rechazaban con un
guard cross-tenant y quedaban en PENDING para siempre. Impacto: Sello
Criollo o Table Pong podrían tener una venta donde la deducción de
inventario falla por timeout y el reintento automático **nunca corre**.

Fix (`src/app/actions/pos.actions.ts` + cron route):

- `retryInventoryDeductionFromOutbox(retryId, { source })` acepta ahora
  un `source` explícito: `'cron'` o `'authenticated'`.
- En path cron, NO llama `resolveTenantContext` — el tenant viene del
  `salesOrder.tenantId` del retry (source of truth).
- En path authenticated, valida que el ctx del request coincide con el
  tenant del retry. Si no, devuelve a PENDING + SKIPPED. Anti
  cross-tenant manual desde UI/debug.
- `registerInventoryForCartItems` acepta `tenantId?: string` opcional
  para callers sin sesión HTTP. Internal helper `loadRecipe` ahora usa
  el `db` outer (closure) en vez de re-llamar `getTenantDb` (bug latente
  que doble-resolvía contexto).

Tests: `src/app/actions/pos.actions.retry-isolation.test.ts` cubre
los 4 paths críticos con mocks de Prisma.

### 45.3 Bugs cross-tenant en `protein-processing.actions.ts`

ProcessingTemplate no tiene `tenantId` directo en schema — hereda vía
`sourceItem` (InventoryItem). Tres actions hacían queries sin filtrar
por ese FK:

- `getTemplateBySourceItemAction`: leía templates por `sourceItemId` sin
  validar tenant. Fix: agregado `sourceItem: { tenantId }` al `where`.
- `createProcessingTemplateAction`: creaba templates colgando de
  `sourceItemId` del input sin validar ownership. Fix: valida que
  `sourceItem` y todos los `outputItemId` pertenecen al tenant ANTES
  del create. Si no, devuelve "not found".
- `deleteProcessingTemplateAction`: soft-delete por `id` sin validar.
  Fix: `updateMany` con `where: { id, sourceItem: { tenantId } }` →
  si count=0, retorna "not found".

### 45.4 Print Agent — multi-tenant en código, pendiente operativo

Print Agent (`/api/print-agent/*`) **es multi-tenant safe en código**:

- API key per-tenant via `PRINT_AGENT_TENANT_KEYS` (JSON `{tenantId: key}`)
- Header `X-Tenant-Id` se IGNORA — no se acepta input del cliente
- Cada update filtra por `tenantId: auth.tenantId` en el `where`

**Antes de meter Sello Criollo / Table Pong** con impresoras térmicas:

1. Generar API key para cada tenant: `openssl rand -hex 32`
2. Agregar al JSON en `/var/www/capsula-erp/.env`:
   ```
   PRINT_AGENT_TENANT_KEYS='{"tnt_shanklish_caracas":"<key>","tnt_sellocriollo":"<key>","tnt_tablepong":"<key>"}'
   ```
3. Configurar el daemon `print-agent` en cada PC del restaurante con su
   key correspondiente
4. Eliminar `PRINT_AGENT_API_KEY` legacy single-tenant para evitar fallback

### 45.5 Pendientes operativos antes de onboarding

| # | Acción | Riesgo si se omite |
|---|--------|--------------------|
| 1 | Verificar cron real corriendo en VPS contra `/api/cron/retry-inventory-deductions` | Ningún tenant procesa retries (Shanklish incluido) |
| 2 | Configurar `PRINT_AGENT_TENANT_KEYS` JSON con todas las keys | Solo Shanklish puede imprimir |
| 3 | Smoke test multi-tenant con tenant temporal "smoketest" → eliminar | Sin validación end-to-end del aislamiento |
| 4 | Borrar testtenant (allowlist ya configurada) | Tenant huérfano en BD |
| 5 | Audit log central de cross-tenant attempts | Sin visibilidad si alguien intenta cross-tenant |

Los puntos 1-4 son **bloqueantes**. El punto 5 es mejora — defensa en
profundidad pero el código ya bloquea los intentos.

## §46 🚨 BUG TAB-2433 — propina fantasma con descuentos + mesero

**Estado**: ✅ **CÓDIGO CORREGIDO (PR #270 parcial + PR #271 definitivo, 2026-06-06).**
La auditoría de las 10 PKP del día (query de Paso 6) reveló que el problema
era MÁS profundo que el prefill: la propina de mesa se **doble-contaba** (una
vez en el excedente del split, otra en la PKP colectiva creada en el cobro).
PR #271 lo resuelve de raíz (ver "Causa raíz REAL" abajo). Limpieza de datos
históricos: el dueño decidió NO anular (no necesario); de acá en adelante NO
se generan PKP fantasma y el cierre cuenta la propina UNA sola vez.

### Causa raíz REAL (descubierta en la auditoría de datos, PR #271)

`history.actions.ts:214-215` y `z-report.actions.ts:198-200` ya calculan la
propina de mesa como `Σ split.paidAmount − factura` (excedente del split).
PERO `handlePaymentPinConfirm` ADEMÁS creaba una PKP "PROPINA COLECTIVA" con
el `checkoutTip`. Resultado:
- **Doble-conteo**: el excedente real se contaba 2 veces (split + PKP).
- **Fantasma**: el prefill del mesero (que el cliente no pagó) se sumaba como
  PKP encima. En pagos NO-efectivo la cajera ni ve un campo de propina, así
  que el prefill pasaba directo.
El cap de #270 redujo la fantasma pero seguía doble-contando el excedente chico.

### Fix definitivo (PR #271)

1. **Se eliminó la creación automática de PKP colectiva en el cobro de mesa.**
   La propina queda registrada en el **excedente del split**, que historial y
   Z report ya cuentan UNA vez (independiente del flag `unifyTipReporting`).
   El modal MANUAL de "Registrar Propina Colectiva" (para propinas en efectivo
   que entran aparte / pooled) se mantiene intacto.
2. **El split registra el monto RETENIDO** (`keptAmountForSplit` = factura +
   propina capada), no el bruto recibido. Así el excedente del split == propina
   real y el vuelto en efectivo deja de contarse como propina (arreglo bonus
   del over-count de cash). El arqueo también mejora: suma lo que queda en caja,
   no el bruto con vuelto.
3. Funciones puras `suggestedTipAmount`, `cappedTipForPayment`, `keptAmountForSplit`
   en `src/lib/sales/tip-calculation.ts`, usadas por el código de producción,
   con 17 tests (incluye TAB-2433 exacto, efectivo con vuelto, parcial).

Resultado TAB-2433: split retiene $53 → excedente $0.20 (propina/redondeo real),
contado una vez. Sin PKP fantasma de $7.20. Recibo muestra $53, no $60.

### El caso: orden TAB-2433 (Luis caculler, cobrada por Nazareth, 2026-06-05)

| Concepto | Monto | Notas |
|---|---|---|
| Items (AYRAN x2 + Tabla x2) | $72.00 | subtotal bruto |
| Descuento divisas (-33.33%) | −$24.00 | autorizado por Omar Operaciones |
| Total neto (post-descuento) | $48.00 | |
| Servicio 10% sobre neto | $4.80 | correcto |
| **Factura real** | **$52.80** | |
| Cliente envió por Zelle | $53.00 | factura + $0.20 de redondeo |
| Split registrado en la mesa | $53.00 Zelle | ✓ coincide con banco |
| **PKP-0866 propina colectiva** | **+$7.20 Zelle** | ⚠️ **FANTASMA — el cliente NO envió esos $7.20** |
| Recibo impreso al cliente | "cobrado $60 / propina $7.20" | $52.80 + $7.20 sumado en el front |

### Causa raíz — son DOS bugs encadenados

#### Bug A (ESTRUCTURAL) — `setOpenTabTipAction` calcula la propina sobre el SUBTOTAL bruto

`src/app/actions/pos.actions.ts:2095`:
```ts
const tipAmount = data.tipPercent === 0 ? 0 : openTab.runningSubtotal * (data.tipPercent / 100);
```

Y el schema lo documenta así también (`prisma/schema.prisma`, comentario de
`OpenTab.tipAmount`): `tipPercent/100 × runningSubtotal`.

Cuando la mesa tiene descuento (DIVISAS_33, CORTESIA_PERCENT, CORTESIA_100),
`runningSubtotal` ≠ `runningTotal`. La propina sugerida del mesero queda
calculada sobre el monto **antes** del descuento → infla la propina en proporción
al descuento. Para TAB-2433: 10% × $72 = $7.20 cuando debería ser 10% × $48 = $4.80.

**El bug se dispara en TODA mesa con descuento + propina sugerida del mesero.**

#### Bug B — la propina sugerida se persiste como cobro real sin validar

Cuando la cajera abre el modal de cobro, `restaurante/page.tsx:2986-2987`
pre-rellena `checkoutTip` con `activeTab.tipAmount` (el valor que el mesero
seteó). Si la cajera no lo borra antes de confirmar, `handlePaymentPinConfirm`
(`restaurante/page.tsx:1112-1142`):
1. Imprime el recibo con `tipAmount` sumado al total → el ticket muestra "cobrado $60".
2. Llama `recordCollectiveTipAction({ tipAmount: 7.20, paymentMethod: 'ZELLE' })`
   → crea un `SalesOrder` ficticio con `customerName='PROPINA COLECTIVA'`,
   `amountPaid: 7.20`, método Zelle. Esa propina **nunca se cobró**.

No hay guard que valide que `amountReceived + checkoutTip ≤ entrega real`.
Si el cobro real es menor al esperado, el sistema **no avisa**.

### Que NO fue error manual de la cajera (descartado con prueba)

`OpenTab.tipAmount` solo se setea por `setOpenTabTipAction` (línea 2080), que
se invoca **únicamente** desde el POS Mesero (`mesero/page.tsx:954`). La cajera
no tiene UI para escribir directamente ese campo de la mesa. Si Nazareth
hubiera tipeado $7.20 a mano, habría quedado en `splitNotes` o en el tip del
split, NO en `OpenTab.tipAmount`. En la BD de TAB-2433 vimos
`OpenTab.tipAmount = 7.20` y `propina_split = 0.00` — esa asimetría solo se
explica si el mesero la seteó antes del cobro.

### Plan de fix

**✅ Paso 1 — Fix Bug A (HECHO, PR #270)**
- `setOpenTabTipAction` (`pos.actions.ts`) ahora usa `suggestedTipAmount(openTab.runningTotal, tipPercent)`
  (total neto) en vez de `runningSubtotal`.
- Comentario de `OpenTab.tipAmount` en `schema.prisma` actualizado a `runningTotal`.

**✅ Paso 2 — Fix Bug B (HECHO, PR #270)**
- En `handlePaymentPinConfirm` (`restaurante/page.tsx`) la propina se capa con
  `cappedTipForPayment({ intendedTip, amountPaid: effectiveAmount, totalAntesServicio, serviceFee })`
  → nunca excede el excedente realmente cobrado. El recibo y
  `recordCollectiveTipAction` usan ese valor capado (umbral 1¢). Para TAB-2433:
  $7.20 prefill → $0.20 real (factura $52.80, pagó $53).
- Observación clave que valida el cap: en pagos NO-efectivo la cajera no tiene
  campo de propina visible (solo el prefill del mesero), y en efectivo el campo
  inline ya capa al vuelto → capar al excedente nunca pierde propina legítima.

**✅ Paso 3 — Tests (HECHO, PR #270)**
- `src/lib/sales/tip-calculation.ts` (funciones puras `suggestedTipAmount` +
  `cappedTipForPayment`, usadas por el código de producción) + tests en
  `tip-calculation.test.ts`: 4 escenarios de descuento (sin, DIVISAS_33,
  CORTESIA_PERCENT, CORTESIA_100) + guard de Bug B (incluye el caso TAB-2433
  exacto).

**Paso 4 — PR + merge a main + deploy**
- Confirmar `prisma migrate status` post-deploy (no hay migración en este fix,
  pero por reflejo).

**Paso 5 — Limpieza retroactiva del caso puntual**

Anular PKP-0866 ($7.20 Zelle fantasma de Luis caculler) con SQL en transacción:
```sql
BEGIN;
-- Inspeccionar antes de commit
SELECT id, "orderNumber", "customerName", "amountPaid", "paymentMethod", notes
FROM "SalesOrder"
WHERE "orderNumber" = 'PKP-0866' AND "amountPaid" = 7.20;

-- Anular (soft-delete con voidReason)
UPDATE "SalesOrder"
SET status = 'CANCELLED',
    "voidReason" = 'Propina fantasma TAB-2433 — bug runningSubtotal vs runningTotal (§46)',
    "voidedAt" = NOW()
WHERE "orderNumber" = 'PKP-0866' AND "amountPaid" = 7.20;

-- Verificar
SELECT id, "orderNumber", status, "voidReason"
FROM "SalesOrder"
WHERE "orderNumber" = 'PKP-0866';

-- Solo si todo cuadra:
COMMIT;
```

**Paso 6 — Audit retroactivo del día 2026-06-05**

Buscar otras mesas con descuento + propina sugerida que hayan generado
propinas fantasma. Query candidata para el audit:
```sql
-- Propinas colectivas del 2026-06-05 que pudieron ser fantasma por el bug A.
-- Match: notas con "Mesa/Ref" + tenant Shanklish + día de Caracas.
SELECT so.id, so."orderNumber", so."amountPaid", so."paymentMethod",
       so.notes, so."createdAt"
FROM "SalesOrder" so
WHERE so."customerName" = 'PROPINA COLECTIVA'
  AND so."createdAt" >= '2026-06-05 04:00:00'  -- inicio día Caracas en UTC
  AND so."createdAt" <  '2026-06-06 04:00:00'
ORDER BY so."createdAt";
```
Cruzar caso por caso contra el extracto del banco / cierres físicos antes
de decidir anulación.

### Mitigación temporal (hasta el fix)

Mientras se hace el deploy mañana, las cajeras pueden seguir cobrando con
esta regla: **en mesas con descuento de divisas (DIVISAS_33) o cortesía,
borrar manualmente el campo "Propina" del modal de cobro si el cliente no
dejó propina explícita**. Si la mesa no tiene descuento, el cálculo es
correcto y el campo se puede dejar como está.

### Por qué no se aplica HOY (acordado)

El sitio está en operación activa post-emergencia (las 3 migraciones del día
recién se aplicaron en el VPS). Cualquier deploy nuevo podría volver a fallar
en build y dejar la web caída por horas. Se acordó esperar al cierre de hoy
y aplicar todo mañana cuando el sitio esté cerrado y se pueda tolerar el
redeploy.


## §47 Historial de ventas para cajera — solo lectura, sin método de pago (2026-06-06)

Requerimiento del dueño: el rol cajera debe poder ver el historial de cada
orden (tipo: pickup/delivery/mesa + monto) PERO sin ver el método de pago, y
sin acciones de gestión.

### Permiso nuevo `VIEW_SALES_HISTORY`
- En `permissions-registry.ts`. Otorgado a OWNER, AUDITOR, ADMIN_MANAGER,
  OPS_MANAGER y **CASHIER**. Mapea al módulo `sales_history` en
  `perm-to-modules.ts` (Capa 2: la cajera necesita el módulo `sales_history`
  habilitado en sus `allowedModules` — se activa por usuario en
  `/dashboard/config/modulos-usuario`).
- `getSalesHistoryAction` ahora gatea por `VIEW_SALES_HISTORY` (antes
  `EXPORT_SALES`, que la cajera no tiene). Exportar / Reporte Z / auditoría /
  anular siguen gated por `EXPORT_SALES` / `VOID_ORDER`.

### Solo lectura en la UI
- `getSalesHistoryAction` devuelve `canExport` (EXPORT_SALES) y `canVoid`
  (VOID_ORDER). `sales/page.tsx` oculta los botones de gestión (Auditoría,
  Exportar Excel, Reporte Z, Cierre del día) cuando `!canExport`, y el botón
  Anular cuando `!canVoid`. Reimprimir queda (la cajera tiene REPRINT_COMANDA;
  los datos ya vienen sin método).
- Default defensivo: si la respuesta no trae las capacidades, se asumen
  `false` (no exponer gestión por error).

### Método de pago — política (función pura `shouldHidePaymentMethod`)
`src/lib/permissions/payment-method.ts` (con tests):
- OWNER / ADMIN_MANAGER → nunca se oculta.
- Roles que exportan (OPS_MANAGER, AUDITOR) → oculto solo si el flag
  `hideCashierPaymentMethod` está ON (histórico).
- Roles de solo-lectura (cajera/mesero, sin EXPORT_SALES) → **SIEMPRE oculto**,
  independiente del flag. El strip server-side (deep, ver §259/scrub-payment)
  elimina el método de todo el payload (incluido `orders[]` anidado).

### Hueco cerrado
`getDailyZReportAction` no tenía gate de permiso → una cajera podía pedir el
arqueo (desglose por método) por DevTools. Ahora gateado por `EXPORT_SALES`.
`getEndOfDaySummaryAction` se deja sin ese gate porque lo usa el cierre de caja
de la cajera (`caja-view.tsx`) y NO expone métodos (solo divisas/Bs agregado).

### Para habilitarlo a una cajera
OWNER → `/dashboard/config/modulos-usuario` → activar el módulo "Historial de
ventas" para ese usuario cajera. (El permiso de rol ya lo tiene; falta el
módulo en sus allowedModules.)

## §48 Cartera de clientes — captura ampliada (2026-06-06)

Estado pedido por el dueño: "que el módulo de clientes vaya guardando a los
clientes" + "ver cada cliente y poder ver su historial al darle click".
**El listado, la ficha (`/dashboard/clientes/[id]`) y el módulo ya existen
desde §6.0.1 (PR #263).** Lo que faltaba era que se llenara desde más fuentes.

### Cambio: regla de auto-vínculo simplificada
`src/lib/customers/link.ts` ya no exige `orderType ∈ {DELIVERY, PICKUP}`. La
regla de oro queda: **hay teléfono usable + hay nombre real** → upsert por
teléfono. Esto cubre delivery, pickup del POS Restaurante (orderType
`RESTAURANT`) y cualquier flujo futuro que pase por `createSalesOrderAction`.
Las mesas siguen sin pasar por acá (cierran por `registerOpenTabPaymentAction`).

### Pickup del POS Restaurante ahora captura cliente
Se agregó un campo **Teléfono (opcional)** en el panel de pickup del POS
Restaurante (`pickupCustomerPhone`). Si la cajera lo escribe, la venta queda
vinculada al cliente y el cliente se guarda/actualiza en la cartera con sus
stats. Si no, la venta queda anónima como antes (sin romper nada). Se resetea
al cerrar el pickup tab.

### Tests
`src/lib/customers/link.test.ts` — `normalizePhone` (dedupe por teléfono
robusto a formato) e `isPlaceholderName` (nombres genéricos del POS no crean
fichas basura). 6 tests.

### Lo que queda pendiente (no se hizo hoy)
- Mesas: si una mesa tiene customerPhone en su OpenTab, al cerrarla
  (`registerOpenTabPaymentAction`) NO se vincula al cliente. Se puede agregar
  en una iteración futura — patrón idéntico (resolveCustomerForOrder + bump).
- Backfill histórico de ventas previas: el dueño dijo "no necesito" (§6.0.1).

## §49 POS Mesero — cuenta al cliente: 10% siempre visible + propina sobre neto (2026-06-06)

> ⚠️ **SUPERSEDIDO en parte.** El primer fix (PR #276) introdujo un bug de
> línea duplicada del 10%. La versión vigente está en **§49 (corregido)** y
> **§49.1** más abajo. Se conserva este bloque por el contexto del caso real.

Bug detectado durante el servicio del 6/6 (foto IMG_2614 vs IMG_2615): el POS
Mesero le muestra al cliente un total **distinto** al que la cajera cobra.

**Caso real (mesa Yair):**
- Items: $72 (Té $12 + Tabla x2 $60)
- Descuento DIVISAS_33 (preview): -$24 → neto $48
- Mesero pickeó 10% propina
- **Mesero le mostraba al cliente**: $72 − $24 + $7.20 = **$55.20** (sin línea de 10% servicio, propina sobre el bruto $72)
- **Cajera veía**: $48 + 10% servicio = $52.80 → redondeo Cash/Zelle = **$53**
- Diferencia: $2.20 + propina mal calculada

Causas:
1. `serviceCharge` en el preview leía `activeTab.totalServiceCharge` que es
   0 hasta el primer cobro → no aparecía la línea del 10%.
2. Para vistas de subcuenta, `tipAmount` se recalculaba client-side sobre
   `subtotal` BRUTO (mesero/page.tsx:1688) — el fix de §46 era server-side
   sobre `setOpenTabTipAction` y no tocaba ese camino.

Fix (PR #276):
- `src/lib/sales/tab-preview.ts` — función pura `computeTabPreviewTotals` con
  8 tests. Calcula: subtotal − descuentos = neto; servicio = neto × 10% (si
  TABLE_SERVICE y no hay acumulado por cobros parciales); propina = neto ×
  tipPercent (no bruto); grandTotal = neto + servicio + propina; saldo =
  grandTotal − pagado.
- `mesero/page.tsx` usa la función → el cliente ahora ve el 10% siempre y la
  propina sobre el neto. Coincide con lo que la cajera va a cobrar.
- `OpenTabSummary` ahora declara `serviceType`. Default `TABLE_SERVICE` por
  defensa si el campo no llegara (sesiones cacheadas).

## §49.bis (corregido) POS Mesero — UNA sola línea del 10% servicio, no duplicado

**Bug del PR #276 (mi fix anterior):** agregué una línea NUEVA "Servicio (10%)"
al preview del mesero porque pensé que faltaba. Pero la línea "Propina (10%)"
que ya existía ERA el servicio (con cálculo malo sobre el bruto). Resultado:
mostraba DOS líneas del 10% (foto IMG_2615 mesa Carmen: subtotal $160.50,
servicio $16.05, propina $16.05, total $192.60 — duplicado).

**Modelo correcto (confirmado por el dueño):** solo existe **el 10% servicio
del local** (no hay propina inmediata adicional). La propina extra al equipo
se registra después por "Propina colectiva" vinculada a la mesa (§18.8 + PR
#272). El selector del mesero (10/15/20%) ofrece el % de servicio sugerido.

**Fix (PR #277):**
- `src/lib/sales/tab-preview.ts` simplificada: `computeTabPreviewTotals`
  devuelve una sola línea `serviceCharge` (= neto × tipPercent). Sin servicio
  adicional, sin propina separada. 8 tests reescritos.
- POS Mesero: línea única renombrada **"Servicio (10%)"** en el preview de
  la cuenta, en el selector ("Servicio" en vez de "Propina") y en el bloque
  de copia para WhatsApp. La precuenta impresa pasa solo `serviceFee`, no
  `tipAmount`.
- Coincide con lo que la cajera cobra (`appliedAmount × 0.10` en
  `registerOpenTabPaymentAction` líneas 1961+).

**Validación con las dos mesas reales:**
- **Yair** (subtotal $72, divisas −$24, 10%): $48 + $4.80 = **$52.80** ✓
- **Carmen** (subtotal $160.50, 10%): $160.50 + $16.05 = **$176.55** ✓
  (antes mostraba $192.60 con duplicación).

**No se renombra el campo de BD** `OpenTab.tipPercent` / `tipAmount` (eso
requeriría migración). Es solo una etiqueta semántica en la UI.

---

### §49.1 Congruencia POS Mesero ↔ POS Restaurante (2026-06-07, PR #278)

El POS Restaurante (cajera) tenía la **misma duplicación visual** que tenía el
mesero antes del fix: encima del "A cobrar" mostraba DOS bloques de colores:

```
[10% Servicio incluido]  ✓
[Propina 10% (cliente)]  $16.05    ← duplicado visual, NO se cobraba realmente
A cobrar                  $176.55
```

El monto real a cobrar (`paymentAmountToCharge`) estaba bien calculado (un
solo 10% en `registerOpenTabPaymentAction` línea 1961), pero la línea amarilla
"Propina X% (cliente)" hacía creer a la cajera que iba a cobrar AMBOS.

**Fix (PR #278):** eliminada la línea informativa "Propina X% (cliente)" del
POS Restaurante. La cajera ahora ve solo el chip verde "10% Servicio incluido"
+ el total — mismo concepto que el cliente ve en el POS Mesero.

**Estado final de congruencia** (auditado 2026-06-07):

| Vista | Línea del 10% | Cálculo | Etiqueta |
|---|---|---|---|
| POS Mesero (cliente)        | UNA | neto × tipPercent (§46)         | "Servicio (10%)" |
| POS Mesero (selector)        | UN selector | botones 10/15/20%       | "Servicio"        |
| POS Restaurante (cajera)    | UN chip verde   | `appliedAmount × 0.10`     | "10% Servicio incluido" |
| Precuenta impresa            | UNA línea       | `serviceFee` solamente     | "Servicio"        |
| Recibo final                  | UNA línea       | `totalServiceCharge` server | "Servicio 10%"   |

**Punto abierto a confirmar con el dueño:** el selector del mesero ofrece
botones 10/15/20%. Si "solo hay 10% servicio", los botones 15% y 20%
introducen inconsistencia con la cajera (que SIEMPRE cobra 10% fijo). Las
opciones son: (a) dejar solo "10% Servicio" en el selector del mesero;
(b) hacer que el % del mesero también pilote el cálculo de la cajera. Por
ahora se dejaron los 3 botones tal cual.

---

## §50 Inventario Diario — auditoría profunda y mejora del sync de ventas POS (2026-06-07)

Inicio de la auditoría profunda módulo por módulo solicitada por el dueño.
Primer módulo: **Inventario Diario** (§5.3). El dueño reportó dolor en los 4
ejes: lentitud, datos incorrectos, falta de visibilidad y flujos rotos.

### 50.1 Hallazgos relevantes del módulo (radiografía completa)

Auditados los 14 actions de `src/app/actions/inventory-daily.actions.ts` y los
client components `daily-manager.tsx`, `sales-entry-modal.tsx`,
`critical-list-manager.tsx`. Reporte priorizado:

**Datos incorrectos / bugs:**
- `syncSalesFromOrdersAction`: filtro por `setHours UTC` (line 663) en vez
  de Caracas → ventas de 00:00-04:00 / 20:00-24:00 caen en el día equivocado
  en servers no-Caracas. **FIX en este PR**.
- `syncSalesFromOrdersAction`: NO excluye órdenes con `voidedAt != null` ni
  `deletedAt != null` → consumos de órdenes anuladas se sumaban al teórico.
  **FIX en este PR**.
- `syncSalesFromOrdersAction`: N+1 query (línea 685, `findFirst(recipe)` por
  cada `orderItem`). 100 órdenes × 5 items = 500 queries. **FIX en este PR**
  con batch fetch `findMany({ id: { in: recipeIds } })`.
- `syncSalesFromOrdersAction` línea 706: `sales: consumption` (overwrite, no
  increment). Es idempotente CONSIGO mismo (recalcula igual si re-corro),
  pero si el usuario mete ventas con `processManualSalesAction` y luego
  sincroniza, el sync sobrescribe lo manual. **NO se arregla hoy** — requiere
  schema change (columnas separadas `salesFromPOS` + `salesManual`).

**Falta visibilidad:**
- No hay alerta visual de stock bajo / críticos no contados antes de cerrar
  el día. Cierre es "ciego" — no resumen de varianzas.
- `getInventorySummaryByRangeAction` mezcla días DRAFT y CLOSED sin
  diferenciar, da números acumulados engañosos.

**Flujos rotos:**
- `closeDailyInventoryAction` no valida `items.some(finalCount === null)` →
  permite cerrar día con items sin contar.
- `reopenDailyInventoryAction` no cascada al día siguiente (D2 puede tener
  apertura distinta al cierre reabierto de D1).
- `InventoryLocation.currentStock` NUNCA se actualiza al cerrar daily →
  desincronizado con requisiciones/transferencias.

**UX:**
- Sin keyboard nav (Tab/Enter entre conteos).
- Sin tests para el módulo entero (0 tests pre-auditoría).
- Tabla con 10 columnas, sin scroll horizontal en mobile.

### 50.2 Lo aplicado en PR #279

1. **Función pura `computeConsumptionFromOrders`** en
   `src/lib/inventory/consumption.ts` con 8 tests. Recibe `orders` y un
   `Map<recipeId, recipe>` (batch fetcheado por el caller) y devuelve
   `Map<inventoryItemId, totalConsumption>`. Defensiva contra qty 0/negativa,
   ingredientes con qty 0, recetas referenciadas pero faltantes.
2. **Helper `collectReferencedRecipeIds`** para batch fetch.
3. **`syncSalesFromOrdersAction` refactorizada**:
   - Usa `getCaracasDayRange(daily.date)` en vez de `setHours` UTC.
   - Filtra `voidedAt: null, deletedAt: null` además del status COMPLETED.
   - Batch fetch de TODAS las recetas en una sola query (eliminó N+1).
   - Delega el cálculo a la función pura testeada.

**Resultado:** sync correcto en cualquier timezone server, sin contar
anuladas, queries reducidas de 1+N a 2 (orders + recipes). Tests cubren el
cálculo de consumo aislado de Prisma.

### 50.3 Roadmap siguiente del módulo (no en este PR)

- ✅ §50.A **Visibilidad pre-cierre**: modal de resumen al "Finalizar Día"
  con varianzas, items sospechosos y semáforo (OK/WARN/BLOCK). Aplicado
  en PR #280.
- ✅ §50.B **Validación de cierre**: rechaza cierres con TODOS los items
  en `finalCount=0` salvo `force: true`. Aplicado en PR #280.
- §50.C **Schema change**: separar `salesFromPOS` y `salesManual` en
  `DailyInventoryItem` (resuelve el conflicto sync vs manual).
- §50.D **InventoryLocation.currentStock**: actualizar al cerrar daily como
  parte de la transacción.
- §50.E **Keyboard nav** en `daily-manager.tsx` (Enter → siguiente fila).
- §50.F **Tests E2E** del flujo abrir → contar → sync → cerrar.

### §50.4 Modal pre-cierre y validación de cierre (PR #280)

**`src/lib/inventory/pre-close-summary.ts`** — función pura
`analyzePreCloseSummary(items)` con 11 tests. Categoriza:

- **BLOCK** — TODOS los items en finalCount=0 → casi seguro olvidó contar.
  El server rechaza con `code: 'ALL_AT_ZERO'` salvo `force: true`.
- **WARN** — hay items críticos en 0, items con ventas y stock en 0, o
  varianzas negativas significativas. Cierre permitido pero con resumen.
- **OK** — conteo completo, sin varianzas relevantes.

Devuelve también:
- `suspectedNotCounted` — items críticos en 0 (`CRITICAL_AT_ZERO`) o
  items con sales > 0 pero finalCount=0 (`SOLD_BUT_ZERO`).
- `topNegativeVariances` — top 5 (configurable) más negativas, ordenadas
  por magnitud.
- `totalVariance` — suma de varianzas.

**UI** — `daily-manager.tsx`:
- `handleCloseDay` ahora guarda primero, recarga datos, y abre el modal
  de resumen en vez de cerrar directo.
- Modal Minimal Navy (§7) con semáforo de color, métricas (Items totales /
  Contados / En 0), lista colapsable de sospechosos, lista de varianzas, y
  CTA dinámico ("Finalizar día" vs "Forzar cierre" según severidad).
- `confirmCloseDay(force)` llama al server con flag de override.

**Server** — `closeDailyInventoryAction(dailyId, { force })`:
- Sin `force`, verifica `totalItems > 0 && itemsCountedNonZero === 0` y
  rechaza con código `ALL_AT_ZERO` si aplica.
- Con `force: true`, salta validación (caso legítimo: área que efectivamente
  terminó sin stock).

---

## §51 Conteo físico semanal — plantilla masiva con todos los SKU (2026-06-07)

Fase A.1 de la auditoría de inventarios solicitada por el dueño: poder
descargar un Excel pre-llenado con TODOS los SKU activos para conteo físico
y posterior carga masiva. Antes la "plantilla" eran solo dos headers vacíos
y el match era fuzzy por nombre — inviable para >300 SKU.

### 51.1 Cambios aplicados (PR #281)

**Parser actualizado (`src/lib/inventory-excel-parse.ts`):**
- Detecta columnas por etiqueta de encabezado, no por orden fijo.
- Soporta `SKU` / `CODIGO` / `COD` para identificador único.
- Soporta `PRODUCTO` / `NOMBRE` / `DESCRIPCION` para nombre.
- Soporta aliases de cantidad: `CANTIDAD`, `CANT.`, `STOCK`, `PRINCIPAL`,
  `PRODUCCION`, `COCINA`.
- Ignora filas separadoras de categoría `## CATEGORIA ##`.
- Backward compat: si solo hay `PRODUCTO` + col cantidad sin etiqueta clara,
  usa el comportamiento legacy (orden hardcoded).
- 10 tests en `src/lib/inventory-excel-parse.test.ts` cubren legacy,
  formato nuevo con SKU, dual, separadores de categoría, aliases, etc.

**Server action nueva — `getInventoryCountTemplateAction(principalAreaId,
productionAreaId?)`** en `src/app/actions/inventory-count.actions.ts`:
- Carga todos los `InventoryItem` activos con `sku`, `name`, `category`,
  `baseUnit`.
- Trae `InventoryLocation.currentStock` para el/los área(s) pedidos.
- Devuelve `CountTemplateRow[]` con stock pre-cargado. Idempotente, solo
  lectura.
- Validación de ownership multi-tenant del area(s).

**`previewPhysicalCountFromExcelAction` mejorada:**
- Si `PreviewRow.sku` viene del parser, intenta match exacto por SKU primero
  (Map<sku→item> O(1)) ANTES del fuzzy por nombre.
- Resultado: la plantilla pre-llenada hace match 100% confiable; solo cae a
  fuzzy si el usuario sube su Excel propio sin SKU.

**UI nueva — `PhysicalCountClient.tsx`:**
- Dos botones nuevos "Descargar plantilla completa (1 / 2 almacenes)" que
  llaman a la action y construyen el Excel agrupado por categoría con filas
  separadoras `## CATEGORIA ##`.
- Columnas: `SKU | PRODUCTO | CATEGORÍA | UNIDAD | STOCK SISTEMA | CANTIDAD`
  (la última vacía para llenar). Modo dual agrega `STOCK SISTEMA (Producción)
  | PRODUCCIÓN`.
- Anchos de columna ajustados para imprimir / leer cómodo.
- Nombre del archivo: `conteo_completo_YYYY-MM-DD.xlsx`.
- Botones legacy "plantilla vacía" siguen ahí, separados, para usuarios que
  ya tienen su Excel propio.

### 51.2 Flujo recomendado al cliente

1. Seleccionar almacén principal (y producción si aplica) en la sección 3.
2. Descargar la plantilla completa (botón navy oscuro arriba).
3. Imprimir o usar en tablet/laptop, ir contando y llenando la columna
   CANTIDAD.
4. Volver a subir en la sección 4. El sistema hace match por SKU (no fuzzy)
   → todas las filas coinciden si vienen de la plantilla descargada.
5. Aplicar conteo → registra `ADJUSTMENT_IN/OUT` por la diferencia con el
   stock previo.

### 51.3 Confirmación de carryover diario → siguiente día

Auditado y confirmado: `getDailyInventoryAction`
(`src/app/actions/inventory-daily.actions.ts:302-419`) ya implementa el
arrastre cierre N → apertura N+1:
- Al **crear** un daily nuevo: lee `finalCount` del daily del día anterior
  (mismo área) y lo escribe en `theoreticalInitialCount` E `initialCount` del
  nuevo (líneas 318-319).
- Si el daily ya existe y status ≠ CLOSED: **recalcula**
  `theoreticalInitialCount` cada vez que se carga (líneas 386-417) → siempre
  refleja el cierre del día anterior aunque ese se haya editado.
- Suma además entradas/salidas/merma del rango (transferencias completadas,
  producciones, requisiciones — líneas 200-234).

Esto es la respuesta a la pregunta del dueño: **sí, el cierre del día es la
apertura teórica del día siguiente, automáticamente, sin intervención
manual**. Lo único: solo arrastra los items que están en la lista crítica
del nuevo día. Para arrastre de TODOS los SKU se usa el módulo
conteo-semanal (§5.5) que opera sobre `InventoryLocation.currentStock`.

### 51.4 Roadmap restante (no en este PR)

- **§51.A** Modelo `WeeklyCount` + `WeeklyCountItem` para persistir conteos
  semanales como entidad y soportar comparativa semana N vs N-1.
- **§51.B** Comparativa "Conteo semanal vs Inventario diario" — detección
  de varianzas que el diario no capturó.
- **§51.C** Módulo Reportes (`/dashboard/reportes`) con: inventario completo,
  variación semanal, movimientos por rango, ventas + costos + margen.

---

## §51.A WeeklyCount — conteos semanales como entidad (2026-06-07, PR #282)

Implementación de §51.A del plan de mejora de inventarios. Habilita
historial de conteos y la base para la comparativa N vs N-1 (§51.B).

### 51.A.1 Modelo nuevo

`WeeklyCount` — header del conteo:
- `id` (cuid)
- `countNumber` (correlativo `INV-YYYY-WSS-NNN` por tenant)
- `countDate` (fecha del conteo)
- `principalAreaId` FK Area (NOT NULL)
- `productionAreaId` FK Area (nullable — solo modo dual)
- `status` ('DRAFT' | 'APPLIED', default 'APPLIED')
- `notes` (texto libre opcional)
- `createdById` FK User, `createdAt`, `appliedAt?`
- `tenantId` FK Tenant
- unique `(tenantId, countNumber)`, indexes en tenantId, countDate, principalAreaId

`WeeklyCountItem` — snapshot de cada SKU contado:
- `weeklyCountId` FK CASCADE, `inventoryItemId` FK
- Snapshot denormalizado: `sku`, `name`, `category`, `baseUnit` (resistente
  a cambios posteriores del catálogo).
- `stockBeforePrincipal`, `qtyCountedPrincipal`, `variancePrincipal`
- `stockBeforeProduction?`, `qtyCountedProduction?`, `varianceProduction?`
  (solo si dual)
- unique `(weeklyCountId, inventoryItemId)`

**Migración**: `20260607000000_add_weekly_count/migration.sql`. SAFE en
producción viva (solo `CREATE TABLE IF NOT EXISTS` + indexes + FK
condicionales). Aplica vía `npx prisma migrate deploy` en el deploy script.

### 51.A.2 Persistencia automática al aplicar conteo

`applyPhysicalCountAction` ahora:
1. Snapshot del stock de cada item ANTES de tocar (carga
   `InventoryLocation.currentStock` y metadatos `sku/name/category/baseUnit`
   en una sola query batch).
2. Genera `countNumber` correlativo `INV-YYYY-WSS-NNN` (ISO week +
   secuencia por tenant).
3. Crea `WeeklyCount` con status='APPLIED', incluye notas opcionales del
   usuario, y los `WeeklyCountItem` con varianzas calculadas.
4. Aplica los ADJUSTMENT_IN/OUT como antes — el `notes` del movimiento
   ahora incluye el `countNumber` para trazabilidad.
5. Devuelve `weeklyCountId` y `weeklyCountNumber` para que la UI confirme.

Todo dentro de una sola `$transaction` — si falla la persistencia del
WeeklyCount, los ajustes no se aplican.

### 51.A.3 Actions de lectura

- `listWeeklyCountsAction({ areaId?, limit? })` → últimos N conteos
  ordenados por `countDate desc`, con totales de varianza y creador.
- `compareWeeklyCountsAction(previousId, currentId, 'PRINCIPAL' | 'PRODUCTION')`
  → comparativa por SKU entre dos conteos. Devuelve `previousQty`, `currentQty`,
  `delta` (negativo = bajaste de stock entre los dos = típicamente merma).
  Ordenado por delta ASC (caídas más fuertes primero).

### 51.A.4 Decisiones de diseño

- **WeeklyCount es snapshot inmutable** — el ajuste de stock real sigue
  siendo `InventoryMovement(ADJUSTMENT_*)`. WeeklyCount no participa en
  cálculos de stock, solo es el record histórico.
- **Snapshot denormalizado** (sku/name/category/baseUnit copiados al item)
  para que el reporte histórico sea estable aunque después se renombre el
  item o cambie de categoría en el catálogo.
- **Correlativo legible por tenant** (no global) — `INV-2026-W23-001`.
- **NO se persisten previews sin aplicar** — solo se crea el WeeklyCount
  cuando el usuario apreta "Aplicar conteo". Esto evita huérfanos.

### 51.A.5 Wrap-up

Listo para §51.B (vista comparativa semana vs semana en la UI) y §51.C
(módulo Reportes que consume estas actions).

---

## §51.C Módulo Reportes — esqueleto + Inventario completo (2026-06-07, PR #283)

Tercer paso del plan de mejora de inventarios. Crea el módulo `/dashboard/reportes`
solicitado por el dueño y entrega el primer reporte funcional:
**Inventario completo** exportable a Excel.

### 51.C.1 Estructura del módulo

```
/dashboard/reportes/                          ← landing con tiles
  /dashboard/reportes/inventario-completo/    ← AVAILABLE (este PR)
  /dashboard/reportes/variacion-semanal/      ← próximo (consume §51.A)
  /dashboard/reportes/movimientos/            ← futuro (consume InventoryMovement)
  /dashboard/reportes/ventas-costos/          ← futuro (consume SalesOrder + costos)
```

Landing muestra 4 tiles: el primero clickable, los otros 3 con badge
"Próximamente" desactivado. Cuando se implementan, se intercambia el flag
`status: 'soon'` → `'available'`.

### 51.C.2 Module registry

`src/lib/constants/modules-registry.ts`:
- Nuevo módulo `reportes` (icon 📑, sección 'admin', sortOrder 410, entre
  Intercompany y Usuarios).
- `enabledByDefault: true`.
- `subRoutes` con las 4 sub-rutas para breadcrumbs.
- `MODULE_ROLE_ACCESS['reportes']`: OWNER, ADMIN_MANAGER, OPS_MANAGER, AUDITOR.

### 51.C.3 Reporte: Inventario completo

**Server action** `getInventoryReportAction()` en
`src/app/actions/reports.actions.ts`:
- Carga todos los `InventoryItem` activos + `Area` activas + `InventoryLocation`
  + último `CostHistory` vigente — en queries batch (sin N+1).
- Devuelve filas con `stockByArea: Record<areaId, stock>`, `totalStock`,
  `costPerUnit`, `totalValue`.

**Función pura testeada** `src/lib/reports/inventory-report-helpers.ts`:
- `groupInventoryByCategory(rows)` → agrupa, ordena por categoría
  alfabéticamente, calcula subtotales por grupo y grand total.
- `filterInventoryRows(rows, query)` → filtra por SKU+nombre+categoría
  case-insensitive.
- **10 tests** cubren agrupación, subtotales, "Sin categoría", filtros,
  defensivo NaN/Infinity.

**UI** `/dashboard/reportes/inventario-completo`:
- Server component (`page.tsx`) carga el reporte y delega al client.
- Client component (`inventory-report-view.tsx`):
  - Buscador en vivo (filtro client-side).
  - 4 métricas (SKU mostrados, categorías, stock total, valor total).
  - Tabla agrupada por categoría con header fijo de áreas, subtotales por
    categoría y grand total en footer navy.
  - Botón "Exportar a Excel" — genera archivo agrupado con separadores
    `## CATEGORÍA ##`, subtotales y grand total.
  - Filename: `inventario_completo_YYYY-MM-DD.xlsx`.
  - Paleta Minimal Navy: `bg-capsula-ivory`, `border-capsula-line`,
    `text-capsula-ink*`, `pos-btn`, `pos-input`.

### 51.C.4 Roadmap del módulo

Los siguientes reportes consumirán actions ya implementadas:
- **Variación semanal** → `compareWeeklyCountsAction` (§51.A).
- **Movimientos por rango** → migrar `historial-mensual` aquí + extender por
  rango de fechas configurable.
- **Ventas + costos + margen** → consume `SalesOrder` + `Recipe`/`CostHistory`,
  agrega por categoría de menú y por período (día/semana/mes).

---

## §52 Conteo Rápido — tipear conteo físico directo al sistema (2026-06-07)

Flujo B del §51 (planificado tras conversación con dueño Shanklish, 6/6):
una pantalla para que el personal tipee directamente al sistema desde la
hoja impresa, sin pasar por Excel intermedio.

### 52.1 Contexto del cliente

Shanklish hace conteo semanal **todos los domingos** con flujo:
1. Imprimen hoja con SKU + Producto + columnas en blanco
2. Personal cuenta y anota a mano
3. Alguien transcribe al sistema

El problema histórico era que el orden de la hoja y el orden del Excel
no coincidían → buscar producto por producto. Con §51 ya quedó alineado
(ambos: categoría alfabética → nombre alfabético). Esta pantalla cierra
el ciclo: una persona dicta de la hoja, otra tipea, **Tab/Enter avanza
al siguiente input**, sin Excel intermedio.

### 52.2 Ruta y archivos

- `/dashboard/inventario/conteo-rapido` — nueva ruta
- `page.tsx` server component (auth + carga áreas default)
- `quick-count-view.tsx` client component (estado completo)
- Reusa backend existente:
  - `getInventoryCountTemplateAction` (§51) — devuelve todos los SKU del área
  - `applyPhysicalCountAction` (§51.A) — crea WeeklyCount + ajusta stock

**Cambio menor en backend**: `CountTemplateRow` ahora incluye `id`
(inventoryItemId real), necesario para que `applyPhysicalCountAction` pueda
escribir los ajustes sin lookup adicional.

### 52.3 Características de UX

- **Auto-save local** (`localStorage`, debounced 500ms) — si se cierra la
  pestaña o se refresca, recupera el borrador al volver a abrir si
  (principalId + productionId + dualMode) coinciden con la sesión anterior.
- **Progreso visible**: header sticky con barra de progreso + contador
  "X de Y items contados".
- **Filtros**: buscador en vivo (SKU + nombre + categoría) + toggle
  "Solo pendientes".
- **Agrupación por categoría** con contador por grupo `n/total`.
- **Modal de confirmación pre-aplicación**: aclara cuántos items se cuentan
  como 0 (los que quedaron sin valor), permite cancelar y filtrar
  "Solo pendientes".
- **Modo dual**: dos columnas de input (Principal + Producción/Cocina),
  ambas opcionales por item.
- **Link "Imprimir hoja"** en header → abre `/inventario/imprimir?layout=count`
  en pestaña nueva (mismo orden categoría/alfabético).

### 52.4 Module registry

- `MODULE_REGISTRY`: `inventory_quick_count` con icono ⌨️, sortOrder 22
  (justo después de `inventory`).
- `MODULE_ROLE_ACCESS`: OWNER, ADMIN_MANAGER, OPS_MANAGER, CHEF, AREA_LEAD,
  AUDITOR (mismos que conteo-semanal).
- `SIDEBAR_TREE`: agregado al subgroup 'sg-inventario' entre
  `inventory_count` y `audits`.
- `MODULE_ICONS`: `ClipboardList` (lucide-react).

### 52.5 Roadmap (próximos refinamientos)

- Tab/Enter keyboard nav explícito (hoy Tab funciona por orden natural de
  los inputs en el DOM; podría hacerse Enter→siguiente con `onKeyDown`).
- Modo "uno a uno" para tablets (un solo item grande en pantalla, swipe o
  flecha pasa al siguiente).
- Detección automática de "doble registro" (si el SKU ya tiene valor y se
  vuelve a tipear, advertir).
- Botón "Saltar este" explícito para items que no se cuentan.

---

## §53 Modelo de capas Inventario — qué módulo refleja qué (2026-06-07)

Aclaración solicitada por el dueño tras release del Conteo Rápido (§52):
"Ese conteo rápido estará vinculado al inventario físico? O sea lo que
cargue en conteo rápido estará apareciendo en inventario físico o?"

### 53.1 Arquitectura de capas

```
┌─────────────────────────────────────────────────┐
│  STOCK REAL POR ÁREA — InventoryLocation         │
│  La verdad única de cuánto hay en cada almacén.  │
│  Lo descuenta el POS con cada venta + receta.    │
└─────────────────────────────────────────────────┘
        ▲                            ▲
        │ ajusta vía                 │ ajusta vía
        │ ADJUSTMENT_IN/OUT          │ (cuando se cierra)
        │                            │
┌──────────────────┐         ┌──────────────────┐
│ CONTEO SEMANAL   │         │ INVENTARIO       │
│ (Rápido o Excel) │         │ FÍSICO DIARIO    │
│                  │         │                  │
│ WeeklyCount      │         │ DailyInventory   │
│ (snapshot)       │         │ (apertura/sales/ │
│                  │         │  merma/cierre)   │
└──────────────────┘         └──────────────────┘
   "Punto de                   "Diferencias
    partida del                 diarias entre
    stock"                      apertura y cierre"
```

### 53.2 Decisión del dueño (6/6)

**Roles complementarios, NO sincronización entre los dos flujos:**

- **Conteo Semanal/Rápido (`§51 + §52`)** = fijar el **punto de partida** del
  stock. Domingo: cuentan todo, registran, queda como verdad. A partir de
  ahí el POS descuenta automático.

- **Inventario Físico Diario (`§5.3`)** = el módulo que **diariamente revisa
  las diferencias** entre apertura y cierre. Captura mermas, mal manejo,
  etc., a nivel granular para items críticos del día.

Ambos terminan modificando `InventoryLocation.currentStock` (vía
`InventoryMovement` ADJUSTMENT en el caso semanal, vía el flujo de cierre
en el caso diario), pero **NO se sincronizan entre sí**. Son flujos
paralelos, cada uno con su propio registro inmutable (`WeeklyCount` o
`DailyInventory`).

### 53.3 ¿Qué refleja qué?

| Módulo | Refleja Conteo Rápido | Refleja Daily |
|---|---|---|
| **Inventario** (`/dashboard/inventario`) — lista 644 items con stock por área | ✅ SÍ — lee `InventoryLocation` directo | ✅ SÍ — al cerrar daily |
| **Inventario Físico Diario** (`/dashboard/inventario/diario`) | ❌ NO directamente — el daily tiene su propio `DailyInventoryItem.initialCount/finalCount` | ✅ SÍ — es su propio registro |
| **Reportes → Inventario completo** (`/dashboard/reportes/inventario-completo`) | ✅ SÍ — lee `InventoryLocation` | ✅ SÍ — vía `InventoryLocation` post-cierre |
| **POS — descuento automático** | ✅ SÍ — descuenta de `InventoryLocation` con cada venta | ✅ SÍ (mismo) |

### 53.4 Implementación

En `applyPhysicalCountAction` (PR #286):
- `revalidatePath('/dashboard/inventario')` ✅
- `revalidatePath('/dashboard/inventario/conteo-semanal')` ✅
- `revalidatePath('/dashboard/inventario/conteo-rapido')` ✅ (nuevo)
- `revalidatePath('/dashboard/inventario/auditorias')` ✅
- `revalidatePath('/dashboard/reportes/inventario-completo')` ✅ (nuevo)
- `revalidatePath('/dashboard')` ✅
- NO se toca `revalidatePath('/dashboard/inventario/diario')` — intencional,
  son flujos independientes.

**Pantalla de éxito post-aplicación** en Conteo Rápido (`quick-count-view.tsx`):
muestra resumen del WeeklyCount creado + tarjeta explicativa "Qué pasó en
el sistema" + dos CTAs (Ver inventario actualizado / Reporte completo) +
botón "Empezar otro conteo".

---

## §51.B Variación semana vs semana — vista UI (2026-06-07)

Implementación del segundo reporte del módulo Reportes solicitado por el
dueño tras la conversación sobre WeeklyCount (§51.A):

> "Quiero ver la comparativa de semana 1 contra semana 2 si quiero ver que
> variaciones hubo: Conteo Rápido S1 Domingo, entradas de mercancía durante
> la semana transferencias y ventas luego conteo rápido S2 Domingo."

Backend ya existía en §51.A (`compareWeeklyCountsAction`). Este PR cierra el
ciclo con la vista UI y el export Excel.

### 51.B.1 Función pura

`src/lib/reports/weekly-variation-helpers.ts`:
- `computeComparisonMetrics(rows)` → items con caída/subida/sin cambio +
  totales agregados (totalDecrease, totalIncrease, totalNetDelta).
- `groupComparisonByCategory(rows)` → buckets por categoría con
  subtotales (netDelta, decrease, increase por grupo).
- `topDecreases(rows, n)` y `topIncreases(rows, n)` → ordenados por
  magnitud para "Top mermas" / "Top entradas".
- `filterComparisonRows(rows, query)` → filtro SKU+nombre+categoría.

**11 tests** cubren epsilon de redondeo, NaN/Infinity defensivo, items
solo-en-uno-de-los-dos-conteos, agrupación correcta.

### 51.B.2 Vista UI

`/dashboard/reportes/variacion-semanal`:
- **Server component** carga lista de WeeklyCount disponibles (últimos 50).
- **Client component** con:
  - Dos selectores de conteo (Previo y Actual). Excluye el opuesto del
    dropdown contrario para evitar comparar consigo mismo.
  - Toggle Principal / Producción (warehouse).
  - Botón "Generar comparativa".
  - Si hay menos de 2 conteos: tarjeta warn con CTA a Conteo Rápido y
    Conteo Semanal Excel.

Resultados:
- **4 métricas**: Items con caída (danger), con subida (ok), sin cambio
  (neutral), Neto agregado (color según signo).
- **Toolbar**: buscador en vivo + filtro segmentado (Todas / Solo caídas /
  Solo subidas / Con cambios) + botón Excel.
- **Tabla agrupada por categoría** con: SKU, Producto, Unidad, cant.
  previa, → (flecha), cant. actual, delta (con icono trending up/down y
  color tonal), % cambio.
- **Footer navy** con totales agregados.

### 51.B.3 Export Excel

`variacion_<PREV>_vs_<CURR>.xlsx` con:
- Header con countNumbers y fechas
- Tabla agrupada por categoría con separadores `## CATEGORÍA ##`
- Subtotales por grupo
- Footer con totales (caídas, subidas, neto)
- Anchos de columna ajustados

### 51.B.4 Tile habilitado

`/dashboard/reportes` ahora muestra "Variación semana vs semana" como
**disponible** (status: 'available'). Quedan dos reportes "Próximamente":
movimientos por rango y ventas+costos+margen.

### 51.B.5 Próxima evolución (roadmap)

Lo que pidió el dueño explícitamente para el reporte ideal:
> "Conteo Rápido S1 + entradas durante la semana + transferencias - ventas
> = Conteo esperado S2"

Eso es un **segundo nivel** de análisis que cruza WeeklyCount con
InventoryMovement entre las dos fechas. Permite calcular:
- **Merma desconocida** = real - esperado
- Identifica items donde el conteo cuadra (sin merma) vs no cuadra (pérdida
  no registrada o doble cuenta).

Backend para esta fase: una action nueva que reciba
`(previousCountId, currentCountId)` y agregue:
- Sum de `InventoryMovement(TRANSFER_IN)` entre fechas
- Sum de `InventoryMovement(SALE)` entre fechas
- Sum de `InventoryMovement(WASTE)` entre fechas
- Sum de `InventoryMovement(PURCHASE_RECEIVE)` entre fechas

Frontend: agregar columnas "Entradas / Salidas / Esperado / Merma
desconocida" a la tabla. Lo dejo para PR siguiente cuando tengamos al
menos 2 WeeklyCount reales en producción para validar la fórmula.

tsc 0, vitest 323 passed (+11 de weekly-variation-helpers).

---

## §54 Auditoría de seguridad npm — paso 1: audit fix sin --force (2026-06-07)

### 54.1 Estado de vulnerabilidades

Tras el deploy de §51.B salió en el log de `npm ci`:
> 21 vulnerabilities (1 low, 7 moderate, 11 high, 2 critical)

Auditoría completa hecha con `npm audit --json` + análisis paquete-por-paquete.

**Resultado del paso 1** (`npm audit fix` SIN `--force`):
- **21 → 11 vulnerabilities** (-48%)
- **2 critical → 1** (protobufjs cerrada; queda Next 14.1.0)
- **11 high → 7** (4 transitivas cerradas)
- **7 moderate → 3** (-4)
- **1 low → 0**

Solo afecta `package-lock.json` — no toca `package.json`, no agrega ni
quita deps, no cambia API surface. Bumps de patches/minors en transitivas.

### 54.2 Lo que NO se hizo (y por qué)

**Bump Next 14.1.0 → 14.2.35** intentado en este branch — el build local
del sandbox **NO se puede validar** sin `.env` completo (falla con
"useContext returns null" y "<Html> should not be imported"). El build
de producción del VPS sí pasa (commit 447b7c2 deployó OK), pero no
podemos confirmar que 14.2.35 funcione sin probarlo allá con QA real.

**Decisión**: dejar Next 14.1.0 por ahora. La CRITICAL del audit
(CVE-2025-29927, auth bypass vía middleware) NO afecta este ERP porque:
1. El middleware NO se usa para autorización (la auth está en server
   actions y en `auth()` directamente, no en `middleware.ts`).
2. La CVE explota cabeceras `x-middleware-subrequest` que el nginx del
   VPS NO reescribe; vienen del browser y se ignoran.

Plan para Next 14.2.x en PR separado (§54.4):
- Stage staging-like en el VPS (rama de prueba con DB read-only)
- QA completo de POS Mesero, POS Restaurante, login flow
- Validar /404 /500 (en 14.2 se prerenderan diferente)
- Si pasa: deploy + monitor 24h

### 54.3 Las 11 vulns restantes

| Severity | Paquete | Tipo | Acción |
|---|---|---|---|
| CRITICAL | `next` | runtime | Esperar §54.4 (bump planificado) |
| HIGH | `@next/eslint-plugin-next` | **devDep** | Resuelve §54.4 (eslint-config-next bump) |
| HIGH | `eslint-config-next` | **devDep** | Resuelve §54.4 |
| HIGH | `glob` | **devDep** | Resuelve §54.4 |
| HIGH | `@typescript-eslint/parser` | **devDep** | Cerrar con bump dirigido aparte |
| HIGH | `@typescript-eslint/typescript-estree` | **devDep** | Mismo |
| HIGH | `minimatch` | **devDep transitiva** | Cierra solo con bump de eslint |
| HIGH | `xlsx` | runtime | §54.5 — sin parche disponible |
| MOD | `exceljs` (uuid<8) | runtime | Major bump bloqueado |
| MOD | `postcss` | runtime | Resuelve §54.4 |
| MOD | `uuid` | transitiva de exceljs | Resuelve con exceljs MAJOR |

**6 de 11 son devDeps de ESLint** — no se ejecutan en producción,
no afectan runtime.

### 54.4 Plan PR siguiente: bump Next 14.1 → 14.2.latest

Pre-trabajo necesario antes del bump:
1. Confirmar que `next-auth@5.0.0-beta.30` funciona con Next 14.2 (cambió
   API de Server Actions entre 14.1 y 14.2).
2. Crear `app/error.tsx` y `app/not-found.tsx` (App Router los necesita
   en 14.2 si hay `global-error.tsx` con `<html>`).
3. Validar SSG/SSR de páginas marketing en local con `.env` completo.

Riesgos identificados:
- Bug conocido de Next 14.2: SSG estático con Client Components que
  consumen Context falla. Solución probable: `force-dynamic` en root
  layout (las páginas marketing pasan de SSG a SSR, sin penalty visible
  porque el ERP no depende de SEO).

### 54.5 Decisión pendiente sobre `xlsx`

`xlsx@0.18.5` tiene 2 CVEs HIGH **sin parche en npm** (SheetJS quitó
la versión gratuita del registry público):
- CVE Prototype Pollution
- CVE ReDoS al parsear archivos

**Riesgo real bajo en KPSULA**: `xlsx` se usa para **exportar** Reportes
(genera, no parsea entrada no confiable). Solo se parsea XLSX en:
- `/dashboard/inventario/conteo-semanal` (importar conteo)
- `/dashboard/inventario/importar` (importar items)

Ambas rutas requieren rol admin/cajera autenticado — superficie de ataque
limitada a usuarios internos del tenant.

Opciones para PR separado:
- **A.** Migrar todo a `exceljs` (ya instalado, MIT, mantenido). ~3h + QA
  de exports e imports.
- **B.** Migrar SOLO el parser (imports) a `exceljs`, dejar `xlsx` para
  exports. ~1h.
- **C.** Aceptar riesgo, documentar.

Recomendación: **B**, balance entre superficie y costo.

---

## §56 Tesorería / Conciliación Bancaria — Fases 0–4 (2026-06-09)

Adaptación operacional (NO contable) del Excel "SC Capital" del dueño. Plan
completo en `docs/PLAN_TESORERIA_CONCILIACION.md`. Objetivo: comisiones
bancarias, conciliación banco-vs-ventas y pérdida BCV, montados sobre lo que el
POS ya cobra. Arquitectura **etiquetado + derivado** (no se duplica el dinero).

### Fundamentos (del análisis del Excel real, 19 hojas)
- **La cuenta bancaria es el eje:** por ella ENTRA la venta liquidada por
  PDV/PM y SALE el gasto/pago. Conciliación = (entradas − salidas) esperado vs
  estado de cuenta. La columna "Forma de Pago" de las 8 hojas de gastos = la
  cuenta bancaria (NOUR, SUPERFERRO, SHANKLISH, CANUR, PITACHEF, BOFA, CASH…).
- **Conciliación y comisiones PRODUCEN gastos:** cada día el Excel postea en
  "Gastos Pasivos" la comisión (`proveedor=PROVINCIAL`) y la pérdida BCV
  (`proveedor=TASA CAMBIARIA`). En Kpsula será auto-posting a `Expense` (Fase 2/3).
- **Moneda:** base USD; lo Bs se divide por tasa BCV. Kpsula guarda
  `amountBs`+`amountUsd`+`exchangeRate` en cada tabla → superset del Excel.
- **Pérdida BCV** = `Σ amountBS × (1/tasa_cobro − 1/tasa_liquidación)`, solo
  cuentas Bs. Necesita la 2ª tasa (día de liquidación) — input de Fase 3.
- **Factor ×1.0245 / ×1.16** del Excel: gross-up de IVA/impuesto SOLO en hoja
  "Costo Consumo"; no toca el flujo bancario.

### Fase 0 — implementado (rama claude/compassionate-goldberg-rrf4md)
- **Modelos nuevos** (`prisma/schema.prisma`):
  - `BankAccount` (name, bankName, `currency` BS|USD, `kind` BANK|CASH|DIGITAL,
    rif, isActive, sortOrder). Unique `[tenantId, name]`.
  - `PosTerminal` (label, terminalCode, `posMethodKey` → mapea al método del
    POS para atribuir ventas, `commissionPct`, bankAccountId). Unique `[tenantId, label]`.
  - Etiquetado: `bankAccountId String?` (nullable, FK SetNull) en `Expense`,
    `AccountPayment`, `SalesOrderPayment`.
  - Migración `20260609120000_add_bank_accounts` — 100% aditiva. Verificada
    contra Postgres 16 efímero: aplica sobre la DB existente y `migrate diff`
    da "No difference" (cero drift).
- **Helper** `src/lib/fiscal-week.ts`: semana fiscal Lun→Dom asignada al mes que
  contiene su jueves (ISO), numerada S1..S5. ~4 meses/año tienen S5 (≈ cada 3
  meses, como el dueño lo piensa). Default determinístico; el label se guardará
  EDITABLE en los modelos de conciliación. Zona Caracas vía `datetime.ts`. 5 tests.
- **Módulo** `cuentas_bancarias` (`/dashboard/cuentas-bancarias`, section admin,
  `enabledByDefault:false`, roles OWNER/ADMIN_MANAGER/AUDITOR, icono `Landmark`):
  CRUD de cuentas + terminales, vista Minimal Navy. Actions en
  `bank-account.actions.ts` (tenant-scoped + audit).
- **Seed** `prisma/seed-bank-accounts.ts`: idempotente (upsert por nombre),
  MANUAL (no en deploy) — `npx tsx prisma/seed-bank-accounts.ts`. Siembra las 9
  cuentas + 2 terminales PDV inequívocos. Probado e2e contra Postgres.
- `TENANT_MODELS` (prisma-tenant-client) += BankAccount, PosTerminal (test 52→54).

### Fase 1 — implementado (comisiones)
- `src/lib/treasury/commission.ts`: motor puro — `resolveTerminalForMethod`
  (método de pago → terminal vía `posMethodKey`), `commissionBs` (= Bs × %),
  `netBs`. 6 tests.
- `treasury.actions.ts` → `getBankCommissionsReportAction({start,end})`: deriva
  comisiones de `SalesOrderPayment` (ventas cobradas, `revenueWhere`), agrupa por
  cuenta + semana fiscal. El dueño solo configura el % por terminal.
- UI: pestaña "Comisiones" en el módulo Cuentas Bancarias (selector de mes,
  tabla cuenta/semana con bruto/comisión/neto/#cobros + totales).

### Fase 2 — implementado (conciliación)
- Modelo `BankReconciliation` (por cuenta+día, unique `[tenant,cuenta,fecha]`).
  Campos `rateAtSettle`/`bcvLossUsd`/`postedExpenseId` reservados para Fase 3.
  Migración `20260609140000_add_bank_reconciliation` aditiva, verificada vs
  Postgres (cero drift) + smoke test del upsert (idempotente).
- `lib/treasury/reconciliation.ts`: `computeReconciliation` →
  `differential = (esperado − estado) − comisión`; status OPEN/RECONCILED/
  DISCREPANCY con tolerancia `max(1, 0.5%)`. 5 tests.
- `treasury.actions.ts`: `getReconciliationViewAction` (esperado auto por día,
  helper `computeDailyExpected` compartido) + `saveReconciliationAction`
  (congela esperado, upsert, audit).
- Módulo `conciliacion` (`/dashboard/conciliacion`, admin, `enabledByDefault:false`,
  icono `Scale`): selector cuenta+mes, tabla diaria, estado de cuenta editable,
  diferencial + badge. `TENANT_MODELS` += BankReconciliation (test 54→55).

### Fase 3 — implementado (pérdida BCV + auto-posteo)
- `computeBcvLossUsd(usdAtSale, expectedBs, tasaLiq) = usdAtSale − expectedBs/tasaLiq`
  (solo cuentas Bs). 3 tests. `computeDailyExpected` ahora suma `usdAtSale`
  (Bs→$ a la tasa de cada venta, vía `SalesOrderPayment.exchangeRate`).
- `saveReconciliationAction` acepta `rateAtSettle`; calcula comisión$ + pérdida
  BCV y **POSTEA idempotente** un `Expense` categoría "Comisión Bancaria"
  (find-or-create, `bankAccountId` seteado, `postedExpenseId` en la conciliación).
  Re-guardar actualiza el mismo gasto (no duplica). Revalida Gastos + Finanzas →
  sube al P&L. SIN migración nueva (campos reservados en Fase 2).
- UI: input tasa de liquidación + columna pérdida BCV (solo Bs) + ícono
  "posteado a Gastos". Verificado vs Postgres (idempotencia del posteo).
- Pendiente menor de F3: registro explícito de "compra de divisas" (COMPRA $).

### Fase 4 — implementado (Cuentas por Cobrar — "nos deben")
- Modelos `AccountReceivable` + `ReceivablePayment` (espejo de payable: deudor en
  vez de acreedor; cobro vinculable a `bankAccountId`). `createdById`/`customerId`/
  `bankAccountId` como scalars sin FK (como `reconciledById`). Migración
  `20260609160000_add_accounts_receivable` aditiva, verificada vs Postgres.
- `account-receivable.actions.ts`: get (aging→OVERDUE + KPIs pendiente/vencido/
  cobrado/deudores), create, `registerCollectionAction` (transacción parcial→
  total, status PENDING/PARTIAL/COLLECTED), void.
- Módulo `cuentas_cobrar` (`/dashboard/cuentas-cobrar`, admin, `enabledByDefault:
  false`, icono `HandCoins`): KPIs, filtros, lista expandible, modales crear/cobrar.
- `TENANT_MODELS` += AccountReceivable, ReceivablePayment (test 55→57).

### Pendiente
- Puente automático Compras (flag crédito/contado) → `AccountPayable` (requiere
  tocar el flujo de PurchaseOrder; pendiente de decidir).
- Registro explícito de "compra de divisas" (COMPRA $).

### Resumen módulos Tesorería entregados (todos `enabledByDefault:false`, section admin)
`cuentas_bancarias` · `comisiones` (pestaña) · `conciliacion` · `cuentas_cobrar`.
Activar desde Configuración de módulos. Seed manual: `npx tsx prisma/seed-bank-accounts.ts`.

### Puente Compras → Cuentas por Pagar (semi-automático, aditivo)
- `getCreditCandidatePurchaseOrdersAction` (account-payable.actions): OCs
  RECIBIDAS sin `AccountPayable` asociada. Read-only, no toca el flujo de compras.
- En el modal de Cuentas por Pagar, selector "desde orden de compra" precarga
  descripción/proveedor/monto y vincula la deuda a la OC (`purchaseOrderId`).
  Un clic convierte una compra a crédito en deuda. Sin migración.

---

## §55 Módulo Gestión de Deliverys — Fase 1 (2026-06-08)

Módulo nuevo en sección **Administración**, gated por feature flag `deliveryOps`.
Operación de delivery orquestada por un bot externo (n8n + IA): KPSULA es la
fuente determinística (correlativos, sede, estados, impresión), la IA solo
conversa y produce la comanda JSON. Plan completo y fases en
`docs/DELIVERY_OPS_PLAN.md`.

**Decisión maestra: MÓDULO AISLADO.** `DeliveryOrder` es una entidad propia,
separada de `SalesOrder`. NO entra al Report Z, NI al historial de ventas
(§20), NI descarga inventario. La contabilidad del delivery se lleva aparte
(decisión futura). `ENTREGADA` es un cierre puramente logístico.

### 55.1 Modelos nuevos (Fase 1) — migración `20260608120000_add_delivery_ops_phase1`

Migración SAFE en producción viva (§44): solo `CREATE TABLE`. Hand-authored con
guards `IF NOT EXISTS` + FKs en bloque `DO $$` (estilo del repo).

- `DeliveryTenantConfig` (1:1 Tenant): `correlativePrefix` (default `PP`),
  `nextCorrelative` (contador atómico), `validationMode` (MANUAL|AUTO),
  `webhookUrl`, `schedule`.
- `BranchDeliveryConfig` (1:1 Branch): `lat/lon`, `printerStation`,
  `whatsappGroup`, `managerUserId` (scalar, sin FK a User). No se engorda
  `Branch` (lo comparte el POS restaurante de todos los tenants).
- `DeliveryZone` (zonas de cobertura geográficas por sede). NO reusa
  `ServiceZone` (esa es DINING/BAR/VIP físico).
- `DeliveryOrder` (entidad central): correlativo único por tenant, `branchId`,
  `channel/chatId`, datos de cliente/entrega, `comanda` (Json), `status`
  (máquina de estados), `itemsHash` (idempotencia), campos de comprobante
  (Fase 2) y motorizado (Fase 3, `driverId` scalar por ahora). Link
  best-effort a `Customer` SIN tocar sus stats POS.
- `DeliveryOrderEvent`: auditoría de transiciones. **Sin `tenantId`** — se
  aísla por FK a `DeliveryOrder` (mismo patrón que `SalesOrderPayment`). Por
  eso NO está en `TENANT_MODELS`.

Los 4 modelos con `tenantId` se sumaron a `TENANT_MODELS`
(`src/lib/prisma-tenant-client.ts`) → total **56** (test actualizado).

### 55.2 Máquina de estados (`src/lib/delivery/state-machine.ts`, función pura)

```
ESPERANDO_PAGO → PAGO_POR_VALIDAR → EN_COCINA → LISTA → EN_CAMINO → ENTREGADA
                                              (CANCELADA: desde cualquier no-terminal)
```

`canTransition(from,to)` valida: avanza una etapa a la vez, no retrocede, no
no-ops, CANCELADA desde cualquier estado no terminal, nada desde terminales.
`STATE_WEBHOOK_EVENT` mapea estados → eventos de webhook (Fase 3).

### 55.3 API REST para n8n — `/api/v1/delivery/*`

Namespace versionado nuevo. Auth: header `X-API-Key` → tenantId resuelto
contra env `DELIVERY_API_KEYS` (`{tenantId: key}`, compare en tiempo constante,
clon de `print-agent-auth.ts`). Todos los endpoints chequean además el flag
`deliveryOps` (403 si off).

- `GET /contexto`: devuelve `{ sedes (zonas+coords), tasa_bs, agotados:[],
  notas_gerente:[], reglas_ruteo:[] }`. Reemplaza variables manuales del
  prompt. Fase 1 llena sedes + tasa (de `ExchangeRate`); el resto vacío hasta
  Fase 4/4.5. Shaper puro en `src/lib/delivery/context.ts`.
- `POST /ordenes`: crea la orden. Asigna **sede** (`assign-branch.ts`,
  precedencia ruteo → GPS haversine → zona por texto → fallback) y
  **correlativo atómico** (`correlative.ts`, increment en transacción).
  **Idempotencia** (`idempotency.ts`): hash de canal+chatId+firma de comanda;
  mismo hash < 10 min → devuelve la orden existente (200) en vez de duplicar.
  Parsing defensivo de la comanda (es/en) en `comanda.ts`.

### 55.4 Feature flag + gate de visibilidad (plomería nueva reutilizable)

- Flag `deliveryOps` agregado a `FEATURE_FLAGS` (`src/lib/feature-flags.ts`).
- Nuevo campo `requiresFeatureFlag?` en `ModuleDefinition` + helper puro
  `filterModuleIdsByFeatureFlags()` (registry). Cableado en
  `getEnabledModulesFromDB()`: módulos con `requiresFeatureFlag` solo quedan
  visibles si el flag del tenant está ON. **Sirve para futuros módulos
  flag-gated**, no solo delivery.
- El módulo `delivery` es `enabledByDefault:true` PERO gated → visible solo si
  el OWNER prende el flag (que arranca OFF para todos).
- Defensa en profundidad: la página `/dashboard/delivery` revalida sesión +
  rol + flag server-side y redirige si está off.

### 55.5 UI — tablero (Minimal Navy)

`/dashboard/delivery`: kanban por estado (6 columnas del flujo feliz + contador
de canceladas), filtro por sede, tarjetas con correlativo/cliente/dirección/
total/tiempo, botón "avanzar" (siguiente estado válido) y "anular" (con motivo).
Iconos lucide (`Truck` para el módulo, distinto de `pos_delivery`=`Bike`),
tonos sutiles autorizados por estado, `tabular-nums`. Server action
`delivery.actions.ts` (lectura + transición con validación).

### 55.6 Pendiente / siguientes fases

- **Fase 2**: comprobantes (upload máquina, n8n sin sesión) + validación
  1-clic + impresión vía Print Agent existente (encolar `PrintJob`, +filtro
  `?station=` en `/api/print-agent/jobs`).
- **Fase 3**: motorizados + webhooks salientes HMAC (outbox + cron) +
  notificación al cliente.
- **Fase 4/4.5**: agotados, config/tasa desde UI, clientes, notas del gerente +
  reglas de ruteo, permiso por sede (el RBAC actual es rol+módulo+tenant, NO
  por sede — gap pendiente).
- **Seed Poke Pok**: faltan lat/lon + zonas reales de las 4 sedes (Santa Fe,
  El Hatillo, San Luis, Los Palos Grandes) → sin coords la asignación por GPS
  no opera (solo zona/ruteo).
- **Env**: `DELIVERY_API_KEYS` (por tenant) y, en Fase 3, `DELIVERY_WEBHOOK_SECRET`.

### §55.7 Fase 2 — Comprobantes + validación 1-clic + impresión (2026-06-08)

Reusa el **Print Agent existente** (§39) en vez de la "Opción A" (kiosk Chrome):
la comanda de delivery se encola como `PrintJob` `type: 'KITCHEN'` (el renderer
ya soporta `orderTypeLabel: 'DELIVERY'` + dirección) → **no hace falta nuevo
valor de enum** (evita `ALTER TYPE`, §44).

**Piezas (todas con tests puros donde aplica):**
- `src/lib/delivery/print.ts` — `buildDeliveryKitchenPayload(order)`: arma el
  payload KITCHEN (correlativo como `orderNumber`, label DELIVERY, ítems con
  modificadores; dirección+referencia+teléfono van juntos en `customerAddress`
  porque KitchenPayload no tiene campos aparte). PURO.
- `comanda.ts` — ahora extrae `modifiers[]` por ítem (array de strings u objetos).
- `src/lib/delivery/enqueue-print.ts` — server-only, best-effort (no lanza):
  crea el `PrintJob` con `station = BranchDeliveryConfig.printerStation` de la
  sede. Funciona con o sin sesión (`enqueuedById` opcional → n8n lo deja null).
- `src/lib/delivery/transition.ts` — `applyDeliveryTransition()`: centraliza
  update de estado + `DeliveryOrderEvent` + **side-effect: al entrar a
  EN_COCINA encola la impresión**. Lo usan los 3 caminos (UI, PATCH n8n,
  auto-validación). Al validar pago (PAGO_POR_VALIDAR→EN_COCINA) deja traza en
  `paymentValidatedById/At`.

**API nueva (auth máquina X-API-Key + chequeo de flag):**
- `POST /ordenes/{id}/comprobante` — multipart `file` + `tipo`
  (billetes|pago_movil|transferencia). Guarda el archivo tenant-scoped en
  `storage/uploads/<tenantId>/delivery-comprobantes/` (servido por `/api/files`,
  que valida sesión). Transiciona ESPERANDO_PAGO→PAGO_POR_VALIDAR. Si el tenant
  está en `validationMode=AUTO`, auto-valida →EN_COCINA + imprime. Default
  MANUAL (antifraude: el bot no verifica fotos).
- `PATCH /ordenes/{id}` — `{ estado, cancel_reason? }` con validación de
  transiciones (para n8n). Al pasar a EN_COCINA imprime vía el helper central.

**UI:** el tablero ahora muestra "Validar pago" (1-clic, verde) en las tarjetas
PAGO_POR_VALIDAR (llama `validateDeliveryPaymentAction` → EN_COCINA + imprime) y
un link "Ver comprobante" cuando hay archivo adjunto. Las tarjetas en estado
terminal (ENTREGADA) no muestran acciones.

**Pendiente Fase 3:** motorizados + `POST /ordenes/{id}/motorizado` + webhooks
salientes HMAC (outbox + cron) + notificación al cliente. Para multi-sede real:
agregar filtro `?station=` a `GET /api/print-agent/jobs` (1 agent por sede).

### §55.8 Fase 3 — Motorizados + webhooks salientes HMAC (2026-06-08)

**Schema (migración `20260608140000_add_delivery_ops_phase3`, SAFE):**
- `DeliveryDriver` (motorizados: nombre, teléfono, sede opcional, status
  AVAILABLE|ON_ROUTE|OFFLINE).
- `DeliveryWebhookOutbox` (event, payload, status PENDING|SENT|FAILED,
  attempts, lastError) — entrega confiable de webhooks (patrón outbox §18.40/41).
- `DeliveryOrder.driverId` ahora es relación a `DeliveryDriver` (FK add sobre
  tabla vacía → instantáneo). +2 modelos a `TENANT_MODELS` → **58** total.

**Webhooks salientes (KPSULA → n8n):**
- `webhook-sign.ts` (puro): `hmacSign(body, secret)` HMAC-SHA256 → header
  `X-Kpsula-Signature`.
- `webhook-payload.ts` (puro): `buildWebhookPayload(evento, orden)` → body
  `{ evento, orden: {correlativo, estado, canal, cliente, sede, motorizado…} }`.
- `webhook.ts` (server-only): `enqueueDeliveryWebhook` re-fetcha la orden
  (sede+motorizado) y escribe la fila en el outbox.
- `applyDeliveryTransition` ahora emite webhook para los estados observables
  (EN_COCINA, LISTA, EN_CAMINO, ENTREGADA) vía `STATE_WEBHOOK_EVENT`.
- Cron `/api/cron/deliver-webhooks` (auth `Bearer CRON_SECRET`, cross-tenant):
  toma PENDING, firma y POSTea a `DeliveryTenantConfig.webhookUrl`, marca
  SENT/FAILED con reintentos (MAX 6) y timeout 10s.

**Asignación de motorizado:**
- `POST /ordenes/{id}/motorizado` (n8n): `{ motorizado_id }` → LISTA→EN_CAMINO
  + driver ON_ROUTE + webhook orden.en_camino.
- Server action `assignDriverAction` (UI) — mismo flujo.
- Ambos usan `applyDeliveryTransition` con `extraData: { driverId, assignedAt }`
  (un solo update guardado).

**UI:**
- Submódulo Motorizados `/dashboard/delivery/motorizados` (CRUD Minimal Navy:
  alta/edición en modal, status quick-select, activar/desactivar).
- Tablero: tarjetas LISTA muestran picker de motorizado + "Asignar"; tarjetas
  EN_CAMINO/ENTREGADA muestran el motorizado asignado.

**Auditoría Fase 2 (commit aparte):** `applyDeliveryTransition` pasó a
`updateMany` GUARDADO por `status=from` (+tenantId) → transición idempotente,
sin doble impresión/transición bajo concurrencia (retries n8n, doble clic, AUTO).

**Env nueva:** `DELIVERY_WEBHOOK_SECRET` (firma HMAC). `CRON_SECRET` ya existía.
Falta agendar el cron `deliver-webhooks` (crontab del VPS, junto al de outbox).

**Pendiente Fase 4/4.5:** agotados, tasa/config desde UI, clientes, notas del
gerente + reglas de ruteo, permiso por sede.

### §55.9 Fase 4/4.5 — Instrucciones dinámicas del gerente + config + clientes (2026-06-08)

Mata las variables manuales del prompt: `GET /contexto` ahora devuelve datos
reales de la BD (antes arrays vacíos).

**Schema (migración `20260608160000_add_delivery_ops_phase4`, SAFE):**
- `ItemAvailability` (agotados por sede, label-based, unique [branchId,itemLabel]).
- `ManagerNote` (notas: alcance global/sede, on/off, `expiresAt`).
- `RoutingRule` (producto→sede, priority, isActive). +3 a `TENANT_MODELS` → **61**.

**Backend (`delivery-config.actions.ts`, guard compartido `lib/delivery/guard.ts`):**
- CRUD de agotados, notas, reglas; get/update de `DeliveryTenantConfig`
  (prefijo, validationMode, webhookUrl); clientes (agregación de DeliveryOrder
  por teléfono — lectura, sin tocar stats POS del `Customer`).
- **`GET /contexto`** llena `agotados` (available=false), `notas_gerente`
  (activas + no vencidas) y `reglas_ruteo` (activas).
- **`POST /ordenes`** aplica `RoutingRule` en `assignBranch` (precedencia
  ruteo→GPS→zona→fallback ya soportada desde Fase 1).

**Dos capas (§9 del spec):** estructurada (agotados + reglas, determinística) y
texto libre (notas, orientativas — la guarda "nunca anulan las reglas de oro"
vive en el prompt del bot, no en KPSULA).

**UI (Minimal Navy):** nav compartido `_components/delivery-nav.tsx` entre
submódulos. Páginas nuevas: `/agotados`, `/instrucciones` (notas + reglas),
`/config`, `/clientes`.

**Permiso por sede:** opción A (sin scoping por sede) — cualquier rol con acceso
a `delivery` opera todas las sedes. Documentado en `guard.ts`. Opción B (scope
por sede) sigue pendiente.

**Pendiente del módulo:** submódulo **Sedes** UI (`BranchDeliveryConfig` +
`DeliveryZone` CRUD con lat/lon/impresora/grupo WA/gerente) — por ahora las
sedes se siembran por SQL/script. Es lo único grande que falta para self-serve.

### §55.10 Fase 5 — Submódulo Sedes + provisión de Poke Pok (2026-06-08)

**Submódulo Sedes** `/dashboard/delivery/sedes` (sin schema nuevo — usa Branch +
BranchDeliveryConfig + DeliveryZone de fases previas):
- `delivery-sedes.actions.ts`: list (Branch+config+zonas+managers), createSede
  (Branch nuevo con code auto-slug único + BranchDeliveryConfig vacío),
  updateSede (name/isActive del Branch + upsert de lat/lon/printerStation/
  whatsappGroup/managerUserId), add/removeDeliveryZone.
- UI Minimal Navy: tarjetas por sede con resumen (GPS/impresora/WA/gerente),
  modal de config, editor de zonas inline (chips), alta de sede, toggle activo.
- El dropdown de gerente lista users del tenant con rol OWNER/ADMIN_MANAGER/
  OPS_MANAGER/HR_MANAGER (sigue siendo permiso por sede opción A — el campo es
  informativo/para WhatsApp, no scoping de RBAC).

Con esto el módulo es **self-serve completo** (Fases 1→5). Único pendiente real:
permiso por sede (opción B).

**Script de provisión `scripts/seed-poke-pok.ts`** (idempotente, upserts):
- Tenant `pokepok` + flag `deliveryOps: true`, owner + gerente, DeliveryTenantConfig
  (PP/MANUAL), y las 4 sedes (Santa Fe, El Hatillo, San Luis, Los Palos Grandes)
  con BranchDeliveryConfig + zonas placeholder. Coords APROXIMADAS (ajustar en UI).
- Uso en el VPS: `set -a && source .env && set +a && npx tsx scripts/seed-poke-pok.ts [--password=...] [--reset]`.
- NO siembra menú/inventario/ventas (módulo aislado; el bot da las comandas).

**Camino a producción** (recordatorio): merge a `main` → deploy VPS (corre
`prisma migrate deploy` en deploy-vps.sh paso [7/10], aborta sin swap si falla)
→ correr seed-poke-pok.ts en el VPS → login en `pokepok.kpsula.app`. El módulo
viaja apagado para los demás tenants (flag OFF).

### §55.11 Pieza C — Alerta sonora de pedido nuevo en el tablero (2026-06-09)

Solo frontend (`delivery-board-view.tsx`), aditivo, sin endpoint nuevo:
- **Polling cada 8s** (`POLL_INTERVAL_MS`) vía `listDeliveryOrdersAction()` SIN
  filtro (el filtro de sede ya era client-side); se pausa con la pestaña oculta
  (`document.visibilityState`). El botón "Refrescar" manual reusa `syncOrders()`.
- **Detección de nuevas**: `knownIdsRef` (Set de ids) inicializado con
  `initialOrders` — el primer render nunca dispara alarma. Id no visto = nueva;
  se registra como vista SIEMPRE (aunque esté silenciado o sea de otra sede)
  para no sonar tarde al cambiar filtro.
- **Filtro por sede**: alarma/badge/resaltado solo si la orden pasa el
  `branchFilter` vigente ('' = todas las sedes suenan).
- **Sonido**: beep de 2 tonos (880/1320 Hz) con **Web Audio API** — sin asset
  mp3. ⚠️ Autoplay: el `AudioContext` solo se crea/resume en el click del botón
  "Activar alertas" (`Bell`/`BellOff` lucide, toggle). Sin ese gesto NUNCA se
  intenta reproducir (los navegadores lo bloquean silenciosamente).
- **Resaltado**: tarjeta nueva con `ring-2 ring-capsula-coral animate-pulse` +
  badge "NUEVO" por 10s (`HIGHLIGHT_MS`); badge contador "N nuevos" en el
  header (click = limpiar).
- **Acumulación UX**: la lista de cada columna del Kanban scrollea internamente
  (`max-h-[60vh] xl:max-h-[calc(100vh-300px)] overflow-y-auto`) en vez de
  estirar la página; las nuevas entran arriba (orden createdAt desc) así el
  resaltado se ve sin scrollear.

### §55.12 GPS del bot → `extractComandaMeta` + coords reales de sedes (2026-06-13)

Cierra el ruteo por GPS end-to-end. Dos partes:

**1. Parseo de `delivery.gps` (bug fix en `src/lib/delivery/comanda.ts`).**
El bot (n8n) emite la ubicación de Telegram como string combinado anidado:
`comanda.delivery.gps = "10.466026,-66.812147"` (formato `"lat,lon"`). Pero
`extractComandaMeta` solo buscaba `lat`/`lon` como números separados → el GPS
válido nunca se parseaba → el nivel GPS de `assignBranch` no disparaba y la
orden caía a zona/fallback (`sede_asignada: null`).
- Nuevo helper `parseGpsPair(raw)`: `split(/[,;]/)` + `trim` + `parseFloat`,
  valida rango terrestre (lat `[-90,90]`, lon `[-180,180]`) y descarta `0,0`
  (null island). Inválido → null (sigue a zona).
- En `extractComandaMeta`: si faltan `lat`/`lon` numéricos, lee el string desde
  `delivery.gps` → `gps` (raíz) → `cliente/customer.gps`. Precedencia: los
  numéricos explícitos ganan; el string es respaldo. Firma/salida sin cambios.
- `assignBranch`, `POST /ordenes`, idempotencia y contrato de API: SIN tocar.
- Tests: `comanda.test.ts` (10 casos) — delivery.gps, raíz, cliente, prioridad
  numérica, `"abc"`/`"GPS registrado"`, fuera de rango, `0,0`, sin GPS.

**2. Coords REALES de las 4 sedes (`scripts/seed-poke-pok.ts`).**
Las coords sembradas eran placeholder aproximadas. Reemplazadas por las reales:
Santa Fe `10.463427,-66.865664` · El Hatillo `10.424993,-66.825674` · San Luis
`10.4685,-66.8431` · Los Palos Grandes `10.501165,-66.844456`. Verificado: el
punto del demo `10.466026,-66.812147` (Macaracuay/El Cafetal) rutea a **San
Luis** (haversine 3.40 km, margen 1.4 km sobre El Hatillo).
- ⚠️ El seed actualiza la BD viva SOLO al re-correrlo (sin `--reset`: el
  `branchDeliveryConfig.upsert` hace `update: { lat, lon }`, no toca órdenes).
  Alternativa: editar coords en `/dashboard/delivery/sedes`.

## §57 Documentos de Proveedor — facturas/notas de entrega (Compras, 2026-06-09)

Decopla el "papel" del proveedor del inventario y de la OC. Resuelve el caso
real: la mercancía entra hoy y la factura se registra días después (o al revés).

- **Modelos** `SupplierDocument` + `SupplierDocumentItem` (migración
  `20260609180000_add_supplier_documents`, aditiva, verificada vs Postgres).
  `supplierId`/`linkedPurchaseOrderId`/`accountPayableId`/`createdById` scalars
  (sin FK) para no acoplar Supplier/PurchaseOrder/AccountPayable/User. El item
  no tiene tenantId (hereda vía el documento). `TENANT_MODELS` += SupplierDocument (66→67).
- **Acciones independientes** (`supplier-document.actions.ts`): crear documento
  con líneas; `enterDocumentToInventoryAction` (reusa `registrarEntradaMercancia`
  línea por línea → movimientos + stock + costo promedio probados); `linkDocument
  ToPurchaseOrderAction`; `generatePayableFromDocumentAction` (crea AccountPayable
  y guarda accountPayableId); `voidSupplierDocumentAction` (bloqueado si ya entró
  a inventario); `getPurchaseReconciliationReportAction` (huérfanos).
- **Módulo** `compras_documentos` (`/dashboard/compras/documentos`, sección
  Finanzas en sidebar, `enabledByDefault:false`, icono Receipt, roles OWNER/
  ADMIN_MANAGER/OPS_MANAGER + AUDITOR lectura): pestañas Documentos (lista +
  crear + dar entrada/vincular/deuda/anular) y Conciliación (huérfanos:
  documentos sin entrada/OC, y OC recibidas sin documento).
- Verificado vs Postgres: creación con líneas, deuda vinculada, reporte de
  huérfanos correcto. Build OK.

## §58 Diagnóstico del módulo de Reportes (2026-06-10, solo lectura)

Auditoría completa pre-implementación del módulo de Reportes: inventario de
lo existente, integridad entre módulos, gap analysis contra catálogo objetivo
(estándar Xetux + gerenciales), índices y plan por fases. **Informe completo
en `DIAGNOSTICO_REPORTES.md` (raíz del repo).** Sin cambios de código.

Hallazgos top (detalle y archivo:línea en el informe):
1. **COGS = $0 en el P&L**: nadie escribe `SalesOrderItem.costPerUnit/costTotal`
   al vender (los campos existen); `finance.actions.ts` suma `costTotal` →
   utilidad bruta = ventas. Fix de código, sin migración.
2. **Voids de ítem en mesa no revierten inventario** (`voidItemInTx` /
   `modifyTabItemAction` ADJUST_QTY/REPLACE) — la anulación de orden completa
   sí revierte (`sales/void.actions.ts`).
3. **PaymentSplit (cobros de mesa) no persiste `amountBs` ni `exchangeRate`**
   → dual-currency con tasa histórica imposible para mesas; delivery con
   PDV/MOVIL fallback tampoco crea línea de pago.
4. **Cuadre de caja roto**: `expectedCash` suma TODOS los métodos (no solo
   efectivo), ignora Bs, sin FK orden→turno (`cashRegisterId` no existe),
   filtro `status COMPLETED` inexistente y excluye `READY`.
5. `branchId` NULL en ventas directas; sin fiscal SENIAT (nada); sin
   `kitchenReadyAt`; `TableTransfer`/`guestCount`/`waiterProfileId` con datos
   pero sin reporte; índices compuestos `(tenantId, fecha)` faltantes en
   tablas core.

Plan acordado en el informe: FASE A (hoy, sin migraciones — fixes A0 +
reportes sobre datos existentes), FASE B (migraciones menores: Bs/tasa en
PaymentSplit, `SalesOrder.cashRegisterId`, `kitchenReadyAt`, branchId en
finanzas, índices), FASE C (CMV/ingeniería de menú/multi-sucursal/fiscal).

## §59 Módulo de Reportes — implementación FASE A + B (2026-06-10)

Implementación del plan del §58/DIAGNOSTICO_REPORTES.md. Cuatro commits
temáticos: fixes de integridad, capa de servicios, UI por familia, script
de verificación.

### 59.1 Fixes de integridad aplicados ANTES de los reportes

- **A0.1 — COGS (BUG #1)**: `createSalesOrderAction` y `addItemsToOpenTabAction`
  snapshootean `costPerUnit/costTotal/marginPerUnit/marginPercent` en cada
  `SalesOrderItem` vía `src/lib/sales/menu-item-cost.ts`
  (`buildMenuItemCostMap` batch — misma convención que /costos/margen:
  Σ qty × CostHistory vigente, fallback `MenuItem.cost`; best-effort, la
  venta nunca se bloquea). 8 tests. **Las ventas previas al 2026-06-10 tienen
  costo 0** — backfill opcional pendiente (script).
- **A0.2 — Voids de ítem (BUG #2)**: `voidItemInTx` ahora revierte inventario
  (`applyItemInventoryInTx` RESTORE: ADJUSTMENT_IN + increment, cubre receta
  del ítem y modificadores con linkedMenuItemId — espejo de
  voidSalesOrderAction). `modifyTabItemAction` ADJUST_QTY/REPLACE re-descargan
  el ítem nuevo (DEDUCT: SALE + decrement) con snapshot de costo.
- **A0.3 — Ventas directas (BUGs #3/#5)**: `createSalesOrderAction` ahora
  pobla `branchId` (área→branch o branch activo), `exchangeRateValue`,
  `totalBs`, `cashRegisterId` (caja OPEN más reciente) y **SIEMPRE crea línea
  de pago** (sintetiza una con tasa del momento si el POS no manda
  `payments[]` — caso PDV/MOVIL fallback en delivery).
- **A0.4 — sold-items (BUG #7)**: `getSoldItemsReportAction` gateado por
  `VIEW_SALES_HISTORY` (antes solo sesión).
- **Cobros de mesa**: `registerOpenTabPaymentAction` y `paySubAccountAction`
  persisten `amountBs` + `exchangeRate` en el PaymentSplit (tasa BCV del
  momento del cobro).
- **Cocina**: PATCH `/api/kitchen/orders` estampa `kitchenReadyAt` al marcar
  READY (tiempos de cocina — dato disponible de ahora en adelante).

### 59.2 Migración FASE B — `20260610120000_reports_phase_b`

100% aditiva, verificada contra Postgres 16 (`migrate diff` = sin drift):
`PaymentSplit.amountBs/exchangeRate`, `SalesOrder.cashRegisterId` (FK→
CashRegister SET NULL) + `kitchenReadyAt`, índices compuestos
`SalesOrder(tenantId,createdAt)`, `(tenantId,voidedAt)`, `(cashRegisterId)`,
`Expense(tenantId,paidAt)`, `CashRegister(tenantId,shiftDate)`,
`PurchaseOrder(tenantId,orderDate)`, `InventoryMovement(inventoryItemId,
createdAt)`, `(movementType,createdAt)`, `AuditLog(tenantId,createdAt)`,
`PaymentSplit(paidAt)`. Aplica vía `prisma migrate deploy` en el deploy [7/10].

### 59.3 RBAC granular — 7 permisos nuevos (permissions-registry)

`REPORTES_VENTAS_VER`, `REPORTES_OPERATIVOS_VER`, `REPORTES_INVENTARIO_VER`,
`REPORTES_COMPRAS_VER`, `REPORTES_GERENCIAL_VER`, `REPORTES_FISCAL_VER`,
`REPORTES_EXPORTAR` (equivalen a reportes.<familia>.ver / reportes.exportar).
Base por rol: OWNER/ADMIN_MANAGER/AUDITOR = todos; OPS_MANAGER = todos MENOS
gerencial y fiscal; CHEF/AREA_LEAD = solo inventario; CASHIER/WAITER = ninguno
(otorgables por usuario vía grantedPerms). Grupo UI "📊 Reportes" en
PERM_GROUPS; mapeo a módulo `reportes` en perm-to-modules.

### 59.4 Estructura final del módulo

```
src/lib/reports/            ← capa de servicios (solo lectura, tenantId SIEMPRE
                              de sesión, branchIds opcional, $queryRaw tipado)
  types.ts                  ← ReportFilters, DualMoney (usd/bs/usdSinTasa)
  range.ts (+test)          ← zod YYYY-MM-DD + rango Caracas→UTC (máx 366d)
  action-helpers.ts         ← prepareReportFilters (RBAC+zod+tenant)
  page-guard.ts             ← getReportPageContext para server pages
  sales-reports.ts          ← por producto/categoría/mesonero/zona/canal/
                              método (dual currency)/serie día-hora/totales
  operations-reports.ts     ← cierres por día, turnos X (vínculo
                              cashRegisterId), voids orden+ítem, descuentos
                              +promos, transferencias de mesa
  inventory-reports.ts      ← kardex por rango paginado (tenant vía relación)
  purchases-reports.ts      ← por proveedor + OC vs recepción
  management-reports.ts     ← KPIs ejecutivos del día + vs semana pasada
  menu-engineering.ts(+test)← matriz Kasavana-Smith (pura)
src/app/actions/reports/    ← actions delgadas (ventas/operativos/inventario/
                              compras/gerencial)
src/app/dashboard/reportes/
  page.tsx                  ← dashboard ejecutivo + nav por familia (gateada)
  executive-dashboard.tsx   ← KPIs día: ventas dual, tickets, ticket prom.,
                              comensales, propinas, top 5, por hora, Δ vs -7d
  ventas/ operativos/ inventario/ (kardex) compras/ gerencial/ fiscal/
  inventario-completo/ variacion-semanal/   ← preexistentes (§51), enlazados
  _components/              ← ReportToolbar (presets+rango+sucursal+toggle
                              $/Bs/ambas+export), skeletons, empty states,
                              export.ts (Excel xlsx con encabezado tenant/rango
                              + PDF vía ventana imprimible), format.ts
scripts/verify-reports.ts   ← cruces C1-C7 (--seed-fixtures solo demo/test)
```

### 59.5 Decisiones tomadas

- **Criterio FACTURADO vs COBRADO** explícito: dimensiones de venta usan
  facturado (= revenueWhere §20.3, incluye mesas abiertas); método de pago usa
  cobrado (directas + splits PAID). El puente se verifica en C4/C5 del script.
- **Puente de cuadre visible (2026-06-10 tarde)**: `getSalesBridge()` en
  `sales-reports.ts` calcula `cobrado = facturado + servicio 10% cobrado −
  pendiente por cobrar (balanceDue de mesas OPEN/PARTIALLY_PAID con consumo en
  el rango) ± ajuste de mesas de otros días/pagos parciales`, con propinas
  reportadas aparte (no son venta; el "Cobrado" del historial sí las incluye).
  Se muestra como `BridgeCard` (`reportes/_components/bridge-card.tsx`) en
  /reportes/ventas y en el dashboard ejecutivo. Etiquetas aclaratorias
  añadidas: historial ("con 10% servicio" / "con servicio y propinas"),
  Finanzas y ExecutiveSummary ("facturado sin 10% servicio"). Las fórmulas
  canónicas de Finanzas/Dashboard NO se cambiaron — solo se explican.
- **Cobrado como métrica secundaria (2026-06-10, decisión del dueño)**: el
  facturado sigue siendo el número principal del P&L, pero Finanzas (vista
  diaria) y el dashboard operativo muestran el cobrado al lado:
  `DailyFinancialSummary.income.cobradoUsd/pendienteUsd` (vía
  `getSalesByPaymentMethod` + `getSalesBridge`) y
  `salesKPIs.todayCollected` en `dashboard.actions.ts` →
  `ExecutiveSummary` ("Cobrado: $X (con servicio)").
- **Dual currency**: Bs SOLO desde montos/tasas persistidos
  (`totalBs`/`amountBS`/`amountBs` por nivel); el legado sin tasa se reporta
  como `usdSinTasa` ("Bs no registrado") — NUNCA se reconvierte con tasa de hoy.
- **PDF sin dependencia nueva**: ventana imprimible (patrón print-command) →
  el usuario guarda como PDF. Excel con xlsx (patrón §51).
- **Reporte X**: las ventas se vinculan al turno vía `cashRegisterId` desde
  hoy; los turnos previos muestran solo los totales guardados (etiquetado en
  la UI). La fórmula `expectedCash` legacy del cierre de caja NO se tocó
  (cambia números del arqueo — requiere OK del dueño, queda FASE B pendiente).
- **Fiscal**: placeholder honesto (no hay infraestructura SENIAT — §58).
- `prisma migrate dev` no se usó (sin shadow DB) — migración hand-authored
  con guards, patrón §55, verificada con db push + migrate diff.

### 59.6 Pendiente FASE B/C (no implementado hoy)

- Backfill de costo (`costTotal`) y `branchId` para ventas históricas (script).
- Corrección de la fórmula `expectedCash` del cierre de caja (BUG #4 completo:
  separar efectivo por moneda, excluir métodos no-cash, usar cashRegisterId).
- `branchId` en CashRegister/Expense (migración M4 del diagnóstico).
- Reporte de tiempos de cocina (kitchenReadyAt ya se llena; falta la vista).
- Costo real vs teórico por período (cruce WeeklyCount × movimientos, §51.B.5).
- CMV/food cost % por categoría con ventana de datos de costo madura.
- Comparativo entre sucursales (necesita 2º branch real + M4).
- Familia fiscal completa (modelo FiscalDocument + adaptador TFHKA).
- RBAC por sucursal (User.branchId no existe — opción B de §55.9).

### 59.7 Verificación

`scripts/verify-reports.ts --tenant-slug=demo --seed-fixtures` contra
Postgres 16 local con tenant demo sembrado: **9/9 cruces PASS** (C1-C7).
Gates: `tsc --noEmit` 0 errores · vitest **407 passed** (15 tests nuevos).

## §60 BUG Promociones — fechas vencían un día antes (off-by-one TZ, 2026-06-11)

**Síntoma reportado:** dueño activa una promo 50%, en el formulario la fecha
"Hasta" se ve correcta (ej. 11-jun), pero al cobrar en el POS sale el precio
completo. El motor la consideraba vencida.

**Causa raíz:** `inputToData()` en `promotions.actions.ts` guardaba
`new Date(input.startDate)` / `new Date(input.endDate)` con un string de
fecha-sola `"YYYY-MM-DD"` del `<input type="date">`. JS lo ancla a **medianoche
UTC** (`2026-06-11T00:00:00Z`). El motor (`engine.ts → withinDateRange`) compara
por día calendario en **Caracas (UTC-4)**, donde ese instante cae el **10-jun**.
La promo "moría" un día antes. El bug quedaba **oculto en la UI** porque la
lectura (`rowToDTO` → `toISOString().slice(0,10)`) usa componentes UTC y mostraba
de vuelta 11-jun.

**Fix:** helper `caracasDateOnlyToDate(ymd)` en `src/lib/datetime.ts` que ancla
la fecha al **mediodía de Caracas (16:00 UTC)** → al releer en TZ Caracas el día
calendario coincide con el elegido, y el round-trip del formulario
(`toISOString().slice(0,10)`) se mantiene estable. Usado en `inputToData()` y en
la validación de rango. Venezuela no tiene DST → offset fijo -4 seguro.

**Datos existentes:** `scripts/fix-promo-dates.ts` (dry-run por defecto,
`--apply` para escribir) re-ancla las filas viejas (hora UTC < 4) al mediodía de
Caracas conservando el día que el usuario veía en el formulario. Idempotente.

**Diagnóstico:** `scripts/diagnose-promociones.ts` (read-only) imprime, por cada
promo activa y por tenant, si aplica AHORA (hora Caracas) y **exactamente por
qué no** (flag/día/horario/fechas/alcance). Fue lo que pinpointeó el bug en prod
("✗ … ya terminó (hasta 2026-06-10)").

**Regla general:** NUNCA `new Date("YYYY-MM-DD")` para fechas-sola que se
comparan por día en Caracas. Usar `caracasDateOnlyToDate()`. Tests:
`src/lib/datetime.test.ts` (4 casos). Gates: tsc 0 · vitest 416 passed.

## §61 Landing "Editorial" 2.0 — rebrand aislado de la home (2026-06-12)

Rebrand completo de la **landing page (`/`)** y la **vista de login** a la
identidad gastro-editorial (kit `CAPSULA_2.0`): fondo blush `#F7E6E4`, rojo de
marca `#E8432A`, tinta `#1A1D17`, tipografía **Archivo Black** display (uppercase
gigante) + **Archivo** cuerpo, ilustraciones hand-drawn y rotaciones sutiles.

**Aislamiento (clave — no romper):**
- La home vive en un route group propio **`src/app/(landing)/`** con su **propio
  layout** (nav pill + footer rojo autocontenidos). NO usa el chrome de
  `(marketing)` (AuroraNav/AuroraFooter/aurora.css), que sigue intacto para
  `/descargar`, `/ayuda`, `/producto/*`, `/empresa`, `/contacto`, `/legal/*`,
  `/estado`. Se eliminó `(marketing)/page.tsx`; ahora `/` lo sirve
  `(landing)/page.tsx`.
- Todo el CSS está **namespaced bajo `.kpsula-editorial`** (`editorial.css`) → no
  se filtra al resto de la app ni lo invierte el dark mode (colores fijos a
  propósito). Esta landing NO sigue el sistema Minimal Navy del ERP — es una
  marca aparte. No migrar sus tokens.
- Fuentes Archivo cargadas con `next/font/google` scoped al wrapper (variables
  `--font-archivo`, `--font-archivo-black`), no globales.
- Animaciones: `EditorialMotion.tsx` (client) — cascada de entrada del hero
  (`[data-anim]`) + scroll-reveal one-shot (`[data-reveal]`) con
  IntersectionObserver. **Progresivo**: los estados ocultos viven bajo
  `.is-ready` (solo lo agrega el JS), así sin JS todo queda visible.
- Ilustraciones en `public/landing/` (`mesa-hero.png`, `sarten-band-left.png`,
  `sandwich-band-right.png`).

**Login (`src/app/login/`):** solo se reestiló el chrome (page.tsx) y las clases
del formulario (login-form-client.tsx) a la paleta editorial. **Cero cambios de
lógica**: `loginAction`, el redirect server-side (§ comentarios in-file: super
admin → /admin, root+tenantSlug → subdomain, resto → /dashboard), el sync de
Zustand y `router.refresh()` quedan idénticos. DemoCredentialsCard intacto.

**"Descargar app" (APK):** preservado — link a `/descargar` en el nav y el footer
de la landing.

Gates: `tsc` 0 · `next build` exit 0 (index.html prerendea editorial; resto de
marketing intacto) · vitest 416 passed.

## §62 BUG Comanda delivery — items vacíos: el bot manda `items` como STRING (2026-06-15)

**Síntoma:** la comanda de delivery (pantalla e impresión) no reflejaba el
pedido completo ni los modificadores. "Debe verse igual que en restaurante".

**Causa raíz:** el bot (n8n, `docs/n8n-workflow-1-bot-telegram.json`) arma el
payload con `items: itemsMatch ? itemsMatch[2].trim() : "items no especificados"`
→ `comanda.items` llega como **STRING de texto libre** (ej. "2 Poke de salmón
sin cebolla, 1 Limonada"), NO como array de `{name, qty, modifiers}`. El parser
`parseComandaItems` solo entendía arrays (`rawItems` exige `Array.isArray`) →
devolvía `[]` → comanda vacía en cocina/motorizado y en el tablero.

**Fix (`src/lib/delivery/comanda.ts`):**
- `itemsContainer()` detecta el contenedor de ítems (array | string) tolerando
  más claves (`items/productos/lineas/lines/comida/pedido/order`).
- `parseItemsString()`: si es string, lo parsea best-effort (separa por
  líneas/comas/";"/"·"/bullets, extrae cantidad líder "2 ", "2x", "x2"; los
  modificadores quedan dentro del nombre porque el texto libre no los separa,
  pero el pedido completo ya se ve). Ignora sentinels ("items no especificados").
- Backward-compatible: si viene array estructurado, comportamiento idéntico
  (gana sobre el string). Se agregó `nombre_cliente` a las claves de nombre.

**Tablero (`src/app/dashboard/delivery/`):** la comanda en pantalla NO mostraba
ítems (solo cliente/total). Ahora `listDeliveryOrdersAction` expone
`items: DeliveryOrderItemRow[]` (parseados con el MISMO parser que alimenta la
impresión, para que pantalla e impresión coincidan) y `delivery-board-view.tsx`
los renderiza (qty + nombre, modificadores indentados; o aviso "sin ítems
legibles"). El tablero refresca por `listDeliveryOrdersAction` (carga inicial +
polling), así que el detalle aparece en ambos.

**Nota:** lo correcto a futuro es que el bot emita `items` estructurado
(array con name/qty/modifiers separados) para que los modificadores salgan en
línea aparte como en restaurante. El fix del parser es defensivo y hace legible
el pedido HOY sin depender del cambio en n8n.

Tests: `src/lib/delivery/print.test.ts` (+5: items como string). Gates: tsc 0 ·
vitest 431 passed.

## §64 Propina colectiva con código propio PROP- + arqueo conciliable (2026-06-16)

**Pedido del dueño:** la cajera cuadra un Excel manual de arqueo contra el
sistema y siempre hay desfase. La **propina colectiva** tomaba el código de
pickup (PKP-####) y se confundía con ventas.

**Causa del desfase en el arqueo:** `recordCollectiveTipAction` crea la propina
como `SalesOrder` ficticio (orderType='PICKUP', total=0, amountPaid=propina,
customerName='PROPINA COLECTIVA'). En el export de arqueo
(`getSalesForArqueoAction`) caía en el bloque Pickup usando `o.total` = **0**, así
que el dinero de la propina **no aparecía** en el arqueo → la caja física tenía
ese dinero pero el Excel del sistema no lo mostraba.

**Cambios (alcance "separar propina 1+2+3", sin migración):**
1. **Código propio `PROP-####`** — nuevo canal `COLLECTIVE_TIP` en
   `invoice-counter.ts` (prefijo `PROP`). `recordCollectiveTipAction` ahora usa
   `getNextCorrelativo('COLLECTIVE_TIP')`. **`orderType` sigue siendo 'PICKUP'**
   a propósito: `sales/page.tsx:307-309` (filtro Mesa/Pickup) y los reportes
   identifican la propina por `customerName='PROPINA COLECTIVA'`, no por
   orderType; cambiarlo rompería el historial. Lo que el dueño llamaba "el
   código" es el correlativo, que ahora es PROP-.
2. **Conteos ya limpios**: Z report (`z-report.actions.ts:98`) y cierre del día
   (`end-of-day.actions.ts:69`) YA excluyen la propina colectiva del query
   principal por `customerName`, así que nunca contaron como pickup. (El reporte
   del agente que decía lo contrario estaba equivocado.)
3. **Arqueo Excel** (`arqueo.actions.ts` + `arqueo-excel-utils.ts`): la propina
   colectiva se detecta por `customerName` (robusto para histórico PKP- y nuevo
   PROP-) y sale como **fila/bloque propio "PROPINAS COLECTIVAS"** con
   `total = amountPaid` y el desglose por método de pago. Así el dinero de la
   propina entra al total y a la columna del método correcto → la caja cuadra
   centavo a centavo. El correlativo mostrado es PROP-.

Export activo: `arqueo-excel-utils.ts` (ExcelJS) vía `/api/arqueo`.
`export-arqueo-excel.ts` (XLSX) es código muerto (sin importadores).

Gates: tsc 0 · vitest 431 passed.

---

## §63 Importador de recetas desde CSV (2026-06-09, PRs #298/#299)

> Cronológicamente previo a §58/§59 (su lugar en el tiempo está entre §57 y
> §58); se numera §63 para no renumerar el changelog. Es un script de carga
> masiva, **no** un módulo de UI.

Herramienta de línea de comandos para cargar las recetas del chef (exportadas
a CSV desde Excel) directo a la BD, sin tipeo manual ítem por ítem. Vive en
`scripts/import-recetas.ts` con los CSV fuente en `scripts/data/`.

### 63.1 Uso

```bash
# ENSAYO (default, no escribe en BD — reporta qué haría):
npx tsx scripts/import-recetas.ts scripts/data/recetas-produccion.csv
# Aplicar:
npx tsx scripts/import-recetas.ts scripts/data/recetas-produccion.csv --apply
# Recetas finales (producto vendible) en vez de sub-receta:
npx tsx scripts/import-recetas.ts <csv> --type=FINISHED_GOOD
# Solo parsear el CSV sin tocar BD (debug de formato):
npx tsx scripts/import-recetas.ts <csv> --parse-only
```

Se corre **en el VPS**, donde `DATABASE_URL` apunta a producción. El modo
ensayo (sin `--apply`) es el default deliberado: nunca escribe sin confirmación
explícita.

### 63.2 Semántica de REEMPLAZO (decisión del dueño)

- **Receta existente** (match por nombre normalizado): se le **borran los
  ingredientes y se recrean** desde el CSV; el `outputItem` y sus vínculos al
  menú quedan intactos; `version += 1`.
- **Receta nueva**: crea el `InventoryItem` de salida (`type` según `--type`,
  default `SUB_RECIPE`, `outputQuantity` 1 KG ajustable luego en UI).
- **Nunca** borra recetas que no estén en el CSV.
- Solo aplica recetas cuyos ingredientes matchearon **todos** contra el
  inventario; el resto se reporta para corregir manualmente.

### 63.3 Parsing robusto (CSV real del chef)

- **Matching de ingredientes** por nombre normalizado (minúsculas, sin acentos,
  espacios colapsados) contra `InventoryItem` activo (`RAW_MATERIAL` |
  `SUB_RECIPE`) + los outputItems nuevos de la misma corrida (recetas usadas
  como ingrediente de otras, ej. "Yogurt").
- **Unidades** normalizadas vía `UNIT_MAP` (GR/GRS→G, LT/LTS→L, UND/UNID→UNIT…);
  unidades no estándar (PIZCA, CUCH, AL GUSTO) se marcan como advertencia.
- **Cantidades**: tolera coma decimal (`3,6`→3.6), fracciones (`1/2 KG`→0.5),
  texto (`Al gusto`/`-`/`/`→null con flag), unidades pegadas (`10 KG`→10).
- **Dos formatos**: Formato A (producción, lista plana) y **Formato B
  (restaurante)**: bloques con fila `INGREDIENTES,<tam1>,<tam2>…` que generan
  **una receta por tamaño** — así cada receta matchea el ítem del POS por
  tamaño (espejo del POS). Salta armados de menú (`Arma tu…`, `Degustación`)
  donde el cliente elige opciones y no hay receta fija.

### 63.4 Reporte de huérfanos (#299)

Tras la corrida, lista recetas del CSV cuyos ingredientes no matchearon y
productos del menú sin receta vinculada, para que el chef corrija nombres o
cree los SKU faltantes. Ningún cambio destructivo: es un diagnóstico de
cobertura.

## §65 Redondeo→propina en cobro de MESA: recibo = sistema = lo cobrado (2026-06-16)

**Reporte de la cajera (con 2 fotos de recibos):** "el sistema redondea fino, me
da exacto lo que debo cobrar, pero cuando imprimo el recibo a veces toma completo
el servicio/propina y otras veces no". Pasaba con cash y zelle → desfase en arqueo.

**Causa raíz (auditada):** en `pos/restaurante/page.tsx` el cobro de mesa usaba
TRES números que no coincidían:
1. **Pantalla** (`paymentAmountToCharge`): redondeaba la factura al dólar entero
   para divisas (`roundToWhole` → `Math.round` con flag off) → le decía a la
   cajera cobrar p.ej. $17.
2. **Recibo** (`printReceipt`) y **registro** (`registerOpenTabPaymentAction`):
   se calculaban aparte como `factura + 10% servicio + propina`, donde la propina
   salía de `checkoutTip` (solo la propina del mesero, NO el delta del redondeo).

Resultado: el delta del redondeo solo quedaba como propina si `checkoutTip` lo
contenía por casualidad. Recibo 1 (factura $16.50, sin propina) imprimió $16.50
pero la cajera cobró $17 → faltan $0.50 en sistema y papel. Recibo 2 (factura
$25.74, propina $0.26) imprimió $26 = lo cobrado. De ahí "a veces sí, a veces no".
Peor aún: con `Math.round` la pantalla podía redondear hacia ABAJO (factura
$x.30 → $x) y entonces cobraba MENOS que la factura.

**Fix (decisión del dueño 16/06 — "redondear hacia arriba y registrar el delta
como propina"):**
- `roundingTipForCharge()` en `src/lib/sales/tip-calculation.ts` (función pura,
  testeada): para métodos divisas efectivo/zelle devuelve `ceil(factura) −
  factura`; 0 en métodos Bs/PDV/móvil y en pago mixto. Determinista (NO depende
  de `exactCashSaleTip`) para que pantalla, recibo y registro muestren el MISMO
  número.
- `handlePaymentPinConfirm`: `tipVal = cappedTipForPayment({ intendedTip:
  max(checkoutTip, roundingTip), ... })`. El cap por excedente real se mantiene:
  si el cliente paga justo (sin entregar el dólar entero, ej. Zelle exacto), la
  propina de redondeo se capa a 0 → no hay propina fantasma.
- La pantalla (`paymentAmountToCharge`) usa `roundDivisasChargeUp` (ceil) para
  mostrar el mismo monto redondeado.

Ahora SIEMPRE: recibo total = `factura + servicio + propina` = monto redondeado
= lo cobrado = lo registrado. El split guarda `factura + propina` (vía
`keptAmountForSplit`), así el arqueo/Z report cuentan la propina una vez y cuadra.
Solo MESA; pickup/delivery siguen con su `roundToWhole` gated por el flag.

Tests: `tip-calculation.test.ts` (+9, incluye los 2 recibos reales). Gates: tsc 0
· vitest 440 passed.

## §66 Dashboard ignoraba el submódulo de usuarios para finanzas/costos (2026-06-16)

**Reporte:** un usuario (Ramiro) con permisos DESACTIVADOS desde `/dashboard/usuarios`
igual veía el dashboard con datos financieros (Resumen Financiero, columna Costo
Unit., acceso a Finanzas). "Lo que se establezca desde el submódulo de usuarios
debe funcionar sí o sí."

**Causa raíz:** coexisten DOS sistemas de permisos:
- **Granular (el correcto):** `src/lib/permissions/has-permission.ts` — 4 capas
  (rol base + `allowedModules` + `grantedPerms` + `revokedPerms`). Es lo que escribe
  el submódulo de usuarios y lo que consumen las server actions vía
  `checkActionPermission` (`src/lib/permissions/action-guard.ts`).
- **Legacy por nivel de rol:** `src/lib/permissions.ts` — `hasPermission(role, level)`
  con `PERMISSIONS.VIEW_COSTS = 80`. Solo compara el nivel numérico del rol.

El **dashboard** (`src/app/dashboard/page.tsx`) gateaba finanzas/costos con el
sistema LEGACY: `const showCosts = hasPermission(session?.role, PERMISSIONS.VIEW_COSTS)`.
Como solo miraba el rol (ADMIN_MANAGER/AUDITOR ≥ 80), desactivar el módulo
`finanzas` o revocar `VIEW_FINANCES`/`VIEW_COSTS` en el submódulo **no tenía
ningún efecto** en el dashboard.

**Fix (Fase 1):** el dashboard ahora resuelve los permisos con el guard granular:
```ts
const [canViewFinances, canViewCosts] = await Promise.all([
  checkActionPermission(PERM.VIEW_FINANCES).then(r => r.ok),
  checkActionPermission(PERM.VIEW_COSTS).then(r => r.ok),
]);
```
- `canViewFinances` → fetch `getFinancialSummaryAction()`, widget Resumen Financiero,
  acceso rápido "Finanzas".
- `canViewCosts` → columnas "Costo Unit." de la tabla de stock bajo.

Respeta `allowedModules`/`grantedPerms`/`revokedPerms`/`isActive`/`tokenVersion`.
`VIEW_FINANCES`→módulo `finanzas`; `VIEW_COSTS`→`costs|margen|finanzas`
(`perm-to-modules.ts`), así que desactivar por módulo o por permiso ambos cortan.

**Fugas pendientes detectadas (NO arregladas en esta fase — mismo patrón):**
- `getDashboardStatsAction` / `getEstadisticasAction`: sin guard granular (solo
  `getSession`), exponen KPIs de ventas a cualquier autenticado.
- Recetas (`RecipeForm`, `RecipeList`, `[id]`) e inventario (`inventory-view`,
  `entrada-form`, `compra-form`): gatean costos con `canViewCosts(role)` /
  `useAuthStore` (role-only, cliente) → también ignoran el submódulo.
- `checkActionPermission` lee `grantedPerms`/`revokedPerms` del JWT, no de BD →
  conceder/revocar exige re-login (lo fuerza `tokenVersion`); cambios de
  `allowedModules` sí aplican al instante.

Gates: tsc 0 · vitest 440 passed.

### §66.1 Fase 2 — costos en recetas/inventario también respetan el submódulo (2026-06-16)

Continuación de §66. Las pantallas de costos gateaban con role-only y se migraron
al sistema granular, **sin regresión** (verificado: roles con `VIEW_COSTS` en
`ROLE_BASE_PERMS` == `COST_VISIBLE_ROLES` exactamente → usuario sin overrides ve lo
mismo de siempre).

- **Cliente (5 componentes):** `store.canViewCosts()` (`src/stores/auth.store.ts`)
  ahora arma un `PermUser` con `user.role` + `permissions` (allowedModules/granted/
  revoked, ya sincronizados del JWT por el Sidebar) y llama al `hasPermission`
  granular de 4 capas con `PERM.VIEW_COSTS`. Un solo cambio arregla RecipeForm,
  RecipeList, inventory-view, entrada-form y compra-form sin tocarlos. Fallback
  seguro: si `permissions` es null, el granular cae al rol base = comportamiento
  histórico. Cadena de imports 100% client-safe (registry sin imports).
- **Server (1 componente):** `recetas/[id]/page.tsx` pasó de `canViewCosts(role)`
  (role-only, `@/types`) a `(await checkActionPermission(PERM.VIEW_COSTS)).ok`.

Sigue siendo solo UX; la data real ya estaba protegida en las server actions. El
hook idiomático cliente para nuevos gates es `usePermission(PERM.X)`
(`src/hooks/use-permission.ts`). Pendiente (Fase 3, no hecha): guards granulares en
`getDashboardStatsAction`/`getEstadisticasAction` y leer granted/revoked de BD en el
guard para evitar el re-login.

Gates: tsc 0 · vitest 440 passed.

### §66.2 Fase 3 — KPIs financieros del dashboard respetan el submódulo (2026-06-16)

Continuación de §66/§66.1. Faltaba que el bloque **ExecutiveSummary** (revenue del
día, cobrado, ticket promedio, propinas, anuladas, cuentas abiertas) respetara lo
configurado en `/dashboard/usuarios`: se rendía con `salesKPIs &&` (existencia del
dato), y `salesKPIs` lo gobernaba un `isAdmin` **por rol** dentro de
`getDashboardStatsAction`. Un ADMIN_MANAGER con finanzas revocadas igual veía esos
números.

**Fix:** en `src/app/actions/dashboard.actions.ts`, el gate financiero pasó de
`isAdmin` (rol) a `showFinance`, una composición **no regresiva**:
```ts
const baseHasFinance = (ROLE_BASE_PERMS[role] ?? []).includes(PERM.VIEW_FINANCES);
const showFinance = !!session && roleAllowsFinance
  && (!baseHasFinance || hasPermission(permUser, PERM.VIEW_FINANCES));
```
- Roles con `VIEW_FINANCES` por base (OWNER/ADMIN_MANAGER/AUDITOR): respetan módulos +
  revoke/grant configurados en usuarios → si se revoca/restringe, se ocultan.
- Roles sin esa base (OPS_MANAGER/AREA_LEAD): conservan el gate por rol histórico →
  **sin regresión** (nadie pierde lo que ya veía).
- `permUser` se arma de la sesión (el JWT ya espeja allowedModules/granted/revoked),
  sin query extra. La forma del return no cambia (los fallbacks a cero/null ya
  existían) → cero riesgo de romper el destructuring del dashboard.

**Deliberadamente NO tocado en esta fase (decisión de seguridad):**
- **`getEstadisticasAction` / `RoleBasedSections`:** tiene 8+ gates financieros
  entrelazados con operativos (`isAdmin || isAuditor || isChef`, `isChef || isAdmin`).
  Una cirugía ahí puede ocultar data operativa a chefs/cajeras o romper el dashboard
  role-based. Queda como Fase 3b (requiere gating field-by-field con verificación).
- **Guards / re-login (`checkActionPermission` lee granted/revoked del JWT):** es
  working-as-designed. `updateUserPerms`/`updateUserModules` bumpean `tokenVersion`,
  que fuerza re-login y aplica el cambio. Para sesiones válidas, JWT == BD (mismo
  tokenVersion ⟹ mismos perms), así que leer de BD sería inerte. Quitar el bump de
  tokenVersion para "evitar el re-login" DEBILITARÍA la invalidación de sesión en
  cambios de privilegio → no se hace.

Gates: tsc 0 · vitest 440 passed.

### §66.3 Fase 3b — RoleBasedSections/getEstadisticasAction respeta el submódulo (2026-06-16)

Cierra la última fuga financiera del dashboard. `getEstadisticasAction` alimenta
`RoleBasedSections` (vistas Admin/Ops/Chef/Auditor). Sus datos financieros se
gateaban con `isAdmin || isAuditor` (por rol) → un OWNER/ADMIN_MANAGER/AUDITOR con
finanzas revocadas en `/dashboard/usuarios` igual veía breakdown de pagos,
descuentos, anuladas y ventas del día.

**Fix (`src/app/actions/estadisticas.actions.ts`):** se reemplazaron SOLO los 7
gates **puramente financieros** `isAdmin || isAuditor` por `showFinance` (misma
composición no-regresiva de §66.2): ventas ayer, ventas mes, cuentas abiertas,
propinas, paymentBreakdown, discountBreakdown, voidedOrders. Además el bloque
`today` (revenue/orders/discounts/avgTicket) se gatea por `showFinance || isCashier`
(único consumidor en UI: `AuditorView`; la cajera conserva su vista propia).

**No regresivo — verificado leyendo `RoleBasedSections.tsx`:**
- OPS_MANAGER/AREA_LEAD muestran `paymentBreakdown` (OpsView) y NO tienen
  VIEW_FINANCES por base → `showFinance` queda `true` siempre → no pierden nada.
- CHEF/KITCHEN_CHEF: gates operativos intactos (`isAdmin || isAuditor || isChef`
  stock, `isChef || isAdmin` cocina/producción, `isAdmin || isChef` top items). No
  usan `today`.
- CASHIER/WAITER: no se renderizan; `today` propio preservado vía `isCashier`.
- OWNER/ADMIN_MANAGER/AUDITOR: respetan módulos + revoke → consistente con §66 (F1)
  y §66.2 (F3).
- Forma del return intacta (los `Promise.resolve` de fallback ya existían) → cero
  riesgo de romper el dashboard. `permUser` se arma de la sesión (sin query extra).

Único caller de `getEstadisticasAction`: `dashboard/page.tsx`. Sin cambios de
schema/DB. Gates: tsc 0 · vitest 440 passed.

### §63.5 Recarga inicial de recetas (2026-06-17): soft-delete + import crudo + re-vínculo

Operación pedida por el dueño: borrar TODAS las recetas viejas y cargar las
nuevas (CSVs "RECETAS ACTUALIZADAS": `scripts/data/recetas-centro-produccion-2026-06.csv`
y `recetas-servicio-completo-2026-06.csv`), priorizando que queden **editables en
la UI** (no se invierte en limpieza previa de nomenclatura — se importa "crudo").

Hechos del schema que hacen segura la operación:
- `Recipe` tiene **soft-delete** (`deletedAt`) → el borrado es reversible.
- El costo de venta es **snapshot** en `SalesOrderItem.costPerUnit/costTotal` → el
  historial/márgenes NO se alteran al recargar recetas.
- `MenuItem.recipeId` apunta directo a la receta → al recargar con ids nuevos, los
  productos quedan **sin descuento** hasta re-vincular (paso explícito).

Herramientas (todas **dry-run por defecto**, destructivo solo con `--apply`):
- `scripts/import-recetas.ts --create-missing` (NUEVO modo): crea un InventoryItem
  placeholder (RAW_MATERIAL, categoría `IMPORT_REVISAR`, costo 0) por cada
  ingrediente sin match → **ninguna receta queda bloqueada**; todo entra y queda
  editable. Los placeholders se revisan/fusionan luego en Inventario.
- `scripts/soft-delete-recipes.ts` — soft-delete **selectivo**: borra solo las
  PREPARACIONES y **preserva** reventa/bebidas (decisión del dueño 17/06: no borrar
  productos de reventa ni bebidas que no ameritan preparación). Clasifica como
  reventa/bebida si el output tiene `beverageCategory`, o la receta es 1:1
  auto-referenciada (único ingrediente == output, patrón de `createResaleProductAction`),
  o no tiene ingredientes. Reversible (`deletedAt`). Flag `--all` para borrar todo.
- `scripts/relink-menu-recipes.ts` — re-vincula `MenuItem.recipeId` por nombre
  normalizado (exacto, o prefijo para recetas por tamaño); reporta ambiguos/sin match.

**Runbook (en el VPS, DATABASE_URL de producción), en orden:**
```bash
# 0. BACKUP de la BD primero.
# 1. Ensayo de import (ver alcance, sin escribir):
npx tsx scripts/import-recetas.ts scripts/data/recetas-centro-produccion-2026-06.csv
npx tsx scripts/import-recetas.ts scripts/data/recetas-servicio-completo-2026-06.csv
# 2. Soft-delete de las viejas (ensayo y luego aplicar):
npx tsx scripts/soft-delete-recipes.ts
npx tsx scripts/soft-delete-recipes.ts --apply
# 3. Import crudo (producción PRIMERO — son sub-recetas usadas por servicio):
npx tsx scripts/import-recetas.ts scripts/data/recetas-centro-produccion-2026-06.csv --apply --create-missing
npx tsx scripts/import-recetas.ts scripts/data/recetas-servicio-completo-2026-06.csv --apply --create-missing --type=FINISHED_GOOD
# 4. Re-vincular menú (ensayo y luego aplicar):
npx tsx scripts/relink-menu-recipes.ts
npx tsx scripts/relink-menu-recipes.ts --apply
```
Las recetas creadas son filas `Recipe` normales → editables desde el módulo Recetas
(`updateRecipeAction`) por OWNER/ADMIN_MANAGER/OPS_MANAGER/CHEF.

## §67 Anular comanda completa — void de toda la orden con un solo PIN (2026-07-03)

Pedido de Jhulian (mesero capitán): cuando una comanda entera se marcha a la
mesa equivocada, anular ítem por ítem (PIN + motivo por cada línea) tomaba
~5 minutos. Ahora existe **"Anular comanda"** por orden completa.

### Acción de servidor

`voidEntireTabOrderAction({ openTabId, orderId, captainPin, reason, waiterProfileId? })`
en `src/app/actions/pos.actions.ts` (después de `modifyTabItemAction`):

- **Dual PIN** vía `resolveVoidAuthPin` (Waiter capitán de la sucursal O User
  OWNER/ADMIN_MANAGER/OPS_MANAGER/AREA_LEAD) — mismo pool que el void por ítem.
- Carga la orden (tenant-scoped, validando `openTabId`) con ítems `voidedAt: null`
  + modifiers + categoría del MenuItem.
- **Una sola transacción** (`timeout: 30_000` porque cada void escribe item,
  totales e inventario): loop de `voidItemInTx` por ítem → soft-delete con
  `voidedAt/voidReason/voidedBy*`, limpia `subAccountItem`, recalcula totales de
  orden y tab, y **reintegra inventario** (receta del plato + recetas de
  modificadores con `linkedMenuItemId`) vía `applyItemInventoryInTx RESTORE`.
- `reason` se persiste como `"<motivo> [Comanda completa] | Mesonero: <nombre>"`.
- Devuelve `kitchenPrintItems[]` — un payload VOID_KITCHEN por ítem para que el
  cliente los encole con `enqueueVoidKitchenCommand` y cada anulación se enrute
  a su estación (barra vs cocina) según `categoryName`.

### UI

- **POS Mesero** (`pos/mesero/page.tsx`): botón "Anular comanda" (icono `Ban`)
  en el footer de cada card de comanda enviada — visible para cualquier mesero,
  el PIN es el gate (mismo criterio que la X por ítem). Modal z-[60] con
  advertencia, motivo obligatorio y PIN; al confirmar imprime los VOID y
  refresca tab + subcuentas.
- **POS Restaurante** (`pos/restaurante/page.tsx`): mismo botón en cada card de
  "Consumos cargados" + mismo modal.

### Transferir mesa (contexto del mismo pedido)

NO se tocó código: `moveTabBetweenTablesAction` (mover cuenta a otra mesa
física) ya existía, gateada por `canUseCaptainFeatures`
(`Waiter.isCaptain || rol gerente`). Para habilitar a un mesero se le marca
**Capitán** en `/dashboard/mesoneros` (checkbox del form) y se le asigna PIN —
con eso ve el botón "Transferir mesa" y autoriza con su propio PIN.

Gates: tsc 0 · vitest 447 passed.

## §68 Script hard-delete de sub-recetas del inventario (2026-07-03)

`scripts/hard-delete-subrecipe-items.ts` — borrado DEFINITIVO (no soft) de los
`InventoryItem type='SUB_RECIPE'` de un tenant, pedido para limpiar el catálogo
de Shanklish. Dry-run por defecto, `--apply` para ejecutar,
`SEED_TENANT_SLUG=<slug>` para elegir tenant.

- **Bloqueadores** (item se salta y se reporta): ingrediente de receta viva
  (override `--force-ingredients`), líneas de PurchaseOrder, referencias en
  procesamiento de proteínas/plantillas, órdenes de producción de su receta.
- **Borra con el item** (transacción por item, timeout 60s): movimientos,
  stock por área, cost history, líneas de conteo semanal/daily/auditoría/
  ciclos, requisiciones, préstamos, catálogo de proveedor, RecipeIngredient
  de recetas soft-borradas y sus Recipe propias (antes desvincula
  `MenuItem.recipeId`). AreaCriticalItem y SupplierItemPriceHistory caen por
  CASCADE.
- **Referencias escalares sin FK** que quedan colgando (solo se reportan):
  `ProductionOrder.outputItemId`, `SupplierDocumentItem.inventoryItemId`,
  `IntercompanySettlementLine.inventoryItemId`.

Runbook: backup BD → ensayo sin flags → revisar bloqueados → `--apply`.

## §69 Recetas — vista tabla + soft-delete desde la UI (2026-07-04)

Pedido de Christian: los cards de recetas ocupaban demasiada pantalla con
cientos de recetas. `RecipeList.tsx` pasó de grid de cards a **tabla densa**:

- Columnas: Receta (icono tipo + nombre + Sub-receta/Producto Final),
  Categoría, Rinde, Costo/Unidad (con botón recalcular, solo si canViewCosts),
  Estado (Aprobada/Borrador), Acciones.
- Fila completa clicable → `/dashboard/recetas/[id]` (editar).
- Filtros: búsqueda fuzzy + select de categoría + select de tipo
  (sub-receta / producto final). Contador "X de Y".
- **Soft-delete por fila** (Trash2, confirm nativo): nueva
  `deleteRecipeAction(id)` en `recipe.actions.ts` — roles
  OWNER/ADMIN_MANAGER/OPS_MANAGER/CHEF, setea `deletedAt + isActive=false`
  (mismo patrón que scripts/soft-delete-recipes.ts), NO toca
  `MenuItem.recipeId` pero reporta en el toast cuántos productos del menú
  usaban la receta (quedan sin descargo hasta re-vincular).
- `getRecipesAction` ya filtraba `isActive: true` → las borradas desaparecen.

## §70 Inventario Diario — consumo POS automático + teórico en vivo (2026-07-04)

Bug de fondo (pedido de Christian: "no veo lo consumido teóricamente"):
`getDailyInventoryAction` re-sincronizaba `sales` en CADA carga (SYNC 2.b)
con solo transferencias+producción, **pisando** lo que el botón manual
"Importar desde POS" (`syncSalesFromOrdersAction`) hubiera escrito. El
consumo POS se borraba al instante de recargar la página.

Fix:
- **`getDailyInventoryAction` ahora computa el consumo POS adentro**: órdenes
  COMPLETED del área en rango Caracas (§20), excluyendo órdenes anuladas /
  soft-deleted **y ítems con `voidedAt`** (su inventario ya se reintegró),
  vía `computeConsumptionFromOrders`. Se suma al `autoSales` que SYNC 2.b
  persiste → el consumo teórico aparece solo, sin apretar botones.
- **`computeConsumptionFromOrders` ahora incluye modificadores**: cada
  modifier con `linkedMenuItem.recipeId` suma su receta × cantidad de la
  línea (espejo del descargo real del POS §67). `collectReferencedRecipeIds`
  también los colecta. El botón manual quedó consistente (mismo include).
- **UI (`daily-manager.tsx`)**: el "Cierre Teórico" ya NO lee
  `item.theoreticalStock` (que se persistía solo al Guardar y mostraba 0):
  se calcula EN VIVO con `calcTheoretical()` = Apertura real + Ingresos −
  Consumo − Merma, en tabla, cards móviles, totales y export Excel. Puede
  ser **negativo** y se muestra igual (tinte danger) — señal de faltante de
  entradas/conteo, no error.

Nota: `theoreticalStock` persistido sigue calculándose al Guardar (lo usan
reportes); la UI simplemente no depende más de él para mostrar.

## §71 Modificadores — auditoría de descargo visible (2026-07-04)

Pregunta de Christian: "si al shawarma le agregan falafel, ¿cuánto falafel
descuenta?". Respuesta del sistema: la receta COMPLETA del MenuItem vinculado
(`linkedMenuItemId`) × cantidad de la línea; si no hay vínculo, NO descuenta.
Para auditar eso de un vistazo:

- `getModifierGroupsWithItemsAction` ahora calcula por modificador un objeto
  `deduction`: status `OK | NO_LINK | NO_RECIPE | RECIPE_INACTIVE` +
  `recipeName` + `ingredients[{name, quantity, unit}]`. (MenuItem.recipeId es
  escalar sin FK → batch-fetch de recetas aparte.)
- UI `/dashboard/menu/modificadores`: cada fila muestra el estado real
  ("Descuenta" verde / "No descuenta" / "Sin receta" / "Receta inactiva" en
  coral) y, si descuenta, una línea de detalle: `Descuenta por unidad
  (receta "X"): 0.09 KG Masa falafel · …`.
- Migración de emojis del archivo a lucide (✅→toast plano, 🗑️→Trash2,
  ⚠️→AlertTriangle, ▼/▶→ChevronDown/Right) per regla CLAUDE.md.

Config recomendada para porciones distintas al plato (ej. "extra falafel" =
2 unidades, no la porción de 4): crear MenuItem "Falafel (extra)" con su
propia receta de porción y vincular el modificador a ESE item.

## §72 SKU dedupe — auditoría y fusión de items duplicados (2026-07-04)

`scripts/sku-dedupe.ts` — dos modos, tenant via `SEED_TENANT_SLUG`:

1. **Auditoría** (default, solo lectura): agrupa items activos por nombre
   normalizado (minúsculas, sin acentos, sin sufijo de unidad KG/LTS/UND —
   misma familia de normalización que import-recetas). Lista grupos con 2+
   items con sus referencias (movimientos, usos en recetas vivas, recetas
   propias, stock total) y sugiere canónico = el más referenciado. Reporta
   además items sin categoría real (null/GENERAL/IMPORT_REVISAR). Escribe
   `scripts/data/fusiones-propuestas.csv` para revisar a mano.

2. **Fusión** (`--merge=DUP:CANON` o `--merge-file=csv`; escribe solo con
   `--apply`; transacción por par, timeout 120s):
   - RecipeIngredient: re-apunta; si la receta ya usa el canónico, SUMA
     cantidades y borra la línea duplicada.
   - InventoryLocation: suma stock por área al canónico (o re-apunta).
   - CostHistory: cierra el costo vigente del duplicado y migra el historial.
   - Movimientos, requisiciones, compras, préstamos, auditorías, proteínas,
     plantillas y refs escalares sin FK → updateMany al canónico.
   - Tablas con unique (Daily/Weekly/CycleSnapshot/AreaCritical/SupplierItem/
     TemplateOutput): re-apunta o borra la fila dup si el canónico ya tiene.
   - Duplicado queda `isActive=false` + description `[FUSIONADO → SKU]`.
   - Regla dura: baseUnit debe coincidir; pares con unidades distintas se
     saltan (van comentados en el CSV propuesto).

Runbook: backup → auditoría → revisar/editar CSV → ensayo con --merge-file →
--apply. Recategorización: editar category desde la lista del reporte (la UI
de Inventario permite editar categoría por item).

## §73 BUG deploy — cron de cleanup borraba el staging de un deploy en curso (2026-07-04)

Síntoma: `deploy-vps.sh` lanzado 11:59:59 falló en `[4/9] npm ci` con
`ENOENT package.json` en `/var/www/capsula-erp-NEW-<ts>` — el directorio
desapareció a mitad de la instalación.

Causa: `cleanup-deploy-artifacts.sh` (cron diario a las 12:00) borraba
**cualquier** `capsula-erp-NEW-*` incondicionalmente ("se borran SIEMPRE"),
incluyendo el staging del deploy que estaba corriendo en ese momento.

Fix: la sección 1 del cleanup ahora SALTA los NEW-* con menos de
`--min-new-age-minutes` (default 360 = 6 h) de antigüedad — un deploy tarda
minutos, así que solo borra residuo genuino. El deploy-vps.sh no cambia:
cuando invoca el cleanup al final, su propio staging ya fue movido al
directorio activo por el swap.

Recuperación operativa tras el fallo: simplemente relanzar
`bash scripts/deploy-vps.sh main` — el fallo fue antes del swap, la app
vieja nunca dejó de atender y no quedó estado a medias (el NEW ya fue
borrado por el propio cron).

## §74 Importador de recetas desde plantilla Excel (2026-07-04)

Christian recarga las recetas manualmente con `Plantilla_Recetas_CAPSULA.xlsx`
(5 hojas: Instrucciones, INSUMOS_NUEVOS, RECETAS_CABECERA,
RECETAS_INGREDIENTES, MENU_ITEMS opcional, REFERENCIA).
`scripts/import-recetas-xlsx.ts` lee el .xlsx DIRECTO (lib `xlsx`, ya dep).

Decisiones clave (pedido de Omar: "el POS debe seguir funcionando siempre"):
- **Reemplazo in-place, NO wipe**: receta existente (match por nombre
  normalizado, deletedAt null) → se le reemplazan ingredientes y cabecera
  con version+1, MISMO Recipe.id → `MenuItem.recipeId` queda válido →
  **cero ventana sin descargo**. Solo se crean recetas nuevas para nombres
  sin match. No hace falta soft-delete previo.
- Catálogo/menú/modificadores intactos: solo crea insumos de INSUMOS_NUEVOS
  que no existan (match exacto/unit-strip) y placeholders IMPORT_REVISAR
  con `--create-missing`.
- Filas de EJEMPLO de la plantilla se detectan por nombre y se saltan.
- Ingredientes pueden referenciar `producto_salida` de sub-recetas de la
  misma corrida (pass 1 crea outputs, pass 2 recetas; SUB_RECIPE primero).
- MENU_ITEMS: actualiza (recipeId/precio/routing/disponible) por nombre o
  crea (categoría find-or-create, precio obligatorio para nuevos).
- Errores de formato (tipo inválido, cantidad ilegible, receta sin
  ingredientes, ingrediente de receta inexistente) abortan el --apply.

Uso: `SEED_TENANT_SLUG=shanklish npx tsx scripts/import-recetas-xlsx.ts
archivo.xlsx [--apply] [--create-missing]` — ensayo por default.

### §74.1 Flag --prune / --prune-all del importador xlsx (2026-07-04)

Pedido del gerente de Shanklish: "borrar todo y cargar limpio". En vez de
wipe previo (ventana sin descargo en POS), el importador ahora soporta:
- `--prune`: tras aplicar la plantilla, soft-deletea toda receta viva que NO
  vino en el archivo, preservando reventa/bebidas (criterio
  soft-delete-recipes). Como el reemplazo es in-place ANTES de la poda, las
  recetas del archivo nunca dejan de existir → cero interrupción del POS.
- `--prune-all`: poda también reventa/bebidas (todo lo no cargado).
- Reporta los MenuItems que quedaron apuntando a recetas podadas (sin
  descargo hasta re-vincular); no toca el MenuItem.
Resultado equivalente a "borrón y cuenta nueva" pero atómico y reversible
(soft-delete). Los items sub-receta huérfanos se limpian después con
hard-delete-subrecipe-items.ts, y los insumos duplicados con sku-dedupe.ts.

## §75 Wipe de todo lo no-catálogo — recetas + insumos, POS intacto (2026-07-04)

Decisión de Omar/gerente: "borrar todo lo que no sea catálogo" para recargar
limpio desde la plantilla Excel. `scripts/wipe-non-catalog.ts`:

- Recetas (todas, incl. sub-recetas): soft-delete masivo (reversible).
- InventoryItems: HARD delete los que no tienen NINGUNA referencia (borra
  antes sus locations/costHistory; cascades cubren AreaCritical y
  SupplierItemPriceHistory); los que tienen historial se DESACTIVAN
  (isActive=false) — la BD no permite borrarlos sin destruir trazabilidad.
- Catálogo POS (MenuItem/MenuCategory/modificadores/mesas): NO se toca; el
  script imprime el conteo como verificación.
- Doble confirmación obligatoria: `--apply --confirm=BORRAR-TODO-<SLUG>`.
- Post-wipe el POS vende sin descargo hasta: (1) importar plantilla
  (`import-recetas-xlsx.ts --apply --create-missing`), (2) RE-VINCULAR
  platos→recetas (hoja MENU_ITEMS o `relink-menu-recipes.ts --apply`) —
  obligatorio porque los recipeId viejos quedan apuntando a recetas
  soft-borradas.

## §76 Feature Flags — auditoría del submódulo + fix de visibilidad (2026-07-04)

Auditoría pedida por Omar del submódulo `/dashboard/config/feature-flags`:

**Arquitectura (sana):** flags en `Tenant.featureFlags` (JSONB, por tenant),
catálogo en `src/lib/feature-flags.ts` (6 flags: hideCashierPaymentMethod,
requirePaymentConfirmation, unifyTipReporting, promotionsEnabled,
deliveryOps, exactCashSaleTip). Default false. Cache in-memory 30s TTL por
tenant, invalidada al togglear. Acciones server-side gateadas a OWNER
(lectura de config y toggle); `getActiveFeatureFlagsAction` (solo booleanos)
disponible a cualquier autenticado para el POS. El módulo aparece en TODOS
los tenants por diseño (enabledByDefault + auto-enable de módulos nuevos),
cada OWNER ve/toglea SOLO los flags de su tenant.

**BUG encontrado y corregido:** `getVisibleModules` saltaba el filtro por
rol cuando el usuario tenía `allowedModules` individuales ("única
autoridad") — solo `module_config` estaba especial-caseado. Un no-OWNER con
`feature_flags` en su lista veía el módulo en el sidebar (la página y las
acciones sí bloqueaban server-side → sin fuga de datos, pero link muerto y
superficie confusa). Fix genérico: módulos cuyo `MODULE_ROLE_ACCESS` es
exactamente `['OWNER']` (hoy: module_config y feature_flags) se gatean por
ROL siempre, ignorando allowedModules. `allowedModules` sigue extendiendo
módulos operativos (ej. AREA_LEAD + pos_restaurant, §4). Tests en
module-gate.test.ts (452 total).

Nota operativa: cambios de flag tardan hasta 30 s por el cache; con pm2 en
modo cluster cada worker tiene su propio cache (mismo tope de 30 s).

## §77 Módulo Conversaciones WhatsApp — bandeja humana + bot n8n (2026-07-04)

Módulo nuevo `/dashboard/conversaciones`: bandeja de WhatsApp (Cloud API Meta)
donde el personal ve las conversaciones del bot "Fabiola" (n8n), toma el
control (bot callado) y responde como humano, con compliance de Meta forzado
por el servidor. Kpsula = fuente de verdad + panel humano; el bot vive en n8n.

### Modelos (schema.prisma, 6 enums nuevos + 4 tablas)
- **WaConversation** (`@@unique[tenantId,waId]`): status BOT/HUMAN/CLOSED,
  assignedToUserId, ventana 24h (lastCustomerMsgAt/windowExpiresAt),
  marketingOptIn/optedOutAt, lastOrderId, unreadCount.
- **WaMessage** (tenantId escalar sin FK, aísla vía conversación — patrón
  SalesOrderPayment): direction, senderType (CUSTOMER/BOT/HUMAN), kind, body,
  media, wamid `@unique`, deliveryStatus, errorDetail.
- **WaTemplate** (`@@unique[tenantId,name,language]`): plantillas Meta con
  approvalStatus; el registro/aprobación en Meta es manual, acá se refleja.
- **WaCredential** (`tenantId @unique`): phoneNumberId, wabaId, accessToken
  CIFRADO (AES-256-GCM), appSecret. Migración `20260704190000_wa_conversations`
  (solo CREATE TABLE/INDEX/FK → safe en prod viva). Los 4 modelos en
  TENANT_MODELS (ahora 72).

### Compliance (§4, funciones puras en `src/lib/wa/compliance.ts` + 20 tests)
- Ventana 24h: `checkOutboundAllowed` rechaza texto libre fuera de ventana
  (WINDOW_EXPIRED); plantillas APPROVED siempre.
- Opt-out BAJA/STOP/no molestar/unsubscribe (texto normalizado exacto):
  bloquea salvo respuestas dentro de ventana y plantillas UTILITY.
- Opt-in marketing: MARKETING solo con marketingOptIn && !optedOut.
- Anti-spam: 10 OUTBOUND sin INBOUND → bloqueo suave (override gerente).
- Todo server-side; la UI solo lo refleja (input deshabilitado + explicación).

### Lib server (`src/lib/wa/`)
- `graph.ts`: `sendWhatsAppMessage` (text/template/image/document; mapea Graph
  131047→WINDOW_EXPIRED, 190→apaga credencial) + `downloadWaMedia` (los mediaId
  de Meta expiran → storage local `/api/files/<tenant>/wa-media/`).
- `crypto.ts`: AES-256-GCM del accessToken (env `WA_TOKEN_ENC_KEY`, 64 hex);
  tolera valores legacy sin cifrar; `maskToken` para UI.
- `auth.ts`: `authenticateWaApi` (header x-api-key vs env `WA_API_KEYS`, fallback
  `DELIVERY_API_KEYS`).
- `service.ts`: `processInboundMessage`, `sendHumanMessage`,
  `countConsecutiveOutbound`, `updateDeliveryStatusByWamid`.
- `guard.ts` / `require-conversaciones-page.ts`: sesión + PERM.CONVERSATIONS_MANAGE
  + flag waConversations.
- `control-cache.ts`: cache 5s BOT/HUMAN para el endpoint /control.

### API (`/api/v1/wa/*`, auth x-api-key + flag; contrato en
docs/WA_CONVERSATIONS_N8N_CONTRACT.md)
- n8n: `POST /inbound` (→ {status,conversationId,optedOut}; si HUMAN, Fabiola
  calla), `POST /outbound/bot`, `POST /status`, `GET /conversations/:waId/control`.
- `/api/v1/delivery/ordenes` acepta `conversationId` opcional → setea lastOrderId
  (§6.3, chip "Pedido" en la bandeja).
- UI: server actions en `src/app/actions/wa.actions.ts` (list, messages, take,
  release, send, read, templates CRUD, settings) — patrón data igual a delivery
  (server component precarga + polling client 15s bandeja / 5s chat).

### RBAC / registry / flag
- Permiso nuevo `PERM.CONVERSATIONS_MANAGE` (base de OWNER/ADMIN_MANAGER/
  OPS_MANAGER; grupo admin; perm-to-modules → 'conversaciones').
- Módulo `conversaciones` en MODULE_REGISTRY (sortOrder 413, section admin,
  `requiresFeatureFlag: 'waConversations'`) + MODULE_ROLE_ACCESS + icono
  MessagesSquare. Flag `waConversations` en FEATURE_FLAGS (arranca OFF).

### UI (`conversations-view.tsx`, tablet landscape, Minimal Navy)
Dos paneles: bandeja (filtros Todas/Bot/Humano/Por-expirar, búsqueda, badge
unread, indicador de ventana verde/amarillo/rojo/gris) + chat (burbujas estilo
WhatsApp con tag Fabiola/usuario, checks ✓/✓✓/✓✓-azul/⚠, render imagen/doc/
ubicación, chip Pedido). Botón "Tomar conversación"/"Devolver a Fabiola",
contador de ventana, input deshabilitado fuera de ventana con selector de
plantillas (preview en vivo, bloqueo MARKETING sin opt-in). Takeover auditado.

### Seed
`scripts/seed-wa-demo.ts`: 3 plantillas (confirmacion_pedido,
pedido_en_camino UTILITY, reactivacion_cliente MARKETING) + 2 conversaciones
fake (una en ventana abierta, otra expirada + opted-out para probar bloqueos).

### Env nuevas (VPS)
`WA_TOKEN_ENC_KEY` (obligatoria para cifrar tokens), `WA_API_KEYS` (opcional;
si falta usa DELIVERY_API_KEYS). Gates: tsc 0 · vitest 473 passed.

### §77.1 Hardening post-review adversarial (2026-07-04)
Revisión adversarial (5 dimensiones × verificación) sobre el módulo antes del
merge: 9 hallazgos confirmados corregidos, 3 falsos positivos descartados.
- **IDOR cross-tenant (HIGH)**: `/outbound/bot` deduplicaba por `wamid`
  (`@unique` global) con `findUnique` sin tenantId → podía leakear/suprimir
  mensajes de otro tenant. Fix: `findFirst({where:{wamid,tenantId}})` (espejo
  de processInboundMessage).
- **Crashes de API (MEDIUM)**: `inbound`/`outbound/bot`/`status` crasheaban con
  body `null` literal o campos no-string (`.trim()` sobre número). Fix:
  guardas de tipo antes de tocar el body.
- **Race opt-out (LOW)**: dos BAJA casi simultáneas mandaban doble confirmación.
  Fix: compare-and-set atómico (`updateMany where optedOutAt:null`, count===1).
- **isOptOutMessage (MEDIUM)**: solo match exacto → no detectaba "quiero darme
  de baja". Fix: keywords canónicas + patrones de frase que distinguen baja de
  "cancelar el pedido".
- **appSecret en claro (MEDIUM)**: se guardaba sin cifrar mientras el token sí.
  Fix: ambos con el mismo AES-256-GCM.
- **UI (MEDIUM/LOW)**: chat no se reseteaba al cambiar de conversación (mostraba
  la anterior) → `setChat(null)` + spinner; badge unread fantasma con chat
  abierto → re-mark read en el polling.
Gates finales: tsc 0 · vitest 474 passed (21 de compliance).

## §78 Carga inicial de insumos Shanklish desde CSV (2026-07-05)

`scripts/import-insumos-csv.ts` + `scripts/data/insumos-shanklish-2026-07.csv`
(395 insumos, 29 categorías) — catálogo limpio post-wipe §75.

CSV original de Omar (406 filas) depurado con decisiones registradas:
duplicados exactos omitidos (PAPRIKA, BERENJENA, DESENGRASANTE, SUMAC',
VERMÚ ROSSO, ÁCIDO CÍTRICO en UNIT, STOLICHNAYA sin UND, TE VERDE sin tilde),
typo REPOLLO BALNCO→BLANCO, GRABANZO→GARBANZO (queda en PASTA Y GRANOS),
VERMU EXTRA DRY = VERMÚ EXTRA SECO (fusionados), BLUE CURACAO (ENVASES) =
CURACAO AZUL (LICORES, fusionados). Decisión de Omar: PISTACHO KG (FRUTOS
SECOS) y PISTACHO POSTRES KG (POSTRES) son DOS items; SAATAR y ZAATAR son
DOS condimentos distintos.

Script: idempotente (salta items activos con mismo nombre normalizado),
SKU `PREFIJO-###` por categoría verificando contra TODOS los SKUs del
tenant (los archivados del wipe siguen ocupando su SKU), costo opcional
(no se usa por ahora), es_critico SI→true. Dry-run default, --apply.

### §18.39 Inventario — tabla compactada sin scroll horizontal (2026-07-05)
`inventory-view.tsx`: eliminada la columna "Tipo" (redundante: el icono del
avatar ya lo indica —con title tooltip— y el label va como texto junto al SKU
"SKU · Insumo"; el filtro por tipo son las tarjetas superiores). Paddings
px-6→px-3/px-4, py-4→py-3, avatar 10→8, nombre con truncate+title,
whitespace-nowrap en stock/estado/costo, header "Costo/U", columna Acciones
sin label (sr-only). Solo JSX/CSS — cero cambios de lógica/orden/filtros.

## §79 Nota de entrega — forma de pago + punto de venta en el recibo (2026-07-05)

Pedido de la cajera: ver el método de pago y el PDV en la nota de entrega
(recibo de DELIVERY). En este sistema el PDV ES el método (PDV_SHANKLISH /
PDV_SUPERFERRO), así que mostrar el método cubre ambas cosas.

- `print-command.ts`: nuevo helper exportado `paymentMethodLabel(method)`
  (espejo textual de getPaymentBadge; distingue PDV Shanklish/Superferro).
  `ReceiptData.payments?: {method, amountUSD?, amountBS?}[]` — sección
  "Forma de pago" tras los totales (una línea por pago; mixto = varias).
  NO se imprime en pre-cuenta (isPrecuenta, informativa antes de cobrar).
- POS Delivery (`pos/delivery/page.tsx`): pasa `payments` al cobrar —
  mixto = mixedPayments, simple = [{method: paymentMethod, amountUSD: total}].
- Reimpresión desde historial (`sales/page.tsx`): pasa `paymentBreakdown`
  (mixto) o `paymentMethod` (simple), GATEADO por `!hidePaymentMethod`
  (blindaje cajera §47: si el flag está activo el server ya stripeó el dato).

Solo print/JSX + un campo opcional — sin cambios de lógica de cobro.
Gates: tsc 0 · vitest 474 passed.

## §80 Receta propia de modificadores — MenuModifierIngredient (2026-07-06)

Pedido de Christian: "el modificador debería poder tener receta en sí, que
puede ser de materias primas o items de venta". Ej: shawarma de lomito →
cliente pide kafta → el modificador descuenta X gramos de KAFTA KG sin crear
un MenuItem "extra"; tipos de leche en cafés sin crear un producto por leche.

### Modelo (prisma/schema.prisma + migración 20260706120000)
`MenuModifierIngredient`: pivot SIN tenantId (hereda scope por FK, patrón
RecipeIngredient) — `modifierId` (FK MenuModifier, onDelete Cascade),
`ingredientItemId` (FK InventoryItem, relación "ModifierIngredientItem"),
`quantity Float`, `unit String` (KG/G/L/ML/UNIT/PORTION),
`@@unique([modifierId, ingredientItemId])`. Relación `ingredients` en
MenuModifier. Migración safe (CREATE TABLE + índices + FKs).

### Regla de descargo — PRIORIDAD
1. **Receta propia** (`modifier.ingredients` con ≥1 fila) → descuenta esos
   insumos directo × cantidad de la línea. El `linkedMenuItemId` queda
   IGNORADO para inventario (sigue sirviendo de fallback y para precio).
2. **Fallback**: sin ingredientes directos → receta del MenuItem vinculado
   (`linkedMenuItem.recipeId`), comportamiento histórico.

Aplicada en TODOS los caminos:
- `pos.actions.ts`: `validateComponentStockAvailability`,
  `registerInventoryForCartItems` (venta) y `applyItemInventoryInTx`
  (reversión void/adjust/replace) — mismo criterio en débito y crédito.
- `src/lib/inventory/consumption.ts` (consumo teórico §77):
  `OrderForConsumption.modifiers[].modifier.ingredients?` opcional;
  `computeConsumptionFromOrders` prioriza directos con `continue`.
  Tests: prioridad sobre linkedMenuItem, ingredients vacío = fallback,
  cantidades ≤0/NaN ignoradas (consumption.test.ts, 478 total).
- `inventory-daily.actions.ts`: los 2 includes de posOrders (carga diaria y
  sync manual) traen `ingredients: { ingredientItemId, quantity }`.

### Actions (modifier.actions.ts)
- `getModifierGroupsWithItemsAction`: include de `ingredients` (+nombre del
  insumo); `deduction` ahora lleva `source: 'OWN' | 'LINKED'` — OWN gana y
  reporta status OK con los insumos directos.
- `setModifierIngredientsAction(modifierId, rows[])`: replace-all
  (deleteMany + createMany en $transaction con cliente crudo). Valida
  ownership tenant del modifier Y de cada ingredientItemId (findMany
  in + deletedAt null), duplicados, quantity > 0, unit en whitelist.
  Lista vacía = quitar receta propia (vuelve al fallback).
- `getInventoryItemsForModifierRecipeAction`: insumos activos (id, name,
  sku, baseUnit, type) para el picker.

### UI (/dashboard/menu/modificadores)
Botón matraz (FlaskConical) por fila — verde si hay receta propia. Modal
estándar z-[60]: filas insumo+cantidad+unidad (default = baseUnit del
insumo), buscador por nombre/SKU (mín 2 chars, top 8), quitar fila,
guardar/quitar receta. Detalle de fila: "Descuenta por unidad (receta
propia): 0.12 KG KAFTA KG · …" + aviso "el vínculo a plato queda ignorado"
si además hay linkedMenuItemId. El cambio de vínculo NO borra el badge OWN.

Gates: tsc 0 · vitest 478 passed. Requiere `migrate deploy` (§44) al
deployar — la migración es safe (solo CREATE).

### §80.1 Fix: decimales pequeños en formulario de recetas (2026-07-06)

Christian no podía escribir `0.009` como cantidad de un ingrediente en
`recetas/nueva/RecipeForm.tsx`. Causa: inputs numéricos CONTROLADOS con
estado number + `parseFloat(e.target.value) || 0` por tecla — al tipear
"0." el intermedio parsea a 0, React re-renderiza `value={0 || ''} = ''`
y el input se limpia; imposible completar cualquier decimal. Además
`step="0.01"` invalidaba 0.009.

Fix (patrón correcto — el mismo del modal de receta propia §80): estado
STRING mientras se tipea, `parseFloat` solo al usar el valor:
- `outputQuantityStr` / `yieldPercentageStr` (derivan number con
  `parseFloat || fallback`), `newQuantityStr` / `newWasteStr`.
- Todos los inputs de cantidad con `step="any"`.
- Botón Agregar valida `parseFloat(newQuantityStr) > 0`.
- Display de la lista con `formatNumber(q, 4)` (antes 2 decimales →
  0.009 se mostraba "0,01").

REGLA para inputs numéricos con decimales en React: nunca guardar number
y parsear por tecla; guardar string y parsear al submit. `step="any"`.

## §81 WA Conversaciones — UI de configuración de credencial (2026-07-08)

Gap detectado al activar el módulo en pokepok: el banner rojo decía
"Configurala con un OWNER/ADMIN" pero las actions `getWaSettingsAction` /
`saveWaSettingsAction` (§5.2) no tenían NINGUNA UI que las llamara.

- `require-conversaciones-page.ts` ahora devuelve `{ tenantId, role }`;
  la page pasa `canConfigure = role ∈ {OWNER, ADMIN_MANAGER}` (espejo del
  RBAC server-side de las actions — la UI solo esconde, el server manda).
- `conversations-view.tsx`: botón "Configurar credencial" en el banner
  rojo + engranaje fijo junto al buscador de la bandeja (solo
  canConfigure). Modal estándar z-[60]: Phone Number ID*, WABA ID*,
  teléfono visible, versión Graph (default v21.0), Access Token y App
  Secret como password con autoComplete off — en edición muestran
  "Guardado (••••1234) — dejar vacío para mantener" (el server solo
  re-cifra si se envía valor nuevo), checkbox credencial activa.
  Al guardar: toast + `router.refresh()` → el banner de salud se
  actualiza desde el server component.

Requisito de entorno: `WA_TOKEN_ENC_KEY` (64 hex, `openssl rand -hex 32`)
en el .env del VPS — sin ella `encryptToken` lanza y la action devuelve
el error legible en el toast. Restart pm2 tras agregarla.

## §82 Modificadores anidados — sub-grupo al seleccionar (2026-07-08)

Pedido de Omar (caso Shanklish): en "Arma tu Shanklish", al marcar "Pincho
Mixto" debe desplegarse una segunda selección — vara mixta o combinación de
sabores por unidad (pollo/carne/kafta/mixto). Se vende la vara mixta o la
ración armada.

### Modelo
`MenuModifier.childGroupId String?` → FK a MenuModifierGroup (relación
"ModifierChildGroup", ON DELETE SET NULL). Migración
`20260708100000_menu_modifier_child_group` (ADD COLUMN NULLABLE + índice +
FK — safe). **UN solo nivel de anidación** (el POS renderiza un nivel; un
childGroupId dentro de un sub-grupo se ignora).

### Diseño clave — los hijos son modifiers NORMALES
La selección hija vive en el MISMO `currentModifiers` de cada página POS
(con `groupId = childGroup.id`) y se explota igual al carrito
(`{modifierId, name, priceAdjustment}`). Por eso NO hubo cambios en:
persistencia (SalesOrderItemModifier), impresión de comanda (string[] de
names), precio (priceAdjustment × qty) ni descargo de inventario (receta
propia §80 / linkedMenuItem del hijo funcionan igual).

### Piezas
- `src/lib/pos-child-group.ts` (PURO, 13 tests): `hasChildGroup` (activo y
  con opciones), `purgeChildSelections` (al deseleccionar/reemplazar el
  padre se limpian los hijos — llamar tras CADA mutación del grupo),
  `childGroupsValid` (padre elegido + childGroup requerido → suma de qty
  hijas ≥ max(minSelections, isRequired?1:0)), `childGroupSelectedTotal`.
- `src/components/pos/ChildGroupSelector.tsx`: panel anidado (kicker +
  badge n/max, radio si maxSelections===1, stepper si no). Reusa el
  `updateModifierQuantity(group, modifier, change)` de cada página
  pasándole el childGroup como `group` → el max lo aplica la función
  existente de la página.
- `getMenuForPOSAction`: include `childGroup { modifiers }` (isActive del
  hijo se filtra en UI — include to-one no acepta where).
- 5 POS actualizados (mesero, restaurante, delivery, pedidosya, wink):
  tipo `ModifierOption.childGroup`, purge en updateModifierQuantity (set
  final + radio replace), gate `childGroupsValid` en confirmAddToCart y en
  el disabled del botón, render de ChildGroupSelector bajo la opción
  seleccionada (solo passThrough; toggles SIN/CON no anidan).
- Admin (/dashboard/menu/modificadores): select "Al elegir despliega:" por
  modificador (icono ListTree, verde si tiene sub-grupo) →
  `setModifierChildGroupAction` (valida tenant, prohíbe self-group).

### Setup operativo del caso Pincho Mixto
1. Crear grupo "Sabores Pincho Mixto" (min/max según ración, ej. 1-4) con
   modificadores Vara Mixta / Pincho de Pollo / Carne / Kafta, cada uno con
   receta propia (§80) o vínculo para el descargo. NO vincularlo a ningún
   plato (solo se usa anidado).
2. En el grupo "Principales Arma tu Shanklish", al modificador "Pincho
   Mixto" → "Al elegir despliega: Sabores Pincho Mixto".

Gates: tsc 0 · vitest 491 passed. Requiere `migrate deploy` (safe).

## §83 BUG mesero: items fantasma comandados en otra mesa (2026-07-08)

Reporte de los mesoneros: "marcho un producto y en cocina sale comandado
otro". Intermitente, imposible de reproducir a demanda. CONFIRMADO — solo
POS mesero (restaurante limpia el cart en resetTableState()).

### Cadena del bug
1. `setSelectedTableId(mesa8)` NO limpiaba el carrito → items pendientes
   de la mesa 4 seguían en memoria al cambiar de mesa.
2. El autosave offline (`useEffect([cart, activeTab?.id])`) corría con la
   mesa NUEVA activa → `saveCart(tab8, itemsDeMesa4)` en IndexedDB.
3. Días después, cualquier mesero abría la mesa 8 con carrito vacío → la
   rehidratación restauraba los items EN SILENCIO → se marchaban junto a
   lo nuevo → cocina recibía productos que nadie pidió en esa mesa.
Intermitente porque requiere cambio de mesa con carrito pendiente, y es
por-tablet (IndexedDB local). Efecto directo además: cambiar de mesa con
items pendientes los enviaba a la mesa nueva.

### Fix (los 4 juntos en pos/mesero/page.tsx)
- Cambio de mesa → `setCart([])`: el carrito NO viaja; queda persistido
  bajo su mesa original y se restaura al volver.
- `cartOwnerTabIdRef`: el autosave solo escribe si el carrito en memoria
  pertenece a la mesa activa (null durante la hidratación — ref síncrono,
  bloquea el effect del mismo commit). Sin esto el autosave escribía/
  borraba el registro de la mesa equivocada durante el switch.
- Rehidratación con TTL 6h (descarta basura vieja, incluidos los
  registros ya contaminados pre-fix) y TOAST siempre visible
  ("N producto(s) pendientes restaurados — revisá el carrito"). Nada de
  items silenciosos.
- Mensaje offline corregido: NO existe reenvío automático — ahora dice
  "tocá 'Enviar a cocina' de nuevo cuando vuelva la señal" (el texto
  anterior entrenaba al mesero a creer que ya estaba marchado).

REGLA: cualquier POS con carrito persistido por contexto debe (a) limpiar
el cart al cambiar de contexto, (b) gatear el autosave por dueño, (c) TTL
+ aviso visible al restaurar.

## §84 Número de orden del día por canal (2026-07-09)

Pedido de Omar: en la impresión (comanda + nota de entrega) debe verse "cuál
orden del día es", como el PK-14 de pickup, pero para delivery, restaurante y
todos los canales — además del correlativo global.

### Modelo
`DailyOrderCounter` (tenantId, scope, dayKey) unique → `lastValue`. `dayKey`
= YYYY-MM-DD Caracas → reseteo diario implícito. Distinto de InvoiceCounter
(global, nunca resetea). `SalesOrder.dailyNumber/dailyLabel` y
`OpenTab.dailyNumber/dailyLabel` (nullable). Migración
`20260709100000_daily_order_counter` (safe: 2 cols nullable ×2 + tabla).

### Helper `src/lib/sales/daily-order-number.ts` (5 tests)
`nextDailyNumber(client, tenantId, scope, now)` → upsert atómico +
`{dailyNumber, dailyLabel}`. Prefijos 2 letras DISTINTOS del correlativo
(REST/DEL/WNK/PYA/PKP) para no confundir en el papel:
- RESTAURANT → `MS` (mesa/salón), DELIVERY → `DL`, WINK → `WK`, PEDIDOSYA → `PY`.
Ej: DL-14, MS-23.

### Asignación (§ pos.actions / wink / pedidosya)
- `openTabAction`: MS-N a la mesa al abrir; las comandas la heredan
  (`addItemsToOpenTabAction` copia dailyNumber/label del OpenTab).
- `createSalesOrderAction`: DL (delivery) o MS (restaurante directo), calculado
  UNA vez fuera del retry loop. **Pickup queda afuera**: mantiene su PK propio
  (marcador en notes, gap-filling) — se detecta por `notes` "Venta Directa
  Pickup" y NO se le asigna dailyNumber.
- wink → WK, pedidosya → PY.

### Impresión
`dailyLabel` agregado a payloads: `AgentReceiptPayload`/`AgentKitchenPayload`
(print-via-agent), `ReceiptData` (print-command), y render en
`print-agent/src/printer-adapter.ts` (grande centrado en recibo; "N° MS-14"
prominente en comanda) + HTML de print-command. Los POS pasan
`result.data.dailyLabel`; reimpresión de historial (sales/page.tsx) pasa
`sale.dailyLabel`. Pickup sigue mostrando su PK vía tableLabel (sin cambios).

Nota: el delivery del bot (DeliveryOrder/n8n) tiene su propio correlativo
PP-##### y no pasa por acá.

Gates: tsc 0 · vitest 495 passed. Requiere migrate deploy (safe).

## §86 Listas de precios por canal (2026-07-09)

Pedido de Omar: que los gerentes creen/eliminen listas de precios y las
activen/desactiven por canal (delivery, wink, restaurante, pedidosya). Antes
solo había columnas ad-hoc (winkPrice, pedidosYaPrice) y promociones.

### Modelo (migración 20260709120000, safe: 2 tablas)
- `PriceList` (tenant-aware, en TENANT_MODELS → 73): name, description,
  `channels` (JSON array de keys), `priority`, `isActive`, soft-delete.
- `PriceListItem` (hereda scope por FK, patrón RecipeIngredient): priceListId
  + menuItemId + price, `@@unique([priceListId, menuItemId])`. Item sin fila
  → usa `price` base del MenuItem.
- Flag `priceListsEnabled` (default off). PERM `MANAGE_PRICE_LISTS`
  (OWNER/ADMIN_MANAGER/OPS_MANAGER) + módulo `price_lists`.

### Resolución (src/lib/pricing/)
- `price-list.ts` (PURO, 12 tests): `parseChannels`, `pickListForChannel`
  (mayor priority, empate → updatedAt), `channelPriceMap` (solo la lista
  GANADORA aporta; precios ≤0 ignorados).
- `server.ts`: `loadChannelPriceMap(db, tenantId, channel)` gateado por flag.

### Integración POS
- `getMenuForPOSAction({ channel })`: ANTES de promociones, override del
  precio del item para el canal (RESTAURANT/DELIVERY → `price`; WINK →
  `winkPrice`; PEDIDOSYA → `pedidosYaPrice`), guardando `listPriceBase`. Los
  5 POS pasan su canal.
- `applyPromotionsToCart(..., channel?)`: la promo se calcula sobre el precio
  de LISTA (no el base) → display y cobro coinciden. createSalesOrder y
  addItemsToOpenTab pasan el canal. Sin promo activa, el server respeta el
  unitPrice del cliente (= precio de lista), igual que hoy con winkPrice.

### CRUD + UI
- `price-lists.actions.ts`: get/create/update/toggle/delete + getItems +
  `setPriceListItemsAction` (replace-all, valida tenant del list y de cada
  MenuItem, precio >0). Todo gated por MANAGER_ROLES.
- `/dashboard/menu/listas-precios`: crear lista + chips de canales +
  activar/desactivar + eliminar; modal "Editar precios" con buscador,
  filtro por categoría, precio por producto (placeholder = base). Enlace
  desde Gestión de menú. OWNER puede prender/apagar el flag desde el banner.

Precedencia: lista de precios del canal → (promo encima) → base. WINK y
PedidosYa confían en el precio mostrado (no re-derivan server-side, igual
que hoy). Gates: tsc 0 · vitest 508. Requiere migrate deploy (safe) + prender
el flag priceListsEnabled.

## §87 Descuento de divisas editable + piso $3 del fee de delivery (2026-07-09)

Pedidos de Omar: (1) el descuento por pagar en divisas (33,33% fijo) debe ser
editable por dueño/auditor/admin (depende de la situación cambiaria); (2) el
fee de delivery nunca puede bajar de $3 en divisas (se le paga al motorizado
sí o sí).

### Config editable (SystemConfig key `divisas_discount_percent`)
- `src/lib/sales/divisas-config.ts` (PURO, 3 grupos de tests): default
  33,33%, `normalizeDivisasPercent` clamp [0, 90], `divisasDiscountRate`
  (% → fracción), `MIN_DELIVERY_FEE_DIVISAS = 3`.
- Actions en system-config: `getDivisasDiscountPercentAction` (default si no
  hay config) + `setDivisasDiscountPercentAction` gated a
  OWNER/AUDITOR/ADMIN_MANAGER.
- UI en `/dashboard/config/pos`: input % editable (solo esos roles; los demás
  ven el valor readonly).

### Threading del rate (antes 33,33% hardcodeado como `/3`)
- Server (`pos.actions.ts`): `loadDivisasDiscountRate(db)` desde SystemConfig.
  `calculateCartTotals(..., divisasRate)` (delivery + pickup directo) y
  `paySubAccountAction` (subcuenta) usan el rate autoritativo del server. El
  descuento aplica a los ÍTEMS, nunca al fee.
- `computeDivisasSettlement(..., discountRate?)` (mesa): netFactor = 1 - rate.
  Default 1/3 (tests históricos intactos). +2 tests.
- Cliente (restaurante, mesero, delivery, SubAccountPanel): cargan el % con
  `getDivisasDiscountPercentAction` en mount; todos los `/3` y textos
  "33,33%" pasaron a `* divisasRate` y `{divisasPctLabel}%`.

### Piso $3 del fee de delivery (§87)
Ya era estructural: en divisas el fee es un swap fijo NORMAL($4.5)→DIVISAS($3)
y el descuento (editable) aplica solo a ítems, así que el fee nunca baja de $3
por más que cambie el %. Se blindó: `DELIVERY_FEE_DIVISAS = Math.max(
MIN_DELIVERY_FEE_DIVISAS, 3)` + comentario del invariante. (La promo "Delivery
Gratis" es aparte: decisión explícita de regalar el envío, no un descuento.)

Sin migración (solo lógica/UI + SystemConfig). Gates: tsc 0 · vitest 514.

## §88 BUG de descuadre en delivery: cortesía % descontaba el envío (2026-07-09)

Reportado por Omar: un delivery de 2 shawarmas "no daba" en el cierre.
Auditoría a fondo (cliente vs servidor) → 4 discrepancias, la principal
CONFIRMADA y con impacto en caja.

### Bug principal — CORTESÍA en % sobre delivery
El POS (cliente) descontaba la cortesía % SOLO a los ítems (envío completo);
el servidor la descontaba a ítems + envío. Con cortesía 50% sobre 2 shawarmas
($16 + $4.5 envío): cajera cobra/imprime $12.50, sistema registra $10.25 →
descuadre de $2.25 (= envío × %cortesía) y un "vuelto" fantasma. En el cierre,
la caja tenía más que el reporte.

Decisión del dueño (09/07): la cortesía % descuenta SOLO los productos; el
envío se le paga al motorizado siempre. Cortesía 100% (botón dedicado) = comp
total. Se corrigió el SERVIDOR para que coincida con el cliente y la política.

### Fix estructural — helper puro compartido
`src/lib/sales/delivery-totals.ts` (`computeDeliveryTotals`, 11 tests):
encoda las reglas (cortesía a ítems, envío con piso $3 en divisas, promo
Delivery Gratis waivea envío, cortesía 100% comp total). El servidor
(`calculateCartTotals` rama DELIVERY) ahora usa este helper → una sola fuente
de verdad, cliente y server no pueden divergir. Verificado con matriz de 960
casos (cliente réplica vs helper): 0 mismatches.

### Discrepancias secundarias corregidas
- Redondeo por método: el cliente redondeaba CASH_BS y omitía CASH_EUR (al
  revés del server). Alineado: divisas efectivo (USD/EUR/Zelle) redondean al
  dólar; Bs no.
- Recibo: en cortesía + Delivery Gratis el descuento doble-contaba el envío
  (no reconciliaba). Ahora descuento = solo ítems; el envío va en su línea
  (0 si gratis) → subtotal - descuento + envío = total siempre.
- Cortesía % = 100 por el campo de %: el cliente regalaba el envío; ahora lo
  cobra (para "todo gratis" está Cortesía 100%). Coincide con el server.
- `discount` guardado = subtotal - total POST-redondeo → recibo, venta y caja
  cuadran al centavo.

Sin migración. Gates: tsc 0 · vitest 524.

## §89 Categorías del menú configurables por el comercio (2026-07-09)

Pedido de Omar: al crear un producto las categorías estaban preestablecidas
(solo se sembraban 4 con ensureBasicCategoriesAction); no había forma de que
el comercio creara/renombrara/eliminara sus propias categorías.

### Actions (menu.actions.ts, gated OWNER/ADMIN_MANAGER/OPS_MANAGER)
- `createMenuCategoryAction({name, description?})`: valida nombre único
  (entre no borradas), sortOrder = max+1.
- `updateMenuCategoryAction(id, {name?, description?, sortOrder?})`: rename
  con chequeo de duplicado.
- `deleteMenuCategoryAction(id)`: soft-delete (deletedAt + isActive:false).
  BLOQUEA si la categoría tiene productos vivos (`menuItem.count` categoryId
  + deletedAt null > 0) → hay que mover/eliminar los productos primero (evita
  items huérfanos en el POS).
- `getCategoriesAction` y `getFullMenuAction` ahora filtran `deletedAt: null`.

### UI (/dashboard/menu)
- Botón "Categorías" en el header → modal de gestión: lista con contador de
  productos, renombrar inline (lápiz), eliminar (bloqueado con tooltip si
  tiene productos), y crear nueva abajo.
- Link "+ Nueva" junto al selector de categoría en AMBOS formularios de
  producto (plato preparado y reventa) → abre el mismo modal, para crear la
  categoría sin salir del flujo.

Sin migración (MenuCategory ya tenía name/description/sortOrder/isActive/
deletedAt). Gates: tsc 0 · vitest 524.

## §90 Comanda: ocultar el modificador padre + tablas de pinchos exactas (2026-07-09)

Cierre del pedido de pinchos de Omar (confirmado 09/07).

### Parte 1 — Comanda limpia (código)
El renglón del modificador PADRE de un sub-grupo anidado (ej. "Pincho Mixto")
es redundante en la comanda: el cocinero solo necesita las varas/hijos. Ahora
NO se imprime.
- `CartItem.modifiers[].hideFromKitchen?: boolean` — marca el padre. Sigue
  contando para precio e inventario; solo se oculta del papel.
- `collectParentModifierIds(modifierGroups)` (pos-child-group, +2 tests): ids
  de modificadores con sub-grupo utilizable.
- Los 5 POS marcan `hideFromKitchen: parentIds.has(m.id)` al explotar los
  modificadores al carrito.
- `buildKitchenItems` filtra `!hideFromKitchen` → la comanda muestra solo las
  varas. (El recibo del cliente NO cambia; voids/reimpresiones desde histórico
  siguen mostrando el padre porque no guardan el flag — aceptable.)

### Parte 2 — Tablas x1/x2/x4 con cantidad EXACTA (script)
`scripts/setup-tabla-pinchos.ts` (dry-run default, --apply): crea un grupo
"Pinchos (Tabla xN)" POR tabla con min=max=1/2/4 y 4 varas (Pollo/Carne/Kafta/
Mixto, stepper para repetir). No toca "Platos Principales (Tabla)". Idempotente
(IDs deterministas), reversible desde el admin. Los modificadores se crean SIN
descargo — el descargo por vara se configura después (receta propia §80) para
no descargar cantidades equivocadas.

Motivo del grupo-por-tabla: las 3 tablas comparten el grupo de principales, así
que un solo "Pincho Mixto" no puede desplegar 1 vara en la x1 y 4 en la x4. Un
grupo dedicado por tabla da la cantidad exacta.

**Rediseño ANIDADO (10/07, pedido de Omar con capturas):** el flujo final NO
es un grupo aparte siempre obligatorio, sino el despliegue §82: al seleccionar
la ración "Pincho Mixto" DENTRO de los principales de la tabla se despliega la
selección de varas con cantidad exacta (x1→1, x2→2, x4→4; min=max). La vara
mixta es una de las 4 opciones (ración mixta ≠ vara mixta). Como el childGroup
vive en el modificador y las tablas COMPARTEN el grupo de principales, el
script CLONA el grupo por tabla (`<origId>--<sku>`, modificadores + receta
propia §80 + linkedMenuItemId copiados), asigna al "Pincho Mixto" del clon su
sub-grupo dedicado, vincula la tabla al clon y la desvincula del compartido.
Side-benefit: cada tabla puede ajustar sus principales por separado en admin.
Limpieza incluida: (a) desvincula de las tablas el grupo "PINCHOS" mín. 3 de
la ración si quedó vinculado directo (el grupo queda intacto para la ración);
(b) quita el vínculo DIRECTO del sub-grupo dedicado si una corrida v1 lo dejó
(ahora es anidado); (c) "Pincho Mixto" duplicado en un mismo grupo →
soft-delete del duplicado (el POS filtra deletedAt; histórico intacto). Todo
visible en dry-run. Idempotente: re-correr actualiza los clones.

Gates: tsc 0 · vitest 526.

---

## §91 Cortesía GLOBAL en delivery: el % también descuenta el envío (2026-07-09)

Pedido de Omar: "añade una opción en los POS para que el descuento sea global e
incluya también al delivery (en caso de que se le dé descuento por cortesía)".

Contexto: §88 fijó que la cortesía en % descuenta SOLO los productos y el envío
se cobra completo (se le paga al motorizado). Eso sigue siendo el **default**.
§91 añade un **toggle opcional** para el caso en que el comercio quiere regalar
la cortesía sobre TODO el pedido, envío incluido.

### Regla
- Nuevo flag `discountIncludesDelivery` (default `false`). Solo tiene efecto con
  `discountType = CORTESIA_PERCENT` y orderType `DELIVERY`.
- Cuando está ON: `deliveryFee = feeBase * (1 - pct)` (el envío recibe el mismo
  % que los ítems). El total baja en consecuencia.
- NO afecta a `DIVISAS_33` (el envío mantiene su piso $3 al motorizado, §87) ni a
  `NONE`. Con `CORTESIA_100` el envío ya va gratis, así que el toggle no aplica
  (solo se muestra en modo %).
- `Delivery Gratis (Promo)` sigue ganando: si está activo, el envío es 0 sin
  importar el flag.

### Implementación
- `computeDeliveryTotals` (delivery-totals.ts, puro): input `discountIncludesDelivery?`
  → descuenta el envío en CORTESIA_PERCENT. +7 tests (§91). `discount = subtotal
  - total` sigue reconciliando.
- `CreateOrderData.discountIncludesDelivery?` + `calculateCartTotals` lo pasa al
  helper. `discountReason` anota "(N% global — incl. envío)" para auditoría.
- `pos/delivery/page.tsx`: estado `discountIncludesDelivery`, toggle visible solo
  con cortesía en % (bajo la línea de Auth), math inline alineado al helper, se
  envía al server, se resetea al cambiar de descuento y al cobrar. La línea de
  Delivery en el panel muestra el envío tachado → precio con descuento.
- wink/pedidosya no tienen UI de cortesía → no cambian (el server ya soporta el
  flag si algún día lo mandan).

Gates: tsc 0 · vitest 533.

---

## §84.1 El número de orden del día NO salía en la comanda (2026-07-09)

Reporte de Omar en pre-operación: salió un delivery, la cajera lo cargó, pero la
comanda impresa NO mostró el número de orden del día (§84).

### Diagnóstico (código OK, artefacto viejo)
Rastreado end-to-end, TODO el pipeline del repo maneja `dailyLabel`:
- `createSalesOrderAction` genera y guarda `dailyNumber/dailyLabel` (scope por
  canal) y lo devuelve en `result.data`.
- Los 5 POS lo pasan a `enqueueKitchenCommand` / recibo.
- `POST enqueuePrintJobAction` lo guarda tal cual en `PrintJob.payload` (JSON) y
  `GET /api/print-agent/jobs` lo devuelve completo.
- `print-agent/printer-adapter.ts` lo renderiza (`renderKitchen`/`renderReceipt`).

**Causa raíz: el print-agent es un build SEPARADO.** `scripts/deploy-vps.sh`
solo redespliega la app Next (pm2). El print-agent corre como servicio aparte
(`node dist/index.js`, `tsc` propio) en la PC on-prem conectada a las térmicas.
El render de `dailyLabel` se agregó hoy → la PC seguía con un build viejo SIN esa
línea. ⇒ **Cada cambio en `print-agent/` requiere rebuild + restart del servicio
en la PC del local; el deploy de la VPS NO lo cubre.**

### Cambio de código (§84.1)
Label legible por canal en la impresión, matcheando cómo lo pide el negocio
("DELIVERY N° 1", "MESA N° 7") en vez del código cripto "DL-1". El correlativo
global (#DEL-0042) queda intacto.
- `humanDailyLabel(label, channelHint?)` en `daily-order-number.ts` (exportado,
  +3 tests): `DL-01` → `DELIVERY N° 1`. Mapa de prefijo→palabra, defensivo.
- `print-agent/printer-adapter.ts`: `renderKitchen`/`renderReceipt` usan el
  formateo (copia local — proyecto separado, no puede importar de `src/`). En
  cocina, si hay `dailyLabel` se imprime la línea legible; si no, cae al tag
  `[ DELIVERY ]` (no se pierde el tipo operativo).
- `print-command.ts` (fallback window.print): usa el helper compartido.

### Checklist de despliegue (para que SÍ salga)
1. App VPS: `bash scripts/deploy-vps.sh main` (genera/guarda `dailyLabel`).
2. `npx prisma migrate status` → "up to date" (tabla `DailyOrderCounter` +
   columnas `dailyNumber/dailyLabel` deben existir).
3. **Print-agent on-prem**: en la PC del local, `git pull` → `cd print-agent`
   → `npm install` (si cambió deps) → `npm run build` → reiniciar el servicio
   (node-windows / pm2). Sin esto la comanda NUNCA mostrará el número.

Gates: tsc 0 · vitest 536.

---

## §92 Postres con ruteo DUAL: comanda por barra + cocina (2026-07-09)

Pedido de Omar: "las comandas de los postres (cheesecake helado, Brooklyn) deben
salir también por la comandera de la barra y no solo por la de cocina". La barra
es NOUR ("Barra / Área de café y postres") → los postres se preparan ahí, pero
cocina también los debe ver.

### Cambio
Nuevo módulo PURO `src/lib/print/station-routing.ts` (extraído de
`print-via-agent.ts`, que es 'use client' e intesteable):
- `classifyStation(cat)` → barra (bebidas/licores/café…) o cocina (default).
  Igual que antes (mismas BAR_CATEGORIES/BAR_KEYWORDS).
- `isDualStationDessert(item)` → true si la categoría O el nombre del producto
  matchea `DESSERT_DUAL_KEYWORDS` = postre, dessert, reposter, helado,
  cheesecake, brooklyn. Insensible a acentos/mayúsculas.
- `stationsForItem(item)` → postre = `['bar','kitchen']` (sale por AMBAS
  comanderas); bebida = `['bar']`; resto = `['kitchen']`. Nunca vacío.

`enqueueKitchenCommand` (split) ahora itera `stationsForItem(item)`: un mismo
ítem puede caer en 2 grupos → se encola 1 job por estación con ese ítem, así el
postre sale por barra Y cocina. Aplica también a anulaciones (VOID_KITCHEN).

Para sumar un postre nuevo al ruteo dual: agregar su palabra a
`DESSERT_DUAL_KEYWORDS`. +10 tests (`station-routing.test.ts`).

### Despliegue
Solo requiere deploy de la APP (`deploy-vps.sh`). El print-agent on-prem NO
necesita rebuild: el ruteo/split ocurre en la app (setea `station` por job); el
agente solo imprime los ítems de cada job en su impresora. (Contrastar con
§84.1, que sí tocó el render del agente.)

Gates: tsc 0 · vitest 546.

---

## §93 Comanda: el padre también se oculta en superficies server-side (2026-07-10)

Reporte de Omar (foto de comanda de ayer, queja del cocinero "me está arrojando
5 principales"): al seleccionar la ración "Pincho Mixto", la comanda mostraba el
renglón padre como "título" Y las varas seleccionadas. Quiere SOLO la selección
definitiva.

§90 ya filtraba el padre con `hideFromKitchen`, pero SOLO en el camino del POS
(flag en el carrito → `buildKitchenItems`). Las superficies que imprimen/
muestran comanda desde datos GUARDADOS no tenían el flag:
- `/api/kitchen/orders` → displays `/kitchen` y `/kitchen/barra` + su
  AUTO-IMPRESIÓN (`printKitchenCommand`) — por acá salió la comanda de la foto.
- `getComandasDelDiaAction` → reimpresión de comandas del día.

### Fix — helper puro `src/lib/print/kitchen-modifiers.ts` (+5 tests)
`SalesOrderItemModifier.modifierId` referencia al MenuModifier vivo → se puede
detectar el padre server-side. Regla (más precisa que la del POS, por-orden):
ocultar la fila si su MenuModifier tiene `childGroupId` Y en el MISMO item hay
un hermano cuyo `MenuModifier.groupId === childGroupId` (hijos realmente
elegidos). Sin hijos → el padre se muestra (no perder info). Se filtra por
RELACIÓN, no por nombre → la VARA mixta ("Pincho Mixto" del sub-grupo) nunca se
oculta aunque se llame igual que la ración.
- `/api/kitchen/orders`: include `modifier { groupId, childGroupId }` +
  `filterKitchenModifiers` → display y auto-print limpios.
- `getComandasDelDiaAction`: cada modifier sale con `hideFromKitchen`; el modal
  filtra SOLO al reimprimir comanda — el recibo mantiene el padre (lleva el
  precio).
- El módulo delivery-bot (`comanda` JSON propio, sin anidación) no aplica.

Regla general: TODO surface nuevo que imprima comanda desde BD debe pasar los
modifiers por `filterKitchenModifiers` (o exponer `hideFromKitchen`).

Gates: tsc 0 · vitest 551.

---

## §94 "SIN" estilo Xetux: exclusión de ingredientes con inventario real (2026-07-10)

Pedido de Omar: a cada materia prima poder activarle la opción "SIN"; al marcar
"SIN Salsa de Ajo" en un Shawarma de Pollo en el POS, esa materia prima NO se
descuenta de inventario. "Quiero que sea de igual forma que Xetux."

El sistema SIN/CON previo (pos-modifier-grouping, convención de nombres "Sin X")
era SOLO cosmético: imprimía pero el descargo seguía completo. Sigue existiendo
para modifiers manuales; §94 agrega el camino con inventario real.

### Schema (migración `20260710110801_sin_ingredientes_xetux`, ambas safe)
- `InventoryItem.allowSin Boolean @default(false)` — activable por materia prima
  en /dashboard/inventario (editar ítem → checkbox "Permitir SIN en el POS").
- `SalesOrderItemModifier.excludedIngredientItemId String?` — la fila es una
  EXCLUSIÓN: name="SIN X", modifierId=null, priceAdjustment=0.

### Flujo
1. Admin activa `allowSin` en la materia prima (ej. "Salsa de Ajo").
2. `getMenuForPOSAction` expone por item `sinIngredients: [{id,name}]` =
   ingredientes de su receta cuya materia prima tiene allowSin (batch-fetch por
   recipeIds — MenuItem.recipeId es referencia suelta, sin relación Prisma).
3. POS (los 5): sección "Quitar ingredientes (SIN)" en el modal
   (`SinIngredientsSection` + `buildSinCartModifiers` en
   components/pos/SinIngredientsSection.tsx). El carrito lleva pseudo-modifiers
   `{modifierId:null, name:"SIN X", priceAdjustment:0, excludedIngredientItemId}`.
4. Comanda y recibo imprimen "SIN X" (viaja como modifier normal; en server
   surfaces la fila tiene modifier=null → filterKitchenModifiers la conserva).
5. Descargo tiempo real (`registerInventoryForCartItems`): skip del ingrediente
   excluido en la receta PRINCIPAL. Las recetas de otros modificadores no se
   afectan.
6. Consumo teórico (`computeConsumptionFromOrders`): exclusión POR LÍNEA sobre
   la receta principal (+4 tests). Las 2 queries del sync diario seleccionan
   `excludedIngredientItemId`.
7. Void/ajuste de ítems de mesa (`applyItemInventoryInTx` + voidItemInTx):
   exclusiones threaded — lo no descargado tampoco se restaura/re-descarga.

### Reglas
- CartItem.modifiers.modifierId ahora es `string | null` opcional (pseudo-SIN).
  Los 5 create-sites persisten `modifierId ?? null` + excludedIngredientItemId.
- La exclusión aplica SOLO a la receta principal del item (los modificadores
  CON/extra siguen descargando lo suyo).
- No afecta precio. El recibo muestra "SIN X" a $0 (igual que Xetux).
- Padre sin hijos, defensivo: exclusión con id inexistente en la receta = no-op.

Gates: tsc 0 · vitest 555.

---

## §95 El padre del sub-grupo tampoco sale en el RECIBO (2026-07-10)

Reporte de Omar con pre-cuenta TAB-3545: "Tabla x4 + …, Pincho Mixto, Pincho de
Pollo, …" — el renglón padre se imprimía en recibos/pre-cuentas junto a las
varas y "se presta para confusiones". §90/§93 solo cubrían la COMANDA; ahora el
padre no sale NI en comanda NI en recibo. Precio e inventario no cambian (el
padre sigue sumando su priceAdjustment al lineTotal; solo se oculta el nombre).

### Persistencia (clave del fix)
`SalesOrderItemModifier.hideFromKitchen Boolean @default(false)` (migración
`20260710124028`, safe). Los items de mesa se cargan con `modifiers: true`
SIN la relación al MenuModifier vivo → no se podía detectar el padre en el
cliente. Persistir el flag del carrito en la venta lo resuelve para SIEMPRE y
para cualquier superficie futura. Los 5 create-sites lo guardan (pos ×3 incl.
copia de reemplazo, wink, pya).

### Superficies de recibo filtradas (`!hideFromKitchen`)
- delivery: recibo post-venta (cart).
- restaurante: pickup receipt + reimpresión lastPickupOrder (cart), cierre de
  mesa y pre-cuenta (rows guardadas).
- mesero: pre-cuenta + payload de anulación (rows guardadas).
- SubAccountPanel: recibo de subcuenta.
- sales/page: reimpresión desde historial.
- ComandasDelDiaModal: reimpresión de recibo (la comanda ya filtraba §93).
- pos.actions: comanda de anulación de ítem.

`getComandasDelDiaAction` devuelve `hideFromKitchen = flag persistido OR
isParentWithChildren(...)` (relación §93) → cubre también órdenes creadas
ANTES de esta migración. Órdenes viejas en las demás superficies muestran el
padre hasta que naturalmente salgan del día (transicional, aceptable).

Regla: toda superficie nueva que imprima modifiers (comanda O recibo) debe
filtrar `hideFromKitchen` (persistido) o usar filterKitchenModifiers (§93).

Gates: tsc 0 · vitest 555.

---

## §96 PY = precio restaurante · Pickup separado de Mesas · colores del historial (2026-07-10)

Tres pedidos de Omar:

### 1. PedidosYA usa el precio del restaurante
`calcPedidosYaPrice` ya NO aplica el −33.33% histórico: devuelve el precio base.
El override manual `MenuItem.pedidosYaPrice` sigue teniendo prioridad;
`scripts/reset-pedidosya-prices.ts --tenant-slug=shanklish [--apply]` (dry-run
default) anula los overrides existentes para que rija el precio de restaurante
en todo el menú. Las listas de precios §86 (canal PEDIDOSYA) siguen pudiendo
sobreescribir si se activan.

### 2. POS Restaurante: Pickup separado de Mesas (sidebar)
Antes ambos vivían bajo un único header "Secciones". Ahora:
- Panel PICKUP propio (recuadro ivory-alt; navy-soft cuando está activo) con
  kicker "Pickup / Para llevar" + badge de abiertos + botón "Nuevo Pickup" +
  lista de pickups abiertos DENTRO del panel.
- Sección MESAS con su propio kicker (icono Armchair) + zonas + grid.

### 3. Historial de ventas: colores ilegibles (dark-mode bugs)
El recuadro expandido del desglose usaba `bg-gray-900/60` (fijo oscuro) con
tokens adaptativos encima → en modo claro no se leía. Además `text-capsula-cream`
sobre `bg-capsula-navy-soft` (badge default de pago + botones ítems/imprimir)
= texto claro sobre fondo claro. Fixes conforme CLAUDE.md:
- Fila expandida → `bg-capsula-ivory-alt/60`; celdas cream → `text-capsula-ink`;
  `divide-gray-800` → `divide-capsula-line`.
- Modales Cierre del Día y Anulación: `bg-gray-900` → `bg-capsula-ivory`;
  backdrops `bg-black/80` → `bg-capsula-ink/60` (el panel del Reporte Z queda
  `bg-white` a propósito: preview imprimible).
- cream sobre navy-soft → `text-capsula-ink` (hover navy → cream).
- Emojis 🖨️ → icono `Printer` (regla no-emoji, mismo commit).

Gates: tsc 0 · vitest 555.

### §96.1 Precio PedidosYA editable desde el submódulo Menú (2026-07-10)
Espejo exacto del patrón WINK: input "PYA $" por producto en /dashboard/menu
(update optimista + revert), gated por el MISMO permiso gerencial
`EDIT_WINK_PRICE` (renombrado en labels a "Editar precios de canal" — la key no
cambia para no romper roles guardados). `updateMenuItemPedidosYaPriceAction`
en pedidosya.actions.ts; vacío/null = borra el override → rige el precio del
restaurante (fallback §96). Sin permiso se ve solo-lectura como antes.

---

## §97 Envío del delivery: EXPLÍCITO por moneda y agregado MANUAL (2026-07-10)

Reporte de Omar: en pago mixto Zelle+Cash (100% divisas) el envío quedaba en
$4.50 — el sistema asumía que mixto = dólares+bolívares. Causa raíz: el fee se
INFERÍA de `discountType === 'DIVISAS_33' && isPagoDivisas`, y en modo mixto el
descuento divisas ni siquiera se auto-activa. Decisión de Omar (confirmada):
mismo cobro, pero el envío se mantiene aparte y SE SUMA MANUAL — nunca
automático — para evitar desfases.

### Regla nueva
- `DeliveryFeeMode = 'AUTO' | 'DIVISAS' | 'BS' | 'NONE'` en
  `computeDeliveryTotals` (delivery-totals.ts):
  · DIVISAS → $3 exactos (piso motorizado §87)
  · BS → $4.50 (se cobra en Bs a tasa)
  · NONE → 0 (sin envío agregado)
  · AUTO → inferencia histórica (solo compat; el POS ya no lo usa)
- Con modo explícito el subtotal de lista usa el fee del modo (no genera
  "descuento fantasma" de $1.50 como el AUTO histórico).
- freeDelivery y CORTESIA_100 siguen ganando (fee 0 / comp total); la cortesía
  global §91 descuenta el fee del modo elegido.
- El descuento divisas de los ÍTEMS no cambia (porción divisas en mixto).

### POS delivery
- Selector "ENVÍO (agregar a la cuenta)": [Sin envío] [Divisas $3] [Bs $4.50]
  — default SIN ENVÍO (manual). Con BS muestra el equivalente en Bs a tasa.
- Línea Delivery del panel: "Sin envío — agregar abajo" / monto + moneda.
- Guarda anti-olvido: al cobrar con NONE (sin promo gratis ni cortesía 100%)
  pide confirmación "¿Cobrar SIN envío?".
- `CreateOrderData.deliveryFeeMode` (saneado server-side; nunca se confía en
  el cliente). Nota de entrega: "Envío / Delivery (Divisas|Bs): $X"
  (`deliveryFeeLabel` en print-command).
- Se quitó el delta de envío de la línea "Dto. Divisas" (ya no existe).

+9 tests §97 (564 total), AUTO cubierto como legacy idéntico.

Gates: tsc 0 · vitest 564.

### §97.1 Refinamiento del selector de envío (mismo día, pedido de Omar)
Sin opción "Sin envío": la pregunta es "¿Cómo cobras el envío?" con DOS
opciones — [Dólares · $3.00] [Bolívares · $4.50] — y DEFAULT Bolívares.
Panel propio prominente (icono Bike + pregunta en semibold), equivalente en
Bs a tasa cuando está en Bolívares. Se quitó la guarda anti-olvido (ya no
aplica). El modo 'NONE' sigue soportado en helper/server (compat y casos
futuros), pero el POS no lo ofrece. Reset post-venta → 'BS'.

---

## §98 Módulos por usuario no ampliaban + historial "vacío" enmascaraba permisos (2026-07-10)

Reporte de Omar en operación: con el usuario de David el historial de ventas
mostraba "ninguna venta nunca" y los submódulos que intentó habilitarle "no
aparecían". Desde el usuario master todo funcionaba.

### Diagnóstico (cadena completa)
1. El editor /dashboard/config/modulos-usuario SOLO ofrecía toggles de módulos
   que el ROL del usuario ya tenía (`roleDefaultModules.includes(m.id)`) →
   imposible AMPLIAR, aunque el gate (getVisibleModules: "la lista es la única
   autoridad") y la capa 2 de permisos sí lo soportan. Por eso "no le
   aparecían" los submódulos a habilitar.
2. Bug adicional del toggle: con estado null (sin lista), togglear un módulo
   EXTRA lo descartaba (`roleDefaultModules.filter(id => id !== modId)` sobre
   una lista que no lo contiene).
3. Al guardar CUALQUIER lista, la capa 2 (has-permission) DENIEGA todo permiso
   cuyo módulo (PERM_TO_MODULES) no esté en ella. Si `sales_history` no quedó
   en la lista de David → `VIEW_SALES_HISTORY` denegado → la action devolvía
   "No autorizado"…
4. …y sales/page.tsx TRAGABA el `success:false` sin mostrar el message → la
   página rendía la lista vacía = "no hubo ventas hoy ni ayer ni nunca".
   El error de permisos se disfrazaba de "sin ventas".

### Fixes
- Editor: ofrece TODOS los módulos habilitados del tenant (OWNER-only
  excluidos para no-OWNER — el gate los bloquearía igual); toggle con base =
  módulos del rol cuando la lista es null; badge "Extra al rol" en los que
  amplían; isChecked con null marca los del rol.
- sales/page: `success:false` → toast con el message real (y lista vacía).
  Nunca más un problema de permisos disfrazado de "sin ventas".

### Remediación operativa inmediata (sin deploy)
Desde el usuario master: Módulos por usuario → David → "Restablecer a rol"
(guarda null) → David cierra sesión y entra de nuevo (el save incrementa
tokenVersion e invalida su JWT). Con eso recupera los defaults del rol,
incluido el historial. Para AMPLIAR más allá del rol hace falta este deploy.

Gates: tsc 0 · vitest 564.

---

## §99 Tablets con montos distintos por céntimos en descuento divisas (2026-07-10)

Reporte de Omar: algunas tablets muestran (y cobran) un monto distinto por
céntimos vs el POS restaurante cuando hay descuento en divisas.

### Causa raíz (doble)
1. Cada POS cargaba el % de divisas (§87) por su cuenta al montar, con
   default 100/3 y `.catch(() => {})` SILENCIOSO. Si a una tablet le fallaba
   esa carga (wifi del salón) quedaba en 33,33% mientras las demás usaban el
   % configurado → mismos ítems, céntimos distintos por dispositivo. Un build
   viejo cacheado en la PWA produce lo mismo.
2. `registerOpenTabPaymentAction` CONFÍA en el `discountAmount` que envía el
   cliente (no lo recalcula) → la divergencia no era solo visual: SE COBRABA.

### Fixes
- `useDivisasPercent()` (src/lib/hooks/use-divisas-percent.ts): carga con 3
  reintentos + backoff; si falla definitivamente muestra toast de advertencia
  (nunca más divergencia silenciosa). Reemplaza los 4 loads duplicados
  (restaurante, mesero, delivery, SubAccountPanel).
- Vigía server-side en registerOpenTabPaymentAction: si el descuento divisas
  recibido difiere >$0.02 del esperado con el % configurado (gross = neto +
  descuento), loguea `[§99 divisas-divergencia]` con tabCode/monto/método —
  detecta LA tablet problema en pm2 logs sin bloquear el cobro (el monto ya
  se acordó en mesa). Hacer el server autoritativo del descuento de mesas es
  refactor mayor pendiente — no se toca en caliente.

### Operativo
- Detectar la tablet: pm2 logs | grep divisas-divergencia (post-deploy), o
  comparar el % que muestra el botón de divisas en cada dispositivo.
- Tablets PWA: cerrar y reabrir la app / recargar duro tras cada deploy para
  no quedar con bundle viejo.

Gates: tsc 0 · vitest 564.

---

## §100 Auditoría del cargo de servicio + cierre de huecos (2026-07-10)

Reporte de Omar: TAB-3567 y TAB-3583 sin cargo de servicio — ¿falla del
sistema o intervención humana?

### Hallazgos del código (pre-fix)
El sistema NUNCA pone el servicio en $0 solo. Había DOS rutas humanas, ambas
SIN rastro de autor:
1. "Quitar servicio" con PIN de capitán/gerente: el PIN se validaba pero el
   nombre del autorizador SE DESCARTABA (ni notas ni log).
2. Editar el % de servicio a 0 al cobrar: `normalizeServiceRate` clampa 0–100
   y el input UI permite min=0 → 0% pasaba SIN PIN. En subcuentas
   (`paySubAccountAction`) ni siquiera existe ruta de exención: el % del
   cliente se aplicaba directo.

### Fixes
- `registerOpenTabPaymentAction`: (a) 0% sin marcar exención → RECHAZADO con
  mensaje que dirige a la ruta con PIN; (b) la exención ahora persiste
  "Exención servicio autorizada por: <nombre>" en las notas del split; (c) %
  editado ≠ 10 deja marcador "Servicio X% (editado al cobro)" en las notas.
- `paySubAccountAction`: 0% bloqueado (la exención se autoriza desde la
  cuenta principal).

### Herramienta
`scripts/audit-servicio-tabs.ts --tenant-slug=X --tabs=TAB-A,TAB-B` (solo
lectura): por mesa imprime cuenta, órdenes con autor, subcuentas y cada split
con su % de servicio implícito, marcando ⚠ los cobros TABLE_SERVICE con
servicio <9.5%. Veredicto incluido: cobros pre-§100 con $0 no son atribuibles
a una persona desde los datos (cruzar hora del split con turno de caja).

Gates: tsc 0 · vitest 564.

### §100.1 El caso TAB-3567/3583 resuelto: pre-cuenta sin servicio por estado pegajoso
Auditoría con el script §100: AMBAS mesas cobraron el 10% correcto (splits
$4.50/$3.90, 10.00% exacto, PDV Superferro 21:56Z). Lo que falló fue la
PRE-CUENTA de las 17:48 local (foto de Omar): salió SIN la línea de servicio
(total $39/$45 planos).

Causa: en el POS restaurante, `serviceFeeIncluded` / `serviceFeePercentStr` /
`skipServiceFeePin` NO se reseteaban en `resetTableState()` → si se eximía o
editaba el % en UNA mesa, el estado quedaba pegado para TODAS las mesas
siguientes de esa sesión: pre-cuentas sin servicio, aunque al cobro alguien lo
re-activara (como pasó aquí). Además el historial muestra el servicio desde
`OpenTab.totalServiceCharge`, que es 0 mientras la mesa está ABIERTA — mirar
el historial antes del cobro también "confirma" el falso negativo.

Fixes:
- `resetTableState()` restaura servicio ON al 10% y limpia el PIN — la
  exención es POR MESA, nunca de sesión.
- La pre-cuenta nunca omite el servicio en silencio: si está eximido imprime
  "Servicio: EXIMIDO" (`serviceFeeExempt` en print-command).

Gates: tsc 0 · vitest 564.

### §100.2 Propina "bloqueada" en TAB-3587 + confirmación de propina manual
Caso: factura $22 exacta, cliente pagó $25, vuelto $3 — pero el sistema
registró $1 de propina (retenido $23) → caja física $1 corta vs sistema.
Mecánica: el campo Propina tenía $1.00 al confirmar el cobro; el sistema lo
respetó (cap correcto: mín(1, excedente 3)) y esperaba vuelto de $2. No es
bug de cálculo — es propina tipeada/olvidada en el campo.

Fixes:
- Confirmación explícita al cobrar mesa cuando hay PROPINA MANUAL tipeada
  (por encima del redondeo automático de divisas — la política del 16/06 vía
  roundingTipForCharge sigue sin fricción): muestra propina y el vuelto
  correcto vs el completo, con opción de cancelar y borrar.
- audit-servicio-tabs.ts imprime `retenido` y `PROPINA REGISTRADA` por split.

Regla operativa: si el cliente pide su vuelto completo, la propina debe ir
en 0 antes de confirmar.

---

## §101 Cobro fantasma de $1: residuo flotante del descuento divisas (2026-07-10)

Caso TAB-3587 CONFIRMADO CON DATOS (audit-servicio-tabs): dos splits —
22:55 retenido $22.00 limpio; 23:11 split de $1.00 con base $0.00 registrado
como propina. Entre ambos, el POS mostraba "Saldo $0.00 / A cobrar $1.00".

Cadena exacta: computeDivisasSettlement con 1/3 deja un residuo de punto
flotante (~$0.0003) en balanceDue → la mesa queda PARTIALLY_PAID en vez de
CLOSED → paymentBaseAmount = residuo×(2/3)×1.1 ≈ $0.0002 →
roundDivisasChargeUp = Math.ceil(...) = $1.00 → la cajera cobra el $1
"pedido" por la pantalla → appliedAmount=0, todo excedente → propina.

Fixes (3 capas):
- Server registerOpenTabPayment: (a) rechaza el cobro si el saldo efectivo
  < $0.01 ("La cuenta ya está saldada"); (b) newBalance < $0.01 se cierra a 0
  (la mesa CIERRA — antes quedaba abierta por fracciones de centavo).
- Cliente restaurante: balanceDue < $0.01 se trata como 0 en
  paymentBaseAmount → el ceil ya no puede inflar residuos a $1.

El $1 de propina del caso real no existe físicamente (vuelto completo
entregado) — ajustar el pool de propinas del día manualmente.

---

## §102 Auditoría de cobranza (4 auditores paralelos) + guardias batch 1 (2026-07-10)

Auditoría pre-deploy pedida por Omar sobre TODOS los flujos de cobro. Cuatro
revisiones paralelas: mesas, subcuentas/pool, ventas directas, capa
transversal (redondeos/tasa/reportes). Hallazgos completos en el hilo; los
CRÍTICOS y su estado:

### Corregido en este bloque (batch 1 — guardias server, sin tocar matemática)
- (a) createSalesOrder: DIVISAS_33 se descarta si el pago no incluye divisas
  (espejo del safeguard de mesas; cierra la carrera useEffect donde un pago
  Bs llegaba con -33% → venta sub-reportada + vuelto falso).
- (b) createSalesOrder: CORTESIA_100/PERCENT sin authorizedById → rechazado
  (antes cualquier request generaba venta $0 sin autor).
- (c) createSalesOrder: pago declarado < total − $0.05 → rechazado (antes
  paymentStatus=PAID hardcoded aunque las líneas mixtas no sumaran).
- (d) Vigía §99: silenciado en pagos mixtos de mesa (data.amount ahí es bruto
  → 100% falsos positivos que enmascaraban divergencias reales).
- §101 (ya commiteado): saldo residual < 1¢ cierra la mesa + rechazo de cobro
  sobre cuenta saldada.

### PENDIENTE batch 2 (requiere trabajo cuidadoso + tests — NO hacer en caliente)
1. [ALTA] Pagos PARCIALES de mesa (no-divisas): el cliente manda el bruto con
   servicio y el server lo aplica al balance de solo-ítems y re-suma 10% —
   la casa pierde ~el servicio de cada porción parcial (mesa $110 en dos
   mitades cobra $104.50). Fix: cliente debe mandar el NETO de ítems del
   parcial (como ya hace el camino divisas con netItemsApplied).
2. [ALTA] registerOpenTabPayment aplica discountAmount/paidAmountOverride del
   cliente sin recalcular (§99 solo loguea). Hacer server autoritativo.
3. [ALTA] paySubAccountAction sin assertOpenTabVersionUpdate → lost update
   con cobros concurrentes de subcuentas.
4. [ALTA] voidSalesOrderAction/voidSubAccount no revierten runningSubtotal/
   runningTotal/splits → Z-report/end-of-day descuadran vs cobrado tras
   anulaciones de mesa.
5. [ALTA] Anular/editar ítem ya pagado vía subcuenta: voidItemInTx borra
   subAccountItems y resta lineTotal del balance sin chequear sub PAID →
   la casa pierde el monto; sub OPEN queda con subtotal obsoleto (falta
   recalcSubAccountTotals).
6. [MEDIA] Universos inconsistentes de reportes: historial incluye CANCELLED,
   Z/arqueo no; end-of-day deriva discount distinto (runningSubtotal−Total
   vs runningDiscount); totalCollected derivado ≠ Σ paymentBreakdown;
   propina colectiva según flag en Z/EOD pero siempre en arqueo. Unificar.
7. [MEDIA] Pago mixto de mesa: Σ líneas ≠ objetivo no se valida (sobrante se
   descarta silencioso; corto = parcial accidental → dispara el bug 1).
8. [MEDIA] wink/pedidosya confían en lineTotal del cliente (sin re-precio).
9. [MEDIA] split.subtotal con semántica distinta mesa (neto) vs subcuenta
   (bruto); paySubAccount sin round2 y sin vigía de tasa.
10. [MEDIA] Tasa cliente (split.amountBS) vs tasa server (order.totalBs)
    pueden diferir si la tasa cambió mid-sesión; promo re-pricing en
    checkout puede diferir de lo mostrado (ventana happy-hour).
11. [BAJA] Servicio 0.01% evade §100 (rastro auditable, no bloqueado);
    reintento de action sin clave de idempotencia; roundToWhole no aplica
    en subcuentas.

Gates: tsc 0 · vitest 564.

---

## §103 Batch 2 de la auditoría de cobranza — implementado (2026-07-10)

Todos los ALTA y la mayoría de MEDIA de §102, en un solo bloque para un deploy:

1. PARCIALES DE MESA (el más caro): `netItemsPortionForPayment` en
   tip-calculation (+6 tests) — el cliente manda SIEMPRE el neto de ítems
   (`amount`) y el retenido real va en `paidAmountOverride`, en single Y
   mixto. Antes el bruto con servicio se restaba del balance de ítems y el
   server re-sumaba el 10% (mesa $110 en dos mitades cobraba $104.50).
   Tablets con build viejo siguen con el comportamiento anterior hasta
   recargar (sin romper — por eso recargar tablets post-deploy es OBLIGATORIO).
2. Server autoritativo en mesas: clamp de `discountAmount` divisas al máximo
   teórico (balance × % configurado) + topado al saldo; `paidAmount` con piso
   en el neto aplicado. El §99 pasa de "solo log" a log+clamp.
3. `paySubAccountAction`: guardia de versión (assertOpenTabVersionUpdate) —
   dos subcuentas concurrentes ya no pierden una resta del balance; round2 en
   todo el desglose; split.subtotal = NETO (misma semántica que mesa);
   paidAmount con piso en totalApplied.
4. `voidItemInTx`: ítem cobrado en subcuenta PAID → anulación BLOQUEADA
   (anular la subcuenta primero); subcuentas OPEN afectadas se recalculan
   (recalcSubAccountTotals) — antes quedaban con totales obsoletos.
5. `voidSalesOrderAction`: órdenes de MESA rechazadas (se anulan por ítem
   desde el POS — la anulación entera no revertía running*/splits).
6. Reportes unificados: historial no suma órdenes CANCELLED al cobrado (se
   muestran igual); end-of-day usa runningDiscount (mismo campo que Z);
   Z-report totalCollected = Σ real del desglose por método (antes derivado
   ≠ su propio desglose por los redondeos→propina).
7. Pago mixto de mesa: sobrante vs factura+propina > $0.05 → confirmación
   explícita (antes se descartaba en silencio → caja descuadrada).
8. Wink/PedidosYA: `repriceChannelCart` — el server recomputa cada línea
   desde el precio de BD del canal + ajustes reales de modificadores (por
   unidad) y corrige lineTotal desfasados (log [§103 reprice]).

Pendientes CONSCIENTES (baja/diseño, no bloquean): clave de idempotencia de
actions (reenvío por timeout), ventana de re-precio promo en checkout, tasa
cliente vs server en amountBs, servicio 0.01% (auditable, no bloqueado),
roundToWhole en subcuentas, propina colectiva + excedente misma mesa (operativo).

Gates: tsc 0 · vitest 570.

---

## §104 Pedidos FUTUROS: hora/día programado + comanda diferida (2026-07-10)

Pedido de Omar: en pickup (POS Restaurante) y delivery poder elegir INMEDIATO
o una hora/día específico; la comanda del pedido futuro se imprime SOLA al
llegar su hora, marcada "PEDIDO FUTURO"; las normales dicen "DE INMEDIATO".

### Diseño (cero impacto en el flujo normal)
- `PrintJob.scheduledFor DateTime?` (migración safe + índice). El job queda
  PENDING pero `GET /api/print-agent/jobs` NO lo entrega hasta
  `scheduledFor <= now()`. El agente sondea cada ~1s → imprime puntual SIN
  rebuild on-prem (el diferimiento es 100% server-side). Null = ya (histórico).
- `enqueuePrintJobAction.scheduledFor` + `enqueueKitchenCommand(payload,
  station?, { scheduledFor })`.
- `/api/kitchen/orders` también oculta pedidos futuros hasta su hora → el
  display de cocina/barra y su auto-print aparecen sincronizados con el papel.
- Helpers puros `pos-scheduled-order.ts` (+7 tests): `scheduledInputToISO`
  (datetime-local con hora Y día; acepta legacy HH:MM de pickups guardados,
  vacío = inmediato), `isFutureSchedule` (umbral 90s), `printJobScheduledFor`.

### UI
- POS Restaurante (pickup, tab activo y modal nuevo) y POS Delivery: el input
  pasa de `type="time"` a `type="datetime-local"` — hora Y día. Vacío = DE
  INMEDIATO (semántica previa intacta). El ISO va a
  `SalesOrder.scheduledDeliveryTime` como siempre.
- Los enqueue de comanda de pickup y delivery pasan
  `scheduledFor: printJobScheduledFor(iso)` — solo difieren si es >90s futuro.

### Comanda (renderers)
- Con hora: "*** PEDIDO FUTURO ***" + "ENTREGAR HH:MM" (o "DD/MM HH:MM" si no
  es hoy). Sin hora y no-MESA: "DE INMEDIATO". MESA queda igual.
- Cambio en printer-adapter.ts → REQUIERE rebuild del print-agent on-prem
  para ver las etiquetas nuevas (§84.1 checklist). SIN rebuild, el diferido
  igual funciona y el build viejo imprime el "ENTREGAR HH:MM" de siempre
  (degradación elegante). print-command (fallback navegador) también.

Gates: tsc 0 · vitest 577.

## §105 Incidente "se imprime un monto y el sistema registra otro" + guardián de versión de build (2026-07-13)

**Incidente (12/07 ~20:30, operadora nazareth):** TAB-3691 (Mesa SP-09, ticket
$83.00 + 10% = $91.30, voucher MAESTRO) y TAB-3690 (Mesa SP-08, ticket $49.50
+ 10% = $54.45, voucher VISA). El historial de ventas en las tablets del staff
mostraba COBRADO $83.00 / $46.50 con "10% SERV: No" — como si el servicio no
se hubiera registrado, pese a que el ticket impreso y el voucher del PDV
confirmaban el cobro completo.

**Diagnóstico:** la base de datos estaba CORRECTA todo el tiempo. Las tablets
corrían el bundle PRE-deploy de esa misma noche. El deploy cambió (a) el
formato de respuesta de `getSalesHistoryAction` (clave `data`, §98) y (b) el
cálculo server-side del servicio en filas de mesa (`servicioAmount =
tab.totalServiceCharge`, §103). Cliente viejo + servidor nuevo = campos
desfasados renderizados como "SERV: No" y cobrado sin servicio. Al salir del
sistema y volver a entrar ("Salgan del sistema y vuelvan a abrirlo"), las
tablets bajaron el bundle nuevo y todo cuadró ("ahora si sale").

**Por qué las tablets se quedan con bundle viejo:**
1. El SW (`public/sw.js`) solo dispara `updatefound` si **cambia el archivo
   sw.js** — y los deploys normales no lo tocan (`CACHE_VERSION` fijo).
2. La SPA de Next.js con navegación client-side **nunca re-descarga el HTML**:
   una tablet con la app abierta en memoria puede correr código de hace días.
3. El checklist manual "recargar todas las tablets tras deploy" depende de
   humanos en pleno servicio.

**Fix — guardián de versión (§106 en código):**
- `src/app/api/version/route.ts` (nuevo): devuelve `{ buildId }` leyendo
  `.next/BUILD_ID` (existe en standalone del VPS). `force-dynamic` +
  `Cache-Control: no-store`. Sin auth (hash opaco, alcanzable desde /login).
  En dev devuelve `'dev'` constante → nunca dispara reload.
- `src/components/pwa-register.tsx`: segundo `useEffect` que pollea
  `/api/version` cada 5 min **y al volver la app a primer plano**
  (`visibilitychange` — tablets que duermen la noche). Si el `buildId` del
  servidor difiere del visto al cargar → `reloadWhenSafe()` (misma lógica
  silenciosa existente: no recarga si hay input focuseado o modal abierto;
  reintenta cada 5s, tope 60s). El selector de modal ahora incluye
  `div.fixed.inset-0` (patrón de modales POS CLAUDE.md §7), además de
  `[role="dialog"]` y `[data-state="open"]`.
- El SW no interfiere: `/api/*` está excluido de todo cacheo en sw.js.

**Regla operativa que reemplaza:** el paso manual "reload de todas las
tablets tras cada deploy" pasa a ser red de seguridad, no requisito — máximo
5 minutos después del deploy (o al despertar la tablet) todas las pantallas
corren el bundle nuevo solas.

**Scripts de auditoría relacionados:** `scripts/audit-servicio-tabs.ts`
(--tabs=TAB-XXXX) muestra por mesa: serviceType, splits con base/servicio%/
retenido/propina/notas y veredicto; `scripts/audit-orden.ts` (--orders=)
hace lo propio para órdenes directas. Primer reflejo ante "el sistema
registró otro monto": correr el audit — si la BD cuadra con el ticket físico,
es render viejo en la tablet, no un bug de cobro.

Gates: tsc 0 · vitest 577.

## §107 Reporte Z en Bs + arqueo por terminal PDV + filtro Mesa/Pickup separado (2026-07-13)

**Z en Bs (`z-report.actions.ts`):** el Z ahora incluye `bsRate` (tasa Bs/USD
vigente AL MOMENTO DE CONSULTAR, vía `getExchangeRateValue()` — decisión del
OWNER: la referencia de cuadre es la tasa del día en que se consulta, no la
histórica del día reportado) y `totalCollectedBs = totalCollected × bsRate`.
Si no hay tasa cargada, ambos quedan null/0 y el Z sale solo en USD. En el
modal y en el Excel aparecen "TOTAL EN Bs" y "Tasa del día (al consultar)"
justo debajo de TOTAL COBRADO.

**Arqueo por PDV:** dentro del rubro `card` se discrimina por terminal:
`pdvBreakdown = { shanklish, superferro, otherCard }` (PDV_SHANKLISH /
PDV_SUPERFERRO / CARD·BS_POS genérico). Invariante: la suma de los tres ===
`paymentBreakdown.card` — el total del arqueo NO cambió, solo se desglosa.
Render como sub-líneas indentadas bajo "Punto PDV" en modal y Excel. Los tres
campos nuevos son opcionales en `ZReportData` y se anulan bajo el blindaje
`hidePaymentMethod` igual que el resto del arqueo.

**Filtro Mesa/Pickup (historial):** el filtro Tipo ofrecía "Mesa / Pickup"
unificado (RESTAURANT ∪ PICKUP). Ahora son dos opciones: **Mesa** (solo
orderType RESTAURANT) y **Pickup** (orderType PICKUP excluyendo las órdenes
ficticias PROPINA COLECTIVA, que siguen bajo su filtro "Propinas"). Solo
client-side en `sales/page.tsx` — cero cambios de servidor ni de datos.

Gates: tsc 0 · vitest 577.

## §108 Finanzas multi-moneda: documento en Bs, conversiones CXP y submódulo Cambio de Divisas (2026-07-13)

### 1. Nuevo documento (Compras → Documentos) en $ o Bs + presentación por bulto

`documentos-view.tsx` CreateModal reescrito:
- **Selector de moneda** del documento (Dólares $ / Bolívares Bs). En Bs se
  pide la tasa Bs/USD (pre-cargada con la del día vía `getExchangeRateValue`,
  editable para respetar la tasa de la factura física).
- **Regla de oro**: el documento se persiste SIEMPRE en USD — el costeo de
  inventario (costo promedio ponderado) y las CXP viven en USD. La conversión
  ocurre server-side en `createSupplierDocumentAction` (nuevos params
  `inputCurrency` + `exchangeRate`), y la tasa queda auditada en `notes`:
  "Cargado en Bs a tasa X (total Bs Y)". NO se tocó `registrarEntradaMercancia`
  ni `generatePayableFromDocumentAction` — reciben USD como siempre.
- **Formato bulto** (caso: "5 bultos × 12 paquetes a $30 el bulto"): cada
  línea ahora es Insumo · Bultos · Unid./bulto (default 1) · Costo por bulto.
  El cliente deriva `quantity = bultos × unid/bulto` (en la unidad del insumo)
  y `unitCost = costoBulto / unid.bulto` — la action no cambió de contrato.
  Si se compra por unidad, «Unid./bulto» se deja vacío (= 1) y funciona igual
  que antes.
- Campos más anchos: modal `wide` pasó de max-w-lg a **max-w-2xl**, inputs
  `py-3`, grid con columnas rotuladas y total por línea visible (antes los
  inputs de 64/80px cortaban los montos).

### 2. CXP: conversiones $/Bs al cancelar facturas

`cuentas-pagar-view.tsx` + `account-payable.actions.ts`:
- La vista carga la tasa del día al montar. El modal "Registrar pago" muestra:
  Pendiente en $ **y su equivalente en Bs**, la línea "Tasa del día: 1 USD =
  Bs X", y bajo el monto tecleado la conversión en vivo "≈ Bs Y a tasa del
  día" (resaltada en negrita cuando el método es en Bs).
- `BS_METHODS = {CASH_BS, BANK_TRANSFER, MOBILE_PAY, CHECK}`: para esos
  métodos el pago persiste `amountBs` + `exchangeRate` en `AccountPayment`
  (los campos existían en el schema desde siempre pero la UI nunca los
  enviaba). El historial de pagos expandido ahora muestra "Bs X @tasa".

### 3. Submódulo Cambio de Divisas (`/dashboard/cambio-divisas`)

Caso de uso: se reciben $5.000 y se cambian a Bs para pagar proveedores — la
operación genera la salida de los $ y el ingreso a los bancos seleccionados.

- **Schema** (migración `20260713120000_currency_exchange`, solo CREATE TABLE
  — safe en vivo): `CurrencyExchange` (fecha, currencyOut/amountOut,
  currencyIn/amountIn, `rate` implícita SIEMPRE en Bs por USD, fromAccount
  opcional, status ACTIVE/VOID con voidReason, auditoría) +
  `CurrencyExchangeDestination` (bankAccountId, amount en moneda destino,
  reference). Back-relations en Tenant, User y BankAccount.
- **Action** `currency-exchange.actions.ts`: crear (valida que cada cuenta
  destino sea de la moneda que entra y la origen de la que sale; `amountIn` =
  Σ destinos; tasa implícita derivada), listar, anular con motivo (soft —
  el registro queda visible como anulado), y `getExchangeBankAccountsAction`.
  Roles: lectura OWNER/ADMIN_MANAGER/AUDITOR; escritura OWNER/ADMIN_MANAGER.
- **Vista**: KPIs ($ cambiados del mes, Bs recibidos del mes, tasa del día),
  lista de operaciones con chips por cuenta destino, modal de registro con
  dirección (Dólares→Bs default, o Bs→$), multi-destino (repartir el ingreso
  entre varias cuentas), tasa implícita en vivo y advertencia si difiere >5%
  de la tasa del día.
- **Registro**: módulo `cambio_divisas` en MODULE_REGISTRY (sección admin,
  sortOrder 586, `enabledByDefault: true` → se auto-habilita en tenants
  existentes), MODULE_PERMISSIONS OWNER/ADMIN_MANAGER/AUDITOR, icono
  `ArrowLeftRight` en module-icons. OJO: el Sidebar arma sus grupos con una
  lista FIJA de moduleIds (Sidebar.tsx) — registrar un módulo en
  MODULE_REGISTRY no basta para que aparezca; hay que añadirlo también al
  grupo correspondiente del Sidebar (fix aplicado: entre cuentas_bancarias
  y conciliacion). Recordar esto para todo módulo nuevo.

Nota deliberada: las cuentas bancarias NO llevan saldo corriente en KPSULA
(la conciliación se deriva de ventas); el cambio de divisas es un registro de
tesorería auditado, no un asiento contable de doble partida.

Gates: tsc 0 · vitest 577.

## §108.1 Auditoría del flujo documento → almacén: cantidades exactas garantizadas (2026-07-13)

Auditoría solicitada por el OWNER tras §108 ("si registro 5 bultos × 12 de
harina pan, que al almacén entre la cantidad exacta"). Cadena revisada
completa: modal → `createSupplierDocumentAction` → `enterDocumentToInventoryAction`
→ `registrarEntradaMercancia` → InventoryMovement + InventoryLocation.

**Hallazgo real (corregido):** `registrarEntradaMercancia` consultaba SIEMPRE
la tabla legacy hardcodeada `UNIT_CONVERSIONS` ('ins-leche'/'INS-LECHE-001':
UNIT→×20). Si un insumo coincidiera en id/sku con esas claves y su baseUnit
fuera UNIT, una entrada de 60 se convertía en 1.200 silenciosamente. Fix:
si `input.unit === item.baseUnit` la conversión es identidad SIEMPRE (la
tabla solo aplica a unidades distintas). Los documentos §108 envían siempre
baseUnit → entrada exacta garantizada.

**Endurecimiento:** la matemática de bultos salió de la vista hacia
`src/lib/purchases/pack-line.ts` (puro, compartido):
- `packUnits` = bultos × unid/bulto, redondeo 4 dec (mata ruido FP:
  0.1×3 = 0.3 exacto, no 0.30000000000000004).
- `packUnitCost` = costoBulto / unid/bulto, 6 dec; `packLineTotal` 2 dec.
- `unitsPerPack` vacío/0/inválido ⇒ 1 (nunca divide por cero).
- 6 tests en `pack-line.test.ts` incluido el caso canónico 5×12@$30 →
  60 unidades, $2.50 c/u, $150 línea, con invariante unidades×costo=total.

**Verificación en producción:** `scripts/audit-documento-inventario.ts`
(solo lectura) — compara cada línea del documento contra los movimientos
PURCHASE con esa referencia (ventana ±10 min de la entrada) y la unidad base
del insumo. Marca descuadres de cantidad, unidad distinta a la base y líneas
sin movimiento. Uso:
```bash
npx tsx scripts/audit-documento-inventario.ts --tenant-slug=shanklish --docs=F-00123
npx tsx scripts/audit-documento-inventario.ts --tenant-slug=shanklish --last=5
```

Nota conocida (pre-existente, sin cambio): el costo promedio ponderado se
recalcula por línea con el costo unitario a 6 decimales — el descuadre
posible es de fracciones de centavo en costo, NUNCA en cantidades.

Gates: tsc 0 · vitest 583.

## §109 Recetas: flujo de "Agregar ingrediente" en modal, cero scroll (2026-07-13)

Reporte del OWNER: en `RecipeForm.tsx` (nueva/editar receta), el formulario
de agregar ingrediente se renderizaba INLINE al fondo de la lista — con
recetas largas había que hacer scroll tras cada selección para llegar al
botón "Agregar", en desktop y móvil.

**Rediseño del flujo de clicks:**
1. El formulario ahora es un **modal centrado estándar** (§7 CLAUDE.md,
   z-[60], max-w-2xl) — siempre a la vista, sin scroll, en cualquier pantalla.
2. Al seleccionar el insumo en el Combobox, **el foco salta solo a Cantidad**
   (`qtyInputRef`, setTimeout 0). Igual tras crear un insumo on-the-fly
   (queda pre-seleccionado + foco a Cantidad).
3. **Enter en Cantidad o Merma = Agregar** (submitOnEnter).
4. El modal **queda abierto tras agregar** (toast breve de confirmación,
   campos reseteados) para cargar varios ingredientes seguidos — se cierra
   con «Listo». Botón primario: "Agregar y seguir". Flujo por ingrediente:
   seleccionar → teclear cantidad → Enter. Cero scroll, cero re-aperturas.

**Migraciones de estilo en el mismo commit (regla CLAUDE.md):** emojis del
chrome → lucide (➕→Plus, 🗑️→Trash2, ✕/＋→XIcon/Plus, ⏳→Loader2, ✓→Check,
💾→Save, ←→ArrowLeft), botón Guardar dejó el gradiente amber/white prohibido
→ `pos-btn`, `divide-gray-*` → `divide-capsula-line`, `bg-white` de inputs →
`bg-capsula-ivory` (dark-aware).

Gates: tsc 0 · vitest 583.

## §109.1 Recetas: unidad auto-rellenada + normalización a unidad base (2026-07-13)

Pedido del OWNER: al agregar un insumo a una receta/subreceta, la unidad se
pedía de nuevo (redundante, error humano). Auditoría reveló algo más grave:

**Hallazgo crítico (pre-existente):** las recetas guardaban la unidad que
eligiera el usuario y NINGÚN camino downstream convertía a la unidad base
del stock: ni la validación de stock (`addRequirement` en pos.actions), ni
el descargo de venta (`registerInventoryForCartItems`), ni la reversión por
anulación (`applyItemInventoryInTx`), ni el consumo teórico
(`consumption.ts`, que ni siquiera recibe unidades). Una receta con "200 G"
de un insumo en KG descontaba **200 KG** del stock. Estaba enmascarado
porque la UI pre-seleccionaba la unidad base.

**Fix — normalizar EN EL ORIGEN (un solo punto, sin tocar código de ventas):**
- `src/lib/inventory/unit-conversion.ts`: `qtyToBaseUnit(qty, unit, baseUnit)`
  — convierte SOLO dentro de la misma familia (masa: KG/G/LB/OZ; volumen:
  L/ML/GAL; conteo: UNIT/DOZEN; PORTION identidad). Familia distinta o
  unidad desconocida → sin cambios (nunca inventa). 10 tests.
- `createRecipeAction` / `updateRecipeAction`: `normalizeIngredientUnits`
  convierte cada ingrediente a la unidad base de su insumo ANTES de
  persistir. Desde ahora `RecipeIngredient.unit === ingredientItem.baseUnit`
  siempre (para familias compatibles) → validación, descargo, void y teórico
  quedan correctos por construcción.

**UI (`RecipeForm.tsx`, aplica a receta Y subreceta — mismo form):**
- Al seleccionar el insumo, la unidad se rellena sola con la del insumo.
- El selector queda limitado a la familia compatible (KG↔G, L↔ML); si la
  familia tiene una sola unidad (UNIT), queda deshabilitado con la unidad
  fija. Antes de elegir insumo: deshabilitado ("— elige el insumo —").
- Hint bajo el campo: "Unidad del insumo: Litros — puedes cambiar a
  Mililitros". `addIngredient` blinda: unidad fuera de familia → baseUnit.

**Datos legacy:** `scripts/audit-recetas-unidades.ts` — lista ingredientes
de recetas Y de modificadores con unit ≠ baseUnit; dry-run por defecto,
`--apply` normaliza los convertibles (G→KG etc.) y deja reporte de los de
familia distinta (corrección manual). CORRERLO POST-DEPLOY:
```bash
npx tsx scripts/audit-recetas-unidades.ts --tenant-slug=shanklish          # ver
npx tsx scripts/audit-recetas-unidades.ts --tenant-slug=shanklish --apply  # normalizar
```

Deuda consciente: los caminos de descargo siguen SIN convertir (confían en
que la receta esté en unidad base — garantizado hacia adelante por el fix
de origen + script para lo viejo). Si algún día se re-abren unidades libres,
convertir también en descargo.

Gates: tsc 0 · vitest 593.

## §110 Comanda de mesa: nombre del mesonero + diagnóstico recibo automático (2026-07-13)

**Mesonero en comanda (pedido OWNER):** `AgentKitchenPayload.waiterName`
(nuevo, opcional). POS mesero lo manda con el mesonero ACTIVO que comanda
(`activeWaiter`); POS restaurante con el asignado a la mesa
(`activeTab.waiterLabel`). El agent (`printer-adapter.ts renderKitchen`)
imprime `Mesero: X` en negrita bajo la línea de Mesa — REQUIERE rebuild del
agente en la PC del local (git pull + npm.cmd run build + reinicio del
servicio "KPSULA Print Agent"). El fallback navegador (`printKitchenCommand`)
ya soportaba `waiterLabel` — sin cambios.

**Recibo de pago "no imprime automático" (reportado tras actualizar el
agente):** FALSA PISTA del agente — los recibos NUNCA pasan por el print
agent. `printReceipt` (print-command.ts) abre popup del navegador +
window.print() en el dispositivo que cobra. `enqueueReceipt` existe en
print-via-agent pero NO tiene callers. El auto-print al cobrar mesa está
gateado por `getPOSConfig().printReceiptOnRestaurant` (localStorage POR
ESTACIÓN, clave `shanklish_pos_config`, default true, toggle en
Config → POS). Diagnóstico estándar: (1) verificar el toggle en ESE equipo,
(2) bloqueador de popups del navegador (window.open null → alert "Habilite
popups"), permitir popups para kpsula.app.

Gates: tsc 0 · vitest 593.

## §111 Recibo de pago por el Print Agent (impresora de caja) — automático y silencioso (2026-07-13)

**Problema (OWNER, en sitio):** el recibo de pago no salía automático. Causa
raíz: TODAS las pantallas POS emitían el recibo con `printReceipt`
(print-command.ts) = popup del navegador + `window.print()`. Eso exige
confirmar el diálogo del SO (o lo bloquea el navegador), y en tablets Android
ni siquiera puede alcanzar la térmica de red. Las comandas SÍ salían porque
van por el agente; los recibos no. `enqueueReceipt`/`renderReceipt` (camino
por agente) existían pero NINGÚN caller los usaba.

**Fix — enrutar el recibo por el agente, opt-in por estación:**
- `pos-settings.ts`: `printReceiptViaAgent` (default false) + `receiptStation`
  (default 'caja'), guardado en localStorage por navegador/estación.
- `print-command.ts` `emitReceipt(data)`: si `printReceiptViaAgent` → mapea
  `ReceiptData` → `AgentReceiptPayload` y `enqueueReceipt(payload, receiptStation)`
  (sale silencioso en la térmica de caja, misma vía que comandas). Si no →
  `printReceipt(data)` de siempre. Default OFF = cero cambio para otros setups.
- Call sites migrados `printReceipt(` → `emitReceipt(` en las 3 pantallas POS
  (restaurante ×4: cobro mesa, pre-cuenta, cobro pickup, reimpresión pickup;
  mesero ×1; delivery ×1). La reimpresión desde Historial de ventas sigue en
  navegador (acción manual de gestión).
- `AgentReceiptPayload.businessName` + agent `renderReceipt` imprime
  `p.businessName ?? 'CAPSULA'` (antes hardcodeaba "CAPSULA"; ahora sale el
  nombre del tenant vía `data.branding.name`).

**Requiere (Shanklish, cobran desde la PC principal, hay térmica de caja en
la red):** (1) deploy web; (2) rebuild del agente en la PC (printer-adapter
cambió — también trae §110 mesonero); (3) en PRINTERS_JSON del `.env` del
agente debe existir una entrada con `station` = valor de `receiptStation`
(ej. `{"station":"caja","ip":"192.168.1.5x","port":9100}`); (4) activar el
toggle en Config → POS → "Impresora del recibo" en el navegador de la caja.

Diagnóstico previo (§110) actualizado: el recibo NO era del agente entonces
porque nada lo enrutaba; §111 lo enruta.

Gates: tsc 0 · vitest 593 · agent build 0.

## §111.1 PENDIENTE — Recibo automático en las 3 cajas de Shanklish (2026-07-13)

Retomar en próxima sesión. Contexto recopilado en sitio:

- **Objetivo:** que el recibo de pago salga **automático (silencioso, sin
  diálogo)** en **3 computadoras, cada una con su propia impresora térmica**.
- **Hardware confirmado (PC principal):** la impresora de caja es
  `Comandera1` (POS-80C) conectada por **USB** (puerto `USB005`). El puerto
  de red `192.168.1.120:9100` está MUERTO (ni ping ni TCP) — es un puerto
  fantasma de Windows, no una impresora viva. Las de red que sí responden
  son cocina/barra: bar `.140`, kitchen `.141`, kitchen `.142`.
- **Implicación:** el Print Agent imprime por IP (TCP 9100), NO por USB →
  el camino §111 (recibo por agente) NO sirve para cajas con impresora USB.
  Por eso el toggle `printReceiptViaAgent` debe quedar APAGADO en Shanklish
  (con él OFF, `emitReceipt` = `printReceipt` navegador de siempre, sin
  regresión).
- **Camino acordado (navegador silencioso, por PC):** en cada una de las 3
  PC: (1) dejar su impresora térmica como **predeterminada** de Windows
  (`(New-Object -ComObject WScript.Network).SetDefaultPrinter('<nombre>')`);
  (2) abrir Chrome con `--kiosk-printing` (editar Destino del acceso directo,
  cerrar todo Chrome antes); (3) abrir KPSULA SIEMPRE desde ese acceso
  directo. Probable causa de que "dejó de imprimir": Chrome se reabrió sin
  el flag o cambió la predeterminada.
- **Falta por recopilar de las otras 2 PC:** nombre exacto de la impresora
  (`Get-Printer`), que sea la predeterminada, y confirmar el acceso directo
  de Chrome con `--kiosk-printing`. Cada PC es independiente (config local).
- **Alternativa a evaluar si quieren red:** cambiar las 3 térmicas de caja a
  Ethernet con IP fija y usar el agente (§111) con una estación por caja —
  pero eso es cambio de hardware/red, no urgente.

Estado del código: §111 ya mergeado (opt-in, OFF por defecto — no afecta).
Falta solo la config por-PC (kiosk-printing), sin cambios de código.

## §112 Sprint: divisas mixto con gross-up, modales sobre el sidebar, sub-recetas visibles (2026-07-13)

### 1. Delivery: divisas solo a comida + envío en Bs (bug de 25% efectivo)

**Bug:** en pago mixto el descuento divisas era `pagado × rate` — con ⅓ eso
es 25% efectivo sobre la base cubierta, no 33,33%. Caso del OWNER: comida
$30 + envío Bs $4.50; el cliente debía pagar $20 divisas + $4.50 Bs, pero el
sistema solo descontaba $6.67 y quedaba saldo fantasma.

**Fix — gross-up (espejo de computeDivisasSettlement de mesa):**
- `divisasBaseFromPaid(paidUsd, itemsSubtotal, rate)` en delivery-totals.ts:
  base bruta cubierta = `pagado / (1 − rate)`, topada al subtotal de ítems.
  7 tests (incluye integración: $30 comida + fee BS → total $24.50, desc $10,
  y regresión documentando la fórmula vieja).
- Server `calculateCartTotals`: gross-up en la rama DELIVERY (divisasBase
  hacia computeDeliveryTotals + discountReason "sobre $X de consumo") y en
  la rama RESTAURANT/PICKUP mixta (misma clase de bug).
- Cliente delivery/page.tsx: `divisasCoveredBase` con el mismo helper; hints
  muestran "$20.00 en divisas cubren $30.00 de consumo (−$10.00)".
- **Reparto sugerido**: con DIVISAS_33 + envío Bs, botón "Reparto sugerido:
  comida en divisas $X + envío en Bs $Y (Bs Z)" que pre-carga las 2 líneas
  del pago mixto (CASH_USD comida con descuento + CASH_BS fee a tasa),
  editables (pueden cambiar método a Zelle/PM). Soporte `initialLines` en
  MixedPaymentSelector (opcional, remount por key — sin cambio para otros).
- **Alineación de redondeo en mixto**: el server NO redondea en mixto (no
  recibe paymentMethod) pero el cliente redondeaba con el método single →
  divergencia por céntimos y el reparto exacto nunca "completaba". Ahora el
  cliente tampoco redondea en mixto (`roundToWhole(x, isMixedMode ? '' : method)`).

### 2. Modales bajo el sidebar a media pantalla (reporte Christian)

**Causa raíz:** `.animate-in` usaba `animation: fade-in .3s forwards` — una
animación de opacidad "filled" crea un **stacking context permanente**
(Chrome), y cualquier modal `fixed z-[60]` DENTRO de la página queda pintado
debajo del sidebar `z-50`. Visible al usar el navegador a media pantalla
(layout móvil → sidebar-drawer encima del contenido).

**Fix doble:**
- `globals.css`: quitar `forwards` (el keyframe termina en opacity:1 = valor
  natural → visualmente idéntico, y el stacking context muere al terminar).
- `src/components/ui/modal-portal.tsx` (nuevo): `ModalPortal` renderiza el
  modal en `document.body` vía createPortal (SSR-safe). Aplicado al modal de
  Agregar ingrediente de RecipeForm. REGLA: para futuros modales dentro de
  páginas del dashboard, envolver en `<ModalPortal>` si hay riesgo de
  ancestros con transform/animación.

### 3. Sub-recetas vs productos finales + receta de modificadores

- **Recetas (RecipeList)**: el filtro por tipo existía como select discreto
  y pasaba desapercibido → ahora chips visibles "Todas (N) | Sub-recetas (N)
  | Productos (N)" estilo segmented control.
- **Buscador de insumos de RecipeForm**: el prefijo de tipo era un string
  VACÍO (emoji removido en migración) → todo se veía igual. Ahora
  "[Sub-receta] Nombre (KG) - $X".
- **Inventario**: ya tenía chips por tipo (Insumo/Sub-receta/Producto) desde
  junio — sin cambios.
- **Receta de modificadores**: el editor EXISTÍA (§80, modal "Receta propia")
  pero su punto de entrada era un icono de matraz sin etiqueta → nadie lo
  encontraba. Ahora es botón etiquetado: "Crear receta" (sin receta propia) /
  "Receta propia" (verde, ya definida), en cada fila de modificador en
  Menú → Modificadores.

Gates: tsc 0 · vitest 600.

## §113 Encuesta de satisfacción del cliente (2026-07-13)

Pedido del dueño: calificación de satisfacción rellenable por el mesonero
desde la tablet, con respuestas predeterminadas + texto opcional, SIN
interferir el cobro, "una vez casi finalizado el proceso".

**Diseño (elegido por defecto — la tool de preguntas falló):** calificación
GENERAL de 1 toque (Excelente/Buena/Regular/Mala con emoji) + comentario
opcional colapsado. Columnas de dimensión (food/service/ambiance) quedan
nullable en el schema para extender a multi-dimensión después sin migración.

**Punto de captura (no interfiere el cobro):**
- **POS Restaurante**: la tarjeta aparece AUTOMÁTICA tras `closeOpenTabAction`
  (cerrar cuenta) — el cobro y la liberación de la mesa YA ocurrieron. Se
  capturan tabCode/tableName/waiterLabel ANTES de limpiar el estado. Siempre
  omitible ("Omitir" / X).
- **POS Mesero** (tablet del mesonero): botón manual "Encuesta de
  satisfacción" en el footer de la mesa activa → abre la misma tarjeta con
  el mesonero activo atribuido.

**Componentes/archivos:**
- `src/lib/sales/satisfaction.ts` (puro): escala SATISFACTION_RATINGS +
  SATISFACTION_META (emoji/score/tone) + summarizeSatisfaction (conteos,
  promedio 1–4, % positivo). 4 tests.
- `SatisfactionSurvey` model + migración `20260713180000_satisfaction_survey`
  (solo CREATE TABLE — safe en vivo). Back-relations Tenant + User.
- `satisfaction.actions.ts`: submit (roles POS: OWNER/ADMIN/OPS/CASHIER/
  WAITER/AREA_LEAD) + getSatisfactionSurveysAction (resultados por día
  Caracas, resumen + por-mesonero; lectura OWNER/ADMIN/OPS/AUDITOR).
- `components/pos/SatisfactionSurveyCard.tsx`: tarjeta reutilizable
  (ModalPortal z-[65], emojis intencionales = contenido, no chrome).
- Módulo `/dashboard/encuestas` (registry `encuestas`, sortOrder 545,
  enabledByDefault, icono Star, en Sidebar admin): KPIs (respuestas,
  promedio, % positivas, distribución), ranking por mesonero, detalle con
  comentarios. Permisos OWNER/ADMIN_MANAGER/OPS_MANAGER/AUDITOR.

Requiere deploy con migración (migrate deploy la aplica). Sin rebuild de
agente (no toca impresión).

Gates: tsc 0 · vitest 604.

## §114 Sub-recetas agrupadas en el selector de ingredientes (2026-07-13)

Reporte de Christian (Pomelos): "las sub recetas no me las toma para las
recetas… la empanada lleva sofrito de kibbe pero no me deja verlo".

**Diagnóstico:** `getIngredientOptionsAction` SÍ incluye sub-recetas desde
junio (`type: { in: ['RAW_MATERIAL', 'SUB_RECIPE'] }`) — la función existe.
Dos causas reales de lo que ve Christian:
1. Pomelos corre código anterior a §112 → el listado de recetas no muestra
   la división Todas/Sub-recetas/Productos. Se resuelve al desplegar.
2. Para que un componente (sofrito de kibbe) aparezca como ingrediente debe
   estar guardado como **"Sub-receta (Intermedio)"**, no "Producto Final
   (Venta)". El picker toma insumos y sub-recetas, NUNCA productos de venta
   (correcto por diseño — no metes un producto vendible en otra receta).

**Mejora de código:** el `Combobox` ahora soporta `group?` opcional (compat
hacia atrás: sin grupos = lista plana de siempre). En RecipeForm el selector
de ingredientes agrupa **"Sub-recetas" arriba** e **"Insumos" abajo**, con
encabezados y conteo, y ordena las sub-recetas primero. Antes era una lista
plana con prefijo "[Sub-receta]" que se perdía entre insumos.

Guía operativa: si una sub-receta no aparece al armar otra receta, verificar
que se guardó con el radio "Sub-receta (Intermedio)". Un componente creado
como "Producto Final" no aparece como ingrediente (hay que reabrirlo y
cambiar el tipo).

Gates: tsc 0 · vitest 604.

## §115 Proveedores, anticipos y retenciones IVA/ISLR (2026-07-13)

Pedido del OWNER: submódulo de proveedores en Finanzas (reflejado en
Documentos); abonar a facturas desde Gastos incluso ANTES de que exista la
factura ("pago hoy, me facturan mañana"); retenciones IVA/ISLR para cerrar
facturas que los adelantos no cubren — todo SIN duplicar operaciones.

**Regla de oro anti-duplicado (egresos = Gastos + AccountPayment(isCash) +
SupplierAdvance):**
- Anticipo (SupplierAdvance) = efectivo sale UNA vez al crearlo → cuenta como
  egreso.
- Aplicar anticipo a factura = AccountPayment `isCash=false` → baja el saldo
  de la factura pero NO vuelve a contar (el efectivo ya salió).
- Retención IVA/ISLR = reduce saldo SIN salir efectivo al proveedor → nunca
  es egreso; solo cierra la factura.

**Schema (migración `20260713200000_suppliers_advances_retentions`, solo
aditiva — safe en vivo):** Supplier.rif; AccountPayable.retentionIvaUsd/
retentionIslrUsd; AccountPayment.isCash + supplierAdvanceId; modelo
SupplierAdvance (anticipos).

**Lib pura `src/lib/finance/payable-settlement.ts` (15 tests):**
`settlePayable` (saldo = total − pagos − retenciones, status, isClosed),
`checkPaymentFits` (no sobrepago contando retenciones), `applicableAdvance`,
`advanceRemaining`. Todo `round2`.

**Actions:**
- `supplier.actions`: list (con pendiente + saldo de anticipos), upsert,
  activar/desactivar.
- `supplier-advance.actions`: crear (efectivo out, opcional aplicar de una),
  aplicar anticipo existente (valida mismo proveedor + tope), anular (solo si
  sin aplicaciones).
- `account-payable.actions`: registerPayment usa settlePayable + respeta
  retenciones al topar; nueva `setPayableRetentionsAction` (montos absolutos,
  valida pagos+retenciones ≤ total, cierra si saldo < 1¢). isCash=true en
  pagos normales.
- `finance.actions`: outflows corregido (isCash + anticipos, sin duplicar).

**UI:**
- Submódulo `/dashboard/proveedores` (registry `proveedores`, sección admin,
  sidebar Finanzas, permisos OWNER/ADMIN/OPS/AUDITOR): CRUD con RIF, KPIs
  (por pagar total, anticipos a favor). Los proveedores se reflejan solos en
  Documentos (getSuppliersAction) y Cuentas por pagar.
- `SupplierPaymentModal` (desde Gastos → "Abonar a proveedor"): elegir
  proveedor → "A una factura" (registerPayment cash) o "Anticipo sin factura"
  (createSupplierAdvance). Sugiere anticipo si el proveedor no tiene facturas
  pendientes.
- Cuentas por pagar: botón "Retención" por factura → modal IVA/ISLR con
  preview del saldo resultante y aviso de cierre.

Gates: tsc 0 · vitest 619.

## §116 Fix: vuelto erróneo en pickup con métodos en Bs (2026-07-14)

**Síntoma (Omar):** en POS Restaurante → Pickup, al seleccionar un método en
Bs (pagomóvil, PDV, efectivo Bs) el "Vuelto a devolver" salía disparado (p.ej.
$4980) — el vuelto se estaba calculando en $ restando un monto tecleado en Bs.

**Causa:** `restaurante/page.tsx`, bloque de pickup pago único. Se usaba
`singlePaidAmount = parseFloat(amountReceived)` (input crudo). Para métodos Bs
el campo "Recibido" se teclea en **Bs** (rótulo Bs, línea ~2685), pero
`pickupTotal` está en **USD** → `pickupChange = Bs − USD` = basura.

**Fix:** el vuelto físico sólo aplica a efectivo USD. Se pasó a usar
`paidAmount` (ya normalizado a USD, línea ~656) y se guardó con `!isBsPayMethod`,
mismo patrón que el flujo de mesa (línea ~3331):
```js
const pickupChange = isPickupMixedMode
  ? Math.max(0, totalMixedPickupPaid - pickupTotal)
  : (!isBsPayMethod ? Math.max(0, paidAmount - pickupTotal) : 0);
```
Para métodos Bs → 0 (no se muestra vuelto ni propina-desde-vuelto; pagomóvil/PDV
son electrónicos y exactos). Para USD → idéntico al comportamiento previo
(paidAmount === rawAmount). No toca lo que se cobra ni escrituras en BD: sólo
el display del vuelto y el tope de la propina voluntaria. Fix de presentación,
sin cambio de schema/lógica de cobro.

Gates: tsc 0 · vitest 619.

## §117 Fix: platos "invisibles" en Recetas por receta colgante (2026-07-15)

**Síntoma (Christian):** "No veo todas las recetas de los productos de venta;
shawarma de carne no veo dónde crearle la receta."

**Causa raíz — producto invisible:**
- `deleteRecipeAction` hace soft-delete de la receta (`isActive=false`) pero a
  propósito NO limpia `MenuItem.recipeId` (para poder re-vincular).
- `getMenuItemsWithoutRecipeAction` solo mostraba `recipeId: null` → el plato con
  receta muerta NO salía en el panel "Platos del Menú sin Receta".
- `getRecipesAction` solo trae `isActive: true` → la receta muerta TAMPOCO salía
  en la lista.
- Resultado: el plato quedaba invisible, imposible recrearle receta.

**Fix (sin schema, deploy-safe):**
- `getMenuItemsWithoutRecipeAction`: un plato cuenta como "sin receta" si
  `recipeId` es null O apunta a una receta muerta. Como `MenuItem` solo tiene el
  escalar `recipeId` (sin relación `recipe`), se filtra contra el set de recetas
  vivas (`isActive:true`) en memoria.
- `createRecipeStubForMenuItemAction`: solo bloquea "ya tiene receta" si la
  receta vinculada sigue VIVA; si el `recipeId` cuelga de una receta muerta,
  permite recrear el stub (el updateMany re-apunta recipeId a la nueva). Así los
  platos colgantes existentes se auto-reparan desde la UI, sin migración de datos.

**Diagnóstico:** `scripts/audit-menu-recipe-links.ts` (solo lectura) — lista todos
los links colgantes y busca un plato por nombre (`--buscar="shawarma"`),
distinguiendo inactivo / sin receta / receta colgante / receta viva, y si el
nombre existe como InventoryItem (insumo/sub-receta) en vez de plato.

Gates: tsc 0 · vitest 619.

## §118 Servidor local del restaurante — arquitectura on-premise + túnel (2026-07-15)

**Pedido (Omar):** instalar el computador dedicado en el restaurante para que el
sistema se use localmente (tablets/cajas por LAN) y que ese equipo, prendido
24/7, mantenga comunicación con la versión web en el VPS.

**Arquitectura elegida — una sola fuente de verdad, sin sync de BDs:**
- El computador dedicado (Ubuntu Server 24.04) corre el stack completo:
  postgres :5432 (BD viva) + Next.js standalone :3000 (pm2) + nginx :80 para
  la LAN. Tablets y print-agent apuntan a `http://<ip-fija-local>`. El POS
  opera aunque se caiga internet.
- kpsula.app NO se apaga: nginx del VPS proxea a un **túnel SSH reverso**
  (`-R 127.0.0.1:3100 → local:3000`, systemd `capsula-tunnel.service` con
  reconexión automática). El acceso remoto ve la misma BD en vivo. Se descartó
  replicación bidireccional (conflictos irresolubles con ventas concurrentes).
- **Backups off-site invertidos**: cron local cada 6 h hace `pg_dump` y lo
  empuja al VPS (`/var/lib/postgresql/backups/local-server/`, retención 30 d)
  vía llave SSH con forced-command. Contingencia documentada: si el equipo
  local muere, el VPS restaura el último dump y `capsula-route-vps.sh`
  devuelve kpsula.app al stack del VPS (pérdida máx ~6 h).

**Cambios de código (env-gated, no-op en el VPS):**
- `src/lib/auth.ts` → `cookieSecureFlag()`: `COOKIE_SECURE=false` permite login
  por http en la LAN (cookie `secure` jamás se guarda sobre http). Default
  intacto: `NODE_ENV === 'production'`.
- `src/middleware.ts` → `siteUrl()` acepta hosts extra vía
  `EXTRA_TRUSTED_HOSTS` (CSV, match sin puerto) para que los redirects del
  middleware funcionen con `http://<ip-local>`. Vacío → comportamiento
  histórico exacto (solo kpsula.app).

**Tooling nuevo (`scripts/local-server/`):** `install-local-server.sh`
(provisioning completo idempotente), `env.example`, `nginx-local.conf`,
`setup-tunnel-local.sh` + `setup-tunnel-vps.sh` (usuario `capsula-tunnel`
restringido con `restrict,permitlisten` / forced-command; helpers
`capsula-route-local.sh` / `capsula-route-vps.sh` para el switch de nginx),
`push-backup-to-vps.sh` (cron 6 h, + tar local de `storage/`), `watchdog.sh`
(cron 2 min: app/postgres/túnel), `update-local-server.sh` (el CI solo
despliega al VPS; el local se actualiza con este script, con backup previo y
`migrate deploy`).

**Runbook completo:** `docs/LOCAL_SERVER.md` (hardware/UPS, instalación,
cutover de datos VPS→local con congelamiento de escrituras, verificación del
túnel, operación diaria, contingencias, seguridad). `docs/INFRASTRUCTURE.md`
anota la excepción a la regla "todo vive en el VPS" — al ejecutar el cutover
real hay que actualizar esa página.

**Update 2026-07-18 (despliegue real, HP EliteDesk 800 G2 256GB):**
- `install-local-server.sh` ahora instala **PostgreSQL 18 vía repo PGDG** en
  vez del postgres de la distro. Razón: el VPS corre PG 18 y el dump del
  cutover se restaura en el local — restaurar un dump de pg_dump 18 en el
  PG 16 de Ubuntu 24.04 (o 15/17 de Debian) puede fallar por versión. PGDG
  garantiza la misma major en cualquier distro.
- Soporte oficial **Debian 12/13** además de Ubuntu (mismo script). Motivo
  real: el BIOS del EliteDesk 800 G2 no aplicó el cambio de Secure Boot
  (nunca mostró el código de confirmación) y el iPXE de netboot.xyz no está
  firmado → rebote silencioso al boot menu. El instalador de Debian está
  shim-signed y arranca con Secure Boot habilitado; además el netinst
  (~700MB) cabe en pendrives chicos donde la ISO de Ubuntu (2.7GB) no entra.

## §118 Mover mesa sin mesonero asignado (2026-07-15)

**Reporte (grupo SISTEMA SC, día de partido):** "una mesa no deja hacer el
movimiento porque dice que no tiene mesonero asignado".

**Causa:** `moveTabBetweenTablesAction` exigía `openTab.waiterProfileId` solo
porque `TableTransfer.fromWaiterId/toWaiterId` eran NOT NULL. Las cuentas
abiertas desde caja no tienen mesonero → el movimiento quedaba bloqueado.

**Fix:**
- Schema: `TableTransfer.fromWaiterId/toWaiterId` ahora nullable (migración
  `20260715170000_table_transfer_optional_waiters` — DROP NOT NULL + FKs
  ON DELETE SET NULL; metadata-only, safe en vivo).
- `moveTabBetweenTablesAction`: ya no bloquea; registra `waiterId ?? null`.
  La autorización sigue siendo obligatoria (PIN capitán/gerente) y queda en
  el registro de auditoría.
- La CESIÓN mesonero→mesonero (`transferTableAction`) sigue exigiendo ambos
  mesoneros — no cambió.
- `operations-reports.getTableTransfers`: null-safe → "Sin mesonero".

Gates: tsc 0 · vitest 619.

## §119 Buscador en el panel "Platos del Menú sin Receta" (2026-07-15)

Tras §117 el panel puede listar decenas de platos. Se añadió buscador
client-side (nombre o categoría, filtrado en memoria — cero cambios de
servidor), contador "N de M", empty-state y scroll interno (max-h 50vh)
para listas largas. La lista principal de recetas (RecipeList) ya tenía
buscador + filtros de categoría/tipo desde §112 — no se tocó.

§119.1: el panel arranca CERRADO por defecto. La preferencia del usuario
(abierto/cerrado) persiste en localStorage (`recetas:missingPanelOpen`) y se
lee en useEffect post-montaje — nunca en el useState initializer — para no
causar hydration mismatch con el HTML del servidor.

## §120 Separación recetas del menú vs sub-recetas (pedido del gerente general, 2026-07-15)

"Dividir recetas del menú de las sub-recetas porque se empastela buscar; crear
la receta del plato desde el catálogo; las sub-recetas desde producción."
Implementado 100% en UI — cero cambios de schema/BD, cero migraciones.

1. **Catálogo (Menú)** — la receta del plato se gestiona "ahí mismo":
   - Badge "Sin receta" → crea el stub y navega DIRECTO a su editor.
   - "Receta vacía" → link directo a `/dashboard/recetas/{id}/editar`.
   - "Receta lista" → link a la vista de la receta.
   - Reventa 1:1 (output type RAW_MATERIAL): badge azul "Reventa 1:1" SIN link
     de edición — su receta es técnica (1 venta = 1 unidad de stock) y editarla
     dañaría el descargo. `getMenuWithCategoriesAction` ahora enriquece
     `_recipeOutputType` para detectarlo.
2. **Recetas** — `RecipeList` abre por defecto en "Productos" (FINISHED_GOOD).
   El toggle Todas/Sub-recetas/Productos sigue disponible. Nuevo prop
   `lockedType` fija la lista a un tipo y oculta el toggle.
3. **Producción** — nueva pestaña "Sub-recetas" (`SubRecetasTab.tsx`): lista
   solo SUB_RECIPE (reutiliza RecipeList lockedType) + botón "Nueva
   sub-receta" → `/dashboard/recetas/nueva?tipo=SUB_RECIPE`. `RecipeForm`
   acepta `initialType` (solo para creación; en edición manda initialData).

Las recetas de reventa (RAW_MATERIAL) quedan fuera de ambas vistas por tipo —
solo visibles en "Todas". Gates: tsc 0 · vitest 619.

## §121 Propina automática por excedente en pagos Bs electrónicos — mesa (2026-07-16)

**Reporte del administrador (video):** cobro por pagomóvil de $12 (en Bs) sobre
factura de $9 → historial y recibo mostraban $9; los $3 de excedente (que YA
entraron al banco) quedaban invisibles salvo tecleo manual de la cajera.

**Causa:** la protección anti-propina-fantasma de §46 (`keptAmountForSplit`
registra min(recibido, factura) + propina tecleada; el excedente se asume
VUELTO) es correcta para efectivo, pero en pagomóvil/PDV no existe vuelto
electrónico. En divisas el excedente de redondeo sí se auto-registra
(`roundingTipForCharge`, política del dueño 16/06) — de ahí la asimetría.

**Fix (mesa, pago único):**
- Nuevo helper puro `electronicBsExcessTip` en `tip-calculation.ts` (9 tests):
  excedente = recibido − factura, SOLO para MOVIL_NG/PDV_SHANKLISH/
  PDV_SUPERFERRO; nunca CASH_BS (vuelto físico), nunca USD/Zelle (los cubre
  roundingTip), nunca en mixto, y 0 si la cajera lo quitó (`dismissed`).
- `handlePaymentPinConfirm`: intendedTip = max(tecleada, roundingTip,
  bsExcessTip); el cap y el registro siguen siendo los mismos
  (`cappedTipForPayment` + `keptAmountForSplit`) — cero matemática nueva.
- Preview visible en el panel de cobro Bs: "Propina (excedente): $X · Bs Y —
  se registrará como propina" con botón **Quitar** (si la cajera dará el
  vuelto en efectivo de la caja → comportamiento anterior). `bsExcessDismissed`
  se resetea al cambiar monto/método y tras cada cobro.
- El confirm §100.2 NO se dispara para el excedente automático (solo para
  propina tecleada por encima del redondeo) — misma fricción-cero que divisas.
- Recibo, historial y Z ya discriminaban propina (infra §46): recibo imprime
  línea "Propina" + TOTAL A PAGAR completo; historial muestra factura/cobrado/
  propina; Z suma "Propinas" aparte. Pickup ya registraba el monto completo
  (amountPaid) — sin cambios allí.

**Operativo:** avisar a las cajeras que NO tecleen más la diferencia a mano en
pagos Bs electrónicos — el sistema la propone solo.

Gates: tsc 0 · vitest 628 (619 + 9 nuevos).

## §122 Edición inline de cantidades en la ficha de receta (2026-07-16)

**Pedido del gerente:** cambiar la cantidad de un ingrediente exigía eliminarlo
y re-agregarlo.

**Fix (UI pura, sin cambios de BD):** en `RecipeForm` (crear y editar, recetas
y sub-recetas comparten el form) la cantidad de cada fila es un input inline.
Patrón draft-string por fila (`qtyDrafts`): se tipea como string (decimales
"0.009" no se rompen), se commitea al estado en cada tecla válida >0 (costo en
vivo se actualiza), y al blur el draft se descarta — un valor vacío/inválido
vuelve al último válido, nunca se guarda. El guardado pasa por la
normalización de unidades de §109.1 (sin cambios ahí).

Puntos 2 y 3 del gerente (misma reunión): el "SIN" ya existía (§94,
`allowSin` en materia prima — activable sin deploy); las sub-recetas de
descarga directa sin producción (tabule) quedaron planificadas en 3 fases
para ejecutar con el local cerrado (helper puro+tests → flag+migración →
integración en los 4 caminos de descargo).

Gates: tsc 0 · vitest 628.

## §123 Fix: "Error al despachar" requisiciones — modelos sin tenantId en TENANT_MODELS (2026-07-17)

**Síntoma (foto del restaurante, despacho al Centro de Producción):**
PrismaClientValidationError al despachar/aprobar una requisición — el
`requisitionItem.updateMany` recibía un `where.tenantId` que el modelo no
tiene.

**Causa raíz:** `prisma-tenant-client.ts` inyecta `where.tenantId` en los
modelos de TENANT_MODELS, pero **7 modelos de la lista NO tienen columna
tenantId** en schema.prisma: RequisitionItem (el que explotó),
SupplierItem, MenuItemModifierGroup, InventoryAuditItem,
IntercompanyItemMapping, ProcessingTemplateOutput, RateLimitBucket.
Crear la requisición funcionaba (el create anidado del padre no pasa por
la inyección del hijo) — reventaba solo al despachar (updateMany directo).

**Fix:** los 7 se removieron de la lista (73→66) — son tablas hijas que se
aíslan por FK a su padre tenant-aware, mismo patrón ya documentado para
SalesOrderPayment y DeliveryOrderEvent. Comentario-guardia en la lista.

**Regresión bloqueada por test:** `prisma-tenant-client.test.ts` ahora
parsea schema.prisma y falla si CUALQUIER modelo de la lista carece de
columna tenantId (§123) — imposible reintroducir el bug.

Gates: tsc 0 · vitest 630.

## §124 Fase A — Helper de sub-recetas de descarga directa (tabule) (2026-07-18)

**Pedido del gerente (punto 2):** sub-recetas tipo tabule se hacen al momento y
nadie registra su producción; al vender un shawarma debe descargar las materias
primas del tabule directamente, en vez de stock de tabule (que se iría a
negativo). Sin duplicar ingredientes en cada receta.

**Fase A (esta entrega — SIN tocar runtime):** `src/lib/inventory/direct-discharge.ts`,
función pura `expandDirectDischarge(ingredients, directMap)` con 11 tests:
- Explota los ingredientes cuyo item es una sub-receta de descarga directa en
  sus insumos, proporcional (ratio = cantidad usada ÷ rendimiento base) y
  recursivo, con conversión de unidades (§109.1 / qtyToBaseUnit).
- Guardas: anti-ciclo (A→B→A), tope de profundidad (MAX_DIRECT_DEPTH=6),
  rendimiento inválido → fallback legacy, cantidades no positivas intactas.
- **PROPIEDAD DE SEGURIDAD:** map vacío → salida idéntica a la entrada. Los 4
  caminos de descargo podrán envolverse con esto y, sin flags activos, el
  comportamiento es exactamente el actual.
- Ningún archivo de runtime lo importa aún (verificado).

PENDIENTE (con local cerrado): Fase B (flag `directDischarge` en Recipe +
migración aditiva + toggle en la ficha de sub-receta) y Fase C (integrar el
helper en los 4 caminos: registerInventoryForCartItems, applyItemInventoryInTx,
voidSalesOrderAction/restoreRecipe, computeConsumptionFromOrders — un solo
commit, con el flag default OFF → cero cambio para datos existentes).

Gates: tsc 0 · vitest 641.

## §124 Fase C — Descarga directa integrada en los 5 caminos de descargo (2026-07-19)

Conecta el helper `expandDirectDischarge` (Fase A) leyendo el flag
`Recipe.directDischarge` (Fase B) vía `loadDirectDischargeMap` (cargador
server-only con fixpoint para anidamiento). Integrado en LOS 5 caminos que
mueven inventario por venta (la auditoría encontró 5, no 4):

1. `registerInventoryForCartItems` (pos.actions) — venta POS mesa/pickup/delivery.
2. `applyItemInventoryInTx` (pos.actions) — ajuste/reversión de ítem de mesa
   (RESTORE y DEDUCT expanden igual → espejo exacto).
3. `restoreRecipe` en `voidSalesOrderAction` (void.actions) — anulación de orden.
4. `computeConsumptionFromOrders` (consumption.ts, param directMap) — consumo
   teórico; 2 callers en inventory-daily construyen el mapa. SIN se aplica ANTES
   de expandir.
5. `createSalesEntryAction` (sales-entry) — carga manual de ventas.

**SEGURIDAD:** cada camino carga el mapa y solo expande si `size > 0`. Con el
flag apagado en todas las sub-recetas (default), el mapa es vacío y el descargo
es BYTE-idéntico al actual. Reversibilidad: apagar el flag del tabule vuelve al
descargo legacy sin migración ni tocar datos.

**Caveat operativo:** el flag se lee en tiempo de operación. No prender/apagar
con órdenes abiertas sin cobrar/anular de por medio (venta en un modo + anulación
en el otro descuadraría stock — mismo caso que editar una receta entre venta y
anulación). Activar el tabule una vez y dejarlo.

Tests nuevos: direct-discharge (11) + consumption directo (3). Gates: tsc 0 · vitest 649.

## §125 Submódulo propio "Sub-recetas" en el sidebar (2026-07-19)

Pedido de Omar: en vez de una pestaña dentro de Producción (§120), tener las
sub-recetas como submódulo propio en el menú lateral, justo debajo de Recetas.

- Registro: módulo `subrecetas` (section operations, sortOrder 61, href
  /dashboard/subrecetas) + permisos [OWNER, AUDITOR, ADMIN_MANAGER,
  OPS_MANAGER, CHEF] (igual que recipes).
- Sidebar: `subrecetas` insertado después de `recipes` en el subgrupo
  Producción. Icono `Layers`.
- Página `/dashboard/subrecetas` reutiliza el componente SubRecetasTab
  (lista SUB_RECIPE con RecipeList lockedType + buscador + "Nueva sub-receta").
- Se removió la pestaña "Sub-recetas" de dentro de Producción (queda en un
  solo lugar, "afuera").

UI pura, sin cambios de BD. tsc 0 · vitest 649.

## §126 Flujo Menú↔Receta sin viajes — "es lento ese proceso" (2026-07-20)

**Queja del gerente:** editar la receta de un plato desde el catálogo lo
redirigía al módulo Recetas y, al guardar, caía en la lista de Recetas —
tenía que navegar de vuelta Catálogo→Menú y re-buscar el plato cada vez.

**Fix (UI pura, sin BD):**
- Los badges del catálogo ("Receta lista"/"Receta vacía") y la creación de
  receta nueva van al EDITOR con `?volver=menu`.
- `RecipeForm` acepta `returnTo: 'menu'`: la flecha de volver se convierte en
  botón "← Volver al Menú", y al GUARDAR hace router.push('/dashboard/menu')
  en vez de caer en Recetas. Sin el parámetro, el comportamiento histórico
  queda intacto (Recetas → detalle/lista, como siempre).
- El buscador del catálogo persiste en sessionStorage (`menu:searchTerm`,
  restaurado en useEffect post-montaje — sin hydration mismatch): al volver
  de editar, el filtro sigue donde estaba.

Ciclo resultante: Menú → clic en badge → editar → Guardar → Menú (con el
mismo filtro de búsqueda). Cero navegación manual entre módulos.

Gates: tsc 0 · vitest 649.

## §126.1 Recetas sin el toggle de sub-recetas (2026-07-20)

Omar: "sub-recetas me sigue apareciendo dentro de Recetas en una pestaña; si
ya lo sacamos a un submódulo no tiene sentido que siga ahí".

- /dashboard/recetas ahora pasa lockedType="FINISHED_GOOD" a RecipeList con la
  lista pre-filtrada a productos del menú → el toggle Todas/Sub-recetas/
  Productos desaparece de Recetas. Header dice "N recetas de platos del menú".
- "Nueva Receta" de esa página abre el form con tipo Producto Final
  preseleccionado (?tipo=FINISHED_GOOD).
- Las sub-recetas se gestionan SOLO en /dashboard/subrecetas (§125).
- Nota: las recetas técnicas de reventa (output RAW_MATERIAL) ya no son
  visibles en ninguna lista (antes solo bajo "Todas") — deliberado: son 1:1
  auto-gestionadas desde Menú y no deben editarse.

UI pura. tsc 0 · vitest 649.

## §127 Alias de unidades — "el pan está en unidades y me lo pone en kilos" (2026-07-20)

**Reporte del gerente:** el pan de shawarma (contado por unidades) al agregarse
a una receta mostraba "Kilogramos" en el selector; otros insumos sí salían bien.

**Causa:** el insumo tenía baseUnit NO canónica (ej. 'UND'/'UNIDADES' en vez de
'UNIT'). La tabla UNIT_FAMILIES no la reconocía → el selector ofrecía TODAS las
unidades y, como el value del <select> no estaba entre las opciones, el browser
mostraba la primera: KG. (Guardar era seguro — el safeUnit caía a la baseUnit —
pero la UI confundía y permitía elegir unidades de otra familia.)

**Fix (§127):**
- `normalizeUnitCode()` en unit-conversion.ts: alias español→canónico (UND/
  UNIDAD/UNIDADES/PZ→UNIT, GR/GRS→G, LT/LTS→L, KILOS→KG, CC→ML, DOCENA→DOZEN,
  PORCIÓN→PORTION…). Alias son 1:1 con su canónico → normalizar nunca cambia
  cantidades.
- `qtyToBaseUnit` normaliza ambos lados antes de comparar/convertir (ahora
  "200 GR" de un item en KG sí convierte a 0.2 KG; antes quedaba identidad).
- RecipeForm: familia/auto-fill/hint del selector usan la unidad normalizada.
  Fallback endurecido: unidad realmente desconocida → selector FIJO en ella
  (antes ofrecía todas, incluido KG).

Gates: tsc 0 · vitest 649 (8 tests nuevos de alias).

## §128 Buscador en el submódulo Modificadores (2026-07-20)

Pedido de Omar: el submódulo Catálogo → Modificadores no tenía búsqueda.

- Buscador arriba de la lista: filtra por nombre del GRUPO, nombre de sus
  OPCIONES y nombre de los PLATOS donde aplica (ej. "shawarma" muestra todos
  los grupos vinculados a shawarmas). Contador "N de M grupos" + empty-state.
- Detalle técnico clave: los handlers del componente editan por ÍNDICE de
  localGroups → el buscador solo OCULTA con `return null` dentro del map
  original, nunca re-indexa la lista (filtrar con .filter() habría hecho que
  editar/borrar tocara el grupo equivocado).

UI pura, sin BD. tsc 0 · vitest 649.
