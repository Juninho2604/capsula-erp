/**
 * Crea un único insumo "AGUA" (RAW_MATERIAL, base L) para que las recetas que
 * usan agua descuenten de un solo item, en vez de generar 6 placeholders
 * distintos (Agua, Agua Potable, Agua Filtrada, Agua Fría…) con --create-missing.
 * El SKU es fijo (AGUA-INSUMO) para poder referenciarlo desde recetas-aliases.csv.
 *
 * Idempotente: si ya existe, no hace nada. Editable luego en la UI de Inventario.
 *
 * Uso (en el VPS, con DATABASE_URL de producción):
 *   npx tsx scripts/create-agua-insumo.ts
 */
import { PrismaClient } from '@prisma/client';

const SKU = 'AGUA-INSUMO';

async function main() {
  const prisma = new PrismaClient();
  const slug = process.env.SEED_TENANT_SLUG;
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('Tenant no encontrado');

  const existing = await prisma.inventoryItem.findFirst({
    where: { tenantId: tenant.id, sku: SKU },
  });
  if (existing) {
    console.log(`✓ Ya existe: ${existing.name} [${existing.sku}] — nada que hacer.`);
  } else {
    const it = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        name: 'AGUA',
        sku: SKU,
        type: 'RAW_MATERIAL',
        baseUnit: 'L',
        category: 'VIVERES',
        isActive: true,
      },
    });
    console.log(`✓ Insumo creado: ${it.name} [${it.sku}] base=L (editable en Inventario)`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
