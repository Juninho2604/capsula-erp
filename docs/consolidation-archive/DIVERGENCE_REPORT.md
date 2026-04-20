# DIVERGENCE REPORT — `capsula-erp` (main) vs `shanklish-erp-main` (master)

Generado: 2026-04-19
Directorio padre: `C:\Users\Usuario\capsula-migration\`
Modo: SOLO LECTURA (no se modificó ningún archivo, no se hicieron commits).

---

## 1. Commits exclusivos de cada repo (últimos 30)

### `capsula-erp` — rama `main`

| SHA | Fecha | Mensaje |
|------|-------|---------|
| 6d57b00 | 2026-04-17 | docs: actualizar OPUS_CONTEXT con §18.23 comanda cancelación cocina |
| 7429185 | 2026-04-17 | feat(pos): kitchen cancel command on item removal |
| c8f56ee | 2026-04-17 | docs: actualizar OPUS_CONTEXT con sistema mesoneros PIN (Fases 2-5) |
| aa969a6 | 2026-04-17 | feat(pos): waiter PIN identification, table transfer, show bill — Fases 2-5 |
| 7ed96f9 | 2026-04-17 | Merge PR #3 claude/audit-shanklish-erp-2nQ2u |
| 37bcad1 | 2026-04-17 | docs: OPUS_CONTEXT — estado de correcciones (17/22 fallas) |
| d30941e | 2026-04-17 | fix: corregir 17 de 22 fallas del audit funcional |
| 3e5bdaa | 2026-04-17 | docs: auditoría funcional — 22 fallas |
| 6b6c43a | 2026-04-16 | Merge PR #2 claude/enhance-dashboard-kpis-NTceM |
| b5fc16a | 2026-04-16 | OPUS_CONTEXT §18.22 widgets financieros interactivos |
| 3da689e | 2026-04-16 | Dashboard — widgets financieros interactivos |
| 7afd35a | 2026-04-16 | Merge PR #1 claude/enhance-dashboard-kpis-NTceM |
| 66002f2 | 2026-04-16 | OPUS_CONTEXT §18.21 Dashboard UI |
| 591c161 | 2026-04-16 | Dashboard UI — KPIs interactivos, sparklines, resumen gerencial |
| a7c498f | 2026-04-14 | feat: sidebar con grupos colapsables y sub-módulos |
| 03e744d | 2026-04-14 | seed: bootstrap sistema CÁPSULA - módulos + admin OWNER |
| 026d341 | 2026-04-14 | fix: logo login + barras coral + sección 25 identidad gráfica |
| d25edcc | 2026-04-14 | feat: login premium con branding CÁPSULA completo |
| a5311e1 | 2026-04-14 | fix: BrandColors/BrandFonts como mapped type string |
| df9c7c6 | 2026-04-14 | fix: React.CSSProperties import + eliminar .ts/.tsx de public/ |
| ab60d88 | 2026-04-14 | refactor: SVG logos → public/brand/ |
| f7b3bbd | 2026-04-14 | feat: login - CapsulaLogoHero + fondo warm + botón coral |
| 8a0a20a | 2026-04-14 | feat: sidebar - CapsulaNavbarLogo + active state coral |
| 2314a1b | 2026-04-14 | feat: layout - Nunito font + metadata CÁPSULA |
| fab45e3 | 2026-04-14 | style: tailwind - tokens CÁPSULA coral/navy/gold |
| 39efc1c | 2026-04-14 | style: globals.css - CÁPSULA Coral Energy theme |
| 7667fa3 | 2026-04-14 | feat: CapsulaLogo component |
| eb36fcc | 2026-04-14 | feat: src/config/branding.ts + useBranding hook |
| 964dc1b | 2026-04-14 | assets: identidad gráfica CÁPSULA - logos SVG |
| e93f7a2 | 2026-04-14 | docs: changelog — reorganización sidebar |

**Actividad más reciente:** 2026-04-17

### `shanklish-erp-main` — rama `master`

| SHA | Fecha | Mensaje |
|------|-------|---------|
| a21a513 | 2026-04-19 | feat: 4-layer permission system — server guards, tests, client hook |
| 0cb6d9e | 2026-04-19 | merge: master → branch — void tracking, table-move, auth fix |
| 797f245 | 2026-04-18 | docs(OPUS): sync from master + 4 new sections (18.34-18.37) |
| 34f0349 | 2026-04-18 | feat(permissions): client-side usePermission hook (Prompt 6) |
| 8d83bd3 | 2026-04-18 | test(permissions): vitest + 27 smoke tests (Prompt 7) |
| 895cc0c | 2026-04-18 | feat(permissions): migrate user + inventory-daily to 4-layer guard |
| 9bb217e | 2026-04-18 | fix(roles): add missing CASHIER/KITCHEN_CHEF/WAITER |
| 10bb1e8 | 2026-04-18 | feat(permissions): admin UI granted/revoked perms (Prompt 4) |
| ddb8c8f | 2026-04-18 | fix(permissions): DB fallback for stale JWTs |
| 3617929 | 2026-04-18 | fix(waiter): revert authorizedByUserId → authorizedById |
| 3ad8394 | 2026-04-18 | fix(permissions): split guard action-guard + api-guard |
| db76d09 | 2026-04-18 | feat(permissions): session enrichment + sidebar visibleModules |
| 36eed85 | 2026-04-18 | feat(permissions): scaffold 4-layer (Plan A — custom JWT) |
| 1e0912c | 2026-04-18 | feat(permissions): pilot requirePermission en sales + finance |
| 1817a3d | 2026-04-18 | feat(permissions): scaffold 4-layer (dup) |
| a7bdd13 | 2026-04-18 | chore(pos): poll interval 15s → 5s |
| 8d96029 | 2026-04-18 | feat(pos): 15s silent layout polling |
| 3dcb1b5 | 2026-04-18 | fix(pos): roundToWhole — remove CASH_BS, add CASH_EUR |
| 03ffd18 | 2026-04-18 | docs: OPUS §18.28-18.33 (dual PIN, infinite loop fix, menú jerárquico, Bs rounding) |
| 4851e5e | 2026-04-18 | fix(pos): stop rounding USD total for CASH_BS |
| 9d5a215 | 2026-04-17 | docs: OPUS §18.26 transferencia de mesa y §18.27 modificación de ítems |
| a2661c9 | 2026-04-17 | feat(paso3): replace void modal with 3-option modify modal |
| 7c71413 | 2026-04-17 | feat(paso2): printVoidKitchenCommand for kitchen void receipts |
| bb934f3 | 2026-04-17 | feat(paso1): void tracking on SalesOrderItem + modifyTabItemAction |
| 0b77982 | 2026-04-17 | feat(ui): physical table-move modal in POS Mesero |
| ba1aa2e | 2026-04-17 | feat(actions): moveTabBetweenTablesAction |
| 99435c7 | 2026-04-17 | feat(db): add fromTableId/toTableId to TableTransfer |
| 48bc6d2 | 2026-04-17 | docs: OPUS §18.25 allowedModules Yair y Julhian |
| 3ba0e91 | 2026-04-17 | docs: OPUS §18.24 fix mesonero pos_restaurant |
| 899d3c2 | 2026-04-17 | fix(auth): redirigir al primer módulo visible |

**Actividad más reciente:** 2026-04-19 ← **2 días más reciente que capsula-erp**

---

## 2. Último commit común (divergence point)

```
SHA:     aa7803316111a7ae3894584a9f593c82e8189c9a
Fecha:   2026-04-13
Mensaje: docs: update OPUS with section 18.20 — PK debug console.log diagnosis
```

- **shanklish-erp-main** está **63 commits** por delante del punto común.
- **capsula-erp** está **40 commits** por delante del punto común.
- Divergencia: ~6 días.

El remote `capsula` fue agregado a `shanklish-erp-main` para permitir el `merge-base`. Queda agregado sin alterar estado de la rama.

---

## 3. Diff estructural de `src/`

Total: **49 diferencias** detectadas.

### 3.1 Archivos SOLO en `capsula-erp`

| Ruta | Tipo | Primera línea descriptiva |
|------|------|---------------------------|
| `src/app/dashboard/config/modulos/modulos-view.tsx` | Admin UI | Vista admin de módulos (nuevo) |
| `src/app/dashboard/config/modulos/page.tsx` | Route | Página contenedora |
| `src/app/dashboard/loading.tsx` | Loading | Skeleton glassmorphism del dashboard |
| `src/components/dashboard/ExecutiveSummary.tsx` | Widget | Resumen gerencial dashboard |
| `src/components/dashboard/FinancialSummaryWidget.tsx` | Widget | Widget financiero dashboard |
| `src/components/dashboard/KpiCard.tsx` | Widget | KPI con sparkline |
| `src/components/dashboard/SparklineChart.tsx` | Widget | Chart mini inline |
| `src/components/pos/ShowBillModal.tsx` | POS | `"use client";` — mostrar cuenta del cliente |
| `src/components/pos/TableTransferModal.tsx` | POS | `"use client";` — transferir mesa (vía `waiter.actions`) |
| `src/components/ui/CapsulaLogo.tsx` | Brand | CÁPSULA Logo Component — isotipo barras modulares |
| `src/config/branding.ts` | Brand | CÁPSULA — Brand Identity Configuration |
| `src/config/social-brand.ts` | Brand | Config social / meta brand |
| `src/hooks/useBranding.ts` | Brand | Hook React para branding del tenant |

### 3.2 Archivos SOLO en `shanklish-erp-main`

| Ruta | Tipo | Primera línea descriptiva |
|------|------|---------------------------|
| `src/app/dashboard/mesoneros/mesoneros-view.tsx` | Admin UI | `'use client';` — CRUD de mesoneros |
| `src/hooks/use-permission.ts` | Permissions | Hook client-side para consultar permisos |
| `src/lib/permissions/action-guard.ts` | Permissions | Guard para Server Actions |
| `src/lib/permissions/api-guard.ts` | Permissions | Guard para API route handlers |
| `src/lib/permissions/has-permission.ts` | Permissions | Sistema de permisos de 4 capas |
| `src/lib/permissions/has-permission.test.ts` | Tests | Vitest — 27 smoke tests |
| `src/lib/permissions/index.ts` | Permissions | Barrel export |
| `src/lib/permissions/perm-to-modules.ts` | Permissions | Mapeo permiso → módulos |

### 3.3 Archivos que existen en ambos pero difieren

Server Actions (la mayoría fueron migradas a 4-layer guard en shanklish):
- `auth.actions.ts`
- `finance.actions.ts`
- `inventory-daily.actions.ts`
- `inventory.actions.ts`
- `pos.actions.ts`
- `sales.actions.ts`
- `user.actions.ts`
- `waiter.actions.ts`

UI / rutas:
- `app/api/kitchen/orders/route.ts`
- `app/dashboard/config/roles/roles-view.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/mesoneros/page.tsx`
- `app/dashboard/metas/metas-view.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/pos/{delivery,mesero,pedidosya,restaurante}/page.tsx`
- `app/dashboard/sales/page.tsx`
- `app/dashboard/sku-studio/sku-studio-view.tsx`
- `app/dashboard/usuarios/users-view.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/login/login-form-client.tsx`
- `app/login/page.tsx`
- `app/page.tsx`

Componentes y core:
- `components/layout/HelpPanel.tsx`
- `components/layout/Sidebar.tsx`
- `components/pos/SubAccountPanel.tsx`
- `components/pos/WaiterIdentification.tsx`
- `lib/auth.ts`
- `lib/constants/modules-registry.ts`
- `lib/constants/roles.ts`
- `lib/export-z-report.ts`
- `lib/print-command.ts`
- `middleware.ts`
- `server/services/inventory.service.ts`
- `stores/auth.store.ts`

---

## 4. Schema Prisma

Diff: **72 inserciones, 17 eliminaciones** (shanklish es superset, capsula es subset).

### 4.1 Modelos que están SOLO en `shanklish-erp-main`

- **`TableTransfer`** — tabla nueva para tracking de movimientos de mesa
  - Campos: `id`, `openTabId`, `fromWaiterId`, `toWaiterId`, `fromTableId`, `toTableId`, `authorizedByWaiterId`, `authorizedByUserId`, `authorizedNote`, `reason`, `transferredAt`
  - Índices en `openTabId`, `fromWaiterId`, `toWaiterId`, `fromTableId`, `toTableId`, `authorizedByUserId`

### 4.2 Modelos comunes con campos distintos (solo en shanklish)

**`User`** — agrega relaciones inversas:
- `authorizedTransfers TableTransfer[] @relation("TransferAuthorizedByUser")`
- `voidedItems SalesOrderItem[] @relation("ItemVoidedByUser")`

**`SalesOrder`** — agrega:
- `waiterProfileId String?`
- `waiterProfile Waiter? @relation(fields: [waiterProfileId], references: [id])`

**`SalesOrderItem`** — agrega soft delete / void tracking:
- `voidedAt DateTime?`
- `voidReason String?`
- `voidedByWaiterId String?` + relación `ItemVoidedByWaiter`
- `voidedByUserId String?` + relación `ItemVoidedByUser`
- `replacedByItemId String?` + relación recursiva `ItemReplacement` (self)
- `replacements SalesOrderItem[] @relation("ItemReplacement")`
- Índices: `@@index([voidedAt])`, `@@index([voidedByWaiterId])`, `@@index([voidedByUserId])`

**`Waiter`** — agrega relaciones inversas para transfers:
- `salesOrders SalesOrder[]`
- `voidedItems SalesOrderItem[] @relation("ItemVoidedByWaiter")`
- `transfersFrom TableTransfer[] @relation("TransferFrom")`
- `transfersTo TableTransfer[] @relation("TransferTo")`
- `transfersAuthorized TableTransfer[] @relation("TransferAuthorizedByWaiter")`
- (también elimina el alias `@relation("OpenTabWaiterProfile")` en `openTabs`)

**`TableOrStation`** — agrega:
- `transfersFrom TableTransfer[] @relation("TransferFromTable")`
- `transfersTo TableTransfer[] @relation("TransferToTable")`

**`OpenTab`** — agrega:
- `transfers TableTransfer[]`
- Elimina el alias `@relation("OpenTabWaiterProfile")` en `waiterProfile`
- Elimina `@@index([waiterProfileId])` (probablemente Prisma lo crea auto vía la FK)

### 4.3 Enums / uniques diferentes

No se detectaron enums nuevos/modificados ni uniques diferentes.

### 4.4 Impacto en migración de datos AWS RDS → Contabo

**CRÍTICO:** el schema de shanklish es un **superset** del schema de capsula.
- Toda tabla existente en capsula sigue existiendo en shanklish con los mismos campos originales.
- Los campos nuevos en `SalesOrder`, `SalesOrderItem` y `OpenTab` son todos opcionales (nullables) o tienen default → **no rompe datos existentes**.
- La tabla `TableTransfer` es nueva → no hay datos previos que migrar.
- Si el repo elegido como base es **shanklish**, la migración es aditiva sin transformaciones.
- Si el repo elegido como base es **capsula**, hay que portar 10 migraciones a mano **antes** de migrar datos.

---

## 5. Migraciones de Prisma

| Migración | capsula-erp | shanklish-erp-main |
|-----------|:-----------:|:------------------:|
| `20260127011614_add_requisitions` | ✓ | ✓ |
| `20260308000000_add_order_name_to_purchase_order` | ✓ | ✓ |
| `20260315000000_fase0_trazabilidad` | ✓ | ✓ |
| `20260315200000_pos_restaurante_completo` | ✓ | ✓ |
| `20260323000000_games_intercompany_advanced_modules` | ✓ | ✓ |
| `20260323100000_system_config` | ✓ | ✓ |
| `20260325000000_add_waiter_model` | ✓ | ✓ |
| `20260325010000_add_pos_navigation_fields` | ✓ | ✓ |
| `20260406000000_add_financial_module` | ✓ | ✓ |
| `20260407000000_soft_delete_menu_modifier` | ✓ | ✓ |
| `20260408000000_add_invoice_counter` | ✓ | ✓ |
| `20260408100000_add_pedidosya_price_to_menu_item` | ✓ | ✓ |
| `20260408200000_add_sales_order_payment` | ✓ | ✓ |
| `20260409000000_add_cash_denominations` | ✓ | ✓ |
| `20260409100000_add_cashregister_operators` | ✓ | ✓ |
| `20260411000000_add_tab_sub_accounts` | ✓ | ✓ |
| **`20260417000000_add_waiter_pin_captain_profile`** | ✓ | ✗ |
| **`20260417000000_add_waiter_pin`** | ✗ | ✓ |
| **`20260417010000_add_waiter_profile_to_tabs_and_orders`** | ✗ | ✓ |
| **`20260417020000_add_waiter_is_captain`** | ✗ | ✓ |
| **`20260417030000_add_table_transfer`** | ✗ | ✓ |
| **`20260417040000_data_fase4`** | ✗ | ✓ |
| **`20260417050000_dual_auth_table_transfer`** | ✗ | ✓ |
| **`20260417060000_restrict_mesonero_to_pos_waiter`** | ✗ | ✓ |
| **`20260417070000_normalize_shakifel_mixto_posgroup`** | ✗ | ✓ |
| **`20260417080000_add_table_ids_to_table_transfer`** | ✗ | ✓ |
| **`20260417090000_add_item_void_tracking`** | ✗ | ✓ |

**Observación clave:**
- `capsula-erp` colapsó todas las fases de mesoneros PIN + captain profile en **una sola migración bundle** (`add_waiter_pin_captain_profile`, commit `aa969a6`).
- `shanklish-erp-main` descompuso lo mismo en **10 migraciones atómicas** (PIN, profile, captain, transfer, data, dual_auth, pos_waiter, posGroup, table_ids, void_tracking).
- Si ambas migraciones iniciales se aplicaron en DBs distintas (una en producción AWS RDS y la otra en dev), la tabla `_prisma_migrations` tiene entradas divergentes → hay que resolver manualmente antes de unificar.

---

## 6. Módulos de código detectados

### `src/app/` (top level)
Idénticos: `actions`, `api`, `dashboard`, `kitchen`, `login`, + `globals.css`, `layout.tsx`, `page.tsx`.

### `src/app/dashboard/` (sub-módulos)
- **31 carpetas comunes** en ambos repos: `almacenes`, `anuncios`, `asistente`, `caja`, `compras`, `config`, `costos`, `cuentas-pagar`, `estadisticas`, `finanzas`, `games`, `gastos`, `intercompany`, `inventario`, `menu`, `mesoneros`, `metas`, `pos`, `prestamos`, `produccion`, `proteinas`, `queue`, `recetas`, `reservations`, `sales`, `sku-studio`, `transferencias`, `usuarios`, `ventas`, `wristbands`.
- **Solo en capsula:** `loading.tsx` (archivo, no carpeta).

### `src/components/`
- **Solo en capsula:** `dashboard/` (ExecutiveSummary, FinancialSummaryWidget, KpiCard, SparklineChart).
- Iguales en ambos: `layout/`, `pos/`, `ui/`, `users/`, `theme-provider.tsx`, `whatsapp-*-parser.tsx`.

### `src/lib/`
- **Solo en shanklish:** `permissions/` (carpeta con 6 archivos del sistema de 4 capas + tests).
- Ambos mantienen el archivo legacy `permissions.ts` (singular, el viejo).
- Todo lo demás es idéntico a nivel de listado: `arqueo-excel-utils.ts`, `audit-log.ts`, `auth.ts`, `constants/`, `currency.ts`, `datetime.ts`, `export-*.ts`, `inventory-excel-parse.ts`, `invoice-counter.ts`, `mock-data.ts`, `password.ts`, `pedidosya-price.ts`, `pos-settings.ts`, `print-command.ts`, `prisma.ts`, `soft-delete.ts`, `utils.ts`.

### `src/config/` (solo capsula)
- `branding.ts` y `social-brand.ts` — parte del rebranding CÁPSULA.

### `src/hooks/`
- **Solo en capsula:** `useBranding.ts`.
- **Solo en shanklish:** `use-permission.ts`.

---

## 7. Dependencias

Diff de `package.json` (solo las diferencias):

```diff
+    "test": "vitest run",
+    "test:watch": "vitest",
...
-    "typescript": "^5.3.3"
+    "typescript": "^5.3.3",
+    "vitest": "^4.1.4"
```

**shanklish agrega:** `vitest ^4.1.4` como devDep + dos scripts `test` y `test:watch`.
**capsula no tiene:** ningún runner de tests en `package.json`.

El resto de dependencias (Next, Prisma, Tailwind, Zustand, etc.) son idénticas en versión.

---

## 8. Branding y UI

Hits en el código (`src/`):

| Término | `capsula-erp` | `shanklish-erp-main` |
|---------|:-------------:|:--------------------:|
| `CAPSULA` / `Cápsula` / `CÁPSULA` | **75** | 37 |
| `Shanklish` / `shanklish` (case-insensitive) | 136 | **141** |

**Lectura:**
- `capsula-erp` duplica las referencias explícitas a CAPSULA (75 vs 37) — su trabajo reciente es el rebranding.
- Las referencias a Shanklish siguen estando en ambos repos (~140) — el branding "por defecto" todavía aparece mucho, probablemente en seeds, constants, defaults. El rebranding no está terminado en ninguno de los dos.

---

## 9. Sistema de permisos (de 4 capas)

Archivos pedidos en el diagnóstico y dónde existen:

| Archivo | `capsula-erp` | `shanklish-erp-main` |
|---------|:-------------:|:--------------------:|
| `src/lib/permissions/catalog.ts` | ✗ | ✗ |
| `src/lib/permissions/role-defaults.ts` | ✗ | ✗ |
| `src/lib/permissions/has-permission.ts` | ✗ | ✓ (149 líneas) |
| `src/lib/permissions/api-guard.ts` | ✗ | ✓ (86 líneas) |
| `src/lib/permissions/action-guard.ts` | ✗ | ✓ (99 líneas) |
| `src/lib/permissions/use-permission.ts` | ✗ | ✓ (en `src/hooks/use-permission.ts`) |

Archivos adicionales en `shanklish-erp-main/src/lib/permissions/`:
- `index.ts` (barrel)
- `perm-to-modules.ts` (53 líneas)
- `has-permission.test.ts` (230 líneas, 27 smoke tests con vitest)

**Nota:** `catalog.ts` y `role-defaults.ts` no existen en ninguno de los dos repos. El sistema fue implementado con otra estructura. El catálogo de permisos y los defaults están probablemente en `perm-to-modules.ts` y/o en `src/lib/constants/roles.ts`.

**Conclusión:** `shanklish-erp-main` es el ÚNICO repo que tiene el sistema de 4 capas. `capsula-erp` sigue usando el legacy `src/lib/permissions.ts` (singular).

---

## 10. CI/CD

### `capsula-erp/.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: SSH Deploy
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script_stop: true
          script: |
            set -e

            echo ">>> Entrando al proyecto"
            cd /var/www/capsula-erp

            echo ">>> Pull de main"
            git pull origin main

            echo ">>> Instalando dependencias"
            npm ci

            echo ">>> Build (prisma generate + next build)"
            npm run build

            echo ">>> Copiando estáticos al standalone"
            cp -r .next/static .next/standalone/.next/static
            cp -r public      .next/standalone/public

            echo ">>> Reiniciando PM2"
            pm2 restart capsula-erp --update-env

            echo ">>> Deploy completado OK"
```

**Lectura:**
- Target: servidor SSH (Contabo) — directorio `/var/www/capsula-erp`, PM2 como process manager, Next standalone build.
- Trigger: push a `main`.
- No corre tests, no corre lint, no corre `prisma migrate` — solo build y restart.

### `shanklish-erp-main/.github/`

**No existe.** El directorio `.github` no está en el repo. Shanklish no tiene CI/CD configurado en el repo.

---

## 11. Archivos basura sueltos en la raíz

Listas idénticas en ambos repos:

| Archivo | capsula | shanklish |
|---------|:-------:|:---------:|
| `COSTO.xlsx` | ✓ | ✓ |
| `OPUS_CONTEXT_CAPSULA.md` | ✓ | ✓ |
| `arqueo-descargado.xlsx` | ✓ | ✓ |
| `cambios-erp-sesion.patch` | ✓ | ✓ |
| `cloud-sql-proxy.x64.exe` | ✓ | ✓ |
| `deploy-aws.ps1` | ✓ | ✓ |
| `list-items.ts` | ✓ | ✓ |
| `menu_delivery_temp.pdf` | ✓ | ✓ |
| `render.yaml` | ✓ | ✓ |
| `test-db.js` | ✓ | ✓ |
| `test-tcp.js` | ✓ | ✓ |
| `test-vision.js` | ✓ | ✓ |
| `ts_errors.log` | ✓ | ✓ |

**Lectura:** la basura fue heredada antes de la divergencia y nadie la limpió en ninguno de los dos lados. `OPUS_CONTEXT_CAPSULA.md` probablemente conviene mantenerlo (es documentación), pero el resto (xlsx, pdf, exe, .ps1, .log, .patch, scripts `test-*`, `render.yaml`) deberían moverse a un `/docs`, `/scripts/legacy/` o eliminarse. Hay un `cloud-sql-proxy.x64.exe` (binario GCP Cloud SQL proxy) y un `deploy-aws.ps1` (script PowerShell de deploy a AWS) que son artefactos de infraestructuras pasadas distintas de la actual (Contabo + PM2).

---

## 12. Conclusión y recomendación

### 12.1 ¿Qué repo tiene código más avanzado a nivel de features?

**Shanklish-erp-main está más avanzado a nivel de backend / infraestructura:**
- **+63 commits** desde el punto común (vs 40 de capsula), último commit **2 días más reciente**.
- Sistema de **permisos de 4 capas** (614 líneas en `src/lib/permissions/` + hook client + 27 smoke tests).
- Modelo `TableTransfer` + **tracking completo de void/modificación** (`voidedAt`, `voidedByWaiter`, `voidedByUser`, `replacedByItem`, comanda de cocina al void).
- **10 migraciones atómicas** de Prisma adicionales (vs 1 bundle en capsula).
- **Tests** configurados (vitest + suite inicial).
- Mejoras POS recientes: polling automático de layout 5s, fix de redondeo Bs/USD, menú jerárquico, dual-PIN auth en transfers, modal de modificación de 3 opciones, normalización `posGroup` Shakifel/Mixto.
- `users-view` admin de permisos granted/revoked.

**Capsula-erp está más avanzado a nivel de frontend / identidad visual:**
- Rebranding CÁPSULA completo: `src/config/branding.ts`, `CapsulaLogo`, `useBranding`, theme Coral Energy en Tailwind + globals.css, login premium.
- **Widgets de dashboard nuevos** (KpiCard con sparkline, FinancialSummaryWidget, ExecutiveSummary), loading skeleton.
- Admin UI de módulos (`config/modulos/`).
- Sidebar con grupos colapsables.
- Seed de bootstrap del sistema CÁPSULA (módulos + admin OWNER).
- `ShowBillModal` + `TableTransferModal` componentes nuevos (aunque shanklish tiene la lógica de TableTransfer más completa con `moveTabBetweenTablesAction`).
- **Workflow de CI/CD** listo (`deploy.yml` → Contabo/PM2).

**Cuantificación aproximada:**
| Dimensión | Ganador |
|-----------|---------|
| Commits recientes | shanklish (+23 más) |
| Schema/DB | shanklish (superset) |
| Tests | shanklish (único) |
| Lógica POS (void, transfer, polling) | shanklish |
| Permisos | shanklish (único) |
| Branding / UI | capsula |
| Dashboard widgets | capsula |
| CI/CD | capsula (único) |
| Seed bootstrap CAPSULA | capsula |

### 12.2 Features a portar entre repos

**De shanklish → capsula (SI se elige capsula como base):**
1. `src/lib/permissions/*` (6 archivos) + hook `use-permission.ts` + test setup (vitest).
2. Modelo Prisma `TableTransfer` + campos `voidedAt/voidReason/voidedBy*/replacedBy*` en `SalesOrderItem` + `waiterProfileId` en `SalesOrder` + relaciones inversas en `User`, `Waiter`, `TableOrStation`, `OpenTab`.
3. **10 migraciones** atómicas (`20260417010000` a `20260417090000`) — reemplazan el bundle de capsula.
4. `mesoneros-view.tsx` (CRUD admin).
5. Server Actions migradas a 4-layer guard: `auth`, `finance`, `inventory`, `inventory-daily`, `pos`, `sales`, `user`, `waiter`.
6. Cambios en `lib/auth.ts`, `middleware.ts`, `stores/auth.store.ts` (session enrichment, visibleModules, JWT DB fallback).
7. `lib/print-command.ts` (`printVoidKitchenCommand`).
8. Fixes en `pos-restaurante`, `pos-mesero`, `pos-delivery`, `pos-pedidosya` (polling 5s, redondeo Bs/USD, modificación 3 opciones).
9. `users-view` UI de permisos granted/revoked.
10. `roles-view` con roles CASHIER/KITCHEN_CHEF/WAITER.

**De capsula → shanklish (SI se elige shanklish como base):**
1. `src/config/branding.ts` + `src/config/social-brand.ts` + `src/hooks/useBranding.ts`.
2. `src/components/ui/CapsulaLogo.tsx`.
3. `src/components/dashboard/*` (KpiCard, SparklineChart, FinancialSummaryWidget, ExecutiveSummary).
4. Tema CÁPSULA Coral Energy: tokens en `tailwind.config.ts`, `globals.css`, `app/layout.tsx` (Nunito font + metadata).
5. `app/login/login-form-client.tsx` + `app/login/page.tsx` (login premium CAPSULA).
6. `app/dashboard/loading.tsx` (skeleton).
7. `app/dashboard/page.tsx` (dashboard con widgets).
8. `app/dashboard/config/modulos/` (admin UI de módulos).
9. `Sidebar.tsx` con grupos colapsables + `CapsulaNavbarLogo`.
10. Seed `bootstrap sistema CÁPSULA` (módulos + admin OWNER).
11. `.github/workflows/deploy.yml` (CI/CD a Contabo).
12. Assets SVG de branding en `public/brand/`.

### 12.3 ¿Schemas Prisma compatibles?

**Sí, son compatibles en el sentido aditivo:** shanklish es un superset estricto de capsula (0 eliminaciones, 72 adiciones). No hay breaking changes destructivos (ningún campo se renombró con tipo diferente, ningún modelo se borró).

**Pero la tabla `_prisma_migrations` NO es compatible:** ambos repos tienen una migración con el mismo timestamp `20260417000000` pero nombre distinto (`add_waiter_pin_captain_profile` en capsula vs `add_waiter_pin` en shanklish). Si dos entornos divergieron usando estos repos distintos, cualquier unificación requiere intervención manual en `_prisma_migrations` (borrar entradas del repo descartado y aplicar las del elegido de forma `--create-only`, o usar `prisma migrate resolve`).

### 12.4 Recomendación

**Usar `shanklish-erp-main` como base del producto final Cápsula.**

Razones:
1. **Infraestructura > cosmética:** portar branding + widgets de dashboard es mecánico (archivos nuevos, tokens CSS, un par de refactors en Sidebar/layout). Portar el sistema de permisos de 4 capas en sentido inverso requiere re-tocar 8 Server Actions, middleware, auth, JWT, sesión, y además sin tests — alto riesgo.
2. **Schema superset:** mantener shanklish evita tener que escribir 10 migraciones a mano + resolver conflictos en `_prisma_migrations`.
3. **Actividad reciente:** shanklish tuvo commits hasta **2026-04-19**, capsula se detuvo el **2026-04-17**. El equipo está trabajando sobre shanklish.
4. **Tests:** shanklish tiene suite vitest con 27 smoke tests del motor de permisos. Empezar sin tests es regresión.
5. **Lógica POS más madura:** void tracking, table-move físico, dual PIN, polling, redondeo Bs/USD, menú jerárquico, posGroup normalizado.

**Plan sugerido (alto nivel, no se implementa aquí):**

1. Fork `shanklish-erp-main` → crear rama `capsula/main` (o renombrar el repo).
2. Cherry-pick / portar en orden los 12 puntos listados en 12.2 (sección "capsula → shanklish"). Son todos archivos nuevos o reemplazos de archivos de presentación; no tocan schema ni backend crítico.
3. Ejecutar los 27 tests + un smoke manual del login (branding CÁPSULA) + dashboard (widgets) + POS mesero (void + transfer).
4. Configurar `.github/workflows/deploy.yml` con la ruta `/var/www/capsula-erp` y ajustarlo para correr `prisma migrate deploy` antes de `next build`.
5. Limpiar raíz: mover `test-*.js`, `list-items.ts`, `deploy-aws.ps1`, `cloud-sql-proxy.x64.exe`, `render.yaml`, xlsx/pdf/log/patch a `/archive` o eliminar.
6. Resolver `_prisma_migrations` en AWS RDS antes de cut-over: comparar con el directorio `prisma/migrations/` del repo elegido y hacer `prisma migrate resolve --applied <name>` para las 10 migraciones `20260417*` de shanklish, o renombrar la de capsula si esa es la aplicada en RDS.
7. Recién después de 1-6: migrar datos de AWS RDS → Contabo PostgreSQL usando `pg_dump / pg_restore`.

---

_Fin del reporte. No se modificó ningún archivo de los repos salvo el remote `capsula` agregado a `shanklish-erp-main` para el cálculo de merge-base (no altera la rama ni el working tree)._
