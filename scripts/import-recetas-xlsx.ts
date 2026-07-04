/**
 * IMPORTADOR DE RECETAS DESDE LA PLANTILLA EXCEL — Plantilla_Recetas_CAPSULA.xlsx
 *
 * Lee el .xlsx DIRECTO (sin pasar por CSV) con las hojas:
 *   - INSUMOS_NUEVOS       → crea InventoryItem RAW_MATERIAL que no existan
 *   - RECETAS_CABECERA     → una fila por receta (tipo, salida, rinde, tiempos)
 *   - RECETAS_INGREDIENTES → una fila por ingrediente por receta
 *   - MENU_ITEMS (opcional)→ crea/actualiza MenuItems y los vincula a recetas
 *
 * Matching de ingredientes (mismo criterio que import-recetas.ts §63):
 *   exacto por nombre normalizado → nombre sin sufijo de unidad (si es único)
 *   → producto de salida de una receta de ESTA corrida → NO ENCONTRADO.
 *   Con --create-missing los no encontrados se crean como placeholder
 *   (categoría IMPORT_REVISAR, costo 0) para que ninguna receta se bloquee.
 *
 * Recetas que YA existen (match por nombre normalizado, no borradas): se les
 * reemplazan los ingredientes y se actualiza la cabecera (version +1).
 *
 * Uso (en el VPS, desde /var/www/capsula-erp):
 *   SEED_TENANT_SLUG=shanklish npx tsx scripts/import-recetas-xlsx.ts <archivo.xlsx>            # ENSAYO
 *   SEED_TENANT_SLUG=shanklish npx tsx scripts/import-recetas-xlsx.ts <archivo.xlsx> --apply
 *   ... --create-missing   # crea insumos placeholder para ingredientes sin match
 *
 * Las filas de ejemplo de la plantilla (Salsa Picante Casa, Ají Molido, etc.)
 * se detectan por firma exacta y se saltan con aviso — pero BORRALAS igual.
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const FILE = process.argv[2];
const APPLY = process.argv.includes('--apply');
const CREATE_MISSING = process.argv.includes('--create-missing');
// --prune: después de aplicar, soft-deletea toda receta viva que NO vino en
// esta plantilla → "borrón y cuenta nueva" SIN ventana sin descargo: las
// recetas del archivo reemplazan in-place ANTES de podar el resto.
// Por default preserva reventa/bebidas (mismo criterio que
// soft-delete-recipes.ts); --prune-all poda absolutamente todo lo no cargado.
const PRUNE = process.argv.includes('--prune') || process.argv.includes('--prune-all');
const PRUNE_ALL = process.argv.includes('--prune-all');

if (!FILE || FILE.startsWith('--')) {
    console.error('Uso: npx tsx scripts/import-recetas-xlsx.ts <archivo.xlsx> [--apply] [--create-missing] [--prune|--prune-all]');
    process.exit(1);
}

// ─── Normalización (misma familia que import-recetas.ts) ────────────────────
function norm(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}
const UNIT_SUFFIX = new Set(['KG', 'LTS', 'LT', 'L', 'UND', 'UNID', 'UNIDAD', 'UN', 'GR', 'GRS', 'G', 'ML']);
function stripUnitSuffix(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1 && UNIT_SUFFIX.has(parts[parts.length - 1].toUpperCase().replace(/\.$/, ''))) {
        return parts.slice(0, -1).join(' ');
    }
    return name;
}
const UNIT_MAP: Record<string, string> = {
    GR: 'G', GRS: 'G', G: 'G', KG: 'KG', ML: 'ML', L: 'L', LT: 'L', LTS: 'L',
    UND: 'UNIT', UNID: 'UNIT', UNIDAD: 'UNIT', UNIT: 'UNIT', PORTION: 'PORTION', PORCION: 'PORTION',
};
function normUnit(raw: string): string {
    const u = String(raw ?? '').trim().toUpperCase().replace(/\.$/, '');
    return UNIT_MAP[u] ?? (u || 'G');
}
const toStr = (v: unknown): string => String(v ?? '').trim();
function toNum(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
}
const toBool = (v: unknown): boolean => ['SI', 'SÍ', 'YES', 'TRUE', '1'].includes(toStr(v).toUpperCase());

// Firmas de las filas de EJEMPLO de la plantilla (col 1 normalizada) — se saltan con aviso.
const EXAMPLE_ROWS: Record<string, Set<string>> = {
    INSUMOS_NUEVOS: new Set(['aji molido', 'aceite girasol', 'vinagre blanco', 'pan arabe grande', 'pollo pechuga crudo'].map(norm)),
    RECETAS_CABECERA: new Set(['salsa picante casa', 'pollo marinado shawarma', 'shawarma de pollo mediano', 'shawarma de carne grande'].map(norm)),
    MENU_ITEMS: new Set(['shawarma pollo mediano', 'shawarma carne grande'].map(norm)),
};

/** Lee una hoja como objetos usando la fila 1 como headers. Salta filas vacías y la nota "↑ ...". */
function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    if (raw.length < 2) return [];
    const headers = (raw[0] as unknown[]).map(h => toStr(h));
    const out: Record<string, unknown>[] = [];
    for (const row of raw.slice(1)) {
        const first = toStr((row as unknown[])[0]);
        if (!first || first.startsWith('↑')) continue;
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => { if (h) obj[h] = (row as unknown[])[i]; });
        out.push(obj);
    }
    return out;
}

