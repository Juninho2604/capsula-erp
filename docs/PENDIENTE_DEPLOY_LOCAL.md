# Pendiente de desplegar (histórico §134–§147)

> **Por qué existe este archivo.** Nació con el cutover del 2026-07-25, cuando
> Shanklish pasó a operar on-premise y el CI de GitHub **sólo desplegaba al
> VPS**: un deploy salía verde mientras el restaurante seguía con código viejo.

## Estado al 2026-08-09 — el destino volvió a ser el VPS

El equipo del restaurante (`KPSULA-LOCAL`) **murió** el 2026-08-08 tras la
manipulación de breakers: enciende, los ventiladores giran, pero no da POST ni
red. Shanklish volvió a la nube. **Ya no hay servidor local al que desplegar**,
y `scripts/local-server/update-local-server.sh` no aplica hasta que haya una
máquina nueva. El disco de la máquina muerta **no se toca ni se formatea**:
tiene las ventas del 2026-08-08 entre las 6:15 y las 11:49 (hora Caracas).

Lo que ahora manda es el deploy normal del CI a `main` → VPS.

### Segundo problema, encadenado: el deploy al VPS estaba roto

Al pasar el repo a privado (3 de agosto), `deploy-vps.sh` empezó a clonar por
SSH y el VPS nunca tuvo la deploy key. **Seis deploys seguidos murieron en el
paso `[2/9] Clone`** con `Permission denied (publickey)`, del 3 al 8 de agosto.
El job `Validate` salía verde, así que en la lista de Actions parecía normal.

Consecuencia concreta: **el VPS quedó parado en `768f6f7` (§145)**. Todo lo de
§134–§145 sí está, porque esos deploys corrieron antes del cambio de
visibilidad. Lo que **no** llegó es §146 y §147.

Arreglado en este mismo bloque: el runner empaqueta el árbol y se lo manda al
VPS (`capsula-src.tgz`), que ya no necesita credenciales de GitHub. Ver
`docs/SECURITY_POSTURE.md` §9.

## Cómo aplicar

Push a `main` — el CI hace backup de BD, build, `prisma migrate deploy`, smoke
test de Prisma y recién entonces el swap atómico. Si algo falla, aborta antes
del swap y la app vieja sigue atendiendo.

Verificar **el job `Deploy to Contabo VPS`**, no sólo `Validate`. Y en el VPS:

```bash
cd /var/www/capsula-erp
cat .deploy-commit                     # SHA que quedó activo
npx prisma migrate status              # "Database schema is up to date!"
pm2 status                             # capsula-erp online
curl -s localhost:3000/api/health
```

---

## ✅ Acumulado — aplicado el 2026-08-09

Todo lo de abajo está **en producción** desde el deploy de `455f8b1`
(2026-08-09 17:26 VPS / 11:26 Caracas): swap atómico OK, `prisma migrate
deploy` sin migraciones pendientes (78 encontradas), smoke test de Prisma OK,
`GET https://kpsula.app` → 200. Backup previo en
`capsula_erp_prod-deploy-20260809-172648.dump` (11 MB).

Se deja la tabla como registro de qué entró y qué verificar.



