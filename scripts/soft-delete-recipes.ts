/**
 * Soft-delete SELECTIVO de recetas: borra solo las PREPARACIONES (comida que se
 * va a reemplazar con la carga nueva) y PRESERVA intactos los productos de
 * REVENTA y las BEBIDAS — esos no se tocan, siguen descontando stock.
 *
 * Clasificación (determinista):
 *   PRESERVAR (no se borra) si:
 *     - el item de salida tiene `beverageCategory` (cerveza, vino, trago, etc.), o
 *     - la receta es 1:1 auto-referenciada (único ingrediente == el output) →
 *       producto de reventa tal cual (Pepsi, agua, Stella, ticket…), o
 *     - la receta no tiene ingredientes (passthrough/dudosa → no se borra).
 *   BORRAR (soft-delete) el resto = preparaciones con ingredientes propios.
 *
 * Reversible: setea `deletedAt` (e isActive=false). No borra filas. No toca
 * `MenuItem.recipeId` (el re-vínculo de la comida lo hace relink-menu-recipes.ts).
 *
 * Uso (en el VPS, DATABASE_URL de producción):
 *   npx tsx scripts/soft-delete-recipes.ts            # ENSAYO (lista qué borraría / preservaría)
 *   npx tsx scripts/soft-delete-recipes.ts --apply    # aplica el soft-delete a las preparaciones
 *   npx tsx scripts/soft-delete-recipes.ts --all      # (peligroso) borra TODAS, sin preservar reventa/bebidas
 *
 * Recomendado: backup de la BD antes de --apply.
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all'); // override: borrar todo sin preservar

interface Rec {
  id: string;
  name: string;
  outputItemId: string;
  outputItem: { beverageCategory: string | null } | null;
  ingredients: { ingredientItemId: string }[];
}

/** true = preservar (reventa o bebida); false = preparación (borrar). */
function isResaleOrBeverage(r: Rec): boolean {
  if (r.outputItem?.beverageCategory) return true;                       // bebida
  if (r.ingredients.length === 0) return true;                          // sin ingredientes → no tocar
  if (r.ingredients.length === 1 && r.ingredients[0].ingredientItemId === r.outputItemId) return true; // reventa 1:1
  return false;                                                          // preparación
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
    select: {
      id: true, name: true, outputItemId: true,
      outputItem: { select: { beverageCategory: true } },
      ingredients: { select: { ingredientItemId: true } },
    },
    orderBy: { name: 'asc' },
  }) as Rec[];

  const keep = ALL ? [] : recipes.filter(isResaleOrBeverage);
  const del = ALL ? recipes : recipes.filter((r) => !isResaleOrBeverage(r));

  console.log(`\nTenant: ${tenant.name}`);
  console.log(`Recetas activas: ${recipes.length}`);
  console.log(`Modo: ${APPLY ? '🔴 APLICAR' : '🟡 ENSAYO (no escribe)'}${ALL ? '  ⚠ --all (sin preservar)' : ''}\n`);

  console.log(`🟢 PRESERVADAS (reventa/bebidas, NO se tocan): ${keep.length}`);
  for (const r of keep) console.log(`   ${r.name}`);
  console.log(`\n🔴 A BORRAR (preparaciones): ${del.length}`);
  for (const r of del) console.log(`   ${r.name}`);

  if (!APPLY) {
    console.log('\n🟡 ENSAYO — nada se borró. Revisá las dos listas; corré con --apply cuando estén bien.');
    await prisma.$disconnect();
    return;
  }

  const res = await prisma.recipe.updateMany({
    where: { tenantId: tenant.id, id: { in: del.map((r) => r.id) } },
    data: { deletedAt: new Date(), isActive: false },
  });
  console.log(`\n✅ Soft-delete aplicado a ${res.count} preparación(es). Reventa/bebidas intactas.`);
  console.log(`   Recuperar todo lo borrado: UPDATE "Recipe" SET "deletedAt"=NULL,"isActive"=true WHERE "tenantId"='${tenant.id}' AND "deletedAt" IS NOT NULL;`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
