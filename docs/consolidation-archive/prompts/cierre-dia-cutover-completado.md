# Cierre de día 2026-04-19 — OPUS + archive + guía remota

## Contexto

Estás en `C:\Users\Usuario\capsula-migration\shanklish-erp-main` (la
carpeta sigue con el nombre viejo, pero `origin` apunta a
`github.com/Juninho2604/capsula-erp` desde la Fase 4).

- Branch actual: `main` (renombrado desde `capsula/consolidation`)
- HEAD esperado: `ec37b51` (docs(OPUS): update 19.11 + add 19.13)
- Hoy se ejecutaron Fase 4 (cutover repo) y Fase 5.a (switch Vercel).
  Ambas exitosas, producción corriendo desde capsula-erp.
- Branch protection activa en `main`. Bypass: solo Rol de administrador
  del repositorio (Juninho2604). Este push será autenticado como Omar,
  así que funciona por bypass.

## Paso 0 — Pre-flight check importante

En el día se ejecutó un commit de prueba `336ede3 test: branch protection`
que fue rechazado por el remote pero puede haber quedado local. Verifica:

```powershell
git log --oneline -3
```

- Si el primer resultado es `ec37b51` → bien, sigue al paso 1.
- Si el primer resultado es `336ede3` (o cualquier commit que no esté
  en origin/main) → debes limpiarlo antes de seguir:
  ```powershell
  git fetch origin
  git reset --hard origin/main
  git log --oneline -3
  ```
  Ahora debe mostrar `ec37b51` como HEAD.

Reporta qué caso aplicaba.

## Paso 1 — Localizar `guia-trabajo-remoto.md`

El humano bajó este archivo durante la sesión y pidió que se incluya en
el commit final en `docs/guia-trabajo-remoto.md`. Ubicaciones probables
(buscar en orden):

1. `C:\Users\Usuario\capsula-migration\guia-trabajo-remoto.md`
2. `C:\Users\Usuario\Downloads\guia-trabajo-remoto.md`
3. `C:\Users\Usuario\Desktop\guia-trabajo-remoto.md`
4. `C:\Users\Usuario\Documents\guia-trabajo-remoto.md`

```powershell
foreach ($p in @(
    "C:\Users\Usuario\capsula-migration\guia-trabajo-remoto.md",
    "C:\Users\Usuario\Downloads\guia-trabajo-remoto.md",
    "C:\Users\Usuario\Desktop\guia-trabajo-remoto.md",
    "C:\Users\Usuario\Documents\guia-trabajo-remoto.md"
)) {
    if (Test-Path $p) { Write-Output "FOUND: $p" }
}
```

- Si hay exactamente 1 match → usa esa ruta.
- Si hay 0 matches → PARA, reporta "guia-trabajo-remoto.md no encontrado
  en ubicaciones estándar, necesito ruta manual del humano".
- Si hay 2+ matches → reporta los paths + tamaños + fechas y PARA para
  que el humano elija cuál es el canónico.

## Paso 2 — Preparar estructura de archive

```powershell
# Crear carpetas destino
mkdir docs\consolidation-archive -Force
mkdir docs\consolidation-archive\prompts -Force
```

Verifica que ninguna sobrescriba contenido existente:
```powershell
dir docs\consolidation-archive
dir docs\consolidation-archive\prompts
```

Ambas deben estar vacías. Si no lo están, PARA y reporta.

## Paso 3 — Copiar archivos de archive

```powershell
# DIVERGENCE_REPORT
copy ..\DIVERGENCE_REPORT.md docs\consolidation-archive\DIVERGENCE_REPORT.md

# Todos los prompts
copy ..\prompts\*.md docs\consolidation-archive\prompts\

# La guía (ruta del paso 1)
copy <ruta_guia_encontrada_en_paso_1> docs\guia-trabajo-remoto.md
```

Verifica con:
```powershell
dir docs\consolidation-archive
dir docs\consolidation-archive\prompts
Test-Path docs\guia-trabajo-remoto.md
```

Reporta el conteo de archivos en `prompts/`. Esperado: ~10 archivos .md.

## Paso 4 — Editar OPUS_CONTEXT_CAPSULA.md

Tres ediciones en el doc. Todas dentro de §19. Nada fuera de §19.

### Edición 4.A — Reescribir §19.11 completa

