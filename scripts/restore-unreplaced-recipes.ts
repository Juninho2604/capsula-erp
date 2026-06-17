/**
 * Restaura (revierte el soft-delete de) las recetas que NO fueron reemplazadas
 * por la carga nueva. Pensado como red de seguridad tras
 * soft-delete-recipes.ts --apply + import-recetas.ts --apply: trae de vuelta las
 * bebidas y demás productos que los CSVs nuevos no cubren, SIN resucitar la
 * comida vieja (esa ya tiene una receta activa nueva con el mismo nombre).
 *
 * Regla: restaura una receta soft-deleteada solo si su nombre normalizado NO
 * coincide con ninguna receta ACTIVA actual. Así:
 *   - "Stella Artois", "Vino Tinto Copa", "Tenders"… (sin namesake activo) → vuelven.
 *   - "Shanklish Tradicional 125gr"… (ya hay versión nueva activa) → se omiten.
 * Los vínculos de menú de las bebidas nunca se tocaron (relink solo toca matches),
 * así que al restaurar la receta el descuento vuelve a funcionar solo.
 *
 * Uso (en el VPS, DATABASE_URL de producción):
 *   npx tsx scripts/restore-unreplaced-recipes.ts            # ENSAYO (lista qué restauraría)
 *   npx tsx scripts/restore-unreplaced-recipes.ts --apply    # restaura
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

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

  const active = await prisma.recipe.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { name: true },
  });
  const activeNames = new Set(active.map((r) => norm(r.name)));

  const deleted = await prisma.recipe.findMany({
    where: { tenantId: tenant.id, deletedAt: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const toRestore = deleted.filter((r) => !activeNames.has(norm(r.name)));
  const skipped = deleted.filter((r) => activeNames.has(norm(r.name)));

  console.log(`\nTenant: ${tenant.name}`);
  console.log(`Recetas activas: ${active.length} · soft-deleteadas: ${deleted.length}`);
  console.log(`Modo: ${APPLY ? '🔴 APLICAR (restaurar)' : '🟡 ENSAYO (no escribe)'}\n`);

  console.log(`✓ A restaurar (sin reemplazo nuevo): ${toRestore.length}`);
  for (const r of toRestore) console.log(`   ${r.name}`);
  console.log(`\n◌ Omitidas (ya hay versión nueva activa con ese nombre): ${skipped.length}`);
  for (const r of skipped) console.log(`   ${r.name}`);

  if (!APPLY) {
    console.log('\n🟡 ENSAYO — nada se restauró. Corré con --apply para restaurar.');
    await prisma.$disconnect();
    return;
  }

  let n = 0;
  for (const r of toRestore) {
    await prisma.recipe.update({ where: { id: r.id }, data: { deletedAt: null, isActive: true } });
    n++;
  }
  console.log(`\n✅ Restauradas ${n} receta(s). Sus vínculos de menú nunca se tocaron → el descuento vuelve a funcionar.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
