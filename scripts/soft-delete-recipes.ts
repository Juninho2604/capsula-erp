/**
 * Soft-delete SELECTIVO de recetas: borra las PREPARACIONES/PLATOS (comida que se
 * reemplaza con la carga nueva) y PRESERVA intactos los productos de REVENTA y las
 * BEBIDAS — esos no se tocan, siguen descontando stock.
 *
 * Clasificación (determinista):
 *   PRESERVAR (no se borra) si:
 *     - 🍷 BEBIDA: el item de salida tiene `beverageCategory`, o
 *     - 🛒 REVENTA: la receta es 1:1 auto-referenciada (único ingrediente == output)
 *       Y el item de salida es `type === 'RAW_MATERIAL'` (patrón de createResaleProductAction).
 *   BORRAR (soft-delete) TODO lo demás = platos/preparaciones, incluyendo recetas
 *   sin ingredientes y passthroughs cuyo output es FINISHED_GOOD/SUB_RECIPE.
 *
 * Reversible: setea `deletedAt` (e isActive=false). No borra filas. No toca
 * `MenuItem.recipeId` (el re-vínculo de la comida lo hace relink-menu-recipes.ts).
 *
 * Uso (en el VPS, DATABASE_URL de producción):
 *   npx tsx scripts/soft-delete-recipes.ts            # ENSAYO (desglose + listas)
 *   npx tsx scripts/soft-delete-recipes.ts --apply    # aplica el soft-delete a los platos
 *   npx tsx scripts/soft-delete-recipes.ts --all      # (peligroso) borra TODAS, sin preservar
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');

interface Rec {
  id: string;
  name: string;
  outputItemId: string;
  outputItem: { beverageCategory: string | null; type: string } | null;
  ingredients: { ingredientItemId: string }[];
}

type Reason = 'bebida' | 'reventa' | null; // null = borrar (plato)

/** Devuelve la razón de preservación, o null si es plato (a borrar). */
function preserveReason(r: Rec): Reason {
  if (r.outputItem?.beverageCategory) return 'bebida';
  const selfRef =
    r.ingredients.length === 1 && r.ingredients[0].ingredientItemId === r.outputItemId;
  if (selfRef && r.outputItem?.type === 'RAW_MATERIAL') return 'reventa';
  return null;
}

async function main() {
  const prisma = new PrismaClient();
  const slug = process.env.SEED_TENANT_SLUG;
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('Tenant no encontrado');

  const recipes = (await prisma.recipe.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: {
      id: true, name: true, outputItemId: true,
      outputItem: { select: { beverageCategory: true, type: true } },
      ingredients: { select: { ingredientItemId: true } },
    },
    orderBy: { name: 'asc' },
  })) as Rec[];

  const bebidas: Rec[] = [];
  const reventa: Rec[] = [];
  const del: Rec[] = [];
  for (const r of recipes) {
    const reason = ALL ? null : preserveReason(r);
    if (reason === 'bebida') bebidas.push(r);
    else if (reason === 'reventa') reventa.push(r);
    else del.push(r);
  }

  console.log(`\nTenant: ${tenant.name}`);
  console.log(`Recetas activas: ${recipes.length}`);
  console.log(`Modo: ${APPLY ? '🔴 APLICAR' : '🟡 ENSAYO (no escribe)'}${ALL ? '  ⚠ --all' : ''}\n`);

  // Desglose corto (pegable en pantalla)
  console.log(`🍷 PRESERVADAS bebidas (beverageCategory): ${bebidas.length}`);
  console.log(`🛒 PRESERVADAS reventa (1:1 RAW_MATERIAL):  ${reventa.length}`);
  console.log(`🔴 A BORRAR platos/preparaciones:           ${del.length}`);

  // La lista de reventa es el bucket donde podría colarse un plato → mostrarla para revisar.
  console.log(`\n— REVENTA preservada (revisá que NO haya platos acá): ${reventa.length} —`);
  for (const r of reventa) console.log(`   ${r.name}`);

  if (!APPLY) {
    console.log('\n🟡 ENSAYO — nada se borró.');
    console.log('   Las bebidas se confían por beverageCategory (no se listan, son muchas).');
    console.log('   Revisá la lista REVENTA de arriba: si ves un plato ahí, decime y afino el filtro.');
    await prisma.$disconnect();
    return;
  }

  const res = await prisma.recipe.updateMany({
    where: { tenantId: tenant.id, id: { in: del.map((r) => r.id) } },
    data: { deletedAt: new Date(), isActive: false },
  });
  console.log(`\n✅ Soft-delete aplicado a ${res.count} plato(s)/preparación(es). Bebidas y reventa intactas.`);
  console.log(`   Recuperar todo: UPDATE "Recipe" SET "deletedAt"=NULL,"isActive"=true WHERE "tenantId"='${tenant.id}' AND "deletedAt" IS NOT NULL;`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
