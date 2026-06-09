# Plan — Módulo Tesorería / Conciliación Bancaria

> Adaptación operacional (no contable) del Excel "SC Capital" del dueño a Kpsula.
> Arquitectura: **etiquetado + derivado**. Multi-tenant, dual-currency nativo.

---

## 0. Fundamentos confirmados (del análisis del Excel + código)

1. **La cuenta bancaria es el eje.** Por cada cuenta: *entra* venta PDV/PM, *sale* gasto/pago. Conciliación = (entra − sale) esperado vs estado de cuenta.
2. **Conciliación y comisiones producen gastos** (auto-posting): comisión bancaria + pérdida BCV → `Expense`.
3. **Crédito/contado = puente a Cuentas por Pagar.** `CONTADO` sale hoy; `CRÉDITO` = deuda.
4. **Moneda:** base USD; lo que nace en Bs se divide por tasa BCV. Kpsula guarda `amountBs` + `amountUsd` + `exchangeRate` en cada tabla de dinero → **superset del Excel** (no pierde el Bs).
5. **Pérdida BCV** = `Σ amountBS × (1/tasa_cobro − 1/tasa_liquidación)`, **solo cuentas Bs**.
6. **Semana fiscal:** Lun→Dom, mes por jueves (ISO), numerada S1–S5, con override manual.

---

## 1. Modelos Prisma nuevos

```prisma
model BankAccount {
  id          String   @id @default(cuid())
  name        String   // "PROVINCIAL NOUR", "SUPERFERRO", "BOFA"…
  bankName    String?  // "Banco Provincial", "Bank of America"
  currency    String   // BS | USD  → decide conversión y pérdida BCV
  kind        String   @default("BANK") // BANK | CASH | DIGITAL (Zelle)
  rif         String?
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  tenantId    String
  // relaciones inversas: terminals, reconciliations, adjustments
  @@unique([tenantId, name])
}

model PosTerminal {
  id              String  @id @default(cuid())
  label           String  // "PDV Superferro"
  terminalCode    String? // afiliación / serial
  bankAccountId   String  // dónde abona
  posMethodKey    String? // mapea al método del POS: PDV_SUPERFERRO, MOVIL_NG…
  commissionPct   Float   @default(0) // % comisión por defecto
  isActive        Boolean @default(true)
  tenantId        String
}

model BankReconciliation {
  id              String   @id @default(cuid())
  bankAccountId   String
  date            DateTime // día conciliado (truncado, TZ Caracas)
  fiscalWeek      String   // "S5 ABRIL" (override permitido)
  // Lado sistema (derivado y "congelado" al conciliar)
  expectedInBs    Float    @default(0) // ventas PDV/PM que entraron
  expectedOutBs   Float    @default(0) // gastos/pagos que salieron
  // Lado banco (tecleado del estado de cuenta)
  statementInBs   Float?
  statementOutBs  Float?
  // Comisión
  commissionCalc  Float    @default(0) // según Kpsula (% terminal)
  commissionStmt  Float?              // según estado de cuenta
  // Diferencial
  differentialBs  Float    @default(0)
  // Pérdida BCV (solo cuentas Bs)
  rateAtSettle    Float?              // tasa BCV del día de liquidación
  bcvLossUsd      Float?
  status          String   @default("OPEN") // OPEN | RECONCILED | DISCREPANCY
  postedExpenseId String?             // Expense auto-generado (comisión+BCV)
  notes           String?
  reconciledById  String?
  tenantId        String
  @@unique([tenantId, bankAccountId, date])
}

model BankAdjustment {
  id            String   @id @default(cuid())
  bankAccountId String
  date          DateTime
  fiscalWeek    String
  type          String   // PM_JURIDICO | TRASPASO | COMPRA_DIVISA | MANUAL
  direction     String   // IN | OUT
  amountBs      Float?
  amountUsd     Float?
  exchangeRate  Float?
  reference     String?
  notes         String?
  tenantId      String
}
```

**Etiquetado (columnas nullable — migración segura en prod viva):**
- `SalesOrderPayment.bankAccountId String?` — a qué cuenta liquidó (entrada)
- `Expense.bankAccountId String?` — de qué cuenta salió (salida)
- `AccountPayment.bankAccountId String?` — de qué cuenta se pagó la deuda

---

## 2. Helper `lib/fiscal-week.ts`

Determinístico, espejo del patrón `sales-where.ts` (TZ Caracas). Dada una fecha:
```ts
fiscalWeekOf(date): { month: number, week: 1..5, label: "S{n} {MES}" }
// regla: semana Lun→Dom; mes = el que contiene el jueves; numeración secuencial.
```
- Usado para agrupar reportes y para pre-llenar `fiscalWeek` (editable).
- Reportes de conciliación/comisiones agrupables por semana fiscal **igual que el Excel**.

---

## 3. Fases (cada una = su rama-commit, `tsc`+`vitest` verdes)

| # | Fase | Entrega | Riesgo |
|---|---|---|---|
| **0** | Cuentas bancarias | `BankAccount` + `PosTerminal` + etiquetado + seed real + CRUD admin + `fiscal-week.ts` | Bajo (aditivo) |
| **1** | Comisiones | % por terminal → cálculo del neto por cobro; reporte por cuenta/semana | Bajo |
| **2** | Conciliación | Pantalla diferencial (esperado auto vs estado de cuenta) + auto-posting comisión/BCV como `Expense` | Medio |
| **3** | Pérdida BCV + Compra $ | tasa liquidación → pérdida; registro de compra de divisas | Medio |
| **4** | Cuentas por Pagar/Cobrar | flag crédito desde Compras → deuda; "nos deben" (por cobrar) | Medio |

**Backfill clave en Fase 0:** garantizar que toda venta en Bs sea atribuible. Donde falte línea `SalesOrderPayment.amountBS`, derivar de `paymentMethod` + `exchangeRateValue` + `totalBs` de `SalesOrder`.

---

## 4. Pantallas

- **`/dashboard/admin/cuentas-bancarias`** — CRUD cuentas + terminales (moneda, % comisión).
- **`/dashboard/conciliacion`** — selector cuenta + rango/semana → tabla por día:
  `esperado (auto) | estado de cuenta (input) | comisión calc/banco | diferencial | pérdida BCV | [Conciliar]`.
  Botón "Conciliar" congela el esperado y auto-postea comisión + pérdida BCV.
- **Reporte semanal** (S1–S5) de comisiones y pérdida BCV por cuenta, exportable a Excel (ExcelJS, ya en uso).

---

## 5. Seguridad de migración

Todo aditivo: tablas nuevas + columnas nullable = "safe en producción viva" (§9 CLAUDE.md).
Sin `DROP`, sin `NOT NULL` sin default, sin `RENAME`. `migrate dev` genera SQL, commit del archivo.

---

## 6. Preguntas abiertas (a confirmar con el dueño)

1. **Factor `×1.0245`** en conversión de costos Bs→$: ¿IGTF 3%, IVA, o spread de tasa? Si es impuesto sistemático sobre Bs → modelarlo aparte, no enterrarlo.
2. **Lista y moneda de cuentas:** ¿NOUR/SUPERFERRO/SHANKLISH/CANUR/PITACHEF en Bs (Provincial) y BOFA en $? ¿Falta/sobra alguna?
3. **Semana fiscal:** ¿OK regla ISO (jueves) + override manual, o tiene una convención de borde distinta?
4. **Granularidad de pagos:** ¿hoy todos los cobros en Bs usan el flujo de "líneas de pago" o hay cajeros en flujos viejos (que no guardan `amountBS`)?
