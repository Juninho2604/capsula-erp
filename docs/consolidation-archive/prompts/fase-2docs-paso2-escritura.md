Fase 2.DOCS paso 2 — Escribir sección 19 "Consolidación Cápsula"
Contexto
Estás en C:\Users\Usuario\capsula-migration\shanklish-erp-main.

Branch: capsula/consolidation
HEAD: 089dee5
Working tree: limpio
El diagnóstico del paso 1 confirmó Escenario A: el doc
OPUS_CONTEXT_CAPSULA.md (3,655 líneas, canónica en repo root) termina
el 2026-04-18 sin mencionar la consolidación Cápsula. Hoy es 2026-04-19.

Objetivo
Hacer append de una sección ## 19. Consolidación Cápsula (2026-04-19)
al final del doc, inmediatamente antes del footer actual (L3653).
No tocas secciones 1-18. Son factualmente correctas, solo están
desactualizadas en el sentido de que no hablan de la consolidación.
Cualquier "corrección" a ellas es scope creep de esta tarea.
Estilo y formato

Estilo de redacción consistente con el resto del doc: narrativa técnica
en español, prosa densa sin abusar de bullets, paths y commits citados
explícitamente (src/components/ui/CapsulaLogo.tsx, eec5e92, etc.).
Cada sub-sección cita los commits que la generaron y los paths
principales tocados. Modelo de referencia: §18.23 "Sistema de Mesoneros
con PIN" (L2787), que hace esto bien.
Headers con numeración ### 19.X (sin repetir el patrón caótico de §18).
Bullets solo cuando enumeran algo que no tiene flujo narrativo natural
(listas de archivos, reglas discretas, commits múltiples).

Estructura exacta de §19
Doce sub-secciones, en este orden:
19.1 Contexto

Qué problema resuelve la consolidación: dos repos divergentes
(shanklish-erp-main y capsula-erp) con solapamiento de código,
branding CÁPSULA en capsula pero lógica avanzada en shanklish.
Estrategia adoptada: shanklish como base técnica (superior en schema
Prisma, permisos 4-capa, tests, lógica POS), capsula como fuente de
branding y presentación.
Branch de trabajo: capsula/consolidation en shanklish-erp-main.
Referencia a C:\Users\Usuario\capsula-migration\DIVERGENCE_REPORT.md.
Fecha de arranque: 2026-04-13 (diagnóstico inicial).

19.2 Modelo de portación — regla maestra y líneas rojas

Regla maestra: presentación de capsula-erp, lógica de shanklish.
Definiciones precisas:

Presentación = JSX, className, tokens de diseño, colores, tipografía,
assets, copy secundario.
Lógica = hooks de sesión, redirects, guards, stores, server actions,
middleware, permisos.


