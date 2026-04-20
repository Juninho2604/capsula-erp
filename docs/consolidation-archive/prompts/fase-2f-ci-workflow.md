# Sesión 2.F — CI/CD workflow

## Contexto

Estás en C:\Users\Usuario\capsula-migration\shanklish-erp-main.
Branch: capsula/consolidation. HEAD: 3798142. Working tree limpio.
Fase 2.A, 2.B, 2.C.1 y 2.C.2 cerradas y commiteadas.

Esta es la sub-fase 2.F del plan de consolidación Cápsula documentado en
C:\Users\Usuario\capsula-migration\DIVERGENCE_REPORT.md. Léelo si necesitas
contexto histórico, pero NO es obligatorio para esta tarea.

## Objetivo

Crear .github/workflows/ci.yml en el branch actual. Un único archivo,
no toques nada más.

El workflow debe tener DOS jobs:

### Job 1: validate (se dispara siempre)

Triggers:
  - push a branch capsula/consolidation
  - pull_request con target capsula/consolidation

Servicio auxiliar: postgres:16 en el runner, expuesto en localhost:5432,
con DB de prueba (nombre: capsula_ci, user: postgres, pass: postgres).
Health check esperando a que postgres acepte conexiones antes de seguir.

Pasos en orden:
  1. actions/checkout@v4
  2. actions/setup-node@v4 con node 22 y cache npm
  3. npm ci
  4. npx prisma generate
  5. npx prisma migrate deploy   # contra la DB efímera. DATABASE_URL apunta al servicio postgres.
  6. npx tsc --noEmit
  7. npm run test

Todos los pasos deben fallar fuerte: nada de continue-on-error.

### Job 2: deploy (stub, no se dispara automáticamente aún)

Triggers:
  - workflow_dispatch únicamente

Comentario en el YAML arriba del job:
  # FASE 4: habilitar trigger on push a capsula/consolidation
  # cuando existan los secrets CONTABO_HOST, CONTABO_USER, CONTABO_SSH_KEY.
  # Por ahora solo se dispara manualmente desde Actions tab.

needs: validate (no corre si validate falla).

Dentro del job, porta la lógica de deploy que exista en
C:\Users\Usuario\capsula-migration\capsula-erp\.github\workflows\deploy.yml.
Ese archivo es solo lectura. Si no existe o tiene un shape distinto al
que espero, repórtalo y propón uno desde cero basado en:
  - SSH a CONTABO_HOST con appleboy/ssh-action
  - cd /var/www/capsula-erp
  - git pull
  - npm ci --production=false
  - npx prisma migrate deploy    # <-- AGREGAR: capsula-erp no lo tiene, es una bomba de tiempo
  - npm run build
  - pm2 reload all
  - script_stop: true

Secrets esperados (documéntalos en comentario al inicio del job):
  CONTABO_HOST, CONTABO_USER, CONTABO_SSH_KEY, DATABASE_URL_PROD.

## Qué hacer ANTES de escribir el archivo

1. Lee C:\Users\Usuario\capsula-migration\capsula-erp\.github\workflows\deploy.yml
   completo. Repórtame qué contiene.
2. Verifica si existe ya algún workflow en .github/workflows/ del branch actual.
   Si existe, repórtalo, no lo sobrescribas sin preguntar.
3. Verifica que package.json tenga scripts "test" y que vitest esté
   configurado. Si no, repórtalo.
4. Verifica que prisma/schema.prisma declare datasource con env("DATABASE_URL").

## Después de escribir el archivo

Valida localmente:
  - npx tsc --noEmit       (debe pasar, aunque no toca TS)
  - npm run test           (los 27 tests del sistema de permisos deben pasar)

NO intentes correr el workflow. NO uses `act` ni herramientas locales de
GitHub Actions. Solo valida la sintaxis YAML con un parser si lo tienes
a mano (python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
sirve si hay python).

## Al terminar

Reporta:
  1. Qué contenía el deploy.yml de capsula-erp.
  2. El ci.yml final escrito (ruta completa + contenido).
  3. Resultado de tsc + test.
  4. Cualquier decisión que tuviste que tomar sin poder consultarme.

NO HACER:
  - git add / commit / push
  - npm install (ya está hecho, package-lock no debe cambiar)
  - tocar package.json
  - tocar prisma/
  - tocar .env*
  - tocar src/lib/permissions/, src/lib/auth.ts, src/middleware.ts,
    src/stores/auth.store.ts, src/app/actions/*.actions.ts
  - borrar archivos

Si algo de lo anterior se vuelve necesario, PARA y repórtamelo.