| § | Qué | Riesgo | Migración |
|---|---|---|---|
| §134 | Transferencias: las sub-recetas aparecen en el selector de ítems | Bajo — UI | No |
| §135 | Botón "Nuevo Insumo" en Inventario + Asistente movido al subgrupo Inventario del sidebar | Bajo — UI | No |
| §136 | Recetas: 3 `<span>` vacíos (huecos en blanco), "Agregar" → "Agregar Ingrediente", "+ Crear Insumo Nuevo" visible | Bajo — UI | No |
| §137 | Conteo Rápido: la hoja impresa coincide con los almacenes seleccionados (columna Contado por almacén) + rótulos en las casillas | Bajo — UI | No |
| §138.1 | Sesión de conteo persistente y auditable — 4 tablas nuevas + lógica pura (20 tests). **Nada la consume todavía** | Bajo — tablas nacen vacías | **Sí** (aditiva: solo CREATE TABLE/INDEX/FK) |
| §139 | **Ítems anulados reaparecían en cuentas separadas y se podían cobrar** | **Alto — plata** | No |
| §138.2 | Acciones del servidor del conteo auditable (crear/retomar/guardar/revisar/aplicar) | Bajo | No |
| §138.3 | **Pantallas del conteo**: lista para retomar, N almacenes, guardado automático al servidor, revisión de diferencias, bitácora. Reemplaza el flujo de localStorage | Medio — cambia el módulo que usa el chef | No |
| §141 | Documentos de proveedor: ya no salen "Sin proveedor" (los viejos se corrigen solos al listar) + botón **Editar** mientras no tengan entrada ni deuda | Medio — escritura en compras | No |
| §142 | Pickups de caja ahora salen bajo el filtro "Pickup" del historial (antes "Mesa") y en el conteo Pickup/Mostrador del Z. ⚠ Mueve conteos del Z entre categorías (no montos) — avisar a la cajera | Bajo | No |
| §143 | Costos: lapicito para editar el costo de un insumo directo en la tabla (Christian). Con historial y motivo | Bajo | No |
| §144 | **Cortesía 100% en mesa era imposible de cobrar** (3 candados en cadena; "Registrar pago" no hacía nada / "cuenta ya saldada") | Medio — money path, acotado a cortesía | No |
| §145 | **Kardex por producto** (Inventario → botón Kardex): movimientos con saldo corrido, filtro por almacén, y conciliación explícita del descuadre (caso masa filo 39→42 del chef) | Bajo — solo lectura | No |
| §146 | **"Cobro duplicado" en pago múltiple (TAB-4607)**: historial ya no muestra dos veces el dinero de subcuentas cobradas por el flujo general; aviso en POS antes de cobrar mesa completa con subcuentas abiertas; guardia anti-doble-Enter en el cobro (duplicado real potencial) | Medio — money path display + POS | No |

### Orden sugerido

Todo junto en un solo `update-local-server.sh`. La única migración (§138.1) es
puramente aditiva: crea 4 tablas nuevas y no toca ni una columna existente, así
que puede correr con la BD viva sin riesgo para lo que ya opera.

**§139 es el que apura**: hasta que no se aplique, un producto que el mesero
anula puede volver a cobrarse al pedir cuentas separadas.

---

## Verificación post-deploy (5 min)

1. **§139** — Mesa con productos → anular uno desde el mesero → abrir "Cuentas
   separadas". El anulado **no** debe aparecer en el pool.
2. **§137** — Conteo Rápido → seleccionar 2 almacenes → "Comenzar conteo" →
   "Imprimir hoja". El encabezado debe decir "Almacenes (2): … · …" y traer un
   par de columnas *Sist. | Contado* por almacén.
3. **§135** — Inventario → botón "+ Nuevo Insumo" arriba. Sidebar →
   Operaciones → Inventario → "Asistente de Nomenclatura".
4. **§134** — Transferencias → selector de ítem → una sub-receta debe aparecer
   con el sufijo "· Sub-receta".
5. **§141** — Compras → Documentos: los documentos que decían "Sin proveedor"
   deben mostrar el nombre. En uno SIN ENTRADA y sin deuda: botón "Editar" →
   agregar una línea → guardar → verificar el total.
6. **§142** — Historial de ventas → filtro "Pickup": deben aparecer los
   pickups cobrados en caja (PK-NN). El filtro "Mesa" ya no los muestra.
7. **§143** — Costos: lapicito en una fila → cambiar el costo → guardar →
   recargar y confirmar que quedó.
8. **§138** — Conteo Rápido ahora abre la lista de conteos. Probar el ciclo
   completo: "Nuevo conteo" → elegir 2-3 almacenes → escribir una cantidad →
   ver "Guardado" → **recargar la página** (la cantidad debe seguir ahí) →
   "Revisar diferencias" → aplicar con un usuario de gerencia.
   `npx prisma migrate status` → "up to date".
