# Pendiente de desplegar al servidor local (KPSULA-LOCAL)

> **Por qué existe este archivo.** Desde el cutover del 2026-07-25, Shanklish
> opera on-premise: la app y la BD viven en el equipo del restaurante. El CI de
> GitHub **solo despliega al VPS**, cuya app está detenida (contingencia). Por
> eso un deploy puede salir "success" en verde mientras el restaurante sigue
> con código viejo. Ver `docs/LOCAL_SERVER.md` §6 y `docs/SHANKLISH_ONPREM_ASBUILT.md`.

## Cómo aplicar

Fuera de horario — el script hace build y reinicia pm2, y ese equipo **es** el
que factura.

```bash
ssh root@147.93.6.70            # 1. VPS
ssh -p 2223 kpsula@127.0.0.1    # 2. saltar al servidor del restaurante
bash scripts/local-server/update-local-server.sh
```

Hace backup previo, `git pull`, build, `prisma migrate deploy` y restart.

Después, verificar:

```bash
npx prisma migrate status              # "Database schema is up to date!"
pm2 status                             # capsula-erp online
curl -s localhost:3000/api/health
```

**Con migraciones pendientes** (hay una, ver abajo): actualizar el VPS **en el
mismo bloque de trabajo**, para que el dump que viaja al VPS nunca tenga un
schema más nuevo que el código del stack de contingencia.

---

## Acumulado pendiente

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
