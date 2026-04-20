# Cutover paso 1 — Update OPUS §19.11 (reordenamiento)

## Contexto

Estás en `C:\Users\Usuario\capsula-migration\shanklish-erp-main`.

- Branch: `capsula/consolidation`
- HEAD: `95ba60e` ("docs(OPUS): add section 19...")
- Working tree: limpio

Cambio estratégico tomado hoy 2026-04-19: se pospone **2.D (admin UI
módulos)** y **2.E (seed bootstrap)** al *después* del cutover. Se
adelanta **Fase 4 (cutover repo) + Fase 5.a (switch Vercel producción)**.

Motivo: Omar necesita cortar el trabajo doble en dos repos lo antes
posible. 2.D y 2.E no son bloqueantes para el cutover — el admin UI
actual de shanklish funciona, y las DBs ya existen. Hacerlas *antes*
del cutover es perfeccionismo que cuesta días de trabajo duplicado.

Haciéndolas *después* del cutover, se hacen una sola vez, directamente
en `capsula-erp` como features normales, no como portaciones.

## Objetivo

Editar **únicamente** la sub-sección §19.11 "Fases pendientes" de
`OPUS_CONTEXT_CAPSULA.md`. Reflejar el nuevo orden. Agregar una sola
sub-sección nueva §19.13 documentando la decisión estratégica para
que el historial del doc explique por qué cambió el orden.

## Cambios específicos

### Cambio 1 — Reescribir §19.11 completa

Localiza la sub-sección `### 19.11 Fases pendientes` en el doc
(buscar con grep). Reemplaza su contenido completo por esto:

```markdown
### 19.11 Fases pendientes (orden actualizado 2026-04-19)

El orden de fases cambió el 2026-04-19 — ver §19.13 para el razonamiento.
Orden de ejecución vigente:

- **Fase 4 — Cutover repo (INMEDIATA)**. Force-push de
  `capsula/consolidation` → `capsula-erp/main`. Preview deploy en
  Vercel para validación. Tag `pre-cutover-2026-04-19` del estado
  previo de capsula-erp para rollback recuperable.
- **Fase 5.a — Switch Vercel producción (INMEDIATA)**. Cambiar el
  proyecto Vercel del cliente Shanklish Caracas para que apunte a
  `capsula-erp` en vez de `shanklish-erp-main`. La DB sigue siendo
  la misma AWS RDS de producción, sin migración. Las env vars se
  copian 1-a-1 antes del switch. Downtime estimado: ~30 segundos
  durante el redeploy de Vercel.
- **Fase 2.D — Admin UI módulos (POST-CUTOVER)**. Se ejecuta
  directamente en `capsula-erp` como feature normal, no como
  portación. Scope: `src/app/dashboard/config/modulos/`. Riesgo
  previsto medio por interacción con permisos 4-capa.
- **Fase 2.E — Seed bootstrap (POST-CUTOVER)**. Se ejecuta cerca
  del momento en que se agregue un segundo tenant real (Table Pong
  o similar), cuando el shape de tenant esté definido.
- **Fase 3 — Documentación multi-tenancy**. Documento `docs/MULTITENANCY.md`.
  No bloquea nada, se hace cuando haya banda.
- **Fase 5.b — Migración AWS RDS → Contabo (POSPUESTA)**. Ventana
  de mantenimiento de 2-4h. Se dispara cuando se necesite agregar
  un tenant real o cuando el costo de AWS RDS justifique el cambio.
  BASELINE-001 (§19.12) debe resolverse antes o durante esta fase.
```

### Cambio 2 — Agregar §19.13 al final de §19

Inmediatamente después de §19.12 (BASELINE-001) y antes del footer,
agrega esta nueva sub-sección:

```markdown
### 19.13 Decisión estratégica — reorden de fases (2026-04-19)

El plan original de consolidación tenía como último paso antes del
cutover completar 2.D (admin UI módulos) y 2.E (seed bootstrap).

A mitad de la Fase 2, tras cerrar 2.A, 2.B, 2.C.1, 2.C.2, 2.C.3.a,
2.C.3.b, 2.F y 2.DOCS, se reevaluó el orden. Hallazgos:

- El objetivo real del proyecto es **cortar el trabajo doble en dos
  repos**, no completar una portación visual perfecta. 2.D y 2.E no
  avanzan ese objetivo — solo refinan el UI de un módulo que ya
  funciona en shanklish.
- El branch `capsula/consolidation` en `95ba60e` ya cumple las
  condiciones de producción: tests verdes (27/27), CI verde, permisos
  4-capa intactos, branding aplicado, layouts reconciliados, deploy
  stub listo. No hay riesgo técnico en promover.
- Hacer 2.D y 2.E *antes* del cutover significa días adicionales de
  mantenimiento paralelo de dos repos (cambios del cliente Shanklish
  Caracas tienen que aplicarse en ambos o arriesgarse a divergencia).
  Hacerlas *después* del cutover significa trabajo una sola vez en
  el repo único.

Decisión: adelantar Fase 4 y Fase 5.a. Postponer 2.D y 2.E. Mantener
Fase 5.b (migración DB) postpuesta hasta que un tenant nuevo lo
justifique.

La BD de producción AWS RDS NO se toca en este reorden. El cutover
es solo de código y configuración Vercel.
```

## Validación local

- `(Get-Content OPUS_CONTEXT_CAPSULA.md).Count` — reporta total de
  líneas (esperado: ~3853 + ~60-70 = ~3920).
- Verifica con grep que §19.11 aparece una sola vez (no duplicada por
  error en la edición) y que §19.13 quedó antes del footer.

No corres `tsc` ni `test` — no afecta el build.

## Protocolo de commit

1. `git diff --stat` + `git status`. Único archivo tocado:
   `OPUS_CONTEXT_CAPSULA.md`. Si hay otro, PARA.

2. Auditoría de líneas rojas: confirma que no tocaste `prisma/`,
   `.env*`, `src/`, `package*.json`.

3. Si limpio:
   ```powershell
   git add OPUS_CONTEXT_CAPSULA.md
   git commit -m "docs(OPUS): update 19.11 + add 19.13 — fase order change (cutover first)"
   git push origin capsula/consolidation
   ```

4. Reporta hash del commit + confirmación de push.

## Líneas rojas — NO HACER

- ❌ tocar otras sub-secciones de §19 (solo §19.11 se reescribe;
  §19.13 se agrega nueva)
- ❌ tocar secciones 1-18 del doc
- ❌ editar otros archivos
- ❌ `git add .`
- ❌ cambiar el footer (ya está correcto en 2026-04-19)
- ❌ reclasificar BASELINE-001 (§19.12 queda intocada)
- ❌ inventar fechas o datos. Todo lo necesario está en este prompt.

