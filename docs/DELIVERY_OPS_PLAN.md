# Plan de Implementación — Módulo "Gestión de Deliverys" (`delivery_ops`)

> **Estado:** propuesta v1 para revisión. NO implementado todavía.
> **Rama de trabajo:** `claude/loving-shannon-bsnyin`
> **Spec origen:** "KPSULA · Módulo Gestión de Deliverys — Especificación v1".
> **Documento vivo:** al construir cada fase, mover lo aplicado a `OPUS_CONTEXT_CAPSULA.md` (regla de CLAUDE.md).

---

## 0. Decisiones ya tomadas (no re-litigar)

| Decisión | Resolución | Implicación |
|---|---|---|
| **Modelo de orden** | `DeliveryOrder` **separado** de `SalesOrder` | Máquina de estados propia; no hereda los constraints del POS (cajera NOT NULL, areaId, etc.) |
| **Integración contable** | **MÓDULO AISLADO** | El delivery **NO** entra al Report Z, NI al historial de ventas (§20), NI descarga inventario. Cero acoplamiento con `SalesOrder`, `withTenant` de ventas, ni el outbox de descargo. La contabilidad del delivery (si se quiere) se lleva aparte y se decide en una fase futura. |
| **Sede** | `Branch` (ya existe) + side-table `BranchDeliveryConfig` | No se engorda `Branch` (lo comparte el POS restaurante de todos los tenants) |
| **Zonas de cobertura** | Modelo nuevo `DeliveryZone` | NO reusar `ServiceZone` (esa es DINING/BAR/VIP físico) |
| **API-key por tenant** | env JSON `DELIVERY_API_KEYS` para el piloto | Mismo patrón que `PRINT_AGENT_TENANT_KEYS`. Migrar a key hasheada en BD cuando haya más tenants |
| **Impresión** | Reusar el **Print Agent existente** (§39) | Validar pago → encolar `PrintJob`. La "Opción A" (kiosk Chrome) queda descartada |
| **Feature flag** | `deliveryOps` (camelCase) | La spec lo llamaba `delivery_ops`; se normaliza a la convención de `FEATURE_FLAGS` |

---

## 1. Principio rector (aterrizado en KPSULA)

**Lo determinístico vive en KPSULA; la IA solo conversa y estructura.**

- **KPSULA** (este módulo): correlativos, asignación de sede, estados, impresión (vía Print Agent), asignación de motorizado, contexto para el bot.
- **n8n**: orquesta canal ↔ IA ↔ KPSULA. Consume la API REST nueva.
- **IA**: conversa y produce la comanda JSON. Nada más.

Como el módulo es **aislado**, su superficie de contacto con el resto del ERP se limita a **lecturas** de datos que ya existen:
- `Branch` (sedes), `Customer` (identidad por teléfono, best-effort), `ExchangeRate` (tasa Bs), `MenuItem` (para "agotados", opcional), `PrintJob` (cola de impresión), `Tenant.featureFlags` (gate).

No escribe en `SalesOrder`, `InventoryMovement`, ni en las superficies de §20.

---

## 2. Modelo de datos (Prisma)

Todos los modelos nuevos son **multi-tenant** (`tenantId` + relación a `Tenant`) y **aditivos** (migraciones safe en producción viva, §44: solo `CREATE TABLE` / `ADD COLUMN NULLABLE`).

> Tras crearlos, agregar cada modelo nuevo al set `TENANT_MODELS` de `src/lib/prisma-tenant-client.ts` para que `withTenant()` los aísle automáticamente. Y sumar las relaciones inversas al modelo `Tenant`.

### 2.1 `DeliveryTenantConfig` — config + contador de correlativos

