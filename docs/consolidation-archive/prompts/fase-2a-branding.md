CONTEXTO:

Estoy consolidando dos repos en uno solo llamado "Cápsula".
- Repo actual (donde estás trabajando): shanklish-erp-main. Base técnica. Tiene sistema de permisos 4 capas, void tracking, table transfer — todo lo avanzado a nivel backend.
- Repo hermano: capsula-erp, ubicado en C:\Users\Usuario\capsula-migration\capsula-erp. NO se modifica bajo ninguna circunstancia. Solo se lee de ahí. Tiene el rebranding visual "CÁPSULA Coral Energy".

Rama actual: capsula/consolidation (creada desde master de shanklish). Working tree limpio.

FASE ACTUAL: 2.A — Portar assets y tokens de branding CÁPSULA al árbol de shanklish.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DURAS — no las rompes bajo ninguna circunstancia
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROHIBIDO `git commit`, `git add`, `git push`, `git stash`. Yo manejo git manualmente.
2. PROHIBIDO `npm install`, `npm ci`, `npm run *`, `npx prisma *`. Solo edición de archivos.
3. PROHIBIDO tocar estos archivos/carpetas (son la base técnica de shanklish; portarlos a capsula sería retroceso):
   - prisma/ (schema.prisma, migrations/, seed.ts)
   - .env, .env.local, .env.production, .env.example
   - src/lib/permissions/ (completa)
   - src/lib/auth.ts
   - src/middleware.ts
   - src/stores/auth.store.ts
   - src/hooks/use-permission.ts
   - src/app/actions/*.actions.ts (cualquier Server Action)
4. PROHIBIDO borrar archivos. Solo creas o editas.
5. PROHIBIDO "adaptar" código por tu cuenta si un archivo de capsula-erp tiene imports rotos en shanklish. En su lugar: REPORTAS el archivo + los imports que fallan y lo dejas SIN copiar.
6. PROHIBIDO declarar la fase "exitosa" automáticamente o hacer self-congratulation. Al final solo entregas un resumen factual.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOQUE 1 — Archivos 100% nuevos (shanklish no los tiene)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copia desde C:\Users\Usuario\capsula-migration\capsula-erp al árbol actual, preservando path relativo:

  1.1  src/config/branding.ts
  1.2  src/config/social-brand.ts
  1.3  src/hooks/useBranding.ts
  1.4  src/components/ui/CapsulaLogo.tsx
  1.5  Carpeta completa public/brand/ (todos los SVG adentro)

Si una carpeta padre no existe en shanklish (ej. src/config/), créala.

IMPORTANTE sobre 1.3 (useBranding.ts):
- Shanklish TIENE un archivo src/hooks/use-permission.ts (NOTA: con guion, no con mayúscula intermedia). Son archivos distintos, no hay conflicto. useBranding.ts es nuevo.

Al finalizar bloque 1, lista los archivos creados con sus rutas y bytes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOQUE 2 — Archivos que existen en ambos repos (merge)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para cada uno: lee ambas versiones, identifica qué agregó capsula-erp, aplica esos cambios preservando TODO lo que shanklish haya agregado por su cuenta.

  2.1  tailwind.config.ts
       - Capsula agrega tokens de color CÁPSULA (coral, navy, gold) y posiblemente Nunito.
       - Shanklish puede tener tokens propios; preservar.
       - Si mismo token en ambos → preferir capsula (es el rebranding intencional).

  2.2  src/app/globals.css
       - Capsula agrega variables CSS del tema Coral Energy.
       - Shanklish puede tener reglas propias; preservar.
       - Si misma variable → preferir capsula.

  2.3  package.json
       - Solo AGREGAR dependencias que capsula tenga y shanklish no.
       - NO tocar el bloque "scripts" de shanklish (tiene "test" y "test:watch" con vitest, críticos).
       - NO cambiar versiones de deps ya existentes (si hay conflicto, preferir shanklish).

  2.4  src/app/layout.tsx
       - Capsula agrega la fuente Nunito y metadata CÁPSULA.
       - Shanklish puede tener providers / wrappers propios (next-auth session, theme provider, etc.). Preservar absolutamente todos.
       - El <html>, <body>, y lang deben mantenerse del shanklish actual si están presentes.

Al finalizar cada archivo del bloque 2, imprime un diff resumido (3-5 líneas) de qué agregaste.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTREGA FINAL (al terminar ambos bloques)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Imprime, en ESTE orden exacto y con encabezados:

### ARCHIVOS NUEVOS
Lista con path relativo y tamaño en bytes.

### ARCHIVOS MODIFICADOS
Lista con path relativo. Para cada uno: una línea con "agregado: [resumen de qué]".

### CONFLICTOS O REPORTES PENDIENTES
Cualquier archivo donde no pudiste hacer merge limpio: qué archivo, qué import o símbolo falta, qué decisión necesitas del humano.

### SUGERENCIA DE COMMIT (no ejecutar)
Texto sugerido para el mensaje de commit, formato conventional commits.

FIN DEL PROMPT.