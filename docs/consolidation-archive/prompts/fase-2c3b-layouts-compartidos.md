# Fase 2.C.3.b — Layouts compartidos restantes

## Contexto

Estás en `C:\Users\Usuario\capsula-migration\shanklish-erp-main`.

- Branch actual: `capsula/consolidation`
- HEAD: `089dee5` ("feat(layout): port HelpPanel and root page...")
- Working tree: limpio

Sub-fases ya cerradas que tocan layout:
- 2.A: branding + tokens + globals + layout.tsx raíz + CapsulaLogo
- 2.C.1: login
- 2.C.2: sidebar colapsable
- 2.C.3.a: HelpPanel (no-op) + root page.tsx

Fuente de portación: `C:\Users\Usuario\capsula-migration\capsula-erp\`
(solo lectura).

## Objetivo

Reconciliar los layouts restantes entre capsula-erp y shanklish-erp-main
en **dos zonas**:

1. `src/components/layout/` — excluyendo `Sidebar.tsx` y `HelpPanel.tsx`
   (ya procesados).
2. `src/app/**/layout.tsx` — todos los layouts anidados del app router.
   **El `src/app/layout.tsx` raíz NO se toca** (ya está mergeado en 2.A).

Esta sub-fase es **exploración + portación selectiva en lote**, no un
port masivo.

## Fase 1 — Inventario y clasificación

Recorre ambas zonas y construye una tabla con cada archivo encontrado.
Formato:

| # | Archivo (ruta relativa) | Existe en shanklish | Existe en capsula | Clasificación | Razón | Dependencias |
|---|---|---|---|---|---|---|

Clasificaciones permitidas:

- **`visual-only`** — solo JSX/styling, sin hooks, sin server-side logic.
  Safe port: portar directo.
- **`no-op`** — shanklish ya matchea capsula (caso HelpPanel de 2.C.3.a).
  Sin escritura.
- **`visual+logic`** — tiene `useState`, `useEffect`, `useSession`,
  `getSession`, `cookies()`, `headers()`, `redirect()`, `async function`
  (server component), o importa stores/actions. **Pausa obligatoria.**
- **`shanklish-only`** — existe en shanklish, no en capsula. No action.
- **`capsula-only`** — existe en capsula, no en shanklish. Requiere
  análisis: ¿trae dependencias nuevas? ¿es necesario?

### Regla especial para `src/app/**/layout.tsx`

**TODOS se marcan como mínimo `visual+logic` por default**, incluso si
a primera vista parecen puro JSX. Razón: los layouts del app router son
el lugar canónico para guards de sesión, providers globales, y server-side
redirects. Aunque el archivo solo tenga `return <div>{children}</div>`,
puede estar delegando lógica al árbol que lo envuelve. **Pausa obligatoria
en todos.** Solo los promueves a `visual-only` si tu análisis confirma
cero lógica en shanklish.

### Dependencias

Para cada archivo visual-only o visual+logic, lista los imports que no
son estándar (react, next, tailwind). Si capsula importa algo que no
existe en shanklish-erp-main, márcalo con ⚠️.

## Fase 2 — Reporte y espera

Presenta la tabla completa. **PARA.** No escribas nada.

Yo te respondo con aprobación en lote, que puede ser:

- `adelante con todos` (raro, asume que no hay visual+logic)
- `adelante con 1, 3, 5` (aprobación parcial — el resto se queda sin tocar)
- `paramos, analizamos X antes` (veto total hasta resolver una duda)

Tu tabla debe numerar los archivos del 1 en adelante para que pueda
responder por índice.

## Fase 3 — Portación

Solo sobre los archivos que yo apruebe explícitamente por número.

Criterio de merge en cada archivo aprobado:

- Presentación (JSX, className, tokens, colores) → de capsula.
- Lógica (hooks, redirects, guards, stores, actions) → de shanklish.
- Imports rotos → PARA y reporta, no adaptes.

No toques archivos que no haya aprobado. No hagas portaciones colaterales
"porque el import lo requiere". Si lo requiere, es bloqueo, no licencia.

## Fase 4 — Validación local

Después de cada archivo escrito (o al final si son varios):

- `npx tsc --noEmit`
- `npm run test`

Si algo falla, reporta y **no procedas al commit**.

## Fase 5 — Protocolo de commit

Cuando tsc + test estén verdes:

1. `git status` + `git diff --stat`. Reporta.

2. **Auditoría de líneas rojas.** Si el diff toca CUALQUIERA:
   - `prisma/`, `.env*`
   - `src/lib/permissions/`, `src/lib/auth.ts`, `src/middleware.ts`
   - `src/stores/auth.store.ts`, `src/app/actions/*.actions.ts`
   - `package.json`, `package-lock.json`

   PARA, no commitees, reporta el archivo.

3. Si limpio:
   ```powershell
   git add <archivos enumerados explícitamente, NO git add .>
   git commit -m "feat(layout): port <lista concisa> from capsula branding"
   git push origin capsula/consolidation
   ```

4. El commit message debe reflejar el **diff real**, no el scope planeado.
   Si aprobé 3 archivos y solo 2 generaron cambios (el tercero fue no-op
   en la práctica), el mensaje menciona los 2 que cambiaron.

5. Reporta hash del commit + confirmación de push.

## Líneas rojas — NO HACER

- ❌ `git add .`
- ❌ `npm install`
- ❌ tocar `package.json` / `package-lock.json`
- ❌ tocar `prisma/`, `.env*`
- ❌ tocar `src/lib/permissions/`, `src/lib/auth.ts`, `src/middleware.ts`,
  `src/stores/auth.store.ts`, `src/app/actions/*.actions.ts`
- ❌ tocar `src/app/layout.tsx` raíz (ya mergeado en 2.A)
- ❌ tocar `Sidebar.tsx`, `HelpPanel.tsx` (ya procesados)
- ❌ portar archivos que no aprobé por número explícito
- ❌ auto-promover un archivo de `visual+logic` a `visual-only` sin que yo
  confirme
- ❌ adaptar imports rotos
- ❌ escribir antes del "adelante" de Fase 2

Si algo de lo anterior se vuelve necesario, **PARA y repórtalo**.