Localiza `### 19.11 Fases pendientes (orden actualizado 2026-04-19)`.
Reemplaza su contenido completo (hasta justo antes del siguiente
`###`) por este texto:

```markdown
### 19.11 Fases pendientes (orden actualizado 2026-04-19)

El orden de fases cambió el 2026-04-19 — ver §19.13 para el razonamiento.
Estado actualizado al cierre del día 2026-04-19:

- **Fase 4 — Cutover repo** ✅ **COMPLETADA 2026-04-19**. Force-push
  de `capsula/consolidation` → `capsula-erp/main`. Safety tag
  `pre-cutover-2026-04-19` creado en `6d57b00`. Remote local swap
  ejecutado. Ver §19.14 para detalles de ejecución.
- **Fase 5.a — Switch Vercel producción** ✅ **COMPLETADA 2026-04-19**.
  Proyecto Vercel `shanklish-erp-main` reconectado de
  `Juninho2604/shanklish-erp-main` → `Juninho2604/capsula-erp` manteniendo
  mismo nombre de proyecto (URL pública preservada). Deploy `47JtCiTN`
  (commit `ec37b51`) promovido manualmente a producción. DB sigue en
  AWS RDS sin cambios. Ver §19.14 para detalles.
- **Fase 2.D — Admin UI módulos (POST-CUTOVER)**. Se ejecuta directamente
  en `capsula-erp` como feature normal, no como portación. Scope:
  `src/app/dashboard/config/modulos/`. Riesgo previsto medio por
  interacción con permisos 4-capa.
- **Fase 2.E — Seed bootstrap (POST-CUTOVER)**. Se ejecuta cerca del
  momento en que se agregue un segundo tenant real (Table Pong o
  similar), cuando el shape de tenant esté definido.
- **Fase 3 — Documentación multi-tenancy**. Documento
  `docs/MULTITENANCY.md`. No bloquea nada, se hace cuando haya banda.
- **Fase 5.b — Migración AWS RDS → Contabo (POSPUESTA)**. Ventana de
  mantenimiento de 2-4h. Deadline flexible (próximos 1-3 meses por
  decisión del humano). Contabo hoy tiene schema pero BD vacía. Pre-req:
  resolver BASELINE-001 (§19.12) antes o durante esta fase. Pre-req
  adicional: Contabo en grado producción (SSL, backups automáticos,
  monitoring).
- **Fase 6 — UI review del POS (POST-CUTOVER)**. Los colores coral del
  branding Cápsula, heredados vía globals.css de 2.A, son inadecuados
  para operación táctica en tableta del POS. Requiere paleta operativa
  independiente del branding marketing. Alcance: POS Restaurante, POS
  Mesero, POS Delivery, POS PedidosYA, vistas de Cajera. Usar skill
  `tablepong-ui-review` ya instalada en el proyecto. Pre-req: test con
  tableta real en condiciones de luz de cocina. Detectado durante
  validación post-switch 2026-04-19.
```

### Edición 4.B — Agregar §19.14 después de §19.13

Inmediatamente después de §19.13 (que termina antes del bloque que
comienza con `### 19.12` — recordatorio: el orden físico en el doc es
19.11, 19.12, 19.13; agregar después de 19.13). Inserta:

