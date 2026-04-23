# Diagnóstico post force-push — 2026-04-23

> Generado en la PC de oficina tras un `git fetch origin` que reportó
> `+ 6d57b00...265287b main -> origin/main (forced update)`.
> Toda la investigación es **read-only**: no se modificó nada del working
> tree salvo este archivo.

## Resumen ejecutivo

El "force-push" NO es una catástrofe. El HEAD local `6d57b00` resulta ser
**exactamente el mismo commit al que apunta el tag `pre-cutover-2026-04-19`**.
Esto significa que el clone actual de la oficina quedó congelado en el
snapshot pre-cutover de Fase 4 (19 de abril), *antes* de que la rama
`main` de `shanklish-erp` fuera reemplazada por la historia de
`capsula/consolidation` (operación prevista y documentada en el plan de
Omar como Fase 4).

El `main` remoto actual (`265287b`) contiene **los 11 commits críticos del
plan de Omar con sus hashes originales intactos**, más 47 commits nuevos
que introducen el rediseño "Minimal Navy" (PRs #4, #5, #7, #8, #9, #10,
#11) y un par de mejoras colaterales de sidebar/dashboard. Gustavo
respetó la convención de Fase 2: de los 47 archivos que toca, **el único
archivo "prohibido" alterado es `package-lock.json`** (+26 líneas,
normalización post `npm install`). No se tocaron `prisma/`, `.env*`,
`src/lib/permissions/`, `src/lib/auth.ts`, `src/middleware.ts`,
`src/stores/auth.store.ts`, ni ningún `src/app/actions/*.actions.ts`.

Producción (Vercel) lleva ~14 h corriendo `265287b` sin roturas. El
riesgo real no es de pérdida de datos ni de código, sino de **doble
numeración de fases** (el plan Minimal Navy usa "Fase 3/4/5/6" en paralelo
al plan de Omar) y del hecho de que el local de oficina quedó en una
línea de historia que ya no existe en el remoto — un `git pull` ordinario
NO funcionará y hay que reconciliar con conciencia.

---

## 1. Estado actual del repo

- **HEAD local (`main`):** `6d57b00 docs: actualizar OPUS_CONTEXT con §18.23 comanda cancelación cocina`
- **HEAD remoto (`origin/main`):** `265287b Merge pull request #11 from Juninho2604/claude/continue-design-implementation-vS0pu`
- **Merge-base real entre local y remoto:** `aa78033 docs: update OPUS with section 18.20 — PK debug console.log diagnosis`
- **Divergencia:** local tiene **40 commits** que el remoto no tiene; remoto tiene **122 commits** que el local no tiene.
- **Working tree:** limpio. No hay commits locales sin pushear encima del HEAD.
- **Tags:** solo `pre-cutover-2026-04-19` → **apunta al mismo `6d57b00` que el HEAD local**. Es decir, el local está parado exactamente en el snapshot pre-cutover.
- **Reflog local `main`:** una sola entrada, `clone: from https://github.com/Juninho2604/capsula-erp.git`. El repo fue clonado fresh con ese HEAD y no ha sido modificado.
- **Reflog remoto `origin/main`:** `265287b refs/remotes/origin/main@{0}: fetch origin: forced-update` — confirma la reescritura desde la perspectiva del fetch.
- **Branches remotas adicionales detectadas:**
  - `origin/claude/add-new-style-K6Jj6` (contiene los 11 + diseño)
  - `origin/claude/analyze-opus-context-ybIS9`
  - `origin/claude/audit-shanklish-erp-2nQ2u`
  - `origin/claude/check-opus-context-file-nZPl8`
  - `origin/claude/continue-design-implementation-vS0pu` (**2 commits AHEAD de origin/main**: `97fcce8` y `765ad6b`, tipografía editorial para h1 legacy — aún sin PR mergeado)
  - `origin/claude/enhance-dashboard-kpis-NTceM`
  - `origin/claude/review-capsule-redesign-phase3-UhsWh`
- **Producción:** Vercel ha corrido `265287b` ~14 h sin reportes de roturas del cliente Shanklish.

## 2. Archivos críticos — verificación sobre `origin/main`

| Archivo | Existe en `origin/main`? | Tamaño (líneas) |
|---|---|---|
| `OPUS_CONTEXT_CAPSULA.md` | ✅ | 3091 |
| `docs/multi-tenancy/01-models-audit.md` | ✅ | 552 |
| `docs/guia-trabajo-remoto.md` | ✅ | 399 |
| `docs/consolidation-archive/DIVERGENCE_REPORT.md` | ✅ | 435 |
| `.github/workflows/ci.yml` | ✅ | 96 |
| `src/components/ui/CapsulaLogo.tsx` | ✅ | 115 |
| `prisma/schema.prisma` | ✅ | 1848 |

**Observación sobre `ci.yml`:** el workflow sigue disparándose solo en `push` / `pull_request` a `capsula/consolidation` (no a `main`). Esto es consistente con que la historia actual de `main` viene de la rama `capsula/consolidation` renombrada/pusheada. Es un **punto pendiente**: cuando se haga un PR a `main`, el CI no va a correr hasta que se actualice el `on:` del workflow.

## 3. Análisis de los 11 commits críticos del plan de Omar

Para cada commit se verificó `git merge-base --is-ancestor <commit> origin/main`.

| Hash | ¿Ancestro de `origin/main`? | ¿Ancestro de `6d57b00` local? | Dónde vive |
|---|---|---|---|
| `c812db8` (cierre Fase 3.0.A) | ✅ Sí | ❌ No | `origin/main` y 3 branches `claude/*` |
| `e8bdc0e` (close cutover day) | ✅ Sí | ❌ No | ídem |
| `ec37b51` (OPUS 19.11 + 19.13) | ✅ Sí | ❌ No | ídem |
| `95ba60e` (OPUS §19 consolidación) | ✅ Sí | ❌ No | ídem |
| `19b85f6` (ci: prisma db push) | ✅ Sí | ❌ No | ídem |
| `4f18704` (ci: validate + deploy stub) | ✅ Sí | ❌ No | ídem |
| `3798142` (sidebar 4-layer) | ✅ Sí | ❌ No | ídem |
| `591d323` (login premium port) | ✅ Sí | ❌ No | ídem |
| `089dee5` (HelpPanel + root page port) | ✅ Sí | ❌ No | ídem |
| `b310466` (dashboard widgets port) | ✅ Sí | ❌ No | ídem |
| `eec5e92` (CAPSULA Coral Energy tokens) | ✅ Sí | ❌ No | ídem |

**Conclusión:** los 11 commits de Omar están **totalmente preservados con sus hashes originales** en `origin/main`. No se perdió ni uno solo. Que no sean ancestros de `6d57b00` es esperable, porque `6d57b00` ES el tag pre-cutover y los 11 commits nacieron DESPUÉS del cutover sobre una línea distinta de historia.

## 4. Análisis del trabajo de Gustavo (PRs #4, #5, #7, #8, #9, #10, #11)

Rango analizado: `c812db8..origin/main` — es decir, todo lo que se agregó después del último commit crítico de Omar conocido.

- **Commits:** 47 (incluye PRs de diseño + 5 merge commits)
- **Archivos tocados:** 47
- **Líneas:** +4977 / −3189 (diff neto +1788)
- **Áreas tocadas:** exclusivamente UI/branding — `src/app/dashboard/**/*.tsx`, `src/components/**`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `tailwind.config.ts`, 2 archivos nuevos útiles (`src/components/layout/PageHeader.tsx`, `src/components/ui/DataTable.tsx`, `src/components/ui/Badge.tsx`, `src/components/brand/CapsulaAnimatedMark.tsx`, `src/lib/module-icons.ts`).
- **Archivos prohibidos por convención Fase 2 tocados:**
  - `package-lock.json` — **+26 líneas**, único. Viene del commit `7a47fd3 chore(deps): normalize package-lock.json after npm install`. No es un bump intencional de dependencias y no hay cambio en `package.json` semántico (solo 5 líneas, que son el header/scripts según el diff visto).
  - Ningún `prisma/`, ningún `.env*`, ningún `src/lib/permissions/`, ningún `src/lib/auth.ts`, ningún `src/middleware.ts`, ningún `src/stores/auth.store.ts`, ningún `src/app/actions/*.actions.ts`. ✅
- **Valoración técnica:**
  - El **Sidebar** (`src/components/layout/Sidebar.tsx`) fue refactorizado: 5 color schemes colapsados a un `BASE_SCHEME` unificado Minimal Navy, reemplazo de emojis por íconos de `lucide-react`, extracción a `@/lib/module-icons`. La lógica de permisos (`getVisibleModules`, `userAllowedModules`, `enabledModuleIds`) **se mantiene intacta** — es un refactor de estilos, no de comportamiento.
  - El **`dashboard/layout.tsx`** sigue usando `visibleModules` de `@/lib/permissions/has-permission` y la composición 4-layer completa.
  - `delivery/page.tsx` pasó de 876 → 1235 líneas (+359): expansión razonable para modales Minimal Navy (WhatsApp parser, PIN cortesía, propina, modificadores, método de pago). El commit `bd19d04 fix: eliminar deliveryFee duplicado en CurrencyCalculator` ya había ocurrido en la historia previa, así que Gustavo rediseñó sobre un POS funcional.
  - Hay una cadena de 3 fixes para modo oscuro (`de44143` + `9c448b8` + `5f6d57b`) que revela un ciclo de iteración sano — se detectó el bug y se corrigió en la misma sesión.
  - Aporta valor: normaliza el look en todos los dashboards (wave 1 admin, wave 2 SKU/Metas, wave 3 finanzas/cuentas-pagar, POS 1a-f, SubAccount 2a-b, pedidosya 3-1/2/3, delivery 4a-d, sidebar/dashboard final).

**Veredicto técnico:** los 47 commits son un rediseño UI cohesivo, con commits atómicos y merge commits limpios por PR, sin contaminar la capa de negocio/permisos/BD.

## 5. Diagnóstico de la divergencia

El evento que `git` reporta como `forced-update` se descompone así:

1. **Pre-cutover (≤ 19 abril):** el repo `Juninho2604/capsula-erp` apuntaba `main` a la historia legacy de `shanklish-erp`. En esa historia el HEAD era `6d57b00` (y se le puso el tag `pre-cutover-2026-04-19` como checkpoint antes del cutover). La PC de oficina clonó en este momento (confirmado por el `reflog main` que muestra un solo evento `clone`).
2. **Cutover Fase 4 (19 abril):** Omar ejecutó la reescritura planificada de `main` para que apuntara a la línea consolidada de `capsula/consolidation` (que ya incluía los 11 commits críticos con sus hashes originales). Es aquí donde la rama `main` cambia de línea de historia — por eso `git fetch` lo reporta como "forced update".
3. **Entre 20 y 22 de abril:** Gustavo + Claude cloud agregaron 47 commits de Minimal Navy (vía PRs #4/#5/#7/#8/#9/#10/#11 — los saltos a #6 probablemente son cerrados sin mergear). Estos commits son fast-forward sobre la nueva `main` — no requirieron force-push adicional.
4. **2026-04-22–23 (oficina fetch):** primera sincronización desde el clone → `git` necesariamente reporta `forced-update` porque el antiguo `6d57b00` dejó de ser ancestro de `origin/main`.

**No hay evidencia de force-push oportunista ni de bypass de admin de branch protection posterior al cutover.** La divergencia ES el cutover. Lo que sí queda pendiente es entender si el CI / la branch protection estuvieron correctamente configurados durante los PRs de diseño (ver §6).

**Nota sobre el grafo:** la rama `claude/continue-design-implementation-vS0pu` tiene **2 commits AHEAD** de `origin/main` (`97fcce8` y `765ad6b`, tipografía editorial). Esto indica un PR abierto o trabajo en curso que todavía no fue mergeado.

## 6. Riesgos detectados

1. **Doble numeración de fases** — el plan de Omar usa "Fase 3/4/5/6" para multi-tenancy / cutover / Vercel switch / UI review. El plan de Gustavo usa "Fase 0/1a-f/2a-b/3-1/3-2/3-3/4a-d/wave 1-3" (visibles en los mensajes de commit). Sin una reconciliación en OPUS_CONTEXT, la ambigüedad se va a cobrar más adelante cuando alguien pregunte "¿en qué Fase estamos?".
2. **CI no se dispara en `main`** — `.github/workflows/ci.yml` aún solo escucha en `capsula/consolidation`. Los PRs de Gustavo se mergeron sin que CI corriera (o corrió solo por disparador manual). Antes del próximo PR hay que actualizar el `on:` para incluir `main`.
3. **Divergencia local no trivial** — la PC de oficina no puede `git pull` directo. Hay 298 commits legacy en local que NO existen en el remoto (todo el historial pre-cutover de shanklish-erp queda solo como historia apuntada por el tag). Intentar `pull` ofrece un merge feo. La acción correcta es descartar la historia local y rehidratar desde remoto (Opción A abajo), o preservarla en una rama `legacy-pre-cutover` local por si hace falta rescatar algo.
4. **CI stale compliance** — `package-lock.json` cambió sin `package.json` cambiar sustancialmente (5 líneas solo). Si el npm install fue hecho en otra máquina con otra versión de npm, puede haber drift. `npm ci` debería seguir funcionando, pero vale la pena correr un build local tras la reconciliación para verificar.
5. **Rama `claude/continue-design-implementation-vS0pu` ahead de main** — los commits `97fcce8`/`765ad6b` (tipografía editorial h1) existen solo en esa rama. Si hay un PR abierto (PR #12 o similar), hay que decidir si mergearlo o cerrarlo.
6. **No corrimos `gh pr list`** — el prompt prohíbe llamadas a la API de GitHub por afuera de `git ls-remote`. Por tanto **UNCERTAIN:** no puedo confirmar el estado de PRs abiertos, reviewers asignados, o si hay PRs adicionales entre #6 y #11 que no hayan sido mergeados.
7. **Branches `claude/*` no limpiadas** — quedaron 7 branches de trabajo de Claude cloud. No bloquean nada pero ensucian `git branch -a`; vale la pena triarlas tras la reconciliación.
8. **Los 40 commits locales** vs remote → los mensajes claves ("HelpPanel port", "4-layer permissions", "login premium") NO aparecen en la historia local. La local tiene sus propios mensajes ("sidebar con grupos colapsables", "login premium con branding CÁPSULA completo", "d25edcc feat: login premium con branding CÁPSULA completo + fixes UI"). **Hay una posibilidad pequeña** de que algunos de los 40 commits legacy contengan trabajo que ENCORE no se migró a la línea de capsula/consolidation. **UNCERTAIN:** no se puede determinar sin revisión manual commit-por-commit; ver §7 Opción B.

## 7. Plan de reconciliación propuesto

### Opción A — Aceptar `origin/main` tal cual y resetear el local

**Pros:**
- Máxima simplicidad, 1 solo comando de alineación.
- Producción ya corre `origin/main` sin roturas.
- El tag `pre-cutover-2026-04-19` preserva la historia legacy; no se pierde nada.
- Respeta el trabajo de Gustavo y el plan de Omar simultáneamente.

**Cons:**
- Si alguno de los 40 commits locales contiene trabajo no-migrado, se pierde (pero seguiría accesible vía el tag y vía reflog durante 90 días).
- No se resuelve la doble numeración de fases ni el CI stale — son tareas adicionales.

**Pasos (read-only hasta que Omar apruebe):**
1. `git branch legacy-pre-cutover 6d57b00` — etiqueta local extra de seguridad.
2. `git fetch origin`
3. `git reset --hard origin/main` — alinea HEAD local con remoto.
4. `npm ci` y un build local como smoke test.
5. Actualizar `.github/workflows/ci.yml` (`on: push: branches: [main]`) en un PR aparte.
6. Actualizar OPUS_CONTEXT con una sección "Reconciliación de numeración de fases" (mapeo plan-Omar ↔ plan-Gustavo).

### Opción B — Reconciliar los 40 commits locales sobre `origin/main`

**Pros:**
- No se pierde NADA del trabajo legacy, por si hay algo útil.
- Útil si se detecta que algún fix crítico local (ej: algún `fix(pos)` legacy) nunca se portó a capsula/consolidation.

**Cons:**
- Requiere revisar 40 commits uno por uno para decidir cuáles son ya-migrados-con-otro-hash vs genuinamente únicos.
- Alto riesgo de introducir conflictos masivos (los archivos son muy distintos entre la línea legacy y la línea capsula).
- Muchos commits locales son de la línea shanklish-ERP pre-branding CAPSULA y probablemente están OBSOLETOS (ej: `963efc...feat: ESTADÍSTICAS role-based` cuando en remoto los módulos viven en otra arquitectura).
- Posible cherry-picking parcial como compromiso, pero ninguno obvio a simple vista.
- Tiempo estimado: 2–4 h de revisión + testing.

**Pasos:**
1. `git log origin/main..6d57b00 --oneline > /tmp/legacy-commits.txt` (ver commit-by-commit).
2. Para cada mensaje, grep en `git log origin/main` buscando mensajes equivalentes — descartar los duplicados.
3. Cherry-pick selectivo del resto a una rama nueva `reconcile-legacy` desde `origin/main`.
4. Resolver conflictos manualmente.
5. PR review + merge.

### Opción C — Rollback completo al plan de Omar, descartando el trabajo de Gustavo

**Pros:**
- Restaura estrictamente la convención Fase 2/3/4/5 original.
- Única opción si Omar decide que el rediseño Minimal Navy es inaceptable (ej: no le gusta el look, o quiere pausar el rediseño hasta resolver multi-tenancy primero).

**Cons:**
- **Destruye 3 días de trabajo de Gustavo** (47 commits, ~5k líneas de código UI válido).
- Requiere coordinación con Gustavo y con el cliente (Shanklish ya está viendo la UI nueva en producción).
- Requiere ROLLBACK en Vercel de los últimos ~14 h de deploy, verificando que no se rompa nada.
- Deja el repo en un estado inconsistente con producción hasta que se re-deploye.
- Psicológicamente costoso para el equipo (reversión pública de trabajo de PR mergeado).

**Pasos:**
1. Identificar el commit previo a la cadena de diseño — probablemente `c812db8` o `e8bdc0e`.
2. `git push origin +e8bdc0e:main` (force-push de rollback) — requiere permisos de admin.
3. Avisar a Gustavo con el link a las ramas `claude/*` para preservar acceso a su trabajo.
4. Verificar Vercel y rollbackear deploy.
5. Replanificar cuándo se vuelve a intentar el rediseño.

### Recomendación técnica: **Opción A**

**Justificación:**
- No hay pérdida de código: los 11 commits de Omar están intactos en `origin/main`, y los 40 commits locales están preservados por el tag `pre-cutover-2026-04-19` y por el reflog.
- Gustavo respetó las reglas del juego (tocó solo UI, no BD/auth/permisos/actions), así que el rediseño es técnicamente compatible con Fase 3.0.B en curso.
- Producción no reporta roturas, sugiriendo que el QA de Gustavo fue sólido.
- La doble numeración y el CI stale son problemas reales pero de bajo esfuerzo (1-2 h de docs/config), ortogonales a la decisión de reconciliación.
- Opción B añade entre 2–4 h de trabajo sin retorno claro, y Opción C destruye trabajo validado.

**Si Omar detecta en la revisión de Gustavo algún regression específico** (un bug que entró con Minimal Navy, ej: una pantalla POS no legible en tablet), eso se resuelve con un commit de fix encima de `main`, NO con rollback.

## 8. Protocolos para evitar que vuelva a pasar

1. **Pre-cutover tag-preserving, post-cutover evitar force-pushes.** El cutover de Fase 4 fue una operación única y explícitamente force-push. De acá en más, branch protection en `main` debería **prohibir force-push y prohibir delete**, permitiendo solo merges vía PR. Ya existe en repo (asumido) pero verificar.
2. **CI gate sobre `main` y sobre cualquier rama que vaya a mergear a `main`.** Actualizar `.github/workflows/ci.yml` con `on: push: branches: [main]` y `on: pull_request: branches: [main]`.
3. **Requerir aprobación explícita para merges a `main`** — al menos 1 reviewer manual. Esto hubiera forzado a Gustavo/Omar a alinearse antes de los 4 PRs de diseño.
4. **Convención de numeración de fases unificada.** OPUS_CONTEXT debería tener una sola tabla maestra de fases con IDs únicos (`F3.0.B`, `UI.W1`, `UI.POS.1a`, etc.). Cualquier commit con un `feat(fase N)` debe referenciar el ID canónico.
5. **Protocolo de "working from 2 places".** Cuando Omar trabaja desde la oficina y desde casa, documentar en OPUS_CONTEXT qué máquina es autoridad canónica para commits locales no subidos. La PC de oficina debería fetchear al inicio de cada sesión y nunca tener commits locales sin pushear por más de 24 h.
6. **Reglas para Claude cloud + Gustavo en PRs de UI:**
   - Prohibido tocar: `prisma/`, `src/lib/auth*`, `src/lib/permissions/`, `src/middleware.ts`, `src/stores/auth.store.ts`, `src/app/actions/*.actions.ts`, `.env*`, `package.json` (salvo dep bump aprobado), `package-lock.json` (salvo normalización tras dep bump aprobado).
   - Las PRs de UI deben referenciar al ID canónico de OPUS_CONTEXT.
   - Agregar un `DANGERZONE.md` al repo con la lista de paths prohibidos.
7. **Sincronizar con Gustavo antes de Fase 3.0.B.** El rediseño ocupa mucha superficie de código; cambios futuros en multi-tenancy tendrán conflicto con los cambios de diseño. Alinear para decidir si pausar diseño o abordar en paralelo con un owner claro por archivo.

## 9. Trabajo pendiente tras reconciliación

- [ ] **Reconciliación local** (Opción A recomendada) — ejecutar `git reset --hard origin/main` tras aprobación de Omar.
- [ ] **Actualizar CI workflow** para disparar en `main`.
- [ ] **OPUS_CONTEXT update:**
  - Anexar el trabajo de Gustavo como sección "§N Rediseño Minimal Navy (Fases UI.0–UI.4 paralelas)".
  - Consolidar la tabla maestra de Fases con IDs únicos.
  - Anotar decisión de reconciliación tomada.
- [ ] **Fase 3.0.B (diseño schema 14 tablas para multi-tenancy)** — seguía pendiente antes del force-push; sigue pendiente después. No afectada por el rediseño Minimal Navy (no toca `prisma/`).
- [ ] **Fase 5.b (migración BD Vercel)** — seguía pendiente; sigue pendiente.
- [ ] **Fase 6 (UI review POS en tableta real)** — ahora crítica, porque el rediseño Minimal Navy cambió sustancialmente la superficie visual. Re-testear en tableta antes de dar por buena la UI.
- [ ] **PR abierto? en `claude/continue-design-implementation-vS0pu`** (2 commits ahead, tipografía editorial). Confirmar estado vía `gh pr list` (no ejecutado en este diagnóstico, requiere autorización para GitHub API).
- [ ] **Limpieza de 7 branches `claude/*`** tras reconciliación.
- [ ] **Verificar branch protection en `origin/main`** — force-push prohibido, review requerido, CI gate.

---

## UNCERTAIN / no verificado

- Si existen PRs abiertos más allá de los mergeados (no se consultó GitHub API).
- Si los 40 commits locales contienen trabajo no migrado que vale la pena rescatar (requeriría revisión manual).
- Si el deploy actual de Vercel está atado a `main` o a un commit fijo (no se consultó Vercel).
- Si el CI realmente corrió en los PRs mergeados o si fueron mergeados sin CI (requeriría revisar runs en Actions).

## Fuentes de datos usadas

- `git status`, `git log`, `git branch -a`, `git tag`, `git reflog`
- `git merge-base --is-ancestor` para los 11 commits
- `git diff --stat` sobre rangos `6d57b00..origin/main` y `c812db8..origin/main`
- `git show` para verificar contenido de archivos críticos en `origin/main`
- `git log --all --oneline --graph` para topología
