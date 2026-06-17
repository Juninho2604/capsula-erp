/**
 * Soft-delete de TODAS las recetas activas de un tenant (carga inicial nueva).
 *
 * Reversible: setea `deletedAt` (y isActive=false). NO borra filas ni cascada a
 * ingredientes — se pueden recuperar con un UPDATE deletedAt=NULL si hace falta.
 * No toca `MenuItem.recipeId` (el re-vínculo lo hace relink-menu-recipes.ts tras
 * importar las nuevas; mientras tanto el POS simplemente no descuenta esos
 * productos, porque la receta soft-deleteada deja de resolverse).
 *
 * Uso (en el VPS, con DATABASE_URL de producción):
 *   npx tsx scripts/soft-delete-recipes.ts            # ENSAYO (no escribe — lista qué haría)
 *   npx tsx scripts/soft-delete-recipes.ts --apply    # aplica el soft-delete
 *
 * Recomendado: hacer un backup/snapshot de la BD antes de --apply.
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

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
    orderBy: { name: 'asc' },
  });
  const linkedMenu = await prisma.menuItem.count({
    where: { tenantId: tenant.id, recipeId: { not: null } },
  });

  console.log(`\nTenant: ${tenant.name}`);
  console.log(`Recetas activas a soft-deletear: ${recipes.length}`);
  console.log(`Modo: ${APPLY ? '🔴 APLICAR (soft-delete)' : '🟡 ENSAYO (no escribe)'}\n`);
  for (const r of recipes) console.log(`  - ${r.name}`);

  console.log(`\n⚠ ${linkedMenu} producto(s) del menú tienen receta vinculada hoy.`);
  console.log('  Tras el soft-delete dejarán de descontar inventario hasta re-vincularlos');
  console.log('  (correr el import nuevo + scripts/relink-menu-recipes.ts).');

  if (!APPLY) {
    console.log('\n🟡 ENSAYO — nada se borró. Corré con --apply para aplicar el soft-delete.');
    await prisma.$disconnect();
    return;
  }

  const res = await prisma.recipe.updateMany({
    where: { tenantId: tenant.id, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
  console.log(`\n✅ Soft-delete aplicado a ${res.count} receta(s). Recuperable: están con deletedAt seteado.`);
  console.log('   Para recuperar todo: UPDATE "Recipe" SET "deletedAt"=NULL, "isActive"=true WHERE "tenantId"=\'' + tenant.id + '\';');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
