# Documento de Contexto — Shanklish ERP para OPUS 4.6
## Proyecto Cápsula SaaS — Sistema de Configuración por Plantillas

---

## 1. ¿Qué es el sistema?

**Shanklish ERP** es un sistema POS + ERP para restaurantes construido con
Next.js 14 (App Router), Prisma ORM y PostgreSQL.

Actualmente existe en dos instancias paralelas:
- `shanklish-erp` — Restaurante Shanklish Caracas (producción activa)
- `table-pong` — Sala de juegos/bar (producción activa)

Cada instancia tiene su propia base de datos independiente. La visión a mediano
plazo es convertirlo en un SaaS multi-tenant llamado **Cápsula**.

---

## 2. Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend/Backend | Next.js 14 App Router, Server Actions, TypeScript |
| Base de datos | PostgreSQL + Prisma ORM |
| Autenticación | Sesiones propias (sin NextAuth) |
| UI | Tailwind CSS + componentes propios (sin shadcn) |
| Impresión | ESC/POS via WebUSB (tickets de cocina y caja) |

### Roles del sistema
```
OWNER, ADMIN_MANAGER, OPS_MANAGER,
CASHIER_RESTAURANT, CASHIER_DELIVERY,
WAITER, KITCHEN_CHEF, AUDITOR
```

---

## 3. Módulos activos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| POS Restaurante | `/dashboard/pos/restaurante` | Mesas, tabs abiertos, cobro mixto |
| POS Delivery | `/dashboard/pos/delivery` | Órdenes delivery/pickup |
| Control de Caja | `/dashboard/caja` | Apertura/cierre, múltiples cajeras |
| Historial Ventas | `/dashboard/sales` | Ventas, anulaciones, Reporte Z/Excel |
| Inventario | `/dashboard/inventory` | Recetas, descargo automático |
| Comandera | `/kitchen` | Vista cocina en tiempo real |
| Config | `/dashboard/config/*` | Módulos, roles, tasa cambio, POS settings |

---

## 4. Configuración actual en base de datos

```prisma
model SystemConfig {
  key       String   @id   // ej: 'enabled_modules', 'pos_stock_validation_enabled'
  value     String         // JSON string o texto plano
  updatedAt DateTime @updatedAt
  updatedBy String?        // userId quien lo cambió
}

model ExchangeRate {
  id            String   @id @default(cuid())
  rate          Float                          // Bs por 1 USD
  effectiveDate DateTime
  source        String   @default("BCV")
  createdAt     DateTime @default(now())
}

model Branch {
  id           String  @id @default(cuid())
  code         String  @unique
  name         String
  timezone     String  @default("America/Caracas")
  currencyCode String  @default("USD")
  isActive     Boolean @default(true)
  // Sin tenantId todavía
}
```

**Claves activas en SystemConfig:**
- `enabled_modules` — JSON array de módulos activos
- `pos_stock_validation_enabled` — "true" / "false"

---

## 5. Valores críticos HARDCODEADOS (candidatos a configuración)

```
ARCHIVO: src/app/actions/pos.actions.ts
  Línea 262: const DELIVERY_FEE_NORMAL = 4.5
  Línea 263: const DELIVERY_FEE_DIVISAS = 3
  Línea 64:  Tipos descuento: DIVISAS_33, CORTESIA_100, CORTESIA_PERCENT

ARCHIVO: src/app/dashboard/pos/restaurante/page.tsx
  Línea 695: const serviceFee = serviceFeeIncluded ? total * 0.1 : 0
  Línea 761: const svcFee = serviceFeeIncluded ? afterDiscount * 0.1 : 0

ARCHIVO: src/app/actions/sales.actions.ts
  Múltiples: * 0.1  (10% servicio en cálculos del Reporte Z)

ARCHIVO: src/components/pos/MixedPaymentSelector.tsx
  Línea 23-32: Array METHODS fijo con los métodos de pago
  Línea 35:    Set BS_METHODS fijo

ARCHIVO: src/app/dashboard/pos/restaurante/page.tsx
  Array SINGLE_PAY_METHODS fijo
  Set BS_SINGLE_METHODS fijo

ARCHIVO: src/app/dashboard/pos/delivery/page.tsx
  Array de métodos fijo en JSX
  Set BS_SINGLE_METHODS fijo
```