```prisma
model DeliveryTenantConfig {
  id                String  @id @default(cuid())
  tenantId          String  @unique
  tenant            Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  correlativePrefix String  @default("PP")     // "PP-00127"
  nextCorrelative   Int     @default(1)         // contador atómico (ver §4.2)
  validationMode    String  @default("MANUAL")  // MANUAL | AUTO (antifraude: arrancar MANUAL)
  webhookUrl        String?                      // destino de webhooks salientes a n8n
  schedule          Json?                        // horarios de atención por sede/global
  isActive          Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

> El **secreto HMAC** de los webhooks NO va en BD: vive en env (`DELIVERY_WEBHOOK_SECRET` o por-tenant en `DELIVERY_API_KEYS`). La **tasa Bs** NO se duplica acá: se lee del modelo `ExchangeRate` ya existente.

### 2.2 `BranchDeliveryConfig` — config de delivery por sede (1:1 con Branch)

```prisma
model BranchDeliveryConfig {
  id             String  @id @default(cuid())
  tenantId       String
  tenant         Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branchId       String  @unique
  branch         Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)

  lat            Float?
  lon            Float?
  printerStation String?  // string `station` que consume el Print Agent
  whatsappGroup  String?  // id/nombre del grupo de motorizados (Evolution API)
  managerUserId  String?  // gerente responsable de la sede
  managerUser    User?    @relation("BranchManager", fields: [managerUserId], references: [id], onDelete: SetNull)
  isActive       Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  zones DeliveryZone[]

  @@index([tenantId])
}
```

### 2.3 `DeliveryZone` — zonas de cobertura geográficas

```prisma
model DeliveryZone {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  name      String   // "El Hatillo", "La Lagunita", "Macaracuay"
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([branchId, name])
  @@index([tenantId])
}
```

### 2.4 `DeliveryDriver` — motorizados

```prisma
model DeliveryDriver {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branchId  String?
  branch    Branch?  @relation(fields: [branchId], references: [id], onDelete: SetNull)
  name      String
  phone     String
  status    String   @default("AVAILABLE") // AVAILABLE | ON_ROUTE | OFFLINE
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orders DeliveryOrder[]

  @@index([tenantId])
  @@index([branchId, status])
}
```

### 2.5 `DeliveryOrder` — la orden (entidad central)

```prisma
model DeliveryOrder {
  id          String  @id @default(cuid())
  tenantId    String
  tenant      Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  correlative String  // "PP-00127" — único por tenant

  branchId    String?         // sede asignada (null hasta resolver)
  branch      Branch?         @relation(fields: [branchId], references: [id], onDelete: SetNull)

  // Canal / origen (del bot)
  channel     String          // telegram | whatsapp
  chatId      String?

  // Cliente (best-effort, sin contaminar stats POS del Customer)
  customerId      String?
  customer        Customer?   @relation(fields: [customerId], references: [id], onDelete: SetNull)
  customerName    String?
  customerPhone   String?
  deliveryAddress String?
  deliveryRef     String?     // punto de referencia
  lat             Float?
  lon             Float?

  // Comanda y montos (INFORMATIVOS — no contables)
  comanda      Json           // el JSON que emite el bot
  totalUsd     Float?
  totalBs      Float?
  exchangeRate Float?

  // Estado (máquina de estados §3)
  status       String @default("ESPERANDO_PAGO")
  // ESPERANDO_PAGO | PAGO_POR_VALIDAR | EN_COCINA | LISTA | EN_CAMINO | ENTREGADA | CANCELADA

  // Idempotencia (§4.2)
  itemsHash    String?

  // Comprobante de pago
  paymentProofPath String?
  paymentProofType String?    // billetes | pago_movil | transferencia
  paymentValidatedById String?
  paymentValidatedBy   User?  @relation("DeliveryPaymentValidator", fields: [paymentValidatedById], references: [id], onDelete: SetNull)
  paymentValidatedAt   DateTime?

  // Motorizado
  driverId   String?
  driver     DeliveryDriver? @relation(fields: [driverId], references: [id], onDelete: SetNull)
  assignedAt DateTime?

  // Cancelación
  cancelReason  String?
  cancelledById String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  events DeliveryOrderEvent[]

  @@unique([tenantId, correlative])
  @@index([tenantId, status, createdAt])
  @@index([tenantId, channel, chatId])
  @@index([branchId, status])
  @@index([tenantId, customerPhone])
}
```

### 2.6 `DeliveryOrderEvent` — auditoría de transiciones (métricas de tiempos gratis)

```prisma
model DeliveryOrderEvent {
  id        String   @id @default(cuid())
  orderId   String
  order     DeliveryOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fromState String?
  toState   String
  userId    String?  // null = lo hizo n8n/bot
  note      String?
  createdAt DateTime @default(now())

  @@index([orderId, createdAt])
}
```

### 2.7 `ItemAvailability` — agotados / falta de stock (toggle por sede)

```prisma
model ItemAvailability {
  id         String   @id @default(cuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branchId   String
  branch     Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  menuItemId String?  // si referencia un MenuItem real
  menuItem   MenuItem? @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  itemLabel  String   // texto libre fallback ("Pepsi de lata")
  available  Boolean  @default(true)
  updatedById String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([branchId, menuItemId])
  @@index([tenantId, branchId, available])
}
```

### 2.8 `ManagerNote` — notas de texto libre del gerente

```prisma
model ManagerNote {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  branchId    String?  // null = global
  branch      Branch?  @relation(fields: [branchId], references: [id], onDelete: Cascade)
  text        String
  isActive    Boolean  @default(true)
  expiresAt   DateTime? // vigencia (notas viejas dejan de inyectarse)
  createdById String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, isActive])
}
```

### 2.9 `RoutingRule` — reglas de ruteo producto → sede

```prisma
model RoutingRule {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  matchProduct String   // si_incluye_producto (substring/keyword del item)
  branchId     String   // enviar_a_sede_id
  branch       Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  priority     Int      @default(0)
  isActive     Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, isActive])
}
```

### 2.10 `DeliveryWebhookOutbox` — entrega confiable de webhooks salientes

```prisma
model DeliveryWebhookOutbox {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  event     String   // orden.en_cocina | orden.lista | orden.en_camino | orden.entregada
  payload   Json
  status    String   @default("PENDING") // PENDING | SENT | FAILED
  attempts  Int      @default(0)
  lastError String?

  createdAt DateTime @default(now())
  sentAt    DateTime?

  @@index([tenantId, status, createdAt])
}
```

> **Patrón outbox** reusado de §18.40/18.41 (cron de reintentos): KPSULA persiste el evento y un cron lo entrega a n8n con reintentos + firma HMAC. No fire-and-forget.

### 2.11 Reuso del Print Agent (sin modelo nuevo)

`PrintJobType` (enum existente) suma un valor: `DELIVERY`. Al validar pago, se encola un `PrintJob`:

```ts
prisma.printJob.create({ data: {
  tenantId, type: 'DELIVERY',
  station: branchDeliveryConfig.printerStation, // 1 agent por sede filtra por station
  payload: { /* comanda térmica: correlativo grande, sede, hora, cliente+tel, items+personalizaciones, dirección+ref, estado pago, notas */ },
}});
```

---

## 3. Máquina de estados

```
ESPERANDO_PAGO → PAGO_POR_VALIDAR → EN_COCINA → LISTA → EN_CAMINO → ENTREGADA
                                                          (CANCELADA: desde cualquier estado)
