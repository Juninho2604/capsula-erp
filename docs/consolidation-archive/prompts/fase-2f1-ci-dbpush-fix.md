Fase 2.F.1 — CI fix: prisma migrate deploy → prisma db push
Contexto
Estás en C:\Users\Usuario\capsula-migration\shanklish-erp-main.

Branch actual: capsula/consolidation
HEAD: 4f18704 ("ci: workflow con validate ...")
Working tree: limpio

El workflow .github/workflows/ci.yml creado en Fase 2.F corrió en GitHub
Actions y falló en el step Prisma migrate deploy con:
Applying migration `20260127011614_add_requisitions`
Applying migration `20260308000000_add_order_name_to_purchase_order`
ERROR: relation "PurchaseOrder" does not exist
Causa raíz (ya diagnosticada, no re-investigar): prisma/migrations/
carece de migración baseline 0_init. Las 26 migraciones actuales son solo
deltas. El schema base se creó originalmente vía prisma db push en la era
pre-migrations y nunca se bajó baseline. Producción y Contabo no lo notan
porque sus tablas ya existen antes de que corra cualquier migración; una DB
vacía (CI, o tenant nuevo en Fase 3) explota en la segunda migración.
La fix correcta (crear baseline 0000_init) queda como ticket BASELINE-001
para Fase 3. Ahora solo aplicamos un bypass en CI para destrabar la
cadencia de Fase 2.
Objetivo
Editar únicamente .github/workflows/ci.yml. Reemplazar el step que
actualmente corre npx prisma migrate deploy por uno que corre
npx prisma db push --skip-generate --accept-data-loss contra la misma
DB efímera.
Cambios exactos:

Nombre del step: Prisma migrate deploy → Sync schema to database (CI bypasses migration history)
Comando: npx prisma migrate deploy → npx prisma db push --skip-generate --accept-data-loss
Conservar intacto el bloque env: (DATABASE_URL hacia el servicio postgres local)
Agregar comentario arriba del step, tal cual:

yaml      # FASE 3 BLOCKER: prisma/migrations/ carece de un baseline 0_init porque
      # el schema base fue creado originalmente vía `prisma db push` en la era
      # pre-migrations. Las 26 migraciones actuales son solo deltas y fallan
      # al correr contra una DB vacía (la primera ALTER sobre PurchaseOrder
      # asume que la tabla ya existe).
      #
      # Volver a `prisma migrate deploy` cuando se cree la migración baseline
      # durante Fase 3 (multi-tenancy fuerza la resolución correcta).
No toques nada más del archivo. No toques el step Prisma generate, no
cambies triggers, no cambies el job deploy, no cambies el servicio
postgres.
Antes de editar

Muéstrame el contenido actual del step que vas a reemplazar (las ~5 líneas)
para confirmar que estamos tocando lo correcto.

Después de editar
Valida localmente:

Parse YAML:

powershell  node -e "const fs=require('fs');const yaml=require('js-yaml');yaml.load(fs.readFileSync('.github/workflows/ci.yml','utf8'));console.log('YAML OK')"

npx tsc --noEmit (debe seguir pasando; este cambio no toca TS)
npm run test (27/27 tests de permisos deben seguir pasando)

NO corras prisma db push localmente. Solo se valida en el runner del CI.
Al terminar, reporta

Diff del cambio (solo las líneas tocadas).
Resultado de YAML parse + tsc + test.
git status (solo .github/workflows/ci.yml como modified, nada más).

Líneas rojas — NO HACER

❌ git add / commit / push
❌ npm install
❌ tocar package.json
❌ tocar prisma/ (ni schema ni migrations)
❌ tocar .env*
❌ tocar cualquier otro archivo que no sea .github/workflows/ci.yml
❌ intentar crear la migración baseline 0_init — eso es Fase 3, no ahora
❌ correr prisma db push localmente

Si algo de lo anterior se vuelve necesario, PARA y repórtalo.