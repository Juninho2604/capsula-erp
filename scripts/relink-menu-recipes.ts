/**
 * Re-vincula los productos del menú (MenuItem.recipeId) a las recetas nuevas,
 * por coincidencia de nombre normalizado. Pensado para correr DESPUÉS de
 * soft-delete-recipes.ts + import-recetas.ts --apply.
 *
 * Matching (en orden, primer match gana):
 *   1) nombre del MenuItem == nombre de la Recipe (normalizado).
 *   2) el nombre de la Recipe empieza con el del MenuItem (recetas por tamaño,
 *      ej. MenuItem "Shanklish Tradicional" → Recipe "Shanklish Tradicional 125GR").
 *      Si hay varias, se reporta como ambiguo y NO se vincula (revisar a mano).
 *
 * Uso (en el VPS, con DATABASE_URL de producción):
 *   npx tsx scripts/relink-menu-recipes.ts            # ENSAYO (lista qué vincularía)
 *   npx tsx scripts/relink-menu-recipes.ts --apply    # aplica los vínculos sin ambigüedad
 *   npx tsx scripts/relink-menu-recipes.ts --only-missing   # solo MenuItems sin receta
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const ONLY_MISSING = process.argv.includes('--only-missing');

function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main() {
  const prisma = new PrismaClient();
  const slug = process.env.SEED_TENANT_SLUG;
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('Tenant no encontrado');

  const recipes = await prisma.recipe.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, name: true },
  });
  const exact = new Map<string, { id: string; name: string }>();
  for (const r of recipes) { const k = norm(r.name); if (!exact.has(k)) exact.set(k, r); }

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id, isActive: true, ...(ONLY_MISSING ? { recipeId: null } : {}) },
    select: { id: true, name: true, recipeId: true },
    orderBy: { name: 'asc' },
  });

  console.log(`\nTenant: ${tenant.name} · Recetas activas: ${recipes.length} · Menú a revisar: ${items.length}`);
  console.log(`Modo: ${APPLY ? '🔴 APLICAR' : '🟡 ENSAYO (no escribe)'}\n`);

  const toLink: { id: string; menu: string; recipe: string; recipeId: string }[] = [];
  const ambiguous: { menu: string; cands: string[] }[] = [];
  const unmatched: string[] = [];

  for (const m of items) {
    const k = norm(m.name);
    const ex = exact.get(k);
    if (ex) { toLink.push({ id: m.id, menu: m.name, recipe: ex.name, recipeId: ex.id }); continue; }
    const pref = recipes.filter((r) => norm(r.name).startsWith(k + ' ') || norm(r.name) === k);
    if (pref.length === 1) toLink.push({ id: m.id, menu: m.name, recipe: pref[0].name, recipeId: pref[0].id });
    else if (pref.length > 1) ambiguous.push({ menu: m.name, cands: pref.map((r) => r.name) });
    else unmatched.push(m.name);
  }

  console.log(`✓ Vinculables: ${toLink.length}`);
  for (const t of toLink) console.log(`   ${t.menu}  →  ${t.recipe}`);
  if (ambiguous.length) {
    console.log(`\n◌ Ambiguos (varias recetas posibles — vincular a mano): ${ambiguous.length}`);
    for (const a of ambiguous) console.log(`   ${a.menu}  →  ${a.cands.join(' | ')}`);
  }
  if (unmatched.length) {
    console.log(`\n✗ Sin receta encontrada (revisar nombre): ${unmatched.length}`);
    for (const u of unmatched) console.log(`   ${u}`);
  }

  if (!APPLY) {
    console.log('\n🟡 ENSAYO — nada se vinculó. Corré con --apply para aplicar los vínculos sin ambigüedad.');
    await prisma.$disconnect();
    return;
  }

  let n = 0;
  for (const t of toLink) {
    await prisma.menuItem.update({ where: { id: t.id }, data: { recipeId: t.recipeId } });
    n++;
  }
  console.log(`\n✅ Vinculados ${n} producto(s). Ambiguos/sin match quedan para revisar en Menú → editar producto.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
