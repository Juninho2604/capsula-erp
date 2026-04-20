CONTEXTO:

Estoy consolidando dos repos en uno solo llamado "Cápsula".
- Repo actual (donde trabajas): shanklish-erp-main. Base técnica.
- Repo hermano: capsula-erp, ubicado en C:\Users\Usuario\capsula-migration\capsula-erp. NO se modifica. Solo se lee de ahí.

Rama actual: capsula/consolidation. Working tree LIMPIO al arrancar (la Fase 2.A ya quedó commiteada como eec5e92).

FASE ACTUAL: 2.B — Portar widgets de dashboard desde capsula-erp.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DURAS — no las rompes bajo ninguna circunstancia
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROHIBIDO `git commit`, `git add`, `git push`, `git stash`, `git checkout`. Yo manejo git.
2. PROHIBIDO `npm install`, `npm ci`, `npm run *`, `npx prisma *`. Solo edición.
3. PROHIBIDO tocar:
   - prisma/ (schema, migrations, seed)
   - .env* (cualquier env)
   - src/lib/permissions/
   - src/lib/auth.ts, src/middleware.ts, src/stores/auth.store.ts
   - src/hooks/use-permission.ts (ojo: con guion, es del sistema de permisos)
   - src/app/actions/*.actions.ts (cualquier Server Action)
4. PROHIBIDO borrar archivos. Solo crear o editar.
5. PROHIBIDO adaptar código si encuentras imports/tipos rotos. REPORTAS el archivo + qué import/tipo falla + qué decisión necesitas. Lo dejas sin copiar.
6. Al terminar, entregas SOLO el resumen factual pedido abajo. Sin self-congratulation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOQUE 1 — Archivos 100% nuevos (shanklish no los tiene)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copia desde C:\Users\Usuario\capsula-migration\capsula-erp al árbol actual, preservando path relativo:

  1.1  src/components/dashboard/KpiCard.tsx
  1.2  src/components/dashboard/SparklineChart.tsx
  1.3  src/components/dashboard/FinancialSummaryWidget.tsx
  1.4  src/components/dashboard/ExecutiveSummary.tsx
  1.5  src/app/dashboard/loading.tsx

Si src/components/dashboard/ no existe, créala.

VALIDACIÓN CRÍTICA por cada archivo del bloque 1:
- Revisa los imports del archivo copiado.
- Para cada import que NO sea librería externa (next, react, recharts, etc.) ni alias relativo del mismo archivo, verifica que el símbolo exista en el árbol actual de shanklish.
  - Ejemplo de aliases comunes: @/components/ui/*, @/lib/utils, @/config/branding, @/hooks/useBranding.
  - Si importa de @/lib/prisma o similar: OK, shanklish también lo tiene.
  - Si importa algo que NO existe en shanklish (ej. una action específica de capsula que shanklish no tiene): NO copies ese archivo, REPORTA el import roto y sigue con el siguiente.

Al finalizar bloque 1:
- Lista archivos creados con path y bytes.
- Lista archivos NO copiados con razón (imports rotos).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOQUE 2 — Merge del dashboard home
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Archivo: src/app/dashboard/page.tsx

Estrategia:
  a) Lee la versión de capsula-erp. Identifica qué widgets importa y cómo los layoutea.
  b) Lee la versión de shanklish. Identifica qué estructura tiene (probablemente tiene queries/server-side diferentes, uso de permisos 4-capa, etc.).
  c) NO reemplaces la versión de shanklish con la de capsula. En lugar de eso, AGREGA los 4 widgets nuevos (KpiCard, SparklineChart, FinancialSummaryWidget, ExecutiveSummary) al dashboard de shanklish preservando:
     - Cualquier query server-side que shanklish haga.
     - Cualquier uso de permisos/sesión que shanklish tenga.
     - Cualquier import de actions shanklish-específicas.
  d) Si el dashboard de shanklish es radicalmente distinto y no cabe una integración natural de los widgets sin decidir qué data les pasas:
     - NO intentes inventar queries ni hacer mocks de data.
     - DEJA el archivo de shanklish sin tocar.
     - REPORTA en la entrega final: "2.B dashboard/page.tsx no integrado — requiere decisión humana sobre qué queries alimentan los widgets".
  e) Si los widgets aceptan props con defaults sensibles, puedes agregarlos SIN props (usando defaults). Eso da al menos una integración visual aunque sea vacía. Eso es aceptable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTREGA FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ARCHIVOS NUEVOS
Lista con path relativo y bytes.

### ARCHIVOS MODIFICADOS
Lista con path relativo. Por cada uno: 1 línea resumen de qué cambió.

### ARCHIVOS NO COPIADOS POR CONFLICTO
Archivo, imports problemáticos, decisión requerida.

### SUGERENCIA DE COMMIT
Mensaje conventional commits.

FIN DEL PROMPT.