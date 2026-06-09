/**
 * Importador de recetas desde CSV (formato Excel del chef).
 *
 * Uso (en el VPS, donde está DATABASE_URL de producción):
 *   npx tsx scripts/import-recetas.ts scripts/data/recetas-produccion.csv               # ENSAYO (no escribe)
 *   npx tsx scripts/import-recetas.ts scripts/data/recetas-produccion.csv --apply       # aplica
 *   npx tsx scripts/import-recetas.ts <csv> --type=FINISHED_GOOD                        # para recetas finales
 *   npx tsx scripts/import-recetas.ts <csv> --parse-only                                # solo parseo, sin DB
 *
 * Semántica REEMPLAZO (pedido del dueño):
 *  - Receta que YA existe (match por nombre normalizado): se le BORRAN los
 *    ingredientes y se recrean desde el CSV. El outputItem y sus vínculos al
 *    menú quedan intactos. version += 1.
 *  - Receta nueva: crea InventoryItem de salida (type según --type, default
 *    SUB_RECIPE, outputQuantity 1 KG por defecto — ajustable luego en la UI).
 *  - NUNCA borra recetas que no estén en el CSV.
 *  - Solo aplica recetas cuyos ingredientes matchearon TODOS contra el
 *    inventario; las demás se reportan para corregir.
 *
 * Matching de ingredientes: por nombre normalizado (minúsculas, sin acentos,
 * espacios colapsados) contra InventoryItem activo (RAW_MATERIAL | SUB_RECIPE),
 * más los outputItems nuevos de esta misma corrida (recetas que se usan como
 * ingrediente de otras, ej. "Yogurt").
 */
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
const APPLY = args.includes('--apply');
const PARSE_ONLY = args.includes('--parse-only');
const TYPE = (args.find((a) => a.startsWith('--type='))?.split('=')[1] ?? 'SUB_RECIPE') as
  | 'SUB_RECIPE' | 'FINISHED_GOOD';
if (!csvPath) { console.error('Uso: npx tsx scripts/import-recetas.ts <csv> [--apply|--parse-only] [--type=SUB_RECIPE|FINISHED_GOOD]'); process.exit(1); }

// ─── CSV split con soporte de comillas ───────────────────────────────────────
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// ─── Normalización ───────────────────────────────────────────────────────────
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const UNIT_MAP: Record<string, string> = {
  GR: 'G', GRS: 'G', G: 'G', KG: 'KG', ML: 'ML', L: 'L', LT: 'L', LTS: 'L',
  UND: 'UNIT', UNID: 'UNIT', UNIDAD: 'UNIT', UNIT: 'UNIT', PIEZA: 'PIEZA',
};
function normUnit(raw: string): { unit: string; flag?: string } {
  const u = raw.trim().toUpperCase().replace(/\.$/, '');
  if (!u || u === '/' || u === '-') return { unit: 'G', flag: `unidad vacía ("${raw}")` };
  if (UNIT_MAP[u]) return { unit: UNIT_MAP[u] };
  if (/^\d/.test(u)) return { unit: 'G', flag: `unidad numérica ("${raw}") — revisar fila` };
  return { unit: u, flag: `unidad no estándar ("${u}")` }; // PIZCA, CUCH, GOTAS, AL GUSTO…
}

/** "3,6"→3.6 · "2,22 "→2.22 · "8.5  u 8"→8.5 · " 641 ml "→641 · "10 KG"→10 · "1/2 KG"→0.5 · "Al gusto"/"-"/"/"→null */
function parseQty(raw: string): { qty: number | null; flag?: string } {
  const s = raw.trim();
  if (!s || s === '-' || s === '/' || /^(al gusto|pizca|tope)/i.test(s)) {
    return { qty: null, flag: s ? `cantidad "${s}"` : 'sin cantidad' };
  }
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) return { qty: parseInt(frac[1]) / parseInt(frac[2]), flag: `interpretado "${s}" → ${parseInt(frac[1]) / parseInt(frac[2])}` };
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!m) return { qty: null, flag: `cantidad ilegible "${s}"` };
  const qty = parseFloat(m[0]);
  const clean = s.replace(',', '.');
  const flag = clean !== m[0] ? `interpretado "${s}" → ${qty}` : undefined;
  return { qty, flag };
}

// ─── Parseo a recetas ────────────────────────────────────────────────────────
interface Line { name: string; qty: number | null; unit: string; flags: string[]; raw: string }
interface ParsedRecipe { name: string; note?: string; lines: Line[]; skipped?: string; warnings: string[] }

function parseCsv(text: string): ParsedRecipe[] {
  const rows = text.split(/\r?\n/).map(splitCsvLine);
  // Bloques separados por filas "vacías" (sin nombre ni cantidad)
  const blocks: string[][][] = [];
  let cur: string[][] = [];
  for (const r of rows) {
    const c1 = (r[1] ?? '').trim(), c2 = (r[2] ?? '').trim();
    if (!c1 && !c2) { if (cur.length) { blocks.push(cur); cur = []; } continue; }
    cur.push(r);
  }
  if (cur.length) blocks.push(cur);

  const recipes: ParsedRecipe[] = [];
  for (const block of blocks) {
    const first = block[0];
    const c1 = (first[1] ?? '').trim();
    // Continuación (ej: "Cantidad,Medida" tras fila en blanco): pegar al anterior
    if (!c1 && recipes.length) { appendRows(recipes[recipes.length - 1], block); continue; }
    if (!c1) continue;
    if (norm(c1).startsWith('recetas produccion') || norm(c1).startsWith('recetas ')) continue; // título de hoja
    const note = [first[2], first[3], first[4], first[5]].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ') || undefined;
    const rec: ParsedRecipe = { name: c1.replace(/\s+/g, ' ').trim(), note, lines: [], warnings: [] };
    if (norm(rec.name).startsWith('porciones')) rec.skipped = 'tabla de porciones, no es receta';
    appendRows(rec, block.slice(1));
    recipes.push(rec);
  }

  for (const r of recipes) {
    if (r.skipped) continue;
    if (r.lines.length === 0) r.skipped = 'sin ingredientes parseables (¿solo proceso/texto?)';
    // dedupe por nombre normalizado (suma si misma unidad)
    const seen = new Map<string, Line>();
    const merged: Line[] = [];
    for (const l of r.lines) {
      const k = norm(l.name);
      const prev = seen.get(k);
      if (prev && prev.unit === l.unit && prev.qty != null && l.qty != null) {
        prev.qty += l.qty;
        r.warnings.push(`ingrediente repetido "${l.name}" — cantidades sumadas`);
      } else if (prev) {
        r.warnings.push(`ingrediente repetido "${l.name}" con unidad distinta — solo se toma el primero`);
      } else { seen.set(k, l); merged.push(l); }
    }
    r.lines = merged;
  }
  return recipes;
}

function appendRows(rec: ParsedRecipe, rows: string[][]) {
  for (const r of rows) {
    const name = (r[1] ?? '').trim();
    const rawQty = (r[2] ?? '').trim();
    const rawUnit = (r[3] ?? '').trim();
    if (!name && /^cantidad/i.test(rawQty)) continue; // encabezado Cantidad/Medida
    if (!name && rawQty === 'PROCESO') { rec.skipped = 'receta de proceso (sin ingredientes medibles)'; continue; }
    if (!name) continue;
    if (/^fase \d/i.test(name) || rawQty === '-') continue; // separadores de fase
    if (rawQty.length > 40) { rec.skipped = 'receta de proceso (texto largo en cantidad)'; continue; }
    const { qty, flag: qFlag } = parseQty(rawQty);
    const { unit, flag: uFlag } = normUnit(rawUnit || rawQty.replace(/[\d.,\s]/g, ''));
    const flags = [qFlag, uFlag].filter(Boolean) as string[];
    rec.lines.push({ name: name.replace(/\s+/g, ' ').trim(), qty, unit, flags, raw: `${rawQty}|${rawUnit}` });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const text = readFileSync(csvPath!, 'utf8');
  const recipes = parseCsv(text);
  const importable = recipes.filter((r) => !r.skipped);

  console.log(`\n══ PARSEO: ${recipes.length} bloques → ${importable.length} recetas importables, ${recipes.length - importable.length} omitidas ══`);
  for (const r of recipes.filter((x) => x.skipped)) console.log(`  ⊘ OMITIDA "${r.name}" — ${r.skipped}`);

  if (PARSE_ONLY) {
    for (const r of importable) {
      console.log(`\n▸ ${r.name}${r.note ? `  [nota: ${r.note}]` : ''} — ${r.lines.length} ingredientes`);
      for (const l of r.lines) {
        console.log(`    · ${l.name}: ${l.qty ?? '???'} ${l.unit}${l.flags.length ? `  ⚠ ${l.flags.join('; ')}` : ''}`);
      }
      for (const w of r.warnings) console.log(`    ⚠ ${w}`);
    }
    return;
  }

  // ── Conexión y matching contra inventario real ──
  const prisma = new PrismaClient();
  const slug = process.env.SEED_TENANT_SLUG;
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('Tenant no encontrado');
  console.log(`\nTenant: ${tenant.name} · Tipo para recetas nuevas: ${TYPE} · Modo: ${APPLY ? '🔴 APLICAR' : '🟡 ENSAYO (no escribe)'}`);

  const items = await prisma.inventoryItem.findMany({
    where: { tenantId: tenant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, sku: true, type: true, baseUnit: true },
  });
  const itemByName = new Map<string, typeof items[number]>();
  for (const it of items) {
    const k = norm(it.name);
    if (!itemByName.has(k)) itemByName.set(k, it);
  }
  const existingRecipes = await prisma.recipe.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, name: true, outputItemId: true, version: true },
  });
  const recipeByName = new Map(existingRecipes.map((r) => [norm(r.name), r]));

  // Nombres de recetas del CSV (para ingredientes que son sub-recetas de esta corrida)
  const csvRecipeNames = new Set(importable.map((r) => norm(r.name)));

  let ok = 0, blocked = 0, totalUnmatched = new Map<string, number>();
  const plan: { rec: ParsedRecipe; existing?: typeof existingRecipes[number]; resolved: { line: Line; itemId: string | null; via: string }[] }[] = [];

  for (const r of importable) {
    const existing = recipeByName.get(norm(r.name));
    const resolved = r.lines.map((line) => {
      const k = norm(line.name);
      const item = itemByName.get(k);
      if (item) return { line, itemId: item.id, via: item.sku };
      if (csvRecipeNames.has(k)) return { line, itemId: null, via: 'SUB-RECETA DE ESTA CORRIDA' };
      return { line, itemId: null, via: 'NO ENCONTRADO' };
    });
    const unmatched = resolved.filter((x) => !x.itemId && x.via === 'NO ENCONTRADO');
    for (const u of unmatched) totalUnmatched.set(u.line.name, (totalUnmatched.get(u.line.name) ?? 0) + 1);

    const status = unmatched.length === 0 ? (existing ? 'REEMPLAZAR' : 'CREAR') : 'BLOQUEADA';
    if (status === 'BLOQUEADA') blocked++; else ok++;

    console.log(`\n${status === 'BLOQUEADA' ? '✗' : '✓'} [${status}] ${r.name} — ${r.lines.length} ingredientes${existing ? ` (existe v${existing.version})` : ''}`);
    for (const x of resolved) {
      const mark = x.itemId ? '·' : (x.via === 'NO ENCONTRADO' ? '✗' : '◌');
      console.log(`    ${mark} ${x.line.name}: ${x.line.qty ?? 0} ${x.line.unit} → ${x.via}${x.line.flags.length ? `  ⚠ ${x.line.flags.join('; ')}` : ''}`);
    }
    for (const w of r.warnings) console.log(`    ⚠ ${w}`);
    plan.push({ rec: r, existing, resolved });
  }

  console.log(`\n══ RESUMEN: ${ok} aplicables · ${blocked} bloqueadas por ingredientes sin match ══`);
  if (totalUnmatched.size) {
    console.log(`\nIngredientes NO encontrados en inventario (${totalUnmatched.size}):`);
    for (const [name, n] of Array.from(totalUnmatched).sort((a, b) => b[1] - a[1])) {
      console.log(`  ✗ ${name}  (en ${n} receta${n > 1 ? 's' : ''})`);
    }
  }

  if (!APPLY) { console.log('\n🟡 ENSAYO — nada se escribió. Corré con --apply para aplicar las recetas ✓.'); await prisma.$disconnect(); return; }

  // ── APLICAR (solo recetas completamente macheadas) ──
  console.log('\n🔴 Aplicando…');
  // Pass 1: crear outputItems de recetas nuevas aplicables (habilita sub-recetas como ingrediente)
  for (const p of plan) {
    const fullyMatched = p.resolved.every((x) => x.itemId || x.via !== 'NO ENCONTRADO');
    if (!fullyMatched || p.existing) continue;
    const k = norm(p.rec.name);
    if (itemByName.has(k)) continue;
    const sku = `REC-${p.rec.name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-5)}`;
    const out = await prisma.inventoryItem.create({
      data: { tenantId: tenant.id, name: p.rec.name, sku, type: TYPE, baseUnit: 'KG', category: 'PRODUCCION', isActive: true },
    });
    itemByName.set(k, { id: out.id, name: out.name, sku: out.sku, type: TYPE, baseUnit: 'KG' });
    console.log(`  + item de salida: ${p.rec.name} (${sku})`);
  }
  // Pass 2: recetas
  let applied = 0;
  for (const p of plan) {
    // re-resolver (los outputItems nuevos ya están en el mapa)
    const resolved = p.rec.lines.map((line) => ({ line, item: itemByName.get(norm(line.name)) ?? null }));
    if (resolved.some((x) => !x.item)) { console.log(`  ✗ saltada (ingrediente sin match): ${p.rec.name}`); continue; }
    const ingredientsData = resolved.map((x, i) => ({
      ingredientItemId: x.item!.id,
      quantity: x.line.qty ?? 0,
      unit: x.line.unit,
      notes: [x.line.qty == null ? `cantidad original: "${x.line.raw.split('|')[0]}"` : null, ...x.line.flags].filter(Boolean).join('; ') || null,
      sortOrder: i,
    }));
    if (p.existing) {
      await prisma.$transaction([
        prisma.recipeIngredient.deleteMany({ where: { recipeId: p.existing.id } }),
        prisma.recipe.update({
          where: { id: p.existing.id },
          data: { version: { increment: 1 }, isActive: true, ingredients: { create: ingredientsData } },
        }),
      ]);
      console.log(`  ↻ reemplazada: ${p.rec.name} (v${p.existing.version + 1}, ${ingredientsData.length} ingredientes)`);
    } else {
      const outItem = itemByName.get(norm(p.rec.name))!;
      await prisma.recipe.create({
        data: {
          tenantId: tenant.id, name: p.rec.name, description: p.rec.note ?? null,
          outputItemId: outItem.id, outputQuantity: 1, outputUnit: 'KG',
          isApproved: true, ingredients: { create: ingredientsData },
        },
      });
      console.log(`  + creada: ${p.rec.name} (${ingredientsData.length} ingredientes)`);
    }
    applied++;
  }
  console.log(`\n✅ Aplicadas ${applied} recetas.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
