# Fase 4 — Cutover repo (force-push con safety tag)

## Contexto

Estás en `C:\Users\Usuario\capsula-migration\shanklish-erp-main`.

- Branch local: `capsula/consolidation`
- HEAD: `ec37b51` ("docs(OPUS): update 19.11 + add 19.13...")
- Working tree: limpio
- Remote `origin` actualmente apunta a: `https://github.com/Juninho2604/shanklish-erp-main.git`

Repos involucrados (ambos del usuario `Juninho2604`, ambos públicos):
- Origen: `shanklish-erp-main` (se queda congelado como legacy tras esta fase)
- Destino: `capsula-erp`, actualmente en commit `6d57b00` (de anteayer)

## Objetivo

En este orden:

1. **Safety tag** `pre-cutover-2026-04-19` sobre el estado actual de
   `capsula-erp` (commit `6d57b00`) y push del tag. Esto hace el
   estado previo **recuperable permanentemente** incluso después del
   force-push destructivo.
2. **Force push** de `capsula/consolidation` local → `capsula-erp/main`.
   Esto es el punto de no retorno del cutover. **Pausa obligatoria
   antes de este paso.**
3. **Remote swap** local: `origin` pasa a ser `capsula-erp`. El viejo
   `origin` (shanklish-erp-main) se renombra a `shanklish-legacy`.
4. **Rename branch** local: `capsula/consolidation` → `main`.
5. Tracking de la nueva `main` contra `origin/main`.
6. Verificación final del estado.

La BD de producción **NO se toca en ningún paso**. Este es un cambio
puramente de código y configuración de git.

## Paso A — Pre-flight verification

Antes de tocar remotes, confirma el estado local:

```powershell
git status
git log --oneline -5
git remote -v
```

Reporta los 3 outputs. Espera confirmación **tácita** (si todo se ve
como esperamos, procedes al paso B sin esperar reply explícito, PERO
si algo no cuadra — ej. working tree no limpio, HEAD no es `ec37b51`,
origin no es shanklish-erp-main — PARA y reporta).

## Paso B — Safety tag en capsula-erp

Este paso NO es destructivo. Es la red de seguridad previa al force-push.

```powershell
# Añadir capsula-erp como remote temporal
git remote add capsula-dest https://github.com/Juninho2604/capsula-erp.git

# Fetch para tener acceso local a 6d57b00
git fetch capsula-dest

# Verificar que 6d57b00 efectivamente existe en el remote
git log --oneline capsula-dest/main -1

# Crear tag localmente apuntando a 6d57b00
git tag pre-cutover-2026-04-19 6d57b00

# Push del tag al remote capsula-dest
git push capsula-dest pre-cutover-2026-04-19
```

Reporta el output de cada comando. Si `capsula-dest/main` no está en
`6d57b00` sino en otro commit, PARA y reporta — el estado del repo
remoto cambió entre la verificación humana y esta ejecución.

## ⚠️ PAUSA OBLIGATORIA — ⚠️

**Antes del paso C (force-push), responde con esta línea exacta y
ESPERA confirmación del humano:**

> "Safety tag confirmado en pre-cutover-2026-04-19. Siguiente comando
> es irreversible: `git push -f capsula-dest capsula/consolidation:main`.
> ¿Confirmo ejecución?"

**No ejecutes el force-push hasta recibir "confirmo" (o equivalente
inequívoco) como respuesta.** Si recibes cualquier otra cosa — duda,
pregunta, "espera", pausa larga sin respuesta — te quedas quieto.

## Paso C — Force push (ejecutar SOLO tras confirmación)

```powershell
git push -f capsula-dest capsula/consolidation:main
```

Reporta el output completo. Un push exitoso se ve algo como:
```
+ 6d57b00...ec37b51 capsula/consolidation -> main (forced update)
```

Si el push falla por cualquier razón (rechazo de servidor, credenciales,
rate limit), PARA y reporta sin intentar variaciones del comando.

## Paso D — Remote swap

Tras force-push exitoso, reconfigura remotes:

```powershell
# Eliminar el remote temporal que usamos
git remote remove capsula-dest

# Renombrar el origin actual (shanklish-erp-main) a legacy
git remote rename origin shanklish-legacy

# Crear nuevo origin apuntando a capsula-erp
git remote add origin https://github.com/Juninho2604/capsula-erp.git

# Fetch del nuevo origin para establecer refs
git fetch origin
```

Reporta output de cada uno. `git fetch origin` debe traer el commit
`ec37b51` como `origin/main`.

## Paso E — Rename de branch local

```powershell
# Renombrar capsula/consolidation → main
git branch -m capsula/consolidation main

# Configurar tracking contra origin/main
git branch --set-upstream-to=origin/main main
```

## Paso F — Verificación final

```powershell
git branch -vv
git remote -v
git log --oneline -5
```

Verifica que:
- Branch actual es `main` y trackea `origin/main`.
- `origin` apunta a `capsula-erp`, `shanklish-legacy` apunta a
  `shanklish-erp-main`.
- HEAD es `ec37b51` (no cambió).
- `git status` sigue limpio.

Reporta los 3 outputs.

## Paso G — Verificación remota

Abre conceptualmente (con comandos, no el browser) la validación:

```powershell
# Listar tags en el nuevo origin (debe incluir pre-cutover-2026-04-19)
git ls-remote --tags origin | Select-String "pre-cutover"

# Verificar que origin/main == local main
git log origin/main --oneline -1
git log main --oneline -1
```

Ambos logs deben reportar `ec37b51`.

## Reporte final

Al terminar, reporta en este formato:

```
## Fase 4 — Cutover repo completado

- Safety tag: pre-cutover-2026-04-19 en 6d57b00 (capsula-erp)
- Force push: <hash previo en capsula-erp/main> → ec37b51
- Remote local origin: capsula-erp
- Remote local shanklish-legacy: shanklish-erp-main
- Branch local: main (tracking origin/main)
- HEAD: ec37b51

Rollback disponible:
  git push -f origin pre-cutover-2026-04-19:main
  (repondría capsula-erp/main al estado previo al cutover)
```

## Líneas rojas — NO HACER

- ❌ editar archivos del working tree (ninguno)
- ❌ commits (no hay nada que commitear; working tree limpio)
- ❌ tocar el branch `master` local o el remote shanklish-erp-main
- ❌ ejecutar `git push -f` antes de la confirmación explícita del
  humano tras la pausa obligatoria
- ❌ "reintentar" un push fallido con variaciones del comando. Si falla,
  PARA.
- ❌ borrar tags existentes en capsula-erp (si `6d57b00` ya tiene tags,
  coexisten; solo agregamos uno nuevo)
- ❌ tocar el fichero `.git/config` directamente. Usa solo comandos
  `git remote ...`.
- ❌ `npm install`, `tsc`, `test` — nada de eso aplica acá.

Si algo de lo anterior se vuelve necesario, **PARA y repórtalo**.

