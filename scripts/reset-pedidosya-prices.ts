/**
 * reset-pedidosya-prices.ts
 * ─────────────────────────
 * Anula los overrides manuales `MenuItem.pedidosYaPrice` de un tenant para
 * que PedidosYA use EL MISMO precio del restaurante (`price`), que es el
 * nuevo fallback de calcPedidosYaPrice (10/07/2026).
 *
 * Dry-run por default: lista cada producto con su override actual vs el
 * precio de restaurante que pasará a regir. --apply para escribir.
 *
 * Uso (en el VPS):
 *   npx tsx scripts/reset-pedidosya-prices.ts --tenant-slug=shanklish
 *   npx tsx scripts/reset-pedidosya-prices.ts --tenant-slug=shanklish --apply
 */

import { PrismaClient } from '@prisma/client';

async function main() {
    const args: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        if (!a.startsWith('--')) continue;
        const [k, ...rest] = a.slice(2).split('=');
        args[k] = rest.length ? rest.join('=') : 'true';
    }
    const slug = args['tenant-slug'];
    if (!slug) { console.error('Falta --tenant-slug'); process.exit(2); }
    const apply = args['apply'] === 'true';

    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tenant) { console.error(`Tenant "${slug}" no existe`); process.exit(2); }

    console.log(`\n=== reset-pedidosya-prices · ${tenant.name} · ${apply ? 'APPLY' : 'DRY-RUN'} ===`);
    const items = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id, pedidosYaPrice: { not: null }, deletedAt: null },
        select: { id: true, sku: true, name: true, price: true, pedidosYaPrice: true },
        orderBy: { name: 'asc' },
    });
    if (items.length === 0) {
        console.log('No hay overrides de PedidosYA — ya rige el precio del restaurante en todo el menú.');
    } else {
        console.log(`${items.length} producto(s) con override PY (pasarán al precio de restaurante):\n`);
        for (const it of items) {
            console.log(`  ${it.sku.padEnd(14)} ${it.name.slice(0, 38).padEnd(40)} PY $${it.pedidosYaPrice!.toFixed(2).padStart(7)} → $${it.price.toFixed(2)}`);
        }
        if (apply) {
            const res = await prisma.menuItem.updateMany({
                where: { tenantId: tenant.id, pedidosYaPrice: { not: null }, deletedAt: null },
                data: { pedidosYaPrice: null },
            });
            console.log(`\n✓ ${res.count} override(s) anulados. PedidosYA usa ahora el precio del restaurante.`);
        } else {
            console.log('\n[DRY-RUN] Nada escrito. Re-correr con --apply para aplicar.');
        }
    }
    await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
