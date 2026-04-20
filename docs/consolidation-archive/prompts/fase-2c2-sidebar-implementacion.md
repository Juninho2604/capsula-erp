CONTEXTO:

Estoy consolidando dos repos en uno solo llamado "Cápsula".
- Repo actual (donde trabajas): shanklish-erp-main. Base técnica con sistema de permisos 4 capas.
- Repo hermano (SOLO LECTURA): capsula-erp, en C:\Users\Usuario\capsula-migration\capsula-erp. Aporta presentación premium con grupos colapsables.

Rama actual: capsula/consolidation. Working tree limpio. Fases 2.A, 2.B, 2.C.1 ya commiteadas.

FASE: 2.C.2 — Sidebar. Turno de IMPLEMENTACIÓN (el análisis se hizo en el turno anterior).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISIONES DE DISEÑO TOMADAS POR EL HUMANO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Estas son las reglas que debes implementar. Son fijas.

### D1. Permisos 4-capa — NO SE TOCAN
El useEffect de sincronización del store de auth debe llamar a:
  - login(...)
  - setPermissions({ allowedModules, grantedPerms, revokedPerms })
Ambos. Igual que en el shanklish actual. NO uses la versión de capsula que solo llama login().

### D2. Grouping — HÍBRIDO
El árbol visual se define en una constante SIDEBAR_TREE (como hace capsula) PERO con red de seguridad: cualquier módulo que esté en visibleMap y NO aparezca en SIDEBAR_TREE debe caer automáticamente al final, dentro de una sección "Otros" bajo admin. Así ningún módulo del registry queda invisible por olvido.

Algoritmo sugerido (ajústalo si ves mejor):
  1. Recorrer SIDEBAR_TREE y renderizar secciones/subgrupos/items, filtrando por visibleMap.
  2. Calcular: itemsEnTree = set de moduleIds que aparecen en SIDEBAR_TREE (incluyendo dentro de subgrupos).
  3. Calcular: itemsHuerfanos = [...visibleMap.keys()].filter(id => !itemsEnTree.has(id)).
  4. Si hay huérfanos: renderizar una sección adicional "Otros" al final de admin con esos items.

### D3. Módulos huérfanos en SIDEBAR_TREE
Agregar EXPLÍCITAMENTE al SIDEBAR_TREE estos módulos que faltan (bajo admin a menos que el registry diga otra cosa):
  - asistente
  - modulos_usuario
  - module_config (en capsula figura como 'modulos' — ES UN TYPO; corregir a 'module_config')

Con D2 ya habría red de seguridad, pero prefiero tenerlos explícitos desde el arranque.

### D4. Finanzas como sección propia
Mantener la decisión de capsula: 'finanzas' es una sección visible al nivel de operations/sales/admin, NO anidada dentro de admin. Aunque el campo registry.section de esos módulos diga 'admin', la visualización lo manda el tree.

### D5. Header
Usar <CapsulaNavbarLogo /> sin fallback al emoji 🧀. Descartar el cuadro amber-to-orange del header viejo de shanklish.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DURAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROHIBIDO `git *`, `npm *`, `npx *`.
2. PROHIBIDO tocar fuera de src/components/layout/Sidebar.tsx. Si necesitas editar algo más, REPORTA en vez de hacerlo.
3. PROHIBIDO borrar archivos.
4. PROHIBIDO remover el setPermissions en el useEffect de sincronización. Eso es regresión inaceptable.
5. PROHIBIDO declarar éxito. Entregas resumen factual al final.
6. Si encuentras ambigüedad (ej: un moduleId en capsula SIDEBAR_TREE que no existe en el registry de shanklish), NO inventes. Reporta el item y déjalo fuera del tree. Lo resolveremos después.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCHIVO A MODIFICAR (solo uno)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/components/layout/Sidebar.tsx

Estrategia:
  a) Usa como BASE la versión de shanklish actual (que tiene setPermissions y getModulesBySection).
  b) AGREGA encima, adaptado, de capsula:
     - SIDEBAR_TREE (con los fixes de D3).
     - Lógica de subgrupos colapsables con chevron + animación grid-template-rows 0fr↔1fr.
     - useState de sectionsState y subGroupsState (mapas id → abierto/cerrado).
     - useEffect de load/save localStorage (capsula-sidebar-v1).
     - useEffect de auto-expand de sección/subgrupo cuando la ruta activa está adentro.
     - useMemo de visibleMap.
     - CapsulaNavbarLogo en el header.
     - SCHEMES (clases CSS por esquema de color por sección).
  c) ADAPTA el loop de render para usar visibleMap + SIDEBAR_TREE + red de seguridad "Otros" (D2).
  d) PRESERVA absolutamente:
     - El useEffect que llama login() + setPermissions() (D1).
     - El useEffect que cierra el sidebar al cambiar ruta en mobile.
     - El overlay mobile (bg-black/50 fixed inset-0 z-40).
     - La lógica de sidebarOpen/closeSidebar del UI store.
     - El componente ChangePasswordDialog si está en el footer del sidebar actual.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTREGA FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ARCHIVO MODIFICADO
Path + resumen factual de los bloques que quedaron (imports, hooks usados, estructura de render).

### DECISIONES APLICADAS
Una línea por cada D1–D5 confirmando cómo se implementó.

### MÓDULOS HUÉRFANOS DETECTADOS
Si tras aplicar D3 y D2 aún hay IDs en SIDEBAR_TREE que no matchean con ningún módulo del registry actual, listarlos. No los inventes.

### RIESGOS / PENDIENTES
Cualquier cosa que decidiste dejar fuera para no violar reglas o que quedó con TODO.

### SUGERENCIA DE COMMIT
Conventional commits.

FIN DEL PROMPT.