```markdown
### 19.14 Ejecución del cutover — Fase 4 + Fase 5.a (2026-04-19)

Fase 4 y Fase 5.a se ejecutaron en la misma sesión el 2026-04-19 entre
aproximadamente las 20:30 y 21:30 hora local.

**Fase 4 — Cutover repo (git)**

Ejecución desde local en `C:\Users\Usuario\capsula-migration\shanklish-erp-main`:

1. Safety tag `pre-cutover-2026-04-19` creado sobre `6d57b00` (HEAD
   previo de `capsula-erp/main`) y pusheado al remote. Hace el estado
   previo recuperable permanentemente.
2. Force-push: `git push -f capsula-dest capsula/consolidation:main`.
   Transición: `6d57b00` → `ec37b51` en `capsula-erp/main`.
3. Remote swap local: `origin` renombrado a `shanklish-legacy`, nuevo
   `origin` creado apuntando a `capsula-erp`.
4. Branch local renombrado: `capsula/consolidation` → `main`, con
   upstream `origin/main`.

Rollback disponible post-Fase 4:
`git push -f origin pre-cutover-2026-04-19:main` (restituye
`capsula-erp/main` a `6d57b00`).

**Fase 5.a — Switch Vercel producción**

Ejecución desde UI de Vercel (no CLI). Proyecto: `shanklish-erp-main`
(nombre preservado a propósito — cambiar el nombre del proyecto habría
cambiado la URL pública y roto accesos del equipo).

1. Settings → Git → Disconnect del repo `Juninho2604/shanklish-erp-main`.
2. Connect Git Repository → `Juninho2604/capsula-erp`.
3. Verificación: env vars intactas (3 variables), URL pública sirviendo
   deploy viejo `6uY2rA6or` mientras tanto, zero downtime observable.
4. Settings → Build and Deployment → Node.js Version cambiado de `24.x`
   a `22.x` (Vercel había asignado 24 por default al reconectar, pero
   el código se desarrolla contra Node 22).
5. Deployments → click en preview `47JtCiTN` (commit `ec37b51`,
   pre-construido exitosamente durante el día) → Promote to Production.
6. Vercel re-apuntó la URL pública al deploy `47JtCiTN` en ~30-60s.

Validación post-switch:

- URL pública carga branding coral/navy con `CapsulaLogo` (confirmado
  visualmente).
- POS PedidosYA renderiza correctamente con datos reales de AWS RDS
  (productos, precios, descuentos).
- Login funciona con usuarios existentes (Dueño, Cajera, Mesonero con
  PIN verificados).
- Sidebar colapsable opera normalmente.

Rollback disponible post-Fase 5.a:
Deployments → click en `6uY2rA6or` → Promote to Production. ~30 segundos.
DB no se tocó.

**Hallazgos operativos de Vercel (Hobby plan)**

- No existe setting explícito de "Production Branch" en Settings del
  proyecto. Vercel usa la default branch del repo (`main` en
  `capsula-erp`). Funciona bien pero sorprende si se espera encontrar
  la config.
- El reconnect a un repo nuevo NO dispara redeploy automático si el
  commit HEAD del nuevo repo ya existe como preview previo. Hay que
  promover manualmente el preview existente.
- Al reconectar, Node.js version se resetea a default (24.x al momento
  de esta ejecución). Verificar siempre post-reconnect.
```

### Edición 4.C — Agregar §19.15 después de §19.14

Inmediatamente después de §19.14, antes del footer del doc:

```markdown
### 19.15 Branch protection en capsula-erp/main (2026-04-19)

Activado Ruleset "Main" en GitHub `capsula-erp` tras el cutover.

**Reglas activas:**

- **Require pull request before merging** (1 approval requerido)
- **Required status check: `validate`** (job del CI workflow creado en
  Fase 2.F — tsc + vitest + prisma db push)
- **Require branches to be up to date before merging**
- **Block force pushes**
- **Restrict deletions**

**Lista de bypass:** solo `Rol de administrador del repositorio`
(efectivamente Juninho2604). Permite que el owner haga push directo a
main para hotfixes de emergencia o trabajo iterativo sin armar PR.

**Claude App SIN bypass** (decisión tomada 2026-04-19 tras evaluar
tradeoff velocidad vs riesgo). Razones documentadas:

- Sesiones automatizadas de Claude cloud pueden fallar (bucle infinito
  histórico, commits sin pedir permiso) y un bypass permitiría deploys
  no filtrados a producción.
- El valor real del bypass era ahorrar ~15s al mergear un PR — costo
  menor que la red de seguridad del CI.
- Flujo actual: Claude cloud abre PR → CI corre → Omar aprueba con 1
  click. Mantiene velocidad + safety.
- Omar (admin) sigue pudiendo push directo para emergencias reales.

**Protocolo para Gustavo (colaborador con write access):**

- Trabajo en branches con patrón `gustavo/feature-xxx`.
- Push a esas branches permitido sin restricciones.
- Para mergear a `main`: PR obligatorio con 1 approval (Omar) + CI verde.
- Mensaje sobre el cambio enviado a Gustavo el 2026-04-19.

**Revisar esta configuración cuando:**

- El equipo crezca a 3+ desarrolladores activos.
- Omar ya no sea el único admin funcional.
- Aparezca un incidente de producción causado por push directo (del
  admin o de un bypass).
```

### Edición 4.D — Actualizar footer

