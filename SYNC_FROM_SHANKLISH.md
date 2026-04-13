# Guía de Sincronización: shanklish-erp-main → capsula-erp

> **Contexto**: `shanklish-erp-main` es la instancia activa de desarrollo (Restaurante Shanklish Caracas).
> `capsula-erp` es la plataforma SaaS **Cápsula** — derivada del mismo codebase pero con su propia
> base de datos, secretos y configuración de despliegue. Esta guía define qué se sincroniza y qué no.

---

## Regla de Oro

> Los **archivos de plataforma** (lógica de negocio, UI, schema) viajan de Shanklish → Cápsula.
> Los **archivos de instancia** (secretos, migraciones, seeds, despliegue) nunca se tocan.

---

## ✅ SINCRONIZAR — Código de plataforma compartido

Estos archivos deben copiarse desde `shanklish-erp-main` cada vez que haya cambios relevantes.

### Código fuente principal (`src/`)

| Ruta | Descripción |
|------|-------------|
| `src/app/actions/` | Todos los Server Actions (40 archivos `.actions.ts`). Lógica de negocio pura. |
| `src/app/api/` | API Routes REST. |
| `src/app/dashboard/` | Todas las páginas del dashboard (57 páginas, 31 secciones). Incluye módulos Table Pong — se activan/desactivan por tenant vía `SystemConfig.enabled_modules`. |
| `src/app/kitchen/` | Páginas de cocina y barra. |
| `src/app/login/` | Página de login. |
| `src/app/layout.tsx` | Root layout. |
| `src/app/globals.css` | Estilos globales. |
| `src/app/page.tsx` | Página raíz (redirect a dashboard). |
| `src/components/layout/` | Navbar, Sidebar, ThemeToggle, NotificationBell, HelpPanel. |
| `src/components/pos/` | 6 componentes POS especializados. |
| `src/components/ui/` | Componentes UI base (Card, Button, Combobox, Dialog…). |
| `src/components/users/` | ChangePasswordDialog. |
| `src/components/theme-provider.tsx` | Proveedor de tema. |
| `src/components/whatsapp-order-parser.tsx` | Parser WhatsApp órdenes. |
| `src/components/whatsapp-purchase-order-parser.tsx` | Parser WhatsApp compras. |
| `src/lib/auth.ts` | JWT custom: encrypt/decrypt/session. |
| `src/lib/permissions.ts` | `hasPermission()` por nivel numérico. |
| `src/lib/audit-log.ts` | `writeAuditLog()` — tabla forense. |
| `src/lib/invoice-counter.ts` | Correlativos atómicos (REST-0101, DEL-0042…). |
| `src/lib/pos-settings.ts` | POSConfig en localStorage por terminal. |
| `src/lib/print-command.ts` | Impresión térmica 80mm ESC/POS. |
| `src/lib/export-z-report.ts` | Generación Reporte Z Excel. |
| `src/lib/export-arqueo-excel.ts` | Exportación arqueo de caja. |
| `src/lib/inventory-excel-parse.ts` | Parser de importación de inventario desde Excel. |
| `src/lib/currency.ts` | Formateo moneda USD/Bs. |
| `src/lib/datetime.ts` | Utilidades fecha/hora (timezone Caracas). |
| `src/lib/soft-delete.ts` | Helpers para soft delete. |
| `src/lib/prisma.ts` | Singleton PrismaClient. |
| `src/lib/utils.ts` | Utilidades generales. |
| `src/lib/password.ts` | Hashing de contraseñas. |
| `src/lib/pedidosya-price.ts` | Lógica de precios PedidosYa. |
| `src/lib/constants/` | `modules-registry.ts`, `roles.ts`, `permissions-registry.ts`, `units.ts`. |
| `src/server/db/index.ts` | Export PrismaClient. |
| `src/server/services/inventory.service.ts` | Compras, ventas, ajustes de stock. |
| `src/server/services/production.service.ts` | Órdenes de producción. |
| `src/server/services/cost.service.ts` | COGS recursivo por receta. |
| `src/types/index.ts` | Tipos compartidos (User, InventoryItem, etc.). |
| `middleware.ts` | RBAC: protección `/dashboard`, redirect login. |

### Schema y configuración de proyecto

| Ruta | Descripción |
|------|-------------|
| `prisma/schema.prisma` | Schema Prisma (42+ modelos). Ver nota de precaución abajo. |
| `prisma/schema.prisma-append` | Extensiones al schema. |
| `next.config.js` | Configuración Next.js. |
| `tailwind.config.ts` | Configuración Tailwind CSS. |
| `tsconfig.json` | Configuración TypeScript. |
| `postcss.config.js` | Configuración PostCSS. |
| `package.json` | Dependencias del proyecto. ⚠️ Ver nota abajo. |
| `package-lock.json` | Lockfile de dependencias. |
| `public/` | Assets estáticos compartidos (íconos, imágenes UI). |

---

## ❌ NO SINCRONIZAR — Archivos de instancia / tenant-específicos

Estos archivos son propios de cada instancia y **nunca deben sobreescribirse** desde Shanklish.

### Secretos y variables de entorno

| Ruta | Razón |
|------|-------|
| `.env` | `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_VISION_API_KEY` son distintos por tenant. |
| `.env.local` | Variables de entorno locales de desarrollo de Cápsula. |
| `.env.production` | Variables de producción de Cápsula (Render/Vercel). |
| `.env.development` | Variables de desarrollo de Cápsula. |

### Base de datos — migraciones y datos

