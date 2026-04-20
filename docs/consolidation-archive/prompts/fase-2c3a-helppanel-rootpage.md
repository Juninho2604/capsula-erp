Fase 2.C.3.a — Portar HelpPanel + root page
Contexto
Estás en C:\Users\Usuario\capsula-migration\shanklish-erp-main.

Branch actual: capsula/consolidation
HEAD: 19b85f6 ("ci: use prisma db push...")
Working tree: limpio
CI: verde en GitHub Actions (Fase 2.F cerrada)

Ya están portados desde capsula-erp:

2.A: branding tokens + assets + globals.css + layout.tsx
2.B: widgets de dashboard (KpiCard, Sparkline, FinancialSummaryWidget, ExecutiveSummary)
2.C.1: login premium (page.tsx + login-form-client.tsx)
2.C.2: sidebar colapsable (Sidebar.tsx)

Fuente de verdad para portaciones: C:\Users\Usuario\capsula-migration\capsula-erp\
(carpeta solo lectura, solo para leer — nunca escribir).
Objetivo
Portar dos archivos específicos desde capsula-erp, preservando cualquier
lógica de shanklish que exista en los equivalentes locales:

src/components/help/HelpPanel.tsx (o donde capsula-erp lo tenga ubicado)
src/app/page.tsx (root page)

Scope cerrado. Si durante la exploración detectas que HelpPanel o
app/page.tsx importan otros componentes no portados (ej. algún wrapper o
provider nuevo de capsula), PARA y repórtalo. No hagas portaciones
colaterales. Esa expansión entra en 2.C.3.b, tarea aparte.
Fase 1 — Exploración (antes de escribir)

Ubica HelpPanel en capsula-erp. Puede estar en:

src/components/help/HelpPanel.tsx
src/components/layout/HelpPanel.tsx
src/components/ui/HelpPanel.tsx
o alguna otra ruta. Usa grep/ls para encontrarla.


Verifica si existe un equivalente en shanklish-erp-main. Si existe,
muéstrame ambos archivos lado a lado (o al menos los imports + export
principal de cada uno) y describe las diferencias.
Lee src/app/page.tsx en ambos repos. Compáralos.
Reporta:

Ruta de HelpPanel en capsula vs shanklish (si aplica).
Diff conceptual: qué trae capsula (visual nuevo), qué tiene shanklish
que no se puede perder (lógica, redirects, guards).
Lista de imports de ambos archivos que HelpPanel/page.tsx usan y que
podrían no existir en shanklish (candidatos a portación colateral
que debemos evitar).



ESPERA CONFIRMACIÓN antes de escribir. Si el diff es limpio y
autocontenido, procedes. Si hay dependencias colaterales, paras.
Fase 2 — Escritura
Solo si el reporte de Fase 1 no tiene bloqueos. Criterio de merge:

Presentación (visual, JSX estructural, className, tokens, colores): se trae de capsula.
Lógica (hooks de sesión, redirects, permisos, stores, actions): se preserva de shanklish.
Imports: solo a archivos que ya existen en shanklish o que están en
paquetes instalados. Si capsula importa algo que shanklish no tiene, NO
adaptes — reporta.

Usa CapsulaLogo (de src/components/ui/CapsulaLogo.tsx, ya portado en 2.A)
si el original de capsula tenía un logo. No reintroduzcas emojis o assets
viejos.
Para src/app/page.tsx: cuidado extremo con cualquier redirect(),
getSession(), o lógica de bootstrap de sesión. Esa lógica es de shanklish
y va intacta.
Fase 3 — Validación local

npx tsc --noEmit (debe pasar)
npm run test (27/27 tests de permisos deben seguir pasando)

Si alguno falla, muéstrame el error y no procedas al commit.
Fase 4 — Protocolo de commit
Cuando tsc + test estén verdes:

Corre git diff --stat y git status. Muéstrame el output.
Auditoría de líneas rojas antes de commitear. Si el diff toca
CUALQUIERA de estos paths, PARA, no commitees, reporta el archivo:

prisma/
.env*
src/lib/permissions/
src/lib/auth.ts
src/middleware.ts
src/stores/auth.store.ts
src/app/actions/*.actions.ts
package.json o package-lock.json


Si el diff es limpio (solo toca los archivos del scope declarado —
HelpPanel y/o app/page.tsx, y nada más):

powershell   git add src/components/help/HelpPanel.tsx src/app/page.tsx
(ajusta las rutas al lugar real donde está HelpPanel; enumera los
archivos explícitamente, NO uses git add .)
powershell   git commit -m "feat(layout): port HelpPanel and root page from capsula branding"
powershell   git push origin capsula/consolidation

Reporta hash del commit + confirmación de push.

Líneas rojas — NO HACER

❌ git add . (siempre enumerar archivos)
❌ npm install
❌ tocar package.json / package-lock.json
❌ tocar prisma/
❌ tocar .env*
❌ tocar src/lib/permissions/, src/lib/auth.ts, src/middleware.ts,
src/stores/auth.store.ts, src/app/actions/*.actions.ts
❌ portar archivos fuera del scope (HelpPanel + app/page.tsx). Si detectas
dependencias colaterales, PARA y reporta
❌ adaptar imports rotos. Si falta algo, PARA y reporta
❌ borrar archivos

Si algo de lo anterior se vuelve necesario, PARA y repórtalo. Espera
instrucción antes de desviar.