Localiza el bloque del footer que empieza con `Extendido 2026-04-19 —
Consolidación Cápsula (sección 19)` y el `Branch: capsula/consolidation`.
Reemplaza ese bloque por:

```markdown
---
Extendido 2026-04-19 — Consolidación Cápsula (secciones 19, 19.11 actualizada, 19.14, 19.15 nuevas)
Repo canónico: capsula-erp
Branch: main (post-cutover)
Commits de consolidación: eec5e92 · b310466 · 591d323 · 3798142 · 4f18704 · 19b85f6 · 089dee5 · 95ba60e · ec37b51
```

No toques el resto del footer (la línea `*Actualizado el 2026-04-19...*`
ya está correcta).

## Paso 5 — Validación local

```powershell
(Get-Content OPUS_CONTEXT_CAPSULA.md).Count
# Esperado: ~4030-4100 líneas (3899 + ~130 de nuevo contenido)

# Verificar headers únicos
Select-String "^### 19\.1[4-5]" OPUS_CONTEXT_CAPSULA.md
# Esperado: 2 matches (19.14 y 19.15), ninguno duplicado
```

Tsc/test no se corren aquí — los cambios son solo docs/markdown, no
afectan el build.

## Paso 6 — Auditoría de líneas rojas

```powershell
git status
git diff --stat
```

Archivos esperados en el diff:
- `OPUS_CONTEXT_CAPSULA.md` (modified)
- `docs/guia-trabajo-remoto.md` (new)
- `docs/consolidation-archive/DIVERGENCE_REPORT.md` (new)
- `docs/consolidation-archive/prompts/*.md` (new, ~10 archivos)

Si aparece CUALQUIER otro archivo modificado o nuevo → PARA y reporta.

Verificación explícita de líneas rojas — NINGUNO de estos paths debe
aparecer en el diff:
- `prisma/`, `.env*`
- `src/lib/permissions/`, `src/lib/auth.ts`, `src/middleware.ts`
- `src/stores/auth.store.ts`, `src/app/actions/*.actions.ts`
- `package.json`, `package-lock.json`
- `.github/workflows/*.yml`

## Paso 7 — Commit y push

```powershell
git add OPUS_CONTEXT_CAPSULA.md
git add docs/guia-trabajo-remoto.md
git add docs/consolidation-archive/

git commit -m "docs: close cutover day — OPUS update + archive + workflow guide"

git push origin main
```

**Esperado:** push exitoso porque Omar tiene bypass de admin en la
branch protection.

**Si push es rechazado** con error tipo `protected branch hook declined`:
- NO intentes bypasses via flags
- NO intentes force-push
- PARA y reporta el error completo al humano

## Paso 8 — Reporte final

Al terminar, reporta en este formato:

```
## Cierre de día 2026-04-19 completado

### Archivos commiteados
- OPUS_CONTEXT_CAPSULA.md (modified, N insertions / M deletions)
- docs/guia-trabajo-remoto.md (nuevo)
- docs/consolidation-archive/DIVERGENCE_REPORT.md (nuevo)
- docs/consolidation-archive/prompts/*.md (nuevo, N archivos)

### Ediciones en OPUS
- §19.11 actualizada: Fase 4 y 5.a marcadas completadas, Fase 6 agregada
- §19.14 nueva: ejecución del cutover
- §19.15 nueva: branch protection
- Footer actualizado

### Commit
- Hash: <hash del commit>
- Push a origin/main: <exitoso / rechazado>

### Estado final
- Branch: main
- HEAD: <hash>
- Working tree: limpio
- CI dispararado automáticamente al push — monitorear en Actions tab
```

## Líneas rojas — NO HACER

- ❌ tocar secciones del OPUS fuera de §19 (específicamente: no tocar
  1-18, §19.1-19.10, §19.12, §19.13)
- ❌ tocar archivos fuera de `OPUS_CONTEXT_CAPSULA.md`, `docs/` nuevos
- ❌ `git add .`
- ❌ `git push --force` bajo ninguna circunstancia
- ❌ crear branches nuevas
- ❌ tocar `.gitignore`
- ❌ ejecutar `npm install`, `tsc`, `test`, `prisma`
- ❌ intentar subir archivos > 5MB
- ❌ si encuentras inconsistencias en el doc, NO las corrijas; repórtalas
  al final en el reporte

Si algo de lo anterior se vuelve necesario, **PARA y repórtalo**.