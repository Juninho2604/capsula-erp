Fase 2.DOCS paso 1 — Diagnóstico de OPUS_CONTEXT_CAPSULA.md
Contexto
Estás en C:\Users\Usuario\capsula-migration\shanklish-erp-main.

Branch actual: capsula/consolidation
HEAD: 089dee5 ("feat(layout): port HelpPanel and root page...")
Working tree: limpio

OPUS_CONTEXT_CAPSULA.md es la fuente única de verdad del sistema Shanklish
ERP / Cápsula. Vive en la raíz del repo (o cerca). Se estima en ~1,571
líneas y ~18 secciones.
El doc no se ha actualizado en varias sesiones. Hemos cerrado las
sub-fases 2.A, 2.B, 2.C.1, 2.C.2, 2.C.3.a, 2.C.3.b y 2.F sin tocarlo.
Esta tarea es pura lectura y reporte. No vas a escribir nada. No vas
a editar el doc. El diagnóstico de hoy alimenta el paso 2 (update real),
que se planea en base a lo que reportes.
Objetivo
Producir un reporte estructurado del estado actual del doc para que el
humano pueda decidir:

Si hay que reescribir secciones existentes in-place.
Si hay que agregar una sección nueva "Consolidación Cápsula" al final.
Si el doc tiene inconsistencias internas (dos fechas distintas hablando
del mismo tema, por ejemplo).

Paso 1 — Localización

Busca OPUS_CONTEXT_CAPSULA.md en el repo. Comandos sugeridos:

powershell   Get-ChildItem -Path . -Recurse -Filter "OPUS_CONTEXT_CAPSULA.md" -File | Select-Object FullName, Length, LastWriteTime

Si no está en este repo, busca también en C:\Users\Usuario\capsula-migration\
por si vive fuera del repo pero dentro del workspace.
Si encuentras múltiples copias, lístalas todas con ruta + tamaño +
fecha de modificación. Determina cuál es la "canónica" (típicamente
la más grande y la más reciente).
Reporta ruta + size + LastWriteTime + número total de líneas (wc -l
o (Get-Content file).Count).

Paso 2 — Tabla de contenidos
Extrae la TOC completa del doc. Un header por línea, con su nivel y número
de línea en el archivo. Formato:
L12   #      Título principal
L34   ##     Sección 1 — Arquitectura del sistema
L89   ###    1.1 Stack tecnológico
L156  ##     Sección 2 — Modelos Prisma
...
Lista TODOS los headers, no resumas. Si son 18 secciones y 60 sub-secciones,
quiero ver las 78 líneas de TOC.
Paso 3 — Detección de menciones clave
Busca en todo el doc y reporta línea + texto (3-5 palabras de contexto
alrededor) de las siguientes menciones:

Cualquier variante de "Fase" seguida de un número o letra
(Fase 1, Fase 2, Fase 2.A, Fase 3, etc.)
consolidación, consolidation
capsula/consolidation (el nombre del branch)
Cápsula (con y sin tilde)
DIVERGENCE_REPORT o cualquier referencia al reporte de divergencia
Contabo
multi-tenant, multi-tenancy, tenant
Hashes cortos de commit (regex [a-f0-9]{7}\b — 7+ hex chars)
Fechas en formato 2026-04-* (o más amplio si el doc usa otro formato)

Agrupa por categoría. Si una categoría tiene más de 20 matches, dame los
primeros 10 y los últimos 5 con un contador del total.
Paso 4 — Fechas y estado temporal
Identifica la fecha o commit "más reciente" mencionado en el doc. Esto
me dice hasta cuándo cubre la documentación. Reporta:

Fecha más reciente encontrada (con su línea).
Commit hash más reciente encontrado (con su línea). Si mencionas un
hash, intenta resolver git log -1 <hash> para saber de qué commit
habla y cuándo fue.
Si hay contradicciones (dos secciones con fechas muy distintas hablando
del mismo tema), lístalas.

Paso 5 — Lectura estratégica
Clasifica el doc en uno de estos tres escenarios:

Escenario A: El doc está actualizado hasta antes de la consolidación
Cápsula. No menciona branch capsula/consolidation, no menciona Fase 1
de migraciones, no menciona branding CÁPSULA, no menciona CI/CD workflow.
→ Hay que agregar toda una sección nueva "Consolidación Cápsula" con
sub-secciones por fase.
Escenario B: El doc menciona la consolidación pero parcialmente.
Algunas sub-fases están documentadas, otras no. → Identificar qué falta
y decidir si mezcla in-place o append.
Escenario C: El doc está inconsistente. Menciona cosas que ya no
son verdad (ej. "branch master" cuando ya movimos a capsula/consolidation),
o tiene secciones contradictorias. → Requiere debugging antes del
update.

Justifica tu clasificación en 3-5 bullets con evidencia específica (líneas
concretas del doc).
Paso 6 — Propuesta de plan
Al final del reporte, bajo el título ## Propuesta de plan para paso 2,
propón cómo harías el update si tuvieras luz verde. Ejemplos:

"Agregaría una sección 19 titulada 'Consolidación Cápsula 2026-04' con
7 sub-secciones (2.A, 2.B, 2.C.1, 2.C.2, 2.C.3.a, 2.C.3.b, 2.F) de
~30-60 líneas cada una."
"Editaría la sección 5 (Sistema de Permisos) para reflejar que ahora
está en src/lib/permissions/ y no en src/lib/auth/permissions.ts
como dice el doc actualmente."
"La sección 12 (Branding) necesita reescritura completa porque el doc
asume paleta amber/orange; hoy es Coral Energy (#FF6B4A)."

La propuesta es una recomendación, no una acción. No ejecutas nada.
Formato final del reporte
Organiza tu respuesta en exactamente estas secciones:
## 1. Localización
## 2. TOC completa
## 3. Menciones clave (agrupadas por categoría)
## 4. Fechas y estado temporal
## 5. Escenario identificado (A / B / C) + justificación
## 6. Propuesta de plan para paso 2
Líneas rojas — NO HACER

❌ EDITAR OPUS_CONTEXT_CAPSULA.md (ni siquiera "arreglos menores")
❌ editar ningún otro archivo
❌ git add / commit / push
❌ npm install
❌ tocar prisma/, .env*, src/
❌ decidir el plan del paso 2 tú solo — solo propones, yo apruebo
❌ resumir la TOC. Quiero todos los headers, uno por línea.

Si algo de lo anterior se vuelve necesario, PARA y repórtalo.