# Migraciones Propuestas — Capsula ERP

Esta carpeta contiene SQL **propuesto pero NO aplicado** a la base de datos.
Sirve como artefacto revisable para que el cliente apruebe el SQL antes de
copiarlo a `prisma/migrations/<timestamp>_<name>/` y dejar que Vercel lo
aplique en el siguiente deploy.

## Por qué una carpeta separada

Prisma escanea solo `prisma/migrations/`. Mantener estos `.sql` fuera de
ese path garantiza que **ni `prisma migrate deploy` ni el build de
Vercel/Render las apliquen jamás**. Son documentación ejecutable, no
migración activa.

## Política

1. **Nada de aquí toca producción** sin OK escrito del cliente.
2. Cuando se apruebe una propuesta, el SQL se copia a
   `prisma/migrations/<timestamp>_<name>/migration.sql` (con timestamp real).
3. Vercel ejecuta `prisma migrate deploy` en cada deploy (vía
   `vercel-build` script en `package.json`) y aplica las pendientes.
4. **Antes de mergear** el PR que contiene una migración nueva: confirmar
   que AWS RDS tiene snapshot manual reciente.

## Estado de las propuestas

| Archivo | Estado | Origen |
|---|---|---|
| ~~`001_inventory_deduction_retry.sql`~~ | **MIGRADA** → `prisma/migrations/20260428120000_inventory_deduction_retry/migration.sql` | Sub-Fase 1.F.2 |
| ~~`002_supplier_item_price_history.sql`~~ | **MIGRADA** → `prisma/migrations/20260428120100_supplier_item_price_history/migration.sql` | Sub-Fase 1.F.3 |

## Reglas de redacción del SQL propuesto

- Solo operaciones additive: `CREATE TABLE`, `ADD COLUMN` con default,
  `CREATE INDEX CONCURRENTLY`.
- FK `ON DELETE` siempre explícito; preferir `SET NULL` o `RESTRICT` antes
  que `CASCADE` para datos transaccionales.
- Cada nueva tabla incluye `createdAt` con default `CURRENT_TIMESTAMP` y
  `updatedAt` con `@updatedAt` (en el modelo Prisma).
- Comentar SQL con la intención del campo cuando no sea evidente.
- Usar `IF NOT EXISTS` en `CREATE TABLE` y `CREATE INDEX` para idempotencia.

## Antes de aplicar una migración nueva

1. **AWS Console → RDS → instancia productiva → Actions → Take snapshot**.
   Nombre sugerido: `pre-<feature>-<YYYY-MM-DD>`. Esperar status `available`
   (toma 1-3 minutos).
2. Mergear el PR que contiene la migración.
3. Vercel deploy auto-corre `prisma migrate deploy` y aplica las nuevas.
4. Ejecutar smoke test post-deploy:
   `npx tsx scripts/verify-phase2-migrations.ts` (o el verificador
   específico de la feature).
5. Si algo falla: AWS Console → snapshot → Actions → Restore snapshot a
   nueva instancia → cambiar `DATABASE_URL` en Vercel al endpoint nuevo.
