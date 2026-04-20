CONTEXTO:

Estoy consolidando dos repos en uno solo llamado "Cápsula".
- Repo actual (donde trabajas): shanklish-erp-main. Base técnica con sistema de permisos 4 capas.
- Repo hermano (SOLO LECTURA): capsula-erp, en C:\Users\Usuario\capsula-migration\capsula-erp. Aporta presentación premium con grupos colapsables.

Rama actual: capsula/consolidation. Working tree limpio. Fases 2.A, 2.B y 2.C.1 ya commiteadas.

FASE: 2.C.2 — Sidebar. ESTE TURNO ES SOLO ANÁLISIS. No se modifica nada.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DURAS — lee dos veces
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROHIBIDO ESCRIBIR ARCHIVOS en este turno. No crear, no editar, no borrar. Solo leer.
2. PROHIBIDO `git *`, `npm *`, `npx *`.
3. PROHIBIDO modificar el árbol en absoluto. Si tocas un archivo por accidente, se aborta la fase.
4. PROHIBIDO proponer código o merges. Solo entregas el análisis estructurado que se pide abajo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee LOS DOS archivos completos:
  - Árbol actual (shanklish):  src/components/layout/Sidebar.tsx
  - Repo hermano (capsula):    C:\Users\Usuario\capsula-migration\capsula-erp\src\components\layout\Sidebar.tsx

Además, para dar contexto, lee también (solo para orientarte, no para reportar):
  - src/lib/constants/modules-registry.ts (shanklish)
  - src/lib/permissions/perm-to-modules.ts (shanklish)
  - src/hooks/use-permission.ts (shanklish)

Basándote en ambas versiones, produce un reporte con ESTA estructura exacta:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTREGA — formato obligatorio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## A. TAMAÑO Y ESTRUCTURA GLOBAL

- Shanklish Sidebar.tsx: NNN líneas totales.
- Capsula Sidebar.tsx:   NNN líneas totales.
- Diferencia de líneas: (shanklish - capsula).

## B. IMPORTS

Lista los imports de CADA versión (solo el path, no lo que importa).
Después:
- Imports que están en shanklish pero NO en capsula.
- Imports que están en capsula pero NO en shanklish.

## C. LÓGICA (hooks, state, side-effects)

Para cada versión, lista:
- Hooks de React usados (useState, useEffect, useMemo, etc.) con qué valor manejan.
- Llamadas a hooks custom de la app (useAuthStore, usePermission, useBranding, useRouter, usePathname, etc.).
- Variables derivadas importantes (p.ej. "visibleModules = ...").

## D. ESTRUCTURA DE NAVEGACIÓN / DATOS

Para cada versión:
- ¿De dónde sacan la lista de items del menú? (constant importada, prop, estado, mezcla).
- ¿Hay agrupamiento? (si sí, cómo se define cada grupo).
- ¿Hay filtrado por rol / permiso / módulo habilitado? (si sí, dónde está la condición).

## E. PRESENTACIÓN

Para cada versión, describe en 3-5 líneas:
- Layout general (ancho, fondo, divisiones).
- Tipografía y color de items.
- Comportamiento interactivo (hover, active state, colapso de grupos, tooltip, etc.).

## F. CRUCE — matriz de conflicto

Identifica DÓNDE se pisan las dos versiones. Para cada punto:
- Qué hace shanklish.
- Qué hace capsula.
- Por qué es conflicto (no pueden convivir tal cual).
- Severidad: ALTA / MEDIA / BAJA.

Ejemplo de cruce típico esperado:
- "Renderizado del listado de items":
  - Shanklish filtra por visibleModules derivados de permisos 4-capa.
  - Capsula filtra por una constante diferente o no filtra.
  - Conflicto ALTO: no se puede traer el render de capsula sin romper el filtrado de shanklish.

## G. PREGUNTAS QUE NECESITO RESPONDIDAS POR EL HUMANO

Máximo 5 preguntas puntuales cuya respuesta cambia la estrategia de merge.
Ejemplo de formato:
  1. ¿Los grupos colapsables de capsula deben filtrarse también por visibleModules, o son grupos estáticos hard-coded?
  2. ¿CapsulaNavbarLogo del header del sidebar debe ir por encima o por debajo del perfil de usuario que shanklish tiene?
  (etc.)

FIN DEL PROMPT — NO ESCRIBAS CÓDIGO. SOLO EL REPORTE.