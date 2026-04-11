// @ts-nocheck
/**
 * MIGRATE CASHIER ROLES — Fase 3
 *
 * Migra usuarios con role CASHIER_RESTAURANT o CASHIER_DELIVERY
 * al rol unificado CASHIER, asignando allowedModules según su rol anterior:
 *
 *   CASHIER_RESTAURANT → CASHIER + allowedModules: ["pos_restaurant", "sales_history", "tasa_cambio", "estadisticas"]
 *   CASHIER_DELIVERY   → CASHIER + allowedModules: ["pos_delivery", "pedidosya", "sales_history", "tasa_cambio", "estadisticas"]
 *
 * USO:
 *   npx ts-node --project tsconfig.scripts.json scripts/migrate-cashier-roles.ts         ← DRY RUN (solo muestra)
 *   npx ts-node --project tsconfig.scripts.json scripts/migrate-cashier-roles.ts --apply  ← Ejecuta UPDATE
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODULES_RESTAURANT = JSON.stringify([
  'estadisticas',
  'pos_restaurant',
  'sales_history',
  'tasa_cambio',
]);

const MODULES_DELIVERY = JSON.stringify([
  'estadisticas',
  'pos_delivery',
  'pedidosya',
  'sales_history',
  'tasa_cambio',
]);

async function main() {
  const apply = process.argv.includes('--apply');

  // ─── Fase 0: SELECT — usuarios que serán migrados ────────────────────────

  const candidates = await prisma.user.findMany({
    where: {
      role: { in: ['CASHIER_RESTAURANT', 'CASHIER_DELIVERY'] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      allowedModules: true,
    },
    orderBy: { lastName: 'asc' },
  });

  if (candidates.length === 0) {
    console.log('\n✅ No hay usuarios con role CASHIER_RESTAURANT o CASHIER_DELIVERY. Nada que migrar.\n');
    return;
  }

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log(`  USUARIOS A MIGRAR (${candidates.length})`);
  console.log('──────────────────────────────────────────────────────────────────');

  for (const u of candidates) {
    const newModules =
      u.role === 'CASHIER_RESTAURANT' ? MODULES_RESTAURANT : MODULES_DELIVERY;
    const keepModules = u.allowedModules !== null;

    console.log(
      `  ${u.isActive ? '🟢' : '⚪'} ${u.firstName} ${u.lastName} <${u.email}>`
    );
    console.log(`     rol actual  : ${u.role}`);
    console.log(`     rol nuevo   : CASHIER`);
    console.log(
      `     módulos     : ${
        keepModules
          ? `[SIN CAMBIO — ya tiene allowedModules personalizados: ${u.allowedModules}]`
          : newModules
      }`
    );
    console.log('');
  }

  console.log('──────────────────────────────────────────────────────────────────');

  if (!apply) {
    console.log('\n  ⚠️  DRY RUN — no se hizo ningún cambio.');
    console.log('  Para aplicar, vuelve a correr con --apply\n');
    return;
  }

  // ─── Fase 1: UPDATE ───────────────────────────────────────────────────────

  console.log('\n  Aplicando migración…\n');

  let migrated = 0;
  let errors = 0;

  for (const u of candidates) {
    const newModules =
      u.role === 'CASHIER_RESTAURANT' ? MODULES_RESTAURANT : MODULES_DELIVERY;

    try {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          role: 'CASHIER',
          // Si el usuario ya tenía allowedModules personalizados, los respetamos.
          // Si no, asignamos los módulos por defecto del rol anterior.
          allowedModules: u.allowedModules ?? newModules,
        },
      });
      console.log(`  ✅ Migrado: ${u.firstName} ${u.lastName} (${u.role} → CASHIER)`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ Error migrando ${u.firstName} ${u.lastName}:`, err);
      errors++;
    }
  }

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log(`  Migrados: ${migrated} | Errores: ${errors}`);
  console.log('──────────────────────────────────────────────────────────────────\n');

  // ─── Fase 2: Verificación ─────────────────────────────────────────────────

  if (migrated > 0) {
    const ids = candidates.map(u => u.id);
    const verified = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, role: true, allowedModules: true },
      orderBy: { lastName: 'asc' },
    });

    console.log('  VERIFICACIÓN POST-MIGRACIÓN:');
    for (const v of verified) {
      const ok = v.role === 'CASHIER';
      console.log(
        `  ${ok ? '✅' : '❌'} ${v.firstName} ${v.lastName} — role=${v.role} | módulos=${v.allowedModules}`
      );
    }
    console.log('');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