async function main() {
    const slug = process.env.SEED_TENANT_SLUG;
    const tenant = slug
        ? await prisma.tenant.findUnique({ where: { slug } })
        : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenant) throw new Error('Tenant no encontrado');

    const wb = XLSX.readFile(FILE);
    console.log(`${APPLY ? '🔴 APLICAR' : '🟡 ENSAYO (no escribe)'} — tenant: ${tenant.name} (${tenant.slug}) — archivo: ${FILE}`);
    console.log(`Hojas: ${wb.SheetNames.join(' | ')}\n`);

    // Filtrar filas de ejemplo de la plantilla
    const filterExamples = (sheet: string, rows: Record<string, unknown>[], keyField: string) =>
        rows.filter(r => {
            const isExample = EXAMPLE_ROWS[sheet]?.has(norm(toStr(r[keyField])));
            if (isExample) console.log(`  ⚠ ${sheet}: fila de EJEMPLO de la plantilla saltada: "${toStr(r[keyField])}" (borrala del archivo)`);
            return !isExample;
        });

    const insumos = filterExamples('INSUMOS_NUEVOS', sheetRows(wb, 'INSUMOS_NUEVOS'), 'nombre');
    const cabeceras = filterExamples('RECETAS_CABECERA', sheetRows(wb, 'RECETAS_CABECERA'), 'nombre_receta');
    const ingredientes = sheetRows(wb, 'RECETAS_INGREDIENTES')
        .filter(r => !EXAMPLE_ROWS.RECETAS_CABECERA.has(norm(toStr(r.nombre_receta))));
    const menuRows = filterExamples('MENU_ITEMS', sheetRows(wb, 'MENU_ITEMS'), 'nombre_menu_item');

    console.log(`\nFilas útiles: ${insumos.length} insumos nuevos · ${cabeceras.length} recetas · ${ingredientes.length} líneas de ingredientes · ${menuRows.length} menu items\n`);

    // ── Índices del catálogo vivo ────────────────────────────────────────────
    const items = await prisma.inventoryItem.findMany({
        where: { tenantId: tenant.id, isActive: true, deletedAt: null },
        select: { id: true, name: true, sku: true, type: true, baseUnit: true },
    });
    type Item = typeof items[number];
    const itemByName = new Map<string, Item>();
    for (const it of items) if (!itemByName.has(norm(it.name))) itemByName.set(norm(it.name), it);
    const strippedCount = new Map<string, number>();
    const itemByStripped = new Map<string, Item>();
    for (const it of items) {
        const sk = norm(stripUnitSuffix(it.name));
        if (sk === norm(it.name)) continue;
        strippedCount.set(sk, (strippedCount.get(sk) ?? 0) + 1);
        if (!itemByStripped.has(sk)) itemByStripped.set(sk, it);
    }
    for (const [k, c] of Array.from(strippedCount)) if (c > 1) itemByStripped.delete(k);

    const findItem = (name: string): { item: Item | null; via: string } => {
        const k = norm(name);
        const exact = itemByName.get(k);
        if (exact) return { item: exact, via: exact.sku };
        const stripped = itemByStripped.get(k);
        if (stripped) return { item: stripped, via: `${stripped.sku} (s/unidad)` };
        return { item: null, via: 'NO ENCONTRADO' };
    };

    let skuSeq = Date.now() % 100000;
    const errors: string[] = [];

    // ── 1. INSUMOS_NUEVOS ────────────────────────────────────────────────────
    console.log('══ 1. Insumos nuevos ══');
    for (const row of insumos) {
        const name = toStr(row.nombre);
        if (!name) continue;
        const existing = findItem(name);
        if (existing.item) {
            console.log(`  = ya existe: "${name}" → ${existing.via} (no se recrea)`);
            continue;
        }
        const baseUnit = normUnit(toStr(row.unidad_base));
        const cost = toNum(row.costo_unitario_inicial) ?? 0;
        const category = toStr(row.categoria) || 'GENERAL';
        const sku = `${category.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'INS'}-${(skuSeq++).toString().padStart(5, '0')}`;
        console.log(`  + crear insumo: "${name}" [${sku}] ${baseUnit} · cat ${category} · costo $${cost}` +
            ` · mín ${toNum(row.minimo_stock) ?? 0} · reorden ${toNum(row.punto_reorden) ?? 0}${toBool(row.es_critico) ? ' · CRÍTICO' : ''}`);
        if (!APPLY) {
            itemByName.set(norm(name), { id: `dry-${sku}`, name, sku, type: 'RAW_MATERIAL', baseUnit });
            continue;
        }
        const it = await prisma.inventoryItem.create({
            data: {
                tenantId: tenant.id, name, sku, type: 'RAW_MATERIAL', baseUnit,
                category, description: toStr(row.descripcion) || null,
                minimumStock: toNum(row.minimo_stock) ?? 0,
                reorderPoint: toNum(row.punto_reorden) ?? 0,
                isCritical: toBool(row.es_critico),
                isActive: true,
            },
        });
        if (cost > 0) {
            await prisma.costHistory.create({
                data: { inventoryItemId: it.id, costPerUnit: cost, currency: 'USD', reason: 'Costo inicial — plantilla Excel' },
            });
        }
        itemByName.set(norm(name), { id: it.id, name: it.name, sku: it.sku, type: 'RAW_MATERIAL', baseUnit });
    }

    // ── 2. Parsear cabeceras + agrupar ingredientes ─────────────────────────
    interface Header {
        name: string; tipo: 'SUB_RECIPE' | 'MENU_ITEM'; salida: string;
        cantidadSalida: number; unidadSalida: string; rendimiento: number;
        prep: number | null; coccion: number | null; categoria: string; descripcion: string;
    }
    const headers: Header[] = [];
    for (const row of cabeceras) {
        const name = toStr(row.nombre_receta);
        const tipo = toStr(row.tipo).toUpperCase();
        if (!name) continue;
        if (tipo !== 'SUB_RECIPE' && tipo !== 'MENU_ITEM') {
            errors.push(`RECETAS_CABECERA "${name}": tipo inválido "${tipo}" (SUB_RECIPE o MENU_ITEM)`);
            continue;
        }
        headers.push({
            name, tipo: tipo as Header['tipo'],
            salida: toStr(row.producto_salida) || name,
            cantidadSalida: toNum(row.cantidad_salida) ?? 1,
            unidadSalida: normUnit(toStr(row.unidad_salida)),
            rendimiento: toNum(row.rendimiento_pct) ?? 100,
            prep: toNum(row.tiempo_prep_min), coccion: toNum(row.tiempo_coccion_min),
            categoria: toStr(row.categoria), descripcion: toStr(row.descripcion),
        });
    }
    const headerByName = new Map(headers.map(h => [norm(h.name), h]));
    // Índice de salidas de ESTA corrida (para usar sub-recetas como ingrediente)
    const outputNames = new Map<string, Header>();
    for (const h of headers) outputNames.set(norm(h.salida), h);

    interface Ing { recipe: string; name: string; qty: number; unit: string; merma: number; orden: number; notas: string }
    const ingByRecipe = new Map<string, Ing[]>();
    for (const row of ingredientes) {
        const recipe = toStr(row.nombre_receta);
        const name = toStr(row.ingrediente);
        if (!recipe || !name) continue;
        if (!headerByName.has(norm(recipe))) {
            errors.push(`RECETAS_INGREDIENTES: receta "${recipe}" no está en RECETAS_CABECERA (¿nombre no coincide exacto?)`);
            continue;
        }
        const qty = toNum(row.cantidad);
        if (qty === null || qty <= 0) {
            errors.push(`RECETAS_INGREDIENTES "${recipe}" / "${name}": cantidad inválida "${toStr(row.cantidad)}"`);
            continue;
        }
        const list = ingByRecipe.get(norm(recipe)) ?? [];
        list.push({
            recipe, name, qty, unit: normUnit(toStr(row.unidad)),
            merma: toNum(row.merma_pct) ?? 0, orden: toNum(row.orden) ?? list.length + 1,
            notas: toStr(row.notas),
        });
        ingByRecipe.set(norm(recipe), list);
    }
    for (const h of headers) {
        if (!ingByRecipe.has(norm(h.name))) errors.push(`Receta "${h.name}" no tiene NINGÚN ingrediente en RECETAS_INGREDIENTES`);
    }

    if (errors.length) {
        console.log(`\n⛔ ERRORES DE FORMATO (${errors.length}) — corregí el Excel y volvé a correr:`);
        for (const e of errors) console.log(`   ✗ ${e}`);
        if (APPLY) { console.log('\nAbort: no se aplica nada con errores de formato.'); return; }
    }

    // ── 3. Plan de recetas (sub-recetas primero) ────────────────────────────
    console.log('\n══ 2. Recetas ══');
    const existingRecipes = await prisma.recipe.findMany({
        where: { tenantId: tenant.id, deletedAt: null },
        select: { id: true, name: true, version: true },
    });
    const recipeByName = new Map(existingRecipes.map(r => [norm(r.name), r]));

    const ordered = [...headers].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'SUB_RECIPE' ? -1 : 1));
    const unmatched = new Map<string, Ing>();
    for (const h of ordered) {
        const ings = ingByRecipe.get(norm(h.name)) ?? [];
        const existing = recipeByName.get(norm(h.name));
        console.log(`\n${existing ? '↻ [REEMPLAZAR]' : '+ [CREAR]'} ${h.name} (${h.tipo}) → produce "${h.salida}" ${h.cantidadSalida} ${h.unidadSalida} · ${ings.length} ingredientes`);
        for (const ing of ings) {
            const found = findItem(ing.name);
            const isRunOutput = !found.item && outputNames.has(norm(ing.name));
            const via = found.item ? found.via : isRunOutput ? 'SALIDA DE ESTA CORRIDA' : 'NO ENCONTRADO';
            const mark = found.item ? '·' : isRunOutput ? '◌' : '✗';
            console.log(`    ${mark} ${ing.name}: ${ing.qty} ${ing.unit}${ing.merma ? ` (merma ${ing.merma}%)` : ''} → ${via}`);
            if (!found.item && !isRunOutput) unmatched.set(norm(ing.name), ing);
        }
    }

    if (unmatched.size) {
        console.log(`\nIngredientes NO encontrados (${unmatched.size}):`);
        for (const ing of Array.from(unmatched.values())) console.log(`   ✗ ${ing.name}`);
        console.log(CREATE_MISSING
            ? '   → --create-missing activo: se crearán como placeholder (IMPORT_REVISAR, costo 0).'
            : '   → Agregalos a la hoja INSUMOS_NUEVOS, o corré con --create-missing para crearlos como placeholder.');
    }

    if (!APPLY) {
        console.log('\n🟡 ENSAYO — nada se escribió. Corré con --apply para aplicar.');
        return;
    }
    if (unmatched.size && !CREATE_MISSING) {
        console.log('\n⛔ Abort: hay ingredientes sin match y no se pasó --create-missing.');
        return;
    }

    // Placeholders para no-encontrados
    for (const ing of Array.from(unmatched.values())) {
        const baseUnit = ing.unit === 'G' ? 'KG' : ing.unit === 'ML' ? 'L' : ing.unit;
        const sku = `IMP-${ing.name.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase()}-${(skuSeq++).toString().padStart(5, '0')}`;
        const it = await prisma.inventoryItem.create({
            data: { tenantId: tenant.id, name: ing.name, sku, type: 'RAW_MATERIAL', baseUnit, category: 'IMPORT_REVISAR', isActive: true },
        });
        itemByName.set(norm(ing.name), { id: it.id, name: it.name, sku, type: 'RAW_MATERIAL', baseUnit });
        console.log(`  + placeholder: ${ing.name} [${sku}]`);
    }

    // Pass 1: items de salida
    for (const h of ordered) {
        const k = norm(h.salida);
        if (itemByName.get(k)) continue;
        const type = h.tipo === 'SUB_RECIPE' ? 'SUB_RECIPE' : 'FINISHED_GOOD';
        const sku = `REC-${h.salida.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase()}-${(skuSeq++).toString().padStart(5, '0')}`;
        const it = await prisma.inventoryItem.create({
            data: {
                tenantId: tenant.id, name: h.salida, sku, type, baseUnit: h.unidadSalida,
                category: h.categoria || (type === 'FINISHED_GOOD' ? 'PLATOS' : 'PRODUCCION'), isActive: true,
            },
        });
        itemByName.set(k, { id: it.id, name: it.name, sku, type, baseUnit: h.unidadSalida });
        console.log(`  + item de salida: ${h.salida} [${sku}] (${type})`);
    }

    // Pass 2: recetas
    let applied = 0;
    const touchedRecipeIds = new Set<string>();
    for (const h of ordered) {
        const ings = ingByRecipe.get(norm(h.name)) ?? [];
        // Dedupe por insumo resuelto (unique recipeId+ingredientItemId)
        const byItem = new Map<string, { ingredientItemId: string; quantity: number; unit: string; wastePercentage: number; notes: string | null; sortOrder: number }>();
        let missing = false;
        for (const ing of ings.sort((a, b) => a.orden - b.orden)) {
            const it = itemByName.get(norm(ing.name));
            if (!it) { console.log(`  ✗ saltada "${h.name}": ingrediente sin resolver "${ing.name}"`); missing = true; break; }
            const prev = byItem.get(it.id);
            if (prev) prev.quantity += ing.qty;
            else byItem.set(it.id, {
                ingredientItemId: it.id, quantity: ing.qty, unit: ing.unit,
                wastePercentage: ing.merma, notes: ing.notas || null, sortOrder: byItem.size,
            });
        }
        if (missing) continue;
        const ingredientsData = Array.from(byItem.values());
        const headerData = {
            description: h.descripcion || null,
            outputQuantity: h.cantidadSalida,
            outputUnit: h.unidadSalida,
            yieldPercentage: h.rendimiento,
            prepTime: h.prep, cookTime: h.coccion,
            isActive: true, isApproved: true,
        };
        const existing = recipeByName.get(norm(h.name));
        if (existing) {
            await prisma.$transaction([
                prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } }),
                prisma.recipe.update({
                    where: { id: existing.id },
                    data: { ...headerData, version: { increment: 1 }, ingredients: { create: ingredientsData } },
                }),
            ]);
            console.log(`  ↻ reemplazada: ${h.name} (v${existing.version + 1})`);
            touchedRecipeIds.add(existing.id);
        } else {
            const outId = itemByName.get(norm(h.salida))!.id;
            const created = await prisma.recipe.create({
                data: { tenantId: tenant.id, name: h.name, outputItemId: outId, ...headerData, ingredients: { create: ingredientsData } },
            });
            recipeByName.set(norm(h.name), { id: created.id, name: h.name, version: 1 });
            touchedRecipeIds.add(created.id);
            console.log(`  + creada: ${h.name}`);
        }
        applied++;
    }
    console.log(`\n✅ Recetas aplicadas: ${applied}/${headers.length}`);

    // ── PRUNE: podar recetas vivas que NO vinieron en la plantilla ──────────
    // Corre DESPUÉS del reemplazo in-place → las recetas del archivo nunca
    // dejan de existir y el POS no pierde descargo en ningún momento.
    if (PRUNE) {
        const alive = await prisma.recipe.findMany({
            where: { tenantId: tenant.id, deletedAt: null, id: { notIn: Array.from(touchedRecipeIds) } },
            select: {
                id: true, name: true, outputItemId: true,
                outputItem: { select: { beverageCategory: true, type: true } },
                ingredients: { select: { ingredientItemId: true } },
            },
        });
        const toPrune: { id: string; name: string }[] = [];
        let preserved = 0;
        for (const r of alive) {
            if (!PRUNE_ALL) {
                const isBebida = Boolean(r.outputItem?.beverageCategory);
                const isReventa = r.ingredients.length === 1
                    && r.ingredients[0].ingredientItemId === r.outputItemId
                    && r.outputItem?.type === 'RAW_MATERIAL';
                if (isBebida || isReventa) { preserved++; continue; }
            }
            toPrune.push({ id: r.id, name: r.name });
        }
        console.log(`\n══ PRUNE ══`);
        console.log(`Recetas vivas NO incluidas en la plantilla: ${alive.length} · preservadas (reventa/bebida): ${preserved} · a podar: ${toPrune.length}`);
        for (const r of toPrune) console.log(`  − poda: ${r.name}`);
        if (toPrune.length) {
            await prisma.recipe.updateMany({
                where: { id: { in: toPrune.map(r => r.id) } },
                data: { deletedAt: new Date(), isActive: false },
            });
            // Platos del menú que apuntaban a una receta podada → quedan sin
            // descargo hasta re-vincular. Se reporta, no se toca el MenuItem.
            const orphans = await prisma.menuItem.findMany({
                where: { tenantId: tenant.id, isActive: true, deletedAt: null, recipeId: { in: toPrune.map(r => r.id) } },
                select: { name: true, sku: true },
                orderBy: { name: 'asc' },
            });
            if (orphans.length) {
                console.log(`\n⚠ ${orphans.length} plato(s) del menú quedaron apuntando a recetas podadas (sin descargo hasta re-vincular):`);
                for (const m of orphans) console.log(`  ◌ ${m.name} [${m.sku}]`);
            }
        }
    }

    // ── 4. MENU_ITEMS (opcional) ─────────────────────────────────────────────
    if (menuRows.length) {
        console.log('\n══ 3. Menu items ══');
        const menuItems = await prisma.menuItem.findMany({
            where: { tenantId: tenant.id, deletedAt: null },
            select: { id: true, name: true, sku: true },
        });
        const menuByName = new Map(menuItems.map(m => [norm(m.name), m]));
        const categories = await prisma.menuCategory.findMany({
            where: { tenantId: tenant.id, deletedAt: null },
            select: { id: true, name: true },
        });
        const catByName = new Map(categories.map(c => [norm(c.name), c]));

        for (const row of menuRows) {
            const name = toStr(row.nombre_menu_item);
            if (!name) continue;
            const recipeName = toStr(row.nombre_receta_vinculada);
            const recipe = recipeName ? recipeByName.get(norm(recipeName)) : null;
            if (recipeName && !recipe) {
                console.log(`  ✗ "${name}": receta vinculada "${recipeName}" no existe — saltado`);
                continue;
            }
            const price = toNum(row.precio);
            const existing = menuByName.get(norm(name));
            const commonData = {
                ...(recipe ? { recipeId: recipe.id } : {}),
                ...(price && price > 0 ? { price } : {}),
                ...(toStr(row.descripcion) ? { description: toStr(row.descripcion) } : {}),
                ...(toStr(row.pos_group) ? { posGroup: toStr(row.pos_group) } : {}),
                ...(toStr(row.pos_subcategory) ? { posSubcategory: toStr(row.pos_subcategory) } : {}),
                ...(toStr(row.service_category) ? { serviceCategory: toStr(row.service_category).toUpperCase() } : {}),
                ...(toStr(row.kitchen_routing) ? { kitchenRouting: toStr(row.kitchen_routing).toUpperCase() } : {}),
                isAvailable: toStr(row.disponible) ? toBool(row.disponible) : true,
            };
            if (existing) {
                await prisma.menuItem.update({ where: { id: existing.id }, data: commonData });
                console.log(`  ↻ actualizado: ${name}${recipe ? ` → receta "${recipeName}"` : ''}`);
            } else {
                const catName = toStr(row.categoria_menu) || 'GENERAL';
                let cat = catByName.get(norm(catName));
                if (!cat) {
                    cat = await prisma.menuCategory.create({ data: { tenantId: tenant.id, name: catName, isActive: true } });
                    catByName.set(norm(catName), cat);
                    console.log(`  + categoría de menú creada: ${catName}`);
                }
                if (!price || price <= 0) { console.log(`  ✗ "${name}": es nuevo y no tiene precio — saltado`); continue; }
                const sku = `MEN-${name.replace(/[^A-Za-z]/g, '').substring(0, 5).toUpperCase()}-${(skuSeq++).toString().padStart(4, '0')}`;
                await prisma.menuItem.create({
                    data: { tenantId: tenant.id, name, sku, categoryId: cat.id, price, isActive: true, ...commonData },
                });
                console.log(`  + creado: ${name} [${sku}] $${price}${recipe ? ` → receta "${recipeName}"` : ''}`);
            }
        }
    }

    console.log('\n✅ Importación completa. Siguiente paso: recalcular costos de recetas');
    console.log('   desde la UI (botón ↻ en /dashboard/recetas) o vincular platos faltantes.');
}

main()
    .catch((e) => { console.error('❌', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
