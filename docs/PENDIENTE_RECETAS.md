# Pendiente — Importación de recetas (STANDBY)

Estado: **en espera de confirmación del dueño**. Scripts y CSV ya commiteados.

## Listo
- `scripts/import-recetas.ts` — importador con ensayo (dry-run), `--apply`, `--parse-only`, `--type`.
- `scripts/data/recetas-produccion.csv` — 47 recetas importables (4 omitidas: 2 PORCIONES, 2 procesos).
- `scripts/data/recetas-restaurante.csv` — 99 recetas (una por tamaño, espejo del POS); 5 omitidas (armados).

## Falta confirmar con el dueño (lo que destrabamos cuando vuelva)
1. **Correr los ENSAYOS en el VPS** y pegar:
   - La lista de ingredientes **"NO ENCONTRADO"** (insumos que no matchean).
   - El **reporte de huérfanos del POS** (MenuItems sin receta vinculada).
2. **Datos faltantes detectados en el parseo** (revisar en el Excel):
   - `CREMA GARBANZO (HUMMUS)` y `CREMA GARBANZO ESPECIAL`: ingrediente base sin cantidad.
   - `SHAWARMA DE KAFTA 500GR`: solo el PAN tiene cantidad en ese tamaño.
   - `Mezcla Chaman`: `HARISSA`/`PIMENTON ROJO` sin cantidad; `COLORANTE ROJO` x2.
   - `Empanadas Sambusik MASA` y `Baklawa Pistacho`: posibles columnas corridas (unidad numérica).
3. **Sub-recetas inline** del archivo 2 (MIX DE VEGETALES, FRUTOS SECOS DE ARROZ,
   VEGETALES SALTEADOS): NO importadas — decidir si se cargan como sub-recetas.
4. **¿Existen como insumo/sub-receta?** `PROTEINA`, `PAN`, `VEGETALES SALTEADOS`,
   `ADEREZO FATOUSH`, `PEPINILLOS`, `CREMA AJO`(=Toum), `CREMA AJONJOLÍ`(=Tarator).

## Orden de corrida (importa)
1. `recetas-produccion.csv` (crea sub-recetas) → 2. `recetas-restaurante.csv --type=FINISHED_GOOD`.