---

## 6. Objetivo: Sistema de configuración por plantillas

Crear un panel admin en `/dashboard/config/business` donde el OWNER pueda
personalizar el sistema sin tocar código. Cada instalación (cliente) puede
tener su propia configuración.

---

## 7. Prioridad 1 — Métodos de pago (CRUD completo)

### ¿Por qué CRUD y no toggle?
Cada cliente puede necesitar métodos distintos. Un restaurante en Venezuela
usa Zelle y Pago Móvil; uno en Colombia usaría Nequi y Daviplata; uno en
México usaría OXXO Pay. Con CRUD, el admin crea los métodos que necesita
sin que el desarrollador toque código.

### Modelo propuesto para PaymentMethod

```prisma
model PaymentMethod {
  id              String   @id @default(cuid())
  key             String   // identificador único ej: "ZELLE", "BINANCE", "NEQUI"
                           // único por tenant cuando se implemente multi-tenant
  label           String   // texto visible ej: "⚡ Zelle"
  emoji           String?  // opcional, separado del label
  isBsMethod      Boolean  @default(false)
                           // true = usuario ingresa Bs, sistema convierte a USD
  isDivisasMethod Boolean  @default(false)
                           // true = aplica descuento divisas (% configurable)
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  showInSinglePay Boolean  @default(true)
                           // aparece en botones de pago único del POS
  showInMixedPay  Boolean  @default(true)
                           // aparece en MixedPaymentSelector
  tenantId        String?  // NULL ahora, se usa cuando se implemente SaaS
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Datos seed (métodos actuales migrados a BD)

```typescript
const SEED_PAYMENT_METHODS = [
  { key: 'CASH_USD',       label: '💵 Cash $',         isBsMethod: false, isDivisasMethod: true,  sortOrder: 1 },
  { key: 'CASH_EUR',       label: '€ Cash €',           isBsMethod: false, isDivisasMethod: true,  sortOrder: 2 },
  { key: 'ZELLE',          label: '⚡ Zelle',           isBsMethod: false, isDivisasMethod: true,  sortOrder: 3 },
  { key: 'PDV_SHANKLISH',  label: '💳 PDV Shanklish',   isBsMethod: true,  isDivisasMethod: false, sortOrder: 4 },
  { key: 'PDV_SUPERFERRO', label: '💳 PDV Superferro',  isBsMethod: true,  isDivisasMethod: false, sortOrder: 5 },
  { key: 'MOVIL_NG',       label: '📱 Pago Móvil NG',   isBsMethod: true,  isDivisasMethod: false, sortOrder: 6 },
  { key: 'CASH_BS',        label: '💴 Efectivo Bs',     isBsMethod: true,  isDivisasMethod: false, sortOrder: 7 },
];
```

### Compatibilidad con datos históricos (CRÍTICO)
Los métodos legacy (`CASH`, `MOBILE_PAY`, `CARD`, `TRANSFER`) existen en
registros históricos de `SalesOrderPayment.method` y `SalesOrder.paymentMethod`.
El sistema debe tener un fallback de label para keys no reconocidas:

```typescript
function getPaymentLabel(key: string, methods: PaymentMethod[]): string {
  return methods.find(m => m.key === key)?.label ?? key; // fallback = key literal
}
```

### Archivos a refactorizar
1. `src/components/pos/MixedPaymentSelector.tsx` — cargar métodos desde prop en lugar de array fijo
2. `src/app/dashboard/pos/restaurante/page.tsx` — cargar métodos desde DB al montar
3. `src/app/dashboard/pos/delivery/page.tsx` — ídem
4. `src/app/actions/pos.actions.ts` — leer `isBsMethod` e `isDivisasMethod` desde BD
5. `src/app/actions/sales.actions.ts` — Reporte Z: agrupar por métodos dinámicos
6. `src/app/dashboard/sales/page.tsx` — Historial: labels dinámicos

---

## 8. Prioridad 2 — Fees y porcentajes

Almacenar en `SystemConfig` con claves específicas:

```
KEY                     DEFAULT   DESCRIPCIÓN
delivery_fee_normal     4.50      Tarifa delivery pago en Bs
delivery_fee_divisas    3.00      Tarifa delivery pago en divisas
service_charge_pct      10        % servicio mesas (0 = desactivado)
divisas_discount_pct    33.33     % descuento pago en divisas
```

---

## 9. Prioridad 3 — Tipos de descuento

Toggle + nombre personalizable por tipo:

```
DIVISAS_33      → habilitado/no, nombre configurable, % vinculado a divisas_discount_pct
CORTESIA_100    → habilitado/no, nombre configurable
CORTESIA_PERCENT→ habilitado/no, nombre configurable
```

---

## 10. Prioridad 4 — Canales de orden activos

Toggle de cuáles `orderType` están disponibles para este cliente:

```
RESTAURANT   ✅ siempre
DELIVERY     ✅/❌ configurable
PICKUP       ✅/❌ configurable
PEDIDOSYA    ✅/❌ configurable
WINK         ✅/❌ configurable
EVENTO       ✅/❌ configurable
TABLE_PONG   ✅/❌ configurable (módulo table pong)
```

---

## 11. Visión multi-tenant (diseñar pensando en ello, NO implementar ahora)

### Estado actual
- 1 BD por cliente (instancias separadas desplegadas individualmente)
- Sin `tenantId` en ningún modelo

### Objetivo mediano plazo: SaaS "Cápsula"
- Múltiples clientes en una sola BD
- Aislamiento total de datos por tenant
- El admin de cada tenant solo ve y modifica sus propios datos

### Restricción de diseño para esta implementación
Agregar `tenantId String?` (nullable) a:
- `PaymentMethod` (nuevo modelo)
- Cualquier otra tabla de configuración nueva

Esto permite que la migración futura sea simplemente:
```sql
UPDATE "PaymentMethod" SET "tenantId" = 'tenant_shanklish' WHERE "tenantId" IS NULL;
ALTER TABLE "PaymentMethod" ALTER COLUMN "tenantId" SET NOT NULL;
```
Sin reestructurar modelos.

---

## 12. Restricciones técnicas inamovibles

1. **BD solo aditiva**: Únicamente `ALTER TABLE ADD COLUMN` con valores DEFAULT o nullable.
   Nunca `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE` destructivo.

2. **Sin romper historial**: Keys de métodos legacy (`CASH`, `MOBILE_PAY`, `CARD`, `TRANSFER`)
   deben seguir mostrándose correctamente en historial aunque no existan en la nueva tabla.

3. **Server Actions**: Toda lógica de negocio en `src/app/actions/*.actions.ts`.
   Los componentes client-side llaman Server Actions, no APIs REST directas.

4. **Caching**: Los métodos de pago se usan en cada render del POS.
   Usar `unstable_cache` o pasar como prop desde Server Component para evitar
   consultas DB en cada interacción.

5. **Sin librerías nuevas** salvo que sean estrictamente necesarias y justificadas.

6. **TypeScript estricto**: Sin `any` salvo casos muy justificados.

---

## 13. Pregunta principal para OPUS

> Diseña la arquitectura completa para implementar el sistema de configuración
> por plantillas empezando por **métodos de pago (CRUD)**. Necesito:
>
> 1. El modelo Prisma definitivo para `PaymentMethod` con `tenantId` nullable
> 2. Las Server Actions necesarias: CRUD completo + lectura optimizada para POS
> 3. Cómo refactorizar `MixedPaymentSelector` y los POS para cargar métodos
>    desde BD en lugar del array hardcodeado, sin degradar el rendimiento
> 4. La UI del admin en `/dashboard/config/payment-methods` con CRUD completo
>    (crear, editar inline, reordenar por drag o flechas, activar/desactivar)
> 5. Cómo el Reporte Z y el Historial de Ventas se adaptan para métodos dinámicos
>    manteniendo compatibilidad con registros históricos
> 6. Estrategia de migración segura: convertir los métodos hardcodeados actuales
>    en registros seed en BD sin perder historial ni interrumpir producción
> 7. Estructura de carpetas y archivos recomendada para escalar este patrón
>    a las otras prioridades (fees, descuentos, canales)

---

*Generado el 2026-04-09 — Shanklish ERP v2.5*