```

| Estado | Quién lo dispara | Efecto lateral |
|---|---|---|
| `ESPERANDO_PAGO` | `POST /ordenes` (bot vía n8n) | **Asigna correlativo + sede**. Visible en tablero para perseguir pagos |
| `PAGO_POR_VALIDAR` | `POST /ordenes/{id}/comprobante` | Adjunta archivo del comprobante |
| `EN_COCINA` | Supervisor valida (1 clic) **o** auto si `validationMode=AUTO` | 🖨️ Encola `PrintJob` → imprime en la sede. Dispara webhook `orden.en_cocina` |
| `LISTA` | Gerente de la sede | Webhook `orden.lista` |
| `EN_CAMINO` | `POST /ordenes/{id}/motorizado` | Webhook `orden.en_camino` |
| `ENTREGADA` | Cierre (UI o n8n) | Webhook `orden.entregada` |
| `CANCELADA` | Desde cualquier estado | `cancelReason` obligatorio |

Cada transición pasa por una **función pura `canTransition(from, to)`** (testeable, sin BD) y registra un `DeliveryOrderEvent` con timestamp + usuario → métricas de tiempo por etapa.

**Aislamiento:** ninguna transición toca inventario ni crea `SalesOrder`. `ENTREGADA` es un cierre puramente logístico.

---

## 4. API REST que consume n8n

```
Base: https://kpsula.app/api/v1/delivery
Auth: X-API-Key: <key del tenant>   (resuelve tenantId; X-Tenant-Id se ignora)
```

> **Namespace nuevo versionado** `/api/v1/delivery/*` (las rutas actuales son `/api/*` sin versión). Auth vía helper nuevo `authenticateDeliveryApi(req)`, clon de `authenticatePrintAgent` pero con header `X-API-Key` y env `DELIVERY_API_KEYS` (`{ "<tenantId>": "<key>" }`), compare en tiempo constante.

### 4.1 `GET /contexto`
Reemplaza las variables manuales `{AGOTADOS_HOY}`, `{TASA_BS_DIA}`, `{NOTAS_GERENTE}` del prompt. Devuelve:

```json
{
  "sedes": [{ "id": "...", "nombre": "El Hatillo", "zonas": ["El Hatillo","La Lagunita"], "lat": 10.42, "lon": -66.82 }],
  "agotados": [{ "sede_id": "...", "item": "Pepsi de lata" }],
  "tasa_bs": 168.50,
  "notas_gerente": [{ "sede_id": "...", "texto": "Hoy +15 min por lluvia", "vigencia": "2026-06-06" }],
  "reglas_ruteo": [{ "si_incluye_producto": "Sushi especial", "enviar_a_sede_id": "..." }]
}
```
Fuentes: `BranchDeliveryConfig`+`DeliveryZone` (sedes), `ItemAvailability` (agotados), `ExchangeRate` (tasa), `ManagerNote` no expiradas (notas), `RoutingRule` activas (ruteo).

### 4.2 `POST /ordenes`
Crea la orden. Body: `{ "canal": "telegram", "chat_id": "123456", "comanda": { ... } }`
Respuesta `201`: `{ "orden_id", "correlativo": "PP-00127", "sede_asignada": {...}, "estado": "ESPERANDO_PAGO" }`

**Reglas:**
- **Asignación de sede** (orden de precedencia explícito):
  1. `RoutingRule` (si la comanda incluye un producto con regla → gana).
  2. GPS (sede más cercana —haversine— **con el ítem disponible**).
  3. Zona por texto en la dirección (`DeliveryZone.name` ⊂ dirección).
  4. Fallback configurable (sede default) si nada matchea.
- **Correlativo atómico:** `DeliveryTenantConfig.nextCorrelative` se incrementa dentro de una **transacción** (`SELECT ... FOR UPDATE` / update atómico) para evitar duplicados bajo POSTs concurrentes del bot. Sin huecos, persistido en BD (lección §18.19).
- **Idempotencia:** `itemsHash = sha256(canal + chat_id + JSON normalizado de items)`. Mismo hash + mismo `chat_id` en < 10 min → devuelve la orden existente (mata duplicados tipo PP-00126 de las pruebas).

### 4.3 `POST /ordenes/{id}/comprobante`
Multipart: `file` + `tipo` (`billetes | pago_movil | transferencia`) → estado `PAGO_POR_VALIDAR`.
- Reusa el storage de `/api/upload` + `/api/files` (uploads seguros tenant-scoped §43.2) **pero** con auth máquina (X-API-Key), no sesión. → path de upload nuevo o branch de auth en el handler existente.

### 4.4 `PATCH /ordenes/{id}`
`{ "estado": "..." }` con validación de transiciones (`canTransition`). Lo usa la UI y, opcionalmente, n8n.

### 4.5 `POST /ordenes/{id}/motorizado`
`{ "motorizado_id": "..." }` → estado `EN_CAMINO`, setea `driverId` + `assignedAt`, pone el driver en `ON_ROUTE`.

---

## 5. Webhooks salientes (KPSULA → n8n)

```
POST <DeliveryTenantConfig.webhookUrl>   (ej. https://n8n.omiaagency.com/webhook/kpsula)
Header: X-Kpsula-Signature: <HMAC-SHA256(body, DELIVERY_WEBHOOK_SECRET)>
Body:   { "evento": "orden.en_cocina|orden.lista|orden.en_camino|orden.entregada", "orden": { ... } }
```
Implementación: la transición escribe en `DeliveryWebhookOutbox` (estado PENDING). Un **cron** (`/api/cron/deliver-webhooks`, mismo patrón que `/api/cron/retry-inventory-deductions`) los entrega con reintentos y firma HMAC, marca SENT/FAILED.

---

## 6. Impresión automática por sede (reuso Print Agent)

- Al pasar a `EN_COCINA` → `PrintJob(type=DELIVERY, station=printerStation)`.
- **1 Print Agent por PC de sede**, cada uno con su key (`PRINT_AGENT_TENANT_KEYS`) y filtrando por su `station`.
- **Mejora necesaria:** agregar `?station=X` al `GET /api/print-agent/jobs` (hoy filtra solo por tenant+status) para que cada agent reclame solo lo suyo.
- Plantilla térmica 80 mm: correlativo grande, sede, hora, cliente+teléfono, ítems con personalizaciones, dirección+referencia, estado del pago, notas.

---

## 7. Submódulos UI (Minimal Navy — CLAUDE.md)

Todos bajo `/dashboard/delivery/*`, sección `admin` del registry (no existe "otros"; ver §9). UI con tokens `capsula-*`, iconos `lucide-react`, helpers `pos-*`, dark-mode, modales estándar §7 de CLAUDE.md.

| Submódulo | Ruta | Contenido |
|---|---|---|
| **Centro de operaciones** | `/dashboard/delivery` | Tablero kanban por estado + filtro por sede; detalle con comprobante (visor de imagen); validar/cancelar/reimprimir |
| **Agotados** | `/dashboard/delivery/agotados` | Toggle on/off por (sede, ítem) — `ItemAvailability` |
| **Motorizados** | `/dashboard/delivery/motorizados` | CRUD `DeliveryDriver` |
| **Sedes** | `/dashboard/delivery/sedes` | `BranchDeliveryConfig` + `DeliveryZone` (lat/lon, impresora, grupo WA, gerente, zonas) |
| **Clientes** | `/dashboard/delivery/clientes` | Lista por teléfono + historial de `DeliveryOrder` (sin tocar stats POS de `Customer`) |
| **Promociones** | (fase posterior) | El bot las leerá del contexto (reusa módulo Promociones existente) |
| **Config** | `/dashboard/delivery/config` | `DeliveryTenantConfig`: tasa (link a ExchangeRate), horarios, `validationMode`, prefijo, webhookUrl |

Icono del módulo en `src/lib/module-icons.ts`: `Bike` o `Truck` (lucide).

---

## 8. Polling del tablero
El tablero usa el patrón de auto-polling cada ~5s ya establecido para layouts POS (§18.34) — no WebSocket.

---

## 9. Feature flag + visibilidad del módulo (plomería nueva)

1. Agregar `deliveryOps` al catálogo `FEATURE_FLAGS` (`src/lib/feature-flags.ts`).
2. **Gate de visibilidad:** hoy el registry gatea por `enabledByDefault` + `ENABLED_MODULES` + `MODULE_ROLE_ACCESS`, **no** por `Tenant.featureFlags`. Hay que enseñarle al resolver de módulos/sidebar a consultar `tenantFeatureEnabled(tenantId, 'deliveryOps')` y ocultar el módulo si está apagado. Esto es **nuevo** y vale para futuros módulos flag-gated.
3. Endpoints `/api/v1/delivery/*` chequean el flag además de la API-key (si el tenant no tiene `deliveryOps`, 403).

---

## 10. Permisos y roles

Permisos nuevos (4-layer, §3.3/§18.36): `VIEW_DELIVERY`, `MANAGE_DELIVERY`, `VALIDATE_DELIVERY_PAYMENT`, `MANAGE_DELIVERY_CONFIG`.

⚠️ **Gap real — alcance por sede.** La spec pide que "cada gerente edite agotados/notas **de su sede**". El RBAC actual es rol+módulo+**tenant**; **no** scope por sede. Opciones:
- **(A) Piloto simple:** cualquier usuario con `MANAGE_DELIVERY` edita todas las sedes. Suficiente si Poke Pok opera con un solo gerente/operador central. **(Recomendado para Fase 1–3.)**
- **(B) Scope por sede:** usar `BranchDeliveryConfig.managerUserId` + helper `assertBranchScope(user, branchId)` en las server actions. Es una dimensión nueva de permisos → construir en **Fase 4**.

---

## 11. Migraciones (orden y seguridad §44)

Todo es **safe en producción viva** (solo `CREATE TABLE` + `ADD COLUMN NULLABLE`):
- `prisma migrate dev --name add_delivery_ops_models` (los 10 modelos + enum value `DELIVERY` en `PrintJobType`).
- Verificar que `prisma/migrations/<ts>_add_delivery_ops_models/migration.sql` queda commiteado (regla §9 de CLAUDE.md).
- Post-deploy: `npx prisma migrate status` → "Database schema is up to date!".
- El `scripts/deploy-vps.sh` ya corre `migrate deploy` en cada deploy (§44).

---

## 12. Variables de entorno nuevas

```
DELIVERY_API_KEYS={"tnt_pokepok":"<key>"}       # X-API-Key → tenantId (n8n)
DELIVERY_WEBHOOK_SECRET=<secreto HMAC>           # firma de webhooks salientes
PRINT_AGENT_TENANT_KEYS=...                       # ya existe; 1 entry por PC de sede
```

---

## 13. Datos seed faltantes (bloquean Fase 1 real de Poke Pok)

- **Sedes Poke Pok:** Santa Fe · El Hatillo · San Luis · Los Palos Grandes → crear `Branch` + `BranchDeliveryConfig`.
- **Por cada sede falta:** `lat/lon`, **zonas que cubre**, `printerStation`, grupo WhatsApp, gerente.
- **`DeliveryTenantConfig`:** prefijo `PP`, `validationMode=MANUAL`.

Sin coords → la asignación por GPS no opera; arranca solo por zona/ruteo. (La spec ya lo advierte.)

---

## 14. Testing (gates CLAUDE.md: `tsc` limpio + `vitest`)

Funciones puras testeables sin BD:
- `canTransition(from, to)` — máquina de estados.
- `assignBranch(comanda, addr, gps, rules, zones, availability)` — precedencia de sede.
- `computeItemsHash(...)` + ventana de idempotencia.
- `hmacSign(body, secret)` — firma de webhooks.
- `buildDeliveryContext(...)` — shape de `GET /contexto`.

---

## 15. Plan por fases (mapeado a la spec §8)

| Fase | Entregable | Modelos / archivos clave |
|---|---|---|
| **1** | Sedes + Órdenes + estados + `POST /ordenes` + `GET /contexto` + tablero básico | `DeliveryOrder`, `DeliveryOrderEvent`, `BranchDeliveryConfig`, `DeliveryZone`, `DeliveryTenantConfig`; `authenticateDeliveryApi`; `/api/v1/delivery/{contexto,ordenes}`; `/dashboard/delivery` (tablero); flag `deliveryOps` + gate de visibilidad |
| **2** | Comprobantes + validación 1-clic + impresión | `POST /ordenes/{id}/comprobante`, upload máquina, `PATCH`, enum `DELIVERY` en `PrintJobType`, `?station=` en print-agent jobs, plantilla térmica |
| **3** | Motorizados + webhooks salientes + notificación al cliente | `DeliveryDriver`, `POST /ordenes/{id}/motorizado`, `DeliveryWebhookOutbox` + cron `/api/cron/deliver-webhooks` + HMAC |
| **4** | Agotados + tasa/config desde UI + Clientes + (permiso por sede opción B) | `ItemAvailability`, `/dashboard/delivery/{agotados,clientes,config}`, scope por sede |
| **4.5** | Instrucciones dinámicas del gerente | `ManagerNote` + `RoutingRule` + sus vistas; aplicar ruteo en `POST /ordenes`; inyección en `/contexto` con guardas (notas aditivas, nunca anulan Reglas de oro) |

---

## 16. Resumen de archivos a crear/tocar (referencia)

**Nuevos:**
- `prisma/schema.prisma` (+10 modelos, +1 enum value) → migración.
- `src/lib/delivery/` → `auth.ts`, `state-machine.ts`, `assign-branch.ts`, `idempotency.ts`, `context.ts`, `webhook-sign.ts` (+ tests).
- `src/app/api/v1/delivery/contexto/route.ts`, `.../ordenes/route.ts`, `.../ordenes/[id]/route.ts`, `.../ordenes/[id]/comprobante/route.ts`, `.../ordenes/[id]/motorizado/route.ts`.
- `src/app/api/cron/deliver-webhooks/route.ts`.
- `src/app/dashboard/delivery/**` (7 submódulos + componentes Minimal Navy).
- `src/app/actions/delivery.actions.ts`.

**Tocados:**
- `src/lib/feature-flags.ts` (+`deliveryOps`).
- `src/lib/prisma-tenant-client.ts` (+nuevos modelos al `TENANT_MODELS`).
- `src/lib/constants/modules-registry.ts` (+entrada del módulo).
- `src/lib/module-icons.ts` (+icono).
- Resolver de módulos/sidebar (+gate por `tenantFeatureEnabled`).
- `src/app/api/print-agent/jobs/route.ts` (+filtro `?station=`).
- `OPUS_CONTEXT_CAPSULA.md` (+sección nueva, al cerrar cada fase).

---

## 17. Decisiones abiertas que aún necesitan tu input

1. **Permiso por sede:** ¿opción (A) simple para el piloto o (B) scope por sede desde ya? (recomiendo A → B en Fase 4).
2. **Clientes:** ¿linkear `DeliveryOrder.customerId` al `Customer` existente (dedup por teléfono) **sin** tocar sus stats POS, o mantener el delivery 100% desacoplado del CRM? (recomiendo link best-effort sin tocar stats).
3. **Prefijo/horarios:** ¿prefijo de correlativo siempre por tenant (`PP`) o por sede? ¿Horarios globales o por sede?
4. **Auto-validación:** confirmar que arrancamos en `MANUAL` (antifraude). El modo `AUTO` queda como toggle de config.
5. **Coords y zonas reales** de las 4 sedes Poke Pok (bloquea el seed de Fase 1 productiva).
```
