Mini-auditoría §19 — review self-audit con citas
Contexto
Acabas de escribir §19 "Consolidación Cápsula" en
OPUS_CONTEXT_CAPSULA.md (commit 95ba60e, 198 líneas agregadas). La
§19 ocupa aproximadamente L3653–L3839. Esta tarea es auditoría pura,
pura lectura, cero escritura.
Hay un sesgo inherente a revisar tu propio trabajo. Para neutralizarlo,
este audit te obliga a citar líneas específicas del archivo como
evidencia para cada check, no a decir "sí, lo incluí" de memoria. Si
no puedes citar, es FAIL — aunque tu memoria diga lo contrario.
Lee el archivo fresco desde disco (no asumas que recuerdas lo que
escribiste). Reporta en el formato exacto que se pide abajo.
Metodología
Para cada uno de los 3 bloques de audit, ejecuta este flujo:

Lee la sub-sección completa (§19.2, §19.7 o §19.12) del archivo.
Para cada sub-check, busca evidencia literal en el texto.
Clasifica cada sub-check como:

PASS — elemento presente. Cita las líneas (número + texto
textual de 3-10 palabras que prueba la presencia).
FAIL — elemento ausente. Confirma que lo buscaste y no está.
PARTIAL — presente pero débil o incompleto. Cita lo que hay
y describe qué falta.


Al final del bloque, veredicto global: PASS / FAIL / NEEDS_EXPANSION.

Bloque 1 — §19.2 "Modelo de portación"
Localiza la sub-sección y verifica cada sub-check:
1.1. Regla maestra explícita: aparece literalmente la idea
"presentación de capsula, lógica de shanklish" (o equivalente
inequívoco).
1.2. Definición de "presentación": dice qué cuenta como
presentación (JSX, className, tokens, colores, copy secundario, etc).
1.3. Definición de "lógica": dice qué cuenta como lógica (hooks
de sesión, redirects, guards, stores, actions, middleware, permisos).
1.4. Excepción de copy operativo: aparece la idea de que copy
operativo concreto de shanklish gana sobre copy genérico de capsula,
con el caso concreto de "PedidosYA" vs "Canales Externos" como
ejemplo.
1.5. Las 7 líneas rojas enumeradas: lista explícita de los 7 paths
protegidos: prisma/, .env*, src/lib/permissions/,
src/lib/auth.ts, src/middleware.ts, src/stores/auth.store.ts,
src/app/actions/*.actions.ts.
Test mental para el bloque 1: si una sesión 100% fresca de Claude
Code solo tiene §19.2 como contexto y le pides que arranque 2.D, ¿puede
hacerlo sin preguntarte cosas que ya deberían estar en esta sub-sección?
Bloque 2 — §19.7 "Fase 2.C.2 Sidebar"
Localiza la sub-sección y verifica cada sub-check:
2.1. Los dos commits citados: aparecen 1e0cdb6 y 3798142
explícitamente.
2.2. Decisión D1 (sync useEffect con login + setPermissions
idéntico a shanklish): presente con contenido concreto, no solo
mención "D1".
2.3. Decisión D2 (grouping híbrido con SIDEBAR_TREE visual +
red "Otros" con orphanSection useMemo): presente con contenido
concreto.
2.4. Decisión D3 (agregados asistente, modulos_usuario,
module_config + corrección del typo modulos de capsula):
presente con los 3 módulos listados.
2.5. Decisión D4 (Finanzas sección top-level independiente del
registry.section): presente con contenido.
2.6. Decisión D5 (CapsulaNavbarLogo sin fallback al emoji):
presente.
2.7. Fix TS2802 (Array.from(visibleMap.keys()) por error
MapIterator): mencionado.
2.8. Crecimiento del archivo (253 → 683 líneas): mencionado.
Test mental para el bloque 2: si el Sidebar se rompe en producción
dentro de 6 meses y alguien consulta §19.7 para entender por qué quedó
como está, ¿encuentra las 5 decisiones con suficiente detalle para
reconstruir el razonamiento?
Bloque 3 — §19.12 "BASELINE-001"
Localiza la sub-sección y verifica cada sub-check:
3.1. Identificador "BASELINE-001": aparece literalmente.
3.2. Descripción del problema: explica que prisma/migrations/
carece de migración 0_init y que las 26 son solo deltas.
3.3. Raíz histórica: menciona que el schema base se creó via
prisma db push en era pre-migrations.
3.4. Síntoma específico: menciona que el CI falló en
20260308000000_add_order_name_to_purchase_order con
ALTER TABLE "PurchaseOrder" sin CREATE previo.
3.5. Por qué producción no lo nota: explica que prod/Contabo
tienen tablas preexistentes y por eso no falla allí.
3.6. Mitigación actual: menciona que CI usa prisma db push
en vez de migrate deploy.
3.7. Fix definitivo para Fase 3: incluye el comando concreto
prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
(o al menos la idea de migrate diff --from-empty).
3.8. Plan post-baseline: menciona marcar la migración como
--applied en Contabo y AWS RDS, y revertir CI a migrate deploy.
Test mental para el bloque 3: si Omar arranca Fase 3 dentro de 2
meses y busca cómo resolver BASELINE-001, ¿§19.12 sola le da todo el
contexto operativo, o tiene que ir a buscar conversaciones viejas?
Formato final del reporte
Responde en este formato exacto, sin preamble ni conclusiones fuera de
esta estructura:
## Bloque 1 — §19.2

1.1 [PASS/FAIL/PARTIAL] — evidencia: "L#### texto citado"
1.2 [PASS/FAIL/PARTIAL] — evidencia: ...
1.3 [PASS/FAIL/PARTIAL] — evidencia: ...
1.4 [PASS/FAIL/PARTIAL] — evidencia: ...
1.5 [PASS/FAIL/PARTIAL] — evidencia: ...

Veredicto bloque 1: [PASS / FAIL / NEEDS_EXPANSION]

## Bloque 2 — §19.7

2.1 [PASS/FAIL/PARTIAL] — evidencia: ...
(... hasta 2.8)

Veredicto bloque 2: [PASS / FAIL / NEEDS_EXPANSION]

## Bloque 3 — §19.12

3.1 [PASS/FAIL/PARTIAL] — evidencia: ...
(... hasta 3.8)

Veredicto bloque 3: [PASS / FAIL / NEEDS_EXPANSION]

## Resumen

- Total checks: 21
- PASS: X
- PARTIAL: Y
- FAIL: Z
- Recomendación: [cerrar 2.DOCS / follow-up commit para expandir §19.A, §19.B]
Líneas rojas — NO HACER

❌ editar OPUS_CONTEXT_CAPSULA.md (ni "mejoras menores")
❌ editar ningún otro archivo
❌ git de cualquier tipo
❌ expandir §19 aunque encuentres FAILs (yo decido si amerita commit
follow-up, no tú)
❌ razonar desde memoria de lo que escribiste — solo desde el
archivo leído fresco
❌ clasificar PASS sin cita literal de línea + texto. Si no puedes
citar, es FAIL o PARTIAL por definición.

Si algo de lo anterior se vuelve necesario, PARA y repórtalo.