| Ruta | Razón |
|------|-------|
| `prisma/migrations/` | Cada instancia gestiona su historial de migraciones de forma independiente. Sincronizar aquí rompe el estado de la BD de Cápsula. |
| `prisma/dev.db` | Base de datos SQLite local de Shanklish. No tiene relación con Cápsula. |
| `prisma/seed*.ts` | Seeds de datos específicos de Shanklish: menú, usuarios, áreas, inventario. |
| `prisma/migrate-snapshot-fields.ts` | Script de migración one-off de Shanklish. |
| `prisma/update-tablas-price.ts` | Script one-off de precios de Shanklish. |

### Scripts de operación one-off (todos en `scripts/`)

Estos scripts son correctivos o de migración específicos del negocio Shanklish y no deben copiarse:

```
scripts/fix-tablas-shanklish.ts
scripts/fix-crema-ajo.js
scripts/fix-duplicate-areas.ts
scripts/fix-movil-ng-amounts.ts
scripts/fix-type.js
scripts/cleanup-tablas-modifiers.ts
scripts/refine-shawarma-modifiers.ts
scripts/restore-shawarma-modifiers.ts
scripts/setup-shawarma-advanced-modifiers.ts
scripts/setup-shawarma-recipe.ts
scripts/setup-tablas-delivery.ts
scripts/update-tablas-cremas.ts
scripts/inspect-tablas.ts
scripts/rename-duplicate-area.ts
scripts/hide-duplicate-area.ts
scripts/reseed-inventory.ts
scripts/reset-and-import-inventory.ts
scripts/reset-inventory-data.ts
scripts/reset-inventory-only.ts
scripts/reset-inventory.js
scripts/reset-db.js
scripts/reset-test-data.ts
scripts/clean-transactions.ts
scripts/manual-backup.ts
scripts/import-recipes-excel.ts
scripts/analyze-recipes-excel.ts
scripts/analyze-categories.ts
scripts/analyze-recipes.ts
scripts/archive-inventory.ts
scripts/migrate-cashier-roles.ts
scripts/migrate-pins.ts
scripts/generate-pins.ts
scripts/generate-templates.ts
scripts/seed-areas.ts
scripts/seed-master-inventory.ts
scripts/seed-recipes.ts
scripts/mark-critical-items.ts
...cualquier otro script en scripts/
```

> **Criterio general**: si el nombre del script contiene `fix-`, `reset-`, `seed-`, `migrate-`,
> `setup-`, `analyze-`, `archive-` o `inspect-`, es un script one-off de Shanklish.

### Configuración de despliegue de Cápsula

| Ruta | Razón |
|------|-------|
| `render.yaml` | Configuración de despliegue Render de Cápsula (diferente servicio/BD). |
| `deploy-aws.ps1` | Script de despliegue AWS de Cápsula. |
| `Dockerfile` | Dockerfile ajustado para la infraestructura de Cápsula. |

### Archivos de documentación de Cápsula

| Ruta | Razón |
|------|-------|
| `OPUS_CONTEXT_CAPSULA.md` | Documento de contexto específico de Cápsula. |
| `SYNC_FROM_SHANKLISH.md` | Este mismo archivo. |
| `README.md` | README de Cápsula (puede diferir del de Shanklish). |

### Binarios y herramientas locales

| Ruta | Razón |
|------|-------|
| `cloud-sql-proxy.x64.exe` | Proxy de Google Cloud SQL para conectar desde Windows a la BD de Shanklish. No aplica a Cápsula. |
| `sync.ps1` | Script de sincronización propio de Cápsula. |

### Archivos de datos y artefactos

| Ruta | Razón |
|------|-------|
| `*.xlsx` (`COSTO.xlsx`, `arqueo-descargado.xlsx`) | Datos de Shanklish. |
| `*.pdf` (`menu_delivery_temp.pdf`) | Datos de Shanklish. |
| `cambios-erp-sesion.patch` | Parche de sesión de Shanklish. |
| `ts_errors.log` | Log de errores de Shanklish. |
| `test-db.js`, `test-tcp.js`, `test-vision.js` | Scripts de diagnóstico de Shanklish. |
| `list-items.ts` | Utilidad one-off de Shanklish. |

### Siempre excluir

| Ruta | Razón |
|------|-------|
| `node_modules/` | Se instala localmente. |
| `.git/` | Historial de commits es independiente por repo. |
| `.next/` | Build output. |
| `.vercel/` | Configuración de Vercel de Shanklish. |

---

## ⚠️ Archivos que requieren revisión manual antes de sincronizar

| Archivo | Qué revisar |
|---------|------------|
| `prisma/schema.prisma` | Antes de copiar: comparar con el schema actual de Cápsula (`git diff`). Aplicar `prisma migrate dev` después de sincronizar si hay cambios en modelos. Nunca copiar sin revisar — un cambio de schema mal sincronizado puede romper la BD de producción. |
| `package.json` | Verificar que el campo `"name"` sea `"capsula-erp"` (no `"shanklish-erp"`) después de copiar. Solo sincronizar dependencias/scripts, no el nombre. |
| `src/lib/constants/modules-registry.ts` | Contiene módulos de Table Pong (`enabledByDefault: false`). Son válidos para Cápsula SaaS ya que se controlan por tenant vía `SystemConfig.enabled_modules`. Sincronizar normalmente. |
| `next.config.js` | Revisar si hay dominios en `images.domains` o headers específicos de Shanklish. |

---

## Flujo de sincronización recomendado

```
1. git diff shanklish-erp-main HEAD -- <archivo>   # revisar cambio específico
2. Copiar archivos según la lista ✅ de arriba (usar sync.ps1 para automatizar)
3. Revisar manualmente los archivos de la sección ⚠️
4. Si schema.prisma cambió: npx prisma migrate dev --name "<descripcion>"
5. Si package.json cambió: npm install
6. Probar localmente: npm run dev
7. Commit y push a la rama de Cápsula
```

---

*Última actualización: 2026-04-13 — Shanklish ERP / Cápsula SaaS*