Excepción a la regla: copy operativo que shanklish tiene más concreto
(ej. "PedidosYA" en HelpPanel vs el "Canales Externos" genérico de
capsula). Shanklish gana hasta que Fase 3 introduzca i18n o config por
tenant.
Líneas rojas operativas (paths que NO se tocan durante Fase 2):
prisma/, .env*, src/lib/permissions/, src/lib/auth.ts,
src/middleware.ts, src/stores/auth.store.ts,
src/app/actions/*.actions.ts.
Protocolo de commit: prompts .md en capsula-migration/prompts/;
git diff --stat antes de commit; git add con archivos enumerados
(nunca git add .); mensajes semánticos (feat(layout), ci, docs).

19.3 Fase 1 — Migraciones Prisma (resolución de landmine)

Diagnóstico: DB de Contabo tenía 14 migraciones aplicadas por DDL pero
solo 2 registradas en _prisma_migrations. Landmine secundario en
20260308000000_add_order_name_to_purchase_order marcada como failed.
Resolución ejecutada en Contabo (no en Windows): proyecto temporal en
/root/capsula-migrate, 14 prisma migrate resolve --applied,
1 resolve --rolled-back + resolve --applied para la landmine,
migrate deploy aplicó las 10 de shanklish.
Estado final: DB al nivel del schema shanklish, 26/26 migraciones
registradas. Backups en /var/backups/capsula/.

19.4 Fase 2.A — Branding (commit eec5e92)

Tokens Coral Energy: #FF6B4A (coral primario), #1B2D45 (navy),
#FFF8F5 (crema fondo), tipografía Nunito.
Archivos nuevos: src/config/branding.ts, src/config/social-brand.ts,
src/hooks/useBranding.ts, src/components/ui/CapsulaLogo.tsx,
assets en public/brand/ (logo-full-color, logo-full-white,
logo-icon-color).
Archivos mergeados: tailwind.config.ts (namespaces capsula.* y
tablepong.*, preservando shanklish.*), src/app/globals.css
(paleta Coral Energy como default), src/app/layout.tsx (Nunito +
metadata CÁPSULA).
Decisión de diseño: Coral Energy es default; paletas por tenant se
aplicarán vía useBranding en Fase 3.

19.5 Fase 2.B — Widgets Dashboard (commit b310466)

Nuevos: src/components/dashboard/KpiCard.tsx,
src/components/dashboard/SparklineChart.tsx,
src/components/dashboard/FinancialSummaryWidget.tsx,
src/components/dashboard/ExecutiveSummary.tsx,
src/app/dashboard/loading.tsx.
Mergeado: src/app/dashboard/page.tsx integra ExecutiveSummary +
FinancialSummaryWidget preservando queries y permisos.
Pendiente documentado: KpiCard requiere extender
getDashboardStatsAction para exponer breakdown por KPI
(previousValue, etc.). No usado aún por falta de esa data.

19.6 Fase 2.C.1 — Login premium (commit 591d323)

src/app/login/page.tsx: fondo gradient coral→navy con noise/glow,
CapsulaLogo, card translúcida con backdrop-blur.
getSession/redirect intactos.
src/app/login/login-form-client.tsx: botón coral con shimmer, inputs
rounded-xl, onFocus/onBlur puramente visuales. loginAction,
useAuthStore, router.push preservados.

19.7 Fase 2.C.2 — Sidebar colapsable (commits 1e0cdb6 + 3798142)

Archivo: src/components/layout/Sidebar.tsx. 253 líneas → 683.
Decisiones aplicadas:

D1 — useEffect sync llama login() + setPermissions({ allowedModules, grantedPerms, revokedPerms }) idéntico a shanklish. Intocado.
D2 — grouping HÍBRIDO: SIDEBAR_TREE visual + red de seguridad "Otros" con orphanSection useMemo para módulos del registry no listados en el tree.
D3 — agregados explícitamente asistente, modulos_usuario, module_config (corregido typo modulos de capsula).
D4 — Finanzas sección top-level independiente del registry.section.
D5 — CapsulaNavbarLogo sin fallback al emoji.


Fix aplicado: Array.from(visibleMap.keys()) por error TS2802 MapIterator.
Infraestructura establecida: ExecutionPolicy RemoteSigned,
npm install ejecutado (769 packages), pipeline
npx tsc --noEmit + npm run test (vitest 27/27).

19.8 Fase 2.C.3.a — HelpPanel + root page (commit 089dee5)

src/components/layout/HelpPanel.tsx: no-op. Shanklish ya era
byte-idéntico a capsula excepto por 2 strings ("PedidosYA" en shanklish
vs "Canales Externos" en capsula). Copy operativo preservado de
shanklish por regla de §19.2.
src/app/page.tsx: reescritura visual completa de capsula. Nav con
CapsulaLogo, hero con badge coral pulsante, título Nunito "Tu negocio,
una cápsula.", doble CTA (/login + /dashboard), features con fondos
sólidos por rol (azul/verde/coral), footer con CapsulaLogo favicon.
Sin lógica — shanklish/page.tsx era 100% presentacional.

19.9 Fase 2.C.3.b — Layouts compartidos (no-op, sin commit)

Auditoría con cmp -s byte-a-byte:
src/components/layout/DashboardShell.tsx (1,910 B),
Navbar.tsx (3,767 B), NotificationBell.tsx (20,546 B),
ThemeToggle.tsx (1,087 B). Los 4 byte-idénticos entre shanklish y
capsula. Sin escritura requerida.
src/app/dashboard/layout.tsx: veto permanente. Shanklish está
adelante de capsula — usa visibleModules({ role, allowedModules, grantedPerms, revokedPerms }) con fallback defensivo a BD para JWTs
pre-Prompt 6. Capsula solo hace JSON.parse(dbUser.allowedModules):
portarlo sería regresión del sistema 4-capa. Dirección correcta en
Fase 4: capsula recibe de shanklish, no al revés.
src/app/layout.tsx raíz ya mergeado en 2.A; fuera de scope.

19.10 Fase 2.F — CI/CD (commits 4f18704 + 19b85f6)

Archivo nuevo: .github/workflows/ci.yml. Dos jobs:

validate (push y PR a capsula/consolidation): servicio
postgres:16 efímero en runner con DB capsula_ci, health check
pg_isready, pasos checkout → setup-node@22 → npm ci →
prisma generate → prisma db push --skip-generate --accept-data-loss
→ tsc --noEmit → npm run test. Sin continue-on-error.
deploy (stub, workflow_dispatch only, needs: validate):
shape final para Fase 4 — SSH a Contabo con appleboy/ssh-action,
git pull, npm ci, prisma migrate deploy, npm run build,
pm2 reload all. Secrets esperados: CONTABO_HOST, CONTABO_USER,
CONTABO_SSH_KEY, DATABASE_URL_PROD.


Switch de prisma migrate deploy a prisma db push (commit 19b85f6):
el runner contra DB vacía falló en la segunda migración
(ALTER TABLE "PurchaseOrder" sin CREATE previo). Diagnóstico y ticket
en §19.12.
Primera corrida verde tras el switch. CI operativo a partir de
19b85f6.

19.11 Fases pendientes

2.D — admin UI de módulos (src/app/dashboard/config/modulos/).
Riesgo medio. Veto automático previsto para archivos que importen de
src/lib/permissions/.
2.E — seed bootstrap CÁPSULA (prisma/seed.ts). Reescritura
probable. Postpuesto intencionalmente a cerca de Fase 4 para conocer
el shape exacto de los tenants Shanklish Caracas y Table Pong.
Fase 3 — documentación de multi-tenancy (sin implementación).
Ver §14 del doc para contexto de diseño.
Fase 4 — cutover al repo capsula-erp (force-push del branch
consolidado, o archivar legacy + nuevo). Renaming de secrets SSH_*
→ CONTABO_* si se reusan los existentes.
Fase 5 — cutover producción AWS RDS → Contabo con migración de
Shanklish a tenant. Ventana de mantenimiento necesaria.

19.12 Deuda técnica identificada durante la consolidación

BASELINE-001 (descubierto en Fase 2.F.1): prisma/migrations/
carece de migración 0000_init. Las 26 migraciones actuales son solo
deltas: la primera (20260127011614_add_requisitions) asume un schema
base preexistente creado originalmente vía prisma db push en la era
pre-migrations. Producción y Contabo no lo notan porque sus tablas ya
existen; una DB vacía (CI o tenant nuevo en Fase 3) falla en la
segunda migración al hacer ALTER TABLE "PurchaseOrder".

Mitigación temporal: CI usa prisma db push en vez de
migrate deploy (§19.10).
Fix definitivo (postpuesto a Fase 3, día 0): generar baseline con
prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script,
marcar como --applied en Contabo y AWS RDS, cambiar CI de vuelta a
migrate deploy.



Actualización del footer
El footer actual ocupa las líneas ~3653-3655 del doc. No removerlo.
Append debajo un bloque nuevo con este formato exacto:
---
Extendido 2026-04-19 — Consolidación Cápsula (sección 19)
Branch: capsula/consolidation
Commits: eec5e92 · b310466 · 591d323 · 3798142 · 4f18704 · 19b85f6 · 089dee5
Y en la línea del *Actualizado el 2026-04-18 ...*, cambiar la fecha
a 2026-04-19. Todo lo demás del footer intacto.
Fase de validación
Después de escribir:

(Get-Content OPUS_CONTEXT_CAPSULA.md).Count — reporta el nuevo total
de líneas. Esperado: ~3,655 + 300-450 = ~3,960-4,100.
Verifica que la sección 19 quede antes del footer, no después.
Renderiza mental o realmente un tramo de la §19 y confirma que los
markdown headers están bien formados (sin ## huérfanos).

No corras tsc ni test — el doc no afecta el build.
Protocolo de commit

git diff --stat + git status. Único archivo tocado debe ser
OPUS_CONTEXT_CAPSULA.md. Si hay otro, PARA y reporta.
Auditoría de líneas rojas: no aplica realmente (doc-only), pero
confirma explícitamente que no tocaste:

prisma/, .env*
src/lib/permissions/, src/lib/auth.ts, src/middleware.ts
src/stores/auth.store.ts, src/app/actions/*.actions.ts
package.json, package-lock.json


Si limpio:

powershell   git add OPUS_CONTEXT_CAPSULA.md
   git commit -m "docs(OPUS): add section 19 — consolidacion Capsula (2.A-2.F)"
   git push origin capsula/consolidation

Reporta hash del commit + confirmación de push.

Líneas rojas — NO HACER

❌ tocar secciones 1-18 del doc (ni "arreglar" la numeración rota de §18)
❌ editar otros archivos que no sean OPUS_CONTEXT_CAPSULA.md
❌ git add .
❌ npm install
❌ tocar prisma/, .env*, src/, package.json
❌ inventar fechas, commits o paths. Si no estás 100% seguro de un
dato, marca <confirmar> y reporta al final en vez de adivinar.
❌ exceder 500 líneas en §19 — si se infla más allá, es señal de
exceso de detalle. Comprime.

Si algo de lo anterior se vuelve necesario, PARA y repórtalo.

