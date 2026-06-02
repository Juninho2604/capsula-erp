/**
 * seed-menu-from-json.ts
 * ──────────────────────
 * Carga (o reemplaza) el menú de un tenant a partir de un JSON normalizado
 * con la forma:
 *
 *   {
 *     "categories": [
 *       { "name": "...", "sortOrder": 10, "isActive": true,
 *         "items": [
 *           { "sku": "...", "name": "...", "description": null, "price": 9,
 *             "serviceCategory": "FOOD"|null, "kitchenRouting": "KITCHEN"|"BAR"|"AUTO"|"NONE"|null,
 *             "isAvailable": true, "isActive": true }
 *         ]
 *       }
 *     ]
 *   }
 *
 * El caso de uso original: migrar el menú combinado Shanklish + Table Pong
 * (extraído de la base Neon pre-multitenant) al tenant `tablepong`, donde
 * la cocina sirve también el menú de Shanklish.
 *
 * Características:
 *   - Idempotente. Categorías se resuelven por (tenantId, name); ítems por
 *     el unique compuesto (tenantId, sku). Re-correrlo no duplica.
 *   - Revive soft-deletes: si un sku/categoría existía borrado, lo restaura
 *     y actualiza (limpia deletedAt).
 *   - Orden seguro: primero upsert de todo lo nuevo, luego (en --replace) el
 *     soft-delete de lo que sobra → el menú nunca queda vacío a mitad de run.
 *
 * Uso:
 *   # Dry-run (default, no escribe nada):
 *   npx tsx scripts/seed-menu-from-json.ts --tenant-slug=tablepong
 *
 *   # Aplicar, modo upsert (no borra nada existente que no esté en el JSON):
 *   npx tsx scripts/seed-menu-from-json.ts --tenant-slug=tablepong --apply
 *
 *   # Aplicar reemplazando: ítems/categorías del tenant que NO estén en el
 *   # JSON se soft-deletean (deletedAt). NO hace hard-delete → respeta los
 *   # FK de SalesOrderItem hacia ventas históricas.
 *   npx tsx scripts/seed-menu-from-json.ts --tenant-slug=tablepong --apply --replace
 *
 *   # JSON alternativo:
 *   npx tsx scripts/seed-menu-from-json.ts --tenant-slug=tablepong --file=scripts/data/otro.json --apply
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

type JsonItem = {
    sku: string;
    name: string;
    description: string | null;
    price: number;
    serviceCategory: string | null;
    kitchenRouting: string | null;
    isAvailable: boolean;
    isActive: boolean;
};

type JsonCategory = {
    name: string;
    sortOrder: number;
    isActive: boolean;
    items: JsonItem[];
};

type MenuFile = {
    categories: JsonCategory[];
};

type Args = {
    tenantSlug: string;
    file: string;
    apply: boolean;
    replace: boolean;
};

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.length > 0 ? rest.join('=') : 'true';
    }
    const tenantSlug = map['tenant-slug'];
    if (!tenantSlug) {
        console.error('Falta --tenant-slug. Ejemplo: --tenant-slug=tablepong');
        process.exit(2);
    }
    return {
        tenantSlug,
        file: map['file'] || 'scripts/data/menu-tablepong.json',
        apply: map['apply'] === 'true',
        replace: map['replace'] === 'true',
    };
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    console.log('\n=== seed-menu-from-json ===');
    console.log('Tenant: ', args.tenantSlug);
    console.log('Archivo:', args.file);
    console.log('Modo:   ', args.apply ? 'APPLY' : 'DRY-RUN', args.replace ? '+ REPLACE' : '(upsert)');

    // 1. Cargar y validar JSON
    const raw = readFileSync(resolve(process.cwd(), args.file), 'utf-8');
    const data = JSON.parse(raw) as MenuFile;
    if (!Array.isArray(data.categories)) {
        console.error('JSON inválido: falta "categories" (array).');
        process.exit(2);
    }
    const jsonItems = data.categories.flatMap((c) => c.items);
    const jsonSkus = new Set(jsonItems.map((i) => i.sku));
    const jsonCatNames = new Set(data.categories.map((c) => c.name));
    if (jsonSkus.size !== jsonItems.length) {
        console.error('JSON inválido: hay SKUs duplicados entre categorías.');
        process.exit(2);
    }
    console.log(`\nJSON: ${data.categories.length} categorías, ${jsonItems.length} ítems.`);

    // 2. Resolver tenant
    const tenant = await prisma.tenant.findUnique({
        where: { slug: args.tenantSlug },
        select: { id: true, slug: true, name: true },
    });
    if (!tenant) {
        console.error(`\nTenant slug "${args.tenantSlug}" no existe.`);
        process.exit(2);
    }
    console.log(`Tenant resuelto: ${tenant.name} (${tenant.id})`);

    // 3. Estado actual del tenant (para reportar created/updated/revived/deleted)
    const existingCats = await prisma.menuCategory.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, name: true, deletedAt: true },
    });
    const existingItems = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id },
        select: { sku: true, deletedAt: true },
    });
    const existingItemBySku = new Map(existingItems.map((i) => [i.sku, i]));

    const stats = {
        catCreated: 0, catRevived: 0, catUpdated: 0, catDeleted: 0,
        itemCreated: 0, itemRevived: 0, itemUpdated: 0, itemDeleted: 0,
    };

    // Pre-cálculo para el reporte de dry-run
    for (const i of jsonItems) {
        const ex = existingItemBySku.get(i.sku);
        if (!ex) stats.itemCreated++;
        else if (ex.deletedAt) stats.itemRevived++;
        else stats.itemUpdated++;
    }
    const itemsToDelete = args.replace
        ? existingItems.filter((i) => !jsonSkus.has(i.sku) && i.deletedAt === null)
        : [];
    const catsToDelete = args.replace
        ? existingCats.filter((c) => !jsonCatNames.has(c.name) && c.deletedAt === null)
        : [];
    stats.itemDeleted = itemsToDelete.length;
    stats.catDeleted = catsToDelete.length;

    if (!args.apply) {
        console.log('\n[DRY-RUN] Cambios que se aplicarían:');
        console.log(`  Ítems:      +${stats.itemCreated} nuevos, ↻${stats.itemRevived} revividos, ~${stats.itemUpdated} actualizados${args.replace ? `, −${stats.itemDeleted} soft-deleted` : ''}`);
        console.log(`  Categorías: hasta ${data.categories.length} upsert${args.replace ? `, −${stats.catDeleted} soft-deleted` : ''}`);
        if (args.replace && itemsToDelete.length > 0) {
            console.log(`\n  SKUs que se soft-deletearían (${itemsToDelete.length}):`);
            console.log('    ' + itemsToDelete.map((i) => i.sku).join(', '));
        }
        if (args.replace && catsToDelete.length > 0) {
            console.log(`\n  Categorías que se soft-deletearían: ${catsToDelete.map((c) => c.name).join(', ')}`);
        }
        console.log('\nRe-correr con --apply para escribir.');
        await prisma.$disconnect();
        return;
    }

    // 4. Upsert categorías (resolver por nombre dentro del tenant)
    const catIdByName = new Map<string, string>();
    for (const cat of data.categories) {
        const existing = await prisma.menuCategory.findFirst({
            where: { tenantId: tenant.id, name: cat.name },
            orderBy: { deletedAt: 'asc' }, // prioriza la no-borrada (null primero)
            select: { id: true, deletedAt: true },
        });
        if (existing) {
            await prisma.menuCategory.update({
                where: { id: existing.id },
                data: { sortOrder: cat.sortOrder, isActive: cat.isActive, deletedAt: null, deletedById: null },
            });
            catIdByName.set(cat.name, existing.id);
            if (existing.deletedAt) stats.catRevived++; else stats.catUpdated++;
        } else {
            const created = await prisma.menuCategory.create({
                data: { tenantId: tenant.id, name: cat.name, sortOrder: cat.sortOrder, isActive: cat.isActive },
                select: { id: true },
            });
            catIdByName.set(cat.name, created.id);
            stats.catCreated++;
        }
    }

    // 5. Upsert ítems (por unique compuesto tenantId_sku)
    for (const cat of data.categories) {
        const categoryId = catIdByName.get(cat.name)!;
        for (const item of cat.items) {
            await prisma.menuItem.upsert({
                where: { tenantId_sku: { tenantId: tenant.id, sku: item.sku } },
                update: {
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    categoryId,
                    serviceCategory: item.serviceCategory,
                    kitchenRouting: item.kitchenRouting,
                    isAvailable: item.isAvailable,
                    isActive: item.isActive,
                    deletedAt: null,
                    deletedById: null,
                },
                create: {
                    tenantId: tenant.id,
                    sku: item.sku,
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    categoryId,
                    serviceCategory: item.serviceCategory,
                    kitchenRouting: item.kitchenRouting,
                    isAvailable: item.isAvailable,
                    isActive: item.isActive,
                },
            });
        }
    }

    // 6. Replace: soft-delete lo que sobra (después de cargar todo lo nuevo)
    if (args.replace) {
        const now = new Date();
        if (itemsToDelete.length > 0) {
            await prisma.menuItem.updateMany({
                where: { tenantId: tenant.id, sku: { in: itemsToDelete.map((i) => i.sku) }, deletedAt: null },
                data: { deletedAt: now },
            });
        }
        if (catsToDelete.length > 0) {
            await prisma.menuCategory.updateMany({
                where: { tenantId: tenant.id, id: { in: catsToDelete.map((c) => c.id) }, deletedAt: null },
                data: { deletedAt: now },
            });
        }
    }

    // 7. Reporte
    console.log('\n✓ Aplicado.');
    console.log(`  Categorías: +${stats.catCreated} nuevas, ↻${stats.catRevived} revividas, ~${stats.catUpdated} actualizadas${args.replace ? `, −${stats.catDeleted} soft-deleted` : ''}`);
    console.log(`  Ítems:      +${stats.itemCreated} nuevos, ↻${stats.itemRevived} revividos, ~${stats.itemUpdated} actualizados${args.replace ? `, −${stats.itemDeleted} soft-deleted` : ''}`);

    const finalCount = await prisma.menuItem.count({ where: { tenantId: tenant.id, deletedAt: null } });
    console.log(`  Total ítems activos en ${tenant.slug}: ${finalCount}`);

    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
