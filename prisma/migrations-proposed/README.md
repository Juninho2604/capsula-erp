# Migraciones Propuestas — Capsula ERP

Esta carpeta contiene SQL **propuesto pero NO aplicado** a la base de datos.
Sirve como artefacto revisable para que el cliente apruebe el SQL antes de
generarlo con `prisma migrate dev --create-only` y aplicarlo en producción.

## Por qué una carpeta separada

Prisma escanea solo `prisma/migrations/`. Mantener estos `.sql` fuera de
ese path garantiza que **ni `prisma migrate deploy` ni el build de Render
las apliquen jamás**. Son documentación ejecutable, no migración activa.

## Política

1. **Nada de aquí toca producción** sin OK escrito del cliente.
2. Cuando se apruebe una propuesta, el SQL se replica en
   `prisma/migrations/<timestamp>_<name>/migration.sql` (vía
   `prisma migrate dev --create-only`) y luego se aplica con
   `prisma migrate deploy` siguiendo el protocolo de §18.39 de
   `OPUS_CONTEXT_CAPSULA.md` (pg_dump previo, smoke test, etc.).
3. Las propuestas se mantienen aquí incluso después de aplicarse, como
   historial humano-legible separado del historial Prisma.

## Estado de las propuestas

| Archivo | Estado | Origen |
|---|---|---|
| `001_inventory_deduction_retry.sql` | Propuesta | Sub-Fase 1.F.2 — Outbox para descargo de inventario fallido |
| `002_supplier_item_price_history.sql` | Propuesta | Sub-Fase 1.F.3 — Histórico de precios por proveedor |

## Reglas de redacción del SQL propuesto

- Solo operaciones additive: `CREATE TABLE`, `ADD COLUMN` con default, `CREATE INDEX CONCURRENTLY`.
- FK `ON DELETE` siempre explicito; preferir `SET NULL` o `RESTRICT` antes que `CASCADE` para datos transaccionales.
- Cada nueva tabla incluye `createdAt` con default `CURRENT_TIMESTAMP` y `updatedAt` con `@updatedAt` (en el modelo Prisma).
- Comentar SQL con la intención del campo cuando no sea evidente.
