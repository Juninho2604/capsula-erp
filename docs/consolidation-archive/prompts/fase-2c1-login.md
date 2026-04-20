CONTEXTO:

Estoy consolidando dos repos en uno solo llamado "Cápsula".
- Repo actual (donde trabajas): shanklish-erp-main. BASE INTOCABLE EN LÓGICA.
- Repo hermano (solo lectura): capsula-erp, en C:\Users\Usuario\capsula-migration\capsula-erp. Aporta SOLO presentación.

Rama actual: capsula/consolidation. Working tree limpio. Fases 2.A y 2.B ya commiteadas (eec5e92, b310466).

FASE: 2.C.1 — Portar presentación premium del login desde capsula-erp, preservando toda la lógica de auth de shanklish.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENFOQUE — LEE ESTO DOS VECES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este NO es un merge aditivo como las fases anteriores. Es una EXTRACCIÓN QUIRÚRGICA de presentación.

Regla maestra:
  - La LÓGICA (hooks, state, handlers, calls a actions, redirects, validaciones) viene SIEMPRE de shanklish. Intocable.
  - La PRESENTACIÓN (JSX, className, imports de componentes visuales, wrappers decorativos) puede venir de capsula.

Si un cambio visual de capsula requiere alterar lógica de shanklish, NO lo haces. Lo reportas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DURAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROHIBIDO `git *`, `npm *`, `npx *`.
2. PROHIBIDO tocar fuera de login:
   - prisma/, .env*, src/lib/permissions/, src/lib/auth.ts, src/middleware.ts, src/stores/auth.store.ts
   - src/app/actions/*.actions.ts
   - Cualquier archivo que no sea de login
3. PROHIBIDO borrar archivos.
4. PROHIBIDO declarar éxito. Entregas resumen factual.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREA — PASO A PASO OBLIGATORIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### PASO 1 — Análisis comparativo (no escribir código aún)

Lee los 2 archivos en AMBOS repos:
  - src/app/login/page.tsx (capsula y shanklish)
  - src/app/login/login-form-client.tsx (capsula y shanklish)

Produce un diff mental y reporta en la entrega final, bajo "ANÁLISIS":

  Para cada uno de los 2 archivos:
    a) Qué HOOKS / STATE / HANDLERS / IMPORTS DE ACTIONS tiene shanklish que capsula no.
    b) Qué ELEMENTOS VISUALES (componentes, wrappers, classNames) tiene capsula que shanklish no.
    c) Conflictos: cualquier lugar donde capsula alteraría algo que shanklish agregó.

### PASO 2 — Decisión y ejecución

Solo si NO hay conflictos críticos, aplica los cambios visuales de capsula sobre la versión de shanklish. De lo contrario, déjalo sin tocar y lo reportas.

Cambios visuales comunes esperados de capsula:
  - Import de CapsulaLogo o componente similar del branding (ya existe en src/components/ui/CapsulaLogo.tsx — portado en 2.A).
  - Wrappers con classNames de fondo warm, coral, gradient, etc.
  - Botón primary con los nuevos tokens (bg-capsula-coral, etc.).
  - Layout premium (card centrada, padding, tipografía Nunito).

Lo que NO debes traer de capsula:
  - useState / useEffect / hooks propios si shanklish tiene otros.
  - Calls a actions o a signIn de NextAuth si shanklish tiene una versión distinta.
  - Validaciones de formulario si shanklish tiene las suyas.
  - Manejo de errores o loading si shanklish tiene.
  - Redirects post-login (shanklish redirige al primer módulo visible — esto es PARTE del sistema de permisos y NO SE TOCA).

### PASO 3 — Entrega

Imprime:

### ANÁLISIS (del paso 1)
Por cada archivo, puntos a/b/c como los describí.

### ARCHIVOS MODIFICADOS
Lista con path. Por cada uno, resumen de qué cambió visualmente.

### ARCHIVOS NO MODIFICADOS POR CONFLICTO
Si decidiste no tocar alguno, di por qué.

### SUGERENCIA DE COMMIT
Mensaje conventional commits.

FIN DEL PROMPT